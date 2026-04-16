package handler

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/middleware"
)

// PublishMarketplaceItem handles POST /life/marketplace/publish.
func PublishMarketplaceItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Kind        string   `json:"kind"`
			SourceID    string   `json:"source_id"`
			Title       string   `json:"title"`
			Description string   `json:"description"`
			Tags        []string `json:"tags"`
			Changelog   string   `json:"changelog"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Title = strings.TrimSpace(req.Title)
		if req.Kind == "" || req.SourceID == "" || req.Title == "" {
			http.Error(w, `{"error":"kind, source_id, and title are required"}`, http.StatusBadRequest)
			return
		}
		if req.Tags == nil {
			req.Tags = []string{}
		}

		item, err := life.PublishItem(r.Context(), db, userID, req.Kind, req.SourceID, req.Title, req.Description, req.Tags, req.Changelog)
		if err != nil {
			log.Printf("marketplace: publish for %s: %v", userID, err)
			if err.Error() == "routine not found" || err.Error() == "gym session not found" || err.Error() == "meal plan not found" {
				http.Error(w, `{"error":"source item not found"}`, http.StatusNotFound)
				return
			}
			if err.Error() == "unknown kind: "+req.Kind {
				http.Error(w, `{"error":"invalid kind"}`, http.StatusBadRequest)
				return
			}
			http.Error(w, `{"error":"failed to publish item"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(item)
	}
}

// RepublishMarketplaceItem handles POST /life/marketplace/items/{id}/versions.
func RepublishMarketplaceItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		itemID := chi.URLParam(r, "id")
		var req struct {
			Changelog string `json:"changelog"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		version, err := life.RepublishItem(r.Context(), db, userID, itemID, req.Changelog)
		if err != nil {
			log.Printf("marketplace: republish %s for %s: %v", itemID, userID, err)
			if err.Error() == "item not found" {
				http.Error(w, `{"error":"item not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to republish item"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(version)
	}
}

// UnpublishMarketplaceItem handles DELETE /life/marketplace/items/{id}.
func UnpublishMarketplaceItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		itemID := chi.URLParam(r, "id")
		if err := life.UnpublishItem(r.Context(), db, userID, itemID); err != nil {
			log.Printf("marketplace: unpublish %s for %s: %v", itemID, userID, err)
			if err.Error() == "item not found" {
				http.Error(w, `{"error":"item not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to unpublish item"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ListMarketplace handles GET /life/marketplace.
func ListMarketplace(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

		filter := life.MarketplaceFilter{
			Kind:   r.URL.Query().Get("kind"),
			Query:  r.URL.Query().Get("q"),
			Limit:  limit,
			Offset: offset,
		}

		items, err := life.ListMarketplace(r.Context(), db, filter)
		if err != nil {
			log.Printf("marketplace: list for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to list marketplace"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"items": items})
	}
}

// ListMyMarketplace handles GET /life/marketplace/mine.
func ListMyMarketplace(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		items, err := life.ListMine(r.Context(), db, userID)
		if err != nil {
			log.Printf("marketplace: list mine for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to list your items"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"items": items})
	}
}

// GetMarketplaceItemBySource handles GET /life/marketplace/by-source?kind=X&source_id=Y.
// Returns the current user's published item (with its version list) if one exists
// for that source, or `{"item":null}` when nothing is published.
func GetMarketplaceItemBySource(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		kind := r.URL.Query().Get("kind")
		sourceID := r.URL.Query().Get("source_id")
		if kind == "" || sourceID == "" {
			http.Error(w, `{"error":"kind and source_id are required"}`, http.StatusBadRequest)
			return
		}

		item, err := life.GetItemBySource(r.Context(), db, userID, kind, sourceID)
		if err != nil {
			log.Printf("marketplace: by-source %s/%s for %s: %v", kind, sourceID, userID, err)
			http.Error(w, `{"error":"failed to look up item"}`, http.StatusInternalServerError)
			return
		}
		if item == nil {
			json.NewEncoder(w).Encode(map[string]any{"item": nil})
			return
		}

		versions, err := life.ListVersions(r.Context(), db, item.ID)
		if err != nil {
			log.Printf("marketplace: list versions %s: %v", item.ID, err)
		} else {
			item.Versions = versions
		}

		json.NewEncoder(w).Encode(map[string]any{"item": item})
	}
}

// GetMarketplaceItem handles GET /life/marketplace/items/{id}.
func GetMarketplaceItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		itemID := chi.URLParam(r, "id")
		item, err := life.GetItemByID(r.Context(), db, itemID)
		if err != nil {
			if err.Error() == "item not found" {
				http.Error(w, `{"error":"item not found"}`, http.StatusNotFound)
				return
			}
			log.Printf("marketplace: get item %s for %s: %v", itemID, userID, err)
			http.Error(w, `{"error":"failed to get item"}`, http.StatusInternalServerError)
			return
		}

		versions, err := life.ListVersions(r.Context(), db, itemID)
		if err != nil {
			log.Printf("marketplace: list versions %s: %v", itemID, err)
		} else {
			item.Versions = versions
		}

		json.NewEncoder(w).Encode(item)
	}
}

// ForkMarketplaceItem handles POST /life/marketplace/items/{id}/fork.
func ForkMarketplaceItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		itemID := chi.URLParam(r, "id")

		var req struct {
			Version *int `json:"version"`
		}
		// body is optional
		json.NewDecoder(r.Body).Decode(&req) //nolint:errcheck

		newSourceID, kind, err := life.ForkItem(r.Context(), db, userID, itemID, req.Version)
		if err != nil {
			log.Printf("marketplace: fork %s for %s: %v", itemID, userID, err)
			if err.Error() == "item not found" || err.Error() == "version not found" {
				http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to fork item"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"source_id": newSourceID,
			"kind":      kind,
		})
	}
}

// ListPublicMarketplace handles GET /public/marketplace (no auth).
// Returns the same list ListMarketplace returns — published items are public
// by definition, so there's no user-specific filtering.
func ListPublicMarketplace(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

		filter := life.MarketplaceFilter{
			Kind:   r.URL.Query().Get("kind"),
			Query:  r.URL.Query().Get("q"),
			Limit:  limit,
			Offset: offset,
		}

		items, err := life.ListMarketplace(r.Context(), db, filter)
		if err != nil {
			log.Printf("marketplace: public list: %v", err)
			http.Error(w, `{"error":"failed to list marketplace"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"items": items})
	}
}

// GetPublicMarketplaceItem handles GET /public/marketplace/{slug} (no auth).
func GetPublicMarketplaceItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		slug := chi.URLParam(r, "slug")
		item, err := life.GetItemBySlug(r.Context(), db, slug)
		if err != nil {
			if err.Error() == "item not found" {
				http.Error(w, `{"error":"item not found"}`, http.StatusNotFound)
				return
			}
			log.Printf("marketplace: get by slug %s: %v", slug, err)
			http.Error(w, `{"error":"failed to get item"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(item)
	}
}
