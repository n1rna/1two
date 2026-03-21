package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/n1rna/1tt/api/internal/billing"
	"github.com/n1rna/1tt/api/internal/middleware"
	"github.com/n1rna/1tt/api/internal/storage"
)

// bucketNameRe matches valid bucket names: lowercase alphanumeric and hyphens, 3–63 chars.
var bucketNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)

// StorageBucketRecord is the JSON representation of a user_storage_buckets row.
type StorageBucketRecord struct {
	ID           string `json:"id"`
	UserID       string `json:"userId"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	TotalSize    int64  `json:"totalSize"`
	ObjectCount  int    `json:"objectCount"`
	R2BucketName string `json:"r2BucketName"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

// StorageObjectRecord is the JSON representation of a storage_objects row.
type StorageObjectRecord struct {
	ID          string `json:"id"`
	BucketID    string `json:"bucketId"`
	UserID      string `json:"userId"`
	Key         string `json:"key"`
	R2Key       string `json:"r2Key"`
	Size        int64  `json:"size"`
	ContentType string `json:"contentType"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// scanBucket scans a single user_storage_buckets row into StorageBucketRecord.
// The query must SELECT: id, user_id, name, status, total_size, object_count,
// r2_bucket_name, created_at, updated_at (in that order).
func scanBucket(row interface {
	Scan(dest ...any) error
}) (StorageBucketRecord, error) {
	var b StorageBucketRecord
	var createdAt, updatedAt time.Time
	if err := row.Scan(&b.ID, &b.UserID, &b.Name, &b.Status, &b.TotalSize, &b.ObjectCount, &b.R2BucketName, &createdAt, &updatedAt); err != nil {
		return b, err
	}
	b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	b.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return b, nil
}

// bucketAuth holds the info needed to build a per-bucket R2 client.
type bucketAuth struct {
	R2BucketName   string
	S3AccessKeyID  string
	S3SecretKey    string
}

// lookupBucketAuth fetches bucket ownership and credentials, returning
// an error HTTP response if the bucket is not found or not owned by userID.
func lookupBucketAuth(ctx context.Context, db *sql.DB, bucketID, userID string, w http.ResponseWriter) (*bucketAuth, bool) {
	var ownerID string
	var ba bucketAuth
	err := db.QueryRowContext(ctx,
		`SELECT user_id, r2_bucket_name, s3_access_key_id, s3_secret_access_key
		 FROM user_storage_buckets WHERE id = $1 AND status = 'active'`,
		bucketID,
	).Scan(&ownerID, &ba.R2BucketName, &ba.S3AccessKeyID, &ba.S3SecretKey)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
		} else {
			http.Error(w, `{"error":"failed to look up bucket"}`, http.StatusInternalServerError)
		}
		return nil, false
	}
	if ownerID != userID {
		http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
		return nil, false
	}
	return &ba, true
}

// CreateStorageBucket handles POST /storage/buckets.
// Creates a real R2 bucket and a scoped API token, then stores the bucket record.
func CreateStorageBucket(db *sql.DB, r2Client *storage.R2Client, cfClient *storage.CloudflareClient, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
			return
		}
		if !bucketNameRe.MatchString(req.Name) {
			http.Error(w, `{"error":"bucket name must be 3–63 lowercase alphanumeric characters or hyphens, and cannot start or end with a hyphen"}`, http.StatusBadRequest)
			return
		}

		// Check plan limits.
		tier := billing.GetUserPlanTier(r.Context(), db, userID)
		limits := billing.Plans[tier]

		if limits.StorageBucketsMax <= 0 {
			http.Error(w, `{"error":"object storage requires a paid plan"}`, http.StatusForbidden)
			return
		}

		var activeCount int
		if err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM user_storage_buckets WHERE user_id = $1 AND status = 'active'`,
			userID).Scan(&activeCount); err != nil {
			http.Error(w, `{"error":"failed to check bucket count"}`, http.StatusInternalServerError)
			return
		}
		if activeCount >= limits.StorageBucketsMax {
			http.Error(w, `{"error":"storage bucket limit reached for your plan"}`, http.StatusForbidden)
			return
		}

		id := uuid.NewString()

		// Derive a globally-unique R2 bucket name from the first 8 chars of the UUID.
		r2BucketName := "1tt-" + strings.ReplaceAll(id, "-", "")[:8]

		// Create the real R2 bucket via the Cloudflare API.
		if err := cfClient.CreateR2Bucket(r.Context(), r2BucketName); err != nil {
			log.Printf("storage: create R2 bucket %q: %v", r2BucketName, err)
			http.Error(w, `{"error":"failed to provision storage bucket"}`, http.StatusInternalServerError)
			return
		}

		// Create a per-bucket API token with S3-compatible credentials.
		tokenName := "1tt-storage-" + r2BucketName
		creds, err := cfClient.CreateBucketToken(r.Context(), tokenName)
		if err != nil {
			log.Printf("storage: create bucket token for %q: %v", r2BucketName, err)
			// Roll back: delete the R2 bucket we just created.
			if delErr := cfClient.DeleteR2Bucket(r.Context(), r2BucketName); delErr != nil {
				log.Printf("storage: cleanup R2 bucket %q after token failure: %v", r2BucketName, delErr)
			}
			http.Error(w, `{"error":"failed to provision storage credentials"}`, http.StatusInternalServerError)
			return
		}

		const q = `
			INSERT INTO user_storage_buckets
			    (id, user_id, name, status, r2_bucket_name, cf_token_id, s3_access_key_id, s3_secret_access_key)
			VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
			RETURNING id, user_id, name, status, total_size, object_count, r2_bucket_name, created_at, updated_at`

		row := db.QueryRowContext(r.Context(), q,
			id, userID, req.Name, r2BucketName,
			creds.CfTokenID, creds.S3AccessKeyID, creds.S3SecretKey,
		)
		bucket, err := scanBucket(row)
		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				http.Error(w, `{"error":"a bucket with that name already exists"}`, http.StatusConflict)
				return
			}
			log.Printf("storage: create bucket error: %v", err)
			http.Error(w, `{"error":"failed to create bucket"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"bucket": bucket})
	}
}

// ListStorageBuckets handles GET /storage/buckets.
// Returns all active buckets for the authenticated user.
func ListStorageBuckets(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, user_id, name, status, total_size, object_count, r2_bucket_name, created_at, updated_at
			FROM user_storage_buckets
			WHERE user_id = $1 AND status = 'active'
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list buckets"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		buckets := make([]StorageBucketRecord, 0)
		for rows.Next() {
			b, err := scanBucket(rows)
			if err != nil {
				http.Error(w, `{"error":"failed to read buckets"}`, http.StatusInternalServerError)
				return
			}
			buckets = append(buckets, b)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate buckets"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"buckets": buckets})
	}
}

// DeleteStorageBucket handles DELETE /storage/buckets/{id}.
// Deletes all objects from R2, removes DB rows, cleans up the CF token, and deletes the bucket.
func DeleteStorageBucket(db *sql.DB, r2AccountID string, cfClient *storage.CloudflareClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		bucketID := chi.URLParam(r, "id")

		// Verify ownership and fetch R2 metadata + credentials.
		var bucketOwner, r2BucketName, cfTokenID, s3AccessKey, s3SecretKey string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id, r2_bucket_name, cf_token_id, s3_access_key_id, s3_secret_access_key
			 FROM user_storage_buckets WHERE id = $1 AND status = 'active'`,
			bucketID).Scan(&bucketOwner, &r2BucketName, &cfTokenID, &s3AccessKey, &s3SecretKey); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to look up bucket"}`, http.StatusInternalServerError)
			return
		}
		if bucketOwner != userID {
			http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
			return
		}

		// Collect all R2 keys for this bucket.
		rows, err := db.QueryContext(r.Context(),
			`SELECT r2_key FROM storage_objects WHERE bucket_id = $1`, bucketID)
		if err != nil {
			http.Error(w, `{"error":"failed to list objects"}`, http.StatusInternalServerError)
			return
		}
		var r2Keys []string
		for rows.Next() {
			var k string
			if err := rows.Scan(&k); err != nil {
				rows.Close()
				http.Error(w, `{"error":"failed to read object keys"}`, http.StatusInternalServerError)
				return
			}
			r2Keys = append(r2Keys, k)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate object keys"}`, http.StatusInternalServerError)
			return
		}

		// Delete each object from the per-user R2 bucket using its own credentials.
		bucketR2 := storage.NewR2ClientForBucket(r2AccountID, s3AccessKey, s3SecretKey, r2BucketName)
		for _, key := range r2Keys {
			if err := bucketR2.Delete(r.Context(), key); err != nil {
				log.Printf("storage: delete bucket %s R2 key %q from %q: %v", bucketID, key, r2BucketName, err)
			}
		}

		// Delete the per-bucket API token.
		if cfTokenID != "" {
			if err := cfClient.DeleteBucketToken(r.Context(), cfTokenID); err != nil {
				log.Printf("storage: delete bucket token %q: %v", cfTokenID, err)
			}
		}

		// Delete the R2 bucket itself (must be empty).
		if r2BucketName != "" {
			if err := cfClient.DeleteR2Bucket(r.Context(), r2BucketName); err != nil {
				log.Printf("storage: delete R2 bucket %q: %v", r2BucketName, err)
			}
		}

		// Cascade deletes storage_objects rows via the FK constraint, then delete
		// the bucket row itself.
		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM user_storage_buckets WHERE id = $1`, bucketID); err != nil {
			http.Error(w, `{"error":"failed to delete bucket"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ListStorageObjects handles GET /storage/buckets/{id}/objects.
// Query params: prefix (optional), delimiter (optional, use "/" for folder view), limit (default 100).
func ListStorageObjects(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		bucketID := chi.URLParam(r, "id")

		// Verify ownership.
		var bucketOwner string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM user_storage_buckets WHERE id = $1 AND status = 'active'`,
			bucketID).Scan(&bucketOwner); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to look up bucket"}`, http.StatusInternalServerError)
			return
		}
		if bucketOwner != userID {
			http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
			return
		}

		prefix := r.URL.Query().Get("prefix")
		delimiter := r.URL.Query().Get("delimiter")
		limit := 100
		if lStr := r.URL.Query().Get("limit"); lStr != "" {
			if _, err := fmt.Sscanf(lStr, "%d", &limit); err != nil || limit <= 0 || limit > 1000 {
				limit = 100
			}
		}

		const q = `
			SELECT id, bucket_id, user_id, key, r2_key, size, content_type, created_at, updated_at
			FROM storage_objects
			WHERE bucket_id = $1 AND ($2 = '' OR key LIKE $2 || '%')
			ORDER BY key
			LIMIT $3`

		rows, err := db.QueryContext(r.Context(), q, bucketID, prefix, limit)
		if err != nil {
			http.Error(w, `{"error":"failed to list objects"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		objects := make([]StorageObjectRecord, 0)
		commonPrefixes := make(map[string]struct{})

		for rows.Next() {
			var obj StorageObjectRecord
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&obj.ID, &obj.BucketID, &obj.UserID, &obj.Key, &obj.R2Key,
				&obj.Size, &obj.ContentType, &createdAt, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read objects"}`, http.StatusInternalServerError)
				return
			}
			obj.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			obj.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

			// When a delimiter is set, group keys that contain the delimiter after
			// the prefix into common prefixes (simulating folder behaviour).
			if delimiter != "" {
				rel := obj.Key
				if prefix != "" {
					rel = strings.TrimPrefix(obj.Key, prefix)
				}
				if idx := strings.Index(rel, delimiter); idx >= 0 {
					cp := prefix + rel[:idx+len(delimiter)]
					commonPrefixes[cp] = struct{}{}
					continue
				}
			}
			objects = append(objects, obj)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate objects"}`, http.StatusInternalServerError)
			return
		}

		// Flatten common prefixes into a sorted slice.
		cpSlice := make([]string, 0, len(commonPrefixes))
		for cp := range commonPrefixes {
			cpSlice = append(cpSlice, cp)
		}

		json.NewEncoder(w).Encode(map[string]any{
			"objects":        objects,
			"commonPrefixes": cpSlice,
		})
	}
}

// UploadStorageObject handles POST /storage/buckets/{id}/objects.
// Accepts a multipart/form-data body with a "file" field and an optional "key" field.
func UploadStorageObject(db *sql.DB, r2AccountID string, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Resolve plan limits before touching the body.
		tier := billing.GetUserPlanTier(r.Context(), db, userID)
		limits := billing.Plans[tier]

		if limits.StorageBucketsMax <= 0 {
			http.Error(w, `{"error":"object storage requires a paid plan"}`, http.StatusForbidden)
			return
		}

		maxFileBytes := limits.StorageMaxFileSizeMB * 1024 * 1024
		if maxFileBytes <= 0 {
			http.Error(w, `{"error":"file uploads are not enabled on your plan"}`, http.StatusForbidden)
			return
		}

		bucketID := chi.URLParam(r, "id")

		ba, ok := lookupBucketAuth(r.Context(), db, bucketID, userID, w)
		if !ok {
			return
		}

		// Parse the multipart body, capping memory to the per-file limit.
		if err := r.ParseMultipartForm(maxFileBytes); err != nil {
			http.Error(w, `{"error":"failed to parse multipart form or file too large"}`, http.StatusBadRequest)
			return
		}

		// Determine the object key first — folder creation sends only "key" with no file.
		objectKey := strings.TrimSpace(r.FormValue("key"))

		file, header, fileErr := r.FormFile("file")
		isFolder := fileErr != nil && strings.HasSuffix(objectKey, "/")

		var fileSize int64
		var contentType string

		if isFolder {
			// Folder placeholder — zero-byte object with trailing slash.
			fileSize = 0
			contentType = "application/x-directory"
		} else if fileErr != nil {
			http.Error(w, `{"error":"file field is required"}`, http.StatusBadRequest)
			return
		} else {
			defer file.Close()

			// Enforce per-file size limit.
			if header.Size > maxFileBytes {
				http.Error(w, fmt.Sprintf(`{"error":"file exceeds maximum allowed size of %d MB"}`, limits.StorageMaxFileSizeMB), http.StatusRequestEntityTooLarge)
				return
			}
			fileSize = header.Size

			if objectKey == "" {
				objectKey = header.Filename
			}

			// Determine content type.
			contentType = header.Header.Get("Content-Type")
			if contentType == "" || contentType == "application/octet-stream" {
				if ext := filepath.Ext(header.Filename); ext != "" {
					if ct := mime.TypeByExtension(ext); ct != "" {
						contentType = ct
					}
				}
			}
			if contentType == "" {
				contentType = "application/octet-stream"
			}
		}

		// Normalise path separators and strip leading slashes.
		objectKey = strings.TrimLeft(filepath.ToSlash(objectKey), "/")
		if objectKey == "" {
			http.Error(w, `{"error":"could not determine a valid object key"}`, http.StatusBadRequest)
			return
		}

		// Check total storage quota.
		maxStorageBytes := limits.StorageMaxGB * 1024 * 1024 * 1024
		var usedBytes int64
		if err := db.QueryRowContext(r.Context(),
			`SELECT COALESCE(SUM(size), 0) FROM storage_objects WHERE user_id = $1`,
			userID).Scan(&usedBytes); err != nil {
			http.Error(w, `{"error":"failed to check storage usage"}`, http.StatusInternalServerError)
			return
		}
		if usedBytes+fileSize > maxStorageBytes {
			http.Error(w, fmt.Sprintf(`{"error":"upload would exceed your storage quota of %d GB"}`, limits.StorageMaxGB), http.StatusForbidden)
			return
		}

		// Build a per-bucket S3 client using the bucket's own credentials.
		bucketR2 := storage.NewR2ClientForBucket(r2AccountID, ba.S3AccessKeyID, ba.S3SecretKey, ba.R2BucketName)

		var uploadBody io.Reader
		if isFolder {
			uploadBody = strings.NewReader("")
		} else {
			uploadBody = file
		}
		if err := bucketR2.Upload(r.Context(), objectKey, uploadBody, contentType, fileSize); err != nil {
			log.Printf("storage: R2 upload error: %v", err)
			http.Error(w, `{"error":"failed to upload file"}`, http.StatusInternalServerError)
			return
		}

		// UPSERT the object record and refresh bucket totals atomically.
		objectID := uuid.NewString()
		now := time.Now().UTC()

		// r2_key is just the objectKey — no prefix needed since each bucket is isolated.
		const upsertQ = `
			INSERT INTO storage_objects (id, bucket_id, user_id, key, r2_key, size, content_type, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
			ON CONFLICT (bucket_id, key) DO UPDATE
			SET r2_key       = EXCLUDED.r2_key,
			    size         = EXCLUDED.size,
			    content_type = EXCLUDED.content_type,
			    updated_at   = EXCLUDED.updated_at
			RETURNING id, bucket_id, user_id, key, r2_key, size, content_type, created_at, updated_at`

		var obj StorageObjectRecord
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), upsertQ,
			objectID, bucketID, userID, objectKey, objectKey, fileSize, contentType, now,
		).Scan(&obj.ID, &obj.BucketID, &obj.UserID, &obj.Key, &obj.R2Key,
			&obj.Size, &obj.ContentType, &createdAt, &updatedAt); err != nil {
			log.Printf("storage: upsert object error: %v", err)
			http.Error(w, `{"error":"failed to record object"}`, http.StatusInternalServerError)
			return
		}
		obj.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		obj.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Refresh denormalised totals on the bucket.
		if _, err := db.ExecContext(r.Context(), `
			UPDATE user_storage_buckets
			SET total_size   = (SELECT COALESCE(SUM(size), 0) FROM storage_objects WHERE bucket_id = $1),
			    object_count = (SELECT COUNT(*)              FROM storage_objects WHERE bucket_id = $1),
			    updated_at   = NOW()
			WHERE id = $1`, bucketID); err != nil {
			log.Printf("storage: update bucket totals error: %v", err)
			// Non-fatal — the object is already stored.
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"object": obj})
	}
}

// DeleteStorageObject handles DELETE /storage/buckets/{id}/objects/{objectId}.
func DeleteStorageObject(db *sql.DB, r2AccountID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		bucketID := chi.URLParam(r, "id")
		objectID := chi.URLParam(r, "objectId")

		// Fetch bucket credentials + object key.
		var r2Key, ownerID string
		var ba bucketAuth
		if err := db.QueryRowContext(r.Context(), `
			SELECT o.r2_key, b.user_id, b.r2_bucket_name, b.s3_access_key_id, b.s3_secret_access_key
			FROM storage_objects o
			JOIN user_storage_buckets b ON b.id = o.bucket_id
			WHERE o.id = $1 AND o.bucket_id = $2`,
			objectID, bucketID,
		).Scan(&r2Key, &ownerID, &ba.R2BucketName, &ba.S3AccessKeyID, &ba.S3SecretKey); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"object not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to look up object"}`, http.StatusInternalServerError)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"object not found"}`, http.StatusNotFound)
			return
		}

		// Delete from R2 using per-bucket credentials.
		bucketR2 := storage.NewR2ClientForBucket(r2AccountID, ba.S3AccessKeyID, ba.S3SecretKey, ba.R2BucketName)
		if err := bucketR2.Delete(r.Context(), r2Key); err != nil {
			log.Printf("storage: delete object R2 key %q from bucket %q: %v", r2Key, ba.R2BucketName, err)
			// Continue — we still want to remove the DB record.
		}

		// Delete the DB row.
		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM storage_objects WHERE id = $1`, objectID); err != nil {
			http.Error(w, `{"error":"failed to delete object record"}`, http.StatusInternalServerError)
			return
		}

		// Refresh bucket totals.
		if _, err := db.ExecContext(r.Context(), `
			UPDATE user_storage_buckets
			SET total_size   = (SELECT COALESCE(SUM(size), 0) FROM storage_objects WHERE bucket_id = $1),
			    object_count = (SELECT COUNT(*)              FROM storage_objects WHERE bucket_id = $1),
			    updated_at   = NOW()
			WHERE id = $1`, bucketID); err != nil {
			log.Printf("storage: update bucket totals after delete error: %v", err)
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// GetStorageObjectUrl handles GET /storage/buckets/{id}/objects/{objectId}/url.
// Returns a presigned download URL valid for 15 minutes.
func GetStorageObjectUrl(db *sql.DB, r2AccountID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		bucketID := chi.URLParam(r, "id")
		objectID := chi.URLParam(r, "objectId")

		var r2Key, objectKey, ownerID string
		var ba bucketAuth
		if err := db.QueryRowContext(r.Context(), `
			SELECT o.r2_key, o.key, b.user_id, b.r2_bucket_name, b.s3_access_key_id, b.s3_secret_access_key
			FROM storage_objects o
			JOIN user_storage_buckets b ON b.id = o.bucket_id
			WHERE o.id = $1 AND o.bucket_id = $2`,
			objectID, bucketID,
		).Scan(&r2Key, &objectKey, &ownerID, &ba.R2BucketName, &ba.S3AccessKeyID, &ba.S3SecretKey); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"object not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to look up object"}`, http.StatusInternalServerError)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"object not found"}`, http.StatusNotFound)
			return
		}

		const ttl = 15 * time.Minute
		filename := filepath.Base(objectKey)
		bucketR2 := storage.NewR2ClientForBucket(r2AccountID, ba.S3AccessKeyID, ba.S3SecretKey, ba.R2BucketName)
		presignedURL, err := bucketR2.PresignedURL(r.Context(), r2Key, filename, ttl)
		if err != nil {
			log.Printf("storage: presign error for key %q in bucket %q: %v", r2Key, ba.R2BucketName, err)
			http.Error(w, `{"error":"failed to generate download URL"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{
			"url":       presignedURL,
			"expiresIn": int(ttl.Seconds()),
		})
	}
}

// GetStorageBucketCredentials handles GET /storage/buckets/{id}/credentials.
// Returns the S3-compatible credentials for the bucket so the user can access it directly.
// GetStorageBucketCredentials handles GET /storage/buckets/{id}/credentials.
// Returns the permanent S3-compatible credentials for this bucket.
func GetStorageBucketCredentials(db *sql.DB, cfClient *storage.CloudflareClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		bucketID := chi.URLParam(r, "id")

		var ownerID, r2BucketName, accessKeyID, secretAccessKey string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id, r2_bucket_name, s3_access_key_id, s3_secret_access_key
			 FROM user_storage_buckets
			 WHERE id = $1 AND status = 'active'`,
			bucketID,
		).Scan(&ownerID, &r2BucketName, &accessKeyID, &secretAccessKey); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to look up bucket"}`, http.StatusInternalServerError)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"bucket not found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{
			"endpoint":        cfClient.S3Endpoint(),
			"bucketName":      r2BucketName,
			"accessKeyId":     accessKeyID,
			"secretAccessKey": secretAccessKey,
			"region":          "auto",
		})
	}
}

// GetStorageUsage handles GET /storage/usage.
// Returns the user's total storage usage and plan limits.
func GetStorageUsage(db *sql.DB, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		tier := billing.GetUserPlanTier(r.Context(), db, userID)
		limits := billing.Plans[tier]

		var usedBytes int64
		if err := db.QueryRowContext(r.Context(),
			`SELECT COALESCE(SUM(size), 0) FROM storage_objects WHERE user_id = $1`,
			userID).Scan(&usedBytes); err != nil {
			http.Error(w, `{"error":"failed to calculate storage usage"}`, http.StatusInternalServerError)
			return
		}

		var bucketCount int
		if err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM user_storage_buckets WHERE user_id = $1 AND status = 'active'`,
			userID).Scan(&bucketCount); err != nil {
			http.Error(w, `{"error":"failed to count buckets"}`, http.StatusInternalServerError)
			return
		}

		limitBytes := limits.StorageMaxGB * 1024 * 1024 * 1024

		json.NewEncoder(w).Encode(map[string]any{
			"usedBytes":   usedBytes,
			"limitBytes":  limitBytes,
			"bucketCount": bucketCount,
			"bucketLimit": limits.StorageBucketsMax,
		})
	}
}
