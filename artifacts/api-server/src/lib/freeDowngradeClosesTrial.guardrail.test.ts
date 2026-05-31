import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Guardrail: every `UPDATE tenants … plan = 'free'` write must also close the
// trial window via the shared `CLOSE_TRIAL_ON_FREE_SQL` fragment.
//
// The leak this guards against: a tenant dropped to the Free floor (Stripe
// cancel/unpaid, dunning final-attempt, or the in-app "downgrade to Free"
// button) while a 14-day Growth trial window is still open keeps reaching paid
// features — `effectivePlan()` lifts the stored Free floor back to the Growth
// trial tier until the trial date naturally passes. The fix routes every such
// write through `CLOSE_TRIAL_ON_FREE_SQL` (see planFeatures.ts), which closes
// the open window in the SAME UPDATE.
//
// Nothing structurally stops a future code change from adding a NEW
// `plan = 'free'` write that forgets the fragment and silently re-introduces
// the leak. This test scans the production source, extracts every SQL template
// literal that targets `UPDATE tenants`, and fails loudly if any of them writes
// the Free floor without also referencing `CLOSE_TRIAL_ON_FREE_SQL`.

const REPO_ROOT = resolve(__dirname, "../../../..");

const SCAN_TARGETS = ["artifacts/api-server/src"];

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
    // Skip tests: fixtures legitimately seed/exercise `plan = 'free'` rows
    // (the downgrade integration test) and this file embeds the patterns.
    if (/\.test\.ts$/.test(entry) || full.includes("/tests/") || full.includes("/setup/")) continue;
    out.push(full);
  }
  return out;
}

// --- Minimal template-literal scanner -------------------------------------
// Extracts every backtick template literal in `src` — including ones that
// contain `${…}` interpolations with nested template literals (e.g. the
// Stripe webhook's conditional fragment splice). Returns the FULL outer
// literal text for each so that a `CLOSE_TRIAL_ON_FREE_SQL` reference living
// inside an interpolation still counts toward its enclosing UPDATE.

function readQuoted(src: string, start: number): number {
  const q = src[start];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === q) {
      i++;
      break;
    }
    i++;
  }
  return i;
}

function readTemplate(src: string, start: number): { literal: string; end: number } {
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") {
      i++;
      break;
    }
    if (c === "$" && src[i + 1] === "{") {
      i = readInterpolation(src, i + 2);
      continue;
    }
    i++;
  }
  return { literal: src.slice(start, i), end: i };
}

function readInterpolation(src: string, start: number): number {
  let i = start;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") {
      i = readTemplate(src, i).end;
      continue;
    }
    if (c === '"' || c === "'") {
      i = readQuoted(src, i);
      continue;
    }
    if (c === "{") {
      depth++;
      i++;
      continue;
    }
    if (c === "}") {
      if (depth === 0) {
        i++;
        break;
      }
      depth--;
      i++;
      continue;
    }
    i++;
  }
  return i;
}

function extractTemplates(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "`") {
      const { literal, end } = readTemplate(src, i);
      out.push(literal);
      i = end;
    } else {
      i++;
    }
  }
  return out;
}

const UPDATE_TENANTS_RE = /\bUPDATE\s+tenants\b/i;
// Matches a write of the plan column to the literal Free floor — `plan = 'free'`
// or `plan = "free"`, with any whitespace (including the aligned-column style).
const PLAN_FREE_WRITE_RE = /\bplan\b\s*=\s*["']free["']/i;
const FRAGMENT_REF = "CLOSE_TRIAL_ON_FREE_SQL";

describe("guardrail — every UPDATE tenants plan='free' write closes the trial window", () => {
  const files = SCAN_TARGETS.flatMap((t) => collectTsFiles(join(REPO_ROOT, t)));

  it("scans a non-trivial number of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  // Walk the production source and partition every `UPDATE tenants … plan='free'`
  // template literal into covered (references the fragment) vs offenders.
  const offenders: string[] = [];
  let coveredCount = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const tpl of extractTemplates(text)) {
      if (!UPDATE_TENANTS_RE.test(tpl)) continue;
      if (!PLAN_FREE_WRITE_RE.test(tpl)) continue;
      const rel = file.replace(REPO_ROOT + "/", "");
      if (tpl.includes(FRAGMENT_REF)) {
        coveredCount++;
      } else {
        offenders.push(rel);
      }
    }
  }

  it("finds the known downgrade-to-free write paths (extractor sanity)", () => {
    // The in-app "downgrade to Free" button (billing.ts) and the dunning
    // final-attempt fallback (stripeWebhook.ts) both write `plan = 'free'`
    // literally. If this drops to 0 the extractor silently broke and the
    // guardrail below would pass vacuously.
    expect(coveredCount).toBeGreaterThanOrEqual(2);
  });

  it("has no plan='free' write missing CLOSE_TRIAL_ON_FREE_SQL", () => {
    expect(
      offenders,
      `An \`UPDATE tenants … plan = 'free'\` write is missing the ${FRAGMENT_REF} fragment, ` +
        `which re-opens the free-tier leak (an open trial lifts the Free floor back to Growth). ` +
        `Splice \`\${CLOSE_TRIAL_ON_FREE_SQL.trim()},\` into the same UPDATE next to the plan write:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
