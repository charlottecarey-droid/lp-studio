// Task #262 — Sibling coverage for the template-driven branch of
// /api/lp/generate-page. The freeform branch is covered by
// `strict-facts-mode.spec.ts`; this file mirrors that spec but seeds a
// tenant-owned template (`lp_pages.is_template = true`) and passes
// `templateId` so the route takes the template path. The captureOnly
// flag returns the assembled template prompt verbatim so we can assert
// the same approved/unapproved + STRICT FACTS MODE behaviour.

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
      "NEON_DATABASE_URL / DATABASE_URL must be set so the strict-facts-mode-template " +
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

// Seeds a minimal tenant-owned template with a single hero block and returns
// its id. The template branch only requires that `blocks` is a non-empty
// array; the captureOnly path doesn't validate block shape further.
async function seedTemplate(pool: pg.Pool, tenantId: number): Promise<number> {
  const client = await pool.connect();
  try {
    const blocks = [
      {
        id: "tpl-hero-1",
        type: "hero",
        props: {
          headline: "Template hero headline",
          subheadline: "Template hero subhead",
          ctaText: "Get Started",
          ctaUrl: "https://example.com/start",
          imageUrl: "",
        },
      },
    ];
    const result = await client.query<{ id: number }>(
      `INSERT INTO lp_pages
         (tenant_id, title, slug, blocks, status, is_template, template_label, is_global)
       VALUES
         ($1, 'Strict template fixture', $2, $3::jsonb, 'draft', true, 'Strict Test Template', false)
       RETURNING id`,
      [
        tenantId,
        `strict-template-${Date.now().toString(36)}`,
        JSON.stringify(blocks),
      ],
    );
    return result.rows[0]!.id;
  } finally {
    client.release();
  }
}

async function capturePrompt(sid: string, templateId: number): Promise<CaptureResponse> {
  const ctx = await newAuthedContext({ baseURL: API_BASE, sid });
  try {
    const res = await ctx.post("lp/generate-page", {
      data: {
        prompt: "Generate a landing page for a single dental practice.",
        templateId,
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

test.describe("Strict Facts Mode prompt filtering — template branch (task #262)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let templateId: number;

  test.beforeAll(async ({ request }) => {
    pool = new pg.Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool, {
      uniqueSuffix: `strict-tpl-${Date.now().toString(36)}`,
    });
    await seedCaseStudies(pool, tenant.tenantId);
    templateId = await seedTemplate(pool, tenant.tenantId);
    // Flush the api-server's host→tenant cache so the just-inserted
    // tenants.domain row is visible to the first request.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant && pool) {
      await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenant.tenantId]);
      await pool.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [
        tenant.tenantId,
      ]);
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) await pool.end();
  });

  test("template + toggle OFF: every claim/stat/case study reaches the prompt; no STRICT instruction", async () => {
    await setStrictMode(pool, tenant.tenantId, false);

    const captured = await capturePrompt(tenant.sessionSid, templateId);
    expect(captured.mode).toBe("template");
    expect(captured.strict).toBe(false);

    const prompt = captured.userPrompt;
    expect(prompt).toContain(APPROVED_CLAIM);
    expect(prompt).toContain(UNAPPROVED_CLAIM);
    expect(prompt).toContain(APPROVED_STAT_VALUE);
    expect(prompt).toContain(UNAPPROVED_STAT_VALUE);
    expect(prompt).toContain(APPROVED_CASE_STUDY);
    expect(prompt).toContain(UNAPPROVED_CASE_STUDY);
    expect(prompt).toContain("CASE STUDIES");
    // Template-branch scaffolding the route always adds.
    expect(prompt).toContain("TEMPLATE BLOCKS");
    expect(prompt).toContain("Template hero headline");

    expect(prompt).not.toContain(STRICT_INSTRUCTION_FRAGMENT);
    expect(prompt).not.toContain("APPROVED CASE STUDIES");
    expect(prompt).not.toContain("APPROVED SEGMENT STATS");
  });

  test("template + toggle ON: only approved entries appear and the STRICT instruction is injected", async () => {
    await setStrictMode(pool, tenant.tenantId, true);

    const captured = await capturePrompt(tenant.sessionSid, templateId);
    expect(captured.mode).toBe("template");
    expect(captured.strict).toBe(true);

    const prompt = captured.userPrompt;
    expect(prompt).toContain(APPROVED_CLAIM);
    expect(prompt).toContain(APPROVED_STAT_VALUE);
    expect(prompt).toContain(APPROVED_CASE_STUDY);

    expect(prompt).not.toContain(UNAPPROVED_CLAIM);
    expect(prompt).not.toContain(UNAPPROVED_STAT_VALUE);
    expect(prompt).not.toContain(UNAPPROVED_CASE_STUDY);

    expect(prompt).toContain(STRICT_INSTRUCTION_FRAGMENT);
    expect(prompt).toContain("APPROVED CASE STUDIES");
    expect(prompt).toContain("APPROVED SEGMENT STATS");
    // Template structural scaffolding is still present in strict mode.
    expect(prompt).toContain("TEMPLATE BLOCKS");
  });
});
