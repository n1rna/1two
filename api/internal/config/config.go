package config

import (
	"os"
	"strings"
)

type Config struct {
	DatabaseURL        string
	AllowedOrigins     []string
	UploadDir          string
	TurnstileSecretKey string

	// R2 storage
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2BucketName      string

	// Internal auth for cron jobs
	InternalSecret string
}

func Load() *Config {
	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000"
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	return &Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		AllowedOrigins:     strings.Split(origins, ","),
		UploadDir:          uploadDir,
		TurnstileSecretKey: os.Getenv("TURNSTILE_SECRET_KEY"),

		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2BucketName:      os.Getenv("R2_BUCKET_NAME"),

		InternalSecret: os.Getenv("INTERNAL_SECRET"),
	}
}
