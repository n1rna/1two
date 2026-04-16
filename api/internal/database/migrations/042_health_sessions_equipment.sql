-- +goose Up
ALTER TABLE health_sessions ADD COLUMN IF NOT EXISTS equipment TEXT[] NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE health_sessions DROP COLUMN IF EXISTS equipment;
