---
name: Campaign engagement signal recording points
description: Where opens/clicks/form-submits actually get recorded for Sales Console campaign engagement, and why the /track/* endpoints alone are not enough.
---

The Sales Console activity feed (`sales_signals`) was missing "opened email", "clicked link", and "filled out form" even though page_view + email_sent worked.

**Root cause #1 — clicks/opens:** the campaign email's personalized CTA is built as `${host}/p/<token>` (campaigns.ts), which lands on `GET /resolve/:token` (hotlinks.ts). That handler only wrote `page_view`. The dedicated `/track/click-hotlink` + `/track/open-hotlink` endpoints exist but the email does NOT link/pixel through them, and Gmail's image proxy makes pixel opens unreliable (it prefetches once at delivery — caught by the 2s bot-grace guard — then serves a cached copy, so the real open never hits the server).
**Rule:** the canonical recording point for campaign open/click is the hotlink **resolve**, not the `/track/*` endpoints. `/resolve/:token` must also record `email_open` + `email_click` (and dual-write the send row) whenever the hotlink ties to a `sales_email_sends` row. A resolve == the recipient clicked their personalized link; a click implies an open.

**Root cause #2 — form submit:** `POST /lp/leads` (routes/lp, NOT a sales route) wrote `lp_leads` + fired CRM integrations but never inserted a `sales_signals` row. The `form_submit` type existed with no write path.
**Rule:** write the `form_submit` signal in lp/leads.ts, gated on a tenant-scoped `resolveContactByEmail(page.tenantId, submitterEmail)` match (use the local `findSubmitterEmail`). Skip unmatched/anonymous public-form leads so the sales feed isn't polluted with non-CRM submissions.

**Cross-path dedup MUST be atomic.** opens/clicks can fire from three paths (pixel, track-hotlink, resolve) plus concurrent resolves. Do NOT read-then-insert (`select openedAt; if null insert`) — two concurrent requests both read NULL and double-emit. Instead claim the stamp atomically:
`UPDATE sales_email_sends SET openedAt=now(), status=CASE... WHERE hotlinkId=X AND openedAt IS NULL RETURNING id` — only the request that flips the stamp gets a row back and emits the signal. Same pattern for clickedAt. Run the open claim before the click claim (a click implies an open). Use a CASE in SET to avoid downgrading terminal/clicked status (don't put status in the WHERE, or the stamp won't be claimed on an already-clicked row).
**Why:** the send-row stamps (`openedAt`/`clickedAt`) are the shared dedup state across every tracking path; the atomic claim is the only race-safe gate.
