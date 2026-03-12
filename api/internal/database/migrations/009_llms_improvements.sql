-- +goose Up

-- Add slug and published flag to llms_files for public sharing
ALTER TABLE llms_files ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE llms_files ADD COLUMN published BOOLEAN DEFAULT FALSE;
CREATE INDEX llms_files_slug_idx ON llms_files (slug) WHERE slug IS NOT NULL;

-- Add email notification fields to llms_jobs
ALTER TABLE llms_jobs ADD COLUMN notify_email TEXT;
ALTER TABLE llms_jobs ADD COLUMN notify_sent BOOLEAN DEFAULT FALSE;

-- Result cache: caches the final generated llms.txt output
-- (separate from llms_cache which only caches crawled pages)
CREATE TABLE llms_result_cache (
    id              TEXT PRIMARY KEY,
    normalized_url  TEXT NOT NULL,
    scan_depth      INT  NOT NULL,
    detail_level    TEXT NOT NULL,
    content         TEXT NOT NULL,
    tokens_used     INT  DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    UNIQUE (normalized_url, scan_depth, detail_level)
);

CREATE INDEX llms_result_cache_lookup_idx ON llms_result_cache (normalized_url, scan_depth, detail_level);

-- +goose Down

DROP TABLE IF EXISTS llms_result_cache;
ALTER TABLE llms_jobs DROP COLUMN IF EXISTS notify_email;
ALTER TABLE llms_jobs DROP COLUMN IF EXISTS notify_sent;
ALTER TABLE llms_files DROP COLUMN IF EXISTS published;
ALTER TABLE llms_files DROP COLUMN IF EXISTS slug;
