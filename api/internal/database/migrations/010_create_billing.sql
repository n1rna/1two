-- +goose Up

-- Map 1tt users to Polar customers
CREATE TABLE IF NOT EXISTS billing_customers (
    user_id           TEXT        NOT NULL PRIMARY KEY,
    polar_customer_id TEXT        NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache subscription state locally for fast middleware checks
CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id                   TEXT        NOT NULL PRIMARY KEY, -- Polar subscription ID
    user_id              TEXT        NOT NULL,
    polar_product_id     TEXT        NOT NULL,
    plan_tier            TEXT        NOT NULL DEFAULT 'free', -- 'free', 'pro', 'max'
    status               TEXT        NOT NULL DEFAULT 'active', -- 'trialing','active','past_due','canceled','revoked'
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id ON billing_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON billing_subscriptions (status);

-- Local usage counters for fast limit enforcement (reset monthly)
CREATE TABLE IF NOT EXISTS billing_usage (
    user_id      TEXT        NOT NULL,
    meter_slug   TEXT        NOT NULL, -- 'paste-created', 'og-image-view'
    period_start TIMESTAMPTZ NOT NULL, -- first of month UTC
    count        BIGINT      NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, meter_slug, period_start)
);

-- Webhook event deduplication
CREATE TABLE IF NOT EXISTS billing_webhook_events (
    event_id     TEXT        NOT NULL PRIMARY KEY,
    event_type   TEXT        NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_processed ON billing_webhook_events (processed_at);

-- +goose Down
DROP TABLE IF EXISTS billing_webhook_events;
DROP TABLE IF EXISTS billing_usage;
DROP TABLE IF EXISTS billing_subscriptions;
DROP TABLE IF EXISTS billing_customers;
