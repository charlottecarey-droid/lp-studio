/**
 * Validate that a URL uses a safe protocol (http/https/mailto).
 * Prevents javascript:, data:, and other dangerous protocols.
 */
export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  // Allow relative URLs
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  // Allow http, https, mailto, tel, and urn (tenants opt into urn for
  // vanity links pointing at named-resource handlers — see admin
  // vanity-link validator in routes/admin.ts).
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("urn:")
  ) return true;
  // Block everything else (javascript:, data:, vbscript:, etc.)
  // Also allow protocol-relative URLs
  if (trimmed.startsWith("//")) return true;
  // If no protocol, assume it's a relative URL or bare domain
  if (!trimmed.includes(":")) return true;
  return false;
}

/**
 * Normalize a user-entered URL for use as an href.
 * - Leaves http(s)/mailto/tel/anchors/relative paths alone.
 * - Prepends "https://" to bare domains (e.g. "meetdandy.com/pricing")
 *   so the browser doesn't treat them as relative paths.
 * Returns "#" for empty/invalid input so the link is still clickable but harmless.
 */
export function normalizeHref(url: string | undefined | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("//") ||
    lower.startsWith("/") ||
    lower.startsWith("#") ||
    lower.startsWith("?")
  ) {
    return trimmed;
  }
  // If it looks like a domain (contains a dot before any slash), assume https://
  const firstSlash = trimmed.indexOf("/");
  const hostPart = firstSlash === -1 ? trimmed : trimmed.slice(0, firstSlash);
  if (hostPart.includes(".")) {
    return `https://${trimmed}`;
  }
  // Otherwise treat as relative path (rare; preserve original)
  return trimmed;
}

/**
 * Safe navigation helper. Only navigates if URL passes protocol validation.
 */
export function safeNavigate(url: string | undefined | null, target?: string): void {
  if (!url || !isSafeUrl(url)) {
    console.warn("Blocked navigation to unsafe URL:", url);
    return;
  }
  if (target === "_blank") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = url;
  }
}
