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

import { platformFromAddress } from "./platformSender";

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
  verifiedListCache = null;
}

// ---------------------------------------------------------------------------
// Verified sending-domain allowlist (Task #597)
//
// The email-template editor lets operators/tenants pick a custom "from" address
// per template. A from-address whose domain isn't verified for sending in
// Resend silently fails (or gets spoof-rejected). These helpers fetch the
// account's verified domains once (cached globally — the Resend domain list is
// account-wide, not per tenant) so both the save-time guard and the editor's
// live warning can check a typed address against the allowed set.
// ---------------------------------------------------------------------------

const VERIFIED_LIST_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface VerifiedListCache {
  value: { domains: string[]; available: boolean };
  expiresAt: number;
}
let verifiedListCache: VerifiedListCache | null = null;

/**
 * The set of verified sending domains in the Resend account. `available` is
 * false when we couldn't determine the list (no RESEND_API_KEY, or the API
 * errored) — callers MUST treat that as "can't verify" and fail open rather
 * than block, so a missing key in dev never wedges template saves.
 */
export async function listVerifiedSendingDomains(
  opts: { force?: boolean } = {},
): Promise<{ domains: string[]; available: boolean }> {
  if (!opts.force && verifiedListCache && verifiedListCache.expiresAt > Date.now()) {
    return verifiedListCache.value;
  }

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    const value = { domains: [] as string[], available: false };
    // Short TTL so a key added later is picked up quickly.
    verifiedListCache = { value, expiresAt: Date.now() + 30_000 };
    return value;
  }

  try {
    const resp = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const value = { domains: [] as string[], available: false };
      verifiedListCache = { value, expiresAt: Date.now() + 30_000 };
      return value;
    }
    const body = (await resp.json()) as { data?: Array<{ name?: string; status?: string }> };
    const list = Array.isArray(body?.data) ? body.data : [];
    const domains = list
      .filter((d) => normalizeStatus(d?.status) === "verified")
      .map((d) => (d?.name ?? "").trim().toLowerCase())
      .filter((n) => n.length > 0);
    const value = { domains: Array.from(new Set(domains)), available: true };
    verifiedListCache = { value, expiresAt: Date.now() + VERIFIED_LIST_TTL_MS };
    return value;
  } catch (err) {
    console.error("listVerifiedSendingDomains error:", err);
    const value = { domains: [] as string[], available: false };
    verifiedListCache = { value, expiresAt: Date.now() + 30_000 };
    return value;
  }
}

/**
 * Extract the lowercase domain from a "from"/"reply-to" value, accepting either
 * a bare address (`a@b.com`) or display-name form (`Acme <a@b.com>`). Returns
 * null when the value contains no plausible address.
 */
export function extractAddressDomain(rawFrom: string): string | null {
  const angle = rawFrom.match(/<([^>]+)>\s*$/);
  const addr = (angle ? angle[1] : rawFrom).trim();
  const m = addr.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  return m ? m[1].toLowerCase() : null;
}

/** Domain of the platform default sender — always allowed (it's what we send from). */
function defaultSenderDomain(): string | null {
  return extractAddressDomain(platformFromAddress());
}

/**
 * The domains an operator may use in a custom from-address: every verified
 * Resend domain plus the platform default's domain. `available` mirrors
 * listVerifiedSendingDomains — false means "couldn't determine".
 */
export async function getAllowedSenderDomains(
  opts: { force?: boolean } = {},
): Promise<{ domains: string[]; available: boolean }> {
  const { domains, available } = await listVerifiedSendingDomains(opts);
  const set = new Set(domains);
  const def = defaultSenderDomain();
  if (def) set.add(def);
  return { domains: Array.from(set), available };
}

export interface SenderDomainCheck {
  /** true = allowed to save (verified / default domain, OR undeterminable). */
  allowed: boolean;
  /** extracted lowercase domain, or null when the value has no address. */
  domain: string | null;
  /** whether the verified list could be fetched (false = couldn't determine). */
  available: boolean;
  /** the allowed domains, to surface in messaging. */
  allowedDomains: string[];
}

/**
 * Check a custom from-address against the verified sending-domain allowlist.
 * Fails OPEN when the list is undeterminable (no key / API down) or the value
 * has no parseable domain (format validation handles the latter elsewhere).
 */
export async function checkSenderDomain(rawFrom: string): Promise<SenderDomainCheck> {
  const domain = extractAddressDomain(rawFrom);
  const { domains, available } = await getAllowedSenderDomains();
  if (!available || !domain) {
    return { allowed: true, domain, available, allowedDomains: domains };
  }
  return { allowed: domains.includes(domain), domain, available, allowedDomains: domains };
}

// ---------------------------------------------------------------------------
// Resend Domains write API (create / get-by-id / delete)
//
// Groundwork for the downstream domain-provisioning tasks (auto branded
// subdomain + self-serve custom-domain wizard). Each wrapper fails OPEN to a
// non-throwing `{ available: false }` shape when RESEND_API_KEY is missing or
// the API errors, so callers in dev (no key) never crash — they treat the
// result as "couldn't provision" instead.
// ---------------------------------------------------------------------------

/** A single DNS record Resend wants set for a domain (SPF / DKIM / etc). */
export interface ResendDnsRecord {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

/** Normalized domain object returned by the Resend Domains API. */
export interface ResendDomain {
  id: string;
  name: string;
  status: ResendDomainVerificationState;
  records: ResendDnsRecord[];
}

/**
 * Result envelope for the write wrappers. `available` is false when we
 * couldn't reach the API (no key / network / non-2xx); inspect `error` then.
 * On success `available` is true and `domain` is populated (except delete,
 * which only returns `available`).
 */
export interface ResendDomainWriteResult {
  available: boolean;
  domain?: ResendDomain;
  error?: string;
}

function normalizeDomainPayload(raw: unknown): ResendDomain | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { id?: unknown; name?: unknown; status?: unknown; records?: unknown };
  if (typeof r.id !== "string" || typeof r.name !== "string") return undefined;
  return {
    id: r.id,
    name: r.name.toLowerCase(),
    status: normalizeStatus(r.status),
    records: Array.isArray(r.records) ? (r.records as ResendDnsRecord[]) : [],
  };
}

/**
 * Register a new sending domain in Resend. Returns the created domain (with
 * the DNS records the caller must publish). Fails open to
 * `{ available: false }` when there's no API key or the call errors.
 */
export async function createResendDomain(name: string): Promise<ResendDomainWriteResult> {
  const normalized = (name ?? "").trim().toLowerCase();
  if (!normalized) return { available: false, error: "empty domain name" };

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { available: false, error: "no RESEND_API_KEY" };

  try {
    const resp = await fetch("https://api.resend.com/domains", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalized }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "(unreadable)");
      return { available: false, error: `Resend create failed (${resp.status}): ${body}` };
    }
    const domain = normalizeDomainPayload(await resp.json());
    return domain ? { available: true, domain } : { available: false, error: "malformed Resend response" };
  } catch (err) {
    return { available: false, error: String(err) };
  }
}

/**
 * Fetch a single domain (and its current DNS-record verification states) by
 * its Resend id. Fails open to `{ available: false }`.
 */
export async function getResendDomainById(id: string): Promise<ResendDomainWriteResult> {
  const domainId = (id ?? "").trim();
  if (!domainId) return { available: false, error: "empty domain id" };

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { available: false, error: "no RESEND_API_KEY" };

  try {
    const resp = await fetch(`https://api.resend.com/domains/${encodeURIComponent(domainId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "(unreadable)");
      return { available: false, error: `Resend get failed (${resp.status}): ${body}` };
    }
    const domain = normalizeDomainPayload(await resp.json());
    return domain ? { available: true, domain } : { available: false, error: "malformed Resend response" };
  } catch (err) {
    return { available: false, error: String(err) };
  }
}

/**
 * Delete a domain from Resend by id. Returns `{ available: true }` on success.
 * Fails open to `{ available: false }` when there's no key or the call errors.
 */
export async function deleteResendDomain(id: string): Promise<ResendDomainWriteResult> {
  const domainId = (id ?? "").trim();
  if (!domainId) return { available: false, error: "empty domain id" };

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { available: false, error: "no RESEND_API_KEY" };

  try {
    const resp = await fetch(`https://api.resend.com/domains/${encodeURIComponent(domainId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "(unreadable)");
      return { available: false, error: `Resend delete failed (${resp.status}): ${body}` };
    }
    return { available: true };
  } catch (err) {
    return { available: false, error: String(err) };
  }
}
