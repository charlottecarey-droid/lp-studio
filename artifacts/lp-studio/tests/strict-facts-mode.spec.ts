// Task #255 — End-to-end coverage for Strict Facts Mode (task #253).
//
// The toggle lives on lp_brand_settings.config.aiStrictFactsMode and the
// per-row approval flags live on:
//   - brand.productLines[].claims[].approvedForAi
//   - segmentContext.stats[].approvedForAi   (passed by the caller)
//   - lp_library_items.approved_for_ai       (case studies)
//
// When the toggle is OFF, the assembled prompt for /api/lp/generate-page
// must include EVERY claim, stat, and case study regardless of its
// approval flag, and must NOT contain the STRICT FACTS MODE instruction.
//
// When the toggle is ON, the prompt must include ONLY the approved entries
// and the STRICT FACTS MODE instruction must be present.
//
// We exercise the route through a dev-only `_captureOnly` flag that returns
// the assembled system + user prompt instead of calling OpenAI. The flag is
// hard-gated on NODE_ENV !== "production" inside the route handler, so this
// surface area is invisible in production.

import pg from "pg";
import { test, expect } from "./setup/pw";
import { newAuthedContext } from "./setup/csrf";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const API_BASE = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "4319"}/api/`;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the strict-facts-mode " +
        "spec can seed a tenant in the dev DB.",
    );
  }
  return url;
}

const APPROVED_CLAIM = "96% first-time fit rate";
const UNAPPROVED_CLAIM = "200% return on investment";
const APPROVED_STAT_VALUE = "5-day";
const APPROVED_STAT_LABEL = "average turnaround";
const UNAPPROVED_STAT_VALUE = "10x";
const UNAPPROVED_STAT_LABEL = "faster cases";
const APPROVED_CASE_STUDY = "Bright Smiles DSO Pilot";
const UNAPPROVED_CASE_STUDY = "Mystery Test Practice";
const STRICT_INSTRUCTION_FRAGMENT = "STRICT FACTS MODE";

type CaptureResponse = {
  mode: string;
  systemPrompt: string;
  userPrompt: string;
  strict: boolean;
};

async function setStrictMode(pool: pg.Pool, tenantId: number, on: boolean): Promise<void> {
  // Merge the toggle + a productLine carrying one approved + one unapproved
  // claim into the brand config without losing the neutral base from the
  // RoyalTenant fixture.
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE lp_brand_settings
         SET config = config
              || jsonb_build_object('aiStrictFactsMode', $2::boolean)
              || jsonb_build_object('productLines', $3::jsonb)
       WHERE tenant_id = $1`,
      [
        tenantId,
        on,
        JSON.stringify([
          {
            name: "Crown & Bridge",
            description: "Digital crown and bridge restorations.",
            valueProps: ["fast"],
            keywords: ["crown"],
            claims: [
              { text: APPROVED_CLAIM, approvedForAi: true },
              { text: UNAPPROVED_CLAIM, approvedForAi: false },
            ],
          },
        ]),
      ],
    );
  } finally {
    client.release();
  }
}

async function seedCaseStudies(pool: pg.Pool, tenantId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO lp_library_items
         (tenant_id, type, name, content, is_default, approved_for_ai, sort_order)
       VALUES
         ($1, 'case_study', $2, '{}'::jsonb, false, true,  0),
         ($1, 'case_study', $3, '{}'::jsonb, false, false, 1)`,
      [tenantId, APPROVED_CASE_STUDY, UNAPPROVED_CASE_STUDY],
    );
  } finally {
    client.release();
  }
}

async function capturePrompt(sid: string): Promise<CaptureResponse> {
  const ctx = await newAuthedContext({ baseURL: API_BASE, sid });
  try {
    const res = await ctx.post("lp/generate-page", {
      data: {
        prompt: "Generate a landing page for a single dental practice.",
        segmentContext: {
          name: "Generic practice",
          stats: [
            {
              value: APPROVED_STAT_VALUE,
              label: APPROVED_STAT_LABEL,
              approvedForAi: true,
            },
            {
              value: UNAPPROVED_STAT_VALUE,
              label: UNAPPROVED_STAT_LABEL,
              approvedForAi: false,
            },
          ],
        },
        _captureOnly: true,
      },
    });
    expect(
      res.status(),
      `capture (HTTP ${res.status()}: ${await res.text()})`,
    ).toBe(200);
    return (await res.json()) as CaptureResponse;
  } finally {
    await ctx.dispose();
  }
}

test.describe("Strict Facts Mode prompt filtering (task #255)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new pg.Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool, {
      uniqueSuffix: `strict-${Date.now().toString(36)}`,
    });
    await seedCaseStudies(pool, tenant.tenantId);
    // The api-server caches host→tenant lookups for 60s. The Royal fixture
    // inserted a fresh `tenants.domain="localhost"` row that the in-process
    // cache may not yet know about, so flush before the first request.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant && pool) {
      // lp_library_items has a FK → tenants(id); cleanupRoyalTenant doesn't
      // know about library rows, so drop them explicitly first.
      await pool.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [
        tenant.tenantId,
      ]);
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) await pool.end();
  });

  test("toggle OFF: every claim, stat, and case study reaches the prompt; no STRICT instruction", async () => {
    await setStrictMode(pool, tenant.tenantId, false);

    const captured = await capturePrompt(tenant.sessionSid);
    expect(captured.strict).toBe(false);

    const prompt = captured.userPrompt;
    expect(prompt).toContain(APPROVED_CLAIM);
    expect(prompt).toContain(UNAPPROVED_CLAIM);
    expect(prompt).toContain(APPROVED_STAT_VALUE);
    expect(prompt).toContain(UNAPPROVED_STAT_VALUE);

    // Both the approved AND unapproved case study must appear in the OFF
    // prompt — the per-row approval flag is only enforced when strict mode
    // is on. The section uses the neutral "CASE STUDIES" header (no
    // "APPROVED" / "do not invent others" lockdown copy).
    expect(prompt).toContain(APPROVED_CASE_STUDY);
    expect(prompt).toContain(UNAPPROVED_CASE_STUDY);
    expect(prompt).toContain("CASE STUDIES");

    // The strict-mode instruction and lockdown headers must NOT leak into
    // the OFF prompt.
    expect(prompt).not.toContain(STRICT_INSTRUCTION_FRAGMENT);
    expect(prompt).not.toContain("APPROVED CASE STUDIES");
    expect(prompt).not.toContain("APPROVED SEGMENT STATS");
  });

  test("toggle ON: only approved entries appear and the STRICT instruction is injected", async () => {
    await setStrictMode(pool, tenant.tenantId, true);

    const captured = await capturePrompt(tenant.sessionSid);
    expect(captured.strict).toBe(true);

    const prompt = captured.userPrompt;

    // Approved entries survive…
    expect(prompt).toContain(APPROVED_CLAIM);
    expect(prompt).toContain(APPROVED_STAT_VALUE);
    expect(prompt).toContain(APPROVED_CASE_STUDY);

    // …unapproved entries are filtered out.
    expect(prompt).not.toContain(UNAPPROVED_CLAIM);
    expect(prompt).not.toContain(UNAPPROVED_STAT_VALUE);
    expect(prompt).not.toContain(UNAPPROVED_CASE_STUDY);

    // Strict-mode scaffolding the route adds.
    expect(prompt).toContain(STRICT_INSTRUCTION_FRAGMENT);
    expect(prompt).toContain("APPROVED CASE STUDIES");
    expect(prompt).toContain("APPROVED SEGMENT STATS");
  });
});
