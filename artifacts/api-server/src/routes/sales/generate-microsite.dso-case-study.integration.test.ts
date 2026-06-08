/**
 * Task #1205 — route-level proof that the AI microsite generator
 * (POST /sales/accounts/:accountId/generate-microsite) can build a from-scratch
 * Case Study (`dso-case-study`) page end-to-end via the CURATED-block-list path.
 *
 * A segment carrying a non-empty `micrositeBlockList` selects the curated path
 * (useFreeform = false), so the neutral freeform vocabulary filter — which would
 * otherwise strip dso-* blocks — is skipped and the model's dso-case-study
 * block reaches the page. This suite proves the same two server-side guards as
 * the marketing generator still fire here:
 *
 *   1. `enforceApprovedCaseStudies` (via enforceDsoSuccessStoriesApproved) —
 *      rebuilds the block from the tenant's approved pool, and under Strict
 *      Facts Mode with an EMPTY pool blanks unapproved prose + stamps the
 *      placeholder headline.
 *   2. `fillDsoCaseStudyNeutralDefaults` — neutral-fills genuinely-missing
 *      fields (never the renderer's DCA demo constants) and coerces every
 *      `sections[].position` to a valid enum.
 *
 * OpenAI is mocked; everything else runs for real via in-process inject()
 * against the shared Postgres pool. Each test tears down its seeded rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

const aiState = vi.hoisted(() => ({
  response: { title: "Generated Microsite", slug: "generated-microsite", blocks: [] as unknown[] },
}));

vi.mock("openai", () => ({
  default: class {
    chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify(aiState.response) } }],
        }),
      },
    };
  },
}));

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import salesRouter from "./index";

// Renderer-default copy from BlockDsoCaseStudy.tsx that must NEVER leak.
const DCA_LEAK_MARKERS = [
  "Hours reclaimed annually",
  "Total annualized value",
  "cut touchpoints in half",
];

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999810000 + Math.floor(Math.random() * 100000),
    email: "ms-dso-cs-it@example.com",
    name: "IT Microsite DSO CaseStudy Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-ms-dso-cs-${randomUUID()}`, sess: JSON.stringify(user) };
}

/**
 * Seed a growth tenant + admin session + a brand row whose "general" segment
 * carries a curated `micrositeBlockList` containing a dso-case-study (this forces
 * the curated path). `strictFacts` toggles Strict Facts Mode.
 */
async function seedTenant(opts: { strictFacts: boolean }): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-ms-dso-cs-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Microsite DSO CaseStudy Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const config: Record<string, unknown> = {
    brandName: "IT Brand",
    segments: [
      {
        id: "general",
        name: "General Buyers",
        micrositeBlockList: [{ type: "hero" }, { type: "dso-case-study" }, { type: "bottom-cta" }],
      },
    ],
  };
  if (!opts.strictFacts) config.aiStrictFactsMode = false;

  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config)
     VALUES ($1, $2::jsonb)`,
    [tenantId, JSON.stringify(config)],
  );

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

async function seedAccount(tenantId: number, name: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
    [tenantId, name],
  );
  return r.rows[0].id;
}

async function seedApprovedCaseStudy(
  tenantId: number,
  content: { quote?: string; stat?: string; statLabel?: string },
  name: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO lp_library_items (tenant_id, type, name, content, is_default, approved_for_ai, sort_order)
     VALUES ($1, 'case_study', $2, $3::jsonb, false, true, 0)`,
    [tenantId, name, JSON.stringify(content)],
  );
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.6.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    ...(body !== undefined ? { body } : {}),
  });
}

beforeAll(() => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-not-used";

  app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("generate-microsite curated — from-scratch dso-case-study", () => {
  it("keeps the block, rebuilds it from the approved pool, and neutral-fills the rest (non-strict)", async () => {
    const { tenantId, sid } = await seedTenant({ strictFacts: false });
    const accountId = await seedAccount(tenantId, `Northwind Dental ${Math.floor(Math.random() * 1e6)}`);
    await seedApprovedCaseStudy(
      tenantId,
      { quote: "Northwind reclaimed its evenings.", stat: "3x", statLabel: "Faster intake" },
      "Northwind Dental Group Success",
    );

    aiState.response = {
      title: "Northwind Case Study",
      slug: "northwind-case-study",
      blocks: [
        { type: "hero", props: { headline: "Northwind", subheadline: "A story" } },
        {
          type: "dso-case-study",
          props: {
            eyebrow: "Their Story",
            headline: "AI invented headline",
            subheadline: "AI subheadline",
            challenge: { heading: "The Challenge", body: "AI challenge body." },
            solution: { heading: "The Solution", body: "AI solution body." },
            // whyItMatters, quote, stats, results OMITTED → neutral-filled.
            sections: [
              { heading: "Setup", body: "Before state.", position: "before-results" },
              { heading: "Outcome", body: "After state.", position: "sideways" },
              { heading: "Extra", body: "More context." },
            ],
          },
        },
        { type: "bottom-cta", props: { headline: "Ready?", ctaText: "Book a demo" } },
      ],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    // The curated path kept the from-scratch dso-case-study block.
    const block = body.blocks.find((b) => b.type === "dso-case-study");
    expect(block).toBeDefined();
    const props = block!.props;

    // enforceApprovedCaseStudies ran with the approved pool.
    expect(props.headline).toBe("Northwind Dental Group Success");
    expect(props.quote).toBe("Northwind reclaimed its evenings.");
    expect(props.stats).toEqual([{ value: "3x", label: "Faster intake" }]);

    // Non-strict: the AI's long-form prose survives.
    expect(props.subheadline).toBe("AI subheadline");
    expect((props.challenge as Record<string, unknown>).body).toBe("AI challenge body.");
    expect((props.solution as Record<string, unknown>).body).toBe("AI solution body.");

    // fillDsoCaseStudyNeutralDefaults ran.
    expect(props.whyItMatters).toEqual({ heading: "Why It Matters", body: "" });
    expect(props.results).toEqual([]);

    // sections[].position coerced.
    const sections = props.sections as Array<Record<string, unknown>>;
    expect(sections).toHaveLength(3);
    expect(sections[0].position).toBe("before-results");
    expect(sections[1].position).toBe("after-results");
    expect(sections[2].position).toBe("after-results");
    expect(sections[0].body).toBe("Before state.");

    const json = JSON.stringify(body.blocks);
    for (const marker of DCA_LEAK_MARKERS) expect(json).not.toContain(marker);
  });

  it("blanks unapproved prose and stamps the placeholder headline with an empty pool (strict)", async () => {
    const { tenantId, sid } = await seedTenant({ strictFacts: true });
    const accountId = await seedAccount(tenantId, `Cascade Dental ${Math.floor(Math.random() * 1e6)}`);
    // No approved case studies seeded → empty pool.

    aiState.response = {
      title: "From Scratch Microsite Case Study",
      slug: "from-scratch-ms-case-study",
      blocks: [
        { type: "hero", props: { headline: "Cascade", subheadline: "A story" } },
        {
          type: "dso-case-study",
          props: {
            eyebrow: "Story",
            headline: "AI fabricated headline",
            subheadline: "AI fabricated subheadline",
            quote: "AI fabricated pull quote",
            challenge: { heading: "The Challenge", body: "AI fabricated challenge." },
            solution: { heading: "The Solution", body: "AI fabricated solution." },
            sections: [
              { heading: "Setup", body: "AI fabricated section.", quote: "AI fabricated section quote", position: "before-results" },
              { heading: "Outcome", body: "AI fabricated section 2." },
            ],
          },
        },
        { type: "bottom-cta", props: { headline: "Ready?", ctaText: "Book a demo" } },
      ],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const block = body.blocks.find((b) => b.type === "dso-case-study");
    expect(block).toBeDefined();
    const props = block!.props;

    // enforceApprovedCaseStudies (strict + empty pool).
    expect(props.headline).toBe("Add a quote in brand settings");
    expect(props.subheadline).toBe("");
    expect(props.quote).toBe("");
    expect((props.challenge as Record<string, unknown>).body).toBe("");
    expect((props.solution as Record<string, unknown>).body).toBe("");

    // Additive sections: prose + pull quote blanked, heading kept, position coerced.
    const sections = props.sections as Array<Record<string, unknown>>;
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("Setup");
    expect(sections[0].body).toBe("");
    expect(sections[0].quote).toBe("");
    expect(sections[0].position).toBe("before-results");
    expect(sections[1].body).toBe("");
    expect(sections[1].position).toBe("after-results");

    // fill still added the neutral structural defaults.
    expect(props.whyItMatters).toEqual({ heading: "Why It Matters", body: "" });
    expect(Array.isArray(props.results)).toBe(true);

    const json = JSON.stringify(body.blocks);
    for (const marker of DCA_LEAK_MARKERS) expect(json).not.toContain(marker);
  });
});
