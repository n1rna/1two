package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// R2Client wraps the S3-compatible Cloudflare R2 API.
type R2Client struct {
	client    *s3.Client
	presigner *s3.PresignClient
	bucket    string
}

// NewR2Client creates a new R2 storage client using S3-compatible credentials.
func NewR2Client(accountID, accessKeyID, secretKey, bucket string) (*R2Client, error) {
	if accountID == "" || accessKeyID == "" || secretKey == "" || bucket == "" {
		return nil, fmt.Errorf("storage: all R2 credentials and bucket name are required")
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)

	client := s3.New(s3.Options{
		Region:      "auto",
		BaseEndpoint: &endpoint,
		Credentials: credentials.NewStaticCredentialsProvider(accessKeyID, secretKey, ""),
	})

	return &R2Client{
		client:    client,
		presigner: s3.NewPresignClient(client),
		bucket:    bucket,
	}, nil
}

// Upload stores a file in R2.
func (r *R2Client) Upload(ctx context.Context, key string, body io.Reader, contentType string, size int64) error {
	_, err := r.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        &r.bucket,
		Key:           &key,
		Body:          body,
		ContentType:   &contentType,
		ContentLength: &size,
	})
	if err != nil {
		return fmt.Errorf("storage: upload %q: %w", key, err)
	}
	return nil
}

// Delete removes a file from R2.
func (r *R2Client) Delete(ctx context.Context, key string) error {
	_, err := r.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: &r.bucket,
		Key:    &key,
	})
	if err != nil {
		return fmt.Errorf("storage: delete %q: %w", key, err)
	}
	return nil
}

// Get retrieves a file from R2. Returns nil, nil if the key doesn't exist.
func (r *R2Client) Get(ctx context.Context, key string) ([]byte, error) {
	resp, err := r.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &r.bucket,
		Key:    &key,
	})
	if err != nil {
		var nfe *types.NoSuchKey
		if errors.As(err, &nfe) {
			return nil, nil
		}
		return nil, fmt.Errorf("storage: get %q: %w", key, err)
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// PresignedURL generates a pre-signed GET URL for downloading a file.
// The URL is valid for the given TTL. The Content-Disposition header is set
// so the browser uses the original filename.
func (r *R2Client) PresignedURL(ctx context.Context, key, originalName string, ttl time.Duration) (string, error) {
	disposition := fmt.Sprintf(`inline; filename="%s"`, url.PathEscape(originalName))

	req, err := r.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket:                     &r.bucket,
		Key:                        &key,
		ResponseContentDisposition: &disposition,
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage: presign %q: %w", key, err)
	}
	return req.URL, nil
}
