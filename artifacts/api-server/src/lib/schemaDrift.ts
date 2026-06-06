/**
 * Schema-drift guard helpers (Task #1064).
 *
 * The shared dev database repeatedly drifts: a migration is recorded as
 * "applied" in `drizzle.__drizzle_migrations` even though its DDL never ran,
 * because the node-postgres migrator dedupes by a high-water mark on the
 * journal `when` timestamp — any entry whose `when` sits BELOW an
 * already-migrated DB's max `created_at` is silently skipped forever (see
 * `.agents/memory/notification-migration-skipped-on-drifted-db.md`). This has
 * bitten notifications (0041), block_catalog (0048/0049), Marketo (0077), and
 * HubSpot (0081), each surfacing later as a runtime "column/relation does not
 * exist" error and patched one-by-one with a hand-written self-heal step in
 * `artifacts/api-server/src/migrate.ts`.
 *
 * These pure helpers back two guards (a live-DB integration test and a no-DB
 * unit test) that catch the next such drift up front instead of at runtime:
 *   1. Compare the schema declared in `@workspace/db` against the live DB and
 *      report any declared table/column that is missing.
 *   2. Map each missing object back to the migration `.sql` that introduces it
 *      and flag whether that migration already has a self-heal step in
 *      migrate.ts — i.e. surface exactly which self-heal is missing.
 *
 * Everything here is pure (string/object in, plain data out) so it is unit
 * testable without a database; the test files do all the IO (information_schema
 * query, reading migration files / migrate.ts).
 */
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

export type DeclaredTable = { table: string; columns: string[] };

/**
 * Introspect every drizzle `pgTable` exported from a schema namespace (e.g.
 * `import * as schema from "@workspace/db"`) and return its SQL table name plus
 * SQL column names. Non-table exports (the `db`/`pool` handles, inferred types,
 * relations) are ignored. Only `public`-schema tables are considered — that is
 * the only schema the app declares tables in, and `getTableConfig().schema` is
 * `undefined` for the default public schema.
 */
export function getDeclaredTables(schemaModule: Record<string, unknown>): DeclaredTable[] {
  const out: DeclaredTable[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(schemaModule)) {
    if (!is(value, PgTable)) continue;
    const cfg = getTableConfig(value as PgTable);
    if (cfg.schema && cfg.schema !== "public") continue;
    if (seen.has(cfg.name)) continue;
    seen.add(cfg.name);
    out.push({ table: cfg.name, columns: cfg.columns.map((c) => c.name) });
  }
  return out.sort((a, b) => a.table.localeCompare(b.table));
}

export type SchemaDrift = {
  missingTables: string[];
  missingColumns: { table: string; column: string }[];
};

export function hasDrift(drift: SchemaDrift): boolean {
  return drift.missingTables.length > 0 || drift.missingColumns.length > 0;
}

/**
 * Compare the declared schema against the live DB's column catalog. The
 * direction is one-way on purpose: only DECLARED objects MISSING from the live
 * DB are drift (the failure mode that breaks runtime queries). Extra live
 * tables/columns the schema no longer declares are NOT reported — they are
 * harmless leftovers, not a "missing database upgrade".
 *
 * @param liveColumns map of live table name -> set of its live column names,
 *   built from a single `information_schema.columns` query.
 */
export function diffDeclaredVsLive(
  declared: DeclaredTable[],
  liveColumns: Map<string, Set<string>>,
): SchemaDrift {
  const missingTables: string[] = [];
  const missingColumns: { table: string; column: string }[] = [];
  for (const { table, columns } of declared) {
    const live = liveColumns.get(table);
    if (!live) {
      missingTables.push(table);
      continue;
    }
    for (const col of columns) {
      if (!live.has(col)) missingColumns.push({ table, column: col });
    }
  }
  return { missingTables, missingColumns };
}

/**
 * Extract the set of migration `.sql` filenames that already have a durable
 * self-heal step in migrate.ts. Recognizes both forms used there:
 *   - the `runProbedSelfHeal({ applySqlFile: "0041_notifications.sql", ... })`
 *     option, and
 *   - the raw `readFileSync(path.join(MIGRATIONS_FOLDER, "0017_....sql"))` form.
 * Both reduce to a quoted `NNNN_name.sql` literal, so one pattern covers them.
 */
export function parseSelfHealedSqlFiles(migrateSource: string): Set<string> {
  const files = new Set<string>();
  const re = /["'](\d{4}_[a-z0-9_]+\.sql)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(migrateSource)) !== null) {
    files.add(m[1]);
  }
  return files;
}

export type MigrationFile = { name: string; sql: string };

export type MigrationObjectIndex = {
  /** table name -> migration file that creates it */
  tableToFile: Map<string, string>;
  /** "table.column" -> migration file that adds the column */
  columnToFile: Map<string, string>;
};

/**
 * Index which migration `.sql` file introduces each table (`CREATE TABLE`) and
 * each added column (`ALTER TABLE ... ADD COLUMN`). Used to map a detected-
 * missing object back to the migration that should have created it, so the
 * guard can name the exact `.sql` that needs a self-heal step.
 *
 * Files are processed in the order given (sort them ascending first); the
 * FIRST file that introduces an object wins, matching "the migration that
 * created it". Quoting on identifiers is optional in the source SQL, so the
 * patterns accept both `"name"` and bare `name`.
 */
export function buildMigrationObjectIndex(files: MigrationFile[]): MigrationObjectIndex {
  const tableToFile = new Map<string, string>();
  const columnToFile = new Map<string, string>();
  const ident = `"?([a-zA-Z_][a-zA-Z0-9_]*)"?`;
  const createRe = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${ident}`, "gi");
  // ALTER TABLE [IF EXISTS] <table> ... — a single ALTER can carry multiple
  // ADD COLUMN clauses, so capture the table once then scan its body.
  const alterRe = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${ident}([\\s\\S]*?);`,
    "gi",
  );
  const addColRe = new RegExp(`add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?${ident}`, "gi");
  for (const { name, sql } of files) {
    let cm: RegExpExecArray | null;
    createRe.lastIndex = 0;
    while ((cm = createRe.exec(sql)) !== null) {
      const table = cm[1];
      if (!tableToFile.has(table)) tableToFile.set(table, name);
    }
    alterRe.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = alterRe.exec(sql)) !== null) {
      const table = am[1];
      const body = am[2] ?? "";
      let colm: RegExpExecArray | null;
      addColRe.lastIndex = 0;
      while ((colm = addColRe.exec(body)) !== null) {
        const key = `${table}.${colm[1]}`;
        if (!columnToFile.has(key)) columnToFile.set(key, name);
      }
    }
  }
  return { tableToFile, columnToFile };
}

/**
 * Build a human-readable, actionable failure message for detected drift. For
 * every missing object it names the migration `.sql` that introduces it and
 * whether that migration already has a self-heal step — so the reader knows
 * exactly which self-heal to add to migrate.ts.
 */
export function formatDriftReport(
  drift: SchemaDrift,
  index: MigrationObjectIndex,
  selfHealed: Set<string>,
): string {
  const lines: string[] = [];
  const annotate = (file: string | undefined): string => {
    if (!file) return "no migration found that creates it — add a migration + journal entry";
    return selfHealed.has(file)
      ? `${file} (self-heal present)`
      : `${file} — NO self-heal step in migrate.ts; add an idempotent runProbedSelfHeal for it`;
  };

  if (drift.missingTables.length > 0) {
    lines.push(
      `Declared TABLES missing from the live database (${drift.missingTables.length}):`,
    );
    for (const t of drift.missingTables) {
      lines.push(`  - ${t}  <-  ${annotate(index.tableToFile.get(t))}`);
    }
  }
  if (drift.missingColumns.length > 0) {
    lines.push(
      `Declared COLUMNS missing from the live database (${drift.missingColumns.length}):`,
    );
    for (const { table, column } of drift.missingColumns) {
      const key = `${table}.${column}`;
      lines.push(`  - ${key}  <-  ${annotate(index.columnToFile.get(key))}`);
    }
  }
  lines.push("");
  lines.push(
    "These objects are declared in @workspace/db but absent from the live DB — " +
      "almost always because drizzle's high-water-mark dedup silently skipped " +
      "the migration on this already-migrated database. Add an idempotent " +
      "self-heal step in artifacts/api-server/src/migrate.ts (model it on the " +
      "existing runProbedSelfHeal({ applySqlFile, checkSql, expected, shortfall }) " +
      "calls), which re-applies the .sql independent of drizzle's dedup.",
  );
  return lines.join("\n");
}
