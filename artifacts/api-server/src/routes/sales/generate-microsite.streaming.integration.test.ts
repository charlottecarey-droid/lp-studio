/**
 * "Watch It Build" streaming (issue #1443, July 2026) — route-level proof that
 * POST /sales/accounts/:id/generate-microsite?stream=1 streams the page
 * PROGRESSIVELY: per-`block` SSE events arrive from the model stream (via
 * StreamingBlockParser) BEFORE the post-model `blocks` snapshots, and the
 * stream still terminates with the same `result` body as the JSON path.
 *
 * Before this fix the microsite route ran ONE non-streaming completion — the
 * live canvas sat on "Designing your page with AI…" for the whole model call
 * and then rendered everything at once. The regression this test locks:
 * `event: block` frames must exist and must precede the first `event: blocks`
 * snapshot.
 *
 * OpenAI is mocked with a STREAM-AWARE mock: `stream: true` returns an async
 * iterable of content-delta chunks (the mocked page JSON split into pieces),
 * non-streaming calls (briefing/critique) keep the plain completion shape.
 * Everything else runs for real against the shared Postgres pool.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
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
        create: async (args: { stream?: boolean }) => {
          const text = JSON.stringify(aiState.response);
          if (args?.stream) {
            // Async-iterable chunk stream, split mid-JSON so the incremental
            // parser must reassemble across chunk boundaries (5 uneven cuts).
            const cuts = [0.13, 0.31, 0.55, 0.82, 1].map((f) => Math.floor(text.length * f));
            let prev = 0;
            const pieces = cuts.map((c) => {
              const p = text.slice(prev, c);
              prev = c;
              return p;
            });
            return (async function* () {
              for (let i = 0; i < pieces.length; i++) {
                yield {
                  choices: [
                    {
                      delta: { content: pieces[i] },
                      finish_reason: i === pieces.length - 1 ? "stop" : null,
                    },
                  ],
                };
              }
            })();
          }
          return { choices: [{ message: { content: text } }] };
        },
      },
    };
  },
}));

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import salesRouter from "./index";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999870000 + Math.floor(Math.random() * 100000),
    email: "ms-stream-it@example.com",
    name: "IT Microsite Streaming Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-ms-stream-${randomUUID()}`, sess: JSON.stringify(user) };
}

/** Seed a growth tenant on the FREEFORM path (segment with NO curated
 *  micrositeBlockList) + an admin session. */
async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-ms-stream-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Microsite Streaming Tenant', $1, 'active', 'growth')
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

async function seedAccount(tenantId: number, name: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
    [tenantId, name],
  );
  return r.rows[0].id;
}

/** Parse the captured SSE text into ordered {event, data} frames, dropping
 *  keepalive comments and the retry preamble. */
function parseSseFrames(text: string): Array<{ event: string; data: unknown }> {
  const frames: Array<{ event: string; data: unknown }> = [];
  for (const raw of text.split("\n\n")) {
    const lines = raw.split("\n").filter((l) => l && !l.startsWith(":") && !l.startsWith("retry:"));
    const eventLine = lines.find((l) => l.startsWith("event: "));
    const dataLine = lines.find((l) => l.startsWith("data: "));
    if (!eventLine || !dataLine) continue;
    let data: unknown;
    try {
      data = JSON.parse(dataLine.slice("data: ".length));
    } catch {
      continue;
    }
    frames.push({ event: eventLine.slice("event: ".length), data });
  }
  return frames;
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
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
}, 120_000);

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("generate-microsite — SSE streaming (Watch It Build)", () => {
  it("streams per-block events from the model BEFORE the post-model snapshots, then the result", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Streamside Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);

    aiState.response = {
      title: `${accountName} — Why Switch`,
      slug: `stream-${randomUUID().slice(0, 8)}`,
      blocks: [
        { type: "hero", props: { headline: `${accountName}, meet IT Brand`, subheadline: "A modern workflow" } },
        {
          type: "benefits-grid",
          props: {
            headline: "Why teams switch",
            items: [
              { icon: "Zap", title: "Faster turnaround", description: "Cases back in days" },
              { icon: "Star", title: "Better accuracy", description: "Precision scans" },
              { icon: "Shield", title: "Lower risk", description: "Proven at scale" },
            ],
          },
        },
        { type: "bottom-cta", props: { headline: "Ready to talk?", ctaText: "Book a demo" } },
      ],
    };

    const res = await inject(app, {
      method: "POST",
      url: `/sales/accounts/${accountId}/generate-microsite?stream=1`,
      headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": "10.11.0.1" },
      body: { segmentId: "general" },
    });

    expect(res.status).toBe(200);
    const frames = parseSseFrames(res.text);
    const names = frames.map((f) => f.event);

    // Per-block preview events exist — the model stream was parsed live.
    const blockFrames = frames.filter((f) => f.event === "block");
    expect(blockFrames.length).toBe(3);
    expect(
      blockFrames.map((f) => (f.data as { index: number; block: { type: string } }).index),
    ).toEqual([0, 1, 2]);
    expect(
      blockFrames.map((f) => (f.data as { block: { type: string } }).block.type),
    ).toEqual(["hero", "benefits-grid", "bottom-cta"]);

    // …and they arrive BEFORE the first full-array snapshot (the old behavior
    // was snapshots-only: nothing until the whole model call finished).
    const firstBlockIdx = names.indexOf("block");
    const firstSnapshotIdx = names.indexOf("blocks");
    expect(firstBlockIdx).toBeGreaterThanOrEqual(0);
    expect(firstSnapshotIdx).toBeGreaterThan(firstBlockIdx);

    // Terminal result carries the created page, same contract as the JSON path.
    const result = frames.find((f) => f.event === "result");
    expect(result).toBeDefined();
    const body = result!.data as { page: { id: number }; blocks: Array<{ type: string }> };
    expect(body.page.id).toBeGreaterThan(0);
    expect(body.blocks.length).toBeGreaterThan(0);
  }, 180_000);
});
