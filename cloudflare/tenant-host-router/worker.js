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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originalHost = url.hostname.toLowerCase();

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
