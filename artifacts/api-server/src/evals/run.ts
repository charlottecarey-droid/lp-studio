/**
 * Golden-brief eval runner for /lp/generate-page AND the sales microsite
 * generator — run me on an environment with a real database and the AI proxy
 * configured (i.e. Replit), NOT in CI unit-test lanes:
 *
 *   pnpm --filter @workspace/api-server eval:generation
 *   pnpm --filter @workspace/api-server eval:generation -- --brief=generic-saas
 *   pnpm --filter @workspace/api-server eval:generation -- --update-baselines
 *
 * For each brief in src/evals/briefs/*.json the runner:
 *   1. seeds a throwaway tenant carrying the brief's brand config (and, for
 *      the template-rewrite brief, a seeded template page),
 *   2. PAGE briefs (default): POSTs the brief's request through the real
 *      express stack via the in-process inject() harness (same pattern as the
 *      route tests — the full middleware chain, quota gate and rate limiters
 *      run; only TCP is bypassed),
 *   2b. MICROSITE briefs (kind: "microsite"): additionally seeds the brief's
 *      sales_accounts row (plus a minimal sales_briefings row so the route's
 *      slow inline account research is skipped) and invokes
 *      generateMicrositeHandler DIRECTLY with a minimal req/res shim —
 *      non-streaming (no query.stream), auth/limiters bypassed on purpose.
 *      A brief with `diversityProbe: { accounts: N }` seeds N name-variant
 *      accounts, generates once per account, and scores lineupDiversity =
 *      distinct skeleton signatures / N (chrome nav/footer excluded); the
 *      other scorers run over the FIRST generation.
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
import { approvedStatPool, lineupDiversityScore, lineupSignature, scoreGeneration, type LineupPage } from "./scorers";
import type {
  BriefAccount,
  EvalBlock,
  EvalDegradation,
  EvalReport,
  GenerationResultLike,
  GoldenBrief,
  MicrositeBriefRequest,
  ScorerName,
} from "./types";
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
    /** Diversity probes only: per-account skeleton signatures, in seed order. */
    lineupSignatures?: Array<{ account: string; signature: string }>;
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

// ── Microsite invocation (direct handler + req/res shim) ────────────────────

/** generateMicrositeHandler's shape, kept structural so the runner does not
 *  need express's Request/Response generics at the call site. */
type MicrositeHandler = (req: never, res: never) => Promise<void>;

interface ShimResponse {
  status: number;
  body: unknown;
}

/**
 * Invoke the microsite handler directly (bypassing auth middleware + rate
 * limiters — the runner already established the tenant), with a minimal
 * req/res shim. `query` stays empty so wantsGenerationStream() is false and
 * the handler answers via res.json — the non-streaming path.
 */
function invokeMicrositeHandler(
  handler: MicrositeHandler,
  input: { accountId: number; tenantId: number; briefId: string; body: Record<string, unknown> },
): Promise<ShimResponse> {
  return new Promise<ShimResponse>((resolve, reject) => {
    let statusCode = 200;
    let settled = false;
    const finish = (value: ShimResponse): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const req: Record<string, unknown> = {
      params: { accountId: String(input.accountId) },
      body: input.body,
      query: {},
      headers: {},
      authUser: {
        userId: 998900000 + Math.floor(Math.random() * 100000),
        email: `eval-${input.briefId}@example.com`,
        name: `Eval ${input.briefId}`,
        avatarUrl: null,
        tenantId: input.tenantId,
        role: "admin",
        permissions: {},
        isAdmin: true,
        appUserRole: null,
      },
      header: () => undefined,
      on: () => req,
    };
    const res: Record<string, unknown> = {
      headersSent: false,
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (payload: unknown) => {
        finish({ status: statusCode, body: payload });
        return res;
      },
      setHeader: () => res,
      write: () => true,
      end: () => {
        finish({ status: statusCode, body: null });
        return res;
      },
      flushHeaders: () => undefined,
      on: () => res,
    };
    handler(req as never, res as never)
      // A resolved handler that never answered (should not happen on the
      // non-streaming path) surfaces as a null body the caller rejects.
      .then(() => finish({ status: statusCode, body: null }))
      .catch(reject);
  });
}

/** Deterministic account-name variants for the diversity probe. */
const ACCOUNT_VARIANT_SUFFIXES = ["", " North", " South", " East", " West", " Summit", " Lakeside", " Ridge"] as const;
const MAX_PROBE_ACCOUNTS = ACCOUNT_VARIANT_SUFFIXES.length;

function variantAccountName(base: string, index: number): string {
  return `${base}${ACCOUNT_VARIANT_SUFFIXES[index] ?? ` ${index + 1}`}`;
}

/** Minimal sales_briefings.briefing_data seed. Pre-seeding a briefing makes
 *  the handler skip its slow (30-90s) inline account research, keeping eval
 *  runs fast and deterministic. */
function briefingOverview(account: BriefAccount, name: string): string {
  return [
    `${name} is a prospective customer account.`,
    account.segment ? `Segment: ${account.segment}.` : "",
    typeof account.numLocations === "number" ? `They operate ${account.numLocations} locations.` : "",
    account.domain ? `Website: ${account.domain}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface ValidatedMicrositeBrief {
  account: BriefAccount;
  request: MicrositeBriefRequest;
  /** brand.config with brand.segments merged in (segments win). */
  config: Record<string, unknown>;
  probeCount: number;
}

/** Fail fast — with a message naming exactly what's missing — before touching
 *  the DB, so a half-seeded microsite brief can never start a paid generation. */
function validateMicrositeBrief(brief: GoldenBrief): ValidatedMicrositeBrief {
  const account = brief.account;
  if (!account || typeof account.name !== "string" || !account.name.trim()) {
    throw new Error(
      `microsite brief "${brief.id}" is missing account.name — every microsite brief must describe the sales_accounts row to seed ({ name, domain?, segment?, numLocations? })`,
    );
  }
  const request = (brief.request ?? {}) as MicrositeBriefRequest;
  const config: Record<string, unknown> = { ...(brief.brand?.config ?? {}) };
  if (Array.isArray(brief.brand?.segments)) config["segments"] = brief.brand.segments;
  const segmentId = typeof request.segmentId === "string" ? request.segmentId.trim() : "";
  if (segmentId) {
    const segments = Array.isArray(config["segments"]) ? (config["segments"] as unknown[]) : [];
    const matched = segments.some((s) => {
      if (!s || typeof s !== "object") return false;
      const rec = s as Record<string, unknown>;
      // Same id derivation the route uses: id, falling back to name.
      const sid = (typeof rec["id"] === "string" ? rec["id"] : "").trim() || (typeof rec["name"] === "string" ? rec["name"] : "").trim();
      return sid === segmentId;
    });
    if (!matched) {
      throw new Error(
        `microsite brief "${brief.id}" requests segmentId "${segmentId}" but seeds no matching segment — add it to brand.segments (or brand.config.segments); the route fails closed (400) on unknown segment ids`,
      );
    }
  }
  const probeCount = brief.diversityProbe ? brief.diversityProbe.accounts : 1;
  if (brief.diversityProbe && (!Number.isInteger(probeCount) || probeCount < 2 || probeCount > MAX_PROBE_ACCOUNTS)) {
    throw new Error(
      `microsite brief "${brief.id}" has diversityProbe.accounts=${String(probeCount)} — must be an integer between 2 and ${MAX_PROBE_ACCOUNTS}`,
    );
  }
  return { account, request, config, probeCount };
}

/** Map the handler's { page, blocks, degradations } body onto the shared
 *  GenerationResultLike surface the scorers consume. */
function micrositeResultLike(body: unknown): GenerationResultLike {
  const raw = (body ?? {}) as {
    page?: { title?: unknown; slug?: unknown };
    blocks?: unknown;
    degradations?: unknown;
  };
  return {
    title: typeof raw.page?.title === "string" ? raw.page.title : undefined,
    slug: typeof raw.page?.slug === "string" ? raw.page.slug : undefined,
    blocks: Array.isArray(raw.blocks) ? (raw.blocks as EvalBlock[]) : [],
    degradations: Array.isArray(raw.degradations) ? (raw.degradations as EvalDegradation[]) : [],
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  preflight();
  const { briefFilter, updateBaselines, keepTenants } = parseArgs(process.argv.slice(2));
  const briefs = loadBriefs(briefFilter);
  const useJudge = process.env["EVAL_LLM_JUDGE"] === "1";

  // DB / route imports happen after the env preflight so a misconfigured
  // environment fails with the message above, not a module-load stack trace.
  const [{ pool }, expressMod, cookieParserMod, authMod, injectMod, generateMod, micrositeMod, judgeMod] =
    await Promise.all([
      import("@workspace/db"),
      import("express"),
      import("cookie-parser"),
      import("../middleware/requireAuth"),
      import("../test-utils/injectRequest"),
      import("../routes/lp/generate-page"),
      import("../routes/sales/generate-microsite"),
      import("./judge"),
    ]);
  const micrositeHandler = micrositeMod.generateMicrositeHandler as unknown as MicrositeHandler;
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
        await pool.query(`DELETE FROM lp_page_fact_flags WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
        // Microsite seeds (briefings reference accounts — delete them first).
        await pool.query(`DELETE FROM sales_briefings WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
        await pool.query(`DELETE FROM tenant_block_governance WHERE tenant_id = $1`, [id]).catch(() => {});
      }
      for (const sid of createdSids) {
        await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
      }
      for (const id of createdTenantIds) {
        await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
      }
    };

    try {
      // 0. Microsite briefs: fail fast (clear message) on missing seed data
      //    BEFORE anything touches the DB or the AI proxy.
      const micro = (brief.kind ?? "page") === "microsite" ? validateMicrositeBrief(brief) : null;

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
        [tenantId, JSON.stringify(micro ? micro.config : (brief.brand.config ?? {}))],
      );

      // 1b. Seed tenant_block_governance rows when the brief carries any.
      for (const rule of brief.governance ?? []) {
        await pool.query(
          `INSERT INTO tenant_block_governance (tenant_id, block_type, enabled, ai_mode, segments)
           VALUES ($1, $2, $3, $4, $5)`,
          [tenantId, rule.blockType, rule.enabled ?? null, rule.aiMode ?? "open", rule.segments ?? []],
        );
      }

      // ── Microsite path: seed account(s) + invoke the handler directly ──────
      if (micro) {
        const pages: Array<{ label: string; result: GenerationResultLike }> = [];
        let probeFailure: string | null = null;

        for (let i = 0; i < micro.probeCount; i++) {
          const accountName = variantAccountName(micro.account.name.trim(), i);
          const accountRow = await pool.query<{ id: number }>(
            `INSERT INTO sales_accounts (tenant_id, name, domain, segment, num_locations, status)
             VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
            [tenantId, accountName, micro.account.domain ?? null, micro.account.segment ?? null, micro.account.numLocations ?? null],
          );
          const accountId = accountRow.rows[0].id;
          // Pre-seed the account briefing so the route's slow inline account
          // research (30-90s of external calls) is skipped.
          await pool.query(
            `INSERT INTO sales_briefings (tenant_id, account_id, briefing_data, status)
             VALUES ($1, $2, $3::jsonb, 'complete')`,
            [tenantId, accountId, JSON.stringify({ overview: briefingOverview(micro.account, accountName) })],
          );

          const invocation = invokeMicrositeHandler(micrositeHandler, {
            accountId,
            tenantId,
            briefId: brief.id,
            body: { ...micro.request },
          });
          const shimRes = await Promise.race([
            invocation,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), GENERATION_TIMEOUT_MS).unref()),
          ]);
          if (shimRes === null) {
            timedOut = true;
            probeFailure = `microsite generation for account "${accountName}" timed out after ${GENERATION_TIMEOUT_MS}ms`;
            break;
          }
          if (shimRes.status !== 200 || shimRes.body == null) {
            probeFailure = `microsite generation for account "${accountName}" failed: HTTP ${shimRes.status}: ${JSON.stringify(shimRes.body).slice(0, 300)}`;
            break;
          }
          pages.push({ label: accountName, result: micrositeResultLike(shimRes.body) });
        }

        if (probeFailure !== null) {
          records.push({
            briefId: brief.id,
            description: brief.description,
            report: {
              briefId: brief.id,
              scores: emptyScores(),
              violations: [],
              passed: false,
              failures: [probeFailure],
            },
            regressions: [],
            meta: emptyMeta(Date.now() - startedAt),
          });
          console.log(`  ✗ ${probeFailure}`);
          continue;
        }

        // Score: content scorers over the FIRST generation, lineup diversity
        // across every generation (a single-page brief trivially scores 1).
        const primary = pages[0].result;
        const diversity = lineupDiversityScore(
          pages.map((p): LineupPage => ({ label: p.label, blocks: p.result.blocks })),
        );
        const promptText = typeof brief.request.prompt === "string" ? brief.request.prompt : "";
        const allowedStats = approvedStatPool(micro.config, promptText, brief.expectations.allowedStats ?? []);
        const avoidPhrases = Array.isArray(micro.config["avoidPhrases"])
          ? (micro.config["avoidPhrases"] as unknown[]).filter((p): p is string => typeof p === "string")
          : [];
        const report = scoreGeneration({
          briefId: brief.id,
          result: primary,
          expectations: brief.expectations,
          allowedStats,
          brandAvoidPhrases: avoidPhrases,
          lineupDiversity: diversity,
        });
        const regressions = diffAgainstBaseline(report);

        const record: BriefRunRecord = {
          briefId: brief.id,
          description: brief.description,
          report,
          regressions,
          meta: {
            httpStatus: 200,
            durationMs: Date.now() - startedAt,
            title: typeof primary.title === "string" ? primary.title : null,
            slug: typeof primary.slug === "string" ? primary.slug : null,
            blockTypes: (Array.isArray(primary.blocks) ? primary.blocks : []).map((b) =>
              typeof b?.type === "string" ? b.type : "?",
            ),
            degradations: Array.isArray(primary.degradations) ? primary.degradations : [],
            strictMismatches: [],
            referenceFailureReason: null,
            ...(micro.probeCount > 1
              ? {
                  lineupSignatures: pages.map((p) => ({
                    account: p.label,
                    signature: lineupSignature(p.result.blocks),
                  })),
                }
              : {}),
          },
        };

        if (useJudge) {
          try {
            record.judge = await judgeMod.judgeGeneration({
              briefId: brief.id,
              briefDescription: brief.description,
              prompt: promptText || brief.description,
              result: primary,
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
        continue;
      }

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
      const promptText = typeof brief.request.prompt === "string" ? brief.request.prompt : "";
      const allowedStats = approvedStatPool(config, promptText, brief.expectations.allowedStats ?? []);
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
            prompt: promptText,
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
    lineupDiversity: 0,
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
