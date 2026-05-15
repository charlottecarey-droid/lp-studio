import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = drizzle(pool);
const tenantId = 5;
const idList = [1025];
console.log('--- Test A: ANY(${idList}::int[]) (current code)');
try {
  const rows = await db.execute(sql`SELECT id, name, length((props->>'template')) AS tlen FROM lp_custom_blocks WHERE tenant_id = ${tenantId} AND block_type = 'schema' AND id = ANY(${idList}::int[])`);
  console.log('rowCount:', rows.rowCount, 'rows:', rows.rows);
} catch (e) { console.log('THREW:', e.message); }

console.log('\n--- Test B: ANY(${idList}) no cast');
try {
  const rows = await db.execute(sql`SELECT id, name, length((props->>'template')) AS tlen FROM lp_custom_blocks WHERE tenant_id = ${tenantId} AND block_type = 'schema' AND id = ANY(${idList})`);
  console.log('rowCount:', rows.rowCount, 'rows:', rows.rows);
} catch (e) { console.log('THREW:', e.message); }

console.log('\n--- Test C: id IN ( joined sql params )');
try {
  const rows = await db.execute(sql`SELECT id, name, length((props->>'template')) AS tlen FROM lp_custom_blocks WHERE tenant_id = ${tenantId} AND block_type = 'schema' AND id IN (${sql.join(idList.map(n => sql`${n}`), sql`, `)})`);
  console.log('rowCount:', rows.rowCount, 'rows:', rows.rows);
} catch (e) { console.log('THREW:', e.message); }

console.log('\n--- Test D: literal ANY(ARRAY[1025])');
try {
  const rows = await db.execute(sql.raw(`SELECT id, name, length((props->>'template')) AS tlen FROM lp_custom_blocks WHERE tenant_id = 5 AND block_type = 'schema' AND id = ANY(ARRAY[1025]::int[])`));
  console.log('rowCount:', rows.rowCount, 'rows:', rows.rows);
} catch (e) { console.log('THREW:', e.message); }

await pool.end();
