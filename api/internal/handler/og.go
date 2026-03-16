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
	"github.com/n1rna/1tt/api/internal/billing"
	"github.com/n1rna/1tt/api/internal/middleware"
)

const maxOgCollections = 20

func ogSlug() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func ogID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ── Request / response types ───────────────────────────

type createOgReq struct {
	Name   string          `json:"name"`
	Config json.RawMessage `json:"config"`
}

type updateOgReq struct {
	Name      *string          `json:"name,omitempty"`
	Config    *json.RawMessage `json:"config,omitempty"`
	Published *bool            `json:"published,omitempty"`
}

type ogCollectionRow struct {
	ID        string          `json:"id"`
	Slug      string          `json:"slug"`
	Name      string          `json:"name"`
	Config    json.RawMessage `json:"config"`
	Published bool            `json:"published"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

type ogCollectionSummary struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	Published bool   `json:"published"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// ── Handlers ───────────────────────────────────────────

// ListOgCollections returns all collections for the authenticated user (without config).
func ListOgCollections(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			`SELECT id, slug, name, published, created_at, updated_at
			 FROM og_collections WHERE user_id = $1
			 ORDER BY updated_at DESC`, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list collections"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := make([]ogCollectionSummary, 0)
		for rows.Next() {
			var item ogCollectionSummary
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&item.ID, &item.Slug, &item.Name, &item.Published, &createdAt, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read collections"}`, http.StatusInternalServerError)
				return
			}
			item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, item)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"collections": items})
	}
}

// CreateOgCollection creates a new OG image collection.
func CreateOgCollection(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Check collection count limit
		var count int
		if err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM og_collections WHERE user_id = $1`, userID).Scan(&count); err != nil {
			http.Error(w, `{"error":"failed to check collection count"}`, http.StatusInternalServerError)
			return
		}
		if count >= maxOgCollections {
			http.Error(w, fmt.Sprintf(`{"error":"maximum %d collections reached"}`, maxOgCollections), http.StatusForbidden)
			return
		}

		var req createOgReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if len(req.Config) == 0 {
			http.Error(w, `{"error":"config is required"}`, http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			req.Name = "Untitled"
		}

		id := ogID()
		slug := ogSlug()

		var createdAt time.Time
		err := db.QueryRowContext(r.Context(),
			`INSERT INTO og_collections (id, user_id, slug, name, config)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING created_at`,
			id, userID, slug, req.Name, req.Config).Scan(&createdAt)
		if err != nil {
			http.Error(w, `{"error":"failed to create collection"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"id":        id,
			"slug":      slug,
			"createdAt": createdAt.UTC().Format(time.RFC3339),
		})
	}
}

// GetOgCollection returns a single collection by ID.
func GetOgCollection(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var item ogCollectionRow
		var createdAt, updatedAt time.Time
		err := db.QueryRowContext(r.Context(),
			`SELECT id, slug, name, config, published, created_at, updated_at
			 FROM og_collections WHERE id = $1 AND user_id = $2`,
			id, userID).Scan(&item.ID, &item.Slug, &item.Name, &item.Config, &item.Published, &createdAt, &updatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"collection not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to get collection"}`, http.StatusInternalServerError)
			return
		}
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(item)
	}
}

// GetOgCollectionBySlug returns a collection config by slug (public, no auth required for serving).
func GetOgCollectionBySlug(db *sql.DB, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")

		var item ogCollectionRow
		var ownerUserID string
		var createdAt, updatedAt time.Time
		err := db.QueryRowContext(r.Context(),
			`SELECT id, user_id, slug, name, config, published, created_at, updated_at
			 FROM og_collections WHERE slug = $1 AND published = TRUE`,
			slug).Scan(&item.ID, &ownerUserID, &item.Slug, &item.Name, &item.Config, &item.Published, &createdAt, &updatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"collection not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to get collection"}`, http.StatusInternalServerError)
			return
		}
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Track OG image view for the collection owner (best-effort)
		go func() {
			if _, err := billing.IncrementUsage(context.Background(), db, ownerUserID, "og-image-view"); err != nil {
				log.Printf("billing: og view increment error: %v", err)
			}
			if billingClient != nil {
				if err := billingClient.IngestEvent(context.Background(), ownerUserID, "og-image-view", map[string]string{
					"collection_id": item.ID,
					"slug":          slug,
				}); err != nil {
					log.Printf("billing: og view ingest error: %v", err)
				}
			}
		}()

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=60")
		json.NewEncoder(w).Encode(item)
	}
}

// UpdateOgCollection updates an existing collection.
func UpdateOgCollection(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var req updateOgReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Build dynamic update
		setClauses := []string{"updated_at = NOW()"}
		args := []any{id, userID}
		idx := 3

		if req.Name != nil {
			setClauses = append(setClauses, fmt.Sprintf("name = $%d", idx))
			args = append(args, *req.Name)
			idx++
		}
		if req.Config != nil {
			setClauses = append(setClauses, fmt.Sprintf("config = $%d", idx))
			args = append(args, *req.Config)
			idx++
		}
		if req.Published != nil {
			setClauses = append(setClauses, fmt.Sprintf("published = $%d", idx))
			args = append(args, *req.Published)
			idx++
		}

		query := fmt.Sprintf(
			`UPDATE og_collections SET %s WHERE id = $1 AND user_id = $2 RETURNING updated_at`,
			joinStrings(setClauses, ", "),
		)

		var updatedAt time.Time
		err := db.QueryRowContext(r.Context(), query, args...).Scan(&updatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"collection not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to update collection"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"updatedAt": updatedAt.UTC().Format(time.RFC3339),
		})
	}
}

// DeleteOgCollection deletes a collection.
func DeleteOgCollection(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		result, err := db.ExecContext(r.Context(),
			`DELETE FROM og_collections WHERE id = $1 AND user_id = $2`, id, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to delete collection"}`, http.StatusInternalServerError)
			return
		}
		rows, err := result.RowsAffected()
		if err != nil || rows == 0 {
			http.Error(w, `{"error":"collection not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
