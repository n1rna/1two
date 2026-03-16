package turso

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/n1rna/1tt/api/internal/config"
)

const platformBaseURL = "https://api.turso.tech"

// Client wraps the Turso Platform API and the libSQL HTTP query API.
type Client struct {
	apiToken   string
	orgSlug    string
	group      string
	httpClient *http.Client
}

// NewClient creates a new Turso client from config.
func NewClient(cfg *config.Config) *Client {
	return &Client{
		apiToken:   cfg.TursoAPIToken,
		orgSlug:    cfg.TursoOrgSlug,
		group:      cfg.TursoGroup,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Database represents a Turso database resource.
type Database struct {
	Name     string `json:"Name"`
	DbId     string `json:"DbId"`
	Hostname string `json:"Hostname"`
	Group    string `json:"group"`
	Region   string `json:"primaryRegion"`
}

// QueryResult is the JSON-serialisable result of a single SQL query execution.
type QueryResult struct {
	Columns      []string        `json:"columns,omitempty"`
	Rows         [][]interface{} `json:"rows,omitempty"`
	RowCount     int             `json:"rowCount,omitempty"`
	RowsAffected int64           `json:"rowsAffected,omitempty"`
	Error        string          `json:"error,omitempty"`
	TimeMs       int64           `json:"timeMs,omitempty"`
}

// ColumnInfo describes a single column within a table.
type ColumnInfo struct {
	CID          int     `json:"cid"`
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	NotNull      bool    `json:"notNull"`
	DefaultValue *string `json:"defaultValue"`
	PrimaryKey   int     `json:"primaryKey"`
}

// IndexInfo describes a single index.
type IndexInfo struct {
	Name   string `json:"name"`
	Unique bool   `json:"unique"`
	Origin string `json:"origin"`
}

// TableInfo aggregates column and index metadata for one table.
type TableInfo struct {
	Name    string       `json:"name"`
	Columns []ColumnInfo `json:"columns"`
	Indexes []IndexInfo  `json:"indexes"`
}

// do performs an authenticated request to the Turso Platform API.
func (c *Client) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("turso: marshal: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, platformBaseURL+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	return c.httpClient.Do(req)
}

// databaseResponse matches the Turso API envelope for database creation.
type databaseResponse struct {
	Database Database `json:"database"`
}

// tokenResponse matches the Turso API response for token creation.
type tokenResponse struct {
	JWT string `json:"jwt"`
}

// CreateDatabase provisions a new Turso database in the configured org and group.
// POST /v1/organizations/{org}/databases
func (c *Client) CreateDatabase(ctx context.Context, name string) (*Database, error) {
	path := fmt.Sprintf("/v1/organizations/%s/databases", c.orgSlug)
	payload := map[string]any{
		"name":  name,
		"group": c.group,
	}
	resp, err := c.do(ctx, "POST", path, payload)
	if err != nil {
		return nil, fmt.Errorf("turso: create database: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("turso: create database: HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result databaseResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("turso: create database: decode: %w", err)
	}
	return &result.Database, nil
}

// DeleteDatabase deletes a Turso database by name.
// DELETE /v1/organizations/{org}/databases/{name}
func (c *Client) DeleteDatabase(ctx context.Context, name string) error {
	path := fmt.Sprintf("/v1/organizations/%s/databases/%s", c.orgSlug, name)
	resp, err := c.do(ctx, "DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("turso: delete database: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("turso: delete database: HTTP %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

// CreateToken creates an auth token for a Turso database.
// POST /v1/organizations/{org}/databases/{dbName}/auth/tokens?authorization=full-access|read-only
func (c *Client) CreateToken(ctx context.Context, dbName string, readOnly bool) (string, error) {
	authz := "full-access"
	if readOnly {
		authz = "read-only"
	}
	path := fmt.Sprintf("/v1/organizations/%s/databases/%s/auth/tokens?authorization=%s", c.orgSlug, dbName, authz)
	resp, err := c.do(ctx, "POST", path, nil)
	if err != nil {
		return "", fmt.Errorf("turso: create token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("turso: create token: HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("turso: create token: decode: %w", err)
	}
	return result.JWT, nil
}

// GetDatabase retrieves a Turso database by name.
// GET /v1/organizations/{org}/databases/{name}
func (c *Client) GetDatabase(ctx context.Context, name string) (*Database, error) {
	path := fmt.Sprintf("/v1/organizations/%s/databases/%s", c.orgSlug, name)
	resp, err := c.do(ctx, "GET", path, nil)
	if err != nil {
		return nil, fmt.Errorf("turso: get database: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("turso: get database: not found")
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("turso: get database: HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result databaseResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("turso: get database: decode: %w", err)
	}
	return &result.Database, nil
}

// pipelineRequest is the body sent to the libSQL HTTP /v2/pipeline endpoint.
type pipelineRequest struct {
	Requests []pipelineStep `json:"requests"`
}

type pipelineStep struct {
	Type string    `json:"type"`
	Stmt *stmtBody `json:"stmt,omitempty"`
}

type stmtBody struct {
	SQL string `json:"sql"`
}

// pipelineResponse is the response from /v2/pipeline.
type pipelineResponse struct {
	Results []pipelineResult `json:"results"`
}

type pipelineResult struct {
	Type     string          `json:"type"`
	Response *resultResponse `json:"response,omitempty"`
	Error    *resultError    `json:"error,omitempty"`
}

type resultResponse struct {
	Type   string      `json:"type"`
	Result *resultBody `json:"result,omitempty"`
}

type resultError struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

type resultBody struct {
	Cols          []colDef          `json:"cols"`
	Rows          [][]rowValue      `json:"rows"`
	AffectedRowCount int64          `json:"affected_row_count"`
}

type colDef struct {
	Name string `json:"name"`
	Type string `json:"decltype"`
}

type rowValue struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

// execPipeline sends a pipeline request to the Turso HTTP query API.
func (c *Client) execPipeline(ctx context.Context, hostname, token string, steps []pipelineStep) (*pipelineResponse, error) {
	url := "https://" + hostname + "/v2/pipeline"

	payload := pipelineRequest{Requests: steps}
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("turso: pipeline marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("turso: pipeline request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("turso: pipeline execute: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("turso: pipeline: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result pipelineResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("turso: pipeline decode: %w", err)
	}
	return &result, nil
}

// ExecuteStatements seeds a Turso database by executing a batch of SQL statements
// via the libSQL HTTP API. Statements are sent in chunks of 50 to avoid size limits.
func (c *Client) ExecuteStatements(ctx context.Context, hostname, token string, statements []string) error {
	const chunkSize = 50

	for i := 0; i < len(statements); i += chunkSize {
		end := i + chunkSize
		if end > len(statements) {
			end = len(statements)
		}
		chunk := statements[i:end]

		steps := make([]pipelineStep, 0, len(chunk)+1)
		for _, sql := range chunk {
			steps = append(steps, pipelineStep{
				Type: "execute",
				Stmt: &stmtBody{SQL: sql},
			})
		}
		steps = append(steps, pipelineStep{Type: "close"})

		result, err := c.execPipeline(ctx, hostname, token, steps)
		if err != nil {
			return fmt.Errorf("turso: execute statements (chunk %d): %w", i/chunkSize, err)
		}

		// Check for errors in individual statement results (skip the close step).
		for j, r := range result.Results {
			if j >= len(chunk) {
				break
			}
			if r.Type == "error" && r.Error != nil {
				return fmt.Errorf("turso: statement %d error: %s", i+j, r.Error.Message)
			}
		}
	}
	return nil
}

// ExecuteQuery executes a single SQL statement and returns columns + rows.
func (c *Client) ExecuteQuery(ctx context.Context, hostname, token, sql string) (*QueryResult, error) {
	start := time.Now()

	steps := []pipelineStep{
		{Type: "execute", Stmt: &stmtBody{SQL: sql}},
		{Type: "close"},
	}

	pipeResp, err := c.execPipeline(ctx, hostname, token, steps)
	if err != nil {
		return nil, err
	}

	if len(pipeResp.Results) == 0 {
		return &QueryResult{TimeMs: msElapsed(start)}, nil
	}

	first := pipeResp.Results[0]
	if first.Type == "error" && first.Error != nil {
		return &QueryResult{
			Error:  first.Error.Message,
			TimeMs: msElapsed(start),
		}, nil
	}

	if first.Response == nil || first.Response.Result == nil {
		return &QueryResult{TimeMs: msElapsed(start)}, nil
	}

	rb := first.Response.Result

	columns := make([]string, len(rb.Cols))
	for i, col := range rb.Cols {
		columns[i] = col.Name
	}

	rows := make([][]interface{}, len(rb.Rows))
	for i, rawRow := range rb.Rows {
		row := make([]interface{}, len(rawRow))
		for j, v := range rawRow {
			if v.Type == "null" {
				row[j] = nil
			} else {
				row[j] = v.Value
			}
		}
		rows[i] = row
	}

	return &QueryResult{
		Columns:      columns,
		Rows:         rows,
		RowCount:     len(rows),
		RowsAffected: rb.AffectedRowCount,
		TimeMs:       msElapsed(start),
	}, nil
}

func msElapsed(start time.Time) int64 {
	return time.Since(start).Milliseconds()
}
