import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PLAN_CONFIG, PLANS, type Plan } from "@workspace/plan-config";

/**
 * Drift guard: the `plan_config` DB seed (migration 0036) MUST stay in
 * lockstep with the canonical `@workspace/plan-config` defaults.
 *
 * Why a text-parse instead of running the migration: the seed is raw SQL and
 * is the single value an operator's DB starts from. If someone edits a price
 * or cap in PLAN_CONFIG but forgets the migration (or vice-versa), new
 * tenants get a config that silently disagrees with the marketing page and
 * the code fallback. Parsing the VALUES rows catches that at test time.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(
  __dirname,
  "../../../../lib/db/migrations/0036_plan_config.sql",
);

type SeedRow = {
  tier: string;
  displayName: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  selfServe: boolean;
  sortOrder: number;
  salesConsole: boolean;
  aiImageGen: boolean;
  customDomain: boolean;
  capPages: number | null;
  capForms: number | null;
  capUserSeats: number | null;
  capAiGenerationsPerMonth: number | null;
  capHeatmapSessionsPerMonth: number | null;
};

function parseScalar(raw: string): string | number | boolean | null {
  const v = raw.trim();
  if (v === "NULL") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

/** Split a single `(a, b, 'c', ...)` tuple respecting quoted strings. */
function splitTuple(tuple: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  for (const ch of tuple) {
    if (ch === "'") inStr = !inStr;
    if (ch === "," && !inStr) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseSeed(): Record<string, SeedRow> {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const valuesIdx = sql.indexOf("VALUES");
  expect(valuesIdx).toBeGreaterThan(-1);
  const onConflictIdx = sql.indexOf("ON CONFLICT", valuesIdx);
  const block = sql.slice(valuesIdx + "VALUES".length, onConflictIdx);

  // Match top-level (...) tuples.
  const tuples = block.match(/\(([^()]*)\)/g);
  expect(tuples).toBeTruthy();

  const rows: Record<string, SeedRow> = {};
  for (const t of tuples!) {
    const inner = t.slice(1, -1);
    const cols = splitTuple(inner).map(parseScalar);
    const [
      tier,
      displayName,
      priceMonthly,
      priceAnnual,
      selfServe,
      sortOrder,
      salesConsole,
      aiImageGen,
      customDomain,
      capPages,
      capForms,
      capUserSeats,
      capAiGenerationsPerMonth,
      capHeatmapSessionsPerMonth,
    ] = cols;
    rows[tier as string] = {
      tier: tier as string,
      displayName: displayName as string,
      priceMonthly: priceMonthly as number | null,
      priceAnnual: priceAnnual as number | null,
      selfServe: selfServe as boolean,
      sortOrder: sortOrder as number,
      salesConsole: salesConsole as boolean,
      aiImageGen: aiImageGen as boolean,
      customDomain: customDomain as boolean,
      capPages: capPages as number | null,
      capForms: capForms as number | null,
      capUserSeats: capUserSeats as number | null,
      capAiGenerationsPerMonth: capAiGenerationsPerMonth as number | null,
      capHeatmapSessionsPerMonth: capHeatmapSessionsPerMonth as number | null,
    };
  }
  return rows;
}

describe("plan_config seed matches canonical PLAN_CONFIG", () => {
  const seed = parseSeed();

  it("seeds exactly the canonical tiers", () => {
    expect(Object.keys(seed).sort()).toEqual([...PLANS].sort());
  });

  for (const plan of PLANS as readonly Plan[]) {
    it(`'${plan}' seed row matches canonical config`, () => {
      const row = seed[plan];
      const cfg = PLAN_CONFIG[plan];
      expect(row, `missing seed row for ${plan}`).toBeTruthy();
      expect(row.displayName).toBe(cfg.displayName);
      expect(row.priceMonthly).toBe(cfg.priceMonthly);
      expect(row.priceAnnual).toBe(cfg.priceAnnual);
      expect(row.selfServe).toBe(cfg.selfServe);
      expect(row.sortOrder).toBe(cfg.sortOrder);
      expect(row.salesConsole).toBe(cfg.features.salesConsole);
      expect(row.aiImageGen).toBe(cfg.features.aiImageGen);
      expect(row.customDomain).toBe(cfg.features.customDomain);
      expect(row.capPages).toBe(cfg.features.limits.pages);
      expect(row.capForms).toBe(cfg.features.limits.forms);
      expect(row.capUserSeats).toBe(cfg.features.limits.userSeats);
      expect(row.capAiGenerationsPerMonth).toBe(cfg.features.limits.aiGenerationsPerMonth);
      expect(row.capHeatmapSessionsPerMonth).toBe(cfg.features.limits.heatmapSessionsPerMonth);
    });
  }
});
