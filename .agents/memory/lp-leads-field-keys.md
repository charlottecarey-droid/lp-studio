---
name: lp_leads field keys are tenant-authored
description: Why reading lp_leads.fields by exact key silently drops leads, and where the dashboard normalizes.
---

# lp_leads.fields keys vary by tenant form

`lp_leads.fields` is a jsonb of whatever the landing-page form submitted. There is
NO fixed schema and NO `name`/`email`/`is_test` column — name/email/etc. live inside
`fields`. Tenants author their own field labels, so the SAME concept appears under
many key spellings: `email` / `Email Address`, `firstName` / `first_name` /
`First Name`, `Company Name`, `Practice/Company Name`, etc. (real prod data, tenants
1 and 5).

**Footgun:** any code that reads `fields` by an exact key (`fields.firstName`,
`fields.email`) silently misses leads whose form used a different spelling. The
dashboard Recent-Leads widget hid EVERY recent lead this way — `leadName()` returned
null for Title-Case keys, so they were all filtered out as "anonymous", and the user
saw "no recent leads" even though ingestion was healthy.

**How to apply:** when reading lead fields for display/filtering, normalize keys
(lowercase + strip non-alphanumerics) and look up by any synonym. The dashboard does
this via `fieldAccessor()` in `artifacts/lp-studio/src/pages/dashboard.tsx`
(`leadName` / `isTestLead`). If you touch the All-Leads page, lead exports, or
notification/CRM sync, apply the same normalization — they are likely vulnerable to
the same exact-key bug.

Separately: a "no leads showing" report can ALSO just be the api-server being down
(it crashed on `EADDRINUSE :::8080` from a stale instance) — check the workflow
is running before assuming a data/filter bug.
