/**
 * Seed Dandy's sales-console one-pager image fields with the asset URLs that
 * used to be hardcoded (bundled `import ... from "@/assets/..."`) inside the
 * one-pager generator. Part of the one-pager de-branding foundation: the
 * generator will read these from brand config and fall back to a NEUTRAL
 * generated header for every non-Dandy tenant (never a Dandy bitmap).
 *
 * ASSET HOSTING: the five assets are committed STATIC PUBLIC FILES in
 *   artifacts/lp-studio/public/ — they deploy with the app, so their URLs are
 *   deterministic and identical in dev and prod (unlike object-storage uploads,
 *   which use per-environment buckets + random UUIDs). The white header logo
 *   already lived at /dandy-logo-white.svg; the other four were copied into
 *   /one-pager/ by this change.
 *
 * CANONICAL DANDY SET: seeds EVERY slug in PROTECTED_ENTERPRISE_SLUGS
 *   (@workspace/plan-config) so seeding agrees with the downstream gating, which
 *   uses the same list / isProtectedEnterpriseSlug helper. dandy-smb is treated
 *   as Dandy (it is in the list). Slugs with no brand row are skipped (warn).
 *
 * GATED + IDEMPOTENT + NON-DESTRUCTIVE:
 *   - Default run is a DRY RUN — reads current config and prints a before/after
 *     diff per tenant. Writes nothing.
 *   - Pass `--apply` to persist.
 *   - It ONLY sets a one-pager field when it is currently empty/unset. It NEVER
 *     clobbers a value a tenant has already customised (logs ⚠ and leaves it).
 *     Re-running after apply is a no-op.
 *
 * NOTE: hits the live DB (lib/db prefers NEON_DATABASE_URL = PROD).
 *
 * Run:  pnpm --filter @workspace/scripts exec tsx src/seed-dandy-one-pager-assets.ts            # dry run
 *       pnpm --filter @workspace/scripts exec tsx src/seed-dandy-one-pager-assets.ts --apply    # write
 */
import { eq } from "drizzle-orm";
import { db, pool, tenantsTable, lpBrandSettingsTable } from "@workspace/db";
import { PROTECTED_ENTERPRISE_SLUGS } from "@workspace/plan-config";

const APPLY = process.argv.includes("--apply");

// Deterministic public asset URLs (root-relative, matching the existing
// `/dandy-logo.svg` brand-asset precedent).
const ONE_PAGER_HEADER_IMAGES = {
  executive: "/one-pager/ai-scan-review-news.jpg",
  clinical: "/one-pager/ai-scan-review-clinical.png",
  practiceManager: "/one-pager/dandy-dso-enterprise-data.webp",
} as const;
const ONE_PAGER_PRODUCT_SCREENSHOT = "/one-pager/dandy-scanner-transparent.png";
const ONE_PAGER_LOGO_URL = "/dandy-logo-white.svg";

type Obj = Record<string, unknown>;
function obj(v: unknown): Obj { return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {}; }
function str(v: unknown): string { return typeof v === "string" ? v : ""; }

/**
 * Set `target[key] = value` only when the current value is empty/unset.
 * Returns true if a change was staged. Logs the decision.
 */
function setIfEmpty(target: Obj, key: string, value: string, label: string): boolean {
  const cur = str(target[key]);
  if (cur === "") {
    target[key] = value;
    console.log(`   • ADD ${label} = ${value}`);
    return true;
  }
  if (cur === value) {
    console.log(`   • ${label} already = target — no-op`);
    return false;
  }
  console.log(`   • ⚠ ${label} EXISTS and DIFFERS ("${cur}") — LEFT AS-IS (no clobber)`);
  return false;
}

async function seedTenant(slug: string): Promise<void> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (!tenant) { console.log(`\n— slug "${slug}": tenant not found — skipped.`); return; }

  const [brandRow] = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenant.id)).limit(1);
  if (!brandRow) { console.log(`\n— slug "${slug}" (#${tenant.id}): no lp_brand_settings row — skipped.`); return; }

  console.log(`\n=== Tenant #${tenant.id} ${tenant.name} (slug=${slug}) ===`);

  const config = obj(brandRow.config);
  const salesConsole = obj(config.salesConsole);
  const headerImages = obj(salesConsole.onePagerHeaderImages);

  let changed = false;

  console.log(`[salesConsole.onePagerHeaderImages]`);
  changed = setIfEmpty(headerImages, "executive", ONE_PAGER_HEADER_IMAGES.executive, "executive") || changed;
  changed = setIfEmpty(headerImages, "clinical", ONE_PAGER_HEADER_IMAGES.clinical, "clinical") || changed;
  changed = setIfEmpty(headerImages, "practiceManager", ONE_PAGER_HEADER_IMAGES.practiceManager, "practiceManager") || changed;

  console.log(`[salesConsole.onePagerProductScreenshot]`);
  changed = setIfEmpty(salesConsole, "onePagerProductScreenshot", ONE_PAGER_PRODUCT_SCREENSHOT, "onePagerProductScreenshot") || changed;

  console.log(`[salesConsole.onePagerLogoUrl]`);
  changed = setIfEmpty(salesConsole, "onePagerLogoUrl", ONE_PAGER_LOGO_URL, "onePagerLogoUrl") || changed;

  if (!changed) { console.log(`✓ Already seeded for "${slug}" — idempotent no-op.`); return; }

  // Re-assemble without clobbering any sibling fields.
  const newSalesConsole: Obj = { ...salesConsole, onePagerHeaderImages: headerImages };
  const newConfig: Obj = { ...config, salesConsole: newSalesConsole };

  console.log(`--- AFTER (one-pager fields) ---`);
  console.log(`   onePagerHeaderImages = ${JSON.stringify(headerImages)}`);
  console.log(`   onePagerProductScreenshot = ${JSON.stringify(newSalesConsole.onePagerProductScreenshot)}`);
  console.log(`   onePagerLogoUrl = ${JSON.stringify(newSalesConsole.onePagerLogoUrl)}`);

  if (!APPLY) { console.log(`(dry run — not written)`); return; }

  await db.update(lpBrandSettingsTable).set({ config: newConfig }).where(eq(lpBrandSettingsTable.id, brandRow.id));
  console.log(`✓ APPLIED — lp_brand_settings #${brandRow.id} updated for tenant #${tenant.id}.`);
}

async function main() {
  console.log(`\n=== Dandy one-pager asset seed (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`Protected slugs: ${PROTECTED_ENTERPRISE_SLUGS.join(", ")}`);
  for (const slug of PROTECTED_ENTERPRISE_SLUGS) {
    await seedTenant(slug);
  }
  if (!APPLY) console.log(`\nDRY RUN complete. Review above. Re-run with --apply to persist.\n`);
}

main()
  .catch((err) => { console.error("Seed error:", err); process.exitCode = 1; })
  .finally(() => pool.end());
