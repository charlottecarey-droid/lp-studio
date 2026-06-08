---
name: AI icon fields need a hard URL strip, not just a prompt rule
description: Why AI-generated icon fields render as tiny images, and the sanitize-layer guard that fixes it across all icon-image vectors.
---

# AI icon fields must be hard-stripped of URL values at sanitize

In AI page generation an `icon` field must ALWAYS be a Lucide name or a curated
key — never an image. On tenants with a large image library the model ignores the
prompt and drops a library/hallucinated URL into an icon field. The renderer's
`IconOrImage`/`isImageIcon` (lp-studio `src/lib/icon-value.tsx`) treats any value
starting with `http://`, `https://`, `/`, `data:`, or `blob:` as an IMAGE and
renders a tiny broken-looking `<img>`. Symptom: "icons are tiny random images".

**Rule:** the prompt rule + fill-gates are NOT enough — they only stop the SERVER
from POPULATING empty icon slots, never strip a URL the model already supplied.
The single chokepoint is a recursive pass (`stripUrlValuedIcons`) run inside
`sanitizeAIImageUrls` (generate-page.ts), as a final per-block step before
`b.props = props`. It walks props block-agnostically and blanks any icon-image
key whose string value looks like a URL (same test as `isImageIcon`). Curated
keys (`alert-triangle`) and Lucide names (`Shield`) survive because they aren't
URL-shaped.

**Why block-agnostic:** dozens of blocks carry icons under many array names
(items/perks/panels/promises/valueProps/steps/…); enumerating per-block is
brittle. Recursion covers them all incl. nested shapes.

**The non-obvious trap:** the renderable icon-image vectors are NOT all named
`icon`. Two blocks use other key names fed to `IconOrImage`:
`BlockFeaturesSpotlightCards` → `spotlightIcon`, `BlockDsoCaseFlow` → `iconName`.
The guard keys off a `URL_VALUED_ICON_KEYS` set — keep it in sync with every
`<IconOrImage value={…}>` callsite or a URL leaks through that one field.

**How to apply:** blank to `""` (not a forced Lucide name) so the renderer's own
`fallback` stays the single source of truth. When a new block routes a prop into
`IconOrImage` under a new key name, add that key to `URL_VALUED_ICON_KEYS`.
