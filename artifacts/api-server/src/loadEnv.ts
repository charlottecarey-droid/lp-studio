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

  // Dev/staging ONLY: let a Stripe TEST-mode secret key stand in for the live
  // `STRIPE_SECRET_KEY` so fake (test-mode) payments can be rehearsed without
  // ever touching the published live app. The live app never reaches this
  // branch (NODE_ENV === "production"), so its real Stripe keys are never
  // overridden. `STRIPE_SECRET_KEY_TEST` is therefore SAFE to store as a
  // global Replit Secret — only this dev-gated branch ever reads it.
  if (process.env.STRIPE_SECRET_KEY_TEST) {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY_TEST;
    // The live webhook signing secret cannot verify TEST-mode events. Blank it
    // (unless an explicit STRIPE_WEBHOOK_SECRET_TEST is provided) so the webhook
    // layer falls back to the managed test-mode webhook secret created at boot.
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET_TEST ?? "";
  }
}
