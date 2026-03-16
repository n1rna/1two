-- +goose Up
-- Rename tool_state keys from "1two" prefix to "1tt" prefix
UPDATE tool_state SET key = REPLACE(key, '1two:', '1tt:') WHERE key LIKE '1two:%';
UPDATE tool_state SET key = REPLACE(key, '1two-saved-', '1tt-saved-') WHERE key LIKE '1two-saved-%';

-- +goose Down
UPDATE tool_state SET key = REPLACE(key, '1tt:', '1two:') WHERE key LIKE '1tt:%';
UPDATE tool_state SET key = REPLACE(key, '1tt-saved-', '1two-saved-') WHERE key LIKE '1tt-saved-%';
