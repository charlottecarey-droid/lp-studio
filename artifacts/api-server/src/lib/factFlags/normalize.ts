// Task #1138 — normalization + fuzzy matching for the Strict Facts review flow.
//
// The goal is to avoid re-flagging a fact that already matches an approved one
// (the old equality check flagged every paraphrase). We match on the numeric
// KERNEL + entity for stats, and first-N words + attribution NAME for quotes.
import type { FactKind, QuoteAttribution } from "./types";

/** Number of leading words used to fingerprint a quote for fuzzy matching. */
export const QUOTE_KERNEL_WORDS = 8;

/** Collapse whitespace, drop most punctuation, lowercase. */
export function normalizeText(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/<[^>]+>/g, " ") // strip any HTML tags
    .replace(/[\u2018\u2019\u201c\u201d]/g, '"') // curly → straight
    .replace(/[^\p{L}\p{N}%+.\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a written-out unit to a canonical symbol so "47 percent" === "47%". */
function canonicalUnit(raw: string): string {
  const u = raw.toLowerCase().trim();
  if (u === "percent" || u === "pct" || u === "%") return "%";
  if (u === "plus" || u === "+") return "+";
  if (u === "k" || u === "thousand") return "k";
  if (u === "m" || u === "million" || u === "mm") return "m";
  if (u === "b" || u === "billion" || u === "bn") return "b";
  if (u === "x") return "x";
  return u
    .replace(/s$/, "") // singularize: customers → customer
    .trim();
}

/** Numeric kernel of a stat: the digits (commas/decimals stripped to a bare
 *  number) plus the canonical unit/entity word, e.g. "47%", "3000 customer",
 *  "2.5x". Returns "" when there is no number. */
export function statKernel(value: string): string {
  const text = normalizeText(value);
  const m = text.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(%|\+|x\b|k\b|m\b|b\b|percent|plus|thousand|million|billion|customers?|patients?|practices?|locations?|users?|members?|reviews?|stars?|days?|hours?|minutes?|years?|months?|weeks?)?/i,
  );
  if (!m) return "";
  const num = m[1].replace(/,/g, "");
  const unit = m[2] ? canonicalUnit(m[2]) : "";
  return `${num}${unit ? ` ${unit}` : ""}`.trim();
}

/** First-N-words fingerprint of a quote body (HTML/punctuation stripped). */
export function quoteKernel(body: string): string {
  const words = normalizeText(body).split(" ").filter(Boolean);
  return words.slice(0, QUOTE_KERNEL_WORDS).join(" ");
}

/** Build the normalized form persisted on a flag row (its fuzzy-match key). */
export function normalizedFormFor(
  factKind: FactKind,
  text: string,
  attribution?: QuoteAttribution,
): string {
  if (factKind === "stat") return statKernel(text) || normalizeText(text);
  if (factKind === "quote") {
    const name = attribution?.name ? normalizeText(attribution.name) : "";
    return `${quoteKernel(text)}|${name}`;
  }
  return normalizeText(text);
}
