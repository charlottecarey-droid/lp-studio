/**
 * Cloudflare Worker — Tenant Host Router
 *
 * Sits in front of *.lpstudio.ai. Replit's deployment edge only honours the
 * Host header for hostnames explicitly registered as custom domains, so any
 * unregistered subdomain (e.g. acme.lpstudio.ai) gets rewritten to the
 * canonical replit.app URL — breaking tenant resolution and OAuth.
 *
 * This worker fixes that by:
 *   1. Forwarding every request to the canonical Replit deployment URL (which
 *      Replit recognises and won't rewrite).
 *   2. Adding X-Original-Host: <real visitor hostname> so the api-server can
 *      still resolve the tenant from the original subdomain.
 *   3. Adding X-Worker-Secret so the api-server knows the header is genuine
 *      and not spoofed by a direct caller.
 *
 * Hosts already registered as Replit custom domains (lpstudio.ai apex,
 * www.lpstudio.ai, app.lpstudio.ai) are passed through untouched.
 *
 * Social-bot OG short-circuit: when a known scraper requests a landing-page
 * URL (/<slug> or /lp/<slug>), we proxy directly to the api-server's
 * /api/lp/og-preview endpoint so the bot sees correct title / description /
 * og:image tags rendered server-side. Without this every tenant subdomain
 * would return the empty SPA index.html to crawlers.
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

    // ── Bot OG short-circuit (works for ALL hosts, including passthroughs) ──
    // Social scrapers don't run JS, so we serve them server-rendered meta tags
    // before doing any host rewriting.
    const slug = extractSlug(url.pathname);
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

    if (PASSTHROUGH_HOSTS.has(originalHost)) {
      return fetch(request);
    }

    // Rewrite the URL so Replit's edge sees a hostname it recognises.
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
