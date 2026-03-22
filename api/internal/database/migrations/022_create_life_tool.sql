-- +goose Up

CREATE TABLE life_profiles (
    user_id          TEXT        NOT NULL PRIMARY KEY,
    timezone         TEXT        NOT NULL DEFAULT 'UTC',
    wake_time        TIME,
    sleep_time       TIME,
    agent_enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
    last_agent_run   TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE life_memories (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    category    TEXT        NOT NULL DEFAULT 'preference',
    content     TEXT        NOT NULL,
    source      TEXT        NOT NULL DEFAULT 'user',
    source_msg_id TEXT,
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_memories_user ON life_memories (user_id, active);

CREATE TABLE life_conversations (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    channel     TEXT        NOT NULL DEFAULT 'web',
    channel_ref TEXT,
    title       TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_conversations_user ON life_conversations (user_id, updated_at DESC);

CREATE TABLE life_messages (
    id              TEXT        NOT NULL PRIMARY KEY,
    conversation_id TEXT        NOT NULL REFERENCES life_conversations(id) ON DELETE CASCADE,
    user_id         TEXT        NOT NULL,
    role            TEXT        NOT NULL,
    content         TEXT        NOT NULL,
    channel         TEXT        NOT NULL DEFAULT 'web',
    tool_calls      JSONB,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_messages_conv ON life_messages (conversation_id, created_at);
CREATE INDEX idx_life_messages_user ON life_messages (user_id, created_at DESC);

CREATE TABLE life_actionables (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    source_msg_id   TEXT,
    type            TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending',
    title           TEXT        NOT NULL,
    description     TEXT        NOT NULL DEFAULT '',
    options         JSONB,
    response        JSONB,
    due_at          TIMESTAMPTZ,
    snoozed_until   TIMESTAMPTZ,
    routine_id      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);
CREATE INDEX idx_life_actionables_user_status ON life_actionables (user_id, status);
CREATE INDEX idx_life_actionables_user_due ON life_actionables (user_id, due_at) WHERE status = 'pending';

CREATE TABLE life_routines (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    type        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    schedule    JSONB       NOT NULL DEFAULT '{}',
    config      JSONB       NOT NULL DEFAULT '{}',
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    last_triggered TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_life_routines_user ON life_routines (user_id, active);

CREATE TABLE life_gcal_connections (
    user_id       TEXT        NOT NULL PRIMARY KEY,
    google_email  TEXT        NOT NULL,
    access_token  TEXT        NOT NULL,
    refresh_token TEXT        NOT NULL,
    token_expiry  TIMESTAMPTZ NOT NULL,
    calendar_ids  JSONB       NOT NULL DEFAULT '["primary"]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE life_channel_links (
    id          TEXT        NOT NULL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    channel     TEXT        NOT NULL,
    channel_uid TEXT        NOT NULL,
    verified    BOOLEAN     NOT NULL DEFAULT FALSE,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(channel, channel_uid)
);
CREATE INDEX idx_life_channel_links_user ON life_channel_links (user_id);
CREATE INDEX idx_life_channel_links_lookup ON life_channel_links (channel, channel_uid);

-- +goose Down
DROP TABLE IF EXISTS life_channel_links;
DROP TABLE IF EXISTS life_gcal_connections;
DROP TABLE IF EXISTS life_routines;
DROP TABLE IF EXISTS life_actionables;
DROP TABLE IF EXISTS life_messages;
DROP TABLE IF EXISTS life_conversations;
DROP TABLE IF EXISTS life_memories;
DROP TABLE IF EXISTS life_profiles;
