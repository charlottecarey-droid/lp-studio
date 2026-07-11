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
 * SHOUTING (July 2026): the model also emits ALL-CAPS runs ("50 YEARS OF
 * INNOVATION in Dental Technology"), and the original pass treated every
 * all-caps word as an acronym — so shouted headings sailed through untouched
 * (or worse, only their Title-Cased tail got lowercased, shipping a mixed
 * mess). Now a run of TWO OR MORE consecutive non-curated all-caps words is
 * classified as shouting and sentence-cased like ordinary copy. An ISOLATED
 * non-curated all-caps word (CEREC, NADL) still reads as an unknown acronym
 * and is preserved — the adjacency rule is what separates "…OF INNOVATION…"
 * from "Precision CEREC Workflows". Curated acronyms never count toward a
 * shouted run, so "Boost AI ROI Today" keeps both.
 *
 * Known, accepted limitation: a multi-word proper noun that is NOT in the
 * provided allowlist (e.g. a third-party "Cleveland Clinic" mentioned in a
 * heading) will be lowercased like any other Title-Cased phrase. The brand's
 * own names + the account name are protected; arbitrary external names are
 * not — same for a multi-word all-caps name ("MAYO CLINIC"), which the
 * shouting rule will sentence-case unless it's in the allowlist.
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

/** All-caps word that could be an acronym (letters/digits, ≥2 chars, at least
 *  one capital — excludes pure numbers like "50"). */
const ALL_CAPS_WORD = /^[\p{Lu}\p{N}&]{2,}$/u;

/** Detect SHOUTED words: two or more consecutive non-curated all-caps words
 *  ("50 YEARS OF INNOVATION") are emphasis, not acronyms, and get sentence-
 *  cased. Isolated all-caps words (CEREC) stay preserved as unknown acronyms;
 *  curated acronyms (AI, ROI) never join a run, so "Boost AI ROI Today" keeps
 *  both. Scans hyphen-free segments so "AI-POWERED DENTISTRY" shouts too;
 *  pure numbers are transparent ("SAVE 50 HOURS" is one run). Returns the
 *  shouted words' exact text — convertWord/looksTitleCased match on it. */
function findShoutedWords(masked: string): Set<string> {
  const segments = masked.match(/[\p{L}\p{N}&]+/gu) ?? [];
  const letterWords = segments.filter((w) => !/^\p{N}+$/u.test(w));
  const isCandidate = (w: string) =>
    ALL_CAPS_WORD.test(w) && /\p{Lu}/u.test(w) && !ACRONYM_CANONICAL[w.toLowerCase()];
  const shouted = new Set<string>();
  for (let i = 0; i < letterWords.length; i++) {
    if (!isCandidate(letterWords[i])) continue;
    const prev = i > 0 && isCandidate(letterWords[i - 1]);
    const next = i < letterWords.length - 1 && isCandidate(letterWords[i + 1]);
    if (prev || next) shouted.add(letterWords[i]);
  }
  return shouted;
}

/** True when the (already-masked) string looks Title-Cased OR shouted: most
 *  eligible non-first content words start with a capital. Shouted words count
 *  as capitalized evidence (they're emphatic capitals, not acronyms), so a
 *  fully ALL-CAPS heading is detected and rewritten. */
function looksTitleCased(masked: string, shouted: ReadonlySet<string>): boolean {
  const words = masked.match(/\p{L}[\p{L}\p{N}'’-]*|\p{N}[\p{L}\p{N}'’-]*/gu) ?? [];
  if (words.length < 2) return false;
  let eligible = 0;
  let capitalized = 0;
  for (let i = 0; i < words.length; i++) {
    if (i === 0) continue; // first word is capitalized in both cases
    const w = words[i];
    const lw = w.toLowerCase();
    if (/^[\p{Lu}\p{N}&]{2,}$/u.test(w)) {
      if (shouted.has(w)) {
        eligible++;
        capitalized++;
      }
      continue; // real acronym — neutral evidence
    }
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

/** Lowercase a single Title-Cased or SHOUTED word, preserving real acronyms,
 *  mixed-case tokens, numbers, and (at a sentence start) the leading capital. */
function convertWord(word: string, sentenceStart: boolean, shouted: ReadonlySet<string>): string {
  if (!word) return word;
  const isAllCaps = /^[\p{Lu}\p{N}&]{2,}$/u.test(word);
  if (isAllCaps && !shouted.has(word)) return word; // DSO, AI, HIPAA, lone CEREC
  if (word === "I") return word;
  if (!isAllCaps && /\p{Lu}/u.test(word.slice(1))) return word; // iOS, McKesson, SaaS
  if (/^\p{N}/u.test(word)) return word; // 3D, 24/7, numbers
  const lower = word.toLowerCase();
  if (ACRONYM_CANONICAL[lower]) return ACRONYM_CANONICAL[lower]; // Roi -> ROI
  if (sentenceStart) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return lower;
}

/** Convert one whitespace-delimited token, peeling leading/trailing punctuation
 *  and handling hyphenated compounds. Masked placeholders pass through intact. */
function convertToken(token: string, sentenceStart: boolean, shouted: ReadonlySet<string>): string {
  if (token.includes(MASK_OPEN)) return token;
  const m = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}].*?)?([^\p{L}\p{N}]*)$/u);
  if (!m || !m[2]) return token;
  const lead = m[1] ?? "";
  const core = m[2];
  const trail = m[3] ?? "";
  if (core.includes("-")) {
    const segs = core
      .split("-")
      .map((seg, i) => (seg ? convertWord(seg, sentenceStart && i === 0, shouted) : seg))
      .join("-");
    return lead + segs + trail;
  }
  return lead + convertWord(core, sentenceStart, shouted) + trail;
}

/** Normalize a single heading string to sentence case, or return it unchanged
 *  when it is too long/short or not actually Title-Cased. */
function normalizeHeadingString(input: string, phrases: ProtectedPhrase[]): string {
  if (!input || input.length > 200) return input; // paragraph guard
  if (countWords(input) > 18) return input;
  const { masked, restores } = maskPhrases(input, phrases);
  const shouted = findShoutedWords(masked);
  if (!looksTitleCased(masked, shouted)) return input;

  const parts = masked.split(/(\s+)/);
  let sentenceStart = true;
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || /^\s+$/.test(part)) {
      out.push(part);
      continue;
    }
    out.push(convertToken(part, sentenceStart, shouted));
    // A trailing .!?: (optionally followed by a closing quote/bracket) starts a
    // new sentence for the next token.
    sentenceStart = /[.!?:]["'’”)\]]*$/.test(part);
  }
  return restorePhrases(out.join(""), restores);
}

function walk(
  node: unknown,
  phrases: ProtectedPhrase[],
  inPersonCard: boolean,
  preserveValues: ReadonlySet<string> | undefined,
): number {
  let changed = 0;
  if (Array.isArray(node)) {
    for (const item of node) changed += walk(item, phrases, inPersonCard, preserveValues);
    return changed;
  }
  if (!isPlainObject(node)) return 0;
  const personCard =
    inPersonCard || Object.keys(node).some((k) => PERSON_OBJECT_KEYS.has(k.toLowerCase()));
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      if (!isHeadingKey(key)) continue;
      if (personCard && PERSON_FIELD_KEYS.has(key.toLowerCase())) continue;
      // A string that exactly matches an authored/preserved value is a
      // deliberate human choice (e.g. a template's "Event Details" heading
      // restored by the merge backstop) — its casing is not model output.
      if (preserveValues?.has(value)) continue;
      const next = normalizeHeadingString(value, phrases);
      if (next !== value) {
        node[key] = next;
        changed++;
      }
      continue;
    }
    changed += walk(value, phrases, personCard, preserveValues);
  }
  return changed;
}

export interface SentenceCaseOptions {
  /** Proper nouns to protect as whole phrases (brand name, product names,
   *  account name). Case-insensitive; their canonical casing is restored. */
  properNouns?: (string | null | undefined)[];
  /** Exact string values never rewritten — authored copy (template props) whose
   *  casing is a deliberate human choice rather than model output. */
  preserveValues?: ReadonlySet<string>;
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
      changed += walk(block.props, phrases, false, opts.preserveValues);
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
