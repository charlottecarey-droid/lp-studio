---
name: Design intensity + brand fonts in AI page gen
description: How brand typography & a design-density axis feed the LP/microsite AI generators, and the cross-artifact font-cleaning landmine.
---

# Design intensity & brand fonts in AI page generation

The LP/microsite AI generators take two extra brand signals beyond colors:
a TYPOGRAPHY prompt section (heading/body/numbers font families) and a
DESIGN INTENSITY axis (`editorial-dense` | `airy-minimal` | `energetic-visual`
| `balanced`).

**`designIntensity` is inferred server-side from tone keywords by default** —
an explicit `brand.designIntensity` wins, else regex-scan `toneOfVoice` +
`toneKeywords` + `voiceProfile.profile.tone[]`/`summary`. There is no UI picker
(follow-up). Canonical type lives in `lp-studio/src/lib/brand-config.ts`
(`DesignIntensity` + optional `designIntensity` field).

**Structural enforcement mirrors the ctaColor/accentColor injection pattern**:
a deterministic `applyDesignIntensityBackgrounds` post-pass runs AFTER the
block map / normalizeBlock loop and nudges block `backgroundStyle` —
editorial-dense → ≥2 of first 5 dark; airy-minimal → all white except
`DARK_REQUIRED_BLOCK_TYPES` (dso-problem/dso-ai-feature/dso-stat-showcase);
energetic-visual → ≥1 of first 3 = accent (`dandy-green`); balanced → no-op.
Don't trust the LLM to honor density via prompt alone — enforce it in code.

**Why:** the api-server is a SEPARATE artifact and CANNOT import from lp-studio,
so `cleanFamilyName` and the bg-style keys are LOCAL MIRRORS in
`artifacts/api-server/src/routes/lp/generate-page.ts`. Keep them in sync with
the lp-studio originals (`font-catalog.ts`, `bg-styles.ts`).

**How to apply / landmine:** the font weight/style stripping set must keep
`display` and `text` OUT of it — they are legitimate family-name tokens
("Playfair Display", "DM Serif Display", "SF Pro Text"). Including them mangles
the family name to a bare token and the font silently falls back to Times.
Match lp-studio's `WEIGHT_STYLE_WORDS` exactly (it relies on a protected-full-
names list to keep "Display").
