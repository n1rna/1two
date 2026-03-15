-- +goose Up
ALTER TABLE hosted_sqlite ADD COLUMN turso_db_name TEXT NOT NULL DEFAULT '';
ALTER TABLE hosted_sqlite ADD COLUMN turso_hostname TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE hosted_sqlite DROP COLUMN turso_db_name;
ALTER TABLE hosted_sqlite DROP COLUMN turso_hostname;
