/**
 * Wistia link parsing shared by blocks that embed Wistia players.
 *
 * Tenants paste whatever link Wistia handed them — a media page
 * (wistia.com/medias/<id>), an embed URL (fast.wistia.net/embed/iframe/<id>),
 * a `?wvideo=<id>` share param, or the bare hashed id — so `extractWistiaId`
 * normalises all of those to the hashed media id the iframe player needs.
 *
 * Share short-links (wistia.com/s/<token>) are the exception: the token is
 * NOT the media id (verified against a real /s/ link — embedding the token
 * 404s inside the player). They must be resolved through Wistia's oEmbed API
 * (CORS `*`, so callable from the browser) via `resolveWistiaShareLink`.
 */

// Wistia hashed ids are short lowercase alphanumerics (typically 10 chars);
// the bounds are loose on purpose to survive format drift.
const HASHED_ID = /^[a-z0-9]{5,24}$/i;

function wistiaHost(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return /(^|\.)wistia\.(com|net)$/i.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/** True for wistia.com/s/<token> share short-links, whose token must be
 *  resolved to a media id via oEmbed before embedding. */
export function isWistiaShareLink(input: string): boolean {
  const url = wistiaHost(input);
  return url != null && /^\/s\//i.test(url.pathname);
}

export function extractWistiaId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (HASHED_ID.test(raw)) return raw;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  // `?wvideo=<id>` share links can live on ANY host (they decorate a page
  // URL), so check the param before requiring a Wistia hostname.
  const wvideo = parsed.searchParams.get("wvideo");
  if (wvideo && HASHED_ID.test(wvideo)) return wvideo;

  if (!/(^|\.)wistia\.(com|net)$/i.test(parsed.hostname)) return null;
  // /s/ share tokens LOOK like ids but aren't — resolveWistiaShareLink owns those.
  if (/^\/s\//i.test(parsed.pathname)) return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const id = last.replace(/\.(jsonp|json|html)$/i, "");
  return HASHED_ID.test(id) ? id : null;
}

/** Pull the hashed media id out of an oEmbed response's `html` iframe embed.
 *  PURE + exported for tests. */
export function wistiaIdFromOembedHtml(html: string): string | null {
  const m = /embed\/iframe\/([a-z0-9]{5,24})/i.exec(html);
  return m ? m[1] : null;
}

/** Resolve a wistia.com/s/<token> share link to its hashed media id via the
 *  public oEmbed API (Access-Control-Allow-Origin: *). Null on any failure —
 *  callers fall back to their no-video rendering. */
export async function resolveWistiaShareLink(shareUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://fast.wistia.com/oembed?url=${encodeURIComponent(shareUrl.trim())}`,
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { html?: unknown };
    return typeof data.html === "string" ? wistiaIdFromOembedHtml(data.html) : null;
  } catch {
    return null;
  }
}

/** Iframe player URL for a hashed media id (same endpoint the video
 *  testimonials block uses). */
export function wistiaIframeUrl(id: string, opts?: { autoPlay?: boolean }): string {
  return `https://fast.wistia.net/embed/iframe/${id}${opts?.autoPlay ? "?autoPlay=true" : ""}`;
}
