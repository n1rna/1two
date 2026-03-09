package handler

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"math/big"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1two/api/internal/middleware"
)

const shortIDAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// generateShortID produces a URL-safe alphanumeric ID of length n.
func generateShortID(n int) string {
	alphabetLen := big.NewInt(int64(len(shortIDAlphabet)))
	result := make([]byte, n)
	for i := range result {
		idx, err := rand.Int(rand.Reader, alphabetLen)
		if err != nil {
			// fall back to a zero byte on failure — highly unlikely
			result[i] = shortIDAlphabet[0]
			continue
		}
		result[i] = shortIDAlphabet[idx.Int64()]
	}
	return string(result)
}

// PasteInfo is the metadata-only view of a paste (no content), used in list responses.
type PasteInfo struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Format     string `json:"format"`
	Visibility string `json:"visibility"`
	Size       int64  `json:"size"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
	URL        string `json:"url"`
}

// PasteDetail is the full paste including content and author, used in get responses.
type PasteDetail struct {
	ID         string      `json:"id"`
	Title      string      `json:"title"`
	Content    string      `json:"content"`
	Format     string      `json:"format"`
	Visibility string      `json:"visibility"`
	Size       int64       `json:"size"`
	CreatedAt  string      `json:"createdAt"`
	UpdatedAt  string      `json:"updatedAt"`
	UserID     string      `json:"userId"`
	Author     PasteAuthor `json:"author"`
}

// PasteAuthor holds the public author information joined from the user table.
type PasteAuthor struct {
	Name  string `json:"name"`
	Image string `json:"image"`
}

// createPasteRequest is the body accepted by CreatePaste.
type createPasteRequest struct {
	Title      string `json:"title"`
	Content    string `json:"content"`
	Format     string `json:"format"`
	Visibility string `json:"visibility"`
	ExpiresIn  int64  `json:"expiresIn"` // seconds; 0 = never
}

// createPasteResponse is the body returned by CreatePaste.
type createPasteResponse struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Format     string `json:"format"`
	Visibility string `json:"visibility"`
	Size       int64  `json:"size"`
	CreatedAt  string `json:"createdAt"`
	URL        string `json:"url"`
}

// updatePasteRequest is the body accepted by UpdatePaste.
type updatePasteRequest struct {
	Title      *string `json:"title"`
	Content    *string `json:"content"`
	Format     *string `json:"format"`
	Visibility *string `json:"visibility"`
}

// validFormats and validVisibilities are the allowed enum values.
var validFormats = map[string]bool{
	"text":     true,
	"markdown": true,
	"json":     true,
	"code":     true,
}

var validVisibilities = map[string]bool{
	"public":   true,
	"unlisted": true,
}

// CreatePaste handles POST /pastes.
// Auth required.
func CreatePaste(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req createPasteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		if req.Content == "" {
			http.Error(w, `{"error":"content is required"}`, http.StatusBadRequest)
			return
		}

		// Apply defaults and validate enum fields.
		if req.Format == "" {
			req.Format = "text"
		}
		if !validFormats[req.Format] {
			http.Error(w, `{"error":"invalid format; must be text, markdown, json, or code"}`, http.StatusBadRequest)
			return
		}

		if req.Visibility == "" {
			req.Visibility = "public"
		}
		if !validVisibilities[req.Visibility] {
			http.Error(w, `{"error":"invalid visibility; must be public or unlisted"}`, http.StatusBadRequest)
			return
		}

		pasteID := generateShortID(8)
		size := int64(len([]byte(req.Content)))

		var expiresAt *time.Time
		if req.ExpiresIn > 0 {
			t := time.Now().UTC().Add(time.Duration(req.ExpiresIn) * time.Second)
			expiresAt = &t
		}

		const q = `
			INSERT INTO pastes (id, user_id, title, content, format, visibility, size, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING created_at`

		var createdAt time.Time
		err := db.QueryRowContext(r.Context(), q,
			pasteID, userID, req.Title, req.Content, req.Format, req.Visibility, size, expiresAt,
		).Scan(&createdAt)
		if err != nil {
			http.Error(w, `{"error":"failed to create paste"}`, http.StatusInternalServerError)
			return
		}

		resp := createPasteResponse{
			ID:         pasteID,
			Title:      req.Title,
			Format:     req.Format,
			Visibility: req.Visibility,
			Size:       size,
			CreatedAt:  createdAt.UTC().Format(time.RFC3339),
			URL:        "/p/" + pasteID,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

// GetPaste handles GET /pastes/{id}.
// Public endpoint — no auth required.
func GetPaste(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pasteID := chi.URLParam(r, "id")

		const q = `
			SELECT p.id, p.title, p.content, p.format, p.visibility, p.size,
			       p.created_at, p.updated_at, p.expires_at,
			       p.user_id, u.name, COALESCE(u.image, '')
			FROM pastes p
			JOIN "user" u ON p.user_id = u.id
			WHERE p.id = $1`

		var (
			id, title, content, format, visibility string
			size                                   int64
			createdAt, updatedAt                   time.Time
			expiresAt                              sql.NullTime
			userID, authorName, authorImage        string
		)

		err := db.QueryRowContext(r.Context(), q, pasteID).Scan(
			&id, &title, &content, &format, &visibility, &size,
			&createdAt, &updatedAt, &expiresAt,
			&userID, &authorName, &authorImage,
		)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"paste not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to retrieve paste"}`, http.StatusInternalServerError)
			return
		}

		// Check expiry.
		if expiresAt.Valid && time.Now().After(expiresAt.Time) {
			http.Error(w, `{"error":"paste has expired"}`, http.StatusGone)
			return
		}

		detail := PasteDetail{
			ID:         id,
			Title:      title,
			Content:    content,
			Format:     format,
			Visibility: visibility,
			Size:       size,
			CreatedAt:  createdAt.UTC().Format(time.RFC3339),
			UpdatedAt:  updatedAt.UTC().Format(time.RFC3339),
			UserID:     userID,
			Author: PasteAuthor{
				Name:  authorName,
				Image: authorImage,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

// ListPastes handles GET /pastes.
// Auth required — returns the current user's pastes (metadata only).
func ListPastes(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, title, format, visibility, size, created_at, updated_at
			FROM pastes
			WHERE user_id = $1
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list pastes"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		pastes := make([]PasteInfo, 0)
		for rows.Next() {
			var p PasteInfo
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&p.ID, &p.Title, &p.Format, &p.Visibility, &p.Size, &createdAt, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read pastes"}`, http.StatusInternalServerError)
				return
			}
			p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			p.URL = "/p/" + p.ID
			pastes = append(pastes, p)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate pastes"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"pastes": pastes})
	}
}

// UpdatePaste handles PUT /pastes/{id}.
// Auth required — only the owner can update.
func UpdatePaste(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		pasteID := chi.URLParam(r, "id")

		var req updatePasteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Validate enum fields if provided.
		if req.Format != nil && !validFormats[*req.Format] {
			http.Error(w, `{"error":"invalid format; must be text, markdown, json, or code"}`, http.StatusBadRequest)
			return
		}
		if req.Visibility != nil && !validVisibilities[*req.Visibility] {
			http.Error(w, `{"error":"invalid visibility; must be public or unlisted"}`, http.StatusBadRequest)
			return
		}

		// Fetch the existing paste to verify ownership and apply partial updates.
		const fetchQ = `
			SELECT title, content, format, visibility
			FROM pastes
			WHERE id = $1 AND user_id = $2`

		var title, content, format, visibility string
		err := db.QueryRowContext(r.Context(), fetchQ, pasteID, userID).
			Scan(&title, &content, &format, &visibility)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"paste not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to retrieve paste"}`, http.StatusInternalServerError)
			return
		}

		// Merge provided fields.
		if req.Title != nil {
			title = *req.Title
		}
		if req.Content != nil {
			content = *req.Content
		}
		if req.Format != nil {
			format = *req.Format
		}
		if req.Visibility != nil {
			visibility = *req.Visibility
		}

		size := int64(len([]byte(content)))

		const updateQ = `
			UPDATE pastes
			SET title = $1, content = $2, format = $3, visibility = $4, size = $5, updated_at = NOW()
			WHERE id = $6 AND user_id = $7
			RETURNING updated_at`

		var updatedAt time.Time
		err = db.QueryRowContext(r.Context(), updateQ,
			title, content, format, visibility, size, pasteID, userID,
		).Scan(&updatedAt)
		if err != nil {
			http.Error(w, `{"error":"failed to update paste"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":         pasteID,
			"title":      title,
			"format":     format,
			"visibility": visibility,
			"size":       size,
			"updatedAt":  updatedAt.UTC().Format(time.RFC3339),
			"url":        "/p/" + pasteID,
		})
	}
}

// DeletePaste handles DELETE /pastes/{id}.
// Auth required — only the owner can delete.
func DeletePaste(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		pasteID := chi.URLParam(r, "id")

		const q = `
			DELETE FROM pastes
			WHERE id = $1 AND user_id = $2`

		result, err := db.ExecContext(r.Context(), q, pasteID, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to delete paste"}`, http.StatusInternalServerError)
			return
		}

		rows, err := result.RowsAffected()
		if err != nil || rows == 0 {
			http.Error(w, `{"error":"paste not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}
