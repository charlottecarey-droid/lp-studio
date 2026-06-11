// Dev/staging safety: force the root `.env` to OVERRIDE environment variables
// that are already present in the process when this module loads (for example a
// stale Replit Secret value that the workflow supervisor cached at container
// boot). Node's `--env-file` flag does NOT override pre-set variables, so
// without this a stale injected `NEON_DATABASE_URL` silently wins and points the
// app at the wrong database. Loading `.env` here with `override: true` makes the
// checked-in dev `.env` the authoritative source for this fork.
//
// In a production deployment the root `.env` file does not exist, so `override`
// has nothing to apply and this is a no-op.
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env"), override: true });
config({ path: resolve(process.cwd(), ".env"), override: true });
