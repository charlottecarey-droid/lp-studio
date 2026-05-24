/**
 * Cloudflare Worker — Tenant Host Router + R2 Prerender (task #364)
 *
 * Sits in front of *.lpstudio.ai. Does two things, in order:
 *
 *   1. R2 prerender (task #364): for GET/HEAD requests to a landing-page
 *      URL (/<slug> or /lp/<slug>), look up `<host>/<slug>.html` in the
 *      PRERENDERED_LP R2 bucket. On hit, return the prerendered HTML
 *      directly — no api-server call, no Replit edge round-trip. This is
 *      the resilience tier: visitors get a working page even when the
 *      api-server is down. Written by
 *      artifacts/api-server/src/lib/triggerPublishedRender.ts on publish.
 *
 *   2. Host routing (pre-existing): for everything that R2 didn't serve,
 *      forward to the canonical Replit deployment URL with the visitor's
 *      real hostname carried in X-Original-Host. Replit's deployment edge
 *      only honours the Host header for hostnames explicitly registered
 *      as custom domains; for any unregistered subdomain it silently
 *      rewrites the host to the deployment's canonical URL, breaking
 *      tenant resolution and OAuth. This worker fixes that by sending the
 *      request to the canonical URL (which Replit accepts) and passing
 *      the real hostname via X-Original-Host + X-Worker-Secret.
 *
 *      Hosts already registered as Replit custom domains (lpstudio.ai
 *      apex, www.lpstudio.ai, app.lpstudio.ai) are passed through
 *      untouched.
 *
 * Social-bot OG fallback: when R2 misses and a known scraper requests a
 * landing-page URL, we proxy directly to /api/lp/og-preview/:slug so the
 * bot sees correct title / description / og:image tags rendered
 * server-side. Without this every tenant subdomain would return the empty
 * SPA index.html to crawlers. (R2 hit obviates this — prerendered HTML
 * has the full OG tags baked in.)
 *
 * Deploy:
 *   cd cloudflare/tenant-host-router
 *   npx wrangler secret put WORKER_HOST_SECRET   # paste the same value used in Replit
 *   npx wrangler deploy
 */

const REPLIT_TARGET = "https://image-to-video-ccarey.replit.app";

// Hosts that are already registered as Replit custom domains and resolve
// correctly without rewriting. Matching the route pattern *.lpstudio.ai/*
// will also catch app.lpstudio.ai, so we explicitly let it through.
const PASSTHROUGH_HOSTS = new Set([
  "lpstudio.ai",
  "www.lpstudio.ai",
  "app.lpstudio.ai",
]);

const BOT_UA_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Googlebot|Applebot|Discordbot|redditbot|pinterest|vkShare|W3C_Validator|bingbot|DuckDuckBot|Embedly|Iframely|SkypeUriPreview|Mastodon|Bluesky/i;

// Root-level path segments that are SPA app routes / assets and must NEVER be
// treated as landing-page slug candidates.
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
 * lowercased + port-stripped, then both parts are encodeURIComponent'd.
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
    "Cache-Control":
      "public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400",
    "X-LP-Source": "r2",
  });
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  if (obj.uploaded) headers.set("Last-Modified", obj.uploaded.toUTCString());
  return new Response(obj.body, { status: 200, headers });
}

async function fetchOgPreview(slug, originalHost, proto, secret) {
  const previewUrl = `${REPLIT_TARGET}/api/lp/og-preview/${encodeURIComponent(slug)}`;
  const headers = {
    "X-Original-Host": originalHost,
    "X-Forwarded-Host": originalHost,
    "X-Forwarded-Proto": proto,
    "X-Bot-Router": "1",
  };
  if (secret) headers["X-Worker-Secret"] = secret;
  return fetch(previewUrl, { method: "GET", headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originalHost = url.hostname.toLowerCase();
    const proto = url.protocol.replace(":", "");
    const slug = extractSlug(url.pathname);

    // ── Tier 1: R2 prerender (task #364) ──────────────────────────────
    // For GET/HEAD requests to a landing-page URL, try R2 first.
    // Keyed by the visitor's host. Zero upstream dependency — survives
    // api-server outages. R2 hit also serves bots correctly because the
    // prerendered HTML has full OG meta tags baked in.
    if (
      slug &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const r2 = await fromR2(env, originalHost, slug);
      if (r2) return r2;
    }

    // ── Tier 2: Bot OG short-circuit ──────────────────────────────────
    // R2 missed (page not yet backfilled, fresh publish race, or new
    // host). Bots can't run JS, so give them minimal server-rendered meta
    // tags via the og-preview endpoint rather than the empty SPA shell.
    const ua = request.headers.get("user-agent") ?? "";
    if (slug && BOT_UA_PATTERN.test(ua)) {
      try {
        const response = await fetchOgPreview(slug, originalHost, proto, env.WORKER_HOST_SECRET);
        if (response.ok) {
          const html = await response.text();
          return new Response(html, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
              "X-OG-Router": "bot",
            },
          });
        }
        // Not a published page — fall through to normal routing below.
      } catch (err) {
        console.error("OG bot short-circuit error:", err);
        // Fall through to normal routing.
      }
    }

    // ── Tier 3: Passthrough for registered Replit custom domains ──────
    if (PASSTHROUGH_HOSTS.has(originalHost)) {
      return fetch(request);
    }

    // ── Tier 4: Rewrite to Replit edge with X-Original-Host ───────────
    // Replit's edge only honours Host for registered custom domains; for
    // anything else it silently rewrites to the canonical replit.app URL
    // and tenant resolution dies. We send the request to the canonical
    // URL ourselves and pass the real hostname via X-Original-Host. The
    // api-server's getRequestHost helper trusts that header only when
    // paired with the X-Worker-Secret shared secret.
    const target = new URL(url.pathname + url.search, REPLIT_TARGET);
    const rewritten = new Request(target.toString(), request);

    rewritten.headers.set("X-Original-Host", originalHost);
    if (env.WORKER_HOST_SECRET) {
      rewritten.headers.set("X-Worker-Secret", env.WORKER_HOST_SECRET);
    } else {
      console.warn(
        "WORKER_HOST_SECRET not configured — api-server will fall back to Host header and tenant resolution will break."
      );
    }

    // Drop any inherited X-Forwarded-Host so the api-server falls through
    // to our X-Original-Host (Replit's edge will set its own X-Forwarded-Host
    // to the canonical replit.app URL — useless for tenant routing).
    rewritten.headers.delete("X-Forwarded-Host");

    return fetch(rewritten);
  },
};
