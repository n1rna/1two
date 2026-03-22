package handler

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/middleware"
)

// requireGTasksToken is a small helper that validates the session, checks that
// gcalClient is configured, and returns a valid access token using the shared
// Google OAuth connection. On any error it writes an appropriate HTTP error
// response and returns ("", false) so the caller can return early.
func requireGTasksToken(w http.ResponseWriter, r *http.Request, db *sql.DB, gcalClient *life.GCalClient) (userID, accessToken string, ok bool) {
	w.Header().Set("Content-Type", "application/json")

	if gcalClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error": "Google Tasks is not configured on this server",
		})
		return "", "", false
	}

	userID = middleware.GetUserID(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
		return "", "", false
	}

	accessToken, err := life.EnsureValidToken(r.Context(), db, gcalClient, userID)
	if err != nil {
		log.Printf("gtasks: ensure token for user %s: %v", userID, err)
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error": "Google account not connected — please connect Google Calendar first",
		})
		return "", "", false
	}

	return userID, accessToken, true
}

// ListGTaskLists handles GET /life/gtasks/lists.
// Returns all task lists for the authenticated user.
func ListGTaskLists(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := requireGTasksToken(w, r, db, gcalClient)
		if !ok {
			return
		}

		lists, err := life.ListTaskLists(r.Context(), accessToken)
		if err != nil {
			log.Printf("gtasks: list task lists: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error": "failed to fetch task lists",
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"lists": lists})
	}
}

// ListGTasks handles GET /life/gtasks/tasks?listId=xxx&showCompleted=true.
// Returns tasks from the specified task list.
func ListGTasks(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := requireGTasksToken(w, r, db, gcalClient)
		if !ok {
			return
		}

		listID := r.URL.Query().Get("listId")
		if listID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "listId query parameter is required"})
			return
		}

		showCompleted := r.URL.Query().Get("showCompleted") == "true"

		tasks, err := life.ListTasks(r.Context(), accessToken, listID, showCompleted)
		if err != nil {
			log.Printf("gtasks: list tasks for list %s: %v", listID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error": "failed to fetch tasks",
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
	}
}

// CreateGTask handles POST /life/gtasks/tasks.
// Body: {"listId", "title", "notes", "due"}
func CreateGTask(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := requireGTasksToken(w, r, db, gcalClient)
		if !ok {
			return
		}

		var req struct {
			ListID string `json:"listId"`
			Title  string `json:"title"`
			Notes  string `json:"notes"`
			Due    string `json:"due"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
			return
		}
		if req.ListID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "listId is required"})
			return
		}
		if req.Title == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "title is required"})
			return
		}

		task := life.GTask{
			Title:  req.Title,
			Notes:  req.Notes,
			Due:    req.Due,
			Status: "needsAction",
		}

		created, err := life.CreateTask(r.Context(), accessToken, req.ListID, task)
		if err != nil {
			log.Printf("gtasks: create task in list %s: %v", req.ListID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error": "failed to create task",
			})
			return
		}

		writeJSON(w, http.StatusCreated, created)
	}
}

// UpdateGTask handles PUT /life/gtasks/tasks.
// Body: {"listId", "taskId", "title", "notes", "due", "status"}
func UpdateGTask(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := requireGTasksToken(w, r, db, gcalClient)
		if !ok {
			return
		}

		var req struct {
			ListID string `json:"listId"`
			TaskID string `json:"taskId"`
			Title  string `json:"title"`
			Notes  string `json:"notes"`
			Due    string `json:"due"`
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
			return
		}
		if req.ListID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "listId is required"})
			return
		}
		if req.TaskID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "taskId is required"})
			return
		}

		task := life.GTask{
			Title:  req.Title,
			Notes:  req.Notes,
			Due:    req.Due,
			Status: req.Status,
		}

		updated, err := life.UpdateTask(r.Context(), accessToken, req.ListID, req.TaskID, task)
		if err != nil {
			log.Printf("gtasks: update task %s in list %s: %v", req.TaskID, req.ListID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error": "failed to update task",
			})
			return
		}

		writeJSON(w, http.StatusOK, updated)
	}
}

// DeleteGTask handles DELETE /life/gtasks/tasks?listId=xxx&taskId=xxx.
func DeleteGTask(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := requireGTasksToken(w, r, db, gcalClient)
		if !ok {
			return
		}

		listID := r.URL.Query().Get("listId")
		taskID := r.URL.Query().Get("taskId")
		if listID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "listId query parameter is required"})
			return
		}
		if taskID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "taskId query parameter is required"})
			return
		}

		if err := life.DeleteTask(r.Context(), accessToken, listID, taskID); err != nil {
			log.Printf("gtasks: delete task %s in list %s: %v", taskID, listID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error": "failed to delete task",
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// CompleteGTask handles POST /life/gtasks/complete.
// Body: {"listId", "taskId"}
func CompleteGTask(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := requireGTasksToken(w, r, db, gcalClient)
		if !ok {
			return
		}

		var req struct {
			ListID string `json:"listId"`
			TaskID string `json:"taskId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
			return
		}
		if req.ListID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "listId is required"})
			return
		}
		if req.TaskID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "taskId is required"})
			return
		}

		completed, err := life.CompleteTask(r.Context(), accessToken, req.ListID, req.TaskID)
		if err != nil {
			log.Printf("gtasks: complete task %s in list %s: %v", req.TaskID, req.ListID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error": "failed to complete task",
			})
			return
		}

		writeJSON(w, http.StatusOK, completed)
	}
}
