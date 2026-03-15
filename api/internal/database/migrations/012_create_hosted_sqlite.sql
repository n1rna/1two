-- +goose Up
CREATE TABLE IF NOT EXISTS hosted_sqlite (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    api_key         TEXT        NOT NULL UNIQUE,
    file_key        TEXT        NOT NULL,  -- R2 object key
    file_size       BIGINT      NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL DEFAULT 'active',  -- active, deleted
    read_only       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hosted_sqlite_user_id ON hosted_sqlite (user_id);
CREATE INDEX IF NOT EXISTS idx_hosted_sqlite_api_key ON hosted_sqlite (api_key);

-- +goose Down
DROP TABLE IF EXISTS hosted_sqlite;
