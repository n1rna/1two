package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1tt/api/internal/middleware"
	"github.com/n1rna/1tt/api/internal/storage"
)

const maxLogoImages = 50
const maxLogoUploadSize = 20 << 20 // 20 MB (multi-variant uploads can be large)

func logoID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func logoSlug() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ── Types ───────────────────────────────────────────────

type logoVariantSummary struct {
	ID          string `json:"id"`
	Variant     string `json:"variant"`
	ContentType string `json:"contentType"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	Size        int64  `json:"size"`
}

type logoImageSummary struct {
	ID        string               `json:"id"`
	Slug      string               `json:"slug"`
	Name      string               `json:"name"`
	Width     int                  `json:"width"`
	Height    int                  `json:"height"`
	Published bool                 `json:"published"`
	Variants  []logoVariantSummary `json:"variants"`
	CreatedAt string               `json:"createdAt"`
}

// ── Helpers ─────────────────────────────────────────────

func r2KeyForVariant(userID, imageID, variant string) string {
	ext := "png"
	if variant == "svg" {
		ext = "svg"
	}
	return fmt.Sprintf("logos/%s/%s/%s.%s", userID, imageID, variant, ext)
}

func deleteVariantR2Keys(ctx context.Context, db *sql.DB, r2 *storage.R2Client, imageID string) {
	rows, err := db.QueryContext(ctx, `SELECT r2_key FROM logo_image_variants WHERE image_id = $1`, imageID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		if rows.Scan(&key) == nil && key != "" {
			if err := r2.Delete(ctx, key); err != nil {
				log.Printf("logo: r2 delete variant %s: %v", key, err)
			}
		}
	}
}

func loadVariants(ctx context.Context, db *sql.DB, imageID string) []logoVariantSummary {
	rows, err := db.QueryContext(ctx,
		`SELECT id, variant, content_type, width, height, size
		 FROM logo_image_variants WHERE image_id = $1 ORDER BY variant`, imageID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []logoVariantSummary
	for rows.Next() {
		var v logoVariantSummary
		if rows.Scan(&v.ID, &v.Variant, &v.ContentType, &v.Width, &v.Height, &v.Size) == nil {
			out = append(out, v)
		}
	}
	if out == nil {
		out = []logoVariantSummary{}
	}
	return out
}

// uploadVariantsFromForm reads file-{variant} fields from a parsed multipart
// form, uploads each to R2, and inserts rows into logo_image_variants.
// Returns the list of uploaded variant summaries and any uploaded R2 keys (for
// rollback on error).
func uploadVariantsFromForm(
	ctx context.Context,
	db *sql.DB,
	r2 *storage.R2Client,
	r *http.Request,
	userID, imageID string,
	variants []string,
) ([]logoVariantSummary, []string, error) {
	var uploaded []string
	var result []logoVariantSummary

	for _, v := range variants {
		fileKey := "file-" + v
		file, header, err := r.FormFile(fileKey)
		if err != nil {
			continue // variant not provided — skip
		}

		data, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			continue
		}

		ct := header.Header.Get("Content-Type")
		if ct == "" {
			if v == "svg" {
				ct = "image/svg+xml"
			} else {
				ct = "image/png"
			}
		}

		width, height := 0, 0
		fmt.Sscanf(r.FormValue("width-"+v), "%d", &width)
		fmt.Sscanf(r.FormValue("height-"+v), "%d", &height)

		r2Key := r2KeyForVariant(userID, imageID, v)
		if err := r2.Upload(ctx, r2Key, bytes.NewReader(data), ct, int64(len(data))); err != nil {
			log.Printf("logo: r2 upload variant %s: %v", v, err)
			return result, uploaded, fmt.Errorf("failed to upload variant %s", v)
		}
		uploaded = append(uploaded, r2Key)

		vid := logoID()
		_, err = db.ExecContext(ctx,
			`INSERT INTO logo_image_variants (id, image_id, variant, r2_key, content_type, width, height, size)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 ON CONFLICT (image_id, variant) DO UPDATE SET
			   r2_key = EXCLUDED.r2_key,
			   content_type = EXCLUDED.content_type,
			   width = EXCLUDED.width,
			   height = EXCLUDED.height,
			   size = EXCLUDED.size`,
			vid, imageID, v, r2Key, ct, width, height, len(data))
		if err != nil {
			log.Printf("logo: db insert variant %s: %v", v, err)
			return result, uploaded, fmt.Errorf("failed to record variant %s", v)
		}

		result = append(result, logoVariantSummary{
			ID:          vid,
			Variant:     v,
			ContentType: ct,
			Width:       width,
			Height:      height,
			Size:        int64(len(data)),
		})
	}

	return result, uploaded, nil
}

// ── Handlers ────────────────────────────────────────────

// CreateLogoImage uploads a logo image to R2 and stores metadata in the database.
// Supports two modes:
//  1. Legacy single-file: multipart form with "file", name, config, width, height.
//  2. Multi-variant: multipart form with "variants" (JSON array), and file-{variant} per variant.
func CreateLogoImage(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var count int
		if err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM logo_images WHERE user_id = $1`, userID).Scan(&count); err != nil {
			http.Error(w, `{"error":"failed to check logo count"}`, http.StatusInternalServerError)
			return
		}
		if count >= maxLogoImages {
			http.Error(w, fmt.Sprintf(`{"error":"maximum %d logos reached"}`, maxLogoImages), http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxLogoUploadSize)
		if err := r.ParseMultipartForm(maxLogoUploadSize); err != nil {
			http.Error(w, `{"error":"request too large"}`, http.StatusBadRequest)
			return
		}

		name := r.FormValue("name")
		if name == "" {
			name = "Untitled"
		}
		config := r.FormValue("config")

		id := logoID()
		slug := logoSlug()

		variantsJSON := r.FormValue("variants")
		isMultiVariant := variantsJSON != ""

		if isMultiVariant {
			var variants []string
			if err := json.Unmarshal([]byte(variantsJSON), &variants); err != nil || len(variants) == 0 {
				http.Error(w, `{"error":"invalid variants field"}`, http.StatusBadRequest)
				return
			}

			// Determine default dimensions from the largest PNG variant.
			defaultWidth, defaultHeight := 512, 512
			for _, v := range variants {
				w, h := 0, 0
				fmt.Sscanf(r.FormValue("width-"+v), "%d", &w)
				fmt.Sscanf(r.FormValue("height-"+v), "%d", &h)
				if w > defaultWidth {
					defaultWidth = w
					defaultHeight = h
				}
			}

			// Create parent row first (no legacy r2_key).
			var createdAt time.Time
			err := db.QueryRowContext(r.Context(),
				`INSERT INTO logo_images (id, user_id, slug, name, config, r2_key, content_type, width, height, size)
				 VALUES ($1, $2, $3, $4, $5, '', 'image/png', $6, $7, 0)
				 RETURNING created_at`,
				id, userID, slug, name, config, defaultWidth, defaultHeight,
			).Scan(&createdAt)
			if err != nil {
				http.Error(w, `{"error":"failed to create logo record"}`, http.StatusInternalServerError)
				return
			}

			variantResults, uploadedKeys, err := uploadVariantsFromForm(r.Context(), db, r2, r, userID, id, variants)
			if err != nil {
				// Rollback: delete uploaded R2 keys and the parent row.
				for _, key := range uploadedKeys {
					r2.Delete(context.Background(), key)
				}
				db.ExecContext(context.Background(), `DELETE FROM logo_images WHERE id = $1`, id)
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]any{
				"id":        id,
				"slug":      slug,
				"variants":  variantResults,
				"createdAt": createdAt.UTC().Format(time.RFC3339),
			})
			return
		}

		// ── Legacy single-file path ────────────────────────────────────────
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		width, height := 0, 0
		fmt.Sscanf(r.FormValue("width"), "%d", &width)
		fmt.Sscanf(r.FormValue("height"), "%d", &height)
		if width <= 0 || height <= 0 {
			http.Error(w, `{"error":"width and height are required"}`, http.StatusBadRequest)
			return
		}

		contentType := header.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "image/png"
		}
		r2Key := fmt.Sprintf("logos/%s/%s.png", userID, id)

		if err := r2.Upload(r.Context(), r2Key, file, contentType, header.Size); err != nil {
			log.Printf("logo: r2 upload error: %v", err)
			http.Error(w, `{"error":"failed to store image"}`, http.StatusInternalServerError)
			return
		}

		var createdAt time.Time
		err = db.QueryRowContext(r.Context(),
			`INSERT INTO logo_images (id, user_id, slug, name, config, r2_key, content_type, width, height, size)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 RETURNING created_at`,
			id, userID, slug, name, config, r2Key, contentType, width, height, header.Size,
		).Scan(&createdAt)
		if err != nil {
			r2.Delete(context.Background(), r2Key)
			http.Error(w, `{"error":"failed to record logo"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"id":        id,
			"slug":      slug,
			"createdAt": createdAt.UTC().Format(time.RFC3339),
		})
	}
}

// ListLogoImages returns all logos for the authenticated user, including variant info.
func ListLogoImages(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			`SELECT id, slug, name, width, height, published, created_at
			 FROM logo_images WHERE user_id = $1
			 ORDER BY created_at DESC`, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list logos"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := make([]logoImageSummary, 0)
		for rows.Next() {
			var item logoImageSummary
			var createdAt time.Time
			if err := rows.Scan(&item.ID, &item.Slug, &item.Name, &item.Width, &item.Height, &item.Published, &createdAt); err != nil {
				http.Error(w, `{"error":"failed to read logos"}`, http.StatusInternalServerError)
				return
			}
			item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			item.Variants = loadVariants(r.Context(), db, item.ID)
			items = append(items, item)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"logos": items})
	}
}

// DeleteLogoImage deletes a logo image, all its variants from R2, and the DB records.
func DeleteLogoImage(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		// Delete variant R2 keys first.
		deleteVariantR2Keys(r.Context(), db, r2, id)

		// Delete parent (CASCADE deletes variant rows).
		var r2Key string
		err := db.QueryRowContext(r.Context(),
			`DELETE FROM logo_images WHERE id = $1 AND user_id = $2 RETURNING r2_key`,
			id, userID).Scan(&r2Key)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"logo not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to delete logo"}`, http.StatusInternalServerError)
			return
		}

		// Delete legacy R2 key.
		if r2Key != "" {
			if err := r2.Delete(r.Context(), r2Key); err != nil {
				log.Printf("logo: r2 delete error for %s: %v", r2Key, err)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

// UpdateLogoImage replaces variants for an existing logo. Supports both
// legacy single-file and multi-variant forms (same as Create).
func UpdateLogoImage(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var oldR2Key, slug string
		err := db.QueryRowContext(r.Context(),
			`SELECT r2_key, slug FROM logo_images WHERE id = $1 AND user_id = $2`,
			id, userID).Scan(&oldR2Key, &slug)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"logo not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up logo"}`, http.StatusInternalServerError)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxLogoUploadSize)
		if err := r.ParseMultipartForm(maxLogoUploadSize); err != nil {
			http.Error(w, `{"error":"request too large"}`, http.StatusBadRequest)
			return
		}

		name := r.FormValue("name")
		if name == "" {
			name = "Untitled"
		}
		config := r.FormValue("config")

		variantsJSON := r.FormValue("variants")
		isMultiVariant := variantsJSON != ""

		if isMultiVariant {
			var variants []string
			if err := json.Unmarshal([]byte(variantsJSON), &variants); err != nil || len(variants) == 0 {
				http.Error(w, `{"error":"invalid variants field"}`, http.StatusBadRequest)
				return
			}

			// Delete old variant R2 keys that are being replaced.
			for _, v := range variants {
				var oldKey string
				if db.QueryRowContext(r.Context(),
					`SELECT r2_key FROM logo_image_variants WHERE image_id = $1 AND variant = $2`,
					id, v).Scan(&oldKey) == nil && oldKey != "" {
					r2.Delete(r.Context(), oldKey)
				}
			}

			variantResults, _, err := uploadVariantsFromForm(r.Context(), db, r2, r, userID, id, variants)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
				return
			}

			defaultWidth, defaultHeight := 0, 0
			for _, v := range variantResults {
				if v.Width > defaultWidth {
					defaultWidth = v.Width
					defaultHeight = v.Height
				}
			}
			if defaultWidth > 0 {
				db.ExecContext(r.Context(),
					`UPDATE logo_images SET name = $1, config = $2, width = $3, height = $4, updated_at = NOW()
					 WHERE id = $5`, name, config, defaultWidth, defaultHeight, id)
			} else {
				db.ExecContext(r.Context(),
					`UPDATE logo_images SET name = $1, config = $2, updated_at = NOW() WHERE id = $3`,
					name, config, id)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"id":       id,
				"slug":     slug,
				"variants": variantResults,
			})
			return
		}

		// ── Legacy single-file path ────────────────────────────────────────
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		width, height := 0, 0
		fmt.Sscanf(r.FormValue("width"), "%d", &width)
		fmt.Sscanf(r.FormValue("height"), "%d", &height)
		if width <= 0 || height <= 0 {
			http.Error(w, `{"error":"width and height are required"}`, http.StatusBadRequest)
			return
		}

		contentType := header.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "image/png"
		}

		r2Key := oldR2Key
		if r2Key == "" {
			r2Key = fmt.Sprintf("logos/%s/%s.png", userID, id)
		}

		if err := r2.Upload(r.Context(), r2Key, file, contentType, header.Size); err != nil {
			log.Printf("logo: r2 upload error: %v", err)
			http.Error(w, `{"error":"failed to store image"}`, http.StatusInternalServerError)
			return
		}

		var updatedAt time.Time
		err = db.QueryRowContext(r.Context(),
			`UPDATE logo_images
			 SET name = $1, config = $2, content_type = $3, width = $4, height = $5,
			     size = $6, r2_key = $7, updated_at = NOW()
			 WHERE id = $8 AND user_id = $9
			 RETURNING updated_at`,
			name, config, contentType, width, height, header.Size, r2Key, id, userID,
		).Scan(&updatedAt)
		if err != nil {
			log.Printf("logo: db update error: %v", err)
			http.Error(w, `{"error":"failed to update logo"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"id":        id,
			"slug":      slug,
			"updatedAt": updatedAt.UTC().Format(time.RFC3339),
		})
	}
}

// patchLogoRequest holds the optional fields accepted by PatchLogoImage.
type patchLogoRequest struct {
	Published      *bool    `json:"published,omitempty"`
	NewSlug        bool     `json:"newSlug,omitempty"`
	DeleteVariants []string `json:"deleteVariants,omitempty"`
}

// PatchLogoImage applies a partial update to a logo image record.
func PatchLogoImage(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var req patchLogoRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}

		if req.Published == nil && !req.NewSlug && len(req.DeleteVariants) == 0 {
			http.Error(w, `{"error":"no fields to update"}`, http.StatusBadRequest)
			return
		}

		// Handle variant deletion.
		for _, v := range req.DeleteVariants {
			var r2Key string
			if db.QueryRowContext(r.Context(),
				`SELECT r2_key FROM logo_image_variants WHERE image_id = $1 AND variant = $2`,
				id, v).Scan(&r2Key) == nil {
				if r2Key != "" {
					r2.Delete(r.Context(), r2Key)
				}
				db.ExecContext(r.Context(),
					`DELETE FROM logo_image_variants WHERE image_id = $1 AND variant = $2`, id, v)
			}
		}

		setClauses := []string{"updated_at = NOW()"}
		args := []any{id, userID}
		argIdx := 3

		if req.Published != nil {
			setClauses = append(setClauses, fmt.Sprintf("published = $%d", argIdx))
			args = append(args, *req.Published)
			argIdx++
		}
		if req.NewSlug {
			setClauses = append(setClauses, fmt.Sprintf("slug = $%d", argIdx))
			args = append(args, logoSlug())
			argIdx++
		}

		query := "UPDATE logo_images SET " + strings.Join(setClauses, ", ") +
			" WHERE id = $1 AND user_id = $2 RETURNING slug, published, updated_at"

		var (
			slug      string
			published bool
			updatedAt time.Time
		)
		err := db.QueryRowContext(r.Context(), query, args...).Scan(&slug, &published, &updatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"logo not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("logo patch: db error: %v", err)
			http.Error(w, `{"error":"failed to update logo"}`, http.StatusInternalServerError)
			return
		}

		variants := loadVariants(r.Context(), db, id)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"id":        id,
			"slug":      slug,
			"published": published,
			"variants":  variants,
			"updatedAt": updatedAt.UTC().Format(time.RFC3339),
		})
	}
}

// GetLogoImageBySlug serves a published logo image. Public, no auth required.
// Accepts ?variant=512 or ?variant=svg to serve a specific size.
// Falls back to the largest PNG variant, then to the legacy r2_key.
func GetLogoImageBySlug(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")

		var imageID, legacyR2Key, legacyCT string
		var published bool
		err := db.QueryRowContext(r.Context(),
			`SELECT id, r2_key, content_type, published FROM logo_images WHERE slug = $1`,
			slug).Scan(&imageID, &legacyR2Key, &legacyCT, &published)
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		if !published {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		requestedVariant := r.URL.Query().Get("variant")
		if requestedVariant == "" {
			requestedVariant = r.URL.Query().Get("size")
		}

		var r2Key, contentType string

		if requestedVariant != "" {
			// Serve specific variant.
			err = db.QueryRowContext(r.Context(),
				`SELECT r2_key, content_type FROM logo_image_variants
				 WHERE image_id = $1 AND variant = $2`,
				imageID, requestedVariant).Scan(&r2Key, &contentType)
			if err != nil {
				http.Error(w, "variant not found", http.StatusNotFound)
				return
			}
		} else {
			// Serve default: largest PNG variant, or legacy key.
			err = db.QueryRowContext(r.Context(),
				`SELECT r2_key, content_type FROM logo_image_variants
				 WHERE image_id = $1 AND variant != 'svg'
				 ORDER BY width DESC LIMIT 1`,
				imageID).Scan(&r2Key, &contentType)
			if err != nil {
				// Fallback to legacy.
				if legacyR2Key != "" {
					r2Key = legacyR2Key
					contentType = legacyCT
				} else {
					http.Error(w, "no image available", http.StatusNotFound)
					return
				}
			}
		}

		data, err := r2.Get(r.Context(), r2Key)
		if err != nil {
			log.Printf("logo: r2 get error for %s: %v", r2Key, err)
			http.Error(w, "failed to retrieve image", http.StatusInternalServerError)
			return
		}
		if data == nil {
			http.Error(w, "image not found in storage", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600")
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
		w.Write(data)
	}
}
