/**
 * Per-page color overrides applied to global ("linked") forms when they are
 * rendered inside the EmailCaptureModal triggered by an Inside-Dandy CTA
 * (or any other CTA on the page). Stored on the page record via the
 * `pageVariables` jsonb column under the reserved key below — that lets us
 * persist the overrides without a DB migration. The `__` prefix keeps it
 * out of any tenant-facing variable lists / `{{var}}` substitutions.
 */
export const LINKED_FORM_STYLE_KEY = "__linkedFormStyle";

export interface LinkedFormStyle {
  /** Form card background color. */
  cardBg?: string;
  /** Headline / label / body text color. */
  text?: string;
  /** Input border + focus-ring color. */
  border?: string;
  /** Submit button background color. */
  button?: string;
  /** Submit button text color. */
  buttonText?: string;
}

/** True when at least one color override is set. */
export function hasAnyLinkedFormStyle(s: LinkedFormStyle | null | undefined): s is LinkedFormStyle {
  if (!s) return false;
  return Boolean(s.cardBg || s.text || s.border || s.button || s.buttonText);
}

/** Parse the reserved key out of a pageVariables map. Returns null on miss / malformed JSON. */
export function readLinkedFormStyle(pageVars: Record<string, string> | null | undefined): LinkedFormStyle | null {
  const raw = pageVars?.[LINKED_FORM_STYLE_KEY];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const out: LinkedFormStyle = {};
    if (typeof o.cardBg === "string" && o.cardBg) out.cardBg = o.cardBg;
    if (typeof o.text === "string" && o.text) out.text = o.text;
    if (typeof o.border === "string" && o.border) out.border = o.border;
    if (typeof o.button === "string" && o.button) out.button = o.button;
    if (typeof o.buttonText === "string" && o.buttonText) out.buttonText = o.buttonText;
    return hasAnyLinkedFormStyle(out) ? out : null;
  } catch {
    return null;
  }
}

/** Write/clear the reserved key in a pageVariables map. Returns a new object. */
export function writeLinkedFormStyle(
  pageVars: Record<string, string> | null | undefined,
  style: LinkedFormStyle | null
): Record<string, string> {
  const next: Record<string, string> = { ...(pageVars ?? {}) };
  if (!style || !hasAnyLinkedFormStyle(style)) {
    delete next[LINKED_FORM_STYLE_KEY];
  } else {
    next[LINKED_FORM_STYLE_KEY] = JSON.stringify(style);
  }
  return next;
}

/** Strip reserved internal keys from a pageVariables map for any user-facing surface. */
export function stripReservedPageVars(pageVars: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(pageVars ?? {})) {
    if (k.startsWith("__")) continue;
    out[k] = v;
  }
  return out;
}
