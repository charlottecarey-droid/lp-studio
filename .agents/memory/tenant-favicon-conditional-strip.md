---
name: Tenant favicon conditional strip
description: Why LP Studio tenant favicons must be injected conditionally so the default LP Studio favicon survives when unset.
---

Tenants can set a browser-tab favicon (`faviconUrl` on BrandConfig, stored in
the `brand_settings` JSONB). The default LP Studio favicon ships baked into the
base `index.html`.

**Rule:** strip-and-inject the tenant favicon ONLY when `faviconUrl` is a
non-empty string, on both the published R2 snapshot path (injectPageMeta, driven
by a per-tenant brand_settings lookup) and the live SPA view (favicon swap keyed
to brand state, restored on cleanup).

**Why:** if icon links were added to `MANAGED_TAG_PATTERNS` — which strips
unconditionally on every render — an unset tenant's baked-in default favicon
would be wiped, leaving no icon at all. Gating the strip on a set value
preserves the default fallback. Same reason the live override restores the
original hrefs on unmount, so the admin shell keeps the LP Studio icon.

**How to apply:** any new managed `<link rel=icon>`-style tag with a default
fallback must be conditional, not added to the unconditional managed-strip list.
