// Prune a database copy down to a keep-list of tenants — the mechanical half
// of the "Neon branch-and-prune" instance split (July 2026 plan: the public
// product gets its own deployment + database; Dandy keeps this one; either
// side of a split starts as a full Neon branch/copy of prod and is then
// pruned to just its tenants with this script).
//
// Usage (ALWAYS dry-run first — prints the full impact report and mutates
// nothing without --apply):
//
//   DATABASE_URL=<copy> pnpm --filter @workspace/api-server exec tsx scripts/prune-tenants.ts --keep 1,5
//   DATABASE_URL=<copy> pnpm --filter @workspace/api-server exec tsx scripts/prune-tenants.ts --keep 1,5 --reassign-global-to 1 --apply
//
// What it does, in order (single transaction when --apply):
//   1. Confirms every keep-list tenant exists and prints its slug/name.
//   2. GLOBAL TEMPLATE GUARD: lp_pages rows with is_global=true are the
//      cross-tenant template library, but each row is OWNED by some tenant —
//      deleting that tenant cascades the library away. The script always
//      reports globals owned by pruned tenants and REFUSES to apply while any
//      exist unless --reassign-global-to <keepTenantId> is given (which
//      re-homes them first).
//   3. Sweeps every public-schema table that has a tenant_id column:
//      DELETE WHERE tenant_id IS NOT NULL AND tenant_id NOT IN (keep…).
//      (NULL tenant_id rows — e.g. the shared starter media library — are
//      always kept.)
//   4. Deletes the pruned tenants rows themselves (FK cascades take any
//      children that don't carry their own tenant_id).
//   5. Verifies: re-counts every swept table and aborts (rollback) if any
//      out-of-keep-list rows survive.
//
// The script never touches tables without a tenant_id column (plan config,
// email shell templates, recipe overrides, etc. are platform-level and belong
// on both instances).
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface Args {
  keep: number[];
  apply: boolean;
  reassignGlobalTo: number | null;
}

function parseArgs(argv: string[]): Args {
  let keep: number[] = [];
  let apply = false;
  let reassignGlobalTo: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--keep" && argv[i + 1]) {
      keep = argv[++i]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
    } else if (argv[i] === "--apply") {
      apply = true;
    } else if (argv[i] === "--reassign-global-to" && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isInteger(n) && n > 0) reassignGlobalTo = n;
    }
  }
  return { keep, apply, reassignGlobalTo };
}

async function main(): Promise<void> {
  const { keep, apply, reassignGlobalTo } = parseArgs(process.argv.slice(2));
  if (keep.length === 0) {
    console.error("Usage: tsx scripts/prune-tenants.ts --keep <id,id,…> [--reassign-global-to <id>] [--apply]");
    process.exit(1);
  }
  if (reassignGlobalTo !== null && !keep.includes(reassignGlobalTo)) {
    console.error(`--reassign-global-to ${reassignGlobalTo} must be one of the kept tenants (${keep.join(",")})`);
    process.exit(1);
  }
  const keepList = sql.join(keep.map((id) => sql`${id}`), sql`, `);

  // ── 1. Keep-list sanity ───────────────────────────────────────────────────
  const tenants = await db.execute<{ id: number; slug: string | null; name: string | null }>(
    sql`SELECT id, slug, name FROM tenants ORDER BY id`,
  );
  const tenantRows = tenants.rows ?? [];
  const byId = new Map(tenantRows.map((t) => [Number(t.id), t]));
  for (const id of keep) {
    if (!byId.has(id)) {
      console.error(`Keep-list tenant ${id} does not exist in this database — aborting.`);
      process.exit(1);
    }
  }
  const pruned = tenantRows.filter((t) => !keep.includes(Number(t.id)));
  console.log(`Database has ${tenantRows.length} tenants.`);
  console.log(`KEEPING:  ${keep.map((id) => `${id} (${byId.get(id)?.slug ?? byId.get(id)?.name ?? "?"})`).join(", ")}`);
  console.log(`PRUNING:  ${pruned.length === 0 ? "(none)" : pruned.map((t) => `${t.id} (${t.slug ?? t.name ?? "?"})`).join(", ")}`);
  if (pruned.length === 0) {
    console.log("Nothing to prune — exiting.");
    return;
  }

  // ── 2. Global template guard ─────────────────────────────────────────────
  const globals = await db.execute<{ count: string }>(
    sql`SELECT count(*) AS count FROM lp_pages WHERE is_global = true AND tenant_id IS NOT NULL AND tenant_id NOT IN (${keepList})`,
  );
  const globalCount = Number(globals.rows?.[0]?.count ?? 0);
  if (globalCount > 0) {
    console.log(`\n⚠ ${globalCount} GLOBAL template page(s) are owned by pruned tenants.`);
    if (reassignGlobalTo === null) {
      console.log("  Deleting their owners would cascade the shared template library away.");
      console.log("  Re-run with --reassign-global-to <keptTenantId> to re-home them first.");
      if (apply) {
        console.error("\nRefusing to --apply while unhandled global templates exist.");
        process.exit(1);
      }
    } else {
      console.log(`  Will reassign them to tenant ${reassignGlobalTo} before pruning.`);
    }
  }

  // ── 3. Discover tenant-scoped tables + impact report ─────────────────────
  const tablesRes = await db.execute<{ table_name: string }>(
    sql`SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'tenant_id'
        ORDER BY table_name`,
  );
  const tables = (tablesRes.rows ?? []).map((r) => r.table_name).filter((t) => t !== "tenants");

  console.log(`\nImpact report (${tables.length} tenant-scoped tables):`);
  let totalToDelete = 0;
  for (const table of tables) {
    const res = await db.execute<{ count: string }>(
      sql`SELECT count(*) AS count FROM ${sql.identifier(table)} WHERE tenant_id IS NOT NULL AND tenant_id NOT IN (${keepList})`,
    );
    const count = Number(res.rows?.[0]?.count ?? 0);
    totalToDelete += count;
    if (count > 0) console.log(`  ${table.padEnd(40)} ${count}`);
  }
  console.log(`  ${"tenants".padEnd(40)} ${pruned.length}`);
  console.log(`Total rows to delete (before FK cascades): ${totalToDelete + pruned.length}`);

  if (!apply) {
    console.log("\nDry run — nothing deleted. Re-run with --apply to execute.");
    return;
  }

  // ── 4. Apply, in one transaction ─────────────────────────────────────────
  console.log("\nApplying…");
  await db.transaction(async (tx) => {
    if (globalCount > 0 && reassignGlobalTo !== null) {
      await tx.execute(
        sql`UPDATE lp_pages SET tenant_id = ${reassignGlobalTo}
            WHERE is_global = true AND tenant_id IS NOT NULL AND tenant_id NOT IN (${keepList})`,
      );
      console.log(`  reassigned ${globalCount} global template(s) to tenant ${reassignGlobalTo}`);
    }
    for (const table of tables) {
      await tx.execute(
        sql`DELETE FROM ${sql.identifier(table)} WHERE tenant_id IS NOT NULL AND tenant_id NOT IN (${keepList})`,
      );
    }
    await tx.execute(sql`DELETE FROM tenants WHERE id NOT IN (${keepList})`);

    // ── 5. Verify inside the transaction — any survivor rolls back ────────
    for (const table of tables) {
      const res = await tx.execute<{ count: string }>(
        sql`SELECT count(*) AS count FROM ${sql.identifier(table)} WHERE tenant_id IS NOT NULL AND tenant_id NOT IN (${keepList})`,
      );
      const left = Number(res.rows?.[0]?.count ?? 0);
      if (left > 0) {
        throw new Error(`Verification failed: ${table} still has ${left} out-of-keep-list rows — rolled back.`);
      }
    }
  });
  console.log("Done. Database now contains only the kept tenants (plus platform-level rows).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
