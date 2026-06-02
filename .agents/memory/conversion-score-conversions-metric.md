---
name: Conversion-score Conversions/CVR metric
description: Why the analytics Conversion Score showed Conversions 0 / CVR 0% despite real leads, and how the displayed metric is defined
---

The Page Analytics "Conversion Score" panel's displayed **Conversions** and **CVR**
must NOT be derived from `lp_events` type `'conversion'` joined by `variant_id`
over `impressions`. That old approach is doubly broken:

- It skips the event query entirely for pages with **no A/B variants** (most
  pages) → conversions always 0.
- `impressions` is an **ad-only** signal (0 for organically-visited pages), and
  CVR divided by it → always 0% even with thousands of visits and real leads.

**Definition (in `conversion-scoring.ts` route handler):** a landing page's
conversions = form-fill **leads** (`lp_leads` for the page) + non-form tracked
conversions (`lp_events` `'conversion'` with `form_id IS NULL`, scoped by
`page_id`). Form submits create an `lp_leads` row AND may emit an `lp_events`
conversion carrying a `form_id`, so only `form_id IS NULL` events are added to
avoid double-counting leads. Displayed **CVR = conversions / totalVisits**.

**Why this split:** the SCORE itself intentionally still gates on
`impressions > 0` (`hasTraffic`) and blends the impression-based CVR only for
paid traffic — so the displayed metrics were fixed WITHOUT touching the score
(no surprise score shifts). Keep the score inputs (`impressions`, the
impression-based `cvr`) separate from the displayed `conversions`/`cvr`.
