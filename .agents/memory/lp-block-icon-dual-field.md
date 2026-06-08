---
name: LP block icon dual-field (Lucide name OR image URL)
description: How editable icon fields work in LP Studio section blocks and how to add new ones consistently.
---

LP Studio block icon fields are a single string that holds EITHER a Lucide icon
name (e.g. "Zap") OR an image reference (http(s)://, /, data:, blob:).

**Render:** use `IconOrImage` from `lib/icon-value.tsx` (helpers `isImageIcon`,
`resolveLucideIcon`). Never resolve Lucide directly in a renderer if the field is
user-editable — `isImageIcon(value)` decides `<img>` vs Lucide so a stored URL
renders as an image and a stored name still renders the icon (backward compatible).

**Edit:** use the `IconPicker` control (`components/IconPicker.tsx`) — a searchable
combobox of all ~1860 Lucide names (filtered to canonical PascalCase: drop
`*Icon` aliases, `Lucide*`, bare `Icon`) plus an embedded `ImagePicker` fallback.
One `onChange(string)` emits either a name or a URL.

**Why:** Task #1279 — new section blocks shipped with raw text inputs ("type a
Lucide name") and BlockDsoCaseFlow had hardcoded positional SVGs, so users could
not change icons or use their own imagery.

**How to apply:** for a new icon-bearing block, type the field as `icon?: string`,
render via `IconOrImage`, and wire `IconPicker` in its property panel.

**Case-flow exception:** `DsoCaseFlowStage` keeps a non-serializable
`icon?: React.ReactNode` for the built-in positional animated SVGs (applied via
`STAGE_ICONS[i]` only on component DEFAULT_STAGES). The editable, serializable
field is `iconName?: string`; the renderer prefers `iconName` → `stage.icon` →
`STAGE_ICONS[i]` → generic circle, so saved pages keep the premium default look
until the editor overrides a stage icon.
