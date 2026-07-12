import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLpPublicBase(micrositeDomain?: string | null): string {
  if (micrositeDomain) return `https://${micrositeDomain}`;
  return window.location.origin;
}

/**
 * Build the public URL for a published landing page.
 *
 * Published pages are resolved per-tenant BY HOSTNAME (see
 * api-server `findTenantByHost`): a page only loads on a host that maps to
 * its tenant — the tenant's microsite/custom domain, or its wildcard
 * subdomain `<slug>.lpstudio.ai`. The admin host the editor is browsing
 * (e.g. `app.lpstudio.ai` / `dev.lpstudio.ai`) has NO tenant binding, so a
 * link built off `window.location.origin` 404s with "Page Not Found".
 *
 * Resolution order:
 *   1. `micrositeDomain`  → `https://<micrositeDomain>/<slug>` (microsite serves at root)
 *   2. `tenantHost`       → `https://<tenantHost>/lp/<slug>` (custom domain or `<slug>.lpstudio.ai`)
 *   3. fallback           → `window.location.origin/lp/<slug>` (last resort; only correct
 *                            when already on a tenant host)
 *
 * Callers should pass the tenant's canonical host from `useAuth().user.tenantHost`
 * (set by `/auth/me`) so the link always points at a host that resolves the tenant.
 */
export function getLpPageUrl(
  slug: string,
  micrositeDomain?: string | null,
  tenantHost?: string | null,
): string {
  if (micrositeDomain) return `https://${micrositeDomain}/${slug}`;
  if (tenantHost) return `https://${tenantHost}/lp/${slug}`;
  return `${window.location.origin}/lp/${slug}`;
}

/**
 * Preview URL for an authenticated editor's in-app draft preview. Always
 * uses the **current admin host** (window.location.origin) — never the
 * tenant's microsite/custom domain — because the editor's session cookie
 * (`lp_sid`) is host-scoped to the admin host. A preview link pointing at
 * the microsite host would not carry the editor's session and the preview
 * route would 404 the draft.
 *
 * To share a draft with an unauthenticated reviewer, use the separate
 * review-token flow (lp_page_reviews) which appends `?reviewToken=...` and
 * works on any host, since token auth does not require a session.
 *
 * The `_micrositeDomain` parameter is intentionally accepted but ignored to
 * preserve call-site ergonomics with `getLpPageUrl`/`getLpPublicBase`.
 */
export function getLpPreviewUrl(slug: string, _micrositeDomain?: string | null): string {
  return `${window.location.origin}/preview/${slug}`;
}
