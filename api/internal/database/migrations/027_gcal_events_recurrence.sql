-- +goose Up
-- Add recurrence rule storage for master recurring events.
-- With singleEvents=false, Google returns the master event with recurrence[] field.
ALTER TABLE life_gcal_events ADD COLUMN recurrence JSONB;  -- e.g. ["RRULE:FREQ=DAILY;COUNT=10"]
-- Duration in minutes for recurring events (needed to compute end time of instances)
ALTER TABLE life_gcal_events ADD COLUMN duration_minutes INT;
-- For master recurring events, start_time is the first occurrence.
-- For exceptions (edited instances), recurring_event_id links to the master.

-- Clean out old expanded instances — we'll re-sync with singleEvents=false.
TRUNCATE life_gcal_events;

-- Reset sync tokens so users get a fresh full sync.
UPDATE life_gcal_connections SET sync_token = NULL, last_sync = NULL, last_full_sync = NULL;

-- +goose Down
ALTER TABLE life_gcal_events DROP COLUMN IF EXISTS recurrence;
ALTER TABLE life_gcal_events DROP COLUMN IF EXISTS duration_minutes;
