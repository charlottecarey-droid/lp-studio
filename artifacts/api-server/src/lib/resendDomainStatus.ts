/**
 * Per-tenant Resend domain verification lookup.
 *
 * Tenants configure a sending domain (lp_brand_settings.config.salesConsole.sendingDomain)
 * but emails still fail until SPF/DKIM are live in DNS and Resend reports the
 * domain as "verified". This helper calls Resend's GET /domains, finds the
 * tenant's configured sending domain in the list, and returns a normalized
 * status the UI can render as a pill / checklist row.
 *
 * Results are cached in-memory per tenant for CACHE_TTL_MS so polling the
 * Brand Settings page doesn't hammer the Resend API. The cache is keyed by
 * tenantId + domain so changing the domain invalidates the prior entry.
 */

export type ResendDomainVerificationState =
  | "verified"
  | "pending"
  | "not_started"
  | "failed"
  | "temporary_failure"
  | "unknown"
  | "not_found"
  | "not_configured"
  | "api_unavailable";

export interface ResendDomainStatus {
  /** Normalized verification state. */
  status: ResendDomainVerificationState;
  /** The domain that was checked (empty when not configured). */
  domain: string;
  /** Unix ms when this status was fetched / computed. */
  checkedAt: number;
  /** Provider identifier — currently only "resend". */
  provider: "resend";
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  domain: string;
  value: ResendDomainStatus;
  expiresAt: number;
}

const cache = new Map<number, CacheEntry>();

function normalizeStatus(raw: unknown): ResendDomainVerificationState {
  if (typeof raw !== "string") return "unknown";
  const s = raw.toLowerCase();
  if (s === "verified") return "verified";
  if (s === "pending") return "pending";
  if (s === "not_started") return "not_started";
  if (s === "failed") return "failed";
  if (s === "temporary_failure") return "temporary_failure";
  return "unknown";
}

/**
 * Fetch the verification status for `domain` from Resend. Returns
 * "not_configured" when the tenant has no sending domain set,
 * "api_unavailable" when RESEND_API_KEY is missing or the API errors,
 * and "not_found" when the domain isn't registered in the Resend account.
 */
export async function getResendDomainStatus(
  tenantId: number,
  domain: string,
  opts: { force?: boolean } = {},
): Promise<ResendDomainStatus> {
  const normalizedDomain = (domain ?? "").trim().toLowerCase();
  if (!normalizedDomain) {
    return {
      status: "not_configured",
      domain: "",
      checkedAt: Date.now(),
      provider: "resend",
    };
  }

  if (!opts.force) {
    const cached = cache.get(tenantId);
    if (cached && cached.domain === normalizedDomain && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    const value: ResendDomainStatus = {
      status: "api_unavailable",
      domain: normalizedDomain,
      checkedAt: Date.now(),
      provider: "resend",
    };
    // Don't cache api_unavailable as long — if a key gets added we want
    // the next poll to pick it up quickly.
    cache.set(tenantId, { domain: normalizedDomain, value, expiresAt: Date.now() + 30_000 });
    return value;
  }

  try {
    const resp = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const value: ResendDomainStatus = {
        status: "api_unavailable",
        domain: normalizedDomain,
        checkedAt: Date.now(),
        provider: "resend",
      };
      cache.set(tenantId, { domain: normalizedDomain, value, expiresAt: Date.now() + 30_000 });
      return value;
    }
    const body = await resp.json() as { data?: Array<{ name?: string; status?: string }> };
    const list = Array.isArray(body?.data) ? body.data : [];
    const match = list.find(d => (d?.name ?? "").toLowerCase() === normalizedDomain);
    const value: ResendDomainStatus = {
      status: match ? normalizeStatus(match.status) : "not_found",
      domain: normalizedDomain,
      checkedAt: Date.now(),
      provider: "resend",
    };
    cache.set(tenantId, { domain: normalizedDomain, value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.error("getResendDomainStatus error:", err);
    const value: ResendDomainStatus = {
      status: "api_unavailable",
      domain: normalizedDomain,
      checkedAt: Date.now(),
      provider: "resend",
    };
    cache.set(tenantId, { domain: normalizedDomain, value, expiresAt: Date.now() + 30_000 });
    return value;
  }
}

/** Test helper — clear the in-memory cache. */
export function _clearResendDomainStatusCache(): void {
  cache.clear();
}
