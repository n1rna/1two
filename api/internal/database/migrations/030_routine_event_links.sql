-- +goose Up

-- Linking table: routine <-> Google Calendar event.
-- One routine can link to many events (e.g., gym routine → "Leg Day" Mon + "Cardio" Thu).
CREATE TABLE IF NOT EXISTS life_routine_event_links (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    routine_id      TEXT        NOT NULL,
    gcal_event_id   TEXT        NOT NULL,
    link_type       TEXT        NOT NULL DEFAULT 'agent',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, routine_id, gcal_event_id)
);
CREATE INDEX IF NOT EXISTS idx_routine_event_links_routine ON life_routine_event_links (user_id, routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_event_links_event ON life_routine_event_links (user_id, gcal_event_id);

-- Denormalized routine_id on event cache for fast joins during query.
ALTER TABLE life_gcal_events ADD COLUMN IF NOT EXISTS routine_id TEXT;
CREATE INDEX IF NOT EXISTS idx_gcal_events_routine ON life_gcal_events (user_id, routine_id) WHERE routine_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS life_routine_event_links;
ALTER TABLE life_gcal_events DROP COLUMN IF EXISTS routine_id;
