/**
 * Cloudflare Worker — OG Bot Router
 *
 * Sits in front of meetdandy.com tenant landing-page hosts
 * (lp.meetdandy.com, partners.meetdandy.com). For requests to landing-page
 * URLs:
 *   • Social media bots  → proxied to the API server's OG preview endpoint
 *                          (returns a static HTML page with correct OG tags)
 *   • Real browsers      → passed straight through to the SPA (normal behaviour)
 *
 * Two URL shapes are recognised as landing pages:
 *   1. /lp/<slug>     — legacy explicit prefix
 *   2. /<slug>        — root-level (the common case for tenant LP domains)
 *
 * Root-slug requests are filtered through APP_PATH_DENY so we don't accidentally
 * hijack SPA routes (/login, /assets/*, /api/*, etc.). Everything that survives
 * is treated as a candidate slug — if the API responds 404 we fall back to the
 * SPA so a bad guess never breaks the site.
 *
 * Deploy:
 *   cd cloudflare/og-bot-router
 *   npx wrangler deploy
 */

// Known social-scraper user-agents.
// Bots on this list don't execute JavaScript, so they need server-rendered OG tags.
const BOT_UA_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Googlebot|Applebot|Discordbot|redditbot|pinterest|vkShare|W3C_Validator|bingbot|DuckDuckBot|Embedly|Iframely|SkypeUriPreview|Mastodon|Bluesky/i;

// The API server that owns the OG preview endpoint.
// In production this is the same origin that handles /api/* traffic.
const API_ORIGIN = "https://ent.meetdandy.com";

// Root-level path segments that are known SPA app routes / static assets and
// must NEVER be treated as candidate landing-page slugs. Only the FIRST
// segment is checked — anything multi-segment (e.g. /tests/123) is also skipped.
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
  // Explicit /lp/<slug>
  const explicit = pathname.match(/^\/lp\/([^/]+)\/?$/);
  if (explicit) return explicit[1];

  // Root-level /<slug>
  const root = pathname.match(/^\/([^/]+)\/?$/);
  if (!root) return null;

  const segment = root[1];
  // Skip files (anything with an extension) and known app paths.
  if (segment.includes(".")) return null;
  if (APP_PATH_DENY.has(segment.toLowerCase())) return null;
  return segment;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = extractSlug(url.pathname);
    if (!slug) {
      return fetch(request);
    }

    const ua = request.headers.get("user-agent") ?? "";
    if (!BOT_UA_PATTERN.test(ua)) {
      // Real browser — let the SPA handle it as normal
      return fetch(request);
    }

    // ── Social bot ────────────────────────────────────────────────────────────
    // Forward to the API server's OG preview endpoint.
    // Pass the original Host header so the API builds the correct canonical URL
    // and resolves the right tenant by host.
    const previewUrl = `${API_ORIGIN}/api/lp/og-preview/${encodeURIComponent(slug)}`;

    const previewRequest = new Request(previewUrl, {
      method: "GET",
      headers: {
        "User-Agent": ua,
        "X-Forwarded-Host": url.hostname,
        "X-Forwarded-Proto": url.protocol.replace(":", ""),
        "X-Bot-Router": "1",
      },
    });

    try {
      const response = await fetch(previewRequest);

      // 404 / 500 — the slug isn't a published page on this tenant. Fall back
      // to the SPA so the bot still gets *something* (and so we never break a
      // real route by mis-detecting it as a slug).
      if (!response.ok) {
        return fetch(request);
      }

      const html = await response.text();
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "X-OG-Router": "bot",
        },
      });
    } catch (err) {
      console.error("OG bot router error:", err);
      return fetch(request);
    }
  },
};
