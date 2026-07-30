/**
 * Deterministic agenda matching for the conference agenda builder.
 *
 * Pure functions — no DB, no AI. Given an event's session catalog, an
 * account's synced attributes, and the rep-picked attendee roles, produce a
 * ranked, conflict-free draft agenda the rep then adjusts by hand. Every
 * pick carries human-readable reasons so the UI is explainable, never a
 * black box.
 *
 * Scoring:
 *   +3 per attendee role the session targets (tags.roles)
 *   +4 when the account's SEGMENT matches tags.segments (see below)
 *   +2 when the account's industry matches tags.industries
 *   +2 when the account's ABM tier matches tags.tiers
 *   +1 when the account's segment/dsoSize matches a topic tag (weak signal)
 *
 * SEGMENTS ARE A PARTITION, NOT A TAG. For a conference like Procore's, every
 * account is the same industry (construction) and the axis that actually
 * differentiates is the segment: general contractors / owners / subcontractors.
 * An account is in exactly ONE, and a session tagged for one is genuinely
 * wrong for the others. So the segment axis behaves differently from every
 * other signal:
 *
 *   • It scores highest (+4) — it out-ranks a role match, because a session
 *     for the wrong segment is wrong no matter who attends.
 *   • It EXCLUDES. When a session declares segments and we know the account's
 *     segment and it isn't among them, that session is not eligible for the
 *     auto-draft at all. Nothing else in this file excludes; every other
 *     mismatch is merely a lower score.
 *   • It compares STRICTLY (segmentsMatch, not labelsMatch). The fuzzy
 *     comparison the other axes use — built so "COO" finds "Chief Operating
 *     Officer" — reports "General Contractor" ≈ "Specialty Contractors",
 *     which would put specialty sessions on a GC agenda. Verified, not
 *     assumed: that pair returns true from labelsMatch today.
 *
 * Exclusion needs the dedicated `tags.segments` axis, NOT tags.industries.
 * Industries carries the audience for RainFocus imports but the INDUSTRY for
 * other tenants — excluding on it would drop a Dandy session tagged
 * industries:["Dental"] from an account whose segment is "DSO". A segment
 * match against industries/topics still SCORES (+2), it just never excludes.
 * Reserved slots (is_reserved_slot) are always selected, first in their slot.
 * Non-reserved sessions need score > 0 to be auto-picked; within one time
 * slot only the highest-scoring session survives (ties break on earlier
 * title alphabetically so re-runs are stable).
 */

export interface MatchableSessionTags {
  roles?: string[];
  /** Audience partition — "General Contractors" / "Owners" / "Subcontractors".
   *  The only axis that can make a session ineligible. */
  segments?: string[];
  industries?: string[];
  topics?: string[];
  tiers?: string[];
}

export interface MatchableSession {
  id: number;
  title: string;
  day: string | null;        // "2026-10-20"
  startTime: string | null;  // "09:00"
  endTime: string | null;    // "10:30"
  isReservedSlot: boolean;
  tags: MatchableSessionTags | null;
  /** "Keynote" / "Workshop" / … — plenary types are relevant to everyone. */
  sessionType?: string | null;
}

export interface MatchAccountFacts {
  industry?: string | null;
  abmTier?: string | null;
  /** The account's audience partition. May be the CRM value or a per-agenda
   *  override typed by the rep when the conference's segment names differ
   *  from the CRM's — the caller resolves which; this file just uses it. */
  segment?: string | null;
  dsoSize?: string | null;
}

export interface ScoredSession {
  sessionId: number;
  score: number;
  reasons: string[];
  pinned: boolean; // reserved slot — always on the agenda
  /** Declared for a different segment than this account's. Kept out of the
   *  auto-draft but still returned in `considered`, so the swap UI can show
   *  it (greyed, with its reason) instead of pretending it doesn't exist —
   *  a rep who knows better can always add it by hand. */
  excludedBySegment?: boolean;
}

export interface MatchAgendaResult {
  /** Conflict-free picks in chronological order — the draft agenda. */
  selected: ScoredSession[];
  /** Every session with its score (including unpicked), for the swap UI. */
  considered: ScoredSession[];
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Executive acronyms ↔ their spelled-out titles. A rep picks "COO" from the
 * chips while a conference tags its sessions "Chief Operating Officer" (or the
 * reverse) — without this the two never meet, which was the single biggest
 * cause of agendas coming back empty.
 */
const TITLE_SYNONYMS: Record<string, string> = {
  ceo: "chief executive officer",
  coo: "chief operating officer",
  cfo: "chief financial officer",
  cio: "chief information officer",
  cto: "chief technology officer",
  cmo: "chief marketing officer",
  cro: "chief revenue officer",
  chro: "chief human resources officer",
  cno: "chief nursing officer",
  cco: "chief clinical officer",
  vp: "vice president",
  svp: "senior vice president",
  evp: "executive vice president",
  gm: "general manager",
  it: "information technology",
};

/**
 * Rank/generic words. They're kept for the whole-string comparison (so
 * "CEO" still resolves to "chief executive officer") but dropped before token
 * overlap — otherwise every "… Director" matches every other "… Director",
 * which is worse than no match at all.
 */
const GENERIC_TITLE_WORDS = new Set([
  "of", "the", "and", "for", "to", "a", "an", "in", "at", "on", "amp",
  "chief", "officer", "president", "vice", "executive", "director",
  "manager", "management", "head", "lead", "leader", "leadership",
  "senior", "junior", "staff", "team", "global", "regional", "group",
  "specialist", "coordinator", "associate", "professional", "professionals",
]);

/** Expand known acronyms across the whole label ("coo" → "chief operating officer"). */
function expandTitle(label: string): string {
  return norm(label)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => TITLE_SYNONYMS[w] ?? w)
    .join(" ");
}

/**
 * Crude stem so operating / operations / operation all collapse together —
 * conference tags and job titles rarely agree on the form of a word.
 */
function stem(word: string): string {
  return word.replace(/(ings|ing|ions|ion|ies|es|s)$/, "");
}

/** Distinctive tokens only — generics removed (in either form), everything stemmed. */
function titleTokens(label: string): Set<string> {
  return new Set(
    expandTitle(label)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !GENERIC_TITLE_WORDS.has(w) && !GENERIC_TITLE_WORDS.has(stem(w)))
      .map(stem)
      .filter((w) => w.length > 2),
  );
}

/**
 * Two stems belong to the same word family when one prefixes the other by at
 * least 5 characters — "operat" ↔ "operational", "clinic" ↔ "clinical". A
 * suffix list can't keep up with how conferences write tags, and a 5-char
 * shared prefix is specific enough that unrelated subjects don't collide.
 */
function tokensRelated(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

/**
 * Loose label match, in increasing order of leniency:
 *   1. exact after normalization
 *   2. containment ("Clinical Director" ↔ "clinical directors")
 *   3. acronym expansion, whole-string ("COO" ↔ "Chief Operating Officer")
 *   4. distinctive-token overlap ("Clinical Director" ↔ "Director, Clinical Ops")
 *
 * Step 4 ignores rank words, so "Marketing Director" and "Clinical Director"
 * do NOT match on "director" — only a shared *subject* counts.
 */
export function labelsMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) return true;

  // Acronym-aware whole-string comparison.
  const ea = expandTitle(a);
  const eb = expandTitle(b);
  if (ea && eb && (ea === eb || ea.includes(eb) || eb.includes(ea))) return true;

  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const token of ta) {
    for (const other of tb) {
      if (tokensRelated(token, other)) return true;
    }
  }
  return false;
}

/**
 * Strict comparison for the segment axis.
 *
 * Deliberately NOT labelsMatch. Segments name a partition the account sits in
 * exactly one of, so a loose match is a wrong agenda, not a slightly-off one.
 * We fold only the differences that are the SAME name written differently:
 * case, spacing, punctuation, possessives, a leading "the", and the trailing
 * plural. Everything else must be equal.
 *
 * Concretely: "General Contractors" == "general contractor" == "General
 * Contractors" but NOT "Specialty Contractors" — which labelsMatch does treat
 * as equal, because it relates the shared token "contractor(s)".
 */
export function segmentsMatch(a: string, b: string): boolean {
  const na = normSegment(a);
  const nb = normSegment(b);
  return na.length > 0 && na === nb;
}

/** Lowercase, strip punctuation/possessives, drop a leading article, singularise. */
function normSegment(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[\u2019']s\b/g, "")   // "owner's" → "owner"
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
  if (!base) return "";
  // Singularise each word, then drop the spaces: "Sub-Contractors" and
  // "subcontractors" are the same segment written two ways, and a hyphen
  // shouldn't split them into a non-match.
  return base
    .split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join("");
}

/** First tag that strictly matches the segment, or null. */
function segmentHit(segment: string, tagged: string[] | undefined): string | null {
  if (!tagged?.length) return null;
  for (const t of tagged) if (segmentsMatch(segment, t)) return t;
  return null;
}

/**
 * True when this session is explicitly for OTHER segments — it declares a
 * segment audience and the account's segment isn't in it. The caller drops
 * these from the auto-draft entirely. Returns false whenever we can't be
 * sure (no account segment, or the session declares none), so the exclusion
 * only ever fires on positive evidence.
 */
export function sessionExcludedBySegment(
  session: MatchableSession,
  account: MatchAccountFacts,
): boolean {
  const segment = account.segment?.trim();
  const declared = session.tags?.segments ?? [];
  if (!segment || declared.length === 0) return false;
  return segmentHit(segment, declared) === null;
}

function anyMatch(wanted: string[], tagged: string[] | undefined): string | null {
  if (!tagged?.length) return null;
  for (const w of wanted) {
    for (const t of tagged) {
      if (labelsMatch(w, t)) return t;
    }
  }
  return null;
}

function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Two sessions conflict when they share a day and their time ranges overlap. */
export function sessionsConflict(a: MatchableSession, b: MatchableSession): boolean {
  if (!a.day || !b.day || a.day !== b.day) return false;
  const aStart = toMinutes(a.startTime);
  const bStart = toMinutes(b.startTime);
  if (aStart === null || bStart === null) return false;
  // A missing end time is treated as a 60-minute session.
  const aEnd = toMinutes(a.endTime) ?? aStart + 60;
  const bEnd = toMinutes(b.endTime) ?? bStart + 60;
  return aStart < bEnd && bStart < aEnd;
}

export function scoreSession(
  session: MatchableSession,
  account: MatchAccountFacts,
  attendeeRoles: string[],
): ScoredSession {
  const reasons: string[] = [];
  let score = 0;
  const tags = session.tags ?? {};

  for (const role of attendeeRoles) {
    if (anyMatch([role], tags.roles)) {
      score += 3;
      reasons.push(`Targets ${role}`);
    }
  }

  // Segment — the strongest signal, and the only one that can exclude.
  // Scored here; the exclusion itself happens in matchAgendaSessions so the
  // swap UI can still SHOW an off-segment session (with its reason) rather
  // than hiding that it exists.
  const segment = account.segment?.trim();
  if (segment) {
    const declared = segmentHit(segment, tags.segments);
    if (declared) {
      score += 4;
      reasons.push(`Segment: ${declared}`);
    } else if ((tags.segments ?? []).length > 0) {
      reasons.push(`For other segments (${(tags.segments ?? []).join(", ")})`);
    } else {
      // No dedicated segment tag: a catalog imported before the segment axis
      // existed, or a tenant that files audience under industry. Scores, but
      // never excludes — we can't tell a missing tag from a different one.
      const loose = segmentHit(segment, tags.industries) ?? segmentHit(segment, tags.topics);
      if (loose) {
        score += 2;
        reasons.push(`Segment: ${loose}`);
      }
    }
  }

  if (account.industry) {
    const hit = anyMatch([account.industry], tags.industries);
    if (hit) {
      score += 2;
      reasons.push(`Industry: ${hit}`);
    }
  }

  if (account.abmTier) {
    const hit = anyMatch([account.abmTier], tags.tiers);
    if (hit) {
      score += 2;
      reasons.push(`Tier: ${hit}`);
    }
  }

  const weakSignals = [account.segment, account.dsoSize].filter((s): s is string => !!s);
  if (weakSignals.length > 0) {
    const hit = anyMatch(weakSignals, tags.topics);
    if (hit) {
      score += 1;
      reasons.push(`Topic: ${hit}`);
    }
  }

  // ── Signals that keep a real catalog from matching nothing ────────────────
  // An imported agenda is mostly UNTAGGED: the source page rarely states an
  // audience for every session. Scoring those 0 meant the common case — import
  // a conference, pick two roles — produced an almost empty draft.
  // `segments` only counts as targeting when we actually know the account's
  // segment. Otherwise a fully segment-tagged catalog would score every
  // session 0 for a segment-less account and hand back an empty draft.
  const segmentsTarget = Boolean(segment) && (tags.segments ?? []).length > 0;
  const untargeted =
    (tags.roles ?? []).length === 0
    && !segmentsTarget
    && (tags.industries ?? []).length === 0
    && (tags.tiers ?? []).length === 0;
  const plenary = /keynote|plenary|general session|opening|closing|welcome/i.test(
    `${session.sessionType ?? ""} ${session.title}`,
  );
  if (plenary) {
    score += 2;
    reasons.push("Everyone attends");
  } else if (untargeted) {
    // Carries no audience signal at all — worth proposing so a sparsely
    // tagged catalog still yields a draft, but never above a real match.
    score += 1;
    reasons.push("Open to all attendees");
  }

  if (session.isReservedSlot) {
    reasons.unshift("Reserved for this account");
  }

  // A reserved slot is a meeting held FOR this account — it is never "for
  // another segment", whatever the catalog says.
  const excludedBySegment = !session.isReservedSlot && sessionExcludedBySegment(session, account);
  return {
    sessionId: session.id,
    score,
    reasons,
    pinned: session.isReservedSlot,
    ...(excludedBySegment ? { excludedBySegment: true } : {}),
  };
}

/** Stable chronological-then-title ordering for agenda display. */
function chronological(a: MatchableSession, b: MatchableSession): number {
  const dayCmp = (a.day ?? "9999-99-99").localeCompare(b.day ?? "9999-99-99");
  if (dayCmp !== 0) return dayCmp;
  const timeCmp = (toMinutes(a.startTime) ?? 24 * 60) - (toMinutes(b.startTime) ?? 24 * 60);
  if (timeCmp !== 0) return timeCmp;
  return a.title.localeCompare(b.title);
}

export function matchAgendaSessions(
  sessions: MatchableSession[],
  account: MatchAccountFacts,
  attendeeRoles: string[],
): MatchAgendaResult {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const considered = sessions
    .slice()
    .sort(chronological)
    .map((s) => scoreSession(s, account, attendeeRoles));

  // Candidates in pick order: pinned first, then score descending, then
  // title for stable ties. Each candidate survives only if it doesn't
  // conflict with an already-picked session.
  const candidates = considered
    // Off-segment sessions never enter the auto-draft. They stay in
    // `considered` for the swap UI — excluded, not hidden.
    .filter((c) => !c.excludedBySegment)
    .filter((c) => c.pinned || c.score > 0)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      const sa = byId.get(a.sessionId);
      const sb = byId.get(b.sessionId);
      return (sa?.title ?? "").localeCompare(sb?.title ?? "");
    });

  const picked: ScoredSession[] = [];
  for (const candidate of candidates) {
    const session = byId.get(candidate.sessionId);
    if (!session) continue;
    const conflicts = picked.some((p) => {
      const other = byId.get(p.sessionId);
      return other ? sessionsConflict(session, other) : false;
    });
    if (!conflicts) picked.push(candidate);
  }

  const selected = picked.sort((a, b) => {
    const sa = byId.get(a.sessionId);
    const sb = byId.get(b.sessionId);
    if (!sa || !sb) return 0;
    return chronological(sa, sb);
  });

  return { selected, considered };
}

/**
 * The role vocabulary actually present in a catalog, most-used first, with the
 * number of sessions carrying each. This is what the builder offers as chips:
 * picking from the catalog's own tags guarantees a role CAN match, which
 * picking from brand personas never did — the two vocabularies are written by
 * different people (a conference tags "Operations", a brand defines "COO").
 *
 * Labels are grouped case-insensitively; the most common spelling wins as the
 * display label.
 */
export function catalogRoleOptions(
  sessions: Pick<MatchableSession, "tags">[],
): { role: string; count: number }[] {
  return catalogTagOptions(sessions, "roles").map((o) => ({ role: o.label, count: o.count }));
}

/**
 * The segment vocabulary this catalog uses — what the rep picks from so they
 * type the CONFERENCE's segment names, not the CRM's. Grouped with the same
 * strictness the matcher uses (segmentsMatch), so the list can't offer
 * "General Contractor" and "General Contractors" as two different choices
 * while the matcher treats them as one.
 */
/**
 * Which segment an agenda matches on.
 *
 * The rep's per-agenda override wins over the account's CRM segment. A
 * conference names its own audiences ("Owners" at the show vs
 * "Owner/Developer" in Salesforce), and the rep is the one who knows which
 * persona the attendee is actually coming as. A blank/whitespace override
 * clears back to the account rather than matching on an empty segment.
 */
export function resolveAgendaSegment(
  account: { segment?: string | null } | null | undefined,
  segmentOverride: string | null | undefined,
): string | null {
  const override = segmentOverride?.trim();
  if (override) return override;
  const fromAccount = account?.segment?.trim();
  return fromAccount ? fromAccount : null;
}

/** Account facts for the matcher, with the agenda's segment resolved in. */
export function agendaMatchFacts(
  account: (MatchAccountFacts & Record<string, unknown>) | null | undefined,
  segmentOverride: string | null | undefined,
): MatchAccountFacts {
  return { ...(account ?? {}), segment: resolveAgendaSegment(account, segmentOverride) };
}

export function catalogSegmentOptions(
  sessions: Pick<MatchableSession, "tags">[],
): { segment: string; count: number }[] {
  return catalogTagOptions(sessions, "segments", normSegment).map((o) => ({ segment: o.label, count: o.count }));
}

/** Shared tally behind the role/segment vocabularies. */
function catalogTagOptions(
  sessions: Pick<MatchableSession, "tags">[],
  axis: "roles" | "segments",
  keyOf: (s: string) => string = norm,
): { label: string; count: number }[] {
  const groups = new Map<string, { label: string; count: number; spellings: Map<string, number> }>();
  for (const session of sessions) {
    // One session shouldn't inflate a role by listing it twice.
    const seen = new Set<string>();
    for (const raw of session.tags?.[axis] ?? []) {
      const label = (raw ?? "").trim();
      if (!label) continue;
      const key = keyOf(label);
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = groups.get(key) ?? { label, count: 0, spellings: new Map() };
      entry.count += 1;
      entry.spellings.set(label, (entry.spellings.get(label) ?? 0) + 1);
      groups.set(key, entry);
    }
  }
  /** Prefer the most-used spelling; on a tie prefer a normally-capitalized
   *  form ("Operations") over lower ("operations") or shouted ("OPERATIONS"). */
  const displayRank = (s: string): number => {
    const hasUpper = /[A-Z]/.test(s);
    const allUpper = s === s.toUpperCase();
    if (hasUpper && !allUpper) return 0;
    if (allUpper) return 1;
    return 2;
  };
  return [...groups.values()]
    .map((e) => ({
      label: [...e.spellings.entries()]
        .sort((a, b) => b[1] - a[1] || displayRank(a[0]) - displayRank(b[0]) || a[0].localeCompare(b[0]))[0][0],
      count: e.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Dedupe key for session re-import: one row per (title, day, start_time)
 * per event. Slugified so cosmetic whitespace/case edits at the source
 * don't create duplicates.
 */
export function sessionSourceKey(title: string, day: string | null | undefined, startTime: string | null | undefined): string {
  const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [slug(title).slice(0, 80), day ?? "", startTime ?? ""].join("@");
}
