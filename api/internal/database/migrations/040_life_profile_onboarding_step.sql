-- +goose Up
ALTER TABLE life_profiles ADD COLUMN IF NOT EXISTS onboarding_step TEXT;

-- +goose Down
ALTER TABLE life_profiles DROP COLUMN IF EXISTS onboarding_step;
