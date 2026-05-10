// Tiny bootstrap entry. Sentry is initialised in `src/instrument.ts`, which
// is loaded via Node's `--import` flag (see package.json `start` script) so
// that `@sentry/node` can hook the module loader BEFORE express is imported
// anywhere in the bundle. dotenv is also loaded there for the same reason.
import "./server";
