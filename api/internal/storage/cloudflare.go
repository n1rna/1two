package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// CloudflareClient wraps the Cloudflare API for managing R2 buckets and
// per-bucket API tokens with S3-compatible credentials.
type CloudflareClient struct {
	accountID  string
	apiToken   string
	httpClient *http.Client
}

// NewCloudflareClient creates a new Cloudflare API client.
func NewCloudflareClient(accountID, apiToken string) *CloudflareClient {
	return &CloudflareClient{
		accountID:  accountID,
		apiToken:   apiToken,
		httpClient: &http.Client{},
	}
}

// cfResponse is a generic Cloudflare API response envelope.
type cfResponse struct {
	Success bool              `json:"success"`
	Errors  []cfResponseError `json:"errors"`
}

type cfResponseError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (c *CloudflareClient) do(ctx context.Context, method, url string, body any) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("cloudflare: marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("cloudflare: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cloudflare: %s %s: %w", method, url, err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("cloudflare: read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var cfResp cfResponse
		if jsonErr := json.Unmarshal(data, &cfResp); jsonErr == nil && len(cfResp.Errors) > 0 {
			return nil, fmt.Errorf("cloudflare: %s %s: HTTP %d: %s", method, url, resp.StatusCode, cfResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("cloudflare: %s %s: HTTP %d: %s", method, url, resp.StatusCode, string(data))
	}

	return data, nil
}

// ── R2 Bucket Management ────────────────────────────────────────────────────

// CreateR2Bucket creates a real R2 bucket via the Cloudflare API.
func (c *CloudflareClient) CreateR2Bucket(ctx context.Context, bucketName string) error {
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets", c.accountID)
	payload := map[string]string{"name": bucketName}
	_, err := c.do(ctx, http.MethodPost, url, payload)
	if err != nil {
		return fmt.Errorf("create R2 bucket %q: %w", bucketName, err)
	}
	return nil
}

// DeleteR2Bucket deletes an R2 bucket via the Cloudflare API.
// The bucket must be empty first.
func (c *CloudflareClient) DeleteR2Bucket(ctx context.Context, bucketName string) error {
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s", c.accountID, bucketName)
	_, err := c.do(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("delete R2 bucket %q: %w", bucketName, err)
	}
	return nil
}

// ── Per-Bucket API Token (S3-compatible credentials) ────────────────────────

// Well-known Cloudflare permission group IDs for R2 storage.
const (
	permR2StorageRead  = "b4992e1108244f5d8bfbd5744320c2e1"
	permR2StorageWrite = "bf7481a1826f439697cb59a20b22293e"
)

// R2Credentials holds S3-compatible credentials derived from a Cloudflare API token.
type R2Credentials struct {
	CfTokenID      string // Cloudflare API token ID (used for deletion)
	S3AccessKeyID  string // = CF token ID
	S3SecretKey    string // = SHA-256(CF token value)
}

// CreateBucketToken creates a Cloudflare API token with R2 Storage Read+Write
// permissions and derives S3-compatible credentials from it.
//
// The S3 access key is the token ID, and the S3 secret key is SHA-256 of the
// token value — this is the documented approach for using Cloudflare API tokens
// as R2 S3-compatible credentials.
func (c *CloudflareClient) CreateBucketToken(ctx context.Context, tokenName string) (*R2Credentials, error) {
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/tokens", c.accountID)

	payload := map[string]any{
		"name": tokenName,
		"policies": []map[string]any{
			{
				"effect": "allow",
				"resources": map[string]string{
					fmt.Sprintf("com.cloudflare.api.account.%s", c.accountID): "*",
				},
				"permission_groups": []map[string]string{
					{"id": permR2StorageRead},
					{"id": permR2StorageWrite},
				},
			},
		},
	}

	data, err := c.do(ctx, http.MethodPost, url, payload)
	if err != nil {
		return nil, fmt.Errorf("create bucket token %q: %w", tokenName, err)
	}

	var resp struct {
		cfResponse
		Result struct {
			ID    string `json:"id"`
			Value string `json:"value"`
		} `json:"result"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	if !resp.Success {
		if len(resp.Errors) > 0 {
			return nil, fmt.Errorf("create bucket token: %s", resp.Errors[0].Message)
		}
		return nil, fmt.Errorf("create bucket token: unknown error")
	}
	if resp.Result.ID == "" || resp.Result.Value == "" {
		return nil, fmt.Errorf("create bucket token: incomplete response")
	}

	// Derive S3-compatible secret: SHA-256 of the token value.
	hash := sha256.Sum256([]byte(resp.Result.Value))

	return &R2Credentials{
		CfTokenID:     resp.Result.ID,
		S3AccessKeyID: resp.Result.ID,
		S3SecretKey:   hex.EncodeToString(hash[:]),
	}, nil
}

// DeleteBucketToken deletes a Cloudflare API token by its ID.
func (c *CloudflareClient) DeleteBucketToken(ctx context.Context, cfTokenID string) error {
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/tokens/%s", c.accountID, cfTokenID)
	_, err := c.do(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("delete bucket token %q: %w", cfTokenID, err)
	}
	return nil
}

// S3Endpoint returns the S3-compatible endpoint URL for R2.
func (c *CloudflareClient) S3Endpoint() string {
	return fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.accountID)
}
