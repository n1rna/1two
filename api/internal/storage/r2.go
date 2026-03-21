package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
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

// NewR2ClientForBucket creates an R2 client authenticated with per-bucket
// credentials. Used for managed storage buckets where each bucket has its own
// API token derived S3 credentials.
func NewR2ClientForBucket(accountID, accessKeyID, secretKey, bucketName string) *R2Client {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)

	client := s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: &endpoint,
		Credentials:  credentials.NewStaticCredentialsProvider(accessKeyID, secretKey, ""),
	})

	return &R2Client{
		client:    client,
		presigner: s3.NewPresignClient(client),
		bucket:    bucketName,
	}
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

// Download returns a streaming reader for the R2 object at key.
// The caller is responsible for closing the returned ReadCloser.
// Returns an error (wrapping types.NoSuchKey) if the key does not exist.
func (r *R2Client) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	resp, err := r.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &r.bucket,
		Key:    &key,
	})
	if err != nil {
		var nfe *types.NoSuchKey
		if errors.As(err, &nfe) {
			return nil, fmt.Errorf("storage: download %q: object not found", key)
		}
		return nil, fmt.Errorf("storage: download %q: %w", key, err)
	}
	return resp.Body, nil
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

// CreateBucket creates a new R2 bucket using the S3 CreateBucket API.
func (r *R2Client) CreateBucket(ctx context.Context, bucketName string) error {
	_, err := r.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(bucketName),
	})
	if err != nil {
		return fmt.Errorf("storage: create bucket %q: %w", bucketName, err)
	}
	return nil
}

// DeleteBucket deletes an R2 bucket using the S3 DeleteBucket API.
// The bucket must be empty before calling this method.
func (r *R2Client) DeleteBucket(ctx context.Context, bucketName string) error {
	_, err := r.client.DeleteBucket(ctx, &s3.DeleteBucketInput{
		Bucket: aws.String(bucketName),
	})
	if err != nil {
		return fmt.Errorf("storage: delete bucket %q: %w", bucketName, err)
	}
	return nil
}

// UploadToBucket uploads an object to a specific R2 bucket (not the default one).
func (r *R2Client) UploadToBucket(ctx context.Context, bucketName, key string, body io.Reader, contentType string, size int64) error {
	_, err := r.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(bucketName),
		Key:           aws.String(key),
		Body:          body,
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	})
	if err != nil {
		return fmt.Errorf("storage: upload %q to bucket %q: %w", key, bucketName, err)
	}
	return nil
}

// DeleteFromBucket deletes an object from a specific R2 bucket.
func (r *R2Client) DeleteFromBucket(ctx context.Context, bucketName, key string) error {
	_, err := r.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("storage: delete %q from bucket %q: %w", key, bucketName, err)
	}
	return nil
}

// PresignedURLForBucket generates a presigned GET URL for an object in a specific bucket.
// The URL is valid for the given TTL.
func (r *R2Client) PresignedURLForBucket(ctx context.Context, bucketName, key, originalName string, ttl time.Duration) (string, error) {
	disposition := fmt.Sprintf(`inline; filename="%s"`, url.PathEscape(originalName))

	req, err := r.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket:                     aws.String(bucketName),
		Key:                        aws.String(key),
		ResponseContentDisposition: aws.String(disposition),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage: presign %q in bucket %q: %w", key, bucketName, err)
	}
	return req.URL, nil
}
