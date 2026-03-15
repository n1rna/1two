-- +goose Up
ALTER TABLE hosted_sqlite ALTER COLUMN file_key DROP NOT NULL;
ALTER TABLE hosted_sqlite ALTER COLUMN file_key SET DEFAULT '';

-- +goose Down
ALTER TABLE hosted_sqlite ALTER COLUMN file_key SET NOT NULL;
