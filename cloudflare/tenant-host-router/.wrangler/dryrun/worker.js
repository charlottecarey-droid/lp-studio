var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var REPLIT_TARGET = "https://image-to-video-ccarey.replit.app";
var PASSTHROUGH_HOSTS = /* @__PURE__ */ new Set([
  "lpstudio.ai",
  "www.lpstudio.ai",
  "app.lpstudio.ai"
]);
var BOT_UA_PATTERN = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Googlebot|Applebot|Discordbot|redditbot|pinterest|vkShare|W3C_Validator|bingbot|DuckDuckBot|Embedly|Iframely|SkypeUriPreview|Mastodon|Bluesky/i;
var APP_PATH_DENY = /* @__PURE__ */ new Set([
  "",
  "api",
  "assets",
  "favicon.ico",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "login",
  "logout",
  "signin",
  "signup",
  "auth",
  "callback",
  "preview",
  "p",
  "lp",
  "admin",
  "dashboard",
  "tests",
  "brand",
  "analytics",
  "pages",
  "reviews",
  "templates",
  "conversion-scoring",
  "page-speed",
  "ad-map",
  "amp",
  "programmatic",
  "forms-and-leads",
  "blocks",
  "settings",
  "live-pages",
  "leads",
  "forms",
  "integrations",
  "library",
  "block-defaults",
  "custom-blocks",
  "sales",
  "_next",
  "static",
  "public",
  "manifest.json",
  "service-worker.js"
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
__name(extractSlug, "extractSlug");
function r2Key(host, slug) {
  const normalizedHost = host.split(":")[0].trim().toLowerCase();
  return `${encodeURIComponent(normalizedHost)}/${encodeURIComponent(slug)}.html`;
}
__name(r2Key, "r2Key");
async function fromR2(env, host, slug) {
  if (!env.PRERENDERED_LP) return null;
  const obj = await env.PRERENDERED_LP.get(r2Key(host, slug));
  if (!obj) return null;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400",
    "X-LP-Source": "r2"
  });
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  if (obj.uploaded) headers.set("Last-Modified", obj.uploaded.toUTCString());
  return new Response(obj.body, { status: 200, headers });
}
__name(fromR2, "fromR2");
async function fetchOgPreview(slug, originalHost, proto, secret) {
  const previewUrl = `${REPLIT_TARGET}/api/lp/og-preview/${encodeURIComponent(slug)}`;
  const headers = {
    "X-Original-Host": originalHost,
    "X-Forwarded-Host": originalHost,
    "X-Forwarded-Proto": proto,
    "X-Bot-Router": "1"
  };
  if (secret) headers["X-Worker-Secret"] = secret;
  return fetch(previewUrl, { method: "GET", headers });
}
__name(fetchOgPreview, "fetchOgPreview");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originalHost = url.hostname.toLowerCase();
    const proto = url.protocol.replace(":", "");
    const slug = extractSlug(url.pathname);
    if (slug && (request.method === "GET" || request.method === "HEAD")) {
      const r2 = await fromR2(env, originalHost, slug);
      if (r2) return r2;
    }
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
              "X-OG-Router": "bot"
            }
          });
        }
      } catch (err) {
        console.error("OG bot short-circuit error:", err);
      }
    }
    if (PASSTHROUGH_HOSTS.has(originalHost)) {
      return fetch(request);
    }
    const target = new URL(url.pathname + url.search, REPLIT_TARGET);
    const rewritten = new Request(target.toString(), request);
    rewritten.headers.set("X-Original-Host", originalHost);
    if (env.WORKER_HOST_SECRET) {
      rewritten.headers.set("X-Worker-Secret", env.WORKER_HOST_SECRET);
    } else {
      console.warn(
        "WORKER_HOST_SECRET not configured \u2014 api-server will fall back to Host header and tenant resolution will break."
      );
    }
    rewritten.headers.delete("X-Forwarded-Host");
    return fetch(rewritten);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
