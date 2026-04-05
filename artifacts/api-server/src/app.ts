import express, { type Express, type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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

function buildAllowedOrigins(): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [...ALLOWED_ORIGINS_PROD];
  if (process.env.NODE_ENV !== "production") {
    // localhost on any port
    origins.push(/^http:\/\/localhost(:\d+)?$/);
    origins.push(/^http:\/\/127\.0\.0\.1(:\d+)?$/);
    // Replit dev domain — only allow the specific app domain, not any replit subdomain.
    // Using broad patterns like /.replit.dev$/ or /.repl.co$/ allows malicious actors to
    // register arbitrary subdomains and bypass CORS checks. Instead, we whitelist only
    // the specific development domain provided by the deployment environment.
    const replitDev = process.env.REPLIT_DEV_DOMAIN;
    if (replitDev) origins.push(`https://${replitDev}`);
  }
  return origins;
}

app.use(
  cors({
    origin: buildAllowedOrigins(),
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
