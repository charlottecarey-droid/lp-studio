// Account search ranking / dedupe / confidence (June 2026).
//
// Pure, deterministic helpers behind GET /sales/accounts/search. They take a
// raw query string + a flat list of candidate accounts (local DB rows and/or
// CRM autocomplete results, already merged by the route) and produce a ranked,
// deduped, confidence-scored result set the typeahead UI renders:
//   • dataRichness — how much CONTEXT exists for the account (contacts,
//     opportunities, notes, enriched fields). The richest account ranks first
//     so the rep lands on the one the generator can personalise best.
//   • confidence  — how well the account NAME/domain matches the query.
//   • dedupe      — accounts that look like the same company (same normalized
//     domain, else same normalized name) are grouped; all but the canonical
//     (richest) one are flagged `isLikelyDuplicateOf` so the UI can warn before
//     a rep creates a duplicate.
//
// NO DB / IO here — the route does the fetching + CRM merge and hands raw rows
// in. Everything is unit-tested so ranking/dedupe/confidence can't silently
// drift.

export type AccountSource = "crm" | "local";

/** Raw candidate handed in by the route (local row or CRM autocomplete hit). */
export interface AccountSearchCandidate {
  /** Local DB id (number) or CRM id (string). One of id/crmId is required. */
  id?: number | string;
  /** CRM record id when this came from / is linked to the CRM. */
  crmId?: string;
  name: string;
  domain?: string | null;
  source: AccountSource;
  /** Signals used to compute dataRichness — all optional / fail-open. */
  contactCount?: number;
  opportunityCount?: number;
  hasNotes?: boolean;
  /** Count of non-empty enriched fields (industry, segment, location, etc.). */
  enrichedFieldCount?: number;
}

export interface AccountSearchResult {
  id: number | string;
  name: string;
  domain: string | null;
  crmId?: string;
  source: AccountSource;
  /** 0–100. Higher = more context exists to drive a good generation. */
  dataRichness: number;
  /** 0–100. Higher = better match to the query. */
  confidence: number;
  /** When set, the id of the canonical (richest) account this duplicates. */
  isLikelyDuplicateOf?: number | string;
}

// ── Normalisation ───────────────────────────────────────────────────────────

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Common company suffixes stripped so "Acme Inc" and "Acme" dedupe together. */
const COMPANY_SUFFIXES = new Set([
  "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
  "co", "company", "group", "holdings", "plc", "gmbh", "sa", "the",
]);

/** Normalized name with leading "the" and trailing company suffixes removed —
 *  the key used for name-based dedupe. */
export function normalizeCompanyKey(raw: string | null | undefined): string {
  const tokens = normalizeName(raw).split(" ").filter(Boolean);
  // Drop a leading "the".
  while (tokens.length > 1 && tokens[0] === "the") tokens.shift();
  // Drop trailing suffixes.
  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

/** Bare registrable-ish domain: lowercased, scheme/path/www stripped. */
export function normalizeDomain(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  return d.trim();
}

// ── Data richness ─────────────────────────────────────────────────────────

/**
 * 0–100 score for how much CONTEXT exists for an account. Weighted toward the
 * signals that most improve a generated microsite: contacts (buyer committee),
 * opportunities (deal context), notes, and enriched fields. Monotonic + capped.
 */
export function computeDataRichness(c: AccountSearchCandidate): number {
  const contacts = Math.max(0, c.contactCount ?? 0);
  const opps = Math.max(0, c.opportunityCount ?? 0);
  const enriched = Math.max(0, c.enrichedFieldCount ?? 0);
  let score = 0;
  // Contacts: up to 40 (5 each, cap at 8 contacts).
  score += Math.min(contacts, 8) * 5;
  // Opportunities: up to 30 (15 each, cap at 2).
  score += Math.min(opps, 2) * 15;
  // Notes: flat 10.
  if (c.hasNotes) score += 10;
  // Enriched fields: up to 20 (4 each, cap at 5).
  score += Math.min(enriched, 5) * 4;
  return Math.min(100, score);
}

// ── Confidence (query match) ───────────────────────────────────────────────

/**
 * 0–100 match confidence between the query and the account name/domain.
 *   • exact normalized-name match → 100
 *   • name starts with the query  → 90
 *   • query is a whole-word prefix inside the name → 80
 *   • name contains the query substring → 65
 *   • domain contains the query → 55
 *   • token overlap (Jaccard) fallback → up to 50
 * An empty query yields 0 (the route then ranks purely by richness).
 */
export function computeConfidence(query: string, c: AccountSearchCandidate): number {
  const q = normalizeName(query);
  if (!q) return 0;
  const name = normalizeName(c.name);
  const domain = normalizeDomain(c.domain);
  const qInDomain = normalizeName(query).replace(/\s+/g, "");

  if (name === q) return 100;
  if (name.startsWith(q + " ") || name === q) return 90;
  // Whole-word prefix anywhere (e.g. "smile" matches "bright smile dental").
  if (new RegExp(`(^| )${escapeRegExp(q)}( |$)`).test(name)) return 85;
  if (name.includes(q)) {
    // Substring but not word-aligned (e.g. query inside a longer token).
    return name.startsWith(q) ? 80 : 65;
  }
  if (domain && qInDomain && domain.includes(qInDomain)) return 55;

  // Token-overlap fallback (Jaccard over name tokens).
  const qTokens = new Set(q.split(" ").filter(Boolean));
  const nTokens = new Set(name.split(" ").filter(Boolean));
  if (qTokens.size === 0 || nTokens.size === 0) return 0;
  let inter = 0;
  for (const t of qTokens) if (nTokens.has(t)) inter++;
  const union = new Set([...qTokens, ...nTokens]).size;
  return Math.round((inter / union) * 50);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Ranking + dedupe ─────────────────────────────────────────────────────

function candidateId(c: AccountSearchCandidate): number | string {
  if (c.id !== undefined && c.id !== null) return c.id;
  if (c.crmId) return c.crmId;
  return c.name;
}

/**
 * Rank, dedupe, and score a candidate list for the typeahead.
 *
 * Ordering: highest confidence first, then richest data, then local-over-CRM
 * (local rows already carry the generator's context), then name (stable).
 *
 * Dedupe: candidates sharing a normalized domain (preferred) OR — when neither
 * has a domain — a normalized company key are grouped. Within a group the
 * RICHEST candidate (then highest confidence) is the canonical row; the others
 * keep their place in the ranking but carry `isLikelyDuplicateOf = <canonical
 * id>` so the UI can warn. When `collapseDuplicates` is true the non-canonical
 * rows are dropped entirely (one row per real company).
 */
export function rankAndDedupeAccounts(
  query: string,
  candidates: AccountSearchCandidate[],
  opts: { collapseDuplicates?: boolean; limit?: number } = {},
): AccountSearchResult[] {
  const scored = candidates
    .filter((c) => c && typeof c.name === "string" && c.name.trim().length > 0)
    .map((c) => ({
      candidate: c,
      id: candidateId(c),
      dataRichness: computeDataRichness(c),
      confidence: computeConfidence(query, c),
    }));

  // Group for dedupe. Domain key wins; fall back to company-name key. A blank
  // key (no domain, no resolvable name) is unique per id so it never groups.
  const groupKeyOf = (c: AccountSearchCandidate): string => {
    const dom = normalizeDomain(c.domain);
    if (dom) return `d:${dom}`;
    const nameKey = normalizeCompanyKey(c.name);
    if (nameKey) return `n:${nameKey}`;
    return `id:${candidateId(c)}`;
  };

  const groups = new Map<string, typeof scored>();
  for (const s of scored) {
    const key = groupKeyOf(s.candidate);
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  // Canonical (richest, then highest confidence, then local) per group.
  const canonicalIdByGroup = new Map<string, number | string>();
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const canonical = [...members].sort((a, b) => {
      if (b.dataRichness !== a.dataRichness) return b.dataRichness - a.dataRichness;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const aLocal = a.candidate.source === "local" ? 1 : 0;
      const bLocal = b.candidate.source === "local" ? 1 : 0;
      if (bLocal !== aLocal) return bLocal - aLocal;
      return 0;
    })[0];
    canonicalIdByGroup.set(key, canonical.id);
  }

  let results: AccountSearchResult[] = scored.map((s) => {
    const key = groupKeyOf(s.candidate);
    const canonicalId = canonicalIdByGroup.get(key);
    const isDup = canonicalId !== undefined && canonicalId !== s.id;
    return {
      id: s.id,
      name: s.candidate.name,
      domain: s.candidate.domain ?? null,
      ...(s.candidate.crmId ? { crmId: s.candidate.crmId } : {}),
      source: s.candidate.source,
      dataRichness: s.dataRichness,
      confidence: s.confidence,
      ...(isDup ? { isLikelyDuplicateOf: canonicalId } : {}),
    };
  });

  if (opts.collapseDuplicates) {
    results = results.filter((r) => r.isLikelyDuplicateOf === undefined);
  }

  results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.dataRichness !== a.dataRichness) return b.dataRichness - a.dataRichness;
    const aLocal = a.source === "local" ? 1 : 0;
    const bLocal = b.source === "local" ? 1 : 0;
    if (bLocal !== aLocal) return bLocal - aLocal;
    return a.name.localeCompare(b.name);
  });

  if (opts.limit && opts.limit > 0) results = results.slice(0, opts.limit);
  return results;
}
