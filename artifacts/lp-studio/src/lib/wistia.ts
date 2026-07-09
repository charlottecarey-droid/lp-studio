/**
 * Wistia link parsing shared by blocks that embed Wistia players.
 *
 * Tenants paste whatever link Wistia handed them — a share short-link
 * (wistia.com/s/<id>), a media page (wistia.com/medias/<id>), an embed URL
 * (fast.wistia.net/embed/iframe/<id>), a `?wvideo=<id>` share param, or the
 * bare hashed id — so this normalises all of those to the hashed media id
 * the iframe player needs.
 */

// Wistia hashed ids are short lowercase alphanumerics (typically 10 chars);
// the bounds are loose on purpose to survive format drift.
const HASHED_ID = /^[a-z0-9]{5,24}$/i;

export function extractWistiaId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (HASHED_ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // `?wvideo=<id>` share links can live on ANY host (they decorate a page
  // URL), so check the param before requiring a Wistia hostname.
  const wvideo = url.searchParams.get("wvideo");
  if (wvideo && HASHED_ID.test(wvideo)) return wvideo;

  if (!/(^|\.)wistia\.(com|net)$/i.test(url.hostname)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const id = last.replace(/\.(jsonp|json|html)$/i, "");
  return HASHED_ID.test(id) ? id : null;
}

/** Iframe player URL for a hashed media id (same endpoint the video
 *  testimonials block uses). */
export function wistiaIframeUrl(id: string, opts?: { autoPlay?: boolean }): string {
  return `https://fast.wistia.net/embed/iframe/${id}${opts?.autoPlay ? "?autoPlay=true" : ""}`;
}
