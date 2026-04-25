import type { Request } from "express";

/**
 * Resolve the request's effective tenant host.
 *
 * Priority order:
 *   1. X-Original-Host — set by the Cloudflare Worker that fronts wildcard
 *      *.lpstudio.ai subdomains (cloudflare/tenant-host-router). Only honoured
 *      when X-Worker-Secret matches the WORKER_HOST_SECRET env var, so a
 *      direct caller cannot spoof the tenant.
 *   2. X-Forwarded-Host — set by Replit's edge for registered custom domains.
 *   3. Host header — final fallback.
 *
 * Returns lowercase hostname with port stripped, or "" if no host present.
 */
export function getRequestHost(req: Request): string {
  const secret = process.env.WORKER_HOST_SECRET;
  if (secret) {
    const provided = pickFirst(req.headers["x-worker-secret"]);
    const original = pickFirst(req.headers["x-original-host"]);
    if (original && provided && provided === secret) {
      return normalizeHost(original);
    }
  }

  const fwd = pickFirst(req.headers["x-forwarded-host"]);
  if (fwd) return normalizeHost(fwd);

  const host = pickFirst(req.headers.host);
  return normalizeHost(host);
}

/**
 * Resolve the request's effective protocol (http/https), preferring
 * X-Forwarded-Proto and falling back to req.protocol.
 */
export function getRequestProto(req: Request): string {
  const fwd = pickFirst(req.headers["x-forwarded-proto"]);
  if (fwd) return fwd.split(",")[0].trim().toLowerCase();
  return (req.protocol || "https").toLowerCase();
}

/**
 * Resolve the request's effective origin (proto://host) for building
 * canonical / outbound URLs (e.g. visit-alert email links). Honours the
 * Cloudflare Worker's X-Original-Host so wildcard tenant subdomains
 * generate URLs at the visitor's actual hostname rather than the
 * canonical replit.app URL.
 */
export function getRequestOrigin(req: Request): string {
  const host = getRequestHost(req);
  if (!host) return "";
  return `${getRequestProto(req)}://${host}`;
}

/**
 * Express headers can be `string | string[] | undefined` (a duplicated header
 * arrives as an array). Always normalize to the first value as a string so
 * downstream `.split` / comparisons don't throw.
 */
function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeHost(value: string): string {
  return value.split(",")[0].split(":")[0].trim().toLowerCase();
}
