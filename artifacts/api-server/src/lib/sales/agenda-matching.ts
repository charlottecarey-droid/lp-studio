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
 *   +2 when the account's industry matches tags.industries
 *   +2 when the account's ABM tier matches tags.tiers
 *   +1 when the account's segment/dsoSize matches a topic tag (weak signal)
 * Reserved slots (is_reserved_slot) are always selected, first in their slot.
 * Non-reserved sessions need score > 0 to be auto-picked; within one time
 * slot only the highest-scoring session survives (ties break on earlier
 * title alphabetically so re-runs are stable).
 */

export interface MatchableSessionTags {
  roles?: string[];
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
  segment?: string | null;
  dsoSize?: string | null;
}

export interface ScoredSession {
  sessionId: number;
  score: number;
  reasons: string[];
  pinned: boolean; // reserved slot — always on the agenda
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
  const untargeted =
    (tags.roles ?? []).length === 0
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

  return { sessionId: session.id, score, reasons, pinned: session.isReservedSlot };
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
  const groups = new Map<string, { label: string; count: number; spellings: Map<string, number> }>();
  for (const session of sessions) {
    // One session shouldn't inflate a role by listing it twice.
    const seen = new Set<string>();
    for (const raw of session.tags?.roles ?? []) {
      const label = (raw ?? "").trim();
      if (!label) continue;
      const key = norm(label);
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
      role: [...e.spellings.entries()]
        .sort((a, b) => b[1] - a[1] || displayRank(a[0]) - displayRank(b[0]) || a[0].localeCompare(b[0]))[0][0],
      count: e.count,
    }))
    .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role));
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
