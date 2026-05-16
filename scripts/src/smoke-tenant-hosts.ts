/**
 * Post-deploy smoke test for tenant hosts (task #191).
 *
 * Hits `/api/auth/domain-context` on every known tenant host (sourced from
 * `tenants.domain` + `tenants.microsite_domain` + WILDCARD_TENANT_BASE_HOSTS)
 * and fails if any returns 403 or 5xx.
 *
 * This catches host-level outages — DNS, custom-domain registration, edge
 * worker route changes — that build-time guards can't see. Originally
 * triggered by task #189 ("ent.meetdandy.com returns 403 on every request").
 *
 * Exits 0 if every host returns a healthy status (any non-403, non-5xx).
 * Exits 1 if any host fails. Designed to be invoked from a deploy hook,
 * cron, or CI job so the failure is visible (logs / blocked deploy).
 *
 * Env:
 *   NEON_DATABASE_URL    required — used to enumerate tenant hosts
 *   WILDCARD_TENANT_BASE_HOSTS  optional — comma-separated wildcard base hosts
 *   SMOKE_TIMEOUT_MS     optional — per-request timeout (default 10_000)
 *   SMOKE_SKIP_HOSTS     optional — comma-separated hosts to skip
 */
import { pool } from "@workspace/db";

const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);
const SKIP = new Set(
  (process.env.SMOKE_SKIP_HOSTS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
);

const WILDCARD_BASE_HOSTS: string[] = (
  process.env.WILDCARD_TENANT_BASE_HOSTS ?? "lpstudio.ai,app.lpstudio.ai"
)
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

type HostResult = {
  host: string;
  status: number | null;
  ok: boolean;
  reason: string;
  unreachable?: boolean;
};

const ALWAYS_SKIP = new Set(["localhost", "127.0.0.1", "::1"]);

async function loadTenantHosts(): Promise<string[]> {
  const result = await pool.query<{ domain: string | null; microsite_domain: string | null; slug: string }>(
    `SELECT domain, microsite_domain, slug
     FROM tenants
     WHERE status = 'active'`,
  );
  const hosts = new Set<string>();
  for (const row of result.rows) {
    if (row.domain) hosts.add(row.domain.toLowerCase());
    if (row.microsite_domain) hosts.add(row.microsite_domain.toLowerCase());
    // Also probe each tenant's wildcard subdomain so we catch wildcard cert
    // / DNS regressions in addition to custom-domain ones.
    if (row.slug) {
      for (const base of WILDCARD_BASE_HOSTS) {
        hosts.add(`${row.slug.toLowerCase()}.${base}`);
      }
    }
  }
  return [...hosts].filter(h => !SKIP.has(h) && !ALWAYS_SKIP.has(h)).sort();
}

async function probe(host: string): Promise<HostResult> {
  const url = `https://${host}/api/auth/domain-context`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "user-agent": "lp-studio-smoke/1.0" },
    });
    const status = res.status;
    // Any 2xx/3xx/4xx-but-not-403 is healthy. We specifically guard against
    // 403 (the original outage signal) and any 5xx (server-side failures).
    if (status === 403) {
      return { host, status, ok: false, reason: "403 Forbidden — host likely not registered with edge / proxy" };
    }
    if (status >= 500) {
      // Special case: 503 with body `{ "error": "server_warming_up" }` is the
      // readiness gate (src/lib/readiness.ts + src/app.ts) signalling that the
      // currently-live process is mid-boot (e.g. running idempotent migration
      // batch). Treating that as a hard failure creates a deploy DEADLOCK —
      // the only way to recover a stuck "warming up" prod is to ship a new
      // build, but the build's own smoke step would refuse because prod is
      // 5xx-ing. Downgrade to unreachable/warning so the build can proceed
      // and replace the stuck process. Real outages (500s, non-warming 503s)
      // still hard-fail.
      if (status === 503) {
        // Strict JSON match against the readiness gate's exact payload —
        // substring matching would over-trigger on unrelated error pages.
        let warming = false;
        try {
          const body = (await res.text()).slice(0, 500);
          const parsed = JSON.parse(body) as { error?: unknown };
          warming = parsed?.error === "server_warming_up";
        } catch { /* non-JSON body → not the readiness gate → fall through */ }
        if (warming) {
          return {
            host,
            status,
            ok: false,
            reason: "503 server_warming_up — live process mid-boot (not blocking deploy)",
            unreachable: true,
          };
        }
      }
      return { host, status, ok: false, reason: `${status} server error` };
    }
    return { host, status, ok: true, reason: `${status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // DNS / connection failures mean the host isn't pointing at us at all
    // (scratch tenants, decommissioned domains, wildcard bases not yet wired).
    // That's a different class of problem than "server is up but rejecting" —
    // task #189 was specifically about the latter (403 on every request).
    // Surface unreachable hosts as a warning so they're visible without
    // blocking the deploy on noise. Override with SMOKE_FAIL_UNREACHABLE=1.
    return { host, status: null, ok: false, reason: `request failed: ${msg}`, unreachable: true };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  if (!process.env.NEON_DATABASE_URL && !process.env.DATABASE_URL) {
    console.error("[smoke] NEON_DATABASE_URL (or DATABASE_URL) is required");
    process.exit(1);
  }

  const hosts = await loadTenantHosts();
  if (hosts.length === 0) {
    console.warn("[smoke] no tenant hosts found — nothing to probe");
    await pool.end();
    return;
  }

  console.log(`[smoke] probing ${hosts.length} tenant host(s) on /api/auth/domain-context`);
  const results = await Promise.all(hosts.map(probe));

  const failOnUnreachable = process.env.SMOKE_FAIL_UNREACHABLE === "1";
  const hard: HostResult[] = [];
  const warn: HostResult[] = [];
  for (const r of results) {
    let tag: "PASS" | "WARN" | "FAIL";
    if (r.ok) tag = "PASS";
    else if (r.unreachable && !failOnUnreachable) tag = "WARN";
    else tag = "FAIL";
    console.log(`  ${tag}  ${r.host.padEnd(40)} ${r.reason}`);
    if (tag === "FAIL") hard.push(r);
    else if (tag === "WARN") warn.push(r);
  }

  await pool.end();

  if (warn.length > 0) {
    console.warn(`[smoke] ${warn.length} host(s) unreachable (DNS/connect) — not blocking deploy`);
  }

  if (hard.length > 0) {
    console.error(`[smoke] ${hard.length} of ${results.length} tenant host(s) failed (403/5xx)`);
    for (const r of hard) {
      console.error(`  - ${r.host}: ${r.reason}`);
    }
    process.exit(1);
  }

  console.log(`[smoke] ${results.length - warn.length} of ${results.length} tenant host(s) healthy`);
}

main().catch(err => {
  console.error("[smoke] unexpected error:", err);
  process.exit(1);
});
