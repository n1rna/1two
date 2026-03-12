-- +goose Up
CREATE TABLE IF NOT EXISTS logo_images (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    name        TEXT        NOT NULL DEFAULT 'Untitled',
    config      TEXT,
    r2_key      TEXT        NOT NULL,
    content_type TEXT       NOT NULL DEFAULT 'image/png',
    width       INT         NOT NULL,
    height      INT         NOT NULL,
    size        BIGINT      NOT NULL,
    published   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logo_images_user_id ON logo_images (user_id);
CREATE INDEX IF NOT EXISTS idx_logo_images_slug ON logo_images (slug);

-- +goose Down
DROP TABLE IF EXISTS logo_images;
