package life

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

const gtasksBaseURL = "https://tasks.googleapis.com/tasks/v1"

// GTaskList represents a Google Tasks task list.
type GTaskList struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// GTask represents a single Google Tasks task.
type GTask struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Notes     string `json:"notes"`
	Status    string `json:"status"`    // "needsAction" or "completed"
	Due       string `json:"due"`       // RFC 3339 date (date only, no time component)
	Completed string `json:"completed"` // RFC 3339 timestamp when the task was completed
	Position  string `json:"position"`
	Parent    string `json:"parent"` // parent task ID for subtasks
	Links     []struct {
		Type string `json:"type"`
		Link string `json:"link"`
	} `json:"links"`
	Updated string `json:"updated"` // RFC 3339
}

// gtasksRequest performs an authenticated HTTP request against the Google Tasks
// API and decodes the JSON response into dest. A non-2xx status is treated as
// an error; dest may be nil for requests that return no body (e.g. DELETE).
func gtasksRequest(ctx context.Context, method, rawURL, accessToken string, body []byte, dest any) error {
	var reqBody io.Reader
	if len(body) > 0 {
		reqBody = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, rawURL, reqBody)
	if err != nil {
		return fmt.Errorf("gtasks: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("gtasks: %s %s: %w", method, rawURL, err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("gtasks: %s %s returned %d: %s", method, rawURL, resp.StatusCode, raw)
	}

	if dest != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, dest); err != nil {
			return fmt.Errorf("gtasks: parse response: %w", err)
		}
	}
	return nil
}

// ListTaskLists returns all task lists for the authenticated user.
func ListTaskLists(ctx context.Context, accessToken string) ([]GTaskList, error) {
	endpoint := gtasksBaseURL + "/users/@me/lists"

	var apiResp struct {
		Items []struct {
			ID    string `json:"id"`
			Title string `json:"title"`
		} `json:"items"`
	}
	if err := gtasksRequest(ctx, http.MethodGet, endpoint, accessToken, nil, &apiResp); err != nil {
		return nil, fmt.Errorf("gtasks: list task lists: %w", err)
	}

	lists := make([]GTaskList, 0, len(apiResp.Items))
	for _, item := range apiResp.Items {
		lists = append(lists, GTaskList{
			ID:    item.ID,
			Title: item.Title,
		})
	}
	return lists, nil
}

// ListTasks returns tasks from the specified task list. When showCompleted is
// true, completed and hidden tasks are included in the result.
func ListTasks(ctx context.Context, accessToken, listID string, showCompleted bool) ([]GTask, error) {
	params := url.Values{}
	if showCompleted {
		params.Set("showCompleted", "true")
		params.Set("showHidden", "true")
	}
	endpoint := fmt.Sprintf("%s/lists/%s/tasks?%s", gtasksBaseURL, url.PathEscape(listID), params.Encode())

	var apiResp struct {
		Items []GTask `json:"items"`
	}
	if err := gtasksRequest(ctx, http.MethodGet, endpoint, accessToken, nil, &apiResp); err != nil {
		return nil, fmt.Errorf("gtasks: list tasks: %w", err)
	}

	if apiResp.Items == nil {
		return []GTask{}, nil
	}
	return apiResp.Items, nil
}

// CreateTask creates a new task in the specified task list.
func CreateTask(ctx context.Context, accessToken, listID string, task GTask) (*GTask, error) {
	endpoint := fmt.Sprintf("%s/lists/%s/tasks", gtasksBaseURL, url.PathEscape(listID))

	payload := map[string]any{
		"title":  task.Title,
		"notes":  task.Notes,
		"status": task.Status,
	}
	if task.Due != "" {
		payload["due"] = task.Due
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gtasks: marshal create task: %w", err)
	}

	var created GTask
	if err := gtasksRequest(ctx, http.MethodPost, endpoint, accessToken, body, &created); err != nil {
		return nil, fmt.Errorf("gtasks: create task: %w", err)
	}
	return &created, nil
}

// UpdateTask updates an existing task using a PATCH request. Only non-zero
// fields in the provided GTask are sent.
func UpdateTask(ctx context.Context, accessToken, listID, taskID string, task GTask) (*GTask, error) {
	endpoint := fmt.Sprintf("%s/lists/%s/tasks/%s",
		gtasksBaseURL, url.PathEscape(listID), url.PathEscape(taskID))

	payload := map[string]any{
		"id":     taskID,
		"title":  task.Title,
		"notes":  task.Notes,
		"status": task.Status,
	}
	if task.Due != "" {
		payload["due"] = task.Due
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gtasks: marshal update task: %w", err)
	}

	var updated GTask
	if err := gtasksRequest(ctx, http.MethodPatch, endpoint, accessToken, body, &updated); err != nil {
		return nil, fmt.Errorf("gtasks: update task: %w", err)
	}
	return &updated, nil
}

// DeleteTask permanently deletes the specified task.
func DeleteTask(ctx context.Context, accessToken, listID, taskID string) error {
	endpoint := fmt.Sprintf("%s/lists/%s/tasks/%s",
		gtasksBaseURL, url.PathEscape(listID), url.PathEscape(taskID))

	if err := gtasksRequest(ctx, http.MethodDelete, endpoint, accessToken, nil, nil); err != nil {
		return fmt.Errorf("gtasks: delete task: %w", err)
	}
	return nil
}

// CompleteTask marks the specified task as completed.
func CompleteTask(ctx context.Context, accessToken, listID, taskID string) (*GTask, error) {
	endpoint := fmt.Sprintf("%s/lists/%s/tasks/%s",
		gtasksBaseURL, url.PathEscape(listID), url.PathEscape(taskID))

	body, err := json.Marshal(map[string]any{
		"id":     taskID,
		"status": "completed",
	})
	if err != nil {
		return nil, fmt.Errorf("gtasks: marshal complete task: %w", err)
	}

	var updated GTask
	if err := gtasksRequest(ctx, http.MethodPatch, endpoint, accessToken, body, &updated); err != nil {
		return nil, fmt.Errorf("gtasks: complete task: %w", err)
	}
	return &updated, nil
}

// MoveTask moves a task within a list to a new position. parentID is the ID of
// the new parent task (empty string for top-level); previousID is the ID of the
// sibling task to place this task after (empty string for first position).
func MoveTask(ctx context.Context, accessToken, listID, taskID, parentID, previousID string) (*GTask, error) {
	params := url.Values{}
	if parentID != "" {
		params.Set("parent", parentID)
	}
	if previousID != "" {
		params.Set("previous", previousID)
	}

	endpoint := fmt.Sprintf("%s/lists/%s/tasks/%s/move?%s",
		gtasksBaseURL, url.PathEscape(listID), url.PathEscape(taskID), params.Encode())

	var moved GTask
	if err := gtasksRequest(ctx, http.MethodPost, endpoint, accessToken, nil, &moved); err != nil {
		return nil, fmt.Errorf("gtasks: move task: %w", err)
	}
	return &moved, nil
}
