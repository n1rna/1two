-- +goose Up
ALTER TABLE files
    ADD COLUMN r2_key          TEXT,
    ADD COLUMN last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN permanent        BOOLEAN     NOT NULL DEFAULT FALSE;

-- Backfill r2_key from existing data
UPDATE files SET r2_key = user_id || '/' || filename WHERE r2_key IS NULL;

ALTER TABLE files ALTER COLUMN r2_key SET NOT NULL;

CREATE INDEX idx_files_last_accessed ON files (last_accessed_at) WHERE NOT permanent;

-- +goose Down
DROP INDEX IF EXISTS idx_files_last_accessed;
ALTER TABLE files
    DROP COLUMN IF EXISTS r2_key,
    DROP COLUMN IF EXISTS last_accessed_at,
    DROP COLUMN IF EXISTS permanent;
