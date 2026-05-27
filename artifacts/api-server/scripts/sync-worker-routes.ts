/**
 * Reconcile Cloudflare Worker Routes for the `tenant-host-router` script
 * against the DB + the platform-managed hostname list. Idempotent: any
 * route already present on Cloudflare is left alone; any required route
 * that is missing is created via the CF API.
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * Custom-domain onboarding (`provisionCustomDomain` in
 * src/lib/cloudflare.ts) creates BOTH a Custom Hostname and a Worker
 * Route per tenant. Earlier we ALSO had a `routes = [...]` block in
 * `cloudflare/tenant-host-router/wrangler.toml`. When `wrangler deploy`
 * runs with that block present, wrangler treats the toml as the source
 * of truth for routes attached to the worker and DELETES any route
 * pointing at the script that isn't declared in the file — silently
 * nuking every API-provisioned tenant route. That happened once
 * (lp.frambam.com → HTTP 525) and we never want it to happen again.
 *
 * The fix is two-part:
 *   1. The `routes = [...]` block is removed from wrangler.toml so
 *      `wrangler deploy` no longer touches Worker Routes.
 *   2. This script is the single reconciliation entry point. It
 *      re-creates the four platform routes (lpstudio.ai wildcard +
 *      the Dandy hostnames) AND every tenant route stored in DB.
 *
 * Run it:
 *   - immediately after any `wrangler deploy` of tenant-host-router
 *     (belt-and-suspenders even though wrangler should no longer be
 *     touching routes),
 *   - any time we suspect routes have been wiped or drifted,
 *   - on demand to re-attach a tenant whose route went missing.
 *
 * Usage:
 *   pnpm tsx scripts/sync-worker-routes.ts            # dry-run + apply
 *   pnpm tsx scripts/sync-worker-routes.ts --dry-run  # report only
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, DATABASE_URL.
 */
import { db, tenantsTable } from "@workspace/db";
import { and, isNotNull } from "drizzle-orm";
import {
  CloudflareError,
  createWorkerRoute,
  findWorkerRouteByHostname,
} from "../src/lib/cloudflare";

// Must match WORKER_SCRIPT_NAME in src/lib/cloudflare.ts. Hardcoded
// here for the same reason it's hardcoded there: changing it requires
// a coordinated wrangler deploy + code change.
const WORKER_SCRIPT_NAME = "tenant-host-router";

// Hostnames that are NOT per-tenant rows in the DB but still need a
// Worker Route on the lpstudio.ai zone. Keep this list in sync with
// the comments in cloudflare/tenant-host-router/wrangler.toml — this
// script is now the authoritative way to materialize these routes.
const PLATFORM_HOSTS: readonly string[] = [
  // Wildcard for tenant subdomains served from *.lpstudio.ai. Routes
  // accept a wildcard pattern; findWorkerRouteByHostname matches the
  // exact `<hostname>/*` string we POST, so the lookup is symmetric.
  "*.lpstudio.ai",
  // Tenant 5 (Dandy SMB).
  "meetdandy-lp.com",
  "lp.meetdandy.com",
  // Tenant 1 (Dandy ENT) — production microsite host.
  "partners.meetdandy.com",
];

interface SyncResult {
  hostname: string;
  source: "platform" | "tenant";
  // - exists: route present and bound to tenant-host-router
  // - created: route was missing and got created (or would in dry-run)
  // - wrong-script: route exists but is bound to a different worker
  //   script. We do NOT auto-fix this; surface it so an operator can
  //   decide (could be an intentional cutover for that hostname).
  // - error: any other failure
  action: "exists" | "created" | "wrong-script" | "error";
  detail?: string;
}

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

async function ensureRoute(
  hostname: string,
  source: SyncResult["source"],
  dryRun: boolean,
): Promise<SyncResult> {
  try {
    const existing = await findWorkerRouteByHostname(hostname);
    if (existing) {
      if (existing.script !== WORKER_SCRIPT_NAME) {
        return {
          hostname,
          source,
          action: "wrong-script",
          detail: `bound to "${existing.script}" instead of "${WORKER_SCRIPT_NAME}"`,
        };
      }
      return { hostname, source, action: "exists" };
    }
    if (dryRun) {
      return { hostname, source, action: "created", detail: "(dry-run)" };
    }
    try {
      await createWorkerRoute(hostname);
      return { hostname, source, action: "created" };
    } catch (err) {
      // Idempotency under concurrency: another caller (e.g. a parallel
      // run of this script, or a self-serve provisionCustomDomain that
      // races with us) may have created the same route between our
      // find and our create. Cloudflare returns code 10020 / 409 for
      // "route pattern already in use". Re-fetch and treat as success
      // IF it's now correctly bound; otherwise surface as wrong-script.
      const looksLikeConflict =
        err instanceof CloudflareError &&
        (err.status === 409 ||
          err.errors.some((e) => e.code === 10020) ||
          /already.*(exist|use)/i.test(err.message));
      if (!looksLikeConflict) throw err;
      const recheck = await findWorkerRouteByHostname(hostname);
      if (!recheck) {
        // Conflict reported but route still not visible — surface it.
        return {
          hostname,
          source,
          action: "error",
          detail: `conflict reported but route not found on re-check: ${err.message}`,
        };
      }
      if (recheck.script !== WORKER_SCRIPT_NAME) {
        return {
          hostname,
          source,
          action: "wrong-script",
          detail: `lost create race; existing route bound to "${recheck.script}"`,
        };
      }
      return { hostname, source, action: "exists", detail: "(race: created concurrently)" };
    }
  } catch (err) {
    return {
      hostname,
      source,
      action: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv);
  console.log(
    `[sync-worker-routes] starting${dryRun ? " (DRY-RUN — no writes)" : ""}`,
  );

  // Tenant routes: every row with both a microsite_domain AND a
  // cloudflare_hostname_id set. The hostname-id presence is the
  // signal that provisionCustomDomain ran (and therefore that a
  // Worker Route *should* exist).
  const tenantRows = await db
    .select({
      id: tenantsTable.id,
      slug: tenantsTable.slug,
      micrositeDomain: tenantsTable.micrositeDomain,
    })
    .from(tenantsTable)
    .where(
      and(
        isNotNull(tenantsTable.micrositeDomain),
        isNotNull(tenantsTable.cloudflareHostnameId),
      ),
    );

  const tenantHosts = tenantRows
    .map((r) => r.micrositeDomain)
    .filter((h): h is string => typeof h === "string" && h.length > 0);

  console.log(
    `[sync-worker-routes] platform hosts: ${PLATFORM_HOSTS.length}, tenant hosts: ${tenantHosts.length}`,
  );

  const results: SyncResult[] = [];
  for (const host of PLATFORM_HOSTS) {
    results.push(await ensureRoute(host, "platform", dryRun));
  }
  for (const host of tenantHosts) {
    results.push(await ensureRoute(host, "tenant", dryRun));
  }

  const created = results.filter((r) => r.action === "created");
  const existed = results.filter((r) => r.action === "exists");
  const wrongScript = results.filter((r) => r.action === "wrong-script");
  const errored = results.filter((r) => r.action === "error");

  const TAGS: Record<SyncResult["action"], string> = {
    created: "CREATED",
    exists: "ok",
    "wrong-script": "WRONG-SCRIPT",
    error: "ERROR",
  };
  for (const r of results) {
    console.log(
      `  [${TAGS[r.action]}] (${r.source}) ${r.hostname}${r.detail ? ` — ${r.detail}` : ""}`,
    );
  }

  console.log(
    `[sync-worker-routes] done: ${created.length} created, ${existed.length} already present, ${wrongScript.length} wrong-script, ${errored.length} error`,
  );

  // wrong-script is operator-actionable but not auto-fixable; treat as
  // failure so CI/cron alarms fire and somebody investigates.
  if (errored.length > 0 || wrongScript.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[sync-worker-routes] fatal:", err);
  process.exit(1);
});
