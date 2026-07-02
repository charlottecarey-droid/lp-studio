/**
 * Task #1195 — route-level verification that the AI page generator's
 * template-rewrite path (POST /lp/generate-page, "Use a template" flow) lets the
 * model set the per-section `position` field on a `dso-case-study` block.
 *
 * Context: the structure-preserving merge in generate-page.ts intentionally
 * drops any key the AI invents that the template item did not already have
 * (rules 4 & 6). `DsoCaseStudyExtraSection.position` ("before-results" |
 * "after-results") is the ONE explicit exception — template sections usually
 * have no `position`, but the model is now allowed to add it so it can re-order
 * a section relative to the fixed Results/CTA band. This suite seeds a REAL
 * template whose sections carry NO `position`, has the (mocked) model return
 * sections WITH `position`, and proves the merged output keeps it.
 *
 * It also proves the safety net: an invalid `position` value is coerced to the
 * default "after-results" by fillDsoCaseStudyNeutralDefaults, and every other
 * AI-invented key on the same section is still dropped.
 *
 * OpenAI is mocked; everything else runs for real via in-process inject()
 * against the shared Postgres pool. Each test tears down its seeded rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
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

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999850000 + Math.floor(Math.random() * 100000),
    email: "gp-position-it@example.com",
    name: "IT GP Position Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-gp-position-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-gp-position-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT GP Position Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config)
     VALUES ($1, $2::jsonb)`,
    [tenantId, JSON.stringify({ brandName: "IT Brand", segments: [{ id: "general", name: "General Buyers" }] })],
  );

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

/**
 * Seed a template page containing a `dso-case-study` block whose `sections`
 * carry NO `position` field (the common, legacy template shape).
 */
async function seedTemplate(tenantId: number): Promise<number> {
  const blocks: AiBlock[] = [
    {
      id: "dso-case-study-0",
      type: "dso-case-study",
      props: {
        eyebrow: "Customer story",
        headline: "How Acme transformed their workflow",
        subheadline: "A deep dive",
        challenge: { heading: "The Challenge", body: "Slow processes." },
        solution: { heading: "The Solution", body: "Our platform." },
        results: [{ value: "2x", label: "Faster", description: "Turnaround doubled." }],
        sections: [
          { heading: "Background", body: "How things were before." },
          { heading: "Aftermath", body: "How things changed." },
        ],
        ctaText: "Book a demo",
        ctaUrl: "#",
      },
    },
  ];

  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, is_template, template_label)
     VALUES ($1, 'Case Study Template', $2, $3::jsonb, 'draft', 'marketing', true, 'Case Study')
     RETURNING id`,
    [tenantId, `it-gp-position-tmpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return r.rows[0].id;
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.9.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
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
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("generate-page — dso-case-study section position (template merge)", () => {
  it("preserves model-set `position`, defaults invalid values, and drops other invented keys", async () => {
    const { tenantId, sid } = await seedTenant();
    const templateId = await seedTemplate(tenantId);

    // The model rewrites copy AND sets `position` on each section — the first
    // moves before the Results band, the second uses a bogus value (must be
    // coerced), and both invent an extra key the template never had (dropped).
    aiState.response = {
      title: "Acme Case Study",
      slug: "acme-case-study",
      blocks: [
        {
          type: "dso-case-study",
          props: {
            eyebrow: "Customer story",
            headline: "How Acme reinvented their workflow",
            subheadline: "A deep dive",
            challenge: { heading: "The Challenge", body: "Slow processes." },
            solution: { heading: "The Solution", body: "Our platform." },
            sections: [
              { heading: "Setting the scene", body: "Where Acme started.", position: "before-results", madeUpKey: "nope" },
              { heading: "What changed", body: "Where Acme landed.", position: "sideways", madeUpKey: "nope" },
            ],
          },
        },
      ],
    };

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a customer case study page",
      templateId,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };
    const block = body.blocks.find(b => b.type === "dso-case-study")!;
    const sections = block.props.sections as Array<Record<string, unknown>>;

    // Valid "before-results" survives the structure-preserving merge.
    expect(sections[0].position).toBe("before-results");
    // Invalid value is coerced to the default by the neutral-defaults guard.
    expect(sections[1].position).toBe("after-results");
    // Copy was rewritten.
    expect(sections[0].heading).toBe("Setting the scene");
    expect(sections[1].body).toBe("Where Acme landed.");
    // Every other AI-invented key is still dropped (only `position` is excepted).
    expect("madeUpKey" in sections[0]).toBe(false);
    expect("madeUpKey" in sections[1]).toBe(false);
  });
});
