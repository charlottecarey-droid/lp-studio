---
name: Tenant email logo absolute URL
description: Why tenant notification email logos must be normalized to an absolute URL, and against which host.
---

Tenant notification emails (lead_notification, comment, review_decision, form_followup) build a brand-derived shell whose header logo comes from the tenant brand config `logoUrl`. Uploaded brand logos are stored as ROOT-RELATIVE serve paths (`/api/storage/objects/uploads/...`), not absolute URLs.

**Rule:** the email logo HTML builder must normalize `logoUrl` to an absolute `http(s)` URL before deciding `<img>` vs text fallback. Resolve root-relative/bare-relative paths against the app's public host (`emailAssetHost()`: `LP_STUDIO_PUBLIC_HOST` → `REPLIT_DEV_DOMAIN` → `app.lpstudio.ai`, same precedence as `triggerPublishedRender`). Keep the brand-name text fallback only for genuinely empty/unusable values.

**Why:** a relative `<img src>` renders broken in every mail client (no document base to resolve against), and the old code only rendered the logo when `logoUrl` matched `^https?://`, so the common stored shape silently dropped to a bare-text header. The `/api/storage` serve route allows anonymous reads and the app host always proxies it, so that host is the canonical place an email recipient can fetch the asset.

**How to apply:** the normalizer lives in `artifacts/api-server/src/lib/tenantEmailShell.ts` (`toAbsoluteLogoUrl` / `buildBrandLogoHtml`), mirroring `injectPageMeta.ts`'s `toAbsoluteUrl`. This is the same recurring brand-asset gotcha as one-pager assets (root-relative URLs need base/host normalization before render). An explicit per-tenant `logo_html` shell override is raw author HTML and is NOT normalized by design; the platform fail-safe shell keeps the LP Studio logo.
