// Root superadmin identity for LP Studio.
//
// The "root" superadmin is the single, bootstrap platform-operator account that
// is seeded onto every database (see migrate.ts) and is the only account
// permitted to manage the superadmin roster (list / add / remove other
// superadmins). It is identified purely by email — there is no separate column
// or hierarchy — and it can never be demoted or removed (enforced in the
// management routes).
//
// The identity is configurable via the ROOT_SUPERADMIN_EMAIL env var and
// defaults to admin@lpstudio.ai. Comparison is always case-insensitive and
// whitespace-trimmed so an operator typing "Admin@LPStudio.ai" still resolves.

export const DEFAULT_ROOT_SUPERADMIN_EMAIL = "admin@lpstudio.ai";

/**
 * The canonical root superadmin email, lower-cased and trimmed. Reads
 * ROOT_SUPERADMIN_EMAIL when set, otherwise falls back to the default.
 */
export function getRootSuperadminEmail(): string {
  const raw = process.env.ROOT_SUPERADMIN_EMAIL;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return (trimmed.length > 0 ? trimmed : DEFAULT_ROOT_SUPERADMIN_EMAIL).toLowerCase();
}

/**
 * True when `email` is the configured root superadmin. Case-insensitive and
 * null-safe.
 */
export function isRootSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getRootSuperadminEmail();
}
