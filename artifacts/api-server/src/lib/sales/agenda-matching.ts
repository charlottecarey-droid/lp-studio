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
 * Loose label match: exact after normalization, or one label contains the
 * other ("Clinical Director" matches "clinical directors"). Guards against
 * degenerate containment on very short strings.
 */
export function labelsMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length < 3 || nb.length < 3) return false;
  return na.includes(nb) || nb.includes(na);
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
 * Dedupe key for session re-import: one row per (title, day, start_time)
 * per event. Slugified so cosmetic whitespace/case edits at the source
 * don't create duplicates.
 */
export function sessionSourceKey(title: string, day: string | null | undefined, startTime: string | null | undefined): string {
  const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [slug(title).slice(0, 80), day ?? "", startTime ?? ""].join("@");
}
