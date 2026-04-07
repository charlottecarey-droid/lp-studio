/**
 * Cloudflare Worker — OG Bot Router
 *
 * Sits in front of partners.meetdandy.com. For requests to /lp/:slug:
 *   • Social media bots  → proxied to the API server's OG preview endpoint
 *                          (returns a static HTML page with correct OG tags)
 *   • Real browsers      → passed straight through to the SPA (normal behaviour)
 *
 * All other routes are passed through untouched.
 *
 * Deploy:
 *   cd cloudflare/og-bot-router
 *   npx wrangler deploy
 */

// Known social-scraper user-agents.
// Bots on this list don't execute JavaScript, so they need server-rendered OG tags.
const BOT_UA_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot-LinkExpanding|TelegramBot|WhatsApp|Googlebot|Applebot|Discordbot|redditbot|pinterest|vkShare|W3C_Validator|bingbot|DuckDuckBot/i;

// The API server that owns the OG preview endpoint.
// In production this is the same origin that handles /api/* traffic.
const API_ORIGIN = "https://ent.meetdandy.com";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only intercept /lp/<slug> paths (ignore /lp/ with no slug)
    const lpMatch = url.pathname.match(/^\/lp\/([^/]+)\/?$/);
    if (!lpMatch) {
      // Not an LP page — pass through unchanged
      return fetch(request);
    }

    const slug = lpMatch[1];
    const ua = request.headers.get("user-agent") ?? "";

    if (!BOT_UA_PATTERN.test(ua)) {
      // Real browser — let the SPA handle it as normal
      return fetch(request);
    }

    // ── Social bot ────────────────────────────────────────────────────────────
    // Forward to the API server's OG preview endpoint.
    // Pass the original Host header so the API builds the correct canonical URL.
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

      // Return the OG HTML with the original status code.
      // Strip the refresh redirect for bots — they just need the tags, not a redirect.
      const html = await response.text();
      return new Response(html, {
        status: response.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "X-OG-Router": "bot",
        },
      });
    } catch (err) {
      // On any error fall back to the SPA — better than a broken page
      console.error("OG bot router error:", err);
      return fetch(request);
    }
  },
};
