---
name: Brand-import evidence build timeouts
description: Why the URL brand-import evidence phase needs generous, layered timeouts and how the outer cap must be derived from the inner ones.
---

The user-facing URL brand-import (LP Studio settings) goes:
`POST /api/lp/brand-import/from-url-stream` → `runOrchestrator` → `buildEvidence` (brand-import/evidence.ts).

**Two compounding timeouts gate the whole import, and BOTH must be sized for slow sites:**
1. Per-scrape firecrawl timeout in `evidence.ts`. The home page is scraped with markdown+screenshot+rawHtml in one call; cold-rendering a heavy/bot-protected e-commerce homepage (Nordstrom ≈ 18-19s, Anthropologie ≈ 7s) needs far more than a markdown-only sub-page. Hence the split: `FIRECRAWL_SCREENSHOT_TIMEOUT_MS` (home, large) vs `FIRECRAWL_TIMEOUT_MS` (sub-pages, smaller).
2. The orchestrator wraps the ENTIRE `buildEvidence` in one `withTimeout(..., EVIDENCE_BUILD_BUDGET_MS, "evidence")`. Exceeding it yields `event:"error"` and the import produces **zero** dimensions — a hard, total failure, not a soft degradation.

**Why:** A regression shrank these caps (outer 20s→7s when the streaming path replaced the old non-stream `/lp/n` route; per-scrape 6s). Result: Nordstrom always blew the 7s cap → evidence error → "nothing imported"; Anthropologie sometimes squeaked through via the direct-HTML fallback → "a couple things". Different symptoms, same root cause.

**How to apply:**
- `buildEvidence`'s slow steps run *sequentially* in the worst case: robots fetch (awaited before scrapes) → home screenshot scrape (dominant) → stylesheet fetches → screenshot-buffer fetch → palette sampling. The outer budget MUST clear the sum of those maxima with margin, or a genuinely-slow-but-working site still fails before any extractor runs.
- All downstream phases (stylesheets, screenshot-buffer) are best-effort (return null, never throw), so the only hard-fail in the path is the outer `withTimeout`. Keep it that way.
- `EVIDENCE_BUILD_BUDGET_MS` is **derived** from the inner constants (robots + screenshot-scrape + stylesheet + screenshot-fetch + slack) in evidence.ts and imported by the orchestrator. If you retune any inner timeout, the outer budget tracks automatically — don't reintroduce a hardcoded outer literal.
- The non-stream `/lp/n` route (brand-import-from-url.ts) has its OWN scrape impl (~20s) and is NOT the user-facing URL-import path; don't confuse the two.
