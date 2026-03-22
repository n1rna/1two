-- +goose Up
ALTER TABLE life_conversations ADD COLUMN routine_id TEXT;
CREATE INDEX idx_life_conversations_routine ON life_conversations (routine_id) WHERE routine_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_life_conversations_routine;
ALTER TABLE life_conversations DROP COLUMN IF EXISTS routine_id;
