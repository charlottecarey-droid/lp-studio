#!/usr/bin/env node
/**
 * Idempotently set the Chili Piper handoff config on a tenant's lp_forms row.
 * The CP scheduler URL lives only in the DB row (not in app code) so per-tenant
 * isolation is preserved — other tenants' viewers never see this URL.
 *
 * Usage:
 *   node scripts/seed-smb-chilipiper.cjs \
 *     --tenant=<tenant-slug> \
 *     --form="<form name>" \
 *     --cp-url="https://<your-org>.chilipiper.com/..." \
 *     [--mode=modal|redirect] \
 *     [--field-map='{"Email":"email","FirstName":"firstName"}']
 *
 * Required env: NEON_DATABASE_URL
 *
 * Re-runnable: replaces chili_piper_config on the matched form. Prints what
 * changed (or "no change" if the config already matched).
 */
const path = require("path");
const { Client } = require(path.join(__dirname, "..", "lib", "db", "node_modules", "pg"));

const DB_URL = process.env.NEON_DATABASE_URL;
if (!DB_URL) {
  console.error("NEON_DATABASE_URL env var required");
  process.exit(1);
}

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = arg("tenant");
const formName = arg("form");
const cpUrl = arg("cp-url");
const mode = arg("mode") || "modal";
const fieldMapRaw = arg("field-map");

if (!tenantSlug || !formName || !cpUrl) {
  console.error(
    "Missing required args. Example:\n" +
      "  node scripts/seed-smb-chilipiper.cjs \\\n" +
      "    --tenant=smb \\\n" +
      "    --form=\"Global Form\" \\\n" +
      "    --cp-url=\"https://yourcompany.chilipiper.com/router/your-router\" \\\n" +
      "    [--mode=modal|redirect] \\\n" +
      "    [--field-map='{\"Email\":\"email\"}']",
  );
  process.exit(1);
}

if (mode !== "modal" && mode !== "redirect") {
  console.error(`--mode must be "modal" or "redirect" (got "${mode}")`);
  process.exit(1);
}

let fieldMap;
if (fieldMapRaw) {
  try {
    fieldMap = JSON.parse(fieldMapRaw);
    if (typeof fieldMap !== "object" || Array.isArray(fieldMap) || fieldMap === null) {
      throw new Error("must be a JSON object");
    }
  } catch (err) {
    console.error(`--field-map invalid JSON: ${err.message}`);
    process.exit(1);
  }
}

const config = { url: cpUrl, mode };
if (fieldMap) config.fieldMap = fieldMap;

(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const t = await client.query(`SELECT id, name, slug FROM tenants WHERE slug = $1 LIMIT 1`, [tenantSlug]);
    if (t.rowCount === 0) {
      console.error(`No tenant with slug "${tenantSlug}".`);
      process.exit(2);
    }
    const tenant = t.rows[0];
    console.log(`Tenant: #${tenant.id} ${JSON.stringify(tenant.name)} (slug=${tenant.slug})`);

    const f = await client.query(
      `SELECT id, name, chili_piper_config
         FROM lp_forms
        WHERE tenant_id = $1 AND name = $2
        LIMIT 1`,
      [tenant.id, formName],
    );
    if (f.rowCount === 0) {
      console.error(`No lp_forms row with name ${JSON.stringify(formName)} for tenant "${tenantSlug}".`);
      process.exit(3);
    }
    const form = f.rows[0];
    const before = form.chili_piper_config;
    if (before && JSON.stringify(before) === JSON.stringify(config)) {
      console.log(`Form #${form.id} "${form.name}" — no change (chili_piper_config already up to date).`);
      return;
    }

    await client.query(
      `UPDATE lp_forms SET chili_piper_config = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(config), form.id],
    );
    console.log(`Form #${form.id} "${form.name}" updated.`);
    console.log(`  before: ${before ? JSON.stringify(before) : "null"}`);
    console.log(`  after : ${JSON.stringify(config)}`);
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
