-- +goose Up
ALTER TABLE life_actionables ADD COLUMN source JSONB;

CREATE INDEX idx_life_actionables_source_trigger
    ON life_actionables ((source->>'trigger'))
    WHERE source IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_life_actionables_source_trigger;
ALTER TABLE life_actionables DROP COLUMN IF EXISTS source;
