/**
 * Task #1205 — route-level proof that the AI page generator's FREEFORM path
 * (POST /lp/generate-page, "describe your page" flow — no templateId) can build
 * a from-scratch Case Study (`dso-case-study`) page end-to-end.
 *
 * The freeform path has no structure-preserving template merge: the model's
 * block array is canonicalized and kept as-is. This suite proves the two
 * server-side guards that make a generated `dso-case-study` block safe still
 * fire on this path:
 *
 *   1. `enforceApprovedCaseStudies` (via enforceDsoSuccessStoriesApproved) —
 *      with an approved pool it rebuilds headline/quote/stats from the approved
 *      source; with an EMPTY pool under Strict Facts Mode it blanks the
 *      unapproved long-form prose and stamps the placeholder headline.
 *   2. `fillDsoCaseStudyNeutralDefaults` — fills genuinely-missing fields with
 *      neutral/empty values (never the renderer's hardcoded DCA demo constants)
 *      and coerces every `sections[].position` to a valid enum.
 *
 * OpenAI is mocked; everything else runs for real via in-process inject()
 * against the shared Postgres pool. Each test tears down its seeded rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

const aiState = vi.hoisted(() => ({
  response: { title: "Generated", slug: "generated", blocks: [] as unknown[] },
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
import generatePageRouter from "./generate-page";

// Renderer-default copy from BlockDsoCaseStudy.tsx that must NEVER leak into a
// generated page (the whole point of fillDsoCaseStudyNeutralDefaults).
const DCA_LEAK_MARKERS = [
  "Hours reclaimed annually",
  "Total annualized value",
  "cut touchpoints in half",
];

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999840000 + Math.floor(Math.random() * 100000),
    email: "gp-dso-cs-it@example.com",
    name: "IT GP DSO CaseStudy Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-gp-dso-cs-${randomUUID()}`, sess: JSON.stringify(user) };
}

/**
 * Seed a growth tenant + admin session + a brand row. `strictFacts` controls
 * whether the brand has Strict Facts Mode left at its default (true) or
 * explicitly disabled (aiStrictFactsMode:false).
 */
async function seedTenant(opts: { strictFacts: boolean }): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-gp-dso-cs-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT GP DSO CaseStudy Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const config: Record<string, unknown> = {
    brandName: "IT Brand",
    segments: [{ id: "general", name: "General Buyers" }],
  };
  // Default (omitted) leaves Strict Facts Mode ON (strict = aiStrictFactsMode !== false).
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

/** Seed one AI-approved case study into the tenant's Content Library. */
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
  return `10.7.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
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
  app.use("/", generatePageRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM ai_generation_log WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
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

describe("generate-page freeform — from-scratch dso-case-study", () => {
  it("keeps the block, rebuilds it from the approved pool, and neutral-fills the rest (non-strict)", async () => {
    const { tenantId, sid } = await seedTenant({ strictFacts: false });
    await seedApprovedCaseStudy(
      tenantId,
      { quote: "Acme cut admin time in half.", stat: "50%", statLabel: "Less admin" },
      "Acme Dental Group Success",
    );

    // The (mocked) model returns a from-scratch dso-case-study with its own
    // headline/stats (must be overridden by the approved source) plus prose +
    // sections (kept under non-strict) and several MISSING fields (must be
    // neutral-filled). Section positions: one valid, one bogus, one absent.
    aiState.response = {
      title: "Acme Case Study",
      slug: "acme-case-study",
      blocks: [
        {
          type: "dso-case-study",
          props: {
            eyebrow: "Their Story",
            headline: "AI invented headline",
            subheadline: "AI subheadline",
            challenge: { heading: "The Challenge", body: "AI challenge body." },
            solution: { heading: "The Solution", body: "AI solution body." },
            // whyItMatters, quote, stats, results all OMITTED → must be filled.
            sections: [
              { heading: "Setup", body: "Before state.", position: "before-results" },
              { heading: "Outcome", body: "After state.", position: "sideways" },
              { heading: "Extra", body: "More context." },
            ],
            ctaText: "Book a demo",
            ctaUrl: "#",
          },
        },
      ],
    };

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Create a customer case study page for a dental group",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    // The freeform path kept the from-scratch dso-case-study block.
    const block = body.blocks.find((b) => b.type === "dso-case-study");
    expect(block).toBeDefined();
    const props = block!.props;

    // enforceApprovedCaseStudies ran with the approved pool: headline, quote,
    // and stats are rebuilt from the approved source (not the AI's invention).
    expect(props.headline).toBe("Acme Dental Group Success");
    expect(props.quote).toBe("Acme cut admin time in half.");
    expect(props.stats).toEqual([{ value: "50%", label: "Less admin" }]);

    // Non-strict: the AI's long-form prose survives.
    expect(props.subheadline).toBe("AI subheadline");
    expect((props.challenge as Record<string, unknown>).body).toBe("AI challenge body.");
    expect((props.solution as Record<string, unknown>).body).toBe("AI solution body.");

    // fillDsoCaseStudyNeutralDefaults ran: omitted fields got neutral/empty
    // values rather than the renderer's DCA demo constants.
    expect(props.whyItMatters).toEqual({ heading: "Why It Matters", body: "" });
    expect(props.results).toEqual([]);

    // sections[].position coerced: valid kept, bogus + missing → "after-results".
    const sections = props.sections as Array<Record<string, unknown>>;
    expect(sections).toHaveLength(3);
    expect(sections[0].position).toBe("before-results");
    expect(sections[1].position).toBe("after-results");
    expect(sections[2].position).toBe("after-results");
    expect(sections[0].body).toBe("Before state.");

    // No DCA demo constant leaked into the generated page.
    const json = JSON.stringify(body.blocks);
    for (const marker of DCA_LEAK_MARKERS) expect(json).not.toContain(marker);
  });

  it("blanks unapproved prose and stamps the placeholder headline with an empty pool (strict)", async () => {
    const { sid } = await seedTenant({ strictFacts: true });
    // No approved case studies seeded → empty pool.

    aiState.response = {
      title: "From Scratch Case Study",
      slug: "from-scratch-case-study",
      blocks: [
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
      ],
    };

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Create a customer case study page for a dental group",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const block = body.blocks.find((b) => b.type === "dso-case-study");
    expect(block).toBeDefined();
    const props = block!.props;

    // enforceApprovedCaseStudies (strict + empty pool): placeholder headline,
    // every unapproved long-form field blanked.
    expect(props.headline).toBe("Add a quote in brand settings");
    expect(props.subheadline).toBe("");
    expect(props.quote).toBe("");
    expect((props.challenge as Record<string, unknown>).body).toBe("");
    expect((props.solution as Record<string, unknown>).body).toBe("");

    // Additive sections: prose + pull quote blanked, structural heading kept,
    // position coerced by fillDsoCaseStudyNeutralDefaults.
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

    // No DCA demo constant leaked.
    const json = JSON.stringify(body.blocks);
    for (const marker of DCA_LEAK_MARKERS) expect(json).not.toContain(marker);
  });
});
