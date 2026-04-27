#!/usr/bin/env node
/**
 * Idempotent migration for task #94 (per-tenant image library + Dandy/Dandy
 * SMB share + shared starter set). Applied once against the live DB on
 * 2026-04-27; safe to re-run.
 *
 * Why a script instead of a drizzle-kit migration: drizzle-kit push was
 * blocked by unrelated drift in the sfdc_leads / tenants.metadata tables.
 * This script makes only the additive, constraint-safe changes the task
 * requires and is the source of truth for the rollout.
 *
 * Changes applied:
 *   1. lp_media.is_shared boolean NOT NULL DEFAULT false
 *   2. lp_media.tenant_id made nullable (so shared rows can have null)
 *   3. tenants.shares_library_with_tenant_id integer (nullable)
 *   4. CHECK constraint lp_media_shared_implies_null_tenant
 *      (NOT is_shared OR tenant_id IS NULL)
 *   5. tenants 1 ↔ 5 reciprocal share pair (Dandy ↔ Dandy SMB)
 *
 * After running this, also run (in order, idempotent):
 *   - node scripts/seed-dandy-product-library.cjs
 *   - node scripts/seed-shared-starter-library.cjs
 *
 * Requires NEON_DATABASE_URL.
 */
const path = require("path");
const { Client } = require(path.join(__dirname, "..", "lib", "db", "node_modules", "pg"));

const DB_URL = process.env.NEON_DATABASE_URL;
if (!DB_URL) {
  console.error("NEON_DATABASE_URL env var required");
  process.exit(1);
}

const DANDY_TENANT_ID = 1;
const DANDY_SMB_TENANT_ID = 5;

async function columnExists(client, table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, column],
  );
  return r.rows.length > 0;
}

async function constraintExists(client, table, name) {
  const r = await client.query(
    `SELECT 1 FROM pg_constraint
       WHERE conrelid = $1::regclass AND conname = $2 LIMIT 1`,
    [table, name],
  );
  return r.rows.length > 0;
}

async function isNullable(client, table, column) {
  const r = await client.query(
    `SELECT is_nullable FROM information_schema.columns
       WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, column],
  );
  return r.rows[0]?.is_nullable === "YES";
}

(async () => {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log("Step 1: lp_media.is_shared");
    if (!(await columnExists(client, "lp_media", "is_shared"))) {
      await client.query(`ALTER TABLE lp_media ADD COLUMN is_shared boolean NOT NULL DEFAULT false`);
      console.log("  added");
    } else {
      console.log("  already present, skipping");
    }

    console.log("Step 2: lp_media.tenant_id nullable");
    if (!(await isNullable(client, "lp_media", "tenant_id"))) {
      await client.query(`ALTER TABLE lp_media ALTER COLUMN tenant_id DROP NOT NULL`);
      console.log("  dropped NOT NULL");
    } else {
      console.log("  already nullable, skipping");
    }

    console.log("Step 3: tenants.shares_library_with_tenant_id");
    if (!(await columnExists(client, "tenants", "shares_library_with_tenant_id"))) {
      await client.query(`ALTER TABLE tenants ADD COLUMN shares_library_with_tenant_id integer`);
      console.log("  added");
    } else {
      console.log("  already present, skipping");
    }

    console.log("Step 4: CHECK constraint lp_media_shared_implies_null_tenant");
    if (!(await constraintExists(client, "lp_media", "lp_media_shared_implies_null_tenant"))) {
      // Validate no existing row would violate.
      const bad = await client.query(
        `SELECT COUNT(*)::int AS n FROM lp_media WHERE is_shared = true AND tenant_id IS NOT NULL`,
      );
      if (bad.rows[0].n > 0) {
        throw new Error(`Cannot add CHECK: ${bad.rows[0].n} existing rows violate it`);
      }
      await client.query(
        `ALTER TABLE lp_media
           ADD CONSTRAINT lp_media_shared_implies_null_tenant
           CHECK (NOT is_shared OR tenant_id IS NULL)`,
      );
      console.log("  added");
    } else {
      console.log("  already present, skipping");
    }

    console.log("Step 5: Dandy ↔ Dandy SMB reciprocal share pair (tenants 1 ↔ 5)");
    const before = await client.query(
      `SELECT id, name, shares_library_with_tenant_id FROM tenants
         WHERE id IN ($1, $2) ORDER BY id`,
      [DANDY_TENANT_ID, DANDY_SMB_TENANT_ID],
    );
    if (before.rows.length !== 2) {
      throw new Error(`Expected tenants ${DANDY_TENANT_ID} and ${DANDY_SMB_TENANT_ID} to exist; found ${before.rows.length}`);
    }
    await client.query(
      `UPDATE tenants SET shares_library_with_tenant_id = $1 WHERE id = $2`,
      [DANDY_SMB_TENANT_ID, DANDY_TENANT_ID],
    );
    await client.query(
      `UPDATE tenants SET shares_library_with_tenant_id = $1 WHERE id = $2`,
      [DANDY_TENANT_ID, DANDY_SMB_TENANT_ID],
    );
    const after = await client.query(
      `SELECT id, name, shares_library_with_tenant_id FROM tenants
         WHERE id IN ($1, $2) ORDER BY id`,
      [DANDY_TENANT_ID, DANDY_SMB_TENANT_ID],
    );
    console.table(after.rows);

    console.log("\nMigration complete.");
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
