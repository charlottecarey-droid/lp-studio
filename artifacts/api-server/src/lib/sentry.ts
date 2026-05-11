import * as Sentry from "@sentry/node";

let initialized = false;

export function isSentryInitialized(): boolean {
  return initialized;
}

/**
 * Initialize Sentry for the API server. Called from `src/instrument.ts`,
 * which is loaded via Node's `--import` flag (see package.json `start`)
 * BEFORE the main bundle is evaluated. This ordering is required so that
 * `@sentry/node` can hook the module loader before express is imported,
 * enabling its express/http auto-instrumentation.
 *
 * No-ops if `SENTRY_DSN_BACKEND` is not set so local dev keeps working
 * without a DSN.
 */
export function initSentry(): boolean {
  if (initialized) return true;
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    integrations: [
      Sentry.expressIntegration(),
      Sentry.httpIntegration(),
    ],
    tracesSampleRate: 0,
    beforeSend(event) {
      return scrubPii(event);
    },
  });

  initialized = true;
  return true;
}

const PII_KEYS = new Set([
  "email",
  "email_address",
  "emailaddress",
  "phone",
  "phone_number",
  "phonenumber",
  "address",
  "street",
  "street_address",
  "ip_address",
  "ipaddress",
  "ssn",
  "tax_id",
  "password",
  "first_name",
  "last_name",
  "full_name",
  "name",
]);

function scrubValue(v: unknown): unknown {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(scrubValue);
  if (typeof v === "object") return scrubObject(v as Record<string, unknown>);
  return v;
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEYS.has(k.toLowerCase())) {
      out[k] = "[redacted]";
    } else {
      out[k] = scrubValue(v);
    }
  }
  return out;
}

function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // User context: keep id + tenantId only — never email/username/ip.
  if (event.user) {
    const { id, tenantId } = event.user as { id?: unknown; tenantId?: unknown };
    event.user = {
      ...(id !== undefined ? { id: String(id) } : {}),
      ...(tenantId !== undefined ? { tenantId: String(tenantId) } : {}),
    };
  }
  // Strip raw IPs from request context.
  if (event.request) {
    const req = { ...event.request } as Record<string, unknown> & {
      headers?: Record<string, string>;
      cookies?: unknown;
      data?: unknown;
    };
    if (req.headers) {
      const h = { ...req.headers };
      delete h["authorization"];
      delete h["cookie"];
      delete h["x-forwarded-for"];
      delete h["x-real-ip"];
      req.headers = h;
    }
    delete req.cookies;
    if (req.data && typeof req.data === "object") {
      req.data = scrubObject(req.data as Record<string, unknown>);
    }
    event.request = req as Sentry.ErrorEvent["request"];
  }
  if (event.extra) event.extra = scrubObject(event.extra) as Sentry.ErrorEvent["extra"];
  if (event.contexts) {
    event.contexts = scrubObject(
      event.contexts as unknown as Record<string, unknown>,
    ) as Sentry.ErrorEvent["contexts"];
  }
  return event;
}

export { Sentry };
