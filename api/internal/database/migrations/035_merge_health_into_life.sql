-- +goose Up

-- Add conversation category to life_conversations
ALTER TABLE life_conversations ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'life';

-- Migrate health conversations into life_conversations
INSERT INTO life_conversations (id, user_id, channel, title, category, created_at, updated_at)
SELECT id, user_id, 'web', title, 'health', created_at, updated_at
FROM health_conversations
ON CONFLICT (id) DO NOTHING;

-- Migrate health messages into life_messages
INSERT INTO life_messages (id, conversation_id, user_id, role, content, tool_calls, created_at)
SELECT id, conversation_id, user_id, role, content, tool_calls, created_at
FROM health_messages
ON CONFLICT (id) DO NOTHING;

-- Migrate health memories into life_memories (add source='health' to distinguish)
INSERT INTO life_memories (id, user_id, category, content, source, active, created_at, updated_at)
SELECT id, user_id, category, content, 'health', active, created_at, updated_at
FROM health_memories
ON CONFLICT (id) DO NOTHING;

-- +goose Down
-- Remove migrated data (best-effort; original tables still exist)
DELETE FROM life_messages WHERE conversation_id IN (SELECT id FROM life_conversations WHERE category = 'health');
DELETE FROM life_conversations WHERE category = 'health';
DELETE FROM life_memories WHERE source = 'health';
ALTER TABLE life_conversations DROP COLUMN IF EXISTS category;
