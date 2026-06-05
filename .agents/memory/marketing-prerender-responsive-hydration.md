---
name: Marketing prerender responsive hydration
description: Why responsive JS on the lp-studio marketing site must default to desktop AND defer mobile-only state to post-mount.
---

The lp-studio marketing site (`src/marketing/**`) is prerendered to **desktop** HTML at build time and hydrated on the client. Any responsive behavior driven by JS must therefore satisfy TWO rules, not one:

1. **SSR-safe:** guard every `window`/`innerWidth` read with `typeof window !== "undefined"` and default to the desktop branch (no crash during prerender).
2. **Hydration-safe:** the component's *first* client render must match the prerendered desktop markup. Reading `window.innerWidth` inside a `useState` initializer satisfies rule 1 but VIOLATES rule 2 — on a mobile client the initial render diverges from the desktop HTML → hydration mismatch/flicker.

**How to apply:** for mobile-only state (e.g. suppressing an auto-opened modal on phones), initialize state to the deterministic desktop value, then apply the mobile override in a `useEffect(() => {...}, [])` after mount. Better still, prefer pure CSS/Tailwind responsive prefixes and scoped `<style>` media queries over JS — those don't touch the hydration boundary at all. JS breakpoint reads are a last resort (e.g. AssembleSceneV2's scroll mechanic).

**Why:** caught in the mobile-responsive fix pass — an IdentityWedge `useState` initializer that returned `null` on mobile (to suppress the pre-opened contact modal) was SSR-safe but would mismatch the desktop-prerendered HTML on phones.
