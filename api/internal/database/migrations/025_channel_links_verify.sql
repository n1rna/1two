-- +goose Up
ALTER TABLE life_channel_links ADD COLUMN verify_code TEXT;
ALTER TABLE life_channel_links ADD COLUMN verify_expires TIMESTAMPTZ;
ALTER TABLE life_channel_links ADD COLUMN display_name TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE life_channel_links DROP COLUMN IF EXISTS verify_code;
ALTER TABLE life_channel_links DROP COLUMN IF EXISTS verify_expires;
ALTER TABLE life_channel_links DROP COLUMN IF EXISTS display_name;
