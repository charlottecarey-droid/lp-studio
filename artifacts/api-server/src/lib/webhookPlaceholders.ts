/**
 * Webhook tools like Apollo's workflow "Send webhook" step let users build the
 * JSON body by hand. If the field labels are typed as text instead of inserted
 * as dynamic variables, the provider sends the label itself, e.g.
 * `"first_name": "<Contact › First name>"`. Those strings must never be stored
 * as visitor data — they fill the sales console with fake signals.
 */

/** A whole value that is just `<...>` (optionally `{{...}}`), never real data. */
const PLACEHOLDER_RE = /^\s*(?:<[^<>]*>|\{\{[^{}]*\}\})\s*$/;

export function isUnresolvedPlaceholder(value: unknown): boolean {
  return typeof value === "string" && PLACEHOLDER_RE.test(value);
}

/**
 * Deep-copies `input`, replacing every placeholder string with `undefined`.
 * Returns the cleaned value and how many placeholders were removed.
 */
export function stripUnresolvedPlaceholders<T>(input: T): { value: T; stripped: number } {
  let stripped = 0;
  const walk = (v: unknown): unknown => {
    if (isUnresolvedPlaceholder(v)) {
      stripped++;
      return undefined;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, child] of Object.entries(v)) {
        const cleaned = walk(child);
        if (cleaned !== undefined) out[k] = cleaned;
      }
      return out;
    }
    return v;
  };
  const value = walk(input) as T;
  return { value, stripped };
}
