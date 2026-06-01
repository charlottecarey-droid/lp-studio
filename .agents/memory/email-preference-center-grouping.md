---
name: Email preference center (group-level opt-out)
description: How LP Studio's personal email-preference center groups lifecycle templates and stores opt-outs durably; the rules a new template/category must follow.
---

LP Studio's Settings > Email > Preferences is a PERSON-level preference center grouped into a small fixed taxonomy (notificationPreferenceGroups.ts: getting_started, trial_billing, account_alerts, news_offers=catch-all). It replaced a broken per-internal-template toggle list.

## Storage model — opt-out is GROUP-level, not per-template
- An opt-out is ONE `notification_preferences` row whose `template_key = "grp:<groupId>"` (`groupOptOutKey`). NOT one row per member template.
- `isOptedOut(tenantId, appUserId, templateKey, channel)` suppresses if EITHER a per-template row OR the group row for `groupIdForTemplateKey(templateKey)` exists (single `template_key IN (...)` query). The dispatcher call site is unchanged — group logic lives inside `isOptedOut`, so the dispatcher test that mocks it still holds.

**Why group-level:** a per-template store silently RE-subscribes a user when a new template is later added to a category they unsubscribed from (the new template has no opt-out row). Group-level makes category unsubscribe durable — future templates in that category inherit the opt-out. This is the normal-company "unsubscribe from promotional emails" behavior the user demanded.

## Rules when touching this area
- Unclaimed lifecycle keys (incl. operator-created DB-only "junk" templates) map to the catch-all `news_offers` via `groupIdForTemplateKey`. The catch-all is ALWAYS shown (others hidden when they have 0 live members) so a user can pre-emptively unsubscribe from promos.
- `unsubscribeAllLifecycleEmails` (public one-click footer link) writes one group row per `PREFERENCE_GROUP_DEFS` id — so it also covers DB-only/future lifecycle templates. Do NOT revert it to static per-template keys.
- PATCH subscribe=true must clear BOTH the group row AND any legacy per-template rows for live members, or a previously one-click-unsubscribed user can't turn the category back on.
- GET classifies rows via `parseGroupOptOutKey`, which only accepts `grp:<knownGroupId>` (defense in depth). The `grp:` namespace can't collide with a real key because template keys are validated `/^[a-z0-9_]{2,64}$/` (no colon) at every create/update path (WORKFLOW_KEY_RE in routes/notifications.ts).
- Suppression is still gated to `category === 'lifecycle'` in the dispatcher — system/transactional (auth/billing) emails never consult opt-outs.
