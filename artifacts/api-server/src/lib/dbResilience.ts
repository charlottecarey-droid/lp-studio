/**
 * Helpers for surviving transient Postgres pool/connection saturation.
 *
 * The DB pool is small (max 10) and shared with periodic background sweeps
 * (asset health check, asset GC, snapshot reconcile, workflow engine,
 * custom-domain poller). When several sweeps burst at once they can briefly
 * occupy every connection, so a foreground request's individual query fails
 * with "Connection terminated due to connection timeout" (pg's
 * `connectionTimeoutMillis`). These are NOT deterministic bugs — the same
 * query succeeds moments later — so a request hot path that does many
 * sequential queries (e.g. a campaign launch looping over contacts) should
 * (a) retry the transient failure a couple of times with a short backoff and
 * (b) when it still fails, report it as a temporary/retryable condition
 * rather than collapsing into an opaque 500.
 */

/**
 * Best-effort classifier for "the DB was briefly unavailable" errors that are
 * safe to retry. Deliberately conservative: only matches connection/pool
 * acquisition failures, never query-level errors (constraint violations,
 * undefined columns, etc.) which must surface loudly.
 */
export function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = typeof (err as { code?: unknown }).code === "string"
    ? ((err as { code: string }).code).toUpperCase()
    : "";
  // Node socket-level transient codes.
  if (["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNREFUSED", "ENETUNREACH"].includes(code)) {
    return true;
  }
  // Postgres "server can't take more connections right now" SQLSTATEs.
  // 53300 = too_many_connections, 57P03 = cannot_connect_now.
  if (code === "53300" || code === "57P03") return true;

  const msg = (err as { message?: unknown }).message;
  if (typeof msg !== "string") return false;
  const m = msg.toLowerCase();
  return (
    m.includes("connection terminated due to connection timeout") ||
    m.includes("timeout exceeded when trying to connect") ||
    m.includes("connection terminated unexpectedly") ||
    m.includes("connection terminated") ||
    m.includes("too many clients") ||
    m.includes("remaining connection slots") ||
    m.includes("sorry, too many clients")
  );
}

/**
 * Run a DB operation, retrying a small number of times when it fails with a
 * transient connection/pool error. Non-transient errors throw immediately so
 * real bugs are never masked. Returns the operation's result.
 */
export async function withDbRetry<T>(
  op: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 150;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === retries) throw err;
      // Linear-ish backoff with a little growth; the pool drains fast once a
      // sweep releases its connections.
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
