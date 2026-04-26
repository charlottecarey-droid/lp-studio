#!/usr/bin/env node
/**
 * One-shot cleanup: scrub Dandy-flavored values from non-Dandy tenants'
 * `lp_brand_settings.config`.
 *
 * Why this exists
 * ---------------
 * Until brand-config.ts was updated, DEFAULT_BRAND seeded:
 *   - copyrightName: "Dandy"
 *   - navCtaUrl    : https://www.meetdandy.com/get-started/
 *   - defaultCtaUrl: https://www.meetdandy.com/get-started/
 *   - socialUrls   : meetdandy.com profile URLs
 *
 * When a generic tenant first loaded brand settings, the editor merged those
 * defaults into the row and persisted them on save. The known leaked tenant
 * is Royal (id 7), but this script will fix any non-Dandy tenant.
 *
 * Tenant IDs to PRESERVE untouched (Dandy / Dandy SMB):
 *   1, 5
 *
 * Usage:
 *   node scripts/cleanup-generic-brand-leaks.cjs           # uses NEON_DATABASE_URL ?? DATABASE_URL
 *   node scripts/cleanup-generic-brand-leaks.cjs --dry     # show what would change
 */
const path = require("path");
const { Pool } = require(path.join(__dirname, "..", "lib", "db", "node_modules", "pg"));

const DRY = process.argv.includes("--dry");
const PROTECTED_TENANT_IDS = [1, 5]; // Dandy primary + Dandy SMB

// We match the literal substring "meetdandy" — this catches both the Dandy
// website (meetdandy.com) and Dandy's social profile paths
// (e.g. facebook.com/meetdandy/, linkedin.com/company/meetdandy/).
function isDandyUrl(u) {
  if (!u || typeof u !== "string") return false;
  return u.toLowerCase().includes("meetdandy");
}

// Static Dandy logo paths historically baked into DEFAULT_BRAND.logoUrl
// (e.g. "/dandy-logo.svg", "/dandy-logo-white.svg"). These never include
// "meetdandy" so isDandyUrl misses them — match them separately.
function isDandyLogoPath(u) {
  if (!u || typeof u !== "string") return false;
  return /(^|\/)dandy-logo([-.\w]*)?\.(svg|png|webp|jpg|jpeg)$/i.test(u);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL });
  let scanned = 0, mutated = 0;
  try {
    const { rows } = await pool.query(
      `SELECT tenant_id, config
         FROM lp_brand_settings
        WHERE tenant_id <> ALL($1::int[])`,
      [PROTECTED_TENANT_IDS]
    );
    for (const r of rows) {
      scanned++;
      const cfg = { ...(r.config ?? {}) };
      const before = JSON.stringify(cfg);
      let changed = false;

      // navCtaUrl, defaultCtaUrl, logoUrl
      for (const k of ["navCtaUrl", "defaultCtaUrl", "logoUrl"]) {
        if (isDandyUrl(cfg[k])) {
          cfg[k] = k === "logoUrl" ? "" : "#";
          changed = true;
        }
      }
      // Static /dandy-logo*.{svg,png,…} paths from the old DEFAULT_BRAND.
      if (isDandyLogoPath(cfg.logoUrl)) {
        cfg.logoUrl = "";
        changed = true;
      }
      // copyrightName == "Dandy"
      if (cfg.copyrightName === "Dandy" || cfg.copyrightName === "Dandy, Inc.") {
        cfg.copyrightName = "";
        changed = true;
      }
      // socialUrls.{facebook,instagram,linkedin}
      if (cfg.socialUrls && typeof cfg.socialUrls === "object") {
        const next = { ...cfg.socialUrls };
        for (const k of ["facebook", "instagram", "linkedin"]) {
          if (isDandyUrl(next[k])) { next[k] = ""; changed = true; }
        }
        cfg.socialUrls = next;
      }

      if (!changed) continue;
      mutated++;
      const after = JSON.stringify(cfg);
      console.log(`[tenant ${r.tenant_id}] cleanup needed`);
      console.log(`  before: ${before}`);
      console.log(`  after : ${after}`);

      if (!DRY) {
        await pool.query(
          `UPDATE lp_brand_settings SET config = $2, updated_at = NOW()
            WHERE tenant_id = $1`,
          [r.tenant_id, cfg]
        );
      }
    }
    console.log(`\n[cleanup] scanned=${scanned} mutated=${mutated} ${DRY ? "(dry-run)" : ""}`);
  } catch (e) {
    console.error("[cleanup] error:", e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
