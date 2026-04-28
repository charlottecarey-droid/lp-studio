import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLpPublicBase(micrositeDomain?: string | null): string {
  if (micrositeDomain) return `https://${micrositeDomain}`;
  return window.location.origin;
}

export function getLpPageUrl(slug: string, micrositeDomain?: string | null): string {
  if (micrositeDomain) return `https://${micrositeDomain}/${slug}`;
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
