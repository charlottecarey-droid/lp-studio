# LP Studio — Unified CTA Architecture (audit + plan)

## What the audit found
- The **renderer is already unified**: `CtaButton` + `EmailCaptureModal` support all action types
  (URL, anchor, open-form, Chili Piper / meeting router, video, email/mailto, no-CTA) and the
  forms + Chili Piper + Marketo handoff + tracking all flow through known fields.
- The **block props are fragmented**: ~145 blocks across 3 label namings (`ctaText`,
  `ctaLabel`, `primaryCtaText`), two action-mode types, and inconsistent secondary-CTA +
  button-style support. New blocks keep reinventing the shape.
- **No page-level CTA** exists today — only block-level.
- The **tenant default CTA** (Brand Settings) is read only at *generation* time, not resolved
  at runtime, so changing it doesn't update existing pages.
- **"Apply CTA to all"** works but is microsite-only and skips button colors + secondary CTAs.

## Target architecture
One `CtaConfig` shape + a resolver applying the hierarchy **tenant default → page override →
block override**, with a backward-compat shim mapping every legacy prop shape to it so
published pages and integrations keep working untouched.

- **Action types (shared, everywhere):** Link to URL · Anchor to section · Open form ·
  Open Chili Piper / meeting router · Download asset · Email · No CTA.
- **Resolver:** a block's effective CTA = block override (if set) over page override over
  tenant default. Blocks with no CTA config inherit the page CTA.
- **Source indicator:** every CTA editor shows where the value comes from — "Using tenant
  default" / "Using page override" / "Using block override".
- **Page-level CTA (net new):** define primary + secondary, action/destination, button style,
  form behavior, Chili Piper, external URL, anchor — once for the whole page.
- **Backward compat (non-negotiable):** a shim normalizes legacy block props on read; existing
  forms, Chili Piper/Marketo handoff, tracking, and published pages are preserved exactly.

## Phased rollout (safe order — read-path first)
1. **Foundation (this pass):** the `CtaConfig` type, the resolver, the legacy shim, the
   page-level CTA model + page settings UI, runtime reading of the tenant default, and the
   "source" indicator — wired through the shared `CtaButton` + the shared CTA panel section
   that most blocks already use. **No behavior change for existing pages**; integrations
   preserved via the shim.
2. **Panel rollout:** migrate the remaining bespoke block panels to the shared CTA section so
   every block exposes the identical config + source indicator.
3. **Storage/generation:** new/edited/generated blocks write the unified shape; old blocks keep
   working via the shim.
4. **Cleanup:** retire the shim once everything's migrated.

Risk is concentrated in storage/generation (phases 3) — kept last and behind the shim.
