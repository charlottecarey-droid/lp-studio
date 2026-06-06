---
name: Builder "Preview as brand" display-only
description: Superadmin brand-preview in the LP Studio builder must stay display-only and fail closed.
---

Superadmins editing a brand-neutral page (global template OR block-catalog scratch page) can render the builder canvas as any tenant's brand via a "Preview as brand" dropdown.

**Rule:** the previewed brand is fed ONLY to the canvas renderer (an `effectiveBrand = previewBrand ?? brand`); the real tenant `brand` must keep driving every save path, the PropertyPanel, and the SeoGeoPanel. Templates keep their brand *variables*; block-catalog `default_props` stay untouched.

**Why:** the whole point is to inspect cross-brand contrast/font/gated-asset issues without mutating the neutral artifact. Saves are inherently safe because page save never writes brand and brand is saved by a separate `saveBrandConfig` call — but the canvas/save split must be preserved deliberately if either path is refactored.

**How to apply:**
- Backend `GET /lp/brand?previewTenantId=` honors the param ONLY for app-superadmins (mirror `isAppSuperadmin`: root email OR `app_users.role`); everyone else silently falls through to host/auth/slug resolution so it can't enumerate other tenants' brand JSONB. Fail closed.
- Control gating: `superadmin && (catalogMode || isGlobalTemplate)`. No control + no behavior change for normal tenant editing or non-superadmins.
- No persistence of the choice across sessions.
