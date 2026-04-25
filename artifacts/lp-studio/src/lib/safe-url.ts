/**
 * Validate that a URL uses a safe protocol (http/https/mailto).
 * Prevents javascript:, data:, and other dangerous protocols.
 */
export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  // Allow relative URLs
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  // Allow http, https, mailto
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("mailto:")) return true;
  // Block everything else (javascript:, data:, vbscript:, etc.)
  // Also allow protocol-relative URLs
  if (trimmed.startsWith("//")) return true;
  // If no protocol, assume it's a relative URL or bare domain
  if (!trimmed.includes(":")) return true;
  return false;
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
