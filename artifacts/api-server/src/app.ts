import express, { type Express, type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { Sentry, isSentryInitialized } from "./lib/sentry";
import router from "./routes";
import { logger } from "./lib/logger";
import { getKnownTenantOrigins, WILDCARD_BASE_HOSTS, findTenantByHost, invalidateTenantHostCache } from "./lib/tenantHosts";
import { csrfProtection, csrfErrorHandler, generateCsrfToken } from "./lib/csrf";
import { ObjectStorageService } from "./lib/objectStorage";

const app: Express = express();

// Trust the first proxy (Cloudflare → origin). Required for correct req.ip
// behind a reverse proxy, and for rate-limiter key extraction.
app.set("trust proxy", 1);

// Disable Express's automatic ETag generation. We manage HTTP caching
// explicitly per-route via Cache-Control headers. Auto-generated ETags
// invite browsers / CDNs to send conditional GETs (`If-None-Match`) and
// receive 304 Not Modified responses with empty bodies. Our codegen
// fetch client (`lib/api-client-react/src/custom-fetch.ts`) treats a 304
// as a successful empty payload (`data === null`), which then crashes
// callers like LandingPageViewer that dereference fields on the response.
// Disabling ETag here makes every successful GET return a full 200 body
// — Cache-Control still lets browsers/CDNs reuse the cached body within
// `max-age` without revalidation.
app.set("etag", false);

// Security headers — registered first so every response carries them.
//
// CSP is enabled in REPORT-ONLY mode with a permissive baseline. Violations
// are sent to /api/csp-report and logged via pino. After ~1 week of monitoring
// in production, tighten the policy and flip to enforce mode:
//   TODO(csp-enforce): replace `'unsafe-inline'` for scripts with per-request
//   nonces (Vite html-template plugin emits `<script nonce="…">` tags and the
//   server echoes the same nonce in the `script-src` directive), then set
//   `reportOnly: false`. Track third-party origins surfaced by the report-only
//   logs (Sentry, Resend, Apollo, GTM, RB2B, fonts, etc.) and add them to the
//   appropriate directives before flipping.
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
const replitFrameAncestor = replitDevDomain ? [`https://${replitDevDomain}`, "https://*.replit.dev"] : ["https://*.replit.dev"];

app.use(
  helmet({
    contentSecurityPolicy: {
      reportOnly: true,
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        // 'unsafe-inline' / 'unsafe-eval' are TEMPORARY — required for Vite
        // HMR and inline bootstrap scripts in index.html. Remove once the
        // nonce plumbing TODO above is implemented.
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.googletagmanager.com",
          "https://ddwl4m2hdecbv.cloudfront.net",
          "https://assets.apollo.io",
        ],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "media-src": ["'self'", "data:", "blob:", "https:"],
        "connect-src": [
          "'self'",
          "https://*.ingest.sentry.io",
          "https://*.ingest.us.sentry.io",
          "https://api.resend.com",
          "https://app.apollo.io",
          "https://*.apollo.io",
          "https://www.google-analytics.com",
          "https://*.googletagmanager.com",
        ],
        "frame-ancestors": ["'self'", ...replitFrameAncestor],
        "frame-src": ["'self'", "https://www.googletagmanager.com"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "report-uri": ["/api/csp-report"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(compression());

// CORS — locked to known app domains.
// In non-production environments we also allow localhost variants and the
// Replit dev domain so local development and workflow previews keep working.
const ALLOWED_ORIGINS_PROD = [
  "https://lpstudio.ai",
  "https://www.lpstudio.ai",
  "https://ent.meetdandy.com",
  "https://partners.meetdandy.com",
];

// Static fallbacks (also used in dev). Tenant-configured custom domains are
// resolved dynamically from the database via getKnownTenantOrigins() with a
// 60s cache, and wildcard subdomains of WILDCARD_BASE_HOSTS are also accepted.
function buildStaticOrigins(): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [...ALLOWED_ORIGINS_PROD];
  if (process.env.NODE_ENV !== "production") {
    origins.push(/^http:\/\/localhost(:\d+)?$/);
    origins.push(/^http:\/\/127\.0\.0\.1(:\d+)?$/);
    const replitDev = process.env.REPLIT_DEV_DOMAIN;
    if (replitDev) origins.push(`https://${replitDev}`);
  }
  return origins;
}

const STATIC_ORIGINS = buildStaticOrigins();

function originMatchesStatic(origin: string): boolean {
  for (const o of STATIC_ORIGINS) {
    if (typeof o === "string") { if (o === origin) return true; }
    else if (o.test(origin)) return true;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server requests have no Origin header.
      if (!origin) { cb(null, true); return; }
      if (originMatchesStatic(origin)) { cb(null, true); return; }
      // Resolve the origin's host against the tenant resolver. This handles
      // both custom domains AND wildcard subdomains (<slug>.lpstudio.ai), and
      // — critically — only allows wildcards for slugs that actually map to
      // an active tenant (closes the open-wildcard CORS hole).
      let host: string;
      try { host = new URL(origin).hostname.toLowerCase(); }
      catch { cb(null, false); return; }
      // Bare base host (https://lpstudio.ai) — allow as a static known origin
      // by treating it as part of the wildcard set without slug check.
      for (const base of WILDCARD_BASE_HOSTS) {
        if (host === base) { cb(null, true); return; }
      }
      findTenantByHost(host)
        .then(match => cb(null, !!match))
        .catch(err => {
          logger.warn({ err }, "CORS tenant lookup failed; rejecting origin");
          cb(null, false);
        });
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Test-only helper: invalidate the in-process tenant host cache so direct-DB
// tenant inserts in e2e fixtures (royal-tenant, etc.) become visible without
// waiting out the 60s TTL. Hard-gated on NODE_ENV !== "production".
if (process.env.NODE_ENV !== "production") {
  app.post("/api/_test/invalidate-host-cache", (_req, res) => {
    invalidateTenantHostCache();
    res.json({ ok: true });
  });

  // Dev-only fixture used by e2e/tenant-image-acl.spec.ts (task #226).
  // Uploads a tiny PNG buffer to object storage tagged with the supplied
  // tenant id. Returned URL is the same `/api/storage/objects/uploads/<id>`
  // shape the AI image-generation flow produces, so the spec can prove that
  // a sibling tenant cannot fetch it even with the URL.
  const _testObjectStorageSvc = new ObjectStorageService();
  app.post("/api/_test/upload-tenant-object", async (req, res) => {
    try {
      const tenantIdRaw = req.body?.tenantId;
      const tenantId = typeof tenantIdRaw === "number"
        ? tenantIdRaw
        : Number.parseInt(String(tenantIdRaw ?? ""), 10);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        res.status(400).json({ error: "tenantId is required" });
        return;
      }
      // 1×1 transparent PNG.
      const buffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
        "base64",
      );
      const objectPath = await _testObjectStorageSvc.uploadObjectEntity(
        buffer,
        "image/png",
        { tenantId },
      );
      res.json({ url: `/api/storage${objectPath}`, tenantId });
    } catch (err) {
      logger.error({ err }, "[_test/upload-tenant-object] failed");
      res.status(500).json({ error: "Upload failed" });
    }
  });
}

// CSRF protection (double-submit cookie). Registered AFTER cookieParser and
// the body parsers so the middleware can read req.cookies and req.body.
// Internally exempts GET/HEAD/OPTIONS, /api/webhooks/* (secret-authed),
// /api/_test/* (dev fixtures), the login endpoints, and any request that
// doesn't carry the session cookie. See lib/csrf.ts for the full policy.
app.use(csrfProtection);

// Token endpoint: clients call this once at boot (and again after the auth
// state changes) to obtain a CSRF token + the matching `lp_csrf` cookie.
// GET so it's never blocked by the CSRF check itself.
app.get("/api/auth/csrf", (req, res) => {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

app.use("/api", router);

// CSRF-specific error handler — must come BEFORE the Sentry/global error
// handlers so a missing/invalid token surfaces as a clean 403 instead of a
// sanitized 500 (and isn't reported to Sentry as an unhandled exception).
app.use(csrfErrorHandler);

// Sentry express error handler — must be registered AFTER all routes
// but BEFORE our own global error handler so it can capture the error
// before we sanitize the response.
if (isSentryInitialized()) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler — must be registered after all routes.
// Catches any error passed to next(err) or thrown inside async handlers.
// Sanitizes error responses to prevent information leakage.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    // Sanitize error response: strip SQL table names, stack traces, and internal details
    let sanitized: Record<string, unknown> = { error: "Internal server error" };

    if (err instanceof Error) {
      const message = err.message.toLowerCase();
      // Check for SQL errors and other sensitive patterns
      if (message.includes("table") || message.includes("column") ||
          message.includes("constraint") || message.includes("syntax")) {
        sanitized.error = "Internal server error";
      } else {
        // For non-SQL errors, keep a generic message
        sanitized.error = "Internal server error";
      }
    }

    res.status(500).json(sanitized);
  }
});

export default app;
