/**
 * Seed Dandy's audience segments with the microsite block-lists that used to be
 * hardcoded in the `audience === "dso-*"` branches of generate-microsite.ts.
 *
 * IMPORTANT CONTEXT (discovered during the gated dry-run review):
 *   The OLD microsite generator was driven by a hardcoded 3-value enum
 *   ("dso-corporate" | "dso-practice" | "independent") that was SEPARATE from
 *   brand.segments. Dandy's real brand.segments do NOT use those ids — they are
 *   two auto-id'd, richly hand-tuned segments:
 *     - seg-1774646615094-6blv1  "Enterprise DSOs"            ≈ legacy dso-corporate
 *     - seg-1774716006240-qdgu9  "DSO Practices (Land & Expand)" ≈ legacy dso-practice
 *   There is no "independent" segment. So this seed ATTACHES the verbatim
 *   block-lists to the existing segments by id (it does NOT insert new ones),
 *   and stores the legacy "independent" list as the brand-level
 *   defaultMicrositeBlockList fallback.
 *
 * GATED + IDEMPOTENT + NON-DESTRUCTIVE:
 *   - Default run is a DRY RUN — reads current config and prints a before/after
 *     diff. Writes nothing.
 *   - Pass `--apply` to persist.
 *   - It ONLY sets micrositeBlockList on a mapped segment when that segment has
 *     none (or an identical one). It NEVER clobbers description / valueProps /
 *     messagingAngle / any hand-tuned copy. It sets defaultMicrositeBlockList
 *     only when absent. Re-running after apply is a no-op.
 *
 * The `schemaHint` strings are VERBATIM copies of the old "AVAILABLE BLOCKS"
 * lines (including inline guidance like "— 4 DSO pain points…"), so for a
 * mapped Dandy segment the prompt's AVAILABLE BLOCKS section is byte-identical
 * to the pre-refactor output. (The AUDIENCE section is intentionally NOT
 * byte-identical: it now uses Dandy's richer hand-tuned segment copy.)
 *
 * NOTE: hits the live DB (lib/db prefers NEON_DATABASE_URL = PROD).
 *
 * Run:  pnpm --filter @workspace/scripts exec tsx src/seed-dandy-microsite-block-lists.ts          # dry run
 *       pnpm --filter @workspace/scripts exec tsx src/seed-dandy-microsite-block-lists.ts --apply  # write
 */
import { eq } from "drizzle-orm";
import { db, pool, tenantsTable, lpBrandSettingsTable } from "@workspace/db";

const APPLY = process.argv.includes("--apply");
const TENANT_SLUG = "dandy";

interface BlockEntry { type: string; schemaHint: string; }

// ── Verbatim legacy block-lists (everything after `"<type>": ` on the old
//    "AVAILABLE BLOCKS" lines, including inline guidance) ──────────────────────

const DSO_CORPORATE_BLOCKS: BlockEntry[] = [
  { type: "dso-heartland-hero", schemaHint: "{ eyebrow, headline, companyName, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, stats: [{ value, label }] }" },
  { type: "dso-stat-bar", schemaHint: "{ stats: [{ value, label }], backgroundStyle }" },
  { type: "dso-challenges", schemaHint: "{ eyebrow, headline, backgroundStyle, layout (\"4-col\"), challenges: [{ title, desc }] } — 4 DSO pain points specific to this account" },
  { type: "dso-insights-dashboard", schemaHint: "{ eyebrow, headline, subheadline, practiceLabel, backgroundStyle, dashboardVariant (\"light\"|\"dark\") }" },
  { type: "dso-success-stories", schemaHint: "{ eyebrow, headline, backgroundStyle, cases: [{ name, stat, label, quote, author }] } — 2–3 real DSO case studies" },
  { type: "dso-pilot-steps", schemaHint: "{ eyebrow, headline, subheadline, backgroundStyle, steps: [{ title, subtitle, desc, details: string[] }] }" },
  { type: "dso-final-cta", schemaHint: "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle }" },
];

const DSO_PRACTICE_BLOCKS: BlockEntry[] = [
  { type: "dso-practice-nav", schemaHint: "{ dsoName, links: [{ label, anchor }], ctaText, ctaUrl } — sticky top nav; dsoName = the DSO or practice group name; links should match section anchors below (e.g. #perks, #steps, #faq)" },
  { type: "dso-practice-hero", schemaHint: "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, trustLine, backgroundStyle }" },
  { type: "dso-stat-row", schemaHint: "{ eyebrow, headline, items: [{ value, label, detail }], backgroundStyle }" },
  { type: "dso-partnership-perks", schemaHint: "{ eyebrow, headline, subheadline, perks: [exactly 6 × { icon, title, desc }], backgroundStyle } — list the exclusive DSO partnership benefits" },
  { type: "dso-split-feature", schemaHint: "{ eyebrow, headline, body, bullets: string[], ctaText, ctaUrl, imagePosition (\"left\"|\"right\"), backgroundStyle } — highlight AI Scan Review" },
  { type: "dso-software-showcase", schemaHint: "{ eyebrow, headline, body, features: [{ icon, label }], ctaText, ctaUrl, backgroundStyle, layout }" },
  { type: "dso-faq", schemaHint: "{ eyebrow, headline, subheadline, items: [{ question, answer }], backgroundStyle } — 4–5 questions practices actually ask" },
  { type: "dso-activation-steps", schemaHint: "{ eyebrow, headline, subheadline, steps: [{ step, title, desc }], ctaText, ctaUrl, backgroundStyle }" },
  { type: "dso-final-cta", schemaHint: "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle } — closing call to action" },
];

// Legacy "independent" set. block 3 baked in "Dandy" (old code interpolated
// `${brandName || "product"}`, which for Dandy = "Dandy"). Stored as the
// brand-level defaultMicrositeBlockList fallback (Dandy has no independent
// segment). The built-in NEUTRAL fallback already covers other tenants.
const INDEPENDENT_BLOCKS: BlockEntry[] = [
  { type: "hero", schemaHint: "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle (\"dark\"|\"white\"|\"light-gray\") }" },
  { type: "trust-bar", schemaHint: "{ items: [{ value, label }] } — 3–4 key proof stats" },
  { type: "benefits-grid", schemaHint: "{ headline, columns (3), items: [{ icon (lucide name), title, description }] } — 6 specific Dandy benefits" },
  { type: "testimonial", schemaHint: "{ quote, author, role, practiceName } — a real, specific practitioner voice" },
  { type: "how-it-works", schemaHint: "{ headline, steps: [{ number, title, description }] }" },
  { type: "comparison", schemaHint: "{ headline, oldWayLabel, oldWayBullets: string[], newWayLabel, newWayBullets: string[] }" },
  { type: "bottom-cta", schemaHint: "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle }" },
];

// Map REAL Dandy segment id → the verbatim legacy block-list it should carry.
const SEGMENT_BLOCK_LISTS: Record<string, { label: string; blockList: BlockEntry[] }> = {
  "seg-1774646615094-6blv1": { label: "Enterprise DSOs ≈ legacy dso-corporate", blockList: DSO_CORPORATE_BLOCKS },
  "seg-1774716006240-qdgu9": { label: "DSO Practices (Land & Expand) ≈ legacy dso-practice", blockList: DSO_PRACTICE_BLOCKS },
};

const BRAND_DEFAULT_BLOCK_LIST = INDEPENDENT_BLOCKS;

type Segment = Record<string, unknown>;

function asArr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function str(v: unknown): string { return typeof v === "string" ? v : ""; }
function deepEqual(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }

async function main() {
  console.log(`\n=== Dandy microsite block-list seed (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, TENANT_SLUG));
  if (!tenant) { console.error(`✗ Tenant slug "${TENANT_SLUG}" not found. Aborting.`); return; }
  console.log(`Tenant: #${tenant.id} ${tenant.name} (slug=${tenant.slug})\n`);

  const [brandRow] = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenant.id)).limit(1);
  if (!brandRow) { console.error(`✗ No lp_brand_settings row for tenant #${tenant.id}. Aborting.`); return; }

  const config = (brandRow.config ?? {}) as Record<string, unknown>;
  const currentSegments = asArr(config.segments) as Segment[];

  console.log(`Current brand.segments: ${currentSegments.length}`);
  for (const s of currentSegments) {
    console.log(`  - id=${JSON.stringify(s.id)} name=${JSON.stringify(s.name)} micrositeBlockList=${asArr(s.micrositeBlockList).length}`);
  }
  console.log(`Current brand.defaultMicrositeBlockList: ${asArr(config.defaultMicrositeBlockList).length} block(s)`);

  // Sanity: report mapping ids that are missing, and segments not in the map.
  for (const id of Object.keys(SEGMENT_BLOCK_LISTS)) {
    if (!currentSegments.some(s => str(s.id) === id)) {
      console.log(`  ⚠ mapping id "${id}" (${SEGMENT_BLOCK_LISTS[id].label}) NOT found among current segments`);
    }
  }
  for (const s of currentSegments) {
    if (!SEGMENT_BLOCK_LISTS[str(s.id)]) {
      console.log(`  ⚠ segment id "${str(s.id)}" (${str(s.name)}) has NO mapping — left untouched`);
    }
  }

  const merged: Segment[] = currentSegments.map(s => ({ ...s }));
  let anyChange = false;

  console.log(`\n--- Proposed per-segment changes (block-list only; copy untouched) ---`);
  for (let i = 0; i < merged.length; i++) {
    const s = merged[i];
    const id = str(s.id);
    const map = SEGMENT_BLOCK_LISTS[id];
    if (!map) continue;
    const existingBl = asArr(s.micrositeBlockList);
    if (existingBl.length === 0) {
      s.micrositeBlockList = map.blockList;
      anyChange = true;
      console.log(`\n[${id}] ${map.label}\n   • ADD micrositeBlockList (${map.blockList.length} blocks): ${map.blockList.map(b => b.type).join(", ")}`);
    } else if (deepEqual(existingBl, map.blockList)) {
      console.log(`\n[${id}] ${map.label}\n   • already matches target — no-op`);
    } else {
      console.log(`\n[${id}] ${map.label}\n   • ⚠ micrositeBlockList EXISTS and DIFFERS — LEFT AS-IS (no clobber)`);
    }
  }

  // Brand-level default fallback (legacy "independent" list).
  const newConfig: Record<string, unknown> = { ...config, segments: merged };
  if (asArr(config.defaultMicrositeBlockList).length === 0) {
    newConfig.defaultMicrositeBlockList = BRAND_DEFAULT_BLOCK_LIST;
    anyChange = true;
    console.log(`\n[brand] • ADD defaultMicrositeBlockList (${BRAND_DEFAULT_BLOCK_LIST.length} blocks, legacy "independent" set)`);
  } else if (deepEqual(config.defaultMicrositeBlockList, BRAND_DEFAULT_BLOCK_LIST)) {
    console.log(`\n[brand] • defaultMicrositeBlockList already matches — no-op`);
  } else {
    console.log(`\n[brand] • ⚠ defaultMicrositeBlockList EXISTS and DIFFERS — LEFT AS-IS (no clobber)`);
    newConfig.defaultMicrositeBlockList = config.defaultMicrositeBlockList;
  }

  console.log(`\n--- AFTER: segments' block-lists summary ---`);
  for (const s of merged) {
    const bl = asArr(s.micrositeBlockList) as BlockEntry[];
    console.log(`  - ${str(s.name)} (${str(s.id)}): [${bl.map(b => b.type).join(", ") || "—"}]`);
  }
  console.log(`  - brand.defaultMicrositeBlockList: [${(asArr(newConfig.defaultMicrositeBlockList) as BlockEntry[]).map(b => b.type).join(", ") || "—"}]`);

  if (!anyChange) { console.log(`\n✓ No changes needed — already seeded (idempotent no-op).\n`); return; }
  if (!APPLY) { console.log(`\nDRY RUN complete. Review above. Re-run with --apply to persist.\n`); return; }

  await db.update(lpBrandSettingsTable).set({ config: newConfig }).where(eq(lpBrandSettingsTable.id, brandRow.id));
  console.log(`\n✓ APPLIED — lp_brand_settings #${brandRow.id} updated for tenant #${tenant.id}.\n`);
}

main()
  .catch((err) => { console.error("Seed error:", err); process.exitCode = 1; })
  .finally(() => pool.end());
