/**
 * The builder's stale-save guard, client side.
 *
 * The server sends a fingerprint of a page's saved blocks (`blocksVersion`)
 * with the page and with every save. The builder sends back the one it last
 * saw (`baseBlocksVersion`); when the saved blocks have changed since — a
 * second tab, a teammate, the hub's pop-up, a direct fix — the server refuses
 * the save (409 page_changed) instead of quietly putting old content back.
 */
const API_BASE = "/api";

const versions = new Map<string, string>();

/** Remember the fingerprint of the page as the server has it now. */
export function setPageVersion(pageId: string | number, version: unknown): void {
  if (typeof version === "string" && version) versions.set(String(pageId), version);
}

export function getPageVersion(pageId: string | number): string | undefined {
  return versions.get(String(pageId));
}

/**
 * Something in this window just saved part of the page itself (the hub's
 * pop-up, for example) and the builder took the same change into its own copy:
 * take the server's new fingerprint so the builder's next save isn't refused.
 */
export async function refreshPageVersion(pageId: string | number): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/lp/pages/${pageId}`);
    if (!res.ok) return;
    const p = (await res.json()) as { blocksVersion?: string };
    setPageVersion(pageId, p.blocksVersion);
  } catch {
    // Leave the old one: the worst case is a "changed since you opened it" prompt.
  }
}

/** The save was refused because the page changed since it was loaded. */
export class PageChangedError extends Error {
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
  constructor(info: { updatedAt?: string | null; updatedBy?: string | null }) {
    super("This page was changed since you opened it.");
    this.name = "PageChangedError";
    this.updatedAt = info.updatedAt ?? null;
    this.updatedBy = info.updatedBy ?? null;
  }
}

/** Read a refused save's response: a PageChangedError for page_changed, null for anything else. */
export async function pageChangedFrom(res: Response): Promise<PageChangedError | null> {
  if (res.status !== 409) return null;
  try {
    const body = (await res.clone().json()) as { code?: string; updatedAt?: string; updatedBy?: string };
    return body.code === "page_changed" ? new PageChangedError(body) : null;
  } catch {
    return null;
  }
}
