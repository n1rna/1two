-- +goose Up
ALTER TABLE life_routines
  ADD COLUMN IF NOT EXISTS config_schema JSONB NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE life_routines
  DROP COLUMN IF EXISTS config_schema;
