package neon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/n1rna/1two/api/internal/config"
)

const baseURL = "https://console.neon.tech/api/v2"

// Client wraps the Neon Management API.
type Client struct {
	apiKey     string
	orgID      string
	httpClient *http.Client
}

// NewClient creates a new Neon API client.
func NewClient(cfg *config.Config) *Client {
	return &Client{
		apiKey:     cfg.NeonAPIKey,
		orgID:      cfg.NeonOrgID,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("neon: marshal: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	return c.httpClient.Do(req)
}

// Project represents a Neon project resource.
type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	RegionID  string `json:"region_id"`
	CreatedAt string `json:"created_at"`
	Status    string `json:"pg_version"` // reused field; see projectResponse for actual status
}

// projectResponse matches the Neon API envelope for project operations.
type projectResponse struct {
	Project struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		RegionID  string `json:"region_id"`
		CreatedAt string `json:"created_at"`
		Status    string `json:"status"`
	} `json:"project"`
}

// connectionURIResponse matches the Neon API response for connection URI.
type connectionURIResponse struct {
	URI string `json:"uri"`
}

// CreateProject provisions a new Neon project.
// POST /projects
func (c *Client) CreateProject(ctx context.Context, name, regionID, ownerID string) (*Project, error) {
	payload := map[string]any{
		"project": map[string]any{
			"name":       fmt.Sprintf("1two-%s-%s", ownerID, name),
			"region_id":  regionID,
			"pg_version": 17,
			"org_id":     c.orgID,
		},
	}
	resp, err := c.do(ctx, "POST", "/projects", payload)
	if err != nil {
		return nil, fmt.Errorf("neon: create project: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("neon: create project: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result projectResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("neon: create project: decode: %w", err)
	}
	return &Project{
		ID:        result.Project.ID,
		Name:      result.Project.Name,
		RegionID:  result.Project.RegionID,
		CreatedAt: result.Project.CreatedAt,
		Status:    result.Project.Status,
	}, nil
}

// GetProject retrieves a Neon project by ID.
// GET /projects/{projectID}
func (c *Client) GetProject(ctx context.Context, projectID string) (*Project, error) {
	resp, err := c.do(ctx, "GET", fmt.Sprintf("/projects/%s", projectID), nil)
	if err != nil {
		return nil, fmt.Errorf("neon: get project: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("neon: get project: not found")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("neon: get project: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result projectResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("neon: get project: decode: %w", err)
	}
	return &Project{
		ID:        result.Project.ID,
		Name:      result.Project.Name,
		RegionID:  result.Project.RegionID,
		CreatedAt: result.Project.CreatedAt,
		Status:    result.Project.Status,
	}, nil
}

// DeleteProject deletes a Neon project by ID.
// DELETE /projects/{projectID}
func (c *Client) DeleteProject(ctx context.Context, projectID string) error {
	resp, err := c.do(ctx, "DELETE", fmt.Sprintf("/projects/%s", projectID), nil)
	if err != nil {
		return fmt.Errorf("neon: delete project: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("neon: delete project: HTTP %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// GetConnectionURI returns the connection URI for a Neon project's role and database.
// GET /projects/{projectID}/connection_uri?role_name=X&database_name=X
func (c *Client) GetConnectionURI(ctx context.Context, projectID, roleName, dbName string) (string, error) {
	path := fmt.Sprintf("/projects/%s/connection_uri?role_name=%s&database_name=%s", projectID, roleName, dbName)
	resp, err := c.do(ctx, "GET", path, nil)
	if err != nil {
		return "", fmt.Errorf("neon: get connection uri: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("neon: get connection uri: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result connectionURIResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("neon: get connection uri: decode: %w", err)
	}
	return result.URI, nil
}
