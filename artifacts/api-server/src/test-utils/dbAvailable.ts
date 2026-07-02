/**
 * DB-availability gate for integration suites that hit the REAL Postgres pool
 * (`@workspace/db`). In Replit/CI-with-DB these suites run; on a laptop with no
 * local Postgres they previously died with ECONNREFUSED. Import the top-level
 * `dbAvailable` boolean and gate the suite:
 *
 *   import { dbAvailable } from "../test-utils/dbAvailable";
 *   describe.skipIf(!dbAvailable)("my integration suite", () => { ... });
 *
 * How it works:
 *   - `vitest.config.ts` registers `dbGlobalSetup.ts`, which TCP-probes the
 *     pool's host:port ONCE in the runner process, prints a single loud
 *     "[db-tests] Postgres unreachable" line when down, and stamps
 *     `process.env.DB_AVAILABLE` ("1"/"0") for the workers.
 *   - This module reads that stamp; if a file is ever run without the global
 *     setup (env var unset), it falls back to its own probe via top-level await
 *     (cached per worker), so gating never silently misreports.
 *
 * The probe is a bare TCP connect (~300 ms cap) — cheap, no driver, and enough
 * to distinguish "no server listening" from "server up" without credentials.
 */
import net from "node:net";

const PROBE_TIMEOUT_MS = 300;

/** host:port of the URL the @workspace/db pool will actually dial. */
function poolTarget(): { host: string; port: number } | null {
  // Same precedence as lib/db/src/index.ts.
  const raw = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!u.hostname) return null; // e.g. unix-socket form — not TCP-probeable
    return { host: u.hostname, port: u.port ? Number(u.port) : 5432 };
  } catch {
    return null;
  }
}

/** One TCP connect attempt with a hard timeout. Never throws. */
export function probeDb(): Promise<boolean> {
  const target = poolTarget();
  if (!target) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const sock = net.connect({ host: target.host, port: target.port });
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(PROBE_TIMEOUT_MS, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

/**
 * Whether the integration DB is reachable. Resolved once per worker via
 * top-level await (vitest test files are ESM, so importing this module
 * transparently awaits it).
 */
export const dbAvailable: boolean =
  process.env.DB_AVAILABLE === "1"
    ? true
    : process.env.DB_AVAILABLE === "0"
      ? false
      : await probeDb();
