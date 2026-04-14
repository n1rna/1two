-- +goose Up
ALTER TABLE life_routines DROP COLUMN IF EXISTS type;

-- +goose Down
ALTER TABLE life_routines ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'custom';
