---
name: PDF brand-font embedding (jsPDF one-pagers)
description: How tenant brand fonts get embedded into client-side PDF one-pagers, and the two non-obvious traps (jsPDF silent bad-font corruption; Google v1-css+curl returns full-charset TTF).
---

# PDF one-pager brand-font embedding

Web one-pagers get tenant fonts via CSS automatically. Client-side **PDF** one-pagers
(jsPDF) do NOT — fonts must be embedded as base64 TTF. Flow:

- Backend resolver `GET /sales/brand-font?family=` (api-server sales routes, mounted
  BEFORE the plan-feature gate so it is plan-open but auth-gated) fetches the font
  server-side and returns `{ normal, bold, italic, bolditalic }` base64.
- Generators (`lib/one-pager-types/src/generators.ts`) override jsPDF built-in faces:
  brand BODY font → `"helvetica"`, brand DISPLAY font → `"Bagoss"`, via
  `registerBrandFonts(doc, brand)` called right after every `new jsPDF(...)`.
- Per-style fallback: each style is validated/added independently, so a missing or
  unembeddable italic/bold keeps the built-in face.

## Trap 1 — jsPDF addFont does NOT throw on bad bytes
`doc.addFont(file, name, style)` with malformed/non-font base64 does **not** throw.
It logs via jsPDF's internal PubSub and leaves the face registered but **metric-less**,
which then crashes the NEXT `doc.getTextWidth()`/`splitTextToSize` with
`Cannot read properties of undefined (reading 'widths')`.

**Why:** a try/catch around `addFont` cannot save you — the failure is async/swallowed.
**How to apply:** magic-byte–validate the base64 BEFORE calling addFont. Accept only a
real SFNT/OpenType signature: TrueType `0x00010000`, `'OTTO'`, `'true'`, or `'ttcf'`.
Decode just the head (works in browser via `atob`, in node via `Buffer`). A failed
check skips that style (the fallback) instead of corrupting the built-in face.

## Trap 2 — use Google's v1 /css API with a curl UA (not /css2)
Hit `https://fonts.googleapis.com/css?family=<Name>:400,400italic,700,700italic` with
`User-Agent: curl/7.64.1`. The v1 API + non-modern UA returns ONE `@font-face` block
per weight/style with a **full-charset TTF** (jsPDF can't use the woff2 that modern UAs
get). It does **not** emit `unicode-range`-subset blocks — that subsetting is a
`/css2` + woff2 behavior. So "take the first TTF URL per style" is correct here; do
NOT add unicode-range Latin-subset selection logic for this v1+curl path.

## SSRF (already correct — keep it)
CSS host pinned to `fonts.googleapis.com`; every TTF URL/hop must be
`fonts.gstatic.com`; `redirect:"manual"`; HTTPS-only; magic-byte + size cap; 24h
in-memory cache; degrade to `{ faces: {} }` on any failure (never block PDF gen).
