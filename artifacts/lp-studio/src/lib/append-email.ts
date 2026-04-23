/**
 * Append an email value to a URL as a query parameter, handling both well-formed
 * absolute URLs and arbitrary fragments / mailto: / tel: / chilipiper:… prefixes.
 *
 * The `chilipiper:` prefix is preserved so that the BlockRenderer / page viewer
 * can still detect it and open the Chili Piper modal — the email is appended
 * to the inner URL.
 */
export function appendEmailToUrl(base: string | undefined, email: string): string {
  if (!base) return base ?? "";
  if (!email) return base;

  // Preserve special prefixes (chilipiper:URL, mailto:, tel:) — append to inner URL.
  if (base.startsWith("chilipiper:")) {
    const inner = base.slice("chilipiper:".length);
    return `chilipiper:${appendEmailToUrl(inner, email)}`;
  }

  try {
    const url = new URL(base);
    url.searchParams.set("email", email);
    return url.toString();
  } catch {
    // Not a fully-qualified URL (e.g. "/foo" or "#bar") — fall back to manual.
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}email=${encodeURIComponent(email)}`;
  }
}
