/**
 * Spin up a throwaway, in-process Postgres for hermetic integration tests.
 *
 * Why this exists: this repo's `@workspace/db` pool connects to
 * `NEON_DATABASE_URL`, which in dev points at the PRODUCTION Neon database.
 * Any test that needs to exercise real DDL/constraints (FKs, ON DELETE
 * behavior, migrations) must therefore stand up its OWN database so it never
 * touches prod. We use the locally-available Postgres 16 binaries (`initdb` /
 * `pg_ctl`) to create a temp cluster bound to a private unix socket (no TCP, so
 * it can never collide with a running dev server or a parallel test cluster).
 *
 * Caller contract: start the cluster, point `process.env.NEON_DATABASE_URL`
 * (and `DATABASE_URL`) at `connectionString` BEFORE the first `import` of
 * `@workspace/db`, then `stop()` in `afterAll`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface EphemeralPg {
  /** A `postgresql://…?host=<unix-socket-dir>` URL for the temp cluster. */
  connectionString: string;
  /** Stop the cluster and delete its data directory. Safe to call once. */
  stop: () => void;
}

let binariesProbe: boolean | null = null;

/**
 * Whether the LOCAL Postgres binaries this module shells out to exist on PATH.
 * The `dbAvailable` gate probes the NEON host — irrelevant here, since these
 * suites build their own cluster — so on a laptop with reachable Neon but no
 * local Postgres install, an ephemeral suite passes that gate and then dies in
 * `beforeAll` with `initdb ENOENT`. Gate ephemeral suites on THIS instead:
 *
 *   const localPg = pgBinariesAvailable();
 *   describe.skipIf(!localPg)("my ephemeral suite", () => { ... });
 *
 * and early-return from any top-level `beforeAll` when it is false (a skipped
 * describe does not skip file-level hooks). Cached per worker.
 */
export function pgBinariesAvailable(): boolean {
  if (binariesProbe === null) {
    const r = spawnSync("initdb", ["--version"], { encoding: "utf8" });
    binariesProbe = r.status === 0;
    if (!binariesProbe) {
      console.warn(
        "[db-tests] local Postgres binaries (initdb) not found — skipping ephemeral-Postgres suites",
      );
    }
  }
  return binariesProbe;
}

/**
 * Create + start a throwaway Postgres cluster. Throws (with the captured
 * stderr) if `initdb` or `pg_ctl start` fails, so a misconfigured environment
 * surfaces loudly instead of hanging.
 *
 * Implementation note: `pg_ctl start` is given an explicit `-l <logfile>` so the
 * daemonized postmaster's stdio is redirected to a file rather than inherited
 * from `spawnSync`'s pipes — otherwise `spawnSync` blocks forever waiting for an
 * EOF the long-lived child never sends.
 */
export function startEphemeralPg(): EphemeralPg {
  const root = mkdtempSync(path.join(tmpdir(), "pg-it-"));
  const dataDir = path.join(root, "data");
  const sockDir = path.join(root, "sock");
  mkdirSync(sockDir);

  const init = spawnSync(
    "initdb",
    ["-D", dataDir, "-U", "postgres", "--auth=trust", "-E", "UTF8"],
    { encoding: "utf8" },
  );
  if (init.status !== 0) {
    rmSync(root, { recursive: true, force: true });
    throw new Error(`initdb failed (status ${init.status}): ${init.stderr ?? init.error}`);
  }

  const start = spawnSync(
    "pg_ctl",
    [
      "-D", dataDir,
      "-l", path.join(root, "pg.log"),
      // listen_addresses= (empty) → no TCP; -k → unix socket dir only.
      "-o", `-c listen_addresses= -k ${sockDir}`,
      "-w", "-t", "30", "start",
    ],
    { encoding: "utf8" },
  );
  if (start.status !== 0) {
    rmSync(root, { recursive: true, force: true });
    throw new Error(`pg_ctl start failed (status ${start.status}): ${start.stderr ?? start.error}`);
  }

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    spawnSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "stop"], { encoding: "utf8" });
    rmSync(root, { recursive: true, force: true });
  };

  return {
    connectionString: `postgresql://postgres@/postgres?host=${sockDir}`,
    stop,
  };
}
