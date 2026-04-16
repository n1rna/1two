-- +goose Up
CREATE TABLE logo_image_variants (
    id           TEXT        PRIMARY KEY,
    image_id     TEXT        NOT NULL REFERENCES logo_images(id) ON DELETE CASCADE,
    variant      TEXT        NOT NULL,
    r2_key       TEXT        NOT NULL,
    content_type TEXT        NOT NULL DEFAULT 'image/png',
    width        INT         NOT NULL DEFAULT 0,
    height       INT         NOT NULL DEFAULT 0,
    size         BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(image_id, variant)
);
CREATE INDEX idx_logo_variants_image ON logo_image_variants (image_id);

-- +goose Down
DROP TABLE IF EXISTS logo_image_variants;
