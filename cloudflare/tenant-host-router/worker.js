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
 *   1.75. Tenant shell: for SPA HTML routes on tenant hosts (vanity link
 *      clicks, root redirects, R2-miss / typo slugs), serve a pristine
 *      Vite-built `tenant-shell.html` from R2 (key
 *      `_studio-assets/tenant-shell.html`) instead of falling through to
 *      Replit's static SPA rewrite — which would return the prerendered
 *      marketing `index.html` and produce a brief flash of the marketing
 *      homepage before React mounts the SaaS / landing-page viewer.
 *      Written by `artifacts/lp-studio/scripts/upload-assets-to-r2.mjs`
 *      on every deploy.
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
  // Task #547 — mirror the prerendered HTML's robots <meta> as an
  // X-Robots-Tag response header. api-server stamps the resolved directive
  // ("noindex", etc.) into the object's customMetadata at upload time; absent
  // means fully allowed, so we emit no header (never a redundant index,follow).
  const xRobots = obj.customMetadata && obj.customMetadata["x-robots"];
  if (xRobots) headers.set("X-Robots-Tag", xRobots);
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

/**
 * Try to fetch the asset from the live origin. Returns the response only
 * when origin is *actually* serving the asset — i.e. status 200 and a
 * sensible content-type. When origin returns Replit's SPA-fallback
 * `index.html` (text/html), 404, or any other non-asset response, we
 * return null so the caller serves the reload shim instead.
 *
 * Why: during a rolling deploy the new lp-studio build is live on origin
 * but its assets haven't been uploaded to R2 yet (or the build hook
 * partially failed). We want those requests to succeed in real time
 * instead of triggering a one-shot reload on every visitor. This path is
 * load-bearing for that transition window.
 */
async function tryOriginAsset(request, url) {
  try {
    const target = new URL(url.pathname + url.search, REPLIT_TARGET);
    // Forward without our auth/X-Original-Host headers — assets are
    // static and don't need tenant context, and we don't want a missing
    // WORKER_HOST_SECRET to break asset fetching.
    const originResp = await fetch(target.toString(), {
      method: request.method,
      headers: { "User-Agent": request.headers.get("user-agent") ?? "lp-router" },
      redirect: "manual",
    });
    if (!originResp.ok) return null;
    const ct = originResp.headers.get("content-type") ?? "";
    // The whole point of this check is to detect Replit's SPA rewrite
    // returning index.html for a missing asset. Anything text/html means
    // the asset isn't really there.
    if (ct.toLowerCase().includes("text/html")) return null;
    // Pass through with cache headers that match R2 hits — these are
    // still content-addressed hashed assets, just served from origin.
    const passHeaders = new Headers(originResp.headers);
    passHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
    passHeaders.set("X-LP-Source", "origin-fallback");
    return new Response(originResp.body, { status: originResp.status, headers: passHeaders });
  } catch (err) {
    // Network blip → let the shim path run; better a one-shot reload
    // than a hung request.
    console.log(
      JSON.stringify({
        event: "lp_origin_asset_fetch_failed",
        path: url.pathname,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return null;
  }
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

// ── Task: tenant-shell fallback (eliminate marketing flash) ──────────────
//
// For SPA HTML routes on tenant hosts (vanity link clicks, root redirects,
// R2-miss / typo slugs), Replit's static SPA rewrite previously served the
// prerendered marketing `index.html`. Visitors saw a brief flash of the
// marketing homepage before the inline boot scripts cleared #root and
// React mounted the SaaS / landing-page viewer.
//
// This handler intercepts those requests at the worker and returns a
// pristine SPA shell (Vite's built index.html, no marketing DOM, no
// MarketingApp CSS) uploaded to R2 by the lp-studio build. The shell is
// short-TTL because it embeds the current build's hashed asset URLs —
// every deploy rewrites it. On R2 miss we fall through to the existing
// Replit-edge rewrite so the worst case is the current (pre-fix)
// behavior, not a hard failure.
const TENANT_SHELL_KEY = "_studio-assets/tenant-shell.html";

// Path segments under which the shell must NOT be served. These are
// either real API endpoints, real static files, or routes already handled
// by other tiers. Everything else on a tenant host is an SPA route that
// should boot the React app via the shell.
function pathNeedsOriginInsteadOfShell(pathname) {
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/api") return true;
  if (pathname.startsWith("/assets/")) return true;
  // /.well-known/* is extensionless but reserved for things like ACME TLS
  // challenges, OIDC discovery, apple-app-site-association — must reach
  // origin, not the SPA shell.
  if (pathname.startsWith("/.well-known/")) return true;
  // Anything with a file extension in the last segment — favicon.ico,
  // robots.txt, sitemap.xml, manifest.json, /lpstudio-favicon.svg, public
  // images. Real SPA routes are extensionless.
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return true;
  return false;
}

async function tryTenantShell(env) {
  if (!env.PRERENDERED_LP) return null;
  const obj = await env.PRERENDERED_LP.get(TENANT_SHELL_KEY);
  if (!obj) return null;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    // Same revalidate-every-request policy index.html uses. The shell
    // embeds hashed asset URLs that change every deploy; a long-cached
    // shell would point at deleted hashes.
    "Cache-Control": "public, max-age=60, must-revalidate",
    "X-LP-Source": "r2-tenant-shell",
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

// Task #999 — host-level OG (no slug). Serves the tenant's brand-settings
// default share card for bots scraping a tenant/Dandy host root (or an
// app-shell route with no published slug). The api-server resolves the tenant
// from X-Original-Host and emits the default_og_* card; on a host that maps to
// no tenant it 404s and we fall through to the tenant shell / origin.
async function fetchHostOgPreview(originalHost, proto, secret) {
  const previewUrl = `${REPLIT_TARGET}/api/lp/og-host-preview`;
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
    // Hoisted above Tier 1.5 so the stale-asset-shim log can read it
    // without tripping the const TDZ — referencing `ua` before its
    // declaration was throwing a ReferenceError on every /assets/* miss
    // and surfacing as CF 1101 (Worker threw exception) → visitors saw
    // HTTP 500 instead of the reload shim.
    const ua = request.headers.get("user-agent") ?? "";

    // ── Tier 1: R2 prerender ─────────────────────────────────────────
    if (slug && isGetOrHead) {
      const r2 = await fromR2(env, originalHost, slug);
      if (r2) return r2;
    }

    // ── Tier 1.5: R2 SPA assets ──────────────────────────────────────
    // For /assets/* requests, try R2 first. On R2 miss:
    //   - For js/mjs/css: try origin. If origin returns a real asset
    //     (non-text/html, non-404), pass it through — this rescues the
    //     transitional window during a rolling deploy where the new
    //     build's hashes haven't propagated to R2 yet but origin has
    //     them. Only when origin also can't serve the asset (i.e.
    //     Replit's SPA rewrite kicked in and returned text/html) do we
    //     fall back to the reload shim. The shim is the *last resort*
    //     for stale visitors holding HTML that references a hash that
    //     exists nowhere — without it, the browser would receive
    //     text/html for the JS download and the page would never load.
    //   - For other extensions (images, fonts, source maps): fall
    //     through to existing routing as before.
    if (isGetOrHead && url.pathname.startsWith("/assets/")) {
      const asset = await tryR2Asset(env, url.pathname);
      if (asset && asset.hit) return asset.response;
      if (asset && !asset.hit && SHIM_ELIGIBLE_EXT.has(extOf(url.pathname))) {
        const originResponse = await tryOriginAsset(request, url);
        if (originResponse) return originResponse;
        const shim = reloadShimResponse(url.pathname);
        if (shim) {
          // Structured log so we can spot shim incidents at the edge
          // without waiting on the api-server health canary. Surfaces
          // in `wrangler tail` and Cloudflare Logpush. Fields are
          // grep-able; keep the prefix stable.
          console.log(
            JSON.stringify({
              event: "lp_stale_asset_shim_served",
              host: originalHost,
              path: url.pathname,
              ext: extOf(url.pathname),
              ua: ua.slice(0, 120),
            })
          );
          return shim;
        }
      }
      // Non-shim-eligible extensions (images/fonts/maps): fall through to
      // the existing routing so the live origin can serve them.
    }

    // ── Tier 2: Bot OG short-circuit ─────────────────────────────────
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

    // ── Tier 3.2: Host-scoped robots.txt / sitemap.xml ───────────────
    // Without this, /robots.txt and /sitemap.xml on tenant hosts fall
    // through to Tier 4 → the Replit *static SPA* service, which serves
    // the lpstudio.ai marketing public/robots.txt on EVERY host and
    // rewrites the (nonexistent) /sitemap.xml to index.html (text/html —
    // a broken sitemap). Proxy both paths to the api-server's host-aware
    // handlers instead (routes/lp/seo-files.ts), carrying the visitor's
    // real hostname via X-Original-Host + X-Worker-Secret like the OG
    // preview tiers do. Placed AFTER Tier 3 so the lpstudio.ai marketing
    // hosts keep their static robots.txt. On any failure we fall through
    // to Tier 4 (pre-fix behaviour) rather than erroring.
    if (
      isGetOrHead &&
      (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml")
    ) {
      try {
        const seoUrl = `${REPLIT_TARGET}/api/lp${url.pathname}`;
        const headers = {
          "X-Original-Host": originalHost,
          "X-Forwarded-Host": originalHost,
          "X-Forwarded-Proto": proto,
          "User-Agent": ua,
        };
        if (env.WORKER_HOST_SECRET) headers["X-Worker-Secret"] = env.WORKER_HOST_SECRET;
        const seoResp = await fetch(seoUrl, { method: request.method, headers });
        if (seoResp.ok) {
          const outHeaders = new Headers(seoResp.headers);
          outHeaders.set("X-LP-Source", "api-seo-file");
          return new Response(seoResp.body, { status: seoResp.status, headers: outHeaders });
        }
        // 404 from the api-server (e.g. sitemap on a host that maps to no
        // tenant) is a real answer — return it rather than letting the
        // static SPA serve marketing robots/index.html on a tenant host.
        if (seoResp.status === 404) {
          return new Response("Not found", { status: 404, headers: { "X-LP-Source": "api-seo-file" } });
        }
      } catch (err) {
        console.error("robots/sitemap proxy error:", err);
      }
      // 5xx / network failure → fall through to Tier 4.
    }

    // ── Tier 3.25: Bot host-level OG (no slug, or slug preview missed) ─
    // Task #999 — for social/link-preview bots hitting a tenant/Dandy host
    // root or an app-shell route with no published slug, serve the tenant's
    // brand-settings default share card instead of falling through to the
    // tenant shell (whose static title reads "Landing Page Studio"). This is
    // placed AFTER Tier 3 passthrough, so lpstudio.ai hosts (which return
    // there) keep their marketing card and never reach this branch. On a host
    // that maps to no tenant the api-server 404s and we fall through below.
    //
    // Gated to HTML-navigation paths via pathNeedsOriginInsteadOfShell (same
    // guard as the Tier 3.5 tenant-shell): /api/*, /assets/*, /.well-known/*,
    // and any file-extension path (robots.txt, sitemap.xml, favicon, images)
    // must reach their real origin content and NOT be replaced with OG HTML,
    // or crawler/SEO behaviour breaks (e.g. a bot fetching /robots.txt would
    // otherwise get a share card).
    if (
      isGetOrHead &&
      BOT_UA_PATTERN.test(ua) &&
      !pathNeedsOriginInsteadOfShell(url.pathname)
    ) {
      try {
        const response = await fetchHostOgPreview(originalHost, proto, env.WORKER_HOST_SECRET);
        if (response.ok) {
          const html = await response.text();
          return new Response(html, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
              "X-OG-Router": "bot-host",
            },
          });
        }
      } catch (err) {
        console.error("OG bot host short-circuit error:", err);
      }
    }

    // ── Tier 3.5: Tenant-shell for SPA HTML routes ───────────────────
    // Eliminates the marketing-flash visitors used to see on vanity link
    // clicks, root redirects, and R2-miss slugs. See header comment on
    // tryTenantShell() for the full rationale. Guarded to GET/HEAD HTML
    // routes only — /api, /assets, and anything with a file extension
    // continue to flow through to the Replit edge as before. On R2 miss
    // we fall through to Tier 4 so the worst case matches pre-fix
    // behavior (marketing prerender flash) rather than a hard failure.
    if (isGetOrHead && !pathNeedsOriginInsteadOfShell(url.pathname)) {
      const accept = (request.headers.get("accept") ?? "").toLowerCase();
      // Browsers send `Accept: text/html,...` on navigations. Empty
      // accept (curl, some link checkers) is treated as HTML too — the
      // alternative is they hit origin and get the marketing flash.
      const wantsHtml = accept === "" || accept.includes("text/html") || accept.includes("*/*");
      if (wantsHtml) {
        try {
          const shell = await tryTenantShell(env);
          if (shell) return shell;
        } catch (err) {
          console.error("tenant-shell fetch failed:", err);
        }
      }
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
