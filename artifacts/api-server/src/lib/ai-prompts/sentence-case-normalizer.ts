/**
 * Deterministic sentence-case normalizer for generated heading copy.
 *
 * The microsite + page generators instruct the model (repeatedly) to write
 * headings in SENTENCE CASE — "only the first word + proper nouns + acronyms
 * get capitals" — but gpt-4o ignores this and Title-Cases nearly every heading
 * ("Streamline Your Dental Practice Workflow"). Instructions are not
 * enforcement. This module IS the enforcement: a pure, deterministic post-pass
 * that rewrites Title-Cased heading strings into sentence case WITHOUT calling
 * the model, so the rule holds every time regardless of what the model returns.
 *
 * Safety posture (mirrors the critique pass's structural protections):
 *  - Only HEADING-LIKE string fields are touched (headline/title/eyebrow/label/
 *    question/button labels…). Body paragraphs, person names, authors, URLs,
 *    colors, image paths, and layout enums are never modified.
 *  - A string is rewritten ONLY when it is actually detected as Title Case, so
 *    copy already in sentence case is left exactly as-is.
 *  - Proper nouns (brand name, product names, the account name) are protected as
 *    whole PHRASES, and acronyms (DSO, ROI, AI) + mixed-case tokens (iOS,
 *    McKesson) are preserved, so de-title-casing never mangles a real name.
 *  - Inside a person/author card a job `title`/`role`/`name` is left untouched.
 *  - Fail-safe: any unexpected input is returned unchanged.
 *
 * Known, accepted limitation: a multi-word proper noun that is NOT in the
 * provided allowlist (e.g. a third-party "Cleveland Clinic" mentioned in a
 * heading) will be lowercased like any other Title-Cased phrase. The brand's
 * own names + the account name are protected; arbitrary external names are not.
 */

/** Curated acronyms that are NEVER ordinary English words, so forcing their
 *  canonical casing is safe (excludes ambiguous ones like US/UK/IT/HR). */
const ACRONYM_CANONICAL: Record<string, string> = {
  ai: "AI", api: "API", roi: "ROI", roas: "ROAS", dso: "DSO", crm: "CRM",
  sla: "SLA", hipaa: "HIPAA", soc: "SOC", seo: "SEO", cro: "CRO", b2b: "B2B",
  b2c: "B2C", arr: "ARR", mrr: "MRR", gtm: "GTM", kpi: "KPI", kpis: "KPIs",
  nps: "NPS", rfp: "RFP", ehr: "EHR", emr: "EMR", saas: "SaaS", ltv: "LTV",
  cac: "CAC", sdk: "SDK", faq: "FAQ", faqs: "FAQs",
};

/** Minor words ignored when DETECTING Title Case (articles, conjunctions, short
 *  prepositions) — they are routinely lowercased even in Title-Cased copy, so
 *  counting them would mask a genuine Title Case heading. */
const STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
  "nor", "of", "off", "on", "onto", "or", "out", "over", "per", "the", "to",
  "up", "upon", "via", "vs", "with", "yet", "so", "than",
]);

/** Heading-like field whose value should read as sentence case. */
function isHeadingKey(key: string): boolean {
  const k = key.toLowerCase();
  // headline/heading/title/subtitle/tagline/eyebrow/kicker and prefixed
  // variants (subHeadline, sectionTitle, ctaHeadline, stepTitle, cardTitle…).
  if (/(headline|heading|title|subtitle|tagline|eyebrow|kicker)$/.test(k)) return true;
  // FAQ question, stat / feature label.
  if (k === "question" || k === "label") return true;
  // Visible button / CTA / link text (never the URL — url/href keys never match).
  if (/(label|text)$/.test(k) && /(cta|button|link|step|tab|card)/.test(k)) return true;
  return false;
}

/** Keys whose presence marks an object as a person / author card. */
const PERSON_OBJECT_KEYS = new Set(["name", "author", "authorname", "byline"]);
/** Fields not to de-title-case inside a person card (their name or job title). */
const PERSON_FIELD_KEYS = new Set(["title", "role", "label", "name", "jobtitle"]);

const MASK_OPEN = "\uE000";
const MASK_CLOSE = "\uE001";

interface ProtectedPhrase {
  lower: string;
  canonical: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Build the protected-phrase list from the caller's proper nouns, longest
 *  first so "Dandy Lab" masks before "Dandy" / the common word "lab". Acronyms
 *  are deliberately NOT masked here (convertWord handles them per-word) so a
 *  hyphenated compound like "AI-Powered" still lowercases its second segment. */
function buildPhrases(properNouns: string[]): ProtectedPhrase[] {
  const map = new Map<string, string>();
  for (const raw of properNouns) {
    if (typeof raw !== "string") continue;
    const canonical = raw.trim();
    if (canonical.length < 2 || canonical.length > 60) continue;
    const lower = canonical.toLowerCase();
    if (!map.has(lower)) map.set(lower, canonical);
  }
  return [...map.entries()]
    .map(([lower, canonical]) => ({ lower, canonical }))
    .sort((a, b) => b.lower.length - a.lower.length);
}

/** Replace each protected phrase with an acronym-shaped placeholder that the
 *  per-word converter leaves untouched, recording its canonical casing. */
function maskPhrases(input: string, phrases: ProtectedPhrase[]): { masked: string; restores: string[] } {
  let masked = input;
  const restores: string[] = [];
  for (const { lower, canonical } of phrases) {
    if (!masked.toLowerCase().includes(lower)) continue;
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escapeRegExp(lower)})(?=$|[^\\p{L}\\p{N}])`,
      "giu",
    );
    masked = masked.replace(re, (_full, pre: string) => {
      const id = restores.length;
      restores.push(canonical);
      return `${pre}${MASK_OPEN}${id}${MASK_CLOSE}`;
    });
  }
  return { masked, restores };
}

function restorePhrases(text: string, restores: string[]): string {
  if (restores.length === 0) return text;
  return text.replace(
    new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, "g"),
    (_m, id: string) => restores[Number(id)] ?? "",
  );
}

function countWords(s: string): number {
  return (s.match(/\p{L}[\p{L}\p{N}'’-]*/gu) ?? []).length;
}

/** True when the (already-masked) string looks Title-Cased: most eligible
 *  non-first content words start with a capital. */
function looksTitleCased(masked: string): boolean {
  const words = masked.match(/\p{L}[\p{L}\p{N}'’-]*|\p{N}[\p{L}\p{N}'’-]*/gu) ?? [];
  if (words.length < 2) return false;
  let eligible = 0;
  let capitalized = 0;
  for (let i = 0; i < words.length; i++) {
    if (i === 0) continue; // first word is capitalized in both cases
    const w = words[i];
    const lw = w.toLowerCase();
    if (/^[\p{Lu}\p{N}&]{2,}$/u.test(w)) continue; // acronym
    if (/^\p{N}/u.test(w)) continue; // number / masked placeholder id
    if (/\p{Lu}/u.test(w.slice(1))) continue; // mixed/internal caps
    const isCap = /^\p{Lu}/u.test(w);
    if (STOPWORDS.has(lw)) {
      // A capitalized minor word ("By", "And") is positive evidence of Title
      // Case; a lowercase one is neutral (minor words are routinely lowercased
      // even in Title Case), so it neither helps nor penalizes the score.
      if (isCap) {
        eligible++;
        capitalized++;
      }
      continue;
    }
    eligible++;
    if (isCap) capitalized++;
  }
  if (eligible < 1) return false;
  return capitalized / eligible >= 0.6;
}

/** Lowercase a single Title-Cased word, preserving acronyms, mixed-case tokens,
 *  numbers, and (at a sentence start) the leading capital. */
function convertWord(word: string, sentenceStart: boolean): string {
  if (!word) return word;
  if (/^[\p{Lu}\p{N}&]{2,}$/u.test(word)) return word; // DSO, AI, HIPAA
  if (word === "I") return word;
  if (/\p{Lu}/u.test(word.slice(1))) return word; // iOS, McKesson, SaaS
  if (/^\p{N}/u.test(word)) return word; // 3D, 24/7, numbers
  const lower = word.toLowerCase();
  if (ACRONYM_CANONICAL[lower]) return ACRONYM_CANONICAL[lower]; // Roi -> ROI
  if (sentenceStart) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return lower;
}

/** Convert one whitespace-delimited token, peeling leading/trailing punctuation
 *  and handling hyphenated compounds. Masked placeholders pass through intact. */
function convertToken(token: string, sentenceStart: boolean): string {
  if (token.includes(MASK_OPEN)) return token;
  const m = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}].*?)?([^\p{L}\p{N}]*)$/u);
  if (!m || !m[2]) return token;
  const lead = m[1] ?? "";
  const core = m[2];
  const trail = m[3] ?? "";
  if (core.includes("-")) {
    const segs = core
      .split("-")
      .map((seg, i) => (seg ? convertWord(seg, sentenceStart && i === 0) : seg))
      .join("-");
    return lead + segs + trail;
  }
  return lead + convertWord(core, sentenceStart) + trail;
}

/** Normalize a single heading string to sentence case, or return it unchanged
 *  when it is too long/short or not actually Title-Cased. */
function normalizeHeadingString(input: string, phrases: ProtectedPhrase[]): string {
  if (!input || input.length > 200) return input; // paragraph guard
  if (countWords(input) > 18) return input;
  const { masked, restores } = maskPhrases(input, phrases);
  if (!looksTitleCased(masked)) return input;

  const parts = masked.split(/(\s+)/);
  let sentenceStart = true;
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || /^\s+$/.test(part)) {
      out.push(part);
      continue;
    }
    out.push(convertToken(part, sentenceStart));
    // A trailing .!?: (optionally followed by a closing quote/bracket) starts a
    // new sentence for the next token.
    sentenceStart = /[.!?:]["'’”)\]]*$/.test(part);
  }
  return restorePhrases(out.join(""), restores);
}

function walk(node: unknown, phrases: ProtectedPhrase[], inPersonCard: boolean): number {
  let changed = 0;
  if (Array.isArray(node)) {
    for (const item of node) changed += walk(item, phrases, inPersonCard);
    return changed;
  }
  if (!isPlainObject(node)) return 0;
  const personCard =
    inPersonCard || Object.keys(node).some((k) => PERSON_OBJECT_KEYS.has(k.toLowerCase()));
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      if (!isHeadingKey(key)) continue;
      if (personCard && PERSON_FIELD_KEYS.has(key.toLowerCase())) continue;
      const next = normalizeHeadingString(value, phrases);
      if (next !== value) {
        node[key] = next;
        changed++;
      }
      continue;
    }
    changed += walk(value, phrases, personCard);
  }
  return changed;
}

export interface SentenceCaseOptions {
  /** Proper nouns to protect as whole phrases (brand name, product names,
   *  account name). Case-insensitive; their canonical casing is restored. */
  properNouns?: (string | null | undefined)[];
}

/**
 * Rewrite Title-Cased heading-like strings in `blocks` (shape `{ props }`) to
 * sentence case, in place. Returns the same array plus a count of fields
 * changed. Fail-safe: never throws.
 */
export function normalizeHeadingsToSentenceCase(
  blocks: unknown[],
  opts: SentenceCaseOptions = {},
): { blocks: unknown[]; changed: number } {
  if (!Array.isArray(blocks)) return { blocks, changed: 0 };
  try {
    const properNouns = (opts.properNouns ?? []).filter(
      (s): s is string => typeof s === "string" && s.trim().length >= 2,
    );
    const phrases = buildPhrases(properNouns);
    let changed = 0;
    for (const block of blocks) {
      if (!isPlainObject(block)) continue;
      changed += walk(block.props, phrases, false);
    }
    return { blocks, changed };
  } catch {
    return { blocks, changed: 0 };
  }
}

/** Direct string-level helper, exported for unit testing. */
export function sentenceCaseHeading(input: string, properNouns: string[] = []): string {
  try {
    const phrases = buildPhrases(
      properNouns.filter((s) => typeof s === "string" && s.trim().length >= 2),
    );
    return normalizeHeadingString(input, phrases);
  } catch {
    return input;
  }
}
