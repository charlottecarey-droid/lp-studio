#!/usr/bin/env node
/**
 * One-time migration: re-home the 8 bundled dandy-product-*.webp images out
 * of the lp-studio JS bundle into Dandy's tenant media library, then patch
 * the affected lp_pages to reference them by imageUrl.
 *
 * Why: BlockDsoProductsGrid currently imports the product photos directly,
 * shipping them to every tenant's bundle. Once these uploads exist + the
 * pages are patched, we can drop those imports without breaking Dandy's
 * existing pages. Royal/Max/etc. never used the fallback so they're unaffected.
 *
 * Idempotent: skips uploads if a row with the same title already exists in
 * Dandy's library tagged "dso-products-grid", and skips page patches when
 * imageUrl is already set.
 *
 * Requires:
 *   - API server running on localhost:8080 (so we can use /api/lp/media/shared/upload)
 *   - ADMIN_PASSWORD env var
 *   - NEON_DATABASE_URL env var
 */
const fs = require("fs");
const path = require("path");
const { Client } = require(path.join(__dirname, "..", "lib", "db", "node_modules", "pg"));

const API_BASE = process.env.API_BASE || "http://localhost:8080";
const ADMIN_KEY = process.env.ADMIN_PASSWORD;
const DB_URL = process.env.NEON_DATABASE_URL;
const DANDY_TENANT_ID = 1;
const ASSETS_DIR = path.join(__dirname, "..", "artifacts", "lp-studio", "src", "assets");

if (!ADMIN_KEY) {
  console.error("ADMIN_PASSWORD env var required");
  process.exit(1);
}
if (!DB_URL) {
  console.error("NEON_DATABASE_URL env var required");
  process.exit(1);
}

// imageKey -> { file, title, friendlyName }
// Titles match the canonical names BlockDsoProductsGrid uses for `name`.
const IMAGES = [
  { key: "posterior-crowns", file: "dandy-product-posterior-crowns.webp", title: "Posterior Crowns" },
  { key: "anterior-crowns",  file: "dandy-product-anterior-crowns.webp",  title: "Anterior Crowns" },
  { key: "dentures",         file: "dandy-product-dentures.webp",         title: "Dentures" },
  { key: "implants",         file: "dandy-product-implants.webp",         title: "Implant Restorations" },
  { key: "guided-surgery",   file: "dandy-product-guided-surgery.webp",   title: "Guided Surgery" },
  { key: "aligners",         file: "dandy-product-aligners.webp",         title: "Clear Aligners" },
  { key: "guards",           file: "dandy-product-guards.webp",           title: "Night Guards & TMJ" },
  { key: "sleep",            file: "dandy-product-sleep.webp",            title: "Sleep Appliances" },
];

const TAG = "dso-products-grid";

async function ensureUpload(client, img) {
  // Check if Dandy already has a row with this title + tag.
  const existing = await client.query(
    `SELECT id, url FROM lp_media
     WHERE tenant_id = $1
       AND media_type = 'image'
       AND title = $2
       AND tags @> to_jsonb($3::text[])
     ORDER BY id ASC
     LIMIT 1`,
    [DANDY_TENANT_ID, img.title, [TAG]],
  );
  if (existing.rows.length > 0) {
    console.log(`  [skip] ${img.title} already exists (id=${existing.rows[0].id})`);
    return existing.rows[0].url;
  }

  const filePath = path.join(ASSETS_DIR, img.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source asset missing: ${filePath}`);
  }
  const buf = fs.readFileSync(filePath);

  const fd = new FormData();
  const blob = new Blob([buf], { type: "image/webp" });
  fd.append("file", blob, img.file);
  fd.append("title", img.title);
  fd.append("tags", `${TAG},dental,product-detail,dandy-product`);
  fd.append("tenantId", String(DANDY_TENANT_ID));

  const res = await fetch(`${API_BASE}/api/lp/media/shared/upload`, {
    method: "POST",
    headers: { "x-admin-key": ADMIN_KEY },
    body: fd,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upload failed for ${img.title}: ${res.status} ${text}`);
  }
  const json = JSON.parse(text);
  console.log(`  [up]   ${img.title} -> ${json.url} (id=${json.id})`);
  return json.url;
}

async function patchPage(client, pageId, urlByKey) {
  const r = await client.query("SELECT blocks FROM lp_pages WHERE id = $1", [pageId]);
  if (r.rows.length === 0) {
    console.log(`  [page ${pageId}] not found, skipping`);
    return;
  }
  const blocks = r.rows[0].blocks;
  if (!Array.isArray(blocks)) {
    console.log(`  [page ${pageId}] blocks is not an array, skipping`);
    return;
  }
  let mutated = false;
  for (const b of blocks) {
    if (b?.type !== "dso-products-grid") continue;
    const products = b.props?.products;
    if (!Array.isArray(products)) continue;
    for (const p of products) {
      if (p.imageUrl) continue; // don't clobber existing
      const key = p.imageKey;
      if (key && urlByKey[key]) {
        p.imageUrl = urlByKey[key];
        mutated = true;
        console.log(`  [page ${pageId}] set imageUrl for "${p.name}" (${key})`);
      }
    }
  }
  if (mutated) {
    await client.query(
      "UPDATE lp_pages SET blocks = $1::jsonb, updated_at = now() WHERE id = $2",
      [JSON.stringify(blocks), pageId],
    );
    console.log(`  [page ${pageId}] saved`);
  } else {
    console.log(`  [page ${pageId}] no changes`);
  }
}

(async () => {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Uploading 8 product photos to Dandy's library...");
  const urlByKey = {};
  for (const img of IMAGES) {
    urlByKey[img.key] = await ensureUpload(client, img);
  }

  console.log("\nPatching affected lp_pages...");
  // 191 already fully populated; skip. The other 4 have at least one undefined imageUrl.
  const pages = [269, 242, 273, 275, 191];
  for (const id of pages) {
    await patchPage(client, id, urlByKey);
  }

  await client.end();
  console.log("\nDone.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
