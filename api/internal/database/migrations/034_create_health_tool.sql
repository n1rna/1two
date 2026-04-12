-- +goose Up

-- Unified health profile (diet + fitness)
CREATE TABLE IF NOT EXISTS health_profiles (
    user_id                 TEXT        NOT NULL PRIMARY KEY,
    -- Body stats (diet)
    weight_kg               NUMERIC(5,1),
    height_cm               NUMERIC(5,1),
    age                     INTEGER,
    gender                  TEXT,
    activity_level          TEXT        NOT NULL DEFAULT 'moderate',
    -- Diet
    diet_type               TEXT        NOT NULL DEFAULT 'balanced',
    dietary_restrictions    TEXT[]      NOT NULL DEFAULT '{}',
    diet_goal               TEXT        NOT NULL DEFAULT 'maintain',
    goal_weight_kg          NUMERIC(5,1),
    bmi                     NUMERIC(4,1),
    bmr                     NUMERIC(7,1),
    tdee                    NUMERIC(7,1),
    target_calories         INTEGER,
    protein_g               INTEGER,
    carbs_g                 INTEGER,
    fat_g                   INTEGER,
    -- Fitness
    fitness_level           TEXT        NOT NULL DEFAULT 'beginner',
    fitness_goal            TEXT        NOT NULL DEFAULT 'general_fitness',
    available_equipment     TEXT[]      NOT NULL DEFAULT '{}',
    physical_limitations    TEXT[]      NOT NULL DEFAULT '{}',
    workout_likes           TEXT[]      NOT NULL DEFAULT '{}',
    workout_dislikes        TEXT[]      NOT NULL DEFAULT '{}',
    preferred_duration_min  INTEGER     NOT NULL DEFAULT 60,
    days_per_week           INTEGER     NOT NULL DEFAULT 3,
    -- Common
    onboarded               BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weight tracking
CREATE TABLE IF NOT EXISTS health_weight_entries (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    weight_kg       NUMERIC(5,1) NOT NULL,
    note            TEXT        NOT NULL DEFAULT '',
    recorded_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_weight_user ON health_weight_entries (user_id, recorded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_weight_unique ON health_weight_entries (user_id, recorded_at);

-- AI-generated meal plans
CREATE TABLE IF NOT EXISTS health_meal_plans (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    title           TEXT        NOT NULL,
    plan_type       TEXT        NOT NULL,
    diet_type       TEXT        NOT NULL,
    target_calories INTEGER,
    content         JSONB       NOT NULL,
    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_meal_plans_user ON health_meal_plans (user_id, active, created_at DESC);

-- Workout sessions
CREATE TABLE IF NOT EXISTS health_sessions (
    id                      TEXT        NOT NULL PRIMARY KEY,
    user_id                 TEXT        NOT NULL,
    title                   TEXT        NOT NULL,
    description             TEXT        NOT NULL DEFAULT '',
    status                  TEXT        NOT NULL DEFAULT 'draft',
    target_muscle_groups    TEXT[]      NOT NULL DEFAULT '{}',
    estimated_duration      INTEGER,
    difficulty_level        TEXT        NOT NULL DEFAULT 'intermediate',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_sessions_user ON health_sessions (user_id, status, updated_at DESC);

-- Exercise items within a session
CREATE TABLE IF NOT EXISTS health_session_exercises (
    id              TEXT        NOT NULL PRIMARY KEY,
    session_id      TEXT        NOT NULL REFERENCES health_sessions(id) ON DELETE CASCADE,
    user_id         TEXT        NOT NULL,
    exercise_name   TEXT        NOT NULL,
    sets            INTEGER     NOT NULL DEFAULT 3,
    reps            TEXT        NOT NULL DEFAULT '10',
    weight          TEXT        NOT NULL DEFAULT '',
    rest_seconds    INTEGER     NOT NULL DEFAULT 60,
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    notes           TEXT        NOT NULL DEFAULT '',
    superset_group  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_session_exercises ON health_session_exercises (session_id, sort_order);

-- Conversations
CREATE TABLE IF NOT EXISTS health_conversations (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    title           TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_conversations_user ON health_conversations (user_id, updated_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS health_messages (
    id              TEXT        NOT NULL PRIMARY KEY,
    conversation_id TEXT        NOT NULL REFERENCES health_conversations(id) ON DELETE CASCADE,
    user_id         TEXT        NOT NULL,
    role            TEXT        NOT NULL,
    content         TEXT        NOT NULL,
    tool_calls      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_messages_conv ON health_messages (conversation_id, created_at);

-- Memories (shared diet + fitness preferences)
CREATE TABLE IF NOT EXISTS health_memories (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    category        TEXT        NOT NULL DEFAULT 'preference',
    content         TEXT        NOT NULL,
    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_memories_user ON health_memories (user_id, active);

-- +goose Down
DROP TABLE IF EXISTS health_memories;
DROP TABLE IF EXISTS health_messages;
DROP TABLE IF EXISTS health_conversations;
DROP TABLE IF EXISTS health_session_exercises;
DROP TABLE IF EXISTS health_sessions;
DROP TABLE IF EXISTS health_meal_plans;
DROP TABLE IF EXISTS health_weight_entries;
DROP TABLE IF EXISTS health_profiles;
