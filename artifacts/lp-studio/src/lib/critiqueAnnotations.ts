/**
 * Workstream C — sessionStorage-backed handoff for "the most recent AI
 * generation rewrote one or more low-quality blocks". The /lp/generate-page
 * endpoint returns a `critiqueAnnotations` array when the two-pass critique
 * rewrote the worst block copy; the create flow stashes it here keyed by the
 * new page id, then the page editor reads + clears it on first mount to render
 * a one-time banner telling the editor which blocks were polished.
 */

export interface CritiqueAnnotation {
  blockId: string;
  blockType: string;
  removedPhrases: string[];
  resolved: boolean;
}

const KEY_PREFIX = "lp:critique-annotations:";

function key(pageId: number | string): string {
  return `${KEY_PREFIX}${pageId}`;
}

export function rememberCritiqueAnnotations(
  pageId: number | string,
  annotations: unknown,
): void {
  if (!Array.isArray(annotations) || annotations.length === 0) return;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(pageId), JSON.stringify(annotations));
  } catch {
    /* sessionStorage may be disabled — best-effort. */
  }
}

export function consumeCritiqueAnnotations(pageId: number | string): CritiqueAnnotation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key(pageId));
    if (!raw) return [];
    window.sessionStorage.removeItem(key(pageId));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CritiqueAnnotation[];
  } catch {
    return [];
  }
}
