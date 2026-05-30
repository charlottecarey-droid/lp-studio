-- Automatic 14-day Growth trial for self-serve signups.
--
-- Adds the trial window columns to tenants. NULL on both timestamps means
-- "no trial" — which is the going-forward-only policy for accounts that
-- already exist at launch (they keep their current plan and are NOT
-- retro-enrolled). New self-serve signups set these in the signup flow.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS has_trialed_before boolean NOT NULL DEFAULT false;

-- Legacy plan vocabulary cleanup: the pre-trial-system default for new
-- tenants was plan='trial' (which normalized to Growth, granting Growth
-- features for free indefinitely). With trials now represented by the
-- window columns above, 'trial' is no longer a valid stored plan — move
-- any existing 'trial' rows down to the Free floor. Protected enterprise
-- workspaces (Dandy) are never touched.
UPDATE tenants
   SET plan = 'free'
 WHERE plan = 'trial'
   AND slug NOT IN ('dandy', 'dandy-smb');
