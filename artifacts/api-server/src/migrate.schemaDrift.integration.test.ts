/**
 * Schema-drift guard — live database (Task #1064).
 *
 * The shared dev database repeatedly drifts: drizzle's node-postgres migrator
 * dedupes by a high-water mark on the journal `when` timestamp, so a migration
 * whose `when` sits BELOW an already-migrated DB's max `created_at` is recorded
 * as applied without its DDL ever running. The object silently never gets
 * created and the failure only surfaces much later as a runtime "column/relation
 * does not exist" error (notifications 0041, block_catalog 0048/0049, Marketo
 * 0077, HubSpot 0081). Each was patched after the fact with a self-heal step in
 * migrate.ts; the next one is always easy to forget.
 *
 * This test closes that gap: it compares every table/column declared in
 * @workspace/db against what physically exists in the live DB and fails LOUDLY,
 * naming each missing object, the migration that should have created it, and
 * whether that migration already has a self-heal step in migrate.ts — so the
 * remediation (add an idempotent runProbedSelfHeal) is obvious.
 *
 * Run order matters in dev: `pnpm dev` chains `migrate` (which runs every
 * self-heal) before the app starts, so on a healthy box this passes. On a
 * drifted box with a missing self-heal it fails here instead of at runtime.
 *
 * Gated on DB availability so it skips cleanly when no database is configured
 * (matching the other integration tests in this package).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pool } from "@workspace/db";
import * as schema from "@workspace/db";
import {
  getDeclaredTables,
  diffDeclaredVsLive,
  hasDrift,
  parseSelfHealedSqlFiles,
  buildMigrationObjectIndex,
  formatDriftReport,
  type MigrationFile,
} from "./lib/schemaDrift";

// This file lives in src/ (same depth as migrate.ts / dist), so the migrations
// folder is the same relative path the runtime migrate uses.
const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../../lib/db/migrations");
const MIGRATE_TS = path.resolve(__dirname, "migrate.ts");

async function dbReachable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

function readMigrationFiles(): MigrationFile[] {
  return readdirSync(MIGRATIONS_FOLDER)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_FOLDER, name), "utf8") }));
}

let hasDb = false;

beforeAll(async () => {
  hasDb = await dbReachable();
});

describe("schema drift: declared @workspace/db schema vs live database", () => {
  it("has every declared table and column present in the live DB", async () => {
    if (!hasDb) {
      // No database configured in this environment — the guard is a no-op here,
      // exactly like the other integration tests. It does its job wherever a
      // (potentially drifted) database is reachable: dev, CI, and the deploy box.
      expect(true).toBe(true);
      return;
    }

    // One pass over the live column catalog -> Map<table, Set<column>>.
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'`,
    );
    const liveColumns = new Map<string, Set<string>>();
    for (const r of rows) {
      let cols = liveColumns.get(r.table_name);
      if (!cols) {
        cols = new Set<string>();
        liveColumns.set(r.table_name, cols);
      }
      cols.add(r.column_name);
    }

    const declared = getDeclaredTables(schema as unknown as Record<string, unknown>);
    const drift = diffDeclaredVsLive(declared, liveColumns);

    if (hasDrift(drift)) {
      const index = buildMigrationObjectIndex(readMigrationFiles());
      const selfHealed = parseSelfHealedSqlFiles(readFileSync(MIGRATE_TS, "utf8"));
      const report = formatDriftReport(drift, index, selfHealed);
      throw new Error(`\nSchema drift detected between @workspace/db and the live database:\n${report}\n`);
    }

    expect(hasDrift(drift)).toBe(false);
  });
});
