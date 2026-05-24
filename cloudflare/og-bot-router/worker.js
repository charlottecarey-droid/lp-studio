/**
 * Cloudflare Worker — Landing-Page Prerender Router (task #364)
 *
 * Serves the SAME prerendered HTML to bots AND real browsers for any URL
 * that resolves to a published landing page, with three fallback tiers:
 *
 *   1. R2 binding (`PRERENDERED_LP`)
 *      Native CF binding to bucket `dandy-lp-prerendered`. Zero-latency,
 *      no upstream dependency. Visitor-facing source of truth.
 *
 *      Key layout: `<host>/<encodeURIComponent(slug)>.html`. Per-host
 *      keys mean the worker resolves a request to an R2 key using ONLY
 *      the request's Host header — no api-server call, no tenant
 *      lookup, no cache to keep warm. The whole point of R2 mirroring
 *      is to survive api-server outages; an api-server-dependent
 *      tenant-resolution step in the read path would defeat that.
 *
 *      api-server writes one object per host the tenant owns
 *      (tenant.domain, tenant.micrositeDomain, and each
 *      `<slug>.<wildcard-base>`). See
 *      artifacts/api-server/src/lib/triggerPublishedRender.ts.
 *
 *   2. api-server origin fetch (`/api/lp/rendered/:slug`)
 *      Used when R2 misses — page hasn't been backfilled yet, fresh
 *      publish race window, or new host added since the last publish.
 *      Response carries our SWR + stale-if-error headers so CF's edge
 *      cache absorbs further outages for ~24h.
 *
 *   3. SPA passthrough (last resort)
 *      `return fetch(request)` — sends the request to the static
 *      lp-studio SPA. Visitor gets a working but SEO-degraded page;
 *      bots get the SPA shell (no per-page meta). Documented degraded
 *      state; we stamp `X-LP-Source: spa-fallback` so probes detect it.
 *
 * Read path is fully self-contained — the worker makes ZERO api-server
 * calls in tier 1. Tier 2 is the first fallback that touches api-server.
 *
 * Deploy:
 *   cd cloudflare/og-bot-router
 *   npx wrangler deploy
 *
 * Bindings required (see wrangler.toml):
 *   PRERENDERED_LP        R2 bucket binding → `dandy-lp-prerendered`
 *   API_ORIGIN            vars entry → e.g. "https://ent.meetdandy.com"
 *   HOST_OVERRIDE_ENABLED (STAGING ONLY) when set to "1", the worker
 *                         honors X-LP-Host or ?__host= to override the
 *                         R2 lookup host. Used for the workers.dev
 *                         staging gate where the request Host header
 *                         is the workers.dev URL, not a tenant host.
 *                         The production env block in wrangler.toml
 *                         does NOT set this var — header/query param
 *                         are silently ignored in production, so they
 *                         can't be spoofed even if an attacker sends
 *                         them.
 */

// Root-level path segments that are known SPA app routes / static assets
// and must NEVER be treated as candidate landing-page slugs.
const APP_PATH_DENY = new Set([
  "", "api", "assets", "favicon.ico", "favicon.svg", "robots.txt", "sitemap.xml",
  "login", "logout", "signin", "signup", "auth", "callback",
  "preview", "p", "lp", "admin", "dashboard",
  "tests", "brand", "analytics", "pages", "reviews", "templates",
  "conversion-scoring", "page-speed", "ad-map", "amp", "programmatic",
  "forms-and-leads", "blocks", "settings", "live-pages", "leads", "forms",
  "integrations", "library", "block-defaults", "custom-blocks", "sales",
  "_next", "static", "public", "manifest.json", "service-worker.js",
]);

/** Returns the slug to look up, or null if this path isn't a landing page. */
function extractSlug(pathname) {
  const explicit = pathname.match(/^\/lp\/([^/]+)\/?$/);
  if (explicit) return explicit[1];
  const root = pathname.match(/^\/([^/]+)\/?$/);
  if (!root) return null;
  const segment = root[1];
  if (segment.includes(".")) return null;
  if (APP_PATH_DENY.has(segment.toLowerCase())) return null;
  return segment;
}

/**
 * Build the R2 key for a (host, slug) pair. MUST match the keying
 * function in artifacts/api-server/src/lib/r2Storage.ts — host is
 * lowercased + port-stripped, then both parts are encodeURIComponent'd
 * (defense in depth — hostnames don't legally contain `/` and slugs
 * are already URL-safe per schema validation, but we want zero
 * ambiguity at the storage layer).
 */
function r2Key(host, slug) {
  const normalizedHost = host.split(":")[0].trim().toLowerCase();
  return `${encodeURIComponent(normalizedHost)}/${encodeURIComponent(slug)}.html`;
}

async function fromR2(env, host, slug) {
  if (!env.PRERENDERED_LP) return null;
  const obj = await env.PRERENDERED_LP.get(r2Key(host, slug));
  if (!obj) return null;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400",
    "X-LP-Source": "r2",
  });
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  if (obj.uploaded) headers.set("Last-Modified", obj.uploaded.toUTCString());
  return new Response(obj.body, { status: 200, headers });
}

async function fromApiServer(env, request, slug) {
  const url = new URL(request.url);
  const upstream = `${env.API_ORIGIN}/api/lp/rendered/${encodeURIComponent(slug)}`;
  const upstreamReq = new Request(upstream, {
    method: "GET",
    headers: {
      "User-Agent": request.headers.get("user-agent") ?? "",
      "X-Forwarded-Host": url.hostname,
      "X-Forwarded-Proto": url.protocol.replace(":", ""),
      "X-LP-Worker": "1",
    },
    cf: {
      cacheTtl: 300,
      cacheTtlByStatus: { "200-299": 300, "404": 60, "500-599": 0 },
      cacheEverything: true,
    },
  });
  try {
    const r = await fetch(upstreamReq);
    if (r.status !== 200) return null;
    const headers = new Headers(r.headers);
    headers.set("X-LP-Source", "api-server");
    return new Response(r.body, { status: 200, headers });
  } catch {
    return null;
  }
}

/**
 * Resolve the host used for R2 key lookup. Normally `url.hostname`,
 * but on staging (HOST_OVERRIDE_ENABLED === "1") we accept an override
 * via `X-LP-Host` header or `?__host=` query param so the gate script
 * can exercise per-host keys from the workers.dev URL. In production
 * the env var is absent, so the override is silently ignored.
 */
function resolveLookupHost(url, request, env) {
  if (env.HOST_OVERRIDE_ENABLED !== "1") return url.hostname;
  const headerOverride = request.headers.get("x-lp-host");
  if (headerOverride && headerOverride.trim()) return headerOverride.trim();
  const queryOverride = url.searchParams.get("__host");
  if (queryOverride && queryOverride.trim()) return queryOverride.trim();
  return url.hostname;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = extractSlug(url.pathname);
    if (!slug) return fetch(request);

    // Method gate: only GET/HEAD go through the prerender path.
    // Everything else is dynamic (form submits, etc.) — passthrough.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fetch(request);
    }

    const lookupHost = resolveLookupHost(url, request, env);

    // Tier 1 — R2 binding. Keyed by lookup host directly.
    // If api-server is down right now, this still works — we make NO
    // upstream call in this tier.
    const r2 = await fromR2(env, lookupHost, slug);
    if (r2) return r2;

    // Tier 2 — api-server. CF edge cache + SWR + stale-if-error handle
    // further outages for ~24h once warm.
    const api = await fromApiServer(env, request, slug);
    if (api) return api;

    // Tier 3 — SPA fallback. Stamp the response so probes can detect
    // that we landed here.
    const spa = await fetch(request);
    const headers = new Headers(spa.headers);
    headers.set("X-LP-Source", "spa-fallback");
    return new Response(spa.body, {
      status: spa.status,
      statusText: spa.statusText,
      headers,
    });
  },
};
