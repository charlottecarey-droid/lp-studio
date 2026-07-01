import { pool } from "@workspace/db";
import type { Request } from "express";
import { getRequestOrigin } from "./requestHost";

const TTL_MS = 60 * 1000;

export const WILDCARD_BASE_HOSTS: string[] = (
  process.env.WILDCARD_TENANT_BASE_HOSTS ?? "lpstudio.ai,app.lpstudio.ai"
)
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "auth", "cdn", "static", "assets",
  "mail", "smtp", "imap", "pop", "blog", "docs", "support", "help",
  "status", "marketing", "go", "m", "dev", "staging", "test",
]);

export type TenantHostMatch = {
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  mode: "tenant-locked" | "microsite-only";
  micrositeDomain: string | null;
  /**
   * Set when this host matched only via a tenant_slug_redirects row
   * (the slug used in the URL is no longer the tenant's canonical slug).
   * Callers should redirect the user to `<tenantSlug>.<wildcardBase>`.
   */
  viaSlugRedirect?: boolean;
};

type TenantRow = {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  micrositeDomain: string | null;
};

type Cache = {
  byDomain: Map<string, TenantHostMatch>;
  bySlug: Map<string, TenantHostMatch>;
  /** Old slug -> the tenant's current canonical match (viaSlugRedirect=true). */
  byRedirectSlug: Map<string, TenantHostMatch>;
  byTenantId: Map<number, TenantRow>;
  knownOrigins: Set<string>;
  loadedAt: number;
};

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

async function loadCache(): Promise<Cache> {
  const result = await pool.query<TenantRow>(
    `SELECT id, name, slug, domain, microsite_domain AS "micrositeDomain"
     FROM tenants WHERE status = 'active'`
  );
  const byDomain = new Map<string, TenantHostMatch>();
  const bySlug = new Map<string, TenantHostMatch>();
  const byRedirectSlug = new Map<string, TenantHostMatch>();
  const byTenantId = new Map<number, TenantRow>();
  const knownOrigins = new Set<string>();

  for (const t of result.rows) {
    byTenantId.set(t.id, t);
    const adminMatch: TenantHostMatch = {
      tenantId: t.id,
      tenantName: t.name,
      tenantSlug: t.slug,
      mode: "tenant-locked",
      micrositeDomain: t.micrositeDomain,
    };
    if (t.domain) {
      const d = t.domain.toLowerCase();
      byDomain.set(d, adminMatch);
      knownOrigins.add(`https://${d}`);
    }
    if (t.micrositeDomain) {
      const m = t.micrositeDomain.toLowerCase();
      byDomain.set(m, {
        ...adminMatch,
        mode: "microsite-only",
      });
      knownOrigins.add(`https://${m}`);
    }
    if (t.slug) {
      bySlug.set(t.slug.toLowerCase(), adminMatch);
    }
  }

  // Load slug redirects for any active tenant. Expired rows are ignored so
  // they naturally stop redirecting after their TTL even before the cleanup
  // job removes them.
  try {
    const redirects = await pool.query<{ old_slug: string; tenant_id: number }>(
      `SELECT old_slug, tenant_id FROM tenant_slug_redirects WHERE expires_at > now()`
    );
    for (const r of redirects.rows) {
      // Find the canonical match by tenant_id; skip if tenant is no longer active.
      const canonical = [...bySlug.values()].find(m => m.tenantId === r.tenant_id);
      if (!canonical) continue;
      const old = r.old_slug.toLowerCase();
      // Don't shadow a live slug.
      if (bySlug.has(old)) continue;
      byRedirectSlug.set(old, { ...canonical, viaSlugRedirect: true });
    }
  } catch {
    // Table may not exist yet on a brand-new boot before migrations run.
    // Treat as "no redirects" rather than failing the whole cache load.
  }

  return { byDomain, bySlug, byRedirectSlug, byTenantId, knownOrigins, loadedAt: Date.now() };
}

async function getCache(): Promise<Cache> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = loadCache()
    .then(c => { cache = c; return c; })
    .finally(() => { inflight = null; });
  return inflight;
}

export function invalidateTenantHostCache(): void {
  cache = null;
}

/**
 * Strip "<slug>." prefix from host if it matches one of the wildcard base hosts.
 * Returns the slug if matched, otherwise null.
 */
export function extractWildcardSlug(host: string): string | null {
  const lower = host.toLowerCase();
  for (const base of WILDCARD_BASE_HOSTS) {
    const suffix = `.${base}`;
    if (lower.endsWith(suffix) && lower.length > suffix.length) {
      const sub = lower.slice(0, -suffix.length);
      // Reject multi-level subdomains and reserved names
      if (sub.includes(".")) return null;
      if (RESERVED_SUBDOMAINS.has(sub)) return null;
      return sub;
    }
  }
  return null;
}

export function isWildcardBaseHost(host: string): boolean {
  return WILDCARD_BASE_HOSTS.includes(host.toLowerCase());
}

/**
 * The landing-page host we auto-assign every tenant: `<slug>-lp.<base>`
 * (e.g. acme-lp.lpstudio.ai). Served directly off our wildcard cert + the
 * tenant-host-router worker, so it needs no tenant DNS or per-host setup.
 */
export function defaultPageSubdomain(slug: string): string {
  const base = WILDCARD_BASE_HOSTS[0] ?? "lpstudio.ai";
  return `${slug.toLowerCase().trim()}-lp.${base}`;
}

/**
 * The base host used for a tenant's MANAGED workspace/login subdomain — the
 * first configured wildcard base that isn't the reserved `app.` host (e.g.
 * `lpstudio.ai`, giving `acme.lpstudio.ai`). Falls back to the first base.
 */
export function publicWildcardBaseHost(): string | null {
  const preferred = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app."));
  return preferred ?? WILDCARD_BASE_HOSTS[0] ?? null;
}

/**
 * Compute the canonical workspace/login host for a tenant. Prefers the
 * tenant's configured custom `domain` (e.g. meetdandy-lp.com); otherwise falls
 * back to the managed `<slug>.<wildcardBaseHost>` subdomain (e.g.
 * acme.lpstudio.ai). Returns null when neither a domain nor a slug is known.
 *
 * Single source of truth shared by the auth flow (post-login routing) and the
 * invite emails, so the URL a new member is emailed always matches the host
 * they'll actually be signed in on.
 */
export function canonicalTenantHost(t: { domain: string | null; slug: string | null }): string | null {
  if (t.domain) return t.domain.toLowerCase();
  const base = publicWildcardBaseHost();
  if (!base || !t.slug) return null;
  return `${t.slug.toLowerCase()}.${base}`;
}

/**
 * The canonical workspace sign-in URL (`https://<canonicalHost>`) for a tenant,
 * used as the link in invite/seat-activation emails. Falls back to the generic
 * app host only when the tenant has neither a custom domain nor a slug.
 */
export function canonicalTenantSignInUrl(
  t: { domain: string | null; slug: string | null },
  fallback: string = process.env["APP_URL"] ?? "https://app.lpstudio.ai",
): string {
  const host = canonicalTenantHost(t);
  return host ? `https://${host}` : fallback;
}

/** True if `host` is one of our wildcard base hosts, or a subdomain of one. */
export function isUnderWildcardBase(host: string): boolean {
  const lower = host.toLowerCase();
  return WILDCARD_BASE_HOSTS.some(
    base => lower === base || lower.endsWith(`.${base}`),
  );
}

/**
 * True when `host` is a MANAGED LP Studio landing-page subdomain — a single
 * level, non-reserved subdomain of a wildcard base host (e.g.
 * acme-lp.lpstudio.ai). These resolve through our wildcard cert + worker, so
 * they require NO Cloudflare custom-hostname provisioning and NO tenant DNS.
 */
export function isManagedLpStudioHost(host: string): boolean {
  return extractWildcardSlug(host) !== null;
}

/**
 * Resolve a request's host to a tenant.
 * Tries (in order): exact domain → exact microsite_domain → wildcard subdomain (slug).
 */
export async function findTenantByHost(host: string): Promise<TenantHostMatch | null> {
  if (!host) return null;
  const lower = host.split(":")[0].toLowerCase();
  const c = await getCache();

  const exact = c.byDomain.get(lower);
  if (exact) return exact;

  const slug = extractWildcardSlug(lower);
  if (slug) {
    const bySlug = c.bySlug.get(slug);
    if (bySlug) return bySlug;
    // Task #133 — fall back to slug rename redirects so old bookmarks still
    // resolve to the right tenant (callers can detect this via viaSlugRedirect).
    const redirected = c.byRedirectSlug.get(slug);
    if (redirected) return redirected;
  }

  return null;
}

/** Returns the cached set of `https://<host>` strings for all configured tenant domains. */
export async function getKnownTenantOrigins(): Promise<Set<string>> {
  const c = await getCache();
  return c.knownOrigins;
}

/**
 * Enumerate every host through which a tenant's pages are publicly
 * reachable. Used by the prerender pipeline (task #364) to know which
 * R2 keys to write per page: with per-host keying we need one
 * `<host>/<slug>.html` object per host so the CF worker can read it
 * without any tenant-resolution step.
 *
 * Sources (in priority order):
 *   1. tenant.domain          (admin host)
 *   2. tenant.micrositeDomain (visitor-facing custom domain)
 *   3. `<slug>.<base>` for each WILDCARD_BASE_HOSTS entry (the default
 *      wildcard subdomains we always control)
 *
 * Result is lowercased and de-duplicated, but otherwise preserves the
 * priority order so callers that need a "primary" host can take [0].
 *
 * Returns an empty array if the tenant is not found / not active.
 */
export async function getActiveHostsForTenant(tenantId: number): Promise<string[]> {
  const c = await getCache();
  const t = c.byTenantId.get(tenantId);
  if (!t) return [];
  const ordered: string[] = [];
  const push = (h: string | null | undefined) => {
    if (!h) return;
    const lower = h.toLowerCase().trim();
    if (!lower) return;
    if (ordered.includes(lower)) return;
    ordered.push(lower);
  };
  push(t.domain);
  push(t.micrositeDomain);
  if (t.slug) {
    for (const base of WILDCARD_BASE_HOSTS) push(`${t.slug.toLowerCase()}.${base}`);
  }
  return ordered;
}

/**
 * Resolve the canonical outbound origin for a tenant — used when building
 * URLs that will be embedded in outbound emails (personalized microsite
 * links, click-tracking links, unsubscribe links). Prefers the tenant's
 * configured microsite_domain, then the admin `domain`, then falls back
 * to the request's own origin so dev/local still works.
 *
 * Without this, links built off `req.get("host")` carry the launcher's
 * Replit dev URL (e.g. https://image-to-video-ccarey.replit.app/p/abc)
 * into emails sent on behalf of other tenants.
 */
export async function getTenantOutboundOrigin(
  tenantId: number,
  req: Request,
): Promise<string> {
  try {
    const c = await getCache();
    const t = c.byTenantId.get(tenantId);
    if (t?.micrositeDomain) return `https://${t.micrositeDomain.toLowerCase()}`;
    if (t?.domain) return `https://${t.domain.toLowerCase()}`;
  } catch {
    // fall through to request origin
  }
  return getRequestOrigin(req) || `${req.protocol}://${req.get("host")}`;
}

// ─── Slug validation ─────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type SlugValidation = { ok: true; normalized: string } | { ok: false; error: string };

/**
 * Validate a user-supplied workspace slug. Lower-cases, collapses runs of
 * hyphens, and trims leading/trailing hyphens. Reserved subdomains and
 * wildcard base hosts are rejected so users can't claim "app", "api", etc.
 */
export function validateSlug(input: string): SlugValidation {
  const trimmed = (input ?? "").trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "Slug is required" };
  const normalized = trimmed
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!normalized) return { ok: false, error: "Use letters, numbers, and hyphens only" };
  if (normalized.length < 2) return { ok: false, error: "Slug must be at least 2 characters" };
  if (normalized.length > 63) return { ok: false, error: "Slug must be 63 characters or fewer" };
  if (!SLUG_RE.test(normalized)) return { ok: false, error: "Slug must start and end with a letter or number" };
  if (RESERVED_SUBDOMAINS.has(normalized)) return { ok: false, error: `${normalized} is reserved` };
  return { ok: true, normalized };
}

/**
 * Returns true if `slug` is currently held by another tenant via an unexpired
 * row in tenant_slug_redirects. Pass excludeTenantId=null when no tenant
 * exists yet (signup / admin-create paths). Used to prevent newly-created
 * tenants from hijacking traffic intended for a recently renamed-away slug
 * (task #133).
 */
export async function isSlugRedirectReserved(
  slug: string,
  excludeTenantId: number | null,
): Promise<boolean> {
  if (!slug) return false;
  const params: unknown[] = [slug.toLowerCase()];
  let where = `old_slug = $1 AND expires_at > now()`;
  if (excludeTenantId !== null) {
    params.push(excludeTenantId);
    where += ` AND tenant_id <> $2`;
  }
  const result = await pool.query<{ tenant_id: number }>(
    `SELECT tenant_id FROM tenant_slug_redirects WHERE ${where} LIMIT 1`,
    params,
  );
  return result.rows.length > 0;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export type DomainValidation = { ok: true; normalized: string } | { ok: false; error: string };

/**
 * Validate a user-supplied domain string. Returns the normalized lowercase
 * hostname or an error message suitable for display.
 */
export function validateDomain(input: string): DomainValidation {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: true, normalized: "" }; // empty is allowed (clears the field)

  let host = trimmed.toLowerCase();
  // Strip scheme and path if user pasted a URL
  host = host.replace(/^https?:\/\//, "").split("/")[0].split("?")[0];
  // Strip port
  host = host.split(":")[0];

  if (!HOSTNAME_RE.test(host)) {
    return { ok: false, error: "Not a valid hostname (e.g. acme.example.com)" };
  }
  if (host.length > 253) {
    return { ok: false, error: "Hostname too long" };
  }
  if (isUnderWildcardBase(host)) {
    // A host on one of our own base domains is only valid as a MANAGED
    // single-level, non-reserved subdomain (e.g. acme-lp.lpstudio.ai). The
    // bare base host, reserved names, and multi-level subdomains are rejected
    // — nobody can claim those as a custom domain.
    if (!isManagedLpStudioHost(host)) {
      return { ok: false, error: `${host} isn't an available LP Studio address` };
    }
    return { ok: true, normalized: host };
  }
  return { ok: true, normalized: host };
}

/**
 * Check whether a domain is already used by another tenant.
 * Returns the conflicting tenant id/name if so, else null.
 */
export async function findDomainConflict(
  domain: string,
  excludeTenantId: number,
): Promise<{ tenantId: number; tenantName: string; field: "domain" | "microsite_domain" } | null> {
  if (!domain) return null;
  const result = await pool.query<{ id: number; name: string; field: string }>(
    `SELECT id, name,
            CASE WHEN lower(domain) = $1 THEN 'domain' ELSE 'microsite_domain' END AS field
     FROM tenants
     WHERE id <> $2 AND (lower(domain) = $1 OR lower(microsite_domain) = $1)
     LIMIT 1`,
    [domain.toLowerCase(), excludeTenantId],
  );
  if (!result.rows.length) return null;
  const r = result.rows[0];
  return { tenantId: r.id, tenantName: r.name, field: r.field as "domain" | "microsite_domain" };
}
