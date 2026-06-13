// Dev/staging safety: force the root `.env` to OVERRIDE environment variables
// that are already present in the process when this module loads (for example a
// stale Replit Secret value that the workflow supervisor cached at container
// boot). Node's `--env-file` flag does NOT override pre-set variables, so
// without this a stale injected `NEON_DATABASE_URL` silently wins and points the
// app at the wrong database. Loading `.env` here with `override: true` makes the
// checked-in dev `.env` the authoritative source for this fork.
//
// IMPORTANT: this override is for DEV/STAGING ONLY. The earlier assumption that
// "the root `.env` does not exist in production" is false — an Autoscale build
// ships the workspace filesystem, including the gitignored dev `.env`. That dev
// file holds BLANK placeholders for prod-only secrets (e.g. TURNSTILE_SECRET_KEY
// is empty so the dev preview can skip bot-checks). With `override: true` those
// blanks clobber the real Replit Secrets injected into the deployment, so the
// production boot guards see an empty secret and the app crash-loops on startup.
// In production the injected env (Replit Secrets + userenv) is authoritative, so
// we skip the dev `.env` entirely.
import { config } from "dotenv";
import { resolve } from "node:path";

if (process.env.NODE_ENV !== "production") {
  config({ path: resolve(process.cwd(), "../../.env"), override: true });
  config({ path: resolve(process.cwd(), ".env"), override: true });
}
