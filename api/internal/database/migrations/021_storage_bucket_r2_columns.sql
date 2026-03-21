-- +goose Up
ALTER TABLE user_storage_buckets ADD COLUMN r2_bucket_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_storage_buckets ADD COLUMN cf_token_id TEXT NOT NULL DEFAULT '';
ALTER TABLE user_storage_buckets ADD COLUMN s3_access_key_id TEXT NOT NULL DEFAULT '';
ALTER TABLE user_storage_buckets ADD COLUMN s3_secret_access_key TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE user_storage_buckets DROP COLUMN IF EXISTS r2_bucket_name;
ALTER TABLE user_storage_buckets DROP COLUMN IF EXISTS cf_token_id;
ALTER TABLE user_storage_buckets DROP COLUMN IF EXISTS s3_access_key_id;
ALTER TABLE user_storage_buckets DROP COLUMN IF EXISTS s3_secret_access_key;
