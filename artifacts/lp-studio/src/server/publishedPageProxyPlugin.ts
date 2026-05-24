/**
 * Vite middleware that serves prerendered published landing-page HTML for
 * `/:slug` and `/lp/:slug` requests by proxying through the api-server's
 * `/api/lp/rendered/:slug` endpoint (task #364).
 *
 * Why proxy (instead of reading object storage directly):
 *   - The api-server already owns tenant resolution from host, ACL checks,
 *     and the DB recheck-on-serve fail-closed behavior. Duplicating that
 *     here would mean shipping a second Object-Storage SDK + tenant DB
 *     into the lp-studio process for no real win.
 *   - The api-server response carries `Cache-Control: public, s-maxage=300,
 *     stale-while-revalidate=86400, stale-if-error=86400`, so the CDN edge
 *     in front of the deploy holds onto a valid copy and tolerates short
 *     api-server outages without taking published pages down.
 *
 * Fall-through behaviour: any non-200 from the upstream endpoint (404 for
 * drafts / unrendered / unknown slugs / non-published rows; 5xx for api
 * outages once SWR runs out) hands the request back to vite so the SPA
 * mounts as before. Drafts at `/preview/:slug` and authenticated
 * dashboard routes are NEVER touched — only single-segment `/:slug` and
 * `/lp/:slug` are intercepted.
 */
import type { PluginOption } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

/**
 * Single-segment slug paths.  `^\/[a-z0-9][a-z0-9-]*[a-z0-9]$` mirrors the
 * slug pattern enforced server-side in `routes/lp/pages.ts`, plus a
 * single-character fallback (`/a`) that the slug validator also allows.
 * `/lp/<slug>` is the legacy alias kept in App.tsx for backward
 * compatibility; we want it to hit the prerendered cache too.
 */
const ROOT_SLUG = /^\/([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\/?$/;
const LP_SLUG = /^\/lp\/([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\/?$/;

/**
 * SPA chrome paths that share the single-segment shape with slugs but
 * MUST NEVER be intercepted (they are tenant-user dashboard routes that
 * have no corresponding `lp_pages` row and we'd waste a network round-trip
 * + cache-miss on every visit). Sourced from App.tsx route table.
 */
const RESERVED_ROOT_SEGMENTS = new Set([
  "tests", "brand", "analytics", "pages", "reviews", "templates",
  "conversion-scoring", "page-speed", "ad-map", "programmatic",
  "forms-and-leads", "blocks", "settings", "admin", "live-pages",
  "leads", "forms", "integrations", "library", "block-defaults",
  "custom-blocks", "preview", "lp", "api", "assets", "src",
  "privacy", "terms", "login", "logout", "dashboard", "sales",
  "@vite", "@react-refresh", "@id", "@fs", "node_modules",
  "favicon.ico", "robots.txt", "sitemap.xml",
]);

function extractSlug(urlPath: string): string | null {
  const rootMatch = urlPath.match(ROOT_SLUG);
  if (rootMatch) {
    const slug = rootMatch[1];
    if (RESERVED_ROOT_SEGMENTS.has(slug)) return null;
    return slug;
  }
  const lpMatch = urlPath.match(LP_SLUG);
  if (lpMatch) return lpMatch[1];
  return null;
}

/**
 * Resolve the api-server base URL.  Honour an explicit env override first;
 * fall back to the Replit dev-domain proxy path; finally try localhost on
 * the API_PORT used by the vite dev proxy block above. Production deploys
 * are expected to set `INTERNAL_API_BASE_URL` to the api-server's internal
 * service URL so the proxy doesn't loop back through the public CDN.
 */
function resolveApiBaseUrl(): string {
  const override =
    process.env.INTERNAL_API_BASE_URL ||
    process.env.LP_STUDIO_API_BASE_URL ||
    "";
  if (override) return override.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api`;
  }
  const port = process.env.API_PORT || "3001";
  return `http://127.0.0.1:${port}/api`;
}

async function fetchRendered(
  apiBase: string,
  slug: string,
  hostHeader: string | undefined,
  acceptHeader: string | undefined,
): Promise<{ status: number; body: Buffer; headers: Headers } | null> {
  const url = `${apiBase}/lp/rendered/${encodeURIComponent(slug)}`;
  try {
    // Pass through Host + Accept so tenant resolution + content negotiation
    // upstream behave exactly as if the browser had called the endpoint
    // directly. The api-server reads the host via getRequestHost(req).
    const headers: Record<string, string> = {};
    if (hostHeader) headers["host"] = hostHeader;
    if (acceptHeader) headers["accept"] = acceptHeader;
    headers["x-lp-edge-proxy"] = "lp-studio";
    const res = await fetch(url, { headers, redirect: "manual" });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: buf, headers: res.headers };
  } catch (err) {
    // Upstream unreachable — let the SPA take over so the page still loads
    // for the visitor. Logged once at warn so we can spot outages.
    console.warn("[publishedPageProxy] upstream fetch failed", { slug, err });
    return null;
  }
}

function isHtmlRequest(req: IncomingMessage): boolean {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") return false;
  const accept = (req.headers["accept"] || "").toString();
  // Browsers send `text/html,...`; bots like Slackbot send `*/*` — accept
  // both so social-media unfurlers also get the prerendered meta.
  if (!accept) return true;
  if (accept.includes("text/html")) return true;
  if (accept.includes("*/*")) return true;
  return false;
}

function makeMiddleware(apiBase: string) {
  return async function publishedPageProxy(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): Promise<void> {
    try {
      if (!isHtmlRequest(req)) return next();
      const rawUrl = req.url || "/";
      const urlPath = rawUrl.split("?")[0];
      const slug = extractSlug(urlPath);
      if (!slug) return next();

      const result = await fetchRendered(
        apiBase,
        slug,
        req.headers["host"] as string | undefined,
        req.headers["accept"] as string | undefined,
      );
      if (!result || result.status !== 200) return next();

      // Pass through cacheability + the X-LP-Source marker so it's obvious
      // in the browser inspector / CDN logs that the response came from
      // the prerendered store.
      const contentType = result.headers.get("content-type") || "text/html; charset=utf-8";
      const cacheControl = result.headers.get("cache-control");
      const lastModified = result.headers.get("last-modified");
      const lpSource = result.headers.get("x-lp-source") || "prerendered";

      res.statusCode = 200;
      res.setHeader("Content-Type", contentType);
      if (cacheControl) res.setHeader("Cache-Control", cacheControl);
      if (lastModified) res.setHeader("Last-Modified", lastModified);
      res.setHeader("X-LP-Source", lpSource);
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(result.body);
      }
    } catch (err) {
      // Never let proxy logic 500 the request — fall back to SPA.
      console.warn("[publishedPageProxy] unexpected error, falling through", err);
      next();
    }
  };
}

/**
 * Vite plugin entry. Registers the middleware on both dev (`vite`) and
 * production preview (`vite preview`) so the prerendered serving is
 * exercised in development AND when the deploy serves via `vite preview`.
 * In a custom production server (Express/Fastify wrapping the built dist),
 * the same middleware can be lifted out of this file and `app.use(...)`-d
 * directly.
 */
export function publishedPageProxyPlugin(): PluginOption {
  const apiBase = resolveApiBaseUrl();
  const middleware = makeMiddleware(apiBase);
  return {
    name: "lp-studio:published-page-proxy",
    apply: () => true,
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

// Exposed for unit tests.
export const __test = { extractSlug, RESERVED_ROOT_SEGMENTS, resolveApiBaseUrl };
