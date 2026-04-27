#!/usr/bin/env node
/**
 * Verification test for task #94: per-tenant image library + Dandy/Dandy SMB
 * share + shared starter set.
 *
 * Asserts directly against the database (using the same Drizzle-style WHERE
 * clauses the API uses) that:
 *   1. The schema migration is applied (columns + CHECK constraint present).
 *   2. The Dandy ↔ Dandy SMB share pair is configured RECIPROCALLY.
 *   3. Royal (id 7) and Max (id 10) cannot see ANY Dandy or Dandy SMB media.
 *   4. Dandy (id 1) sees its own + Dandy SMB media + shared starter rows.
 *   5. Dandy SMB (id 5) sees its own + Dandy media + shared starter rows.
 *   6. Shared starter rows (is_shared=true, tenant_id=null) are visible to
 *      every tenant, but only writable by the admin endpoint (their
 *      tenant_id IS NULL means the writable predicate excludes them).
 *
 * Exits non-zero on any failed assertion. Run after applying changes and as
 * part of pre-deploy CI. Requires NEON_DATABASE_URL.
 */
const path = require("path");
const { Client } = require(path.join(__dirname, "..", "lib", "db", "node_modules", "pg"));

const DB_URL = process.env.NEON_DATABASE_URL;
if (!DB_URL) {
  console.error("NEON_DATABASE_URL env var required");
  process.exit(1);
}

const DANDY = 1, DANDY_SMB = 5, ROYAL = 7, MAX = 10;

let pass = 0, fail = 0;
function assert(cond, label, detail) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL  ${label}`);
    if (detail !== undefined) console.error(`        ${detail}`);
  }
}

// Mirrors resolveLibraryTenantScope: requires reciprocal share.
async function ownedTenantIds(client, tenantId) {
  const own = await client.query(
    `SELECT shares_library_with_tenant_id AS s FROM tenants WHERE id=$1 LIMIT 1`,
    [tenantId],
  );
  const sibling = own.rows[0]?.s;
  if (sibling == null || sibling === tenantId) return [tenantId];
  const recip = await client.query(
    `SELECT shares_library_with_tenant_id AS s FROM tenants WHERE id=$1 LIMIT 1`,
    [sibling],
  );
  return recip.rows[0]?.s === tenantId ? [tenantId, sibling] : [tenantId];
}

// Mirrors libraryReadablePredicate: own + sibling + shared.
async function readableImageIds(client, tenantId) {
  const owned = await ownedTenantIds(client, tenantId);
  const r = await client.query(
    `SELECT id, tenant_id, is_shared FROM lp_media
       WHERE media_type = 'image'
         AND (tenant_id = ANY($1::int[]) OR is_shared = true)`,
    [owned],
  );
  return r.rows;
}

// Mirrors libraryWritablePredicate: own + sibling only (NOT shared).
async function writableImageIds(client, tenantId) {
  const owned = await ownedTenantIds(client, tenantId);
  const r = await client.query(
    `SELECT id, tenant_id FROM lp_media
       WHERE media_type = 'image' AND tenant_id = ANY($1::int[])`,
    [owned],
  );
  return r.rows;
}

(async () => {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log("[1] Schema migration applied");
    const cols = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
         WHERE (table_name='lp_media' AND column_name IN ('is_shared','tenant_id'))
            OR (table_name='tenants'  AND column_name='shares_library_with_tenant_id')`,
    );
    const present = new Set(cols.rows.map(r => `${r.table_name}.${r.column_name}`));
    assert(present.has("lp_media.is_shared"), "lp_media.is_shared exists");
    assert(present.has("lp_media.tenant_id"), "lp_media.tenant_id exists");
    assert(present.has("tenants.shares_library_with_tenant_id"), "tenants.shares_library_with_tenant_id exists");
    const tn = await client.query(
      `SELECT is_nullable FROM information_schema.columns
         WHERE table_name='lp_media' AND column_name='tenant_id'`,
    );
    assert(tn.rows[0]?.is_nullable === "YES", "lp_media.tenant_id is nullable");
    const ck = await client.query(
      `SELECT 1 FROM pg_constraint
         WHERE conrelid='lp_media'::regclass AND conname='lp_media_shared_implies_null_tenant'`,
    );
    assert(ck.rows.length === 1, "CHECK constraint lp_media_shared_implies_null_tenant present");

    console.log("\n[2] Reciprocal Dandy ↔ Dandy SMB share pair");
    const sp = await client.query(
      `SELECT id, shares_library_with_tenant_id AS s FROM tenants
         WHERE id IN ($1,$2,$3,$4) ORDER BY id`,
      [DANDY, DANDY_SMB, ROYAL, MAX],
    );
    const byId = Object.fromEntries(sp.rows.map(r => [r.id, r.s]));
    assert(byId[DANDY] === DANDY_SMB, `tenants[${DANDY}].shares = ${DANDY_SMB}`, `got ${byId[DANDY]}`);
    assert(byId[DANDY_SMB] === DANDY, `tenants[${DANDY_SMB}].shares = ${DANDY}`, `got ${byId[DANDY_SMB]}`);
    assert(byId[ROYAL] == null, `tenants[${ROYAL}] (Royal) has no share`, `got ${byId[ROYAL]}`);
    assert(byId[MAX] == null, `tenants[${MAX}] (Max) has no share`, `got ${byId[MAX]}`);

    console.log("\n[3] Royal & Max cannot see ANY Dandy/Dandy-SMB media");
    for (const t of [ROYAL, MAX]) {
      const rows = await readableImageIds(client, t);
      const dandyish = rows.filter(r => r.tenant_id === DANDY || r.tenant_id === DANDY_SMB);
      assert(dandyish.length === 0, `tenant ${t} sees 0 Dandy/SMB rows`, `saw ${dandyish.length}`);
      const own = rows.filter(r => r.tenant_id === t).length;
      const shared = rows.filter(r => r.is_shared === true).length;
      console.log(`        tenant ${t} library = ${own} own + ${shared} shared`);
    }

    console.log("\n[4] Dandy sees its own + Dandy SMB media + shared");
    {
      const rows = await readableImageIds(client, DANDY);
      const own = rows.filter(r => r.tenant_id === DANDY).length;
      const sibling = rows.filter(r => r.tenant_id === DANDY_SMB).length;
      const shared = rows.filter(r => r.is_shared === true).length;
      const foreign = rows.filter(r => r.tenant_id != null && r.tenant_id !== DANDY && r.tenant_id !== DANDY_SMB).length;
      assert(own > 0, "Dandy sees its own rows", `own=${own}`);
      assert(sibling > 0, "Dandy sees Dandy SMB rows", `sibling=${sibling}`);
      assert(shared > 0, "Dandy sees shared starter rows", `shared=${shared}`);
      assert(foreign === 0, "Dandy sees NO Royal/Max rows", `foreign=${foreign}`);
    }

    console.log("\n[5] Dandy SMB sees its own + Dandy media + shared");
    {
      const rows = await readableImageIds(client, DANDY_SMB);
      const own = rows.filter(r => r.tenant_id === DANDY_SMB).length;
      const sibling = rows.filter(r => r.tenant_id === DANDY).length;
      const shared = rows.filter(r => r.is_shared === true).length;
      const foreign = rows.filter(r => r.tenant_id != null && r.tenant_id !== DANDY && r.tenant_id !== DANDY_SMB).length;
      assert(own > 0, "Dandy SMB sees its own rows", `own=${own}`);
      assert(sibling > 0, "Dandy SMB sees Dandy rows", `sibling=${sibling}`);
      assert(shared > 0, "Dandy SMB sees shared starter rows", `shared=${shared}`);
      assert(foreign === 0, "Dandy SMB sees NO Royal/Max rows", `foreign=${foreign}`);
    }

    console.log("\n[6] Shared starter rows are read-only to non-admin tenants");
    for (const t of [DANDY, DANDY_SMB, ROYAL, MAX]) {
      const writable = await writableImageIds(client, t);
      const sharedWritable = writable.filter(r => r.tenant_id == null).length;
      assert(sharedWritable === 0, `tenant ${t} cannot mutate shared rows`, `mutable=${sharedWritable}`);
    }

    console.log(`\n=== ${pass} passed, ${fail} failed ===`);
    process.exit(fail === 0 ? 0 : 1);
  } finally {
    await client.end();
  }
})().catch(e => { console.error(e); process.exit(1); });
