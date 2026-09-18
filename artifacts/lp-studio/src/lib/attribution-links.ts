/**
 * Attribution forwarding for outbound links on published pages.
 *
 * A published page is reached with `?utm_source=...&gclid=...`, but every CTA
 * on it links to a bare URL — so a visitor who clicks through to the main site
 * arrives with the query string gone, and whatever form they convert on there
 * sees no attribution. (Cookie-based capture can paper over this, but only
 * when the destination shares a cookie domain and the tag fired before
 * consent.) Forwarding the params on the link itself is the durable fix.
 *
 * Scope is deliberately narrow: only destinations on the SAME REGISTRABLE
 * DOMAIN as the page itself. Decorating arbitrary external links would leak a
 * visitor's campaign attribution to third parties, which is both a privacy
 * problem and noise in their analytics.
 */
import { readPersistedParam } from "./global-form-submission";

/** Mirrors FORWARDED_PARAMS in api-server's embed route. */
const FORWARDED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_ad_id",
  "gclid",
  "fbclid",
  "gbraid",
  "wbraid",
  "msclkid",
];

/**
 * Registrable-domain approximation: the last two labels of a hostname
 * ("lp.meetdandy.com" and "www.meetdandy.com" both collapse to
 * "meetdandy.com"). Deliberately not PSL-aware — a wrong answer here only ever
 * means we decline to forward, never that we forward somewhere we shouldn't,
 * because a mismatch is treated as third-party.
 */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split(".");
  return labels.length <= 2 ? labels.join(".") : labels.slice(-2).join(".");
}

/**
 * Append the given attribution params to `href` when it points at the same
 * registrable domain as `pageUrl`. Idempotent, and never overwrites a param
 * the link already carries — an author who hand-wrote `?utm_source=footer`
 * meant it.
 *
 * Returns the original string when the link is not eligible, so callers can
 * cheaply skip a no-op.
 */
export function decorateHref(
  href: string,
  pageUrl: string,
  params: Record<string, string>,
): string {
  if (!href) return href;
  // Same-document anchors (#cta) resolve to the current page, which would
  // otherwise pass the same-domain check and come back rewritten as an
  // absolute URL — turning every in-page jump into a full navigation.
  if (href.startsWith("#")) return href;
  // Anything that is not an http(s) destination: in-page anchors, mailto:,
  // tel:, javascript:, blobs. `new URL` also throws on genuinely malformed
  // hrefs, which we leave exactly as the author wrote them.
  let target: URL;
  let page: URL;
  try {
    page = new URL(pageUrl);
    target = new URL(href, pageUrl);
  } catch {
    return href;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return href;
  if (registrableDomain(target.hostname) !== registrableDomain(page.hostname)) return href;

  let changed = false;
  for (const [key, value] of Object.entries(params)) {
    if (!value || target.searchParams.has(key)) continue;
    target.searchParams.set(key, value);
    changed = true;
  }
  if (!changed) return href;
  // Keep relative hrefs relative so client-side routing is unaffected by the
  // rewrite. `target.pathname` is already resolved, so a root-relative result
  // is equivalent to the author's relative one.
  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
  return isAbsolute ? target.toString() : `${target.pathname}${target.search}${target.hash}`;
}

/** The attribution params currently in play, from the URL or the first-hit copy. */
export function currentAttributionParams(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const param of FORWARDED_PARAMS) {
    const value = readPersistedParam(param);
    if (value) out[param] = value;
  }
  return out;
}

/**
 * Install a capture-phase listener that decorates an anchor's href at the
 * moment it is activated. Done at click time rather than on mount because
 * blocks render and re-render independently — a one-shot pass over the DOM
 * would miss everything added later, and a MutationObserver over a whole
 * landing page costs more than this.
 *
 * Returns a teardown function.
 */
export function installAttributionLinkForwarding(): () => void {
  if (typeof document === "undefined") return () => {};

  const onActivate = (event: Event) => {
    const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    // Leave downloads alone: the params would just corrupt the filename.
    if (anchor.hasAttribute("download")) return;
    const params = currentAttributionParams();
    if (!Object.keys(params).length) return;
    const raw = anchor.getAttribute("href") ?? "";
    const next = decorateHref(raw, window.location.href, params);
    if (next !== raw) anchor.setAttribute("href", next);
  };

  // `auxclick` covers middle-click / open-in-new-tab, which never fires click.
  document.addEventListener("click", onActivate, true);
  document.addEventListener("auxclick", onActivate, true);
  return () => {
    document.removeEventListener("click", onActivate, true);
    document.removeEventListener("auxclick", onActivate, true);
  };
}
