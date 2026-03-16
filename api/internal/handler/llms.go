package handler

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1tt/api/internal/llms"
	"github.com/n1rna/1tt/api/internal/middleware"
	"github.com/n1rna/1tt/api/internal/storage"
)

// GenerateLlms handles POST /llms/generate.
// Auth required. Starts a new llms.txt generation job and returns 202.
func GenerateLlms(svc *llms.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req llms.GenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		if req.URL == "" {
			http.Error(w, `{"error":"url is required"}`, http.StatusBadRequest)
			return
		}

		job, err := svc.StartJob(r.Context(), userID, req)
		if err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(job)
	}
}

// GetLlmsJob handles GET /llms/jobs/{id}.
// Auth required. Returns the job status and any associated files.
func GetLlmsJob(svc *llms.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		jobID := chi.URLParam(r, "id")

		job, err := svc.GetJob(r.Context(), userID, jobID)
		if err != nil {
			http.Error(w, `{"error":"failed to retrieve job"}`, http.StatusInternalServerError)
			return
		}
		if job == nil {
			http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(job)
	}
}

// GetLlmsCache handles GET /llms/cache?url=...&depth=...
// Auth required. Checks whether a cached crawl result exists.
func GetLlmsCache(svc *llms.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		rawURL := r.URL.Query().Get("url")
		if rawURL == "" {
			http.Error(w, `{"error":"url query parameter is required"}`, http.StatusBadRequest)
			return
		}

		depth := 3
		if d := r.URL.Query().Get("depth"); d != "" {
			if v, err := strconv.Atoi(d); err == nil && v > 0 {
				depth = v
			}
		}

		info, err := svc.CheckCache(r.Context(), rawURL, depth)
		if err != nil {
			http.Error(w, `{"error":"failed to check cache"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	}
}

// GetLlmsFile handles GET /llms/files/{id}.
// Auth required. Returns JSON with presigned download URL and file metadata.
func GetLlmsFile(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		fileID := chi.URLParam(r, "id")

		const q = `
			SELECT r2_key, file_name, size
			FROM llms_files
			WHERE id = $1 AND user_id = $2`

		var r2Key, fileName string
		var size int64
		err := db.QueryRowContext(r.Context(), q, fileID, userID).Scan(&r2Key, &fileName, &size)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up file"}`, http.StatusInternalServerError)
			return
		}

		signedURL, err := r2.PresignedURL(r.Context(), r2Key, fileName, 15*time.Minute)
		if err != nil {
			log.Printf("llms: presign error for file %s: %v", fileID, err)
			http.Error(w, `{"error":"failed to generate download URL"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"downloadUrl": signedURL,
			"fileName":    fileName,
			"size":        size,
		})
	}
}

// ListLlmsJobs handles GET /llms/jobs?limit=20&offset=0.
// Auth required. Returns a paginated list of jobs with associated files.
func ListLlmsJobs(svc *llms.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		limit := 20
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n >= 0 {
				offset = n
			}
		}

		jobs, total, err := svc.ListJobs(r.Context(), userID, limit, offset)
		if err != nil {
			http.Error(w, `{"error":"failed to retrieve jobs"}`, http.StatusInternalServerError)
			return
		}

		// Ensure we never serialise null for the jobs array
		if jobs == nil {
			jobs = []llms.Job{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"jobs":  jobs,
			"total": total,
		})
	}
}

// PatchLlmsFile handles PATCH /llms/files/{id}.
// Auth required. Toggles the published flag on a file and returns the updated file.
func PatchLlmsFile(svc *llms.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		fileID := chi.URLParam(r, "id")

		var body struct {
			Published bool `json:"published"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		file, err := svc.PublishFile(r.Context(), userID, fileID, body.Published)
		if err != nil {
			if err.Error() == "file not found" {
				http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to update file"}`, http.StatusInternalServerError)
			return
		}

		type response struct {
			ID        string `json:"id"`
			FileName  string `json:"fileName"`
			Size      int64  `json:"size"`
			Version   string `json:"version"`
			Slug      string `json:"slug,omitempty"`
			Published bool   `json:"published"`
			PublicURL string `json:"publicUrl,omitempty"`
		}
		resp := response{
			ID:        file.ID,
			FileName:  file.FileName,
			Size:      file.Size,
			Version:   file.Version,
			Slug:      file.Slug,
			Published: file.Published,
		}
		if file.Published && file.Slug != "" {
			resp.PublicURL = "/s/" + file.Slug
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

// GetLlmsPublicFile handles GET /llms/s/{slug}.
// Unauthenticated. Returns the raw text/plain content of a published file.
func GetLlmsPublicFile(svc *llms.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")

		content, err := svc.GetPublicFile(r.Context(), slug)
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
		w.Write([]byte(content))
	}
}

// CancelLlmsJob handles DELETE /llms/jobs/{id}.
// Auth required. Cancels a pending or in-progress job.
func CancelLlmsJob(svc *llms.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		jobID := chi.URLParam(r, "id")

		if err := svc.CancelJob(r.Context(), userID, jobID); err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "cancelled"})
	}
}
