// Task #412 — Cloudflare API client for custom-domain self-serve.
//
// Two resources MUST be provisioned together on the `lpstudio.ai` zone for
// a tenant's custom microsite domain (e.g. `pages.acme.com`) to work end
// to end:
//
//   1. Custom Hostname  — terminates TLS for the tenant's vanity host
//      via Cloudflare for SaaS. Without this, HTTPS requests to the
//      vanity host hit Cloudflare and fail SSL handshake.
//
//   2. Worker Route     — routes `<vanity-host>/*` to the
//      `tenant-host-router` worker, which forwards to the Replit
//      deployment and stamps `X-Original-Host` so api-server's
//      `findTenantByHost` can resolve the tenant.
//
// Task #364 lesson: either-alone-silently-fails. Custom Hostname without
// Worker Route → request reaches Cloudflare but gets routed by the
// wildcard CNAME to the wrong place. Worker Route without Custom
// Hostname → TLS fails before the worker ever runs. Both must succeed,
// and the self-serve route MUST roll back the first if the second
// fails — otherwise we leak Cloudflare resources and the tenant sees a
// half-broken domain.
//
// All functions throw `CloudflareError` (with status + Cloudflare's
// own error array) on non-2xx responses so callers can surface a
// useful message and decide whether to roll back.

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

// Worker script name deployed at cloudflare/tenant-host-router/.
// Hardcoded because changing it requires a coordinated wrangler deploy
// and a code change here in lockstep — there is no point making it
// configurable per-environment.
const WORKER_SCRIPT_NAME = "tenant-host-router";

export interface CloudflareErrorDetail {
  code: number;
  message: string;
}

export class CloudflareError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: CloudflareErrorDetail[] = [],
  ) {
    super(message);
    this.name = "CloudflareError";
  }
}

function getConfig(): { token: string; zoneId: string } {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) {
    throw new CloudflareError(
      "Cloudflare credentials not configured (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID)",
      500,
    );
  }
  return { token, zoneId };
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors: CloudflareErrorDetail[];
  result: T;
}

async function cfFetch<T>(
  path: string,
  init: { method: string; body?: unknown } = { method: "GET" },
): Promise<T> {
  const { token } = getConfig();
  const res = await fetch(`${CLOUDFLARE_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  let json: CloudflareEnvelope<T> | null = null;
  try {
    json = (await res.json()) as CloudflareEnvelope<T>;
  } catch {
    /* non-JSON body — handled below */
  }
  if (!res.ok || !json?.success) {
    const errs = json?.errors ?? [];
    const msg = errs.length
      ? errs.map((e) => `[${e.code}] ${e.message}`).join("; ")
      : `Cloudflare API ${res.status}`;
    throw new CloudflareError(msg, res.status, errs);
  }
  return json.result;
}

interface Zone {
  id: string;
  name: string;
}

// Cache the zone lookup forever within a process — the zone name on a
// given CLOUDFLARE_ZONE_ID never changes for the lifetime of the
// deployment. A failed lookup is NOT cached so a transient CF outage
// during boot doesn't poison the cache.
let cachedZoneName: string | null = null;

/**
 * Return the apex hostname of the configured Cloudflare zone (e.g.
 * `lpstudio.ai`). This is the value tenants must CNAME their vanity
 * host to for Cloudflare for SaaS to terminate TLS. Sourced from the
 * zone API rather than hardcoded so a future zone change (or a
 * different zone per environment) doesn't silently misconfigure
 * customer DNS instructions.
 */
export async function getZoneName(): Promise<string> {
  if (cachedZoneName) return cachedZoneName;
  const { zoneId } = getConfig();
  const zone = await cfFetch<Zone>(`/zones/${zoneId}`);
  if (!zone?.name) {
    throw new CloudflareError("Cloudflare zone lookup returned no name", 502);
  }
  cachedZoneName = zone.name;
  return cachedZoneName;
}

export type CustomHostnameStatus =
  | "active"
  | "pending"
  | "active_redeploying"
  | "moved"
  | "pending_deletion"
  | "deleted"
  | "pending_blocked"
  | "pending_migration"
  | "pending_provisioned"
  | "test_pending"
  | "test_active"
  | "test_active_apex"
  | "test_blocked"
  | "test_failed"
  | "provisioned"
  | "blocked";

export interface CustomHostname {
  id: string;
  hostname: string;
  status: CustomHostnameStatus;
  ssl: {
    status: string;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
    validation_errors?: Array<{ message: string }>;
  };
  ownership_verification?: {
    type?: string;
    name?: string;
    value?: string;
  };
}

/**
 * Create a Custom Hostname on the lpstudio.ai zone. The hostname is the
 * tenant's vanity host (e.g. `pages.acme.com`). Cloudflare returns a
 * pending record immediately; TLS goes active once the tenant adds the
 * CNAME and Cloudflare's HTTP/TXT validation succeeds.
 */
export async function createCustomHostname(hostname: string): Promise<CustomHostname> {
  const { zoneId } = getConfig();
  return cfFetch<CustomHostname>(`/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    body: {
      hostname,
      ssl: {
        method: "http",
        type: "dv",
        settings: { min_tls_version: "1.2" },
      },
    },
  });
}

export async function getCustomHostname(id: string): Promise<CustomHostname> {
  const { zoneId } = getConfig();
  return cfFetch<CustomHostname>(`/zones/${zoneId}/custom_hostnames/${id}`);
}

/**
 * Delete a Custom Hostname by id. Returns silently on 404 so the
 * "remove domain" flow is idempotent — if the CF resource was already
 * deleted manually we still clear the DB row.
 */
export async function deleteCustomHostname(id: string): Promise<void> {
  const { zoneId } = getConfig();
  try {
    await cfFetch<unknown>(`/zones/${zoneId}/custom_hostnames/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof CloudflareError && err.status === 404) return;
    throw err;
  }
}

export interface WorkerRoute {
  id: string;
  pattern: string;
  script: string;
}

/**
 * Create a Worker Route mapping `<hostname>/*` → tenant-host-router.
 * Critical: without this route, requests to the vanity host bypass the
 * worker and never reach api-server with the correct `X-Original-Host`.
 */
export async function createWorkerRoute(hostname: string): Promise<WorkerRoute> {
  const { zoneId } = getConfig();
  return cfFetch<WorkerRoute>(`/zones/${zoneId}/workers/routes`, {
    method: "POST",
    body: {
      pattern: `${hostname}/*`,
      script: WORKER_SCRIPT_NAME,
    },
  });
}

/**
 * Find an existing worker route id for `<hostname>/*`. Used by the
 * "remove domain" path so we don't need to store the route id in the
 * DB — the (zone, pattern) pair is already unique on Cloudflare's side.
 *
 * Pagination-aware: the /workers/routes endpoint can return multiple
 * pages once the zone has more routes than per_page. Without paging,
 * detach would silently miss the route at scale and leak orphaned
 * routes that later block re-attach with a "pattern already in use"
 * error. We walk all pages until we find a match or exhaust the list.
 */
export async function findWorkerRouteByHostname(hostname: string): Promise<WorkerRoute | null> {
  const { zoneId } = getConfig();
  const target = `${hostname}/*`;
  const perPage = 50;
  // Hard cap (50 * 200 = 10k routes) guards against an unexpected API
  // response shape causing an infinite loop. Realistic ceiling is far
  // lower — one route per Growth+ tenant.
  for (let page = 1; page <= 200; page++) {
    const routes = await cfFetch<WorkerRoute[]>(
      `/zones/${zoneId}/workers/routes?per_page=${perPage}&page=${page}`,
    );
    const hit = routes.find((r) => r.pattern === target);
    if (hit) return hit;
    if (routes.length < perPage) return null;
  }
  return null;
}

export async function deleteWorkerRoute(routeId: string): Promise<void> {
  const { zoneId } = getConfig();
  try {
    await cfFetch<unknown>(`/zones/${zoneId}/workers/routes/${routeId}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof CloudflareError && err.status === 404) return;
    throw err;
  }
}

/**
 * Provision BOTH the Custom Hostname and the Worker Route. If the
 * Worker Route step fails, the Custom Hostname is deleted before
 * rethrowing so we never leave Cloudflare in a half-configured state.
 * Returns the created Custom Hostname (the route id isn't persisted —
 * we look it up by pattern when removing).
 */
export async function provisionCustomDomain(hostname: string): Promise<CustomHostname> {
  const customHostname = await createCustomHostname(hostname);
  try {
    await createWorkerRoute(hostname);
  } catch (routeErr) {
    // Rollback step 1 so we don't leak the Custom Hostname. Best-effort —
    // if the rollback also fails, we surface the ORIGINAL error (the route
    // failure) since that's what the caller needs to act on.
    try {
      await deleteCustomHostname(customHostname.id);
    } catch (rollbackErr) {
      console.error(
        "[cloudflare] provisionCustomDomain rollback failed:",
        rollbackErr,
        "original error:",
        routeErr,
      );
    }
    throw routeErr;
  }
  return customHostname;
}

/**
 * Remove BOTH the Custom Hostname (by stored id) and the Worker Route
 * (looked up by pattern). Continues past individual failures so a
 * leaked-on-one-side state can still be cleaned up — collects errors
 * and throws an aggregate at the end if anything failed.
 */
export async function deprovisionCustomDomain(
  hostname: string,
  cloudflareHostnameId: string | null,
): Promise<void> {
  const errors: unknown[] = [];

  if (cloudflareHostnameId) {
    try {
      await deleteCustomHostname(cloudflareHostnameId);
    } catch (err) {
      errors.push(err);
    }
  }

  try {
    const route = await findWorkerRouteByHostname(hostname);
    if (route) await deleteWorkerRoute(route.id);
  } catch (err) {
    errors.push(err);
  }

  if (errors.length) {
    const first = errors[0];
    if (first instanceof Error) throw first;
    throw new Error("Cloudflare deprovisioning failed");
  }
}
