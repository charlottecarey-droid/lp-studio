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
