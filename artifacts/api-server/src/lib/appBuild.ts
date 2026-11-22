/**
 * Which build of the lp-studio app a page runs.
 *
 * WHY
 * A prerendered snapshot (triggerPublishedRender.ts) is the app's HTML
 * shell frozen at publish time, so it loads the hashed entry script of the
 * build that was live THEN (`/assets/index-<hash>.js`). Old hashed assets
 * keep being served after a deploy, so a snapshot quietly keeps running the
 * old code until the page is published again.
 *
 * For an ordinary landing page that is fine (and re-baking the whole fleet
 * on every deploy would be expensive — see renderVersion.ts). For an
 * app-like page — a Partner Hub, which reads live data and whose sections
 * the team keeps adding — running stale code is visible: a section saved
 * with the new code is drawn by the old one (Nov 2026: a new "Important
 * links" section showed as an empty card until the hub was re-saved).
 *
 * So snapshots are stamped with the entry script they load (`app-build`
 * R2 metadata), and the post-deploy reconcile re-bakes the app-like pages
 * whose stamp differs from the build the site serves now.
 */
import { resolveLpStudioBaseUrl } from "./prerenderLpPage";

/** The entry script a page loads, e.g. "index-BbSrA3-X.js". Null when the HTML has none. */
export function extractAppBuildId(html: string): string | null {
  const m = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  return m ? m[1] : null;
}

const CACHE_MS = 5 * 60 * 1000;
let cached: { id: string | null; at: number } | null = null;

/**
 * The build the site serves right now: the entry script in the app shell at
 * the same address the prerender renders from. Cached briefly; null when it
 * can't be read (the reconcile then leaves app-build alone rather than
 * re-baking on a guess).
 */
export async function getCurrentAppBuildId(opts: { fetchImpl?: typeof fetch; now?: number } = {}): Promise<string | null> {
  const now = opts.now ?? Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.id;
  const doFetch = opts.fetchImpl ?? fetch;
  let id: string | null = null;
  try {
    const res = await doFetch(`${resolveLpStudioBaseUrl()}/`, { signal: AbortSignal.timeout(8000), headers: { "cache-control": "no-cache" } });
    if (res.ok) id = extractAppBuildId(await res.text());
  } catch {
    id = null;
  }
  // Only remember a real answer: a failed read is retried next time.
  if (id) cached = { id, at: now };
  return id;
}

/** Tests only. */
export function resetAppBuildCacheForTests(): void {
  cached = null;
}
