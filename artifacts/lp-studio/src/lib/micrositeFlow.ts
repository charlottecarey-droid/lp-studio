// Pure helpers for the redesigned New Microsite flow (June 2026).
//
// The New Microsite modal is now a guided questionnaire → preview → builder
// flow ("tell us who this is for and what you're trying to accomplish; we'll
// handle the rest"). This module holds the SIDE-EFFECT-FREE logic behind that
// flow so it can be unit-tested without React or the network:
//
//   • OBJECTIVE_CARDS / objectiveToEnum — the selectable goal cards and their
//     mapping to the `MicrositeObjective` enum the /sales/microsite/recommend
//     endpoint expects.
//   • inferPersonaCategory / inferPersonaFromContacts — map CRM contact titles
//     ("COO", "Clinical Director", "Procurement Lead") to a coarse persona
//     CATEGORY, used to pre-select a segment persona from an account's people.
//   • recommendSegmentPersona — given the tenant's segments + an inferred
//     persona category, pick the segment+persona to pre-select (overridable).
//   • duplicateWarning — decide whether to warn before "create new account"
//     when the typeahead results look like duplicates (P0: don't silently
//     create dupes).
//
// Nothing here touches the DOM, `fetch`, or `localStorage` — see
// micrositeFlow.test.ts.

// ── Objective cards → enum ───────────────────────────────────────────────────

/** The `MicrositeObjective` enum the recommend endpoint accepts. Mirrors the
 *  server's `MicrositeObjective` (api-server/.../microsite-recommendation.ts).
 *  Kept as a literal union here so the frontend doesn't import server types. */
export type MicrositeObjective =
  | "book-meeting"
  | "advance-opportunity"
  | "re-engage-stalled"
  | "support-proposal"
  | "share-business-case"
  | "exec-presentation"
  | "drive-expansion"
  | "from-scratch";

export interface ObjectiveCard {
  /** The enum value sent to the recommend + generate endpoints. */
  objective: MicrositeObjective;
  /** The marketer-friendly card title. */
  title: string;
  /** One-line "when you'd pick this" helper. */
  description: string;
  /** lucide-react icon name — the modal maps this to an imported icon. */
  icon: string;
}

/** The selectable goal cards, in display order. Step 2 of the questionnaire.
 *  "Start from scratch" is intentionally last — it's the escape hatch, not the
 *  default. */
export const OBJECTIVE_CARDS: readonly ObjectiveCard[] = [
  {
    objective: "book-meeting",
    title: "Book a meeting",
    description: "Earn a first conversation with a new prospect.",
    icon: "CalendarCheck",
  },
  {
    objective: "advance-opportunity",
    title: "Advance an opportunity",
    description: "Move an active deal toward the next step.",
    icon: "TrendingUp",
  },
  {
    objective: "re-engage-stalled",
    title: "Re-engage a stalled deal",
    description: "Reopen a conversation that went quiet.",
    icon: "RefreshCw",
  },
  {
    objective: "support-proposal",
    title: "Support a proposal",
    description: "Back up a live proposal with proof and detail.",
    icon: "FileCheck",
  },
  {
    objective: "share-business-case",
    title: "Share a business case",
    description: "Make the quantified case for the decision.",
    icon: "Calculator",
  },
  {
    objective: "exec-presentation",
    title: "Prepare for an executive presentation",
    description: "A polished brief for the decision-maker room.",
    icon: "Presentation",
  },
  {
    objective: "drive-expansion",
    title: "Drive expansion within an account",
    description: "Grow an existing customer relationship.",
    icon: "Sprout",
  },
  {
    objective: "from-scratch",
    title: "Start from scratch",
    description: "Let AI assemble a custom page — no fixed goal.",
    icon: "Wand2",
  },
] as const;

const VALID_OBJECTIVES = new Set<string>(OBJECTIVE_CARDS.map((c) => c.objective));

/**
 * Map any string to the objective enum the recommend endpoint expects. Already-
 * valid enum values pass through; anything unknown/blank degrades to
 * "from-scratch" (matches the server's fail-open default), so the flow can
 * never send an invalid objective.
 */
export function objectiveToEnum(value: string | null | undefined): MicrositeObjective {
  const v = (value ?? "").trim();
  return VALID_OBJECTIVES.has(v) ? (v as MicrositeObjective) : "from-scratch";
}

// ── Persona inference from CRM titles ────────────────────────────────────────

/** Coarse persona CATEGORIES we map CRM titles into. These are matched against
 *  the segment's persona role strings (case-insensitive contains) to pre-select
 *  a persona. "unknown" means we couldn't confidently classify the title. */
export type PersonaCategory =
  | "Executive"
  | "Operations"
  | "Clinical"
  | "Procurement"
  | "Finance"
  | "Marketing"
  | "unknown";

// Ordered most-specific → most-general. The first matching rule wins, so e.g.
// "Chief Clinical Officer" classifies as Clinical (clinical rule precedes the
// generic chief/exec rule) — clinical intent is more useful for messaging than
// the seniority alone.
// Functional-area rules come BEFORE the generic-seniority Executive rule so a
// "VP of Marketing" classifies as Marketing (its function) rather than as a
// generic Executive (its rank). The C-suite functional officers (CFO/CMO) live
// in their function's rule; the Executive rule is the seniority fallback for
// CEO/COO/President/etc. that carry no functional signal.
const PERSONA_RULES: { category: Exclude<PersonaCategory, "unknown">; re: RegExp }[] = [
  // Clinical intent first — a "Chief Clinical Officer" is more useful as Clinical.
  { category: "Clinical", re: /\b(clinical|dentist|doctor|dr|physician|provider|dds|dmd|hygien|nurse|medical director|chief (clinical|medical))\b/i },
  { category: "Finance", re: /\b(cfo|finance|financial|controller|accounting|treasur|fp&a)\b/i },
  { category: "Marketing", re: /\b(cmo|marketing|brand|demand gen|growth marketing)\b/i },
  // "Economic buyer" is an executive concept — exclude it from the procurement
  // `buyer` match via a negative lookbehind so it routes to Executive below.
  { category: "Procurement", re: /\b(procurement|procuring|purchasing|sourcing|supply chain|vendor)\b|(?<!economic )\bbuyer\b/i },
  // No bare "lead" here — it collides with titles like "Procurement Lead";
  // operations is matched by explicit ops/manager/administrator phrasing.
  { category: "Operations", re: /\b(coo|operations|ops|practice manager|office manager|practice administrator|regional manager|operations manager|director of operations)\b/i },
  // Seniority fallback — generic chief/owner/VP titles with no functional cue.
  { category: "Executive", re: /\b(ceo|cto|cio|chief|founder|owner|president|principal|partner|managing director|vp|vice president|svp|evp|executive|board|economic buyer)\b/i },
];

/**
 * Map a single CRM title/role string to a coarse persona category.
 * First-match-wins over the ordered rule list; returns "unknown" when nothing
 * matches (blank, or a title we don't recognise — e.g. "Receptionist").
 */
export function inferPersonaCategory(title: string | null | undefined): PersonaCategory {
  const hay = (title ?? "").trim();
  if (!hay) return "unknown";
  for (const rule of PERSONA_RULES) {
    if (rule.re.test(hay)) return rule.category;
  }
  return "unknown";
}

/** Minimal contact shape — only the title field matters for inference. */
export interface InferenceContact {
  title?: string | null;
  role?: string | null;
}

/**
 * Infer the single most-relevant persona category across an account's contacts.
 * Seniority wins ties: an Executive title outranks Operations outranks the rest,
 * so a buyer committee of {COO, Receptionist} infers Operations and {CEO, COO}
 * infers Executive. Returns "unknown" when no contact yields a confident match.
 */
export function inferPersonaFromContacts(contacts: InferenceContact[] | null | undefined): PersonaCategory {
  if (!Array.isArray(contacts) || contacts.length === 0) return "unknown";
  // Priority order — earlier = preferred when multiple categories are present.
  const PRIORITY: Exclude<PersonaCategory, "unknown">[] = [
    "Executive",
    "Clinical",
    "Finance",
    "Operations",
    "Procurement",
    "Marketing",
  ];
  const found = new Set<PersonaCategory>();
  for (const c of contacts) {
    const cat = inferPersonaCategory(c.title ?? c.role ?? "");
    if (cat !== "unknown") found.add(cat);
  }
  for (const cat of PRIORITY) {
    if (found.has(cat)) return cat;
  }
  return "unknown";
}

// ── Segment + persona recommendation ─────────────────────────────────────────

export interface FlowPersona {
  id: string;
  name?: string;
  role?: string;
}

export interface FlowSegment {
  id: string;
  name: string;
  messagingAngle?: string;
  personas?: FlowPersona[];
}

export interface SegmentPersonaRecommendation {
  segmentId: string;
  /** "" when no persona could be matched within the chosen segment. */
  personaId: string;
}

/**
 * Recommend a segment + persona to PRE-SELECT (overridable) given the tenant's
 * segments and an inferred persona category. Strategy:
 *   1. Find the first persona across all segments whose role/name matches the
 *      inferred category — pre-select that segment + persona.
 *   2. If no persona matches (or category is "unknown"), pre-select the first
 *      segment (segment is required for personalised pages) with no persona.
 *   3. With no segments at all, return empty ids (manual selection).
 */
export function recommendSegmentPersona(
  segments: FlowSegment[] | null | undefined,
  inferredCategory: PersonaCategory,
): SegmentPersonaRecommendation {
  const segs = Array.isArray(segments) ? segments : [];
  if (segs.length === 0) return { segmentId: "", personaId: "" };

  if (inferredCategory !== "unknown") {
    const needle = inferredCategory.toLowerCase();
    for (const seg of segs) {
      for (const p of seg.personas ?? []) {
        const hay = `${p.role ?? ""} ${p.name ?? ""}`.toLowerCase();
        // Match the inferred category against the persona role, AND re-classify
        // the persona's own role so e.g. an "Operations" inference lands on a
        // persona whose role contains "ops"/"operations" even if the word
        // differs.
        if (hay.includes(needle) || inferPersonaCategory(hay) === inferredCategory) {
          return { segmentId: seg.id, personaId: p.id };
        }
      }
    }
  }

  // Fall back to the first segment (required), persona left to the rep.
  return { segmentId: segs[0].id, personaId: "" };
}

// ── Duplicate-warning logic ──────────────────────────────────────────────────

export interface DuplicateCandidate {
  id: number | string;
  name: string;
  domain?: string | null;
  confidence: number;
  dataRichness: number;
  isLikelyDuplicateOf?: number | string;
}

export interface DuplicateWarning {
  /** True when the rep should be warned before creating a new account because
   *  one or more results look like the same company. */
  warn: boolean;
  /** The canonical (richest) match the rep should consider instead, when any. */
  suggested: DuplicateCandidate | null;
  /** Human-readable warning line for the UI. */
  message: string;
}

/**
 * Decide whether to WARN before letting a rep "create a new account", given the
 * current typeahead results for their query. P0: don't silently create dupes.
 *
 * We warn when any result is flagged `isLikelyDuplicateOf` (the search already
 * grouped same-domain/same-name companies), OR when a single high-confidence
 * (>= 80) match exists that the rep may be about to duplicate. The suggested
 * account is always the RICHEST canonical row (one NOT flagged as a duplicate,
 * highest dataRichness then confidence) so the rep is steered to the account the
 * generator can personalise best.
 */
export function duplicateWarning(
  query: string,
  results: DuplicateCandidate[] | null | undefined,
): DuplicateWarning {
  const list = Array.isArray(results) ? results : [];
  const none: DuplicateWarning = { warn: false, suggested: null, message: "" };
  if (list.length === 0) return none;

  const hasFlaggedDup = list.some((r) => r.isLikelyDuplicateOf !== undefined);
  const strongMatch = list.find((r) => r.confidence >= 80);

  if (!hasFlaggedDup && !strongMatch) return none;

  // Canonical candidates = rows NOT themselves flagged as a duplicate.
  const canonical = list.filter((r) => r.isLikelyDuplicateOf === undefined);
  const pool = canonical.length > 0 ? canonical : list;
  const suggested = [...pool].sort((a, b) => {
    if (b.dataRichness !== a.dataRichness) return b.dataRichness - a.dataRichness;
    return b.confidence - a.confidence;
  })[0] ?? null;

  const q = query.trim();
  const name = suggested?.name ?? "this account";
  const message = hasFlaggedDup
    ? `We found accounts that look like the same company${q ? ` for “${q}”` : ""}. Use the existing one to keep all its context in one place.`
    : `“${name}” already exists and closely matches${q ? ` “${q}”` : " your search"}. Create a new account only if it's genuinely different.`;

  return { warn: true, suggested, message };
}
