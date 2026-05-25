/**
 * Cloudflare Worker — Tenant Host Router + R2 Prerender + R2 SPA Assets
 *
 * Sits in front of *.lpstudio.ai and custom tenant domains. Does three
 * things, in order:
 *
 *   1. R2 prerender (task #364): for GET/HEAD requests to a landing-page
 *      URL (/<slug> or /lp/<slug>), look up `<host>/<slug>.html` in the
 *      PRERENDERED_LP R2 bucket. On hit, return the prerendered HTML
 *      directly — no api-server call, no Replit edge round-trip. This is
 *      the resilience tier: visitors get a working page even when the
 *      api-server is down. Written by
 *      artifacts/api-server/src/lib/triggerPublishedRender.ts on publish.
 *
 *   1.5. R2 SPA assets (task #374): for GET/HEAD requests to
 *      `/assets/<file>`, look up `_studio-assets/assets/<file>` in the
 *      same R2 bucket. On hit, serve with `immutable` cache. On miss,
 *      serve a one-shot reload shim with the correct content-type so a
 *      visitor on a stale prerendered HTML page doesn't see a broken
 *      JS/CSS download — the shim reloads once, fetching fresh HTML that
 *      references the *current* asset hashes.
 *
 *      WHY R2 + SHIM (not just origin fallback): Replit's static SPA
 *      rewrite `/* → /index.html` returns text/html for any unmatched
 *      `/assets/*` path. Browsers then refuse to execute / parse it,
 *      producing the "blank tenant page after every redeploy" bug. The
 *      Worker fixing this at the edge means the origin's misbehavior
 *      never reaches the visitor.
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
 * server-side.
 *
 * Deploy:
 *   cd cloudflare/tenant-host-router
 *   npx wrangler secret put WORKER_HOST_SECRET   # paste the same value used in Replit
 *   npx wrangler deploy
 */

const REPLIT_TARGET = "https://image-to-video-ccarey.replit.app";

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

// ── Task #374: R2 SPA assets ────────────────────────────────────────────
//
// The Worker serves `/assets/<file>` from R2 first, and on miss returns a
// content-type-appropriate one-shot reload shim. The shim's purpose is to
// rescue visitors on a *stale prerendered HTML page* whose hashed asset
// references no longer exist anywhere — without it, the browser would
// receive Replit's text/html SPA rewrite for the JS download and the page
// would never finish loading.
//
// Why we don't just rely on the existing main.tsx ChunkLoadError handler:
// that handler only fires for *dynamic imports*. A failed entrypoint
// `<script src="/assets/index-XXXX.js">` never reaches the React app.

const ASSET_MIME = {
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  map: "application/json; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  txt: "text/plain; charset=utf-8",
  wasm: "application/wasm",
};

function extOf(pathname) {
  const dot = pathname.lastIndexOf(".");
  if (dot < 0) return "";
  return pathname.slice(dot + 1).toLowerCase();
}

function mimeForAsset(pathname) {
  const ext = extOf(pathname);
  return ASSET_MIME[ext] ?? "application/octet-stream";
}

// Match Vite's default emit dir; everything under /assets/ is content-
// addressed so the hash → object key relationship is stable.
const ASSET_PATH_RE = /^\/assets\/([^?#]+)$/;
const SHIM_ELIGIBLE_EXT = new Set(["js", "mjs", "css"]);

// One-shot reload, guarded by sessionStorage with window.name fallback so
// we never loop — even in storage-denied contexts (private mode, embedded
// iframes with storage partitioning, users with site-data disabled).
// window.name is per-tab, in-memory, requires no permission, and survives
// same-origin reloads, making it the right belt-and-braces guard.
// CSS gets an empty body (browsers tolerate it). JS in a
// `script type="module"` still runs top-level statements.
const RELOAD_SHIM_JS =
  '(function(){var k="__lp_stale_reload_v1";try{if(typeof sessionStorage!=="undefined"){if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");location.reload();return}}catch(_){}try{if(window.name&&window.name.indexOf(k)>=0)return;window.name=(window.name||"")+k;location.reload()}catch(__){}})();';
const RELOAD_SHIM_CSS =
  '/* lp-studio: stale asset reload — see cloudflare/tenant-host-router/worker.js */';

async function tryR2Asset(env, pathname) {
  const m = pathname.match(ASSET_PATH_RE);
  if (!m) return null;
  if (!env.PRERENDERED_LP) return null;
  const objKey = `_studio-assets/assets/${m[1]}`;
  const obj = await env.PRERENDERED_LP.get(objKey);
  if (!obj) return { hit: false, ext: extOf(pathname) };
  const headers = new Headers({
    "Content-Type": mimeForAsset(pathname),
    // Hashed + content-addressed → safe to mark immutable + 1y.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-LP-Source": "r2-asset",
  });
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  if (obj.uploaded) headers.set("Last-Modified", obj.uploaded.toUTCString());
  return { hit: true, response: new Response(obj.body, { status: 200, headers }) };
}

function reloadShimResponse(pathname) {
  const ext = extOf(pathname);
  if (!SHIM_ELIGIBLE_EXT.has(ext)) return null;
  const body = ext === "css" ? RELOAD_SHIM_CSS : RELOAD_SHIM_JS;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": ext === "css" ? ASSET_MIME.css : ASSET_MIME.js,
      // Do NOT cache the shim — we want subsequent requests after the
      // reload to hit the (now-current) hashed asset, not the shim.
      "Cache-Control": "no-store, max-age=0",
      "X-LP-Source": "stale-asset-shim",
    },
  });
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
    const isGetOrHead = request.method === "GET" || request.method === "HEAD";

    // ── Tier 1: R2 prerender ─────────────────────────────────────────
    if (slug && isGetOrHead) {
      const r2 = await fromR2(env, originalHost, slug);
      if (r2) return r2;
    }

    // ── Tier 1.5: R2 SPA assets (task #374) ──────────────────────────
    // For /assets/* requests, try R2 first. On miss for js/mjs/css,
    // serve the reload shim instead of letting the request fall through
    // to Replit (which would return text/html via the SPA rewrite and
    // break the page). For other extensions (images, fonts, source maps)
    // fall through to origin — they're not load-blocking and the origin
    // has them in `dist/public/assets/*` of the current deploy.
    if (isGetOrHead && url.pathname.startsWith("/assets/")) {
      const asset = await tryR2Asset(env, url.pathname);
      if (asset && asset.hit) return asset.response;
      if (asset && !asset.hit) {
        const shim = reloadShimResponse(url.pathname);
        if (shim) return shim;
      }
      // Non-shim-eligible extensions (images/fonts/maps): fall through to
      // the existing routing so the live origin can serve them.
    }

    // ── Tier 2: Bot OG short-circuit ─────────────────────────────────
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
      } catch (err) {
        console.error("OG bot short-circuit error:", err);
      }
    }

    // ── Tier 3: Passthrough for registered Replit custom domains ─────
    if (PASSTHROUGH_HOSTS.has(originalHost)) {
      return fetch(request);
    }

    // ── Tier 4: Rewrite to Replit edge with X-Original-Host ──────────
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
    rewritten.headers.delete("X-Forwarded-Host");

    return fetch(rewritten);
  },
};
