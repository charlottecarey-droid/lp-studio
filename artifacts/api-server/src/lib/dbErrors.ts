/**
 * Drizzle wraps driver errors in a `DrizzleQueryError` whose own `.code` is
 * undefined and carries the real pg error on `.cause`, so we walk the cause
 * chain rather than only inspecting the top-level error (which would never
 * match). The top-level `.message` also omits the SQLSTATE, so string-matching
 * it is unreliable — always match on the numeric code via this walk.
 */
function hasPgCode(err: unknown, code: string): boolean {
  for (let cur: unknown = err, depth = 0; cur != null && depth < 5; depth++) {
    if (typeof cur === "object" && (cur as { code?: unknown }).code === code) return true;
    cur = typeof cur === "object" ? (cur as { cause?: unknown }).cause : null;
  }
  return false;
}

/** True for a Postgres unique-constraint violation (SQLSTATE 23505). */
export function isUniqueViolation(err: unknown): boolean {
  return hasPgCode(err, "23505");
}

/** True for a Postgres foreign-key-constraint violation (SQLSTATE 23503). */
export function isForeignKeyViolation(err: unknown): boolean {
  return hasPgCode(err, "23503");
}
