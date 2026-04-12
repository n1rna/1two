-- +goose Up

CREATE TABLE life_marketplace_items (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  author_id     TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  current_version INT NOT NULL DEFAULT 1,
  fork_count    INT NOT NULL DEFAULT 0,
  view_count    INT NOT NULL DEFAULT 0,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unpublished_at TIMESTAMPTZ
);
CREATE INDEX idx_mp_kind_pub ON life_marketplace_items (kind, published_at DESC) WHERE unpublished_at IS NULL;
CREATE INDEX idx_mp_author ON life_marketplace_items (author_id);
CREATE INDEX idx_mp_title_trgm ON life_marketplace_items (lower(title));

CREATE TABLE life_marketplace_versions (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES life_marketplace_items(id) ON DELETE CASCADE,
  version     INT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content     JSONB NOT NULL,
  changelog   TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, version)
);

ALTER TABLE life_routines     ADD COLUMN IF NOT EXISTS forked_from_mp_id TEXT;
ALTER TABLE life_routines     ADD COLUMN IF NOT EXISTS forked_from_version INT;
ALTER TABLE health_sessions   ADD COLUMN IF NOT EXISTS forked_from_mp_id TEXT;
ALTER TABLE health_sessions   ADD COLUMN IF NOT EXISTS forked_from_version INT;
ALTER TABLE health_meal_plans ADD COLUMN IF NOT EXISTS forked_from_mp_id TEXT;
ALTER TABLE health_meal_plans ADD COLUMN IF NOT EXISTS forked_from_version INT;

-- +goose Down

ALTER TABLE health_meal_plans DROP COLUMN IF EXISTS forked_from_version;
ALTER TABLE health_meal_plans DROP COLUMN IF EXISTS forked_from_mp_id;
ALTER TABLE health_sessions   DROP COLUMN IF EXISTS forked_from_version;
ALTER TABLE health_sessions   DROP COLUMN IF EXISTS forked_from_mp_id;
ALTER TABLE life_routines     DROP COLUMN IF EXISTS forked_from_version;
ALTER TABLE life_routines     DROP COLUMN IF EXISTS forked_from_mp_id;

DROP TABLE IF EXISTS life_marketplace_versions;
DROP TABLE IF EXISTS life_marketplace_items;
