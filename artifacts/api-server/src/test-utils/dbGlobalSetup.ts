/**
 * Vitest globalSetup: probe the integration Postgres ONCE in the runner
 * process, announce loudly when it is unreachable, and stamp the verdict into
 * `process.env.DB_AVAILABLE` so every worker's `dbAvailable` gate (see
 * ./dbAvailable.ts) can read it without re-probing.
 */
import { probeDb } from "./dbAvailable";

export default async function dbGlobalSetup(): Promise<void> {
  // Explicit override wins (DB_AVAILABLE=1 forces the suites on, =0 off) —
  // useful to force-run the gates or to skip probing entirely.
  const preset = process.env.DB_AVAILABLE;
  const ok = preset === "1" ? true : preset === "0" ? false : await probeDb();
  process.env.DB_AVAILABLE = ok ? "1" : "0";
  if (!ok) {
    // One loud summary line — the per-file gates skip silently after this.
    console.warn("[db-tests] Postgres unreachable — skipping integration suites");
  }
}
