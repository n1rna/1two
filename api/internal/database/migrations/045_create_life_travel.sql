-- +goose Up

CREATE TABLE life_travel_trips (
    id                TEXT        NOT NULL PRIMARY KEY,
    owner_user_id     TEXT        NOT NULL,
    title             TEXT        NOT NULL,
    summary           TEXT        NOT NULL DEFAULT '',
    start_date        DATE,
    end_date          DATE,
    cover_image_url   TEXT        NOT NULL DEFAULT '',
    status            TEXT        NOT NULL DEFAULT 'planning',   -- planning | booked | ongoing | completed | cancelled
    budget_currency   TEXT        NOT NULL DEFAULT 'USD',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_travel_trips_owner ON life_travel_trips (owner_user_id, updated_at DESC);
CREATE INDEX idx_life_travel_trips_active
    ON life_travel_trips (owner_user_id, start_date)
    WHERE status IN ('planning', 'booked', 'ongoing');

CREATE TABLE life_travel_trip_members (
    id            TEXT        NOT NULL PRIMARY KEY,
    trip_id       TEXT        NOT NULL REFERENCES life_travel_trips(id) ON DELETE CASCADE,
    user_id       TEXT,
    invite_email  TEXT        NOT NULL DEFAULT '',
    role          TEXT        NOT NULL DEFAULT 'viewer',         -- owner | editor | viewer
    joined_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_life_travel_trip_members_user_trip
    ON life_travel_trip_members (user_id, trip_id)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_life_travel_trip_members_trip ON life_travel_trip_members (trip_id);

CREATE TABLE life_travel_destinations (
    id              TEXT        NOT NULL PRIMARY KEY,
    trip_id         TEXT        NOT NULL REFERENCES life_travel_trips(id) ON DELETE CASCADE,
    ordinal         INTEGER     NOT NULL DEFAULT 0,
    name            TEXT        NOT NULL,
    mapbox_place_id TEXT        NOT NULL DEFAULT '',
    country         TEXT        NOT NULL DEFAULT '',
    region          TEXT        NOT NULL DEFAULT '',
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    arrive_at       TIMESTAMPTZ,
    depart_at       TIMESTAMPTZ,
    notes           TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_travel_destinations_trip ON life_travel_destinations (trip_id, ordinal);

CREATE TABLE life_travel_activities (
    id              TEXT        NOT NULL PRIMARY KEY,
    destination_id  TEXT        NOT NULL REFERENCES life_travel_destinations(id) ON DELETE CASCADE,
    trip_id         TEXT        NOT NULL REFERENCES life_travel_trips(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    category        TEXT        NOT NULL DEFAULT 'other',        -- sightseeing | food | nightlife | outdoor | wellness | other
    start_at        TIMESTAMPTZ,
    end_at          TIMESTAMPTZ,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    address         TEXT        NOT NULL DEFAULT '',
    cost_amount     NUMERIC(12,2),
    cost_currency   TEXT        NOT NULL DEFAULT '',
    booking_url     TEXT        NOT NULL DEFAULT '',
    notes           TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_travel_activities_dest ON life_travel_activities (destination_id, start_at);
CREATE INDEX idx_life_travel_activities_trip ON life_travel_activities (trip_id, start_at);

CREATE TABLE life_travel_reservations (
    id                  TEXT        NOT NULL PRIMARY KEY,
    trip_id             TEXT        NOT NULL REFERENCES life_travel_trips(id) ON DELETE CASCADE,
    destination_id      TEXT        REFERENCES life_travel_destinations(id) ON DELETE SET NULL,
    kind                TEXT        NOT NULL,                    -- flight | train | bus | car | hotel | bnb | restaurant | event | other
    title               TEXT        NOT NULL,
    provider            TEXT        NOT NULL DEFAULT '',
    confirmation_code   TEXT        NOT NULL DEFAULT '',
    start_at            TIMESTAMPTZ,
    end_at              TIMESTAMPTZ,
    origin_place        TEXT        NOT NULL DEFAULT '',
    dest_place          TEXT        NOT NULL DEFAULT '',
    cost_amount         NUMERIC(12,2),
    cost_currency       TEXT        NOT NULL DEFAULT '',
    status              TEXT        NOT NULL DEFAULT 'planned',  -- planned | booked | cancelled
    payload             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_travel_reservations_trip ON life_travel_reservations (trip_id, start_at);
CREATE INDEX idx_life_travel_reservations_dest ON life_travel_reservations (destination_id) WHERE destination_id IS NOT NULL;

CREATE TABLE life_travel_tickets (
    id              TEXT        NOT NULL PRIMARY KEY,
    trip_id         TEXT        NOT NULL REFERENCES life_travel_trips(id) ON DELETE CASCADE,
    reservation_id  TEXT        REFERENCES life_travel_reservations(id) ON DELETE SET NULL,
    title           TEXT        NOT NULL,
    kind            TEXT        NOT NULL DEFAULT 'transit',      -- transit | event | pass | voucher
    file_url        TEXT        NOT NULL DEFAULT '',
    issued_to       TEXT        NOT NULL DEFAULT '',
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_travel_tickets_trip ON life_travel_tickets (trip_id);
CREATE INDEX idx_life_travel_tickets_reservation ON life_travel_tickets (reservation_id) WHERE reservation_id IS NOT NULL;

CREATE TABLE life_travel_preferences (
    user_id         TEXT        NOT NULL PRIMARY KEY,
    pace            TEXT        NOT NULL DEFAULT 'moderate',     -- slow | moderate | packed
    budget_tier     TEXT        NOT NULL DEFAULT 'mid',          -- budget | mid | lux
    dietary         TEXT[]      NOT NULL DEFAULT '{}',
    accessibility   TEXT[]      NOT NULL DEFAULT '{}',
    interests       TEXT[]      NOT NULL DEFAULT '{}',
    avoid           TEXT[]      NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE life_travel_suggestions_cache (
    query_hash      TEXT        NOT NULL PRIMARY KEY,
    kind            TEXT        NOT NULL,                        -- destination | activity | flight | hotel | budget
    payload         JSONB       NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_life_travel_suggestions_cache_expires ON life_travel_suggestions_cache (expires_at);

CREATE TABLE life_travel_invites (
    id          TEXT        NOT NULL PRIMARY KEY,
    trip_id     TEXT        NOT NULL REFERENCES life_travel_trips(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL,
    token       TEXT        NOT NULL UNIQUE,
    role        TEXT        NOT NULL DEFAULT 'viewer',           -- editor | viewer
    status      TEXT        NOT NULL DEFAULT 'pending',          -- pending | accepted | revoked | expired
    invited_by  TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);
CREATE INDEX idx_life_travel_invites_trip ON life_travel_invites (trip_id, status);
CREATE INDEX idx_life_travel_invites_email ON life_travel_invites (email, status);

-- +goose Down
DROP INDEX IF EXISTS idx_life_travel_invites_email;
DROP INDEX IF EXISTS idx_life_travel_invites_trip;
DROP TABLE IF EXISTS life_travel_invites;

DROP INDEX IF EXISTS idx_life_travel_suggestions_cache_expires;
DROP TABLE IF EXISTS life_travel_suggestions_cache;

DROP TABLE IF EXISTS life_travel_preferences;

DROP INDEX IF EXISTS idx_life_travel_tickets_reservation;
DROP INDEX IF EXISTS idx_life_travel_tickets_trip;
DROP TABLE IF EXISTS life_travel_tickets;

DROP INDEX IF EXISTS idx_life_travel_reservations_dest;
DROP INDEX IF EXISTS idx_life_travel_reservations_trip;
DROP TABLE IF EXISTS life_travel_reservations;

DROP INDEX IF EXISTS idx_life_travel_activities_trip;
DROP INDEX IF EXISTS idx_life_travel_activities_dest;
DROP TABLE IF EXISTS life_travel_activities;

DROP INDEX IF EXISTS idx_life_travel_destinations_trip;
DROP TABLE IF EXISTS life_travel_destinations;

DROP INDEX IF EXISTS idx_life_travel_trip_members_trip;
DROP INDEX IF EXISTS idx_life_travel_trip_members_user_trip;
DROP TABLE IF EXISTS life_travel_trip_members;

DROP INDEX IF EXISTS idx_life_travel_trips_active;
DROP INDEX IF EXISTS idx_life_travel_trips_owner;
DROP TABLE IF EXISTS life_travel_trips;
