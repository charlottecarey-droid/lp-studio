/**
 * True for a Postgres unique-constraint violation (SQLSTATE 23505). Drizzle
 * wraps driver errors in a `DrizzleQueryError` whose own `.code` is undefined
 * and carries the real pg error on `.cause`, so we walk the cause chain rather
 * than only inspecting the top-level error (which would never match → no retry).
 */
export function isUniqueViolation(err: unknown): boolean {
  for (let cur: unknown = err, depth = 0; cur != null && depth < 5; depth++) {
    if (typeof cur === "object" && (cur as { code?: unknown }).code === "23505") return true;
    cur = typeof cur === "object" ? (cur as { cause?: unknown }).cause : null;
  }
  return false;
}
