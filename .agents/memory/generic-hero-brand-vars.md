---
name: Generic hero brand-var discipline
description: What "all colors via brand vars" really means when graduating mockup heroes into the generic block library, and the panel modal-config gate trap.
---

When graduating mockup heroes into the lp-studio block library as GENERIC/brand-swappable blocks, the "all colors/fonts via brand vars" requirement is satisfied when **brand-meaningful** colors route through `var(--brand-accent|primary|font-display|body, <literal-fallback>)`. It does NOT require eliminating every literal.

**Acceptable literals (do not "fix"):**
- A hero's dark/light theme `bgColor`/`textColor` — these are overridable per-block props with sensible literal fallbacks (e.g. cinematic stays dark by identity; setting a light brand bg should not flip it).
- Neutral structural colors that work across any brand: white-on-dark text (`text-white`, `rgba(255,255,255,x)`), glass panels, scrims/overlays (`rgba(0,0,0,x)`), neutral white input pills.
- Literal hex used only as the *fallback* arg inside `var(--brand-accent, #XXXXXX)`.

**Real leaks to hunt (these ARE bugs):**
- Tailwind brand-color utility classes: `text-purple-200`, `selection:bg-purple-500/30`, `from-indigo-500`, etc. Grep `(text|bg|border|from|to|via|ring|shadow)-(purple|indigo|violet|blue|...)-[0-9]`.
- Hardcoded brand-tinted `rgba()` glows/shadows (e.g. an indigo `rgba(99,102,241,0.5)` dot glow). Replace with `color-mix(in srgb, ${accent} N%, transparent)`.
- For `::selection` you can't use inline style; inject a scoped rule in the block's `<style>{`...`}` template literal using `${accent}`.

**Why:** an architect review will broadly flag "every hero hardcodes colors" — most are the acceptable category above. Verify each against this split before mass-rewriting; only the leak category breaks brand-swap.

**Panel modal-config gate trap:** a hero with BOTH a CTA action selector AND an email-capture `submitMode` selector must show `CtaButtonModalConfigSection` when ANY of `ctaAction`/`ctaSecondaryAction`/`submitMode` is `modal-form|modal-chilipiper`. Easy to forget `submitMode` in the gate (renderer still consumes the modal config), leaving that required path unconfigurable in the builder.
