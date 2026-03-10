-- +goose Up
CREATE TABLE IF NOT EXISTS tool_state (
    user_id     TEXT        NOT NULL,
    key         TEXT        NOT NULL,
    data        JSONB       NOT NULL,
    size        BIGINT      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_tool_state_user_id ON tool_state (user_id);

-- +goose Down
DROP TABLE IF EXISTS tool_state;
