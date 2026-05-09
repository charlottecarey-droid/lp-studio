import { pool } from "@workspace/db";

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
  const knownOrigins = new Set<string>();

  for (const t of result.rows) {
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

  return { byDomain, bySlug, byRedirectSlug, knownOrigins, loadedAt: Date.now() };
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
  if (isWildcardBaseHost(host)) {
    return { ok: false, error: `${host} is a reserved base host` };
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
