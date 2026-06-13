// This module is loaded via Node's `--import` flag BEFORE the main bundle
// is evaluated (see package.json `start` script). Loading Sentry here is the
// only way to guarantee that `@sentry/node`'s express auto-instrumentation
// hooks into Node's module loader before any other module imports express.
//
// The previous approach — calling `initSentry()` at the top of index.ts and
// then dynamically importing the server — does not survive esbuild bundling:
// dynamic imports of internal modules get inlined back into a single bundle,
// so by the time `Sentry.init` runs, the bundled express has already been
// evaluated.
// Loads the root/local `.env` with `override: true` BEFORE anything else so a
// stale injected env var (e.g. a cached Replit Secret) cannot win over the
// checked-in dev `.env`. See src/loadEnv.ts.
import "./loadEnv";

import { initSentry } from "./lib/sentry";
initSentry();

// Process-level safety net (loaded before the server via --import). A stray
// rejection from a fire-and-forget background task — e.g. a boot-time poller
// whose `await pool.connect()` hits the DB connection timeout — must NOT take
// down the whole web server. Node's default for an unhandled rejection is to
// terminate the process, which on a fresh deploy means the port never opens
// and the healthcheck fails (looks like a publish failure, is actually a
// startup crash). We log to Sentry + stderr and KEEP RUNNING: a background
// task losing one tick is strictly better than a dead deployment. A rejected
// background promise cannot corrupt request-handler state, so staying up is safe.
import * as Sentry from "@sentry/node";

process.on("unhandledRejection", (reason) => {
  try {
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
      tags: { source: "unhandledRejection" },
    });
  } catch {
    /* Sentry not configured / failed — fall through to stderr */
  }
  console.error("[unhandledRejection] background promise rejected (kept alive):", reason);
});

process.on("uncaughtException", (err) => {
  try {
    Sentry.captureException(err, { tags: { source: "uncaughtException" } });
  } catch {
    /* ignore */
  }
  console.error("[uncaughtException] (kept alive):", err);
});
