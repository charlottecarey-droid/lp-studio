/**
 * Verbatim customer quotes (Oct 2026).
 *
 * A customer quote is a real person's words. On the Dandy fusion-dentures page
 * the model took an approved quote ("…that's a game-changer for a mobile
 * practice…"), saw "game-changer" on the banned-phrase list, and rewrote the
 * quote to comply. Nothing downstream would have caught it — the deterministic
 * safe-phrase swaps and the critique pass both treat a quote like any other
 * copy string.
 *
 * Three guards live here:
 *  1. `isQuoteField` — the one definition of "this string leaf is quoted
 *     speech", shared by the swap pass, the banned-phrase scanner and the
 *     critique merge so none of them ever edit a quote.
 *  2. `collectKnownQuotes` — every quote the generation is allowed to use
 *     (approved proof-point quotes, brand-imported testimonials, quotations on
 *     a user-supplied reference page).
 *  3. `restoreVerbatimQuotes` — after parsing, any quote field that is a
 *     paraphrase of a known quote is snapped back to the exact text (and
 *     missing attribution filled in). Fail-open: unknown quotes are left alone.
 */

const QUOTE_KEY_RE = /quote|testimonial|review|pullquote/i;
/** Quote-ish keys that are NOT the quote text (image, colour, layout…). */
const QUOTE_KEY_NON_TEXT_RE = /url|href|src|image|img|photo|avatar|logo|color|colour|icon|video|poster|style|layout|variant|mode|count|size|align|id$/i;
/** Generic copy keys that hold the quote when an attribution sibling exists. */
const QUOTE_BODY_KEY_RE = /^(text|body|content|message|copy|statement)$/i;
const ATTRIBUTION_KEY_RE = /^(author|authorName|attribution|speaker|person|byline|customerName)$/i;

export interface KnownQuote {
  text: string;
  author?: string;
  role?: string;
  company?: string;
  source: "proof_point" | "brand_testimonial" | "reference_page";
}

/**
 * True when the string stored under `key` is quoted speech. `siblings` is the
 * object that holds the key, so `{ text, author }` testimonial items count
 * even though their key is a plain "text".
 */
export function isQuoteField(key: string, siblings?: Record<string, unknown> | null): boolean {
  if (!key) return false;
  if (QUOTE_KEY_RE.test(key)) return !QUOTE_KEY_NON_TEXT_RE.test(key);
  if (QUOTE_BODY_KEY_RE.test(key) && siblings && typeof siblings === "object") {
    for (const [k, v] of Object.entries(siblings)) {
      if (ATTRIBUTION_KEY_RE.test(k) && typeof v === "string" && v.trim()) return true;
    }
  }
  return false;
}

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "our", "your", "are", "was", "were", "has", "have", "had",
  "its", "but", "not", "you", "they", "them", "from", "into", "than", "then", "there", "their", "what",
  "when", "where", "which", "who", "will", "would", "can", "could", "just", "also", "very", "more", "most",
  "all", "any", "some", "been", "being", "did", "does", "doing", "how", "out", "now", "too", "get", "got",
]);

/** Content tokens for fuzzy matching: lower-cased, punctuation-free, no stopwords. */
export function quoteTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[’‘`]/g, "'").split(/[^a-z0-9']+/)) {
    const t = raw.replace(/'/g, "");
    if (t.length < 3 || STOPWORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

export function normalizeQuoteText(text: string): string {
  return text
    .replace(/[“”„]/g, '"')
    .replace(/[’‘`]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .toLowerCase();
}

/** 0..1 — how much of the SHORTER quote's content vocabulary appears in the other. */
export function quoteSimilarity(a: string, b: string): { score: number; overlap: number } {
  const ta = quoteTokens(a);
  const tb = quoteTokens(b);
  if (ta.size === 0 || tb.size === 0) return { score: 0, overlap: 0 };
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return { score: overlap / Math.min(ta.size, tb.size), overlap };
}

/** Minimum content-token overlap ratio and absolute count for "this is that quote, reworded". */
export const QUOTE_MATCH_MIN_SCORE = 0.6;
export const QUOTE_MATCH_MIN_OVERLAP = 6;
/** Shorter strings are headlines, not quotes — never touched. */
const MIN_QUOTE_CHARS = 40;

const surname = (name?: string): string => {
  const parts = (name ?? "").toLowerCase().replace(/[^a-z\s'-]/g, " ").trim().split(/\s+/).filter((p) => p && !/^(dr|mr|mrs|ms|prof|md|dds|dmd)$/.test(p));
  return parts.length ? parts[parts.length - 1] : "";
};

/**
 * Pull quotations out of a reference page's markdown: markdown blockquotes
 * and sentence-length passages wrapped in quotation marks. Short fragments
 * (product names in quotes, "Learn more") are ignored.
 */
export function extractQuotesFromMarkdown(markdown: string, max = 24): KnownQuote[] {
  if (!markdown) return [];
  const out: KnownQuote[] = [];
  const seen = new Set<string>();
  const push = (text: string, attribution?: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length < MIN_QUOTE_CHARS || clean.length > 900) return;
    const key = normalizeQuoteText(clean);
    if (seen.has(key)) return;
    seen.add(key);
    const q: KnownQuote = { text: clean, source: "reference_page" };
    if (attribution) {
      const parts = attribution.split(/,\s*|\s+[-–—]\s+|\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
      if (parts[0]) q.author = parts[0];
      if (parts[1]) q.role = parts[1];
      if (parts[2]) q.company = parts[2];
    }
    out.push(q);
  };
  // Blockquotes: consecutive "> " lines form one quote; a following "— Name, Role" line is attribution.
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length && out.length < max; i++) {
    if (!/^\s*>\s?/.test(lines[i])) continue;
    const buf: string[] = [];
    while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
      buf.push(lines[i].replace(/^\s*>\s?/, ""));
      i++;
    }
    const text = buf.join(" ").replace(/^["“]|["”]$/g, "");
    const next = (lines[i] ?? "").trim();
    const attr = /^[-–—]\s*(.+)$/.exec(next);
    push(text, attr ? attr[1] : undefined);
  }
  // Inline quotation marks: “…” or "…" spanning at least a sentence.
  const re = /[“"]([^“”"]{40,900})[”"]\s*(?:[-–—]\s*([^\n]{2,120}))?/g;
  let m: RegExpExecArray | null;
  while (out.length < max && (m = re.exec(markdown))) {
    push(m[1], m[2]);
  }
  return out;
}

export interface CollectKnownQuotesInput {
  proofPoints?: Array<{ value: string; fact_kind?: string; approved_for_ai?: boolean; attribution_name?: string; attribution_title?: string; attribution_company?: string }>;
  brandTestimonials?: Array<{ quote?: string; author?: string; role?: string; approvedForAi?: boolean }> | null;
  referenceMarkdown?: string | null;
  /** Strict facts: only approved rows count. */
  strict?: boolean;
}

export function collectKnownQuotes(input: CollectKnownQuotesInput): KnownQuote[] {
  const out: KnownQuote[] = [];
  const seen = new Set<string>();
  const add = (q: KnownQuote) => {
    const text = q.text.replace(/\s+/g, " ").trim();
    if (text.length < MIN_QUOTE_CHARS) return;
    const key = normalizeQuoteText(text);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...q, text });
  };
  for (const p of input.proofPoints ?? []) {
    if ((p.fact_kind ?? "").toLowerCase() !== "quote") continue;
    if (input.strict && p.approved_for_ai === false) continue;
    add({
      text: p.value ?? "",
      author: p.attribution_name?.trim() || undefined,
      role: p.attribution_title?.trim() || undefined,
      company: p.attribution_company?.trim() || undefined,
      source: "proof_point",
    });
  }
  for (const t of input.brandTestimonials ?? []) {
    if (!t?.quote) continue;
    if (input.strict && t.approvedForAi === false) continue;
    add({ text: t.quote, author: t.author?.trim() || undefined, role: t.role?.trim() || undefined, source: "brand_testimonial" });
  }
  for (const q of extractQuotesFromMarkdown(input.referenceMarkdown ?? "")) add(q);
  return out;
}

export interface QuoteRestoration {
  blockId: string;
  field: string;
  from: string;
  to: string;
  source: KnownQuote["source"];
  score: number;
}

export interface RestoreVerbatimQuotesResult {
  restored: QuoteRestoration[];
  /** Quote fields that matched no known quote and were left as written. */
  unmatched: number;
}

const MAX_DEPTH = 8;

function findMatch(text: string, author: string, known: KnownQuote[]): { quote: KnownQuote; score: number } | null {
  let best: { quote: KnownQuote; score: number } | null = null;
  const sn = surname(author);
  for (const q of known) {
    const { score, overlap } = quoteSimilarity(text, q.text);
    // Same speaker named → accept a looser rewrite; otherwise demand a strong overlap.
    const sameSpeaker = !!sn && surname(q.author) === sn;
    const ok = sameSpeaker
      ? score >= 0.35 && overlap >= 4
      : score >= QUOTE_MATCH_MIN_SCORE && overlap >= QUOTE_MATCH_MIN_OVERLAP;
    if (!ok) continue;
    const ranked = score + (sameSpeaker ? 0.25 : 0);
    if (!best || ranked > best.score) best = { quote: q, score: ranked };
  }
  return best;
}

function speakerOf(siblings: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(siblings)) {
    if (ATTRIBUTION_KEY_RE.test(k) && typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/**
 * Snap paraphrased quotes back to their verbatim source. Mutates `blocks` in
 * place. Only quote fields (see isQuoteField) at least MIN_QUOTE_CHARS long
 * are considered; a field that already equals a known quote (ignoring curly
 * quotes / whitespace) is normalised to the exact text but not reported.
 */
export function restoreVerbatimQuotes(blocks: unknown[], known: KnownQuote[]): RestoreVerbatimQuotesResult {
  const result: RestoreVerbatimQuotesResult = { restored: [], unmatched: 0 };
  if (!Array.isArray(blocks) || blocks.length === 0 || known.length === 0) return result;

  const visit = (node: unknown, blockId: string, path: string, depth: number): void => {
    if (depth > MAX_DEPTH || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, blockId, `${path}[${i}]`, depth + 1));
      return;
    }
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v !== "string") {
        visit(v, blockId, path ? `${path}.${k}` : k, depth + 1);
        continue;
      }
      if (!isQuoteField(k, rec)) continue;
      const text = v.trim();
      if (text.length < MIN_QUOTE_CHARS) continue;
      const field = path ? `${path}.${k}` : k;
      const exact = known.find((q) => normalizeQuoteText(q.text) === normalizeQuoteText(text));
      if (exact) {
        if (exact.text !== v) rec[k] = exact.text;
        fillAttribution(rec, exact);
        continue;
      }
      const match = findMatch(text, speakerOf(rec), known);
      if (!match) {
        result.unmatched++;
        continue;
      }
      rec[k] = match.quote.text;
      fillAttribution(rec, match.quote);
      result.restored.push({ blockId, field, from: v, to: match.quote.text, source: match.quote.source, score: Number(match.score.toFixed(2)) });
    }
  };

  for (const block of blocks) {
    const b = block as { id?: unknown; props?: unknown };
    if (!b || typeof b !== "object" || !b.props) continue;
    visit(b.props, typeof b.id === "string" ? b.id : "", "", 0);
  }
  return result;
}

/** Overwrite the speaker's name/title with the source's when the source has
 *  them; a model-supplied value the source lacks (e.g. company) is kept. */
function fillAttribution(rec: Record<string, unknown>, q: KnownQuote): void {
  const set = (keyRe: RegExp, value?: string) => {
    if (!value) return;
    for (const k of Object.keys(rec)) {
      if (keyRe.test(k) && (typeof rec[k] === "string" || rec[k] == null)) {
        rec[k] = value;
        return;
      }
    }
  };
  set(/^(author|authorName|attribution|speaker|person|byline|customerName|name)$/i, q.author);
  set(/^(role|authorRole|title|authorTitle|position|jobTitle)$/i, q.role);
  set(/^(company|authorCompany|organization|practice|firm)$/i, q.company);
}
