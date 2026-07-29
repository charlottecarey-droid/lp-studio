-- Account team: who from OUR side covers this account.
--
-- Sourced from Salesforce's AccountTeamMember (joined to User for name/email/
-- title/photo) and/or edited by hand. One jsonb on the account rather than a
-- table: it's read as a whole with the account, never queried or joined, and
-- the per-member shape is whatever Salesforce gives us plus manual overrides.
--
-- Shape: { members: [{ name, title?, email?, phone?, photoUrl?, role?,
--                      salesforceUserId?, source: "salesforce" | "manual" }],
--          syncedAt?: string }
ALTER TABLE sales_accounts
  ADD COLUMN IF NOT EXISTS account_team jsonb NOT NULL DEFAULT '{}'::jsonb;
