import express, { type Express, type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getKnownTenantOrigins, WILDCARD_BASE_HOSTS } from "./lib/tenantHosts";

const app: Express = express();

// Trust the first proxy (Cloudflare → origin). Required for correct req.ip
// behind a reverse proxy, and for rate-limiter key extraction.
app.set("trust proxy", 1);

// Security headers — registered first so every response carries them.
// CSP is intentionally omitted here; the frontend uses inline scripts (Vite HMR,
// React) so CSP requires a per-app audit before enabling.
app.use(
  helmet({
    contentSecurityPolicy: false,
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

app.use("/api", router);

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
