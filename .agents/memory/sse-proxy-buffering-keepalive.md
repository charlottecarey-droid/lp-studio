---
name: SSE proxy buffering vs padded keepalive
description: Why a generation route's live preview shows "blank for ~30s then everything bursts in at once", and the fix.
---

The Replit platform proxy in front of `/api` buffers a Server-Sent-Events stream (accumulate-before-forward) until enough bytes arrive, then releases the whole backlog at once. A stream whose only traffic during long no-data gaps is a tiny `:`-comment heartbeat (e.g. `: hb` every 15s) never crosses the proxy's buffer threshold, so the client sees nothing live and then a single end-of-stream burst.

**Symptom:** builder/canvas preview (lp-studio) is blank with no status for the whole generation, then all stage steps flash by and the page appears right as it finishes. Streaming is wired correctly on BOTH ends — this is purely the proxy holding the bytes.

**Why the marketing generator never showed this but the microsite one did:** marketing `generate-page` streams per-block model TOKENS continuously, so bytes flow the whole time and the proxy keeps forwarding. The microsite generator does ONE non-streaming model call (plus account research) with long silent gaps, so there was nothing to push the buffer.

**Fix (in the SHARED `generationEmitter.ts`, used by both generators):** replace the tiny heartbeat with a large (~16KiB) single-line SSE comment written once right after `: connected` AND on a tight ~1s interval. SSE comments are `:`-prefixed and ignored by every compliant client (the client `SseParser` explicitly drops `:` lines), so the event contract is unchanged — only extra ignored bytes flow, which is what forces the proxy to flush real events within ~1s.

**How to apply / guardrails:**
- Keep the keepalive BIG and FREQUENT enough to beat the proxy buffer. Do NOT "optimize" it back down to a small/infrequent heartbeat — that silently reintroduces the blank-preview bug, and you cannot easily reproduce it locally (the dev vite proxy doesn't buffer like the real platform proxy; the route is auth-gated so plain curl through `$REPLIT_DEV_DOMAIN` needs a session).
- Lower bound on per-event latency is the keepalive interval (~1s). If you ever need sub-second flush of real events, pad immediately AFTER each event too rather than relying only on the interval.
- This is INHERENT to a one-shot (non-streaming) model call: the canvas necessarily stays blank/shimmer during research+model; the fix only makes the LEFT-RAIL stage status update live and the page appear the instant the model returns. That is not a bug to chase further.
