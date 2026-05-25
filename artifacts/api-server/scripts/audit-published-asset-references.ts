/**
 * Read-only audit (task #374): walks every published `lp_pages` row,
 * reads the R2-stored HTML, extracts referenced `/assets/*` paths, and
 * HEADs each against R2's `_studio-assets/assets/<basename>` prefix.
 *
 * Reports a JSON line per page with `{pageId, tenantId, slug, host,
 * assetCount, missing: [...]}`, then a summary with totals. Exits
 * non-zero only if any page is broken (referenced asset 404 in R2).
 *
 * Usage:
 *   pnpm tsx scripts/audit-published-asset-references.ts
 *   pnpm tsx scripts/audit-published-asset-references.ts --tenant=42
 *   pnpm tsx scripts/audit-published-asset-references.ts --limit=20
 *
 * Use this:
 *   - After every lp-studio deploy, to confirm asset uploads ran and the
 *     prerendered HTML is still serviceable.
 *   - As a one-shot post-merge verification of task #374's pipeline.
 *   - From a cron / CI job if we ever need stronger drift detection.
 */
import { db, lpPagesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { S3Client, GetObjectCommand, NoSuchKey, NotFound } from "@aws-sdk/client-s3";
import { getActiveHostsForTenant } from "../src/lib/tenantHosts";
import { extractAssetPaths, r2AssetExists } from "../src/lib/assetRefs";

interface Args {
  tenantId?: number;
  slug?: string;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith("--tenant=")) out.tenantId = Number(a.slice("--tenant=".length));
    else if (a.startsWith("--slug=")) out.slug = a.slice("--slug=".length);
    else if (a.startsWith("--limit=")) out.limit = Math.max(1, Number(a.slice("--limit=".length)));
  }
  return out;
}

function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return { client, bucket };
}

function normalizeHostForKey(host: string) {
  return host.split(":")[0].trim().toLowerCase();
}

async function readHtml(
  client: S3Client,
  bucket: string,
  host: string,
  slug: string,
): Promise<string | null> {
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: `${encodeURIComponent(normalizeHostForKey(host))}/${encodeURIComponent(slug)}.html`,
      }),
    );
    return (await out.Body?.transformToString("utf-8")) ?? null;
  } catch (err) {
    if (err instanceof NoSuchKey || err instanceof NotFound) return null;
    const n = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    if (n === "NoSuchKey" || n === "NotFound") return null;
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const cfg = getR2();
  if (!cfg) {
    console.error("[audit] R2 not configured — cannot proceed.");
    process.exit(2);
  }

  const where = [eq(lpPagesTable.status, "published")];
  if (args.tenantId !== undefined) where.push(eq(lpPagesTable.tenantId, args.tenantId));
  if (args.slug !== undefined) where.push(eq(lpPagesTable.slug, args.slug));

  const pages = await db
    .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, slug: lpPagesTable.slug })
    .from(lpPagesTable)
    .where(and(...where))
    .orderBy(lpPagesTable.id);

  const slice = args.limit ? pages.slice(0, args.limit) : pages;
  console.log(`[audit] ${slice.length} published pages to check (of ${pages.length})`);

  // De-dupe asset HEAD lookups across pages (most pages share the same
  // entrypoint + vendor chunks).
  const seen = new Map<string, boolean>();
  async function checkAsset(basename: string): Promise<boolean> {
    const cached = seen.get(basename);
    if (cached !== undefined) return cached;
    const exists = await r2AssetExists(cfg!.client, cfg!.bucket, basename);
    seen.set(basename, exists);
    return exists;
  }

  let pagesChecked = 0;
  let pagesNoHtml = 0;
  let pagesBroken = 0;
  let pagesOk = 0;

  for (const page of slice) {
    const hosts = await getActiveHostsForTenant(page.tenantId);
    if (hosts.length === 0) {
      console.log(JSON.stringify({ pageId: page.id, slug: page.slug, outcome: "no_hosts" }));
      continue;
    }
    // Audit against the first host; HTML is byte-equivalent per host
    // except for canonical/og:url tags, which don't affect asset refs.
    const host = hosts[0];
    const html = await readHtml(cfg.client, cfg.bucket, host, page.slug);
    if (!html) {
      pagesNoHtml++;
      console.log(JSON.stringify({ pageId: page.id, tenantId: page.tenantId, slug: page.slug, host, outcome: "no_r2_html" }));
      continue;
    }
    const assets = extractAssetPaths(html);
    const missing: string[] = [];
    for (const a of assets) {
      const basename = a.split("/").pop()!;
      if (!(await checkAsset(basename))) missing.push(a);
    }
    pagesChecked++;
    if (missing.length > 0) {
      pagesBroken++;
      console.log(
        JSON.stringify({
          pageId: page.id,
          tenantId: page.tenantId,
          slug: page.slug,
          host,
          assetCount: assets.length,
          missingCount: missing.length,
          missing: missing.slice(0, 10),
          outcome: "broken",
        }),
      );
    } else {
      pagesOk++;
      console.log(
        JSON.stringify({
          pageId: page.id,
          tenantId: page.tenantId,
          slug: page.slug,
          host,
          assetCount: assets.length,
          outcome: "ok",
        }),
      );
    }
  }

  const summary = {
    total: slice.length,
    pagesChecked,
    pagesOk,
    pagesBroken,
    pagesNoHtml,
    uniqueAssetsChecked: seen.size,
    uniqueAssetsMissing: Array.from(seen.values()).filter((v) => !v).length,
  };
  console.log("[audit] summary", JSON.stringify(summary, null, 2));
  process.exit(pagesBroken > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[audit] fatal", err);
  process.exit(2);
});
