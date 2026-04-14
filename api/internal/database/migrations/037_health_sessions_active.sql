-- +goose Up
ALTER TABLE health_sessions ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE health_sessions SET active = (status <> 'archived');
ALTER TABLE health_sessions DROP COLUMN status;

-- +goose Down
ALTER TABLE health_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
UPDATE health_sessions SET status = CASE WHEN active THEN 'active' ELSE 'archived' END;
ALTER TABLE health_sessions DROP COLUMN active;
