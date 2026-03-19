-- +goose Up

CREATE TABLE user_storage_buckets (
    id           TEXT        NOT NULL PRIMARY KEY,
    user_id      TEXT        NOT NULL,
    name         TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'active',
    total_size   BIGINT      NOT NULL DEFAULT 0,
    object_count INT         NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);
CREATE INDEX idx_user_storage_buckets_user ON user_storage_buckets (user_id);

CREATE TABLE storage_objects (
    id           TEXT        NOT NULL PRIMARY KEY,
    bucket_id    TEXT        NOT NULL REFERENCES user_storage_buckets(id) ON DELETE CASCADE,
    user_id      TEXT        NOT NULL,
    key          TEXT        NOT NULL,   -- object key within the bucket (e.g. "images/photo.jpg")
    r2_key       TEXT        NOT NULL,   -- full R2 key (storage/{userId}/{bucketName}/{key})
    size         BIGINT      NOT NULL DEFAULT 0,
    content_type TEXT        NOT NULL DEFAULT 'application/octet-stream',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bucket_id, key)
);
CREATE INDEX idx_storage_objects_bucket ON storage_objects (bucket_id);
CREATE INDEX idx_storage_objects_user   ON storage_objects (user_id);

-- +goose Down
DROP TABLE IF EXISTS storage_objects;
DROP TABLE IF EXISTS user_storage_buckets;
