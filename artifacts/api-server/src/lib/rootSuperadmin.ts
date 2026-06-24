// Root superadmin identity for LP Studio.
//
// The "root" superadmins are the bootstrap platform-operator accounts that are
// seeded onto every database (see migrate.ts) and are the only accounts
// permitted to manage the superadmin roster (list / add / remove other
// superadmins). They are identified purely by email — there is no separate
// column or hierarchy — and they can never be demoted or removed (enforced in
// the management routes).
//
// There are two always-on root accounts (admin@lpstudio.ai and
// charlotte.carey@meetdandy.com); additional roots may be configured via the
// ROOT_SUPERADMIN_EMAIL env var (a single email or a comma/space/semicolon
// separated list) — these are ADDITIVE, so the two built-ins are always roots
// regardless of the env. Comparison is always case-insensitive and
// whitespace-trimmed so an operator typing "Admin@LPStudio.ai" still resolves.

export const DEFAULT_ROOT_SUPERADMIN_EMAIL = "admin@lpstudio.ai";

// The built-in root superadmins. These always hold the superadmin role and can
// never be removed, independent of any env configuration or DB state.
export const ALWAYS_ROOT_SUPERADMIN_EMAILS = [
  "admin@lpstudio.ai",
  "charlotte.carey@meetdandy.com",
] as const;

/**
 * Parse the ROOT_SUPERADMIN_EMAIL env var into a list of lower-cased, trimmed
 * emails. Accepts a single email or a comma/space/semicolon separated list.
 */
function parseEnvRootSuperadminEmails(): string[] {
  const raw = process.env.ROOT_SUPERADMIN_EMAIL;
  if (typeof raw !== "string") return [];
  return raw
    .split(/[,\s;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * The full set of root superadmin emails — the always-on built-ins UNIONed with
 * any configured via ROOT_SUPERADMIN_EMAIL — all lower-cased, trimmed and
 * de-duplicated.
 */
export function getRootSuperadminEmails(): string[] {
  const set = new Set<string>();
  for (const e of ALWAYS_ROOT_SUPERADMIN_EMAILS) set.add(e.toLowerCase());
  for (const e of parseEnvRootSuperadminEmails()) set.add(e);
  return [...set];
}

/**
 * The primary root superadmin email, lower-cased and trimmed. Used for display
 * and the legacy single-root seed name. Reads the first ROOT_SUPERADMIN_EMAIL
 * entry when set, otherwise falls back to the default (admin@lpstudio.ai).
 */
export function getRootSuperadminEmail(): string {
  const env = parseEnvRootSuperadminEmails();
  return env.length > 0 ? env[0] : DEFAULT_ROOT_SUPERADMIN_EMAIL.toLowerCase();
}

/**
 * True when `email` is one of the configured root superadmins. Case-insensitive
 * and null-safe.
 */
export function isRootSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getRootSuperadminEmails().includes(email.trim().toLowerCase());
}
