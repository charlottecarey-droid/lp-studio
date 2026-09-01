import { deriveDomainFromEmail, normalizeDomain } from "../emailDomains";

/**
 * Assumed-email guessing for the signals CSV export.
 *
 * When a contact has no email on file, sales still wants an address to try.
 * The guess is derived from the OTHER contacts on the same account whose
 * emails we do know: detect which naming pattern the company uses
 * (jane.doe@ vs jdoe@ vs jane@ …) by majority vote, pick the account's
 * corporate domain the same way, and apply the pattern to this contact's
 * name. Pure string work — deterministic, no I/O — so the CSV route can call
 * it per-row and the whole thing is unit-testable.
 */

/** A same-account contact whose email is known — the evidence for the guess. */
export interface KnownEmailContact {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

/**
 * Local-part patterns we can both DETECT (from a known name+email pair) and
 * APPLY (to a name we're guessing for). Order doubles as the tie-break
 * priority — more common corporate conventions first.
 */
const PATTERNS = [
  "first.last",
  "flast",
  "firstlast",
  "first_last",
  "first-last",
  "f.last",
  "firstl",
  "first",
  "last.first",
  "lastfirst",
  "lastf",
  "last",
] as const;
export type EmailPattern = (typeof PATTERNS)[number];

/** Lowercase, strip accents, keep only a-z0-9 — email local-parts are ascii. */
function cleanNamePart(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Apply a pattern to a name; null when the pattern needs a part we lack. */
export function applyEmailPattern(
  pattern: EmailPattern,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const first = cleanNamePart(firstName);
  const last = cleanNamePart(lastName);
  const f = first.slice(0, 1);
  const l = last.slice(0, 1);
  switch (pattern) {
    case "first.last":  return first && last ? `${first}.${last}` : null;
    case "first_last":  return first && last ? `${first}_${last}` : null;
    case "first-last":  return first && last ? `${first}-${last}` : null;
    case "firstlast":   return first && last ? `${first}${last}` : null;
    case "flast":       return f && last ? `${f}${last}` : null;
    case "f.last":      return f && last ? `${f}.${last}` : null;
    case "firstl":      return first && l ? `${first}${l}` : null;
    case "first":       return first || null;
    case "last.first":  return first && last ? `${last}.${first}` : null;
    case "lastfirst":   return first && last ? `${last}${first}` : null;
    case "lastf":       return f && last ? `${last}${f}` : null;
    case "last":        return last || null;
  }
}

/**
 * Which pattern produced this contact's email local-part, if any. Ambiguous
 * matches resolve to the highest-priority pattern (e.g. a one-word local-part
 * that equals both first and last name reads as "first").
 */
export function detectEmailPattern(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string,
): EmailPattern | null {
  const local = email.trim().toLowerCase().split("@")[0];
  if (!local) return null;
  for (const pattern of PATTERNS) {
    if (applyEmailPattern(pattern, firstName, lastName) === local) return pattern;
  }
  return null;
}

/** Most frequent value; ties resolve to the earliest-inserted key. */
function majority<T>(votes: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount) { best = v; bestCount = n; }
  }
  return best;
}

/**
 * Guess an email for a contact with none on file.
 *
 * Domain: majority corporate domain among the account's known emails (free
 * providers like gmail are ignored — they say nothing about the company),
 * falling back to the account's own domain field. Pattern: majority among
 * the known name+email pairs, defaulting to first.last when the account's
 * emails reveal no pattern. Returns null when there's no domain to guess
 * against, the contact has no usable name, or the guess collides with an
 * address we already know belongs to someone else.
 */
export function guessAssumedEmail(
  contact: { firstName: string | null | undefined; lastName: string | null | undefined },
  accountEmails: KnownEmailContact[],
  accountDomain?: string | null,
): string | null {
  const known = accountEmails.filter((c) => c.email && c.email.includes("@"));

  const domain =
    majority(known.map((c) => deriveDomainFromEmail(c.email)).filter((d): d is string => !!d)) ??
    normalizeDomain(accountDomain);
  if (!domain) return null;

  const pattern =
    majority(
      known
        .map((c) => detectEmailPattern(c.firstName, c.lastName, c.email))
        .filter((p): p is EmailPattern => !!p),
    ) ?? "first.last";

  const local =
    applyEmailPattern(pattern, contact.firstName, contact.lastName) ??
    // Pattern needs a name part this contact lacks — degrade to what we have.
    applyEmailPattern("first", contact.firstName, contact.lastName) ??
    applyEmailPattern("last", contact.firstName, contact.lastName);
  if (!local) return null;

  const guess = `${local}@${domain}`;
  const taken = new Set(known.map((c) => c.email.trim().toLowerCase()));
  return taken.has(guess) ? null : guess;
}
