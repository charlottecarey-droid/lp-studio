-- "Sign in with GitHub" support: add the github_id identity column to app_users.
--
-- GitHub OAuth has no id_token (unlike Google); the numeric GitHub user id is
-- the stable identity (the `sub` equivalent), stored here as text. It is unique
-- per GitHub account and NULL for users who never sign in with GitHub. The
-- GitHub callback upserts by email and sets github_id, linking a GitHub login
-- to an existing account that shares the same verified email.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS) —
-- safe to re-run. A UNIQUE index allows many NULLs in Postgres, so users
-- without a GitHub link don't collide.

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS github_id text;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_github_id_unique ON app_users (github_id);
