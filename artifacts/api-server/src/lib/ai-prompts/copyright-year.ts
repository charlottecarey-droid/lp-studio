/**
 * Footer copyright year (Oct 2026). The model writes whatever year it believes
 * it is — a page generated in October 2026 shipped "© 2023 Testa. All rights
 * reserved." Deterministic post-parse pass: every `copyrightText` string on a
 * block gets its four-digit years replaced with the current year. Runs before
 * the sentence-case normalizer (which stays the last copy mutation). Pure.
 */

const YEAR_RE = /\b(19\d{2}|20\d{2})\b/g;

/** Mutates `blocks` in place; returns how many copyrightText values changed. */
export function normalizeCopyrightYears(blocks: unknown[], year: number = new Date().getFullYear()): number {
  if (!Array.isArray(blocks)) return 0;
  const current = String(year);
  let fixed = 0;
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const props = (block as { props?: unknown }).props;
    if (!props || typeof props !== "object") continue;
    const rec = props as Record<string, unknown>;
    const text = rec.copyrightText;
    if (typeof text !== "string" || !text) continue;
    const next = text.replace(YEAR_RE, (y) => (y === current ? y : current));
    if (next !== text) {
      rec.copyrightText = next;
      fixed++;
    }
  }
  return fixed;
}
