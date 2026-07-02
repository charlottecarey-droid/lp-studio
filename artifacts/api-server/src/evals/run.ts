/**
 * Golden-brief eval runner for /lp/generate-page — run me on an environment
 * with a real database and the AI proxy configured (i.e. Replit), NOT in CI
 * unit-test lanes:
 *
 *   pnpm --filter @workspace/api-server eval:generation
 *   pnpm --filter @workspace/api-server eval:generation -- --brief=generic-saas
 *   pnpm --filter @workspace/api-server eval:generation -- --update-baselines
 *
 * For each brief in src/evals/briefs/*.json the runner:
 *   1. seeds a throwaway tenant carrying the brief's brand config (and, for
 *      the template-rewrite brief, a seeded template page),
 *   2. POSTs the brief's request through the real express stack via the
 *      in-process inject() harness (same pattern as the route tests — the
 *      full middleware chain, quota gate and rate limiters run; only TCP is
 *      bypassed),
 *   3. scores the JSON result with the pure scorers in scorers.ts,
 *   4. optionally (EVAL_LLM_JUDGE=1) attaches a soft LLM copy-quality verdict,
 *   5. cleans the tenant back out.
 *
 * Reports land in src/evals/reports/<timestamp>/ (one JSON per brief +
 * summary.json). When src/evals/baselines/<briefId>.json exists, per-scorer
 * scores are diffed against it and any drop past EVAL_REGRESSION_TOLERANCE
 * (default 0.1) is a regression. Exit code is non-zero when any brief fails
 * its thresholds/expectations or regresses vs baseline.
 *
 * Flags: --brief=<id>[,<id>…]  run a subset
 *        --update-baselines    write current scores as the new baselines
 *        --keep-tenants        skip DB cleanup (debugging)
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { approvedStatPool, scoreGeneration } from "./scorers";
import type { EvalReport, GenerationResultLike, GoldenBrief, ScorerName } from "./types";
import type { JudgeVerdict } from "./judge";

const EVALS_DIR = dirname(fileURLToPath(import.meta.url));
const BRIEFS_DIR = join(EVALS_DIR, "briefs");
const BASELINES_DIR = join(EVALS_DIR, "baselines");
const REPORTS_DIR = join(EVALS_DIR, "reports");

const GENERATION_TIMEOUT_MS = Number(process.env["EVAL_GENERATION_TIMEOUT_MS"]) || 240_000;
const REGRESSION_TOLERANCE = Number(process.env["EVAL_REGRESSION_TOLERANCE"]) || 0.1;

interface BriefRunRecord {
  briefId: string;
  description: string;
  report: EvalReport;
  regressions: string[];
  meta: {
    httpStatus: number | null;
    durationMs: number;
    title: string | null;
    slug: string | null;
    blockTypes: string[];
    degradations: unknown[];
    strictMismatches: unknown[];
    referenceFailureReason: string | null;
  };
  judge?: JudgeVerdict | { error: string };
}

// ── Env preflight (before any DB-bound import) ───────────────────────────────

function preflight(): void {
  const missing = [
    "DATABASE_URL",
    "AI_INTEGRATIONS_OPENAI_BASE_URL",
    "AI_INTEGRATIONS_OPENAI_API_KEY",
  ].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      [
        `eval:generation cannot run — missing env: ${missing.join(", ")}.`,
        "This runner drives REAL page generations against a REAL database.",
        "Run it on the deployed/Replit environment (or export those vars locally);",
        "for the fast, hermetic check use:  npx vitest run src/evals/",
      ].join("\n"),
    );
    process.exit(1);
  }
}

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { briefFilter: Set<string> | null; updateBaselines: boolean; keepTenants: boolean } {
  const briefIds: string[] = [];
  let updateBaselines = false;
  let keepTenants = false;
  for (const arg of argv) {
    if (arg.startsWith("--brief=")) briefIds.push(...arg.slice("--brief=".length).split(",").filter(Boolean));
    else if (arg === "--update-baselines") updateBaselines = true;
    else if (arg === "--keep-tenants") keepTenants = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return { briefFilter: briefIds.length > 0 ? new Set(briefIds) : null, updateBaselines, keepTenants };
}

function loadBriefs(filter: Set<string> | null): GoldenBrief[] {
  const files = readdirSync(BRIEFS_DIR).filter((f) => f.endsWith(".json")).sort();
  const briefs = files.map((f) => JSON.parse(readFileSync(join(BRIEFS_DIR, f), "utf8")) as GoldenBrief);
  if (!filter) return briefs;
  const known = new Set(briefs.map((b) => b.id));
  for (const id of filter) {
    if (!known.has(id)) {
      console.error(`--brief=${id} matches no file in src/evals/briefs/`);
      process.exit(1);
    }
  }
  return briefs.filter((b) => filter.has(b.id));
}

// ── Baselines ────────────────────────────────────────────────────────────────

interface Baseline {
  briefId: string;
  scores: Record<ScorerName, number>;
}

function readBaseline(briefId: string): Baseline | null {
  const path = join(BASELINES_DIR, `${briefId}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Baseline;
  } catch (err) {
    console.warn(`  ! unreadable baseline ${path}: ${String(err)}`);
    return null;
  }
}

function diffAgainstBaseline(report: EvalReport): string[] {
  const baseline = readBaseline(report.briefId);
  if (!baseline) return [];
  const regressions: string[] = [];
  for (const [name, prev] of Object.entries(baseline.scores) as Array<[ScorerName, number]>) {
    const cur = report.scores[name];
    if (typeof cur !== "number" || typeof prev !== "number") continue;
    if (cur < prev - REGRESSION_TOLERANCE) {
      regressions.push(`${name}: ${prev} -> ${cur} (tolerance ${REGRESSION_TOLERANCE})`);
    }
  }
  return regressions;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  preflight();
  const { briefFilter, updateBaselines, keepTenants } = parseArgs(process.argv.slice(2));
  const briefs = loadBriefs(briefFilter);
  const useJudge = process.env["EVAL_LLM_JUDGE"] === "1";

  // DB / route imports happen after the env preflight so a misconfigured
  // environment fails with the message above, not a module-load stack trace.
  const [{ pool }, expressMod, cookieParserMod, authMod, injectMod, generateMod, judgeMod] =
    await Promise.all([
      import("@workspace/db"),
      import("express"),
      import("cookie-parser"),
      import("../middleware/requireAuth"),
      import("../test-utils/injectRequest"),
      import("../routes/lp/generate-page"),
      import("./judge"),
    ]);
  const express = expressMod.default;
  const cookieParser = cookieParserMod.default;
  const { SESSION_COOKIE, requireAuth } = authMod;
  const { inject } = injectMod;

  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json({ limit: "20mb" }));
  app.use(requireAuth);
  app.use("/", generateMod.default);

  // Per-request unique client IPs keep the per-IP AI rate limiters out of the
  // way (same trick as the route tests).
  let ipCounter = 0;
  const nextIp = (): string => {
    ipCounter += 1;
    return `10.99.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
  };

  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runReportsDir = join(REPORTS_DIR, runStamp);
  mkdirSync(runReportsDir, { recursive: true });

  const records: BriefRunRecord[] = [];

  for (const brief of briefs) {
    console.log(`\n▶ ${brief.id} — ${brief.description}`);
    const startedAt = Date.now();
    const createdTenantIds: number[] = [];
    const createdSids: string[] = [];
    let timedOut = false;

    const cleanup = async (): Promise<void> => {
      if (keepTenants) return;
      if (timedOut) {
        console.warn(`  ! generation still in flight — skipping cleanup for tenant(s) ${createdTenantIds.join(", ")}`);
        return;
      }
      for (const id of createdTenantIds) {
        await pool.query(`DELETE FROM ai_generation_log WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
      }
      for (const sid of createdSids) {
        await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
      }
      for (const id of createdTenantIds) {
        await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
      }
    };

    try {
      // 1. Seed the tenant + brand.
      const slug = `eval-gen-${brief.id}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`.slice(0, 120);
      const tenantRow = await pool.query<{ id: number }>(
        `INSERT INTO tenants (name, slug, status, plan) VALUES ($1, $2, 'active', $3) RETURNING id`,
        [`Eval ${brief.id}`, slug, brief.brand.plan ?? "growth"],
      );
      const tenantId = tenantRow.rows[0].id;
      createdTenantIds.push(tenantId);
      await pool.query(
        `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2::jsonb)`,
        [tenantId, JSON.stringify(brief.brand.config ?? {})],
      );

      // 2. Seed the template page when the brief asks for one.
      const request: Record<string, unknown> = { ...brief.request };
      if (request["templateId"] === "$TEMPLATE") {
        const tpl = brief.brand.template;
        if (!tpl) throw new Error(`brief ${brief.id} uses templateId "$TEMPLATE" but has no brand.template`);
        const tplRow = await pool.query<{ id: number }>(
          `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, is_template, template_label)
           VALUES ($1, $2, $3, $4::jsonb, 'draft', 'marketing', true, 'Eval')
           RETURNING id`,
          [tenantId, tpl.title, `${slug}-tpl`, JSON.stringify(tpl.blocks)],
        );
        request["templateId"] = tplRow.rows[0].id;
      }

      // 3. Seed an admin session.
      const sid = `eval-gen-${randomUUID()}`;
      const authUser = {
        userId: 998800000 + Math.floor(Math.random() * 100000),
        email: `eval-${brief.id}@example.com`,
        name: `Eval ${brief.id}`,
        avatarUrl: null,
        tenantId,
        role: "admin",
        permissions: {},
        isAdmin: true,
        appUserRole: null,
      };
      await pool.query(
        `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '2 hours')`,
        [sid, JSON.stringify(authUser)],
      );
      createdSids.push(sid);

      // 4. Fire the generation through the real stack.
      const injected = inject(app, {
        method: "POST",
        url: "/lp/generate-page",
        headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
        body: request,
      });
      const res = await Promise.race([
        injected,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GENERATION_TIMEOUT_MS).unref()),
      ]);
      if (res === null) {
        timedOut = true;
        records.push({
          briefId: brief.id,
          description: brief.description,
          report: {
            briefId: brief.id,
            scores: emptyScores(),
            violations: [],
            passed: false,
            failures: [`generation timed out after ${GENERATION_TIMEOUT_MS}ms`],
          },
          regressions: [],
          meta: emptyMeta(Date.now() - startedAt),
        });
        console.log(`  ✗ TIMEOUT after ${GENERATION_TIMEOUT_MS}ms`);
        continue;
      }

      if (res.status !== 200) {
        records.push({
          briefId: brief.id,
          description: brief.description,
          report: {
            briefId: brief.id,
            scores: emptyScores(),
            violations: [],
            passed: false,
            failures: [`HTTP ${res.status}: ${res.text.slice(0, 300)}`],
          },
          regressions: [],
          meta: { ...emptyMeta(Date.now() - startedAt), httpStatus: res.status },
        });
        console.log(`  ✗ HTTP ${res.status}`);
        continue;
      }

      // 5. Score.
      const result = (res.json ?? {}) as GenerationResultLike;
      const config = brief.brand.config ?? {};
      const allowedStats = approvedStatPool(config, brief.request.prompt, brief.expectations.allowedStats ?? []);
      const avoidPhrases = Array.isArray(config["avoidPhrases"])
        ? (config["avoidPhrases"] as unknown[]).filter((p): p is string => typeof p === "string")
        : [];
      const report = scoreGeneration({
        briefId: brief.id,
        result,
        expectations: brief.expectations,
        allowedStats,
        brandAvoidPhrases: avoidPhrases,
      });
      const regressions = diffAgainstBaseline(report);

      const record: BriefRunRecord = {
        briefId: brief.id,
        description: brief.description,
        report,
        regressions,
        meta: {
          httpStatus: res.status,
          durationMs: Date.now() - startedAt,
          title: typeof result.title === "string" ? result.title : null,
          slug: typeof result.slug === "string" ? result.slug : null,
          blockTypes: (Array.isArray(result.blocks) ? result.blocks : []).map((b) =>
            typeof b?.type === "string" ? b.type : "?",
          ),
          degradations: Array.isArray(result.degradations) ? result.degradations : [],
          strictMismatches: Array.isArray(result.strictMismatches) ? result.strictMismatches : [],
          referenceFailureReason:
            typeof result.referenceFailureReason === "string" ? result.referenceFailureReason : null,
        },
      };

      // 6. Optional soft LLM verdict (recorded, never gating).
      if (useJudge) {
        try {
          record.judge = await judgeMod.judgeGeneration({
            briefId: brief.id,
            briefDescription: brief.description,
            prompt: brief.request.prompt,
            result,
          });
        } catch (err) {
          record.judge = { error: String(err) };
        }
      }

      records.push(record);
      const scoreLine = (Object.entries(report.scores) as Array<[string, number]>)
        .map(([n, s]) => `${n}=${s}`)
        .join(" ");
      console.log(`  ${report.passed && regressions.length === 0 ? "✓" : "✗"} ${scoreLine} (${record.meta.durationMs}ms)`);
      for (const f of report.failures) console.log(`    - ${f}`);
      for (const r of regressions) console.log(`    - REGRESSION ${r}`);
    } catch (err) {
      records.push({
        briefId: brief.id,
        description: brief.description,
        report: {
          briefId: brief.id,
          scores: emptyScores(),
          violations: [],
          passed: false,
          failures: [`runner error: ${String(err)}`],
        },
        regressions: [],
        meta: emptyMeta(Date.now() - startedAt),
      });
      console.log(`  ✗ runner error: ${String(err)}`);
    } finally {
      await cleanup();
    }
  }

  // ── Reports + baselines ────────────────────────────────────────────────────
  for (const record of records) {
    writeFileSync(join(runReportsDir, `${record.briefId}.json`), JSON.stringify(record, null, 2));
  }
  const failed = records.filter((r) => !r.report.passed);
  const regressed = records.filter((r) => r.regressions.length > 0);
  const summary = {
    startedAt: runStamp,
    total: records.length,
    passed: records.length - failed.length,
    failed: failed.map((r) => ({ briefId: r.briefId, failures: r.report.failures })),
    regressed: regressed.map((r) => ({ briefId: r.briefId, regressions: r.regressions })),
    judgeEnabled: useJudge,
    regressionTolerance: REGRESSION_TOLERANCE,
  };
  writeFileSync(join(runReportsDir, "summary.json"), JSON.stringify(summary, null, 2));

  if (updateBaselines) {
    mkdirSync(BASELINES_DIR, { recursive: true });
    for (const record of records) {
      if (record.meta.httpStatus !== 200) continue; // never baseline a broken run
      const baseline: Baseline = { briefId: record.briefId, scores: record.report.scores };
      writeFileSync(join(BASELINES_DIR, `${record.briefId}.json`), JSON.stringify(baseline, null, 2));
    }
    console.log(`\nBaselines updated in ${BASELINES_DIR}`);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Reports: ${runReportsDir}`);
  console.log(`Result: ${records.length - failed.length}/${records.length} briefs passed, ${regressed.length} regressed vs baseline.`);

  await pool.end().catch(() => {});
  if (failed.length > 0 || regressed.length > 0) process.exit(1);
  process.exit(0);
}

function emptyScores(): Record<ScorerName, number> {
  return {
    fabricatedStat: 0,
    placeholderLeak: 0,
    emptyImageSlot: 0,
    bannedPhrase: 0,
    structural: 0,
    subjectLeak: 0,
    degradation: 0,
  };
}

function emptyMeta(durationMs: number): BriefRunRecord["meta"] {
  return {
    httpStatus: null,
    durationMs,
    title: null,
    slug: null,
    blockTypes: [],
    degradations: [],
    strictMismatches: [],
    referenceFailureReason: null,
  };
}

main().catch((err) => {
  console.error("eval:generation crashed:", err);
  process.exit(1);
});
