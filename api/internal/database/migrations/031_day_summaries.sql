-- +goose Up
CREATE TABLE IF NOT EXISTS life_day_summaries (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    date        DATE        NOT NULL,
    events_hash TEXT        NOT NULL,
    blocks      JSONB       NOT NULL DEFAULT '[]',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_day_summaries_user_date ON life_day_summaries (user_id, date);

-- +goose Down
DROP TABLE IF EXISTS life_day_summaries;
