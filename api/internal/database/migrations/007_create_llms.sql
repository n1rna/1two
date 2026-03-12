-- +goose Up

CREATE TABLE llms_jobs (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    url              TEXT NOT NULL,
    normalized_url   TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending',
    error_message    TEXT,
    scan_depth       INT  NOT NULL DEFAULT 3,
    detail_level     TEXT NOT NULL DEFAULT 'standard',
    file_name        TEXT NOT NULL DEFAULT 'llms.txt',
    cf_job_id        TEXT,
    cf_status        TEXT,
    pages_crawled    INT  DEFAULT 0,
    tokens_used      INT  DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX llms_jobs_user_id_idx        ON llms_jobs (user_id);
CREATE INDEX llms_jobs_status_idx         ON llms_jobs (status);
CREATE INDEX llms_jobs_normalized_url_idx ON llms_jobs (normalized_url);

CREATE TABLE llms_cache (
    id             TEXT PRIMARY KEY,
    normalized_url TEXT NOT NULL,
    scan_depth     INT  NOT NULL,
    crawl_data     JSONB NOT NULL,
    pages_count    INT  DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL,
    UNIQUE (normalized_url, scan_depth)
);

CREATE INDEX llms_cache_lookup_idx ON llms_cache (normalized_url, scan_depth);

CREATE TABLE llms_files (
    id           TEXT PRIMARY KEY,
    job_id       TEXT NOT NULL REFERENCES llms_jobs (id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL,
    r2_key       TEXT NOT NULL,
    file_name    TEXT NOT NULL,
    version      TEXT NOT NULL DEFAULT 'standard',
    size         BIGINT DEFAULT 0,
    content      TEXT,
    content_hash TEXT,
    cdn_url      TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX llms_files_job_id_idx  ON llms_files (job_id);
CREATE INDEX llms_files_user_id_idx ON llms_files (user_id);

CREATE TABLE ai_usage (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    feature       TEXT NOT NULL,
    tokens_input  INT  DEFAULT 0,
    tokens_output INT  DEFAULT 0,
    cost_cents    INT  DEFAULT 0,
    job_id        TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ai_usage_user_id_idx ON ai_usage (user_id);
CREATE INDEX ai_usage_feature_idx ON ai_usage (feature);

-- +goose Down

DROP TABLE IF EXISTS ai_usage;
DROP TABLE IF EXISTS llms_files;
DROP TABLE IF EXISTS llms_cache;
DROP TABLE IF EXISTS llms_jobs;
