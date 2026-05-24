/**
 * Cloudflare Worker — Landing-Page Prerender Router (task #364)
 *
 * Replaces the previous bot-UA-detection router. Now serves the SAME
 * prerendered HTML to bots AND real browsers for any URL that resolves to
 * a published landing page, with three fallback tiers:
 *
 *   1. R2 binding (`PRERENDERED_LP`)
 *      Native CF binding to bucket `dandy-lp-prerendered`. Zero-latency,
 *      no upstream dependency. Visitor-facing source of truth.
 *      Key layout: `<tenantId>/<encodeURIComponent(slug)>.html`. The
 *      tenant ID is looked up via the api-server first; if api-server is
 *      down we still need the tenant ID, so we cache it in CF Cache API
 *      keyed on host. Cold-cache + api-server-down + unknown tenant is
 *      the only path that degrades to SPA.
 *
 *   2. api-server origin fetch (`/api/lp/rendered/:slug`)
 *      Used when R2 misses (page hasn't been backfilled yet, fresh
 *      publish race window). Response carries our SWR + stale-if-error
 *      headers so CF's edge cache absorbs further outages for ~24h.
 *
 *   3. SPA passthrough (last resort)
 *      `return fetch(request)` — sends the request to the static
 *      lp-studio SPA. Visitor gets a working but SEO-degraded page; bots
 *      get the SPA shell (no per-page meta). This is the documented
 *      degraded state; we surface it via the `X-LP-Source: spa-fallback`
 *      header so probes can detect it.
 *
 * Why we kept the worker (vs retiring it for static-only): R2 binding
 * reads need a worker. There's no other place to put the R2 read so
 * visitors get per-page HTML without round-tripping the api-server.
 *
 * Deploy:
 *   cd cloudflare/og-bot-router
 *   npx wrangler deploy
 *
 * Bindings required (see wrangler.toml):
 *   PRERENDERED_LP  R2 bucket binding → `dandy-lp-prerendered`
 *   API_ORIGIN      vars entry → e.g. "https://ent.meetdandy.com"
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
 * Look up tenant ID for a host. Two paths:
 *   - Fast path: CF Cache API entry keyed on host (24h TTL).
 *   - Slow path: GET `${API_ORIGIN}/api/tenant-by-host?host=…` → JSON
 *     `{tenantId}`. Result is cached for next time.
 *
 * Returns null if api-server is unreachable AND no cached entry exists —
 * that's the documented cold-cache+outage degraded path.
 */
async function resolveTenantId(host, env, ctx) {
  const cacheKey = new Request(`https://internal.tenant-lookup/${encodeURIComponent(host)}`);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const json = await cached.json();
    if (json && typeof json.tenantId === "number") return json.tenantId;
  }
  try {
    const r = await fetch(`${env.API_ORIGIN}/api/tenant-by-host?host=${encodeURIComponent(host)}`, {
      cf: { cacheTtl: 86400 },
    });
    if (!r.ok) return null;
    const json = await r.json();
    if (json && typeof json.tenantId === "number") {
      const cacheResp = new Response(JSON.stringify({ tenantId: json.tenantId }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, cacheResp));
      return json.tenantId;
    }
    return null;
  } catch {
    return null;
  }
}

function r2Key(tenantId, slug) {
  return `${tenantId}/${encodeURIComponent(slug)}.html`;
}

async function fromR2(env, tenantId, slug) {
  if (!env.PRERENDERED_LP) return null;
  const obj = await env.PRERENDERED_LP.get(r2Key(tenantId, slug));
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

    // 1. Resolve tenant.
    const tenantId = await resolveTenantId(url.hostname, env, ctx);

    // 2. Tier 1 — R2 binding (only possible if we know the tenant).
    if (tenantId != null) {
      const r2 = await fromR2(env, tenantId, slug);
      if (r2) return r2;
    }

    // 3. Tier 2 — api-server. CF edge cache + SWR + stale-if-error
    //    handles further outages for ~24h once warm.
    const api = await fromApiServer(env, request, slug);
    if (api) return api;

    // 4. Tier 3 — SPA fallback. Stamp the response so probes can detect
    //    that we landed here.
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
