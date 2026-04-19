-- +goose Up
CREATE TABLE life_agent_runs (
    id                      TEXT        NOT NULL PRIMARY KEY,
    user_id                 TEXT        NOT NULL,
    kind                    TEXT        NOT NULL,                        -- 'journey' | 'actionable_followup' | 'scheduler' | ...
    status                  TEXT        NOT NULL DEFAULT 'running',      -- 'running' | 'completed' | 'failed'
    title                   TEXT        NOT NULL DEFAULT '',             -- "Processing gym session update"
    subtitle                TEXT        NOT NULL DEFAULT '',             -- "Push day A"
    trigger                 TEXT        NOT NULL DEFAULT '',             -- journey trigger, or actionable id
    entity_id               TEXT,
    entity_title            TEXT,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    duration_ms             INTEGER,
    tool_calls              JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- [{tool, args, result, error}]
    result_summary          TEXT        NOT NULL DEFAULT '',             -- "Created 3 actionables"
    produced_actionable_ids TEXT[]      NOT NULL DEFAULT '{}',
    error                   TEXT        NOT NULL DEFAULT ''
);

CREATE INDEX idx_life_agent_runs_user_status
    ON life_agent_runs (user_id, status, started_at DESC);

CREATE INDEX idx_life_agent_runs_user_recent
    ON life_agent_runs (user_id, started_at DESC);

CREATE INDEX idx_life_agent_runs_running
    ON life_agent_runs (user_id) WHERE status = 'running';

-- +goose Down
DROP INDEX IF EXISTS idx_life_agent_runs_running;
DROP INDEX IF EXISTS idx_life_agent_runs_user_recent;
DROP INDEX IF EXISTS idx_life_agent_runs_user_status;
DROP TABLE IF EXISTS life_agent_runs;
