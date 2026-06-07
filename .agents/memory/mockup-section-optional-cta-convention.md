---
name: mockup-section optional CTA + brand-swap convention
description: How to author brand-swappable section mockups in mockup-sandbox so CTA is truly optional and theming is token-driven
---

When authoring section-block mockups under `artifacts/mockup-sandbox/src/components/mockups/**`:

- **Optional CTA must be externally controllable, not a hardcoded local.** Gate the CTA region on a prop, never `const showCta = true`. Two accepted shapes: a `showCta?: boolean` (default true) prop for the built-in-content sections (the existing 12 how-it-works/benefits/features), or a nullable `cta?: MockupCTAProps | null` (default object so it shows in preview) gated with `{cta && (…)}` for the content-driven social-proof sections. A reviewer flags `const showCta = true` as "CTA always rendered / not optional."

- **Brand-swappable = no hardcoded Tailwind color classes for theming.** Drive colors from token props (`accent`, `surface`, `ink`, `muted`, `border`, `accentText`, plus a dedicated `starColor` for ratings) via inline `style`. Avatar tints: `style={{ backgroundColor: \`${accent}1a\`, color: accent }}` (8-digit hex alpha works because defaults are 6-digit hex). Do NOT seed per-item `bg-blue-100`/`text-emerald-700`/`text-amber-400` data — those leak fixed colors and break token theming.

**Why:** the whole point of these mockups is brand-swappable section blocks with an optional CTA; hardcoded consts/colors silently defeat both contracts.

**How to apply:** new section mockups + any retrofit. After editing, typecheck `cd artifacts/mockup-sandbox && npx tsc --noEmit -p tsconfig.json`, restart the "Component Preview Server" workflow ONCE so the gitignored `.generated/mockup-components.ts` map rediscovers new files, then screenshot-verify (bust the external-screenshot cache with a `?v=N` query param — it caches per URL).
