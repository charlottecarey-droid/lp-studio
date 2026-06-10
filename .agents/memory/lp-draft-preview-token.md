---
name: LP draft preview without a session
description: How to render/screenshot a draft lp_page with no login, plus the localhost brand-token fallback gotcha
---

To visually preview/screenshot a `status="draft"` lp_page when you have no authenticated session:

1. Insert a row into `lp_page_reviews` with `page_id` = the draft's id and a random `token` (the only NOT NULL cols are page_id, token; status defaults 'pending'). There is NO expires_at — revoke by DELETE.
2. Hit `GET /api/lp/preview/:slug?reviewToken=<token>` (api-server). The token path loads the page by `review.pageId === page.id AND slug` — it ignores host/tenant, so it works from anywhere. Add `?prerender=1` to get server-rendered HTML (grep it to confirm every block's headline rendered).
3. For the SPA screenshot use the lp-studio artifact path `/preview/:slug?reviewToken=<token>&preview=app` — the `&preview=app` is REQUIRED in dev (root otherwise renders the marketing site; see lp-studio-dev-marketing-host).

**Gotcha — brand colors look wrong (blue) in the localhost token preview.** The token preview has no tenant brand context, so `--brand-primary` / `--lp-bg-*` CSS vars aren't emitted and backgroundStyle tokens (`dandy-green`, etc.) fall back to their built-in defaults (slate/indigo → reads as blue). This is NOT a real bug: a page authored with backgroundStyle TOKENS (never hardcoded hex) renders in the tenant's real brand once published on the tenant host or viewed inside an authenticated tenant session. Verify color intent by the token usage, not by the localhost preview.

**Why:** spent a screenshot cycle thinking Dandy green had regressed to blue; it was just the brandless localhost preview.
**How to apply:** when a draft preview renders off-brand on localhost, confirm the blocks use bg tokens (correct) and move on; don't "fix" by hardcoding hex.
