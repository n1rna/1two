-- +goose Up
CREATE TABLE IF NOT EXISTS pastes (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    title       TEXT        NOT NULL DEFAULT '',
    content     TEXT        NOT NULL,
    format      TEXT        NOT NULL DEFAULT 'text',  -- 'text', 'markdown', 'json', 'code'
    visibility  TEXT        NOT NULL DEFAULT 'public', -- 'public', 'unlisted'
    size        BIGINT      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pastes_user_id ON pastes (user_id);

-- +goose Down
DROP TABLE IF EXISTS pastes;
