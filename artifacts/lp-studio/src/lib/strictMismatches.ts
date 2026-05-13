/**
 * Task #254 — sessionStorage-backed handoff for "the most recent AI
 * generation produced unapproved stats". The /lp/generate-page endpoint
 * returns a `strictMismatches` array when Strict Facts Mode is on; the
 * create flow stashes it here keyed by the new page id, then the page
 * editor reads + clears it on first mount to render a one-time banner
 * that links the tenant back to Brand Settings.
 */

export interface StrictMismatch {
  blockId?: string;
  blockType?: string;
  fieldPath: string;
  value: string;
}

const KEY_PREFIX = "lp:strict-mismatches:";

function key(pageId: number | string): string {
  return `${KEY_PREFIX}${pageId}`;
}

export function rememberStrictMismatches(
  pageId: number | string,
  mismatches: unknown,
): void {
  if (!Array.isArray(mismatches) || mismatches.length === 0) return;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(pageId), JSON.stringify(mismatches));
  } catch {
    /* sessionStorage may be disabled — best-effort. */
  }
}

export function consumeStrictMismatches(pageId: number | string): StrictMismatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key(pageId));
    if (!raw) return [];
    window.sessionStorage.removeItem(key(pageId));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StrictMismatch[];
  } catch {
    return [];
  }
}
