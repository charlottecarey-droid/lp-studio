---
name: One-pager sheet detection (leads-with rule)
description: Why the landing-page viewer treats a page as a one-pager only when it LEADS with one-pager-hero.
---
The interactive one-pager "sheet" (centered 960px PDF-like frame with side gutters, `OnePagerFrame`) in `artifacts/lp-studio/src/pages/landing-page-viewer.tsx` is gated by `isOnePagerLayout(blocks)`.

**Rule:** a page is a one-pager only when its FIRST content block (skipping leading page-chrome: nav-header/sticky-header/sticky-bar/popup/dandy-site-header) is a `one-pager-hero`. Do NOT use "contains a one-pager-hero anywhere".

**Why:** `one-pager-hero` carries the generic `["hero"]` role tag in `lib/lp-template-engine/src/block-tags.ts`, so the AI page builder / templates can insert it into a regular landing page as a mid-page section. The old `blocks.some(...)` detection then wrapped the ENTIRE full-bleed landing page in the 960px sheet, squeezing its design (the reported bug on enterprise DSO landing pages). Genuine generated/sales one-pagers (web-one-pager route + sales editor) always lead with one-pager-hero, so leads-with preserves them.

**How to apply:** the same `isOnePagerPage` flag also drives `resolveOnePagerColors` (one-pager color overrides) — keep both gated on the same signal. There are TWO render paths in the viewer (direct builder page + variant linked-page); both must call the detector identically or they diverge.
