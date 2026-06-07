/**
 * Unit guards for the schema-drift helpers (Task #1064). No database required.
 *
 * Covers:
 *   1. The drizzle-schema introspection actually resolves real tables/columns
 *      from @workspace/db (so the live-DB integration guard has a correct
 *      source of truth to compare against).
 *   2. The pure diff/parse/index/format helpers behave exactly, so a future
 *      refactor can't silently weaken the guard.
 *   3. Static cross-checks against the real migration files + migrate.ts: every
 *      .sql is journaled (the inverse silent-skip landmine) and the helpers can
 *      map an object to the migration that introduces it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@workspace/db";
import {
  getDeclaredTables,
  diffDeclaredVsLive,
  parseSelfHealedSqlFiles,
  buildMigrationObjectIndex,
  formatDriftReport,
  hasDrift,
  type MigrationFile,
} from "./schemaDrift";

// src/lib -> ../../../../lib/db/migrations (workspace/lib/db/migrations)
const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../../../lib/db/migrations");
const MIGRATE_TS = path.resolve(__dirname, "../migrate.ts");

function readMigrationFiles(): MigrationFile[] {
  return readdirSync(MIGRATIONS_FOLDER)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_FOLDER, name), "utf8") }));
}

describe("getDeclaredTables (drizzle introspection)", () => {
  const declared = getDeclaredTables(schema as unknown as Record<string, unknown>);

  it("resolves a non-trivial set of public tables", () => {
    expect(declared.length).toBeGreaterThan(30);
  });

  it("includes known tables with their SQL column names", () => {
    const byName = new Map(declared.map((d) => [d.table, d.columns]));
    expect(byName.has("notification_sends")).toBe(true);
    expect(byName.get("notification_sends")).toContain("tenant_id");
    expect(byName.get("notification_sends")).toContain("dedupe_key");
    // A column that was itself the subject of a self-heal (0049).
    expect(byName.has("block_catalog")).toBe(true);
    expect(byName.get("block_catalog")).toContain("ai_enabled");
  });

  it("returns SQL (snake_case) names, never the TS camelCase keys", () => {
    for (const { table, columns } of declared) {
      expect(table).not.toMatch(/[A-Z]/);
      for (const col of columns) expect(col).not.toMatch(/[A-Z]/);
    }
  });
});

describe("diffDeclaredVsLive", () => {
  const declared = [
    { table: "a", columns: ["id", "name"] },
    { table: "b", columns: ["id"] },
  ];

  it("reports a fully missing table", () => {
    const live = new Map([["a", new Set(["id", "name"])]]);
    const drift = diffDeclaredVsLive(declared, live);
    expect(drift.missingTables).toEqual(["b"]);
    expect(drift.missingColumns).toEqual([]);
    expect(hasDrift(drift)).toBe(true);
  });

  it("reports a missing column on an existing table", () => {
    const live = new Map([
      ["a", new Set(["id"])],
      ["b", new Set(["id"])],
    ]);
    const drift = diffDeclaredVsLive(declared, live);
    expect(drift.missingTables).toEqual([]);
    expect(drift.missingColumns).toEqual([{ table: "a", column: "name" }]);
    expect(hasDrift(drift)).toBe(true);
  });

  it("is clean when the live DB is a superset (extra columns are not drift)", () => {
    const live = new Map([
      ["a", new Set(["id", "name", "extra_legacy_col"])],
      ["b", new Set(["id"])],
      ["c_unused", new Set(["id"])],
    ]);
    const drift = diffDeclaredVsLive(declared, live);
    expect(hasDrift(drift)).toBe(false);
  });
});

describe("parseSelfHealedSqlFiles", () => {
  it("picks up both runProbedSelfHeal and raw readFileSync forms", () => {
    const src = `
      await runProbedSelfHeal({ applySqlFile: "0041_notifications.sql", expected: 2 });
      const indexSql = readFileSync(path.join(MIGRATIONS_FOLDER, "0017_sales_hotlinks_contact_page_unique.sql"), "utf8");
      // not a migration ref:
      const x = "hello.sql";
    `;
    const got = parseSelfHealedSqlFiles(src);
    expect(got.has("0041_notifications.sql")).toBe(true);
    expect(got.has("0017_sales_hotlinks_contact_page_unique.sql")).toBe(true);
    expect(got.has("hello.sql")).toBe(false);
  });

  it("recognizes the real self-heals present in migrate.ts", () => {
    const src = readFileSync(MIGRATE_TS, "utf8");
    const healed = parseSelfHealedSqlFiles(src);
    // Each of these was a documented drift incident healed in migrate.ts.
    for (const f of [
      "0041_notifications.sql",
      "0049_block_catalog_ai_enabled.sql",
      "0077_marketo_integration.sql",
      "0081_hubspot_integration.sql",
      "0085_lp_page_fact_flags.sql",
    ]) {
      expect(healed.has(f)).toBe(true);
    }
  });
});

describe("buildMigrationObjectIndex", () => {
  it("maps CREATE TABLE and ADD COLUMN to their files", () => {
    const files: MigrationFile[] = [
      { name: "0001_init.sql", sql: `CREATE TABLE IF NOT EXISTS "widgets" ( "id" serial PRIMARY KEY );` },
      {
        name: "0002_alter.sql",
        sql: `ALTER TABLE "widgets" ADD COLUMN IF NOT EXISTS "color" text;\nALTER TABLE widgets ADD COLUMN size int;`,
      },
    ];
    const idx = buildMigrationObjectIndex(files);
    expect(idx.tableToFile.get("widgets")).toBe("0001_init.sql");
    expect(idx.columnToFile.get("widgets.color")).toBe("0002_alter.sql");
    expect(idx.columnToFile.get("widgets.size")).toBe("0002_alter.sql");
  });

  it("indexes the real migration files (finds notification_sends + block_catalog.ai_enabled)", () => {
    const idx = buildMigrationObjectIndex(readMigrationFiles());
    expect(idx.tableToFile.get("notification_sends")).toBeDefined();
    expect(idx.columnToFile.get("block_catalog.ai_enabled")).toBe("0049_block_catalog_ai_enabled.sql");
  });
});

describe("formatDriftReport", () => {
  it("annotates a missing object with its migration and self-heal status", () => {
    const drift = {
      missingTables: ["notification_sends"],
      missingColumns: [{ table: "block_catalog", column: "ai_enabled" }],
    };
    const index = {
      tableToFile: new Map([["notification_sends", "0041_notifications.sql"]]),
      columnToFile: new Map([["block_catalog.ai_enabled", "0049_block_catalog_ai_enabled.sql"]]),
    };
    const selfHealed = new Set(["0041_notifications.sql"]); // 0049 intentionally absent
    const msg = formatDriftReport(drift, index, selfHealed);
    expect(msg).toContain("notification_sends");
    expect(msg).toContain("0041_notifications.sql (self-heal present)");
    expect(msg).toContain("block_catalog.ai_enabled");
    expect(msg).toContain("0049_block_catalog_ai_enabled.sql — NO self-heal step");
  });
});

describe("migration journal completeness (inverse silent-skip landmine)", () => {
  it("every .sql in lib/db/migrations is registered in meta/_journal.json", () => {
    const sqlTags = readdirSync(MIGRATIONS_FOLDER)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""))
      .sort();
    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
    ) as { entries: { tag: string }[] };
    const journalTags = new Set(journal.entries.map((e) => e.tag));
    const unregistered = sqlTags.filter((t) => !journalTags.has(t));
    expect(
      unregistered,
      `These .sql files are NOT in meta/_journal.json and will be silently skipped on every release: ${unregistered.join(", ")}`,
    ).toEqual([]);
  });
});
