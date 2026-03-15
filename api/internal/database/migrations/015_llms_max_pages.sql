-- +goose Up
ALTER TABLE llms_jobs ADD COLUMN max_pages INTEGER NOT NULL DEFAULT 50;

-- +goose Down
ALTER TABLE llms_jobs DROP COLUMN max_pages;
