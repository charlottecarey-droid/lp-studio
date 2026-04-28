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
 * Preview URL for a draft (or published) page. Always contains "/preview/"
 * in the path — that's how visitors can tell at a glance they're not on the
 * live page. Prefers the tenant's microsite domain so editors can verify the
 * preview against the same host visitors will see, but falls back to the
 * admin host so it works inside development environments without a tenant
 * domain configured.
 */
export function getLpPreviewUrl(slug: string, micrositeDomain?: string | null): string {
  if (micrositeDomain) return `https://${micrositeDomain}/preview/${slug}`;
  return `${window.location.origin}/preview/${slug}`;
}
