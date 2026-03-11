-- +goose Up
CREATE TABLE IF NOT EXISTS og_collections (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    name        TEXT        NOT NULL DEFAULT 'Untitled',
    config      JSONB       NOT NULL,
    published   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_og_collections_user_id ON og_collections (user_id);
CREATE INDEX IF NOT EXISTS idx_og_collections_slug ON og_collections (slug);

-- +goose Down
DROP TABLE IF EXISTS og_collections;
