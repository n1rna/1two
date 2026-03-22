-- +goose Up
ALTER TABLE life_gcal_connections
  ADD COLUMN sync_token       TEXT,
  ADD COLUMN last_full_sync   TIMESTAMPTZ,
  ADD COLUMN last_sync        TIMESTAMPTZ,
  ADD COLUMN sync_window_min  DATE,
  ADD COLUMN sync_window_max  DATE;

CREATE TABLE life_gcal_events (
    id              TEXT        NOT NULL,
    user_id         TEXT        NOT NULL,
    calendar_id     TEXT        NOT NULL DEFAULT 'primary',
    summary         TEXT        NOT NULL DEFAULT '',
    description     TEXT        NOT NULL DEFAULT '',
    location        TEXT        NOT NULL DEFAULT '',
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    all_day         BOOLEAN     NOT NULL DEFAULT FALSE,
    status          TEXT        NOT NULL DEFAULT 'confirmed',
    color_id        TEXT        NOT NULL DEFAULT '',
    html_link       TEXT        NOT NULL DEFAULT '',
    recurring_event_id TEXT,
    raw_json        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

CREATE INDEX idx_gcal_events_user_time
    ON life_gcal_events (user_id, start_time, end_time)
    WHERE status != 'cancelled';

CREATE TABLE life_day_metadata (
    user_id     TEXT    NOT NULL,
    date        DATE    NOT NULL,
    summary     TEXT    NOT NULL DEFAULT '',
    suggestions JSONB,
    event_count INT     NOT NULL DEFAULT 0,
    busy_hours  NUMERIC(4,2) NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- +goose Down
DROP TABLE IF EXISTS life_day_metadata;
DROP TABLE IF EXISTS life_gcal_events;
ALTER TABLE life_gcal_connections
  DROP COLUMN IF EXISTS sync_token,
  DROP COLUMN IF EXISTS last_full_sync,
  DROP COLUMN IF EXISTS last_sync,
  DROP COLUMN IF EXISTS sync_window_min,
  DROP COLUMN IF EXISTS sync_window_max;
