-- +goose Up
ALTER TABLE life_actionables ADD COLUMN action_type    TEXT NOT NULL DEFAULT '';
ALTER TABLE life_actionables ADD COLUMN action_payload JSONB;

-- +goose Down
ALTER TABLE life_actionables DROP COLUMN IF EXISTS action_payload;
ALTER TABLE life_actionables DROP COLUMN IF EXISTS action_type;
