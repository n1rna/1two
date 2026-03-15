-- +goose Up
CREATE TABLE IF NOT EXISTS user_databases (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    neon_project_id TEXT        NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    region          TEXT        NOT NULL DEFAULT 'aws-us-east-1',
    status          TEXT        NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_databases_user_id ON user_databases (user_id);

-- +goose Down
DROP TABLE IF EXISTS user_databases;
