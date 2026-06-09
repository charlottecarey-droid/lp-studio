---
name: Batch AI-proxy calls silently cap at ~20
description: Why a batch image-classify loop "tags ~20 then stops", and the required hardening for any AI-proxy batch.
---

A background batch that calls the Replit AI integrations OpenAI proxy per item (e.g. the superadmin "Classify for AI" / `POST /lp/media/reclassify` loop driving `classifyPurposeOnly`) will appear to "process ~20 items then stop."

**Why:** the proxy rate-limits after a short burst. The OpenAI SDK default `maxRetries` is only 2 with short backoff, so a sustained 429 is not waited out; and both the per-item classifier and the loop used empty `catch {}` — so every post-burst 429 failed invisibly with zero logs. Net effect: the first ~20 succeed, the rest silently no-op.

**How to apply:** for any AI-proxy batch —
- Construct the client with a raised `maxRetries` (e.g. 6) + a `timeout`; the SDK then auto-backs-off honoring `Retry-After`.
- Throttle between items (a small fixed delay) to stay under the per-minute limit instead of bursting.
- On a 429 that escapes the SDK retries, cool down hard (e.g. 20s) and retry the item once.
- NEVER swallow errors: return a typed result/outcome and log start / periodic progress / final summary (tagged/skipped/failed) via a logger captured *before* `setImmediate` (so it survives the response).
- Break early on a "no AI config" outcome so the loop doesn't spin doing nothing.
