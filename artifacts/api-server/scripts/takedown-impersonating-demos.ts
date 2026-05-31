/**
 * Takedown helper for impersonating demo pages (task #547).
 *
 * Finds published landing pages whose title/slug/metaTitle match a denylist
 * of well-known real brand names (the kind that trip Safe Browsing's brand-
 * impersonation classifier when published on our shared apex domain), then
 * UNPUBLISHES them (status -> 'draft') and PURGES the cached static HTML from
 * BOTH R2 (every active host for the tenant) and the Replit OS debug cache so
 * the edge stops serving them within the CDN TTL.
 *
 * The Dandy tenant is excluded (gated by slug via isProtectedEnterpriseSlug) —
 * its branded demos are legitimate and approved.
 *
 * THIS SCRIPT IS OPERATIONAL — it mutates published state. ALWAYS run with
 * --dry-run first and review the matched pages before running for real.
 *
 * Usage (from artifacts/api-server/):
 *   pnpm tsx scripts/takedown-impersonating-demos.ts --dry-run
 *   pnpm tsx scripts/takedown-impersonating-demos.ts --dry-run --brands=zoom,okta
 *   pnpm tsx scripts/takedown-impersonating-demos.ts --apply
 *   pnpm tsx scripts/takedown-impersonating-demos.ts --apply --page=1234
 *
 * Flags:
 *   --dry-run            List matches, mutate nothing. DEFAULT (must pass
 *                        --apply to actually take pages down).
 *   --apply              Perform the unpublish + cache purge.
 *   --brands=a,b,c       Override the default denylist (comma-separated,
 *                        case-insensitive substring match).
 *   --page=<id>          Restrict to a single page id (skips name matching;
 *                        still excludes Dandy).
 *
 * Telemetry: prints one JSON line per matched page
 *   {pageId, tenantId, tenantSlug, slug, title, action, hostsPurged}
 * then a summary {matched, unpublished, r2Purged, osPurged, skippedDandy}.
 *
 * Exits non-zero if any purge step throws while --apply is set.
 */
import { db, lpPagesTable, tenantsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { isProtectedEnterpriseSlug } from "@workspace/plan-config";
import { getActiveHostsForTenant } from "../src/lib/tenantHosts";
import { deletePublishedHtmlFromR2, isR2Configured } from "../src/lib/r2Storage";
import { deletePublishedHtml } from "../src/lib/publishedHtmlStorage";

// Default denylist of real brand names commonly used in impersonating demos.
// Case-insensitive substring match against title/slug/metaTitle. Tune per
// incident with --brands=.
const DEFAULT_DENYLIST = [
  "zoom",
  "okta",
  "salesforce",
  "microsoft",
  "google",
  "slack",
  "stripe",
  "docusign",
  "workday",
  "servicenow",
];

interface Args {
  apply: boolean;
  brands: string[];
  pageId?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, brands: DEFAULT_DENYLIST };
  for (const a of argv.slice(2)) {
    if (a === "--apply") args.apply = true;
    else if (a === "--dry-run") args.apply = false;
    else if (a.startsWith("--brands=")) {
      args.brands = a
        .slice("--brands=".length)
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (a.startsWith("--page=")) {
      const n = Number.parseInt(a.slice("--page=".length), 10);
      if (Number.isFinite(n)) args.pageId = n;
    }
  }
  return args;
}

function matchesDenylist(
  page: { title: string; slug: string; metaTitle: string },
  brands: string[],
): boolean {
  const hay = `${page.title}\n${page.slug}\n${page.metaTitle}`.toLowerCase();
  return brands.some(b => hay.includes(b));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!isR2Configured()) {
    console.warn(
      "[takedown] R2 not configured — will still unpublish + purge OS, but R2 objects won't be removed.",
    );
  }

  // Pull every published page joined to its tenant slug so we can both
  // name-match and exclude Dandy.
  const rows = await db
    .select({
      pageId: lpPagesTable.id,
      tenantId: lpPagesTable.tenantId,
      slug: lpPagesTable.slug,
      title: lpPagesTable.title,
      metaTitle: lpPagesTable.metaTitle,
      tenantSlug: tenantsTable.slug,
    })
    .from(lpPagesTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, lpPagesTable.tenantId))
    .where(eq(lpPagesTable.status, "published"));

  const summary = {
    matched: 0,
    unpublished: 0,
    r2Purged: 0,
    osPurged: 0,
    skippedDandy: 0,
  };
  let hadError = false;

  for (const row of rows) {
    if (args.pageId !== undefined && row.pageId !== args.pageId) continue;
    // Name match unless a specific --page was given.
    if (
      args.pageId === undefined &&
      !matchesDenylist(
        { title: row.title, slug: row.slug, metaTitle: row.metaTitle ?? "" },
        args.brands,
      )
    ) {
      continue;
    }
    // Never touch protected (Dandy) tenants — gated by slug, never brand name.
    if (isProtectedEnterpriseSlug(row.tenantSlug)) {
      summary.skippedDandy += 1;
      continue;
    }

    summary.matched += 1;
    const action = args.apply ? "takedown" : "dry-run";

    let hostsPurged: string[] = [];
    if (args.apply) {
      try {
        // 1. Unpublish (DB row is the source of truth; origin/edge re-check
        //    status === 'published' on every read and fail closed once flipped).
        await db
          .update(lpPagesTable)
          .set({ status: "draft" })
          .where(
            and(
              eq(lpPagesTable.id, row.pageId),
              eq(lpPagesTable.tenantId, row.tenantId),
            ),
          );
        summary.unpublished += 1;

        // 2. Purge cached static HTML from R2 (every active host).
        if (isR2Configured()) {
          const hosts = await getActiveHostsForTenant(row.tenantId);
          for (const host of hosts) {
            await deletePublishedHtmlFromR2(host, row.slug);
          }
          hostsPurged = hosts;
          summary.r2Purged += 1;
        }

        // 3. Purge the Replit OS debug cache.
        await deletePublishedHtml(row.tenantId, row.slug);
        summary.osPurged += 1;
      } catch (err) {
        hadError = true;
        console.error("[takedown] failed for page", {
          pageId: row.pageId,
          tenantId: row.tenantId,
          slug: row.slug,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log(
      JSON.stringify({
        pageId: row.pageId,
        tenantId: row.tenantId,
        tenantSlug: row.tenantSlug,
        slug: row.slug,
        title: row.title,
        action,
        hostsPurged,
      }),
    );
  }

  console.log(JSON.stringify({ summary, apply: args.apply }));
  if (!args.apply) {
    console.log(
      "[takedown] DRY RUN — nothing was changed. Re-run with --apply to take these pages down.",
    );
  }
  if (hadError) process.exitCode = 1;
}

main().catch(err => {
  console.error("[takedown] fatal", err);
  process.exit(1);
});
