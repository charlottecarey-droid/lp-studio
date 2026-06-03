---
name: Page-visit de-anonymization surfaces
description: Where lp_leads.session_id de-anonymization applies across analytics, and what is genuinely out of scope.
---

De-anonymization signal = `lp_leads.session_id`: an anonymous `lp_page_visits` session that submitted a lead form on that page is really a known visitor. Resolve identity via the shared `@workspace/lead-utils` accessors (`leadName`/`leadEmail`/`fieldAccessor`) with a per-session FIRST-non-empty-wins merge (name/email/company live under arbitrary keys in `fields` JSON → JS-only, never SQL).

**Surfaces that actually carry this signal (LP analytics, `page-detail.ts`):**
- `/visits` — lists per-visit rows; LEFT-joins a `lead_identity(session_id, contact_name, company, email)` VALUES CTE. The ONLY surface that shows visitor *names* per row.
- `/summary` (page overview) — counts only. De-anon sessions are reclassified from anonymous→known and counted as DISTINCT identity (email-first key) so two sessions of the same person collapse to one known unique visitor. **Observable effect is only cross-session identity de-dup** (uniqueVisitors drops when ≥2 sessions share an identity); a single de-anon session is net-zero (just moves anon→known bucket). Keep personalized/hotlink "known" count UNCHANGED — add de-anon separately.

**Gotcha:** "first non-empty wins" resolves over an unordered lead query (no SQL `ORDER BY`) in both /visits and /summary, so a session with multiple conflicting lead rows is non-deterministic at the SQL level. Consistent today only because both surfaces share the merge; add deterministic ordering to both together if it ever matters.

**Out of scope (cannot use this signal):**
- `/traffic-sources` and tenant-wide `analytics.ts` (locations/countries/traffic/pages/overview/ghost-submits) — all aggregate, no per-visitor identity.
- Sales Signals / Sales Dashboard "Anonymous"/"Unknown visitor" — different domain (`sales_signals`, account/contact-based; ingested from hotlinks/email/campaign webhooks). No anonymous `lp_page_visits` tracking session_id, so `lp_leads.session_id` resolution does not apply.

**Why:** Task #910 added the signal + de-anon'd `/visits`; #919 extended it to `/summary`. Repeatedly re-derived that the Visits table is the sole name-listing LP surface; don't chase Sales.
