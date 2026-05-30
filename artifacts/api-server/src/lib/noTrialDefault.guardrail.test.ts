import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Guardrail: the legacy plan='trial' default must never be reintroduced.
//
// `normalizePlan("trial")` maps to "growth", so any tenant created with a
// stored plan of 'trial' silently receives Growth entitlements for free,
// indefinitely — bypassing the automatic 14-day window entirely. Trials are
// now represented ONLY by the trial_started_at / trial_expires_at columns, and
// every stored-plan floor must default to 'free'. This test scans the
// production source for the two ways that default has historically crept in:
//   • a `?? "trial"` fallback at a tenant-creation / plan-read call site
//   • a Drizzle `.default("trial")` on a plan column
// and fails loudly if either reappears.

const REPO_ROOT = resolve(__dirname, "../../../..");

const SCAN_TARGETS = [
  "artifacts/api-server/src",
  "lib/db/src",
];

const ANTIPATTERNS: { label: string; re: RegExp }[] = [
  { label: `?? "trial" fallback`, re: /\?\?\s*["']trial["']/ },
  { label: `.default("trial")`, re: /\.default\(\s*["']trial["']\s*\)/ },
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      out.push(...collectTsFiles(full));
      continue;
    }
    if (!/\.ts$/.test(entry)) continue;
    // Skip test files — fixtures may intentionally create legacy 'trial' rows
    // to exercise the normalization path, and this very file references the
    // antipattern strings.
    if (/\.test\.ts$/.test(entry) || full.includes("/tests/") || full.includes("/setup/")) continue;
    out.push(full);
  }
  return out;
}

describe("guardrail — no legacy plan='trial' default in production source", () => {
  const files = SCAN_TARGETS.flatMap((t) => collectTsFiles(join(REPO_ROOT, t)));

  it("scans a non-trivial number of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("contains no `?? \"trial\"` fallback or `.default(\"trial\")`", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const { label, re } of ANTIPATTERNS) {
        if (re.test(text)) {
          offenders.push(`${file.replace(REPO_ROOT + "/", "")} — ${label}`);
        }
      }
    }
    expect(offenders, `legacy 'trial' default reintroduced:\n${offenders.join("\n")}`).toEqual([]);
  });
});
