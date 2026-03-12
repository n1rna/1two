package handler

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1two/api/internal/middleware"
	"github.com/n1rna/1two/api/internal/storage"
)

const maxLogoImages = 50
const maxLogoSize = 5 << 20 // 5 MB

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

type logoImageSummary struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Published bool   `json:"published"`
	CreatedAt string `json:"createdAt"`
}

// ── Handlers ────────────────────────────────────────────

// CreateLogoImage uploads a logo image to R2 and stores metadata in the database.
// Accepts multipart form with: file (PNG blob), name, config (JSON), width, height.
func CreateLogoImage(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Check limit
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

		r.Body = http.MaxBytesReader(w, r.Body, maxLogoSize)
		if err := r.ParseMultipartForm(maxLogoSize); err != nil {
			http.Error(w, `{"error":"file too large (max 5MB)"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		name := r.FormValue("name")
		if name == "" {
			name = "Untitled"
		}
		config := r.FormValue("config")
		width := 0
		height := 0
		fmt.Sscanf(r.FormValue("width"), "%d", &width)
		fmt.Sscanf(r.FormValue("height"), "%d", &height)
		if width <= 0 || height <= 0 {
			http.Error(w, `{"error":"width and height are required"}`, http.StatusBadRequest)
			return
		}

		id := logoID()
		slug := logoSlug()
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

// ListLogoImages returns all logos for the authenticated user.
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
			items = append(items, item)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"logos": items})
	}
}

// DeleteLogoImage deletes a logo image from R2 and the database.
func DeleteLogoImage(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

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

		if err := r2.Delete(r.Context(), r2Key); err != nil {
			log.Printf("logo: r2 delete error for %s: %v", r2Key, err)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

// UpdateLogoImage replaces the file and metadata for an existing logo image.
// Accepts multipart form with: file (PNG blob), name, config (JSON), width, height.
// The file is uploaded to the same R2 key, overwriting the previous version.
func UpdateLogoImage(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		// Look up existing record to obtain the stable r2_key and slug.
		var r2Key, slug string
		err := db.QueryRowContext(r.Context(),
			`SELECT r2_key, slug FROM logo_images WHERE id = $1 AND user_id = $2`,
			id, userID).Scan(&r2Key, &slug)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"logo not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up logo"}`, http.StatusInternalServerError)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxLogoSize)
		if err := r.ParseMultipartForm(maxLogoSize); err != nil {
			http.Error(w, `{"error":"file too large (max 5MB)"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		name := r.FormValue("name")
		if name == "" {
			name = "Untitled"
		}
		config := r.FormValue("config")
		width := 0
		height := 0
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

		// Overwrite the existing R2 object at the same key.
		if err := r2.Upload(r.Context(), r2Key, file, contentType, header.Size); err != nil {
			log.Printf("logo: r2 upload error: %v", err)
			http.Error(w, `{"error":"failed to store image"}`, http.StatusInternalServerError)
			return
		}

		var updatedAt time.Time
		err = db.QueryRowContext(r.Context(),
			`UPDATE logo_images
			 SET name = $1, config = $2, content_type = $3, width = $4, height = $5,
			     size = $6, updated_at = NOW()
			 WHERE id = $7 AND user_id = $8
			 RETURNING updated_at`,
			name, config, contentType, width, height, header.Size, id, userID,
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
	Published *bool `json:"published,omitempty"`
	NewSlug   bool  `json:"newSlug,omitempty"`
}

// PatchLogoImage applies a partial update to a logo image record.
// Accepts a JSON body with optional fields: published (bool pointer) and newSlug (bool).
// PATCH /api/v1/logo/images/{id}
func PatchLogoImage(db *sql.DB) http.HandlerFunc {
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

		// Build SET clauses dynamically; updated_at is always included.
		setClauses := []string{"updated_at = NOW()"}
		args := []any{id, userID}
		argIdx := 3 // $1 = id, $2 = user_id, next param starts at $3

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

		// Nothing to change beyond updated_at is still a valid no-op update, but
		// guard against a request that sends an empty body with no recognised fields.
		if req.Published == nil && !req.NewSlug {
			http.Error(w, `{"error":"no fields to update"}`, http.StatusBadRequest)
			return
		}

		query := "UPDATE logo_images SET " + joinStrings(setClauses, ", ") +
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

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"id":        id,
			"slug":      slug,
			"published": published,
			"updatedAt": updatedAt.UTC().Format(time.RFC3339),
		})
	}
}

// GetLogoImageBySlug serves a published logo image. Public, no auth required.
// Returns the raw image bytes from R2 with aggressive cache headers.
func GetLogoImageBySlug(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")

		var r2Key, contentType string
		err := db.QueryRowContext(r.Context(),
			`SELECT r2_key, content_type FROM logo_images
			 WHERE slug = $1 AND published = TRUE`,
			slug).Scan(&r2Key, &contentType)
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
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
