/**
 * Partner rooms — integration test of the public visitor routes
 * (POST /lp/room/*) and the tenant routes (/lp/partner-rooms/*) against the
 * REAL Postgres pool (skipped when unreachable).
 *
 * What must hold:
 *   - viewing is open, but an anonymous visitor cannot tick a task or upload;
 *   - an allowed address gets a link by email; anyone else becomes a request;
 *   - a room token only works for ITS page and only while the address is
 *     still allowed (revocation);
 *   - a personal link works only for the page it was made for;
 *   - only tasks the page marks as the customer's can be acted on;
 *   - an uploaded file is never exposed to visitors (no URL, no path) and is
 *     downloadable only by the owning tenant;
 *   - another tenant can read nothing (decoy tenant on every tenant route).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// The whole suite runs as one visitor address within a minute: the per-minute action and state limits are for real traffic, not for this.
vi.hoisted(() => {
  process.env.RATE_LIMIT_ROOM_ACTION_PER_MIN = "100000";
  process.env.RATE_LIMIT_ROOM_STATE_PER_MIN = "100000";
  process.env.RATE_LIMIT_ROOM_ACCESS_PER_10MIN = "100000";
});
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { Readable } from "stream";
import { dbAvailable } from "../../test-utils/dbAvailable";

const stored = new Map<string, Buffer>();
const sentEmails: { recipientEmail: string; roomUrl: string }[] = [];
const inviteEmails: { recipientEmail: string; roomUrl: string; invitedBy: string; note?: string }[] = [];

vi.mock("../../lib/objectStorage", () => ({
  ObjectStorageService: class {
    async uploadObjectEntity(buffer: Buffer, _type: string, opts: { folder?: string }) {
      const path = `/objects/${opts.folder ?? "uploads"}/obj-${stored.size + 1}`;
      stored.set(path, buffer);
      return path;
    }
    async getObjectEntityFile(path: string) {
      const buf = stored.get(path);
      if (!buf) throw new Error("missing");
      return { createReadStream: () => Readable.from([buf]) };
    }
  },
}));
const digestEmails: { recipientEmail: string; subject: string; html: string }[] = [];
let sheetValues: unknown[][] | null = null;
const connectorCalls: { connector: string; path: string; method: string; body: string }[] = [];
let calendarItems: unknown[] | null = null;
let notesDoc: unknown = null;
let modelReply = "";
// "Connect Google": the pure parts (state signing, URLs) stay real; the calls to Google are stubbed.
let googleGrant: { ok: true; refreshToken: string; scopes: string[]; googleEmail: string } | { ok: false; error: string } = { ok: false, error: "unset" };
const googleGets: { connectionId: number; url: string }[] = [];
vi.mock("../../lib/googleWorkspace", async (orig) => ({
  ...(await orig<typeof import("../../lib/googleWorkspace")>()),
  googleWorkspaceConfigured: () => true,
  exchangeGoogleCode: vi.fn(async () => googleGrant),
  revokeGoogleToken: vi.fn(async () => undefined),
  googleGet: vi.fn(async (connectionId: number, url: string) => {
    googleGets.push({ connectionId, url });
    if (url.includes("/calendar/v3/")) return calendarItems ? { ok: true, status: 200, json: async () => ({ items: calendarItems }), text: async () => "" } : { ok: false, status: 401, json: async () => ({}), text: async () => "" };
    return notesDoc ? { ok: true, status: 200, json: async () => notesDoc, text: async () => "" } : { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  }),
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: async () => ({ choices: [{ message: { content: modelReply } }] }) } };
  },
}));
vi.mock("../../lib/notifications", () => ({
  sendRoomAccessEmail: vi.fn(async (p: { recipientEmail: string; roomUrl: string }) => {
    sentEmails.push(p);
    return true;
  }),
  sendRoomInviteEmail: vi.fn(async (p: { recipientEmail: string; roomUrl: string; invitedBy: string; note?: string }) => {
    inviteEmails.push(p);
    return p.recipientEmail !== "bounce@cedardental.com";
  }),
  sendRoomDigestEmail: vi.fn(async (p: { recipientEmail: string; subject: string; html: string }) => {
    digestEmails.push(p);
    return true;
  }),
}));
vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    async proxy(connector: string, path: string, opts?: { method?: string; body?: string }) {
      connectorCalls.push({ connector, path, method: opts?.method ?? "GET", body: opts?.body ?? "" });
      if (connector === "google-calendar") return calendarItems ? { ok: true, json: async () => ({ items: calendarItems }) } : { ok: false, status: 404, text: async () => "not found" };
      if (connector === "google-docs") return notesDoc ? { ok: true, json: async () => notesDoc } : { ok: false, status: 403, text: async () => "forbidden" };
      if (connector === "google-drive") return { ok: false, status: 403, text: async () => "forbidden" };
      return sheetValues ? { ok: true, json: async () => ({ values: sheetValues }) } : { ok: false, status: 403, text: async () => "forbidden" };
    }
  },
}));
vi.mock("../../lib/slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));

import { pool } from "@workspace/db";
import { inject } from "../../test-utils/injectRequest";
import { __clearRecordedAsanaCalls, __getRecordedAsanaCalls } from "../../lib/asana";
import roomsRouter from "./rooms";
import partnerHubsRouter from "./partnerHubs";
import googleConnectRouter from "./googleConnect";
import { signConnectState } from "../../lib/googleWorkspace";

let app: Express;
const tenants: number[] = [];

const BLOCKS = [
  {
    id: "b1",
    type: "hub-plan",
    props: {
      lanes: [
        { title: "Ours", rows: [{ key: "kits", task: "Welcome kits shipped", status: "done" }] },
        {
          title: "Theirs",
          rows: [
            { key: "practice-roster", task: "Send your roster", customerAction: "upload" },
            { key: "announce", task: "Announce the partnership", customerAction: "check" },
          ],
        },
      ],
    },
  },
];

async function seedTenant(): Promise<number> {
  const slug = `it-room-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(`INSERT INTO tenants (name, slug, status, plan) VALUES ('IT Room Tenant', $1, 'active', 'growth') RETURNING id`, [slug]);
  tenants.push(r.rows[0].id);
  return r.rows[0].id;
}
async function seedPage(tenantId: number): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'MB2 Launch Room', $2, 'published', $3::jsonb) RETURNING id`,
    [tenantId, `room-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(BLOCKS)],
  );
  return r.rows[0].id;
}
async function seedHotlink(tenantId: number, pageId: number, email: string): Promise<string> {
  const a = await pool.query<{ id: number }>(`INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, 'Room Co', 'active') RETURNING id`, [tenantId]);
  const c = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status) VALUES ($1, $2, 'Dana', 'Visitor', $3, 'active') RETURNING id`,
    [tenantId, a.rows[0].id, email],
  );
  const token = `rm${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(`INSERT INTO sales_hotlinks (tenant_id, token, contact_id, page_id) VALUES ($1, $2, $3, $4)`, [tenantId, token, c.rows[0].id, pageId]);
  return token;
}

const post = (path: string, body: unknown) => inject(app, { method: "POST", url: `/lp/room/${path}`, headers: { "content-type": "application/json" }, body });
const putStdFor = (tenantId: number) => inject(app, { method: "PUT", url: `/lp/room-standard-assets/practice-welcome-guide`, headers: { "x-test-tenant": String(tenantId), "content-type": "application/json" }, body: { fileUrl: "/api/storage/objects/uploads/std-welcome" } });
const asTenant = (tenantId: number) => ({ "x-test-tenant": String(tenantId), "content-type": "application/json" });
const XLSX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("roster-bytes")]);
const tokenFrom = (url: string) => decodeURIComponent(url.split("?rt=")[1]);

beforeAll(() => {
  // "Connect Google" refuses to start with a client ID that isn't shaped like one.
  process.env.GOOGLE_CLIENT_ID ??= "123456789012-testclient.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET ??= "GOCSPX-test";
  app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: unknown }).log = { error: () => {}, warn: () => {}, info: () => {} };
    const t = req.header("x-test-tenant");
    if (t) (req as unknown as { authUser: unknown }).authUser = { userId: 1, tenantId: Number(t), ...(req.header("x-test-email") ? { email: req.header("x-test-email") } : {}), ...(req.header("x-test-name") ? { name: req.header("x-test-name") } : {}) };
    next();
  });
  app.use(roomsRouter);
  app.use(partnerHubsRouter);
  app.use(googleConnectRouter);
});

afterAll(async () => {
  for (const id of tenants) {
    await pool.query(`DELETE FROM lp_room_win_likes WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_room_win_comments WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [id]).catch(() => {});
    for (const table of ["lp_room_views", "lp_room_autocreate_accounts", "lp_room_doctors", "lp_room_practice_snapshots", "lp_room_practices", "lp_room_wins", "lp_room_contacts", "lp_room_choices", "lp_room_requests", "lp_room_uploads", "lp_room_task_state", "lp_room_members", "lp_room_settings", "sales_hotlinks", "sales_contacts", "sales_accounts", "lp_pages"]) {
      await pool.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [id]).catch(() => {});
    }
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
}, 120_000);

describe.skipIf(!dbAvailable)("partner rooms", () => {
  it("anonymous visitors can read state but cannot act; unknown pages reveal nothing", async () => {
    const tenantId = await seedTenant();
    const pageId = await seedPage(tenantId);
    const state = await post("state", { pageId });
    expect(state.status).toBe(200);
    expect(state.json).toEqual({ viewer: null, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], people: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] });
    expect((await post("state", { pageId: 2_000_000_000 })).json).toEqual({ viewer: null, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], people: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] });
    expect((await post("task", { pageId, taskKey: "announce" })).status).toBe(401);
    expect((await post("upload", { pageId, taskKey: "practice-roster", fileName: "r.xlsx", fileBase64: XLSX.toString("base64") })).status).toBe(401);
    expect((await post("task", { pageId, taskKey: "announce", rt: "forged.token" })).status).toBe(401);
  });

  it("an allowed domain gets an emailed link; other addresses become a request the tenant can approve", async () => {
    const tenantId = await seedTenant();
    const pageId = await seedPage(tenantId);
    const saved = await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: ["@MB2Dental.com"], slackChannelId: "" } });
    expect(saved.json).toMatchObject({ allowedDomains: ["mb2dental.com"] });
    const gmail = await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: ["gmail.com"] } });
    expect(gmail.status).toBe(400);

    sentEmails.length = 0;
    expect((await post("access", { pageId, email: "Levi@MB2Dental.com", path: "/mb2-launch" })).json).toEqual({ status: "sent" });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipientEmail).toBe("levi@mb2dental.com");
    expect(sentEmails[0].roomUrl).toContain("/mb2-launch?rt=");

    expect((await post("access", { pageId, email: "pat@gmail.com" })).json).toEqual({ status: "requested" });
    expect(sentEmails).toHaveLength(1);
    expect((await post("access", { pageId, email: "not-an-email" })).status).toBe(400);

    const detail = await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) });
    expect((detail.json as { members: { email: string; status: string }[] }).members).toEqual([expect.objectContaining({ email: "pat@gmail.com", status: "requested" })]);

    await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/members`, headers: asTenant(tenantId), body: { email: "pat@gmail.com", status: "allowed" } });
    expect((await post("access", { pageId, email: "pat@gmail.com" })).json).toEqual({ status: "sent" });
    expect(sentEmails).toHaveLength(2);
  });

  it("a room token ticks a customer task, only on its own page, only for customer tasks, and stops working when access is removed", async () => {
    const tenantId = await seedTenant();
    const pageId = await seedPage(tenantId);
    const otherPageId = await seedPage(tenantId);
    await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: ["mb2dental.com"] } });
    await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${otherPageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: ["mb2dental.com"] } });
    sentEmails.length = 0;
    await post("access", { pageId, email: "levi@mb2dental.com" });
    const rt = tokenFrom(sentEmails[0].roomUrl);

    expect((await post("task", { pageId: otherPageId, taskKey: "announce", rt })).status).toBe(401);
    expect((await post("task", { pageId, taskKey: "kits", rt })).status).toBe(404); // ours, not the customer's
    expect((await post("task", { pageId, taskKey: "practice-roster", rt })).status).toBe(400); // needs the file
    expect((await post("task", { pageId, taskKey: "announce", rt })).status).toBe(200);

    const anon = await post("state", { pageId });
    expect(anon.json).toEqual({ viewer: null, tasks: { announce: { done: true, at: expect.any(String) } }, requests: [], choices: {}, wins: [], contacts: [], people: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] });
    const known = await post("state", { pageId, rt });
    expect(known.json).toMatchObject({ viewer: { email: "levi@mb2dental.com" }, tasks: { announce: { done: true, by: "levi@mb2dental.com" } } });

    expect((await post("task", { pageId, taskKey: "announce", done: false, rt })).status).toBe(200);
    expect(((await post("state", { pageId })).json as { tasks: object }).tasks).toEqual({});

    // Revocation: decline the address — the same token is now refused.
    await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/members`, headers: asTenant(tenantId), body: { email: "levi@mb2dental.com", status: "denied" } });
    expect((await post("task", { pageId, taskKey: "announce", rt })).status).toBe(401);
    expect(((await post("state", { pageId, rt })).json as { viewer: unknown }).viewer).toBeNull();
  });

  it("a personal link acts as its contact, and only on the page it was made for", async () => {
    const tenantId = await seedTenant();
    const pageId = await seedPage(tenantId);
    const otherPageId = await seedPage(tenantId);
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    expect((await post("task", { pageId: otherPageId, taskKey: "announce", hl })).status).toBe(401);
    expect((await post("task", { pageId, taskKey: "announce", hl })).status).toBe(200);
    const state = await post("state", { pageId, hl });
    expect(state.json).toMatchObject({ viewer: { email: "dana@roomco.com", name: "Dana Visitor" }, tasks: { announce: { by: "Dana Visitor" } } });
  });

  it("an upload is stored privately, completes the task, is never exposed to visitors, and downloads only for the owning tenant", async () => {
    const tenantId = await seedTenant();
    const decoyTenantId = await seedTenant();
    const pageId = await seedPage(tenantId);
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");

    expect((await post("upload", { pageId, taskKey: "announce", hl, fileName: "r.xlsx", fileBase64: XLSX.toString("base64") })).status).toBe(400);
    expect((await post("upload", { pageId, taskKey: "practice-roster", hl, fileName: "r.exe", fileBase64: XLSX.toString("base64") })).status).toBe(400);
    expect((await post("upload", { pageId, taskKey: "practice-roster", hl, fileName: "r.pdf", fileBase64: XLSX.toString("base64") })).status).toBe(400);

    const up = await post("upload", { pageId, taskKey: "practice-roster", hl, fileName: "../MB2 Roster.xlsx", fileBase64: XLSX.toString("base64") });
    expect(up.status).toBe(200);
    expect(up.json).toEqual({ ok: true, fileName: "MB2 Roster.xlsx" });
    expect([...stored.keys()].every((k) => k.startsWith("/objects/room-uploads/"))).toBe(true);

    // Visitors: received + file name for a known viewer, nothing else — no path, no URL, no id.
    const known = await post("state", { pageId, hl });
    expect((known.json as { tasks: Record<string, unknown> }).tasks["practice-roster"]).toEqual({ done: true, at: expect.any(String), by: "Dana Visitor", fileName: "MB2 Roster.xlsx" });
    const anon = await post("state", { pageId });
    expect((anon.json as { tasks: Record<string, unknown> }).tasks["practice-roster"]).toEqual({ done: true, at: expect.any(String) });
    expect(known.text).not.toContain("room-uploads");
    expect(known.text).not.toContain("/objects/");

    // Tenant side.
    const detail = await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) });
    const uploads = (detail.json as { uploads: { id: number; fileName: string; uploadedByEmail: string }[] }).uploads;
    expect(uploads).toEqual([expect.objectContaining({ fileName: "MB2 Roster.xlsx", uploadedByEmail: "dana@roomco.com" })]);
    expect(detail.text).not.toContain("room-uploads");
    const dl = await inject(app, { method: "GET", url: `/lp/partner-rooms/uploads/${uploads[0].id}/download`, headers: asTenant(tenantId) });
    expect(dl.status).toBe(200);
    expect(String(dl.headers["content-disposition"])).toContain("attachment");
    expect(dl.text).toContain("roster-bytes");

    // Another tenant, and no session at all: nothing.
    expect((await inject(app, { method: "GET", url: `/lp/partner-rooms/uploads/${uploads[0].id}/download`, headers: asTenant(decoyTenantId) })).status).toBe(404);
    expect((await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(decoyTenantId) })).status).toBe(404);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(decoyTenantId), body: { allowedDomains: ["evil.com"] } })).status).toBe(404);
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/members`, headers: asTenant(decoyTenantId), body: { email: "x@evil.com", status: "allowed" } })).status).toBe(404);
    expect((await inject(app, { method: "GET", url: `/lp/partner-rooms/uploads/${uploads[0].id}/download` })).status).toBe(403);

    // Reopen from the tenant side: the task opens again, the file is kept.
    await inject(app, { method: "DELETE", url: `/lp/partner-rooms/${pageId}/tasks/practice-roster`, headers: asTenant(tenantId) });
    expect(((await post("state", { pageId })).json as { tasks: object }).tasks).toEqual({});
    const after = await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) });
    expect((after.json as { uploads: unknown[] }).uploads).toHaveLength(1);
  });

  it("a request needs a known visitor, shows only to known visitors, and the tenant moves it along", async () => {
    const tenantId = await seedTenant();
    const decoyTenantId = await seedTenant();
    const r = await pool.query<{ id: number }>(
      `INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'MB2 Workspace', $2, 'published', $3::jsonb) RETURNING id`,
      [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify([{ id: "w1", type: "room-workspace", props: { planGroups: [{ title: "P1", rows: [{ key: "practice-roster", task: "Roster", customerAction: "upload" }] }] } }])],
    );
    const pageId = r.rows[0].id;
    const hubOnlyPageId = await seedPage(tenantId); // a hub-plan page is not a workspace: no requests
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");

    expect((await post("request", { pageId, subject: "Change the one-pager" })).status).toBe(401);
    expect((await post("request", { pageId: hubOnlyPageId, subject: "x", hl })).status).toBe(404);
    expect((await post("request", { pageId, hl, subject: "", details: "" })).status).toBe(400);
    const made = await post("request", { pageId, hl, kind: "asset_change", subject: "Change to: Partnership one-pager", details: "Add our CEO quote", assetKey: "partnership-one-pager" });
    expect(made.status).toBe(200);

    // The workspace's plan drives the same task API.
    expect((await post("upload", { pageId, taskKey: "practice-roster", hl, fileName: "r.xlsx", fileBase64: XLSX.toString("base64") })).status).toBe(200);

    expect(((await post("state", { pageId })).json as { requests: unknown[] }).requests).toEqual([]);
    const known = (await post("state", { pageId, hl })).json as { requests: { id: number; status: string; subject: string; by: string; owner: string | null }[] };
    expect(known.requests).toEqual([expect.objectContaining({ status: "new", subject: "Change to: Partnership one-pager", by: "Dana Visitor", owner: null })]);
    const id = known.requests[0].id;

    const detail = await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) });
    expect(detail.json).toMatchObject({ isRoom: true, requests: [expect.objectContaining({ id, details: "Add our CEO quote", requestedByEmail: "dana@roomco.com" })] });

    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/requests/${id}`, headers: asTenant(decoyTenantId), body: { status: "done" } })).status).toBe(404);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/requests/${id}`, headers: asTenant(tenantId), body: { status: "bogus" } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/requests/${id}`, headers: asTenant(tenantId), body: { status: "review", owner: "Partner Marketing", due: "Nov 21" } })).status).toBe(200);
    const after = (await post("state", { pageId, hl })).json as { requests: { status: string; owner: string; due: string }[] };
    expect(after.requests[0]).toMatchObject({ status: "review", owner: "Partner Marketing", due: "Nov 21" });
  });

  it("workspace modules: onboarding steps, marketing choices, added contacts and the wins feed", async () => {
    const tenantId = await seedTenant();
    const decoyTenantId = await seedTenant();
    const blocks = [
      {
        id: "w1",
        type: "room-workspace",
        props: {
          onboarding: { steps: [{ key: "onboard-logo", title: "Logo", action: "upload" }, { key: "onboard-team", title: "Team", action: "team" }, { key: "onboard-gift", title: "Gift", action: "request" }] },
          marketing: { groups: [{ title: "G", programs: [{ key: "mk-fixed", title: "Fixed" }, { key: "mk-event", title: "Welcome event", options: ["Dinner", "Onsite training", "Not now"] }] }] },
        },
      },
    ];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const other = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS2', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const otherPageId = other.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");

    // Onboarding: an upload step takes a file; the gift step is a tick.
    expect((await post("upload", { pageId, taskKey: "onboard-logo", hl, fileName: "logo.png", fileBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]).toString("base64") })).status).toBe(200);
    expect((await post("task", { pageId, taskKey: "onboard-gift", hl })).status).toBe(200);

    // Choices: anonymous refused; only offered options on offered programs.
    expect((await post("choice", { pageId, key: "mk-event", value: "Dinner" })).status).toBe(401);
    expect((await post("choice", { pageId, key: "mk-event", value: "Yacht", hl })).status).toBe(400);
    expect((await post("choice", { pageId, key: "mk-fixed", value: "Dinner", hl })).status).toBe(400);
    expect((await post("choice", { pageId, key: "mk-event", value: "Dinner", hl })).status).toBe(200);
    expect((await post("choice", { pageId, key: "mk-event", value: "Onsite training", hl })).status).toBe(200);

    // Contacts: adding one completes the "add your team" step.
    expect((await post("contact", { pageId, name: "", hl })).status).toBe(400);
    expect((await post("contact", { pageId, name: "Sam Rivera", role: "Operations lead", email: "Sam@RoomCo.com", hl })).status).toBe(200);

    // Wins: post, like twice (toggle), comment; a win on another page can't be touched from here.
    expect((await post("win", { pageId, body: "First case seated with no adjustments" })).status).toBe(401);
    expect((await post("win", { pageId, body: "First case seated with no adjustments", hl })).status).toBe(200);
    const teamPost = await inject(app, { method: "POST", url: `/lp/partner-rooms/${otherPageId}/wins`, headers: asTenant(tenantId), body: { headline: "Elsewhere", body: "On another page" } });
    expect(teamPost.status).toBe(400); // the test user has no email: a team post needs a signed-in person

    const s1 = (await post("state", { pageId, hl })).json as { tasks: Record<string, { done: boolean }>; choices: Record<string, { value: string; by?: string }>; contacts: { name: string; email: string }[]; wins: { id: number; likes: number; liked: boolean; by: string; comments: unknown[] }[] };
    expect(Object.keys(s1.tasks).sort()).toEqual(["onboard-gift", "onboard-logo", "onboard-team"]);
    expect(s1.choices).toEqual({ "mk-event": { value: "Onsite training", at: expect.any(String), by: "Dana Visitor" } });
    // The person they added, then themself: in the hub by personal link, on no list, so shown rather than asked to add themself.
    expect(s1.contacts).toEqual([expect.objectContaining({ name: "Sam Rivera", email: "sam@roomco.com" }), expect.objectContaining({ name: "Dana Visitor", email: "dana@roomco.com", invited: true })]);
    expect(s1.wins).toEqual([expect.objectContaining({ likes: 0, liked: false, by: "Dana Visitor", comments: [] })]);
    const winId = s1.wins[0].id;

    expect((await post("win/like", { pageId: otherPageId, winId, hl })).status).toBe(401); // the link is for the first page only
    expect((await post("win/like", { pageId, winId: 2_000_000_000, hl })).status).toBe(404);
    expect((await post("win/like", { pageId, winId, hl })).json).toEqual({ ok: true, liked: true });
    expect((await post("win/comment", { pageId, winId, body: "  ", hl })).status).toBe(400);
    expect((await post("win/comment", { pageId, winId, body: "Sharing this at the regional call", hl })).status).toBe(200);

    // Anonymous: sees decisions and wins, but no contacts and no "by" on choices.
    const anon = (await post("state", { pageId })).json as { choices: Record<string, object>; contacts: unknown[]; wins: { likes: number; liked: boolean; comments: { body: string }[] }[] };
    expect(anon.contacts).toEqual([]);
    expect(anon.choices["mk-event"]).toEqual({ value: "Onsite training", at: expect.any(String) });
    expect(anon.wins[0]).toMatchObject({ likes: 1, liked: false, comments: [{ body: "Sharing this at the regional call" }] });
    expect((await post("win/like", { pageId, winId, hl })).json).toEqual({ ok: true, liked: false });

    // Tenant side: everything listed; the decoy tenant gets nothing and can remove nothing.
    const detail = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { choices: { key: string; value: string | null }[]; contacts: { id: number }[]; wins: { id: number }[] };
    expect(detail.choices).toEqual([expect.objectContaining({ key: "mk-event", value: "Onsite training" })]);
    expect(detail.contacts).toHaveLength(1);
    expect((await inject(app, { method: "DELETE", url: `/lp/partner-rooms/${pageId}/wins/${winId}`, headers: asTenant(decoyTenantId) })).status).toBe(404);
    expect((await inject(app, { method: "DELETE", url: `/lp/partner-rooms/${pageId}/wins/${winId}`, headers: asTenant(tenantId) })).status).toBe(200);
    expect(((await post("state", { pageId })).json as { wins: unknown[] }).wins).toEqual([]);
    await inject(app, { method: "DELETE", url: `/lp/partner-rooms/${pageId}/contacts/${detail.contacts[0].id}`, headers: asTenant(tenantId) });
    expect(((await post("state", { pageId, hl })).json as { contacts: { email: string }[] }).contacts.map((c) => c.email)).toEqual(["dana@roomco.com"]);
  }, 30_000);

  it("practices: the team imports a list, any visitor sees counts, only known visitors see names; goals can be agreed", async () => {
    const tenantId = await seedTenant();
    const decoyTenantId = await seedTenant();
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [
      tenantId,
      `ws-${Math.floor(Math.random() * 1e9)}`,
      JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental", goals: { askAgreement: true, items: [{ key: "g1", title: "Live", metric: "practices_live" }] } } }]),
    ]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    const csv = ["name,region,wave,stage,training date,live date", "Main Street Dental,North Texas,1,live,Nov 4,Nov 12", "Lakeside Family,North Texas,1,trained,Nov 5,", "Summit Dental,Colorado,2,,,"].join("\n");

    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(decoyTenantId), body: { csv } })).status).toBe(404);
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(tenantId), body: { csv: "nothing" } })).status).toBe(400);
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(tenantId), body: { csv } })).json).toEqual({ ok: true, added: 3, updated: 0, removed: 0 });
    // Pasting again updates by name; a blank stage keeps the saved one.
    const again = ["name,stage,wave", "Summit Dental,scheduling,2", "Lakeside Family,,1", "Brand New Dental,not started,3"].join("\n");
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(tenantId), body: { csv: again } })).json).toEqual({ ok: true, added: 1, updated: 2, removed: 0 });

    const anon = (await post("state", { pageId })).json as { practices: { total: number; byStage: Record<string, number>; regions: string[] } };
    expect(anon.practices).toMatchObject({ total: 4, byStage: { live: 1, trained: 1, scheduling: 1, not_started: 1 }, regions: ["Colorado", "North Texas"] });
    // The scorecard's extras: live share per region, the waves to filter by, and today's point on the trend (one per day, however often the list refreshes).
    const card = anon.practices as unknown as { byRegion: { region: string; total: number; live: number; trained: number }[]; waves: string[]; trend: { day: string; total: number; byStage: Record<string, number> }[] };
    expect(card.byRegion).toEqual([{ region: "North Texas", total: 2, live: 1, trained: 2 }, { region: "Colorado", total: 1, live: 0, trained: 0 }]);
    expect(card.waves).toEqual(["1", "2", "3"]);
    expect(card.trend).toEqual([{ day: new Date().toISOString().slice(0, 10), total: 4, byStage: { live: 1, trained: 1, scheduling: 1, not_started: 1 } }]);
    expect((await post("practices", { pageId })).status).toBe(401);
    const all = (await post("practices", { pageId, hl })).json as { total: number; rows: { name: string; stage: string }[] };
    expect(all.total).toBe(4);
    const tx = (await post("practices", { pageId, hl, region: "North Texas" })).json as { total: number; rows: { name: string; stage: string }[] };
    expect(tx.rows.map((p) => `${p.name}:${p.stage}`)).toEqual(["Lakeside Family:trained", "Main Street Dental:live"]);
    expect(((await post("practices", { pageId, hl, q: "summit" })).json as { total: number }).total).toBe(1);
    // Clicking a scorecard number: one stage, or a group ("trained" counts live ones too); plus wave and made-up values.
    const names = async (filter: object) => ((await post("practices", { pageId, hl, ...filter })).json as { rows: { name: string }[] }).rows.map((p) => p.name).sort();
    expect(await names({ stage: "live" })).toEqual(["Main Street Dental"]);
    expect(await names({ stage: "trained" })).toEqual(["Lakeside Family", "Main Street Dental"]);
    expect(await names({ stage: "open" })).toEqual(["Brand New Dental", "Summit Dental"]);
    expect(await names({ wave: "2" })).toEqual(["Summit Dental"]);
    expect(await names({ stage: "'; drop table" })).toHaveLength(4);
    // More Salesforce columns arrive with a report; the account owner and last activity are for the team's own view only.
    const report = ["Account Name,Account Owner,Last Activity,Brand of Scanner at Office,Contract Signed Date", "Summit Dental,Rae Rep,11/2/2026,iTero,1/13/2026", "Lakeside Family,Rae Rep,10/1/2026,None,1/13/2026"].join("\n");
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(tenantId), body: { csv: report } })).json).toMatchObject({ ok: true, updated: 2 });
    const asCustomer = (await post("practices", { pageId, hl, q: "summit" })).json as { columns: Record<string, boolean>; rows: Record<string, unknown>[] };
    expect(asCustomer.columns).toMatchObject({ brand: true, contract: true, owner: false, activity: false });
    expect(asCustomer.rows[0]).toMatchObject({ name: "Summit Dental", scannerBrand: "iTero", contractSigned: "1/13/2026" });
    expect(asCustomer.rows[0]).not.toHaveProperty("owner");
    expect(asCustomer.rows[0]).not.toHaveProperty("lastActivity");
    // Someone signed in to LP Studio on this page's own team needs no link or email check (the builder, an in-app preview)...
    const teamEmail = `rep-${Date.now()}@vendor-scorecard.com`;
    await pool.query(`INSERT INTO app_users (tenant_id, email, name, status) VALUES ($1, $2, 'Rae Rep', 'active')`, [tenantId, teamEmail]);
    const signedIn = (path: string, body: object, as: number, email: string) => inject(app, { method: "POST", url: `/lp/room/${path}`, headers: { ...asTenant(as), "x-test-email": email }, body });
    const mine = (await signedIn("state", { pageId }, tenantId, teamEmail)).json as { viewer: { email: string; name: string; team?: boolean } | null };
    expect(mine.viewer).toEqual({ email: teamEmail, name: "Rae Rep", team: true });
    const asTeam = (await signedIn("practices", { pageId, q: "summit" }, tenantId, teamEmail)).json as { columns: Record<string, boolean>; rows: Record<string, unknown>[] };
    expect(asTeam.columns).toMatchObject({ owner: true, activity: true });
    expect(asTeam.rows[0]).toMatchObject({ owner: "Rae Rep", lastActivity: "11/2/2026" });
    expect((await signedIn("scorecard-check", { pageId }, tenantId, teamEmail)).json).toEqual({ checked: false }); // no roster uploaded yet
    // ...but someone signed in to a different workspace is a stranger here.
    expect(((await signedIn("state", { pageId }, decoyTenantId, "outsider@other.com")).json as { viewer: unknown }).viewer).toBeNull();
    expect((await signedIn("practices", { pageId }, decoyTenantId, "outsider@other.com")).status).toBe(401);
    // The team's own link to the published page, for the customer-facing address where LP Studio's sign-in doesn't reach.
    const link = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}/my-link`, headers: { ...asTenant(tenantId), "x-test-email": teamEmail } })).json as { url: string };
    expect(((await post("state", { pageId, rt: tokenFrom(link.url) })).json as { viewer: { email: string; team?: boolean } }).viewer).toMatchObject({ email: teamEmail, team: true });
    expect((await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}/my-link`, headers: { ...asTenant(decoyTenantId), "x-test-email": "outsider@other.com" } })).status).toBe(404);
    // The roster check is about our Salesforce data: a customer can't ask for it.
    expect((await post("scorecard-check", { pageId, hl })).status).toBe(403);
    expect((await post("scorecard-check", { pageId })).status).toBe(401);

    // The team edits one practice; another tenant cannot.
    const list = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}/practices?q=Summit`, headers: asTenant(tenantId) })).json as { rows: { id: number }[] };
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/practices/${list.rows[0].id}`, headers: asTenant(decoyTenantId), body: { stage: "live" } })).status).toBe(404);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/practices/${list.rows[0].id}`, headers: asTenant(tenantId), body: { stage: "nope" } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/practices/${list.rows[0].id}`, headers: asTenant(tenantId), body: { stage: "live", liveDate: "Nov 20" } })).status).toBe(200);
    expect(((await post("state", { pageId })).json as { practices: { byStage: Record<string, number> } }).practices.byStage.live).toBe(2);

    // Goals: agreeing is a task on the workspace.
    expect((await post("task", { pageId, taskKey: "goals-agreed" })).status).toBe(401);
    expect((await post("task", { pageId, taskKey: "goals-agreed", hl })).status).toBe(200);
    expect(((await post("state", { pageId, hl })).json as { tasks: Record<string, { by?: string }> }).tasks["goals-agreed"]).toMatchObject({ done: true, by: "Dana Visitor" });

    // Settings: a save that doesn't mention a setting leaves it alone (saving the calendar once wiped the domain).
    const patchSettings = (body: object) => inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body });
    expect((await patchSettings({ allowedDomains: ["keepme.com"], slackChannelId: "C0123ABCDEF", sfdcAccountId: "0015d000041HyXrAAK" })).status).toBe(200);
    expect((await patchSettings({ calendarId: "primary" })).json).toMatchObject({ allowedDomains: ["keepme.com"], slackChannelId: "C0123ABCDEF", sfdcAccountId: "0015d000041HyXrAAK", calendarId: "primary" });
    expect((await patchSettings({ digestEnabled: true })).status).toBe(200);
    const kept = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { settings: { allowedDomains: string[]; slackChannelId: string | null; sfdcAccountId: string | null } };
    expect(kept.settings).toMatchObject({ allowedDomains: ["keepme.com"], slackChannelId: "C0123ABCDEF", sfdcAccountId: "0015d000041HyXrAAK" });
    expect((await patchSettings({ allowedDomains: [], slackChannelId: "", sfdcAccountId: "" })).json).toMatchObject({ allowedDomains: [], slackChannelId: null, sfdcAccountId: null });

    // Settings: Salesforce and Asana ids are validated.
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], sfdcAccountId: "not an id" } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], asanaProjectGid: "abc" } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], sfdcAccountId: "0015d000041HyXrAAK", asanaProjectGid: "1212539527149031" } })).json).toMatchObject({ sfdcAccountId: "0015d000041HyXrAAK", asanaProjectGid: "1212539527149031" });
  }, 60_000);

  it("on the live page the team edits the plan and moves requests along; a customer approves a request and ticks a meeting action", async () => {
    const tenantId = await seedTenant();
    const blocks = [{ id: "w1", type: "room-workspace", props: {
      partnerName: "MB2 Dental",
      planGroups: [{ title: "P", rows: [{ key: "kits", task: "Welcome kits shipped", status: "not-started", ourOwner: "Marketing", partnerOwner: "—" }, { key: "announce", task: "Announce it", customerAction: "check" }] }],
      meetings: { items: [{ key: "m1", date: "2026-11-10", title: "Weekly sync", actions: [{ text: "Approve the venue", owner: "MB2 Operations" }] }] },
    } }];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    const teamEmail = `rep-${Date.now()}@vendor-live.com`;
    await pool.query(`INSERT INTO app_users (tenant_id, email, name, status) VALUES ($1, $2, 'Rae Rep', 'active')`, [tenantId, teamEmail]);
    const asTeam = (path: string, body: object) => inject(app, { method: "POST", url: `/lp/room/${path}`, headers: { ...asTenant(tenantId), "x-test-email": teamEmail }, body: { pageId, ...body } });
    const row = async (key: string) => {
      const p = await pool.query<{ blocks: { props: { planGroups: { rows: Record<string, string>[] }[] } }[] }>(`SELECT blocks FROM lp_pages WHERE id = $1`, [pageId]);
      return p.rows[0].blocks[0].props.planGroups[0].rows.find((x) => x.key === key)!;
    };

    // The plan: the customer can't change it, a stranger can't, the team can (status, owners, target), and only valid values.
    expect((await post("plan-edit", { pageId, hl, key: "kits", status: "done" })).status).toBe(403);
    expect((await post("plan-edit", { pageId, key: "kits", status: "done" })).status).toBe(401);
    expect((await asTeam("plan-edit", { key: "kits", status: "finished" })).status).toBe(400);
    expect((await asTeam("plan-edit", { key: "nope", status: "done" })).status).toBe(404);
    expect((await asTeam("plan-edit", { key: "kits", status: "on-track", ourOwner: "  Rae   Rep ", target: "Nov 21" })).status).toBe(200);
    expect(await row("kits")).toMatchObject({ task: "Welcome kits shipped", status: "on-track", ourOwner: "Rae Rep", partnerOwner: "—", target: "Nov 21" });
    // Reopening an item the customer had ticked clears their tick, so it stops showing as done.
    expect((await post("task", { pageId, hl, taskKey: "announce" })).status).toBe(200);
    expect((await asTeam("plan-edit", { key: "announce", status: "pending" })).status).toBe(200);
    expect(((await post("state", { pageId, hl })).json as { tasks: Record<string, unknown> }).tasks.announce).toBeUndefined();

    // A meeting action item is a task anyone known can tick off.
    expect((await post("task", { pageId, taskKey: "ma-m1-approve-the-venue" })).status).toBe(401);
    expect((await post("task", { pageId, hl, taskKey: "ma-m1-approve-the-venue" })).status).toBe(200);
    expect(((await post("state", { pageId, hl })).json as { tasks: Record<string, { done: boolean; by: string }> }).tasks["ma-m1-approve-the-venue"]).toMatchObject({ done: true, by: "Dana Visitor" });
    expect((await post("task", { pageId, hl, taskKey: "ma-m1-something-else" })).status).toBe(404);

    // Inviting from the team list on the live hub: the team can, a customer can't; the person is let in, emailed their link, and then shows as invited.
    inviteEmails.length = 0;
    expect((await post("invite", { pageId, hl, email: "kai@mb2dental.com", name: "Kai Lee" })).status).toBe(403);
    expect((await asTeam("invite", { email: "not-an-address", name: "Kai Lee" })).status).toBe(400);
    expect((await asTeam("invite", { email: "Kai@MB2Dental.com", name: "Kai Lee" })).json).toEqual({ ok: true });
    expect(inviteEmails).toHaveLength(1);
    expect(inviteEmails[0]).toMatchObject({ recipientEmail: "kai@mb2dental.com", invitedBy: "Rae Rep" });
    expect(((await post("state", { pageId, rt: tokenFrom(inviteEmails[0].roomUrl) })).json as { viewer: { email: string } }).viewer.email).toBe("kai@mb2dental.com");
    expect(((await asTeam("state", {})).json as { invited: string[] }).invited).toContain("kai@mb2dental.com");
    expect((await post("state", { pageId, hl })).json).not.toHaveProperty("invited"); // who has been invited is the team's to see

    // Requests: the team assigns and moves it along from the page; the customer can only approve one that is ready for review.
    expect((await post("request", { pageId, hl, kind: "reporting", subject: "Monthly usage report", details: "By practice" })).status).toBe(200);
    const reqs = async () => ((await post("state", { pageId, hl })).json as { requests: { id: number; status: string; owner: string | null; due: string | null }[] }).requests;
    const id = (await reqs())[0].id;
    expect((await post("request-update", { pageId, hl, id, status: "done" })).status).toBe(400); // not in review yet
    expect((await post("request-update", { pageId, hl, id, status: "in_progress" })).status).toBe(403);
    expect((await post("request-update", { pageId, hl, id, status: "done", owner: "Me" })).status).toBe(403);
    expect((await asTeam("request-update", { id, status: "bogus" })).status).toBe(400);
    expect((await asTeam("request-update", { id, status: "review", owner: "Rae Rep", due: "Nov 21" })).status).toBe(200);
    expect((await reqs())[0]).toMatchObject({ status: "review", owner: "Rae Rep", due: "Nov 21" });
    expect((await post("request-update", { pageId, hl, id, status: "done" })).status).toBe(200);
    expect((await reqs())[0].status).toBe("done");
    expect((await asTeam("request-update", { id: 999_999_999, status: "done" })).status).toBe(404);
  }, 60_000);

  it("a roster upload ties doctors to practices, fills in regionals and addresses, and the template comes prefilled", async () => {
    const tenantId = await seedTenant();
    const blocks = [{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental", planGroups: [{ title: "P", rows: [{ key: "practice-roster", task: "Upload your practice list", customerAction: "upload" }] }] } }];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    const sfdc = ["Account Name,Account ID,Billing State/Province,Status", "Main Street Dental,0015d00000AAAAAAAA,TX,Ramped", "Lakeside Family,0015d00000BBBBBAAA,CO,Onboarding", "Summit Dental,0015d00000CCCCCAAA,CO,New"].join("\n");
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(tenantId), body: { csv: sfdc } })).json).toMatchObject({ ok: true, added: 3 });

    // The template: known visitors only, one row per practice with its Salesforce ID.
    expect((await post("roster-template", { pageId })).status).toBe(401);
    const tpl = (await post("roster-template", { pageId, hl })).json as { fileName: string; csv: string };
    expect(tpl.fileName).toBe("mb2-dental-practice-and-doctor-roster.csv");
    const lines = tpl.csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Practice ID,Practice name,Street address,City,State,ZIP,Phone,Office type,Regional manager,Office manager,Doctor name,Doctor email,Doctor NPI,Doctor role");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe("0015d00000BBBBBAAA,Lakeside Family,,,CO,,,,,,,");

    // The customer fills it in and uploads it: a renamed practice still lands by its ID, and one practice isn't in Salesforce.
    const roster = [
      lines[0],
      "0015d00000AAAAAAAA,Main St Dental,100 Main St,Dallas,TX,75201,Dana Ruiz,Pat Lee,Dr. Ana Patel,ana@mainst.com,1234567890,General",
      "0015d00000AAAAAAAA,Main St Dental,,,,,,,Dr. Ben Cho,ben@mainst.com,,Associate",
      "0015d00000BBBBBAAA,Lakeside Family,22 Lake Rd,Denver,CO,80202,Sam Ortiz,,Dr. Cy Diaz,cy@lakeside.com,,",
      ",Brand New Smiles,9 New Way,Austin,TX,78701,Dana Ruiz,,Dr. Dee Fox,dee@new.com,,",
    ].join("\n");
    const up = await post("upload", { pageId, hl, taskKey: "practice-roster", fileName: "MB2 roster.csv", fileBase64: Buffer.from(roster).toString("base64") });
    expect(up.json).toMatchObject({ ok: true, roster: { practices: 3, doctors: 4, issues: [] } });
    expect(JSON.stringify(up.json)).not.toContain("Brand New Smiles"); // what Salesforce is missing is for the team, not the customer

    // The Scorecard: doctors under their practice, regional manager and address filled in, the practice list itself unchanged.
    const card = (await post("practices", { pageId, hl })).json as { total: number; columns: Record<string, boolean>; rows: { name: string; regionalManager: string | null; address: string | null; zip: string | null; officeManager: string | null; doctors: { name: string; role: string | null }[] }[] };
    expect(card.total).toBe(3);
    expect(card.columns).toMatchObject({ address: true, office: true, doctors: true, manager: true });
    const main = card.rows.find((p) => p.name === "Main Street Dental")!;
    expect(main).toMatchObject({ regionalManager: "Dana Ruiz", address: "100 Main St", zip: "75201", officeManager: "Pat Lee" });
    expect(main.doctors).toEqual([{ name: "Dr. Ana Patel", role: "General" }, { name: "Dr. Ben Cho", role: "Associate" }]);
    expect(card.rows.find((p) => p.name === "Summit Dental")!.doctors).toEqual([]);
    expect(((await post("state", { pageId })).json as { practices: { doctors: { total: number; matched: number } } }).practices.doctors).toEqual({ total: 4, matched: 3 });

    // The team's check: what Salesforce is missing, what the roster left out, and the doctors with nowhere to go.
    const teamEmail = `rep-${Date.now()}@vendor-roster.com`;
    await pool.query(`INSERT INTO app_users (tenant_id, email, name, status) VALUES ($1, $2, 'Rae Rep', 'active')`, [tenantId, teamEmail]);
    const check = (await inject(app, { method: "POST", url: `/lp/room/scorecard-check`, headers: { ...asTenant(tenantId), "x-test-email": teamEmail }, body: { pageId } })).json;
    expect(check).toMatchObject({ checked: true, fileName: "MB2 roster.csv", onRoster: 3, matched: 2, missingFromSalesforce: ["Brand New Smiles"], notOnRoster: ["Summit Dental"], doctors: 4, doctorsUnmatched: 1, enriched: 2 });

    // A later practices-only list updates details but leaves the doctors alone; a file that isn't a roster changes nothing.
    const again = await post("upload", { pageId, hl, taskKey: "practice-roster", fileName: "locations.csv", fileBase64: Buffer.from("Location Name,RDO\nSummit Dental,Lee Chen").toString("base64") });
    expect(again.json).toMatchObject({ ok: true, roster: { practices: 1, doctors: 0 } });
    const after = (await post("practices", { pageId, hl, q: "summit" })).json as { rows: { regionalManager: string | null }[] };
    expect(after.rows[0].regionalManager).toBe("Lee Chen");
    expect(((await post("state", { pageId })).json as { practices: { doctors: { total: number } } }).practices.doctors.total).toBe(4);
    const notes = await post("upload", { pageId, hl, taskKey: "practice-roster", fileName: "notes.csv", fileBase64: Buffer.from("Topic,Owner\nKickoff,Sam").toString("base64") });
    expect(notes.json).toEqual({ ok: true, fileName: "notes.csv" });
  }, 60_000);

  it("a hub that asks for an email tells a stranger nothing, and hands a recognised visitor the hub", async () => {
    const tenantId = await seedTenant();
    const blocks = [{ id: "w1", type: "room-workspace", props: { requireEmail: true, partnerName: "MB2 Dental", planGroups: [{ title: "P", rows: [{ key: "announce", task: "Announce it", customerAction: "check" }] }], calendar: { events: [{ key: "k", date: "2026-12-03", title: "Business review" }] } } }];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    expect((await post("task", { pageId, hl, taskKey: "announce" })).status).toBe(200);
    expect((await post("win", { pageId, hl, body: "First case seated" })).status).toBe(200);

    // A stranger: no viewer, no progress, no wins, and not the hub's contents.
    const anon = (await post("state", { pageId })).json as Record<string, unknown>;
    expect(anon).toMatchObject({ viewer: null, gated: true, tasks: {}, wins: [], events: [], practices: { total: 0 } });
    expect(anon).not.toHaveProperty("props");
    expect(JSON.stringify(anon)).not.toContain("First case seated");
    // Their calendar feed is closed too, unless the address carries a room token for someone the hub knows.
    expect((await inject(app, { method: "GET", url: `/lp/room/calendar.ics?pageId=${pageId}` })).status).toBe(404);

    // A recognised visitor: the same call hands over the hub.
    const known = (await post("state", { pageId, hl })).json as { viewer: { email: string }; gated?: boolean; props: { planGroups: { rows: { task: string }[] }[] }; wins: unknown[]; tasks: Record<string, unknown> };
    expect(known.viewer.email).toBe("dana@roomco.com");
    expect(known.props.planGroups[0].rows[0].task).toBe("Announce it");
    expect(known.wins).toHaveLength(1);
    expect(known.tasks.announce).toMatchObject({ done: true });

    // The email step still works for a stranger: an address at the customer's domain is sent a link, and that link opens the hub and its calendar.
    await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: ["mb2dental.com"] } });
    sentEmails.length = 0;
    expect((await post("access", { pageId, email: "levi@mb2dental.com" })).json).toEqual({ status: "sent" });
    const rt = tokenFrom(sentEmails[0].roomUrl);
    expect(((await post("state", { pageId, rt })).json as { props?: unknown }).props).toBeTruthy();
    const feed = await inject(app, { method: "GET", url: `/lp/room/calendar.ics?pageId=${pageId}&rt=${encodeURIComponent(rt)}` });
    expect(feed.status).toBe(200);

    // A hub that doesn't ask stays open, and its state carries no copy of the page.
    const openPage = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'Open', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental" } }])]);
    const openState = (await post("state", { pageId: openPage.rows[0].id })).json as Record<string, unknown>;
    expect(openState).not.toHaveProperty("gated");
    expect(openState).not.toHaveProperty("props");
    expect((await inject(app, { method: "GET", url: `/lp/room/calendar.ics?pageId=${openPage.rows[0].id}` })).status).toBe(200);
  }, 60_000);

  it("marketing requests are filed in Asana as Expansion Support - customer - request, with intake status submitted; other kinds are not", async () => {
    const tenantId = await seedTenant();
    await pool.query(`INSERT INTO lp_integrations (tenant_id, provider, enabled, config) VALUES ($1, 'asana', true, $2::jsonb)`, [tenantId, JSON.stringify({ pat: "test-pat", projectId: "111111111" })]);
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental" } }])]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], asanaProjectGid: "222222222" } });
    __clearRecordedAsanaCalls();

    expect((await post("request", { pageId, hl, kind: "training", subject: "Saturday training slot" })).status).toBe(200);
    expect((await post("request", { pageId, hl, kind: "asset_change", subject: "Change to: Partnership one-pager", details: "Add our CEO quote" })).status).toBe(200);
    expect((await post("request", { pageId, hl, kind: "marketing", subject: "Extra welcome kits" })).status).toBe(200);
    // The Asana call runs after the response.
    for (let i = 0; i < 40 && __getRecordedAsanaCalls().length < 2; i++) await new Promise((res) => setTimeout(res, 50));
    const calls = __getRecordedAsanaCalls().filter((c) => c.tenantId === tenantId);
    expect(calls.map((c) => c.payload.name).sort()).toEqual(["Expansion Support - MB2 Dental - Change to: Partnership one-pager", "Expansion Support - MB2 Dental - Extra welcome kits"]);
    expect(calls.every((c) => (c.payload.projects as string[])[0] === "222222222" && c.payload.intakeStatus === "submitted")).toBe(true);
    expect(String(calls[0].payload.notes)).toContain("Dana Visitor (dana@roomco.com)");
    for (let i = 0; i < 40; i++) {
      const rows = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM lp_room_requests WHERE page_id = $1 AND asana_task_gid IS NOT NULL`, [pageId]);
      if (rows.rows[0].n === 2) break;
      await new Promise((res) => setTimeout(res, 50));
    }
    const detail = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { requests: { kind: string; asanaTaskGid: string | null }[] };
    expect(detail.requests.filter((q) => q.asanaTaskGid).map((q) => q.kind).sort()).toEqual(["asset_change", "marketing"]);
    expect(detail.requests.find((q) => q.kind === "training")?.asanaTaskGid).toBeNull();
  });

  it("a connected Google Sheet is the practice list: it mirrors the sheet, and an unreadable sheet changes nothing", async () => {
    const tenantId = await seedTenant();
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental" } }])]);
    const pageId = r.rows[0].id;
    const settings = (body: object) => inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], ...body } });
    const sync = () => inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/sync-sheet`, headers: asTenant(tenantId) });

    expect((await sync()).status).toBe(400); // nothing connected
    expect((await settings({ practicesSheet: "not a sheet" })).status).toBe(400);
    expect((await settings({ practicesSheet: "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=0", practicesSheetTab: "All practices" })).status).toBe(200);

    sheetValues = [["Name", "Region", "Wave", "Stage", "Training Date"], ["Main Street Dental", "North Texas", "1", "Live", "Nov 4"], ["Lakeside Family", "Colorado", "2", "", ""], ["", "No name", "", "", ""]];
    expect((await sync()).json).toEqual({ ok: true, note: "2 practices in the sheet (2 added, 0 updated, 0 removed)." });
    // The sheet changes: one practice goes live, one leaves, one arrives.
    sheetValues = [["Name", "Region", "Stage"], ["Main Street Dental", "North Texas", "Live"], ["Summit Dental", "Colorado", "Scheduling"]];
    expect((await sync()).json).toEqual({ ok: true, note: "2 practices in the sheet (1 added, 1 updated, 1 removed)." });
    const state = (await post("state", { pageId })).json as { practices: { total: number; byStage: Record<string, number> } };
    expect(state.practices).toMatchObject({ total: 2, byStage: { live: 1, scheduling: 1 } });

    // A sheet we can't open, or an empty one, never wipes the list.
    sheetValues = null;
    expect((await sync()).status).toBe(400);
    sheetValues = [["Name"]];
    expect((await sync()).status).toBe(400);
    expect(((await post("state", { pageId })).json as { practices: { total: number } }).practices.total).toBe(2);
    const detail = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { sheet: { id: string; tab: string; note: string } };
    expect(detail.sheet).toMatchObject({ id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345", tab: "All practices" });
    expect(detail.sheet.note).toContain("no rows with a practice name");
  });

  it("an uploaded list is compared with the room's practices, and the gap is raised for RevOps", async () => {
    const tenantId = await seedTenant();
    const decoyTenantId = await seedTenant();
    await pool.query(`INSERT INTO lp_integrations (tenant_id, provider, enabled, config) VALUES ($1, 'asana', true, $2::jsonb)`, [tenantId, JSON.stringify({ pat: "test-pat", projectId: "111111111" })]);
    const blocks = [{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental", planGroups: [{ title: "P", rows: [{ key: "practice-roster", task: "Upload your practice list", customerAction: "upload" }] }] } }];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(tenantId), body: { csv: "name\nMain Street Dental\nLakeside Family Dentistry\nClosed Practice LLC" } });
    const list = 'Practice Name,City\n"Main Street Dental, P.C.",Dallas\nLakeside Family Dentistry,Austin\nBrand New Dental,Denver\n';
    expect((await post("upload", { pageId, taskKey: "practice-roster", hl, fileName: "MB2 practices.csv", fileBase64: Buffer.from(list).toString("base64") })).status).toBe(200);
    const uploads = ((await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { uploads: { id: number }[] }).uploads;

    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/uploads/${uploads[0].id}/compare`, headers: asTenant(decoyTenantId) })).status).toBe(404);
    const cmp = (await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/uploads/${uploads[0].id}/compare`, headers: asTenant(tenantId) })).json as { practices: { uploaded: number; matched: number; missingFromRoom: string[]; notOnUpload: string[] } };
    expect(cmp.practices).toMatchObject({ uploaded: 3, matched: 2, missingFromRoom: ["Brand New Dental"], notOnUpload: ["Closed Practice LLC"] });

    __clearRecordedAsanaCalls();
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/revops-task`, headers: asTenant(tenantId), body: { missing: [], doctors: 0 } })).status).toBe(400);
    const raised = await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/revops-task`, headers: asTenant(tenantId), body: { missing: cmp.practices.missingFromRoom, fileName: "MB2 practices.csv" } });
    expect(raised.json).toMatchObject({ ok: true, mentioned: false });
    // RevOps is told in Slack only: never an Asana task.
    expect(__getRecordedAsanaCalls().filter((c) => c.tenantId === tenantId)).toHaveLength(0);
    const { slackService } = await import("../../lib/slack-service");
    const sent = JSON.stringify(vi.mocked(slackService.postMessage).mock.calls.at(-1));
    expect(sent).toContain("Brand New Dental");

    // With a mention saved, the post tags RevOps.
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], revopsSlackMention: "not an id" } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], revopsSlackMention: "S0123ABCD" } })).status).toBe(200);
    const again = await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/revops-task`, headers: asTenant(tenantId), body: { missing: cmp.practices.missingFromRoom, fileName: "MB2 practices.csv" } });
    expect(again.json).toMatchObject({ ok: true, mentioned: true });
    expect(JSON.stringify(vi.mocked(slackService.postMessage).mock.calls.at(-1))).toContain("<!subteam^S0123ABCD>");

    // The calendar feed lists the page's dated, visible events only.
    await pool.query(`UPDATE lp_pages SET blocks = $2::jsonb WHERE id = $1`, [pageId, JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental", calendar: { events: [{ key: "kick", date: "2027-01-12", time: "2:00 pm CT", title: "Kickoff, with sponsors" }, { key: "h", date: "2027-01-13", title: "Hidden", hidden: true }, { key: "n", date: "soon", title: "No date" }] } } }])]);
    const feed = await inject(app, { method: "GET", url: `/lp/room/calendar.ics?pageId=${pageId}` });
    expect(feed.status).toBe(200);
    expect(feed.text).toContain("SUMMARY:Kickoff\\, with sponsors");
    expect(feed.text).not.toContain("Hidden");
    expect((await inject(app, { method: "GET", url: `/lp/room/calendar.ics?pageId=999999999` })).status).toBe(404);
  });

  it("weekly digest: preview shows what would go out; a manual send emails each saved recipient once", async () => {
    const tenantId = await seedTenant();
    const blocks = [{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental", planGroups: [{ title: "P", rows: [{ key: "announce", task: "Internal announcement", customerAction: "check" }, { key: "roster", task: "Upload your practice list", customerAction: "upload" }] }] } }];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    await post("task", { pageId, taskKey: "announce", hl });

    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], digestEnabled: true, digestRecipients: ["nope"] } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], digestEnabled: true, digestRecipients: ["Dana@RoomCo.com", "sam@roomco.com", "dana@roomco.com"] } })).status).toBe(200);

    const preview = (await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/digest/preview`, headers: asTenant(tenantId) })).json as { subject: string; html: string; recipients: string[]; slackText: string; empty: boolean };
    expect(preview.recipients).toEqual(["dana@roomco.com", "sam@roomco.com"]);
    expect(preview.subject).toContain("MB2 Dental");
    expect(preview.html).toContain("Internal announcement");
    expect(preview.html).toContain("Upload your practice list");
    expect(preview.empty).toBe(false);

    digestEmails.length = 0;
    const sent = (await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/digest/send`, headers: asTenant(tenantId) })).json as { sent: boolean; emails: number };
    expect(sent).toMatchObject({ sent: true, emails: 2 });
    expect(digestEmails.map((e) => e.recipientEmail).sort()).toEqual(["dana@roomco.com", "sam@roomco.com"]);
    const detail = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { digest: { enabled: boolean; lastSentAt: string | null } };
    expect(detail.digest.enabled).toBe(true);
    expect(detail.digest.lastSentAt).not.toBeNull();
  });

  it("syncs the calendar's customer meetings, drafts minutes from notes, and shows them only once published", async () => {
    const tenantId = await seedTenant();
    const decoyTenantId = await seedTenant();
    const blocks = [{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental" } }];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const settings = (body: unknown, as = tenantId) => inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(as), body });
    const sync = (as = tenantId) => inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/calendar/sync`, headers: asTenant(as) });
    const state = async () => (await post("state", { pageId })).json as { events: { id: number; title: string }[]; minutes: { title: string; summary: string; decisions: string[] }[] };

    expect((await settings({ allowedDomains: [], calendarId: "a/b?c" })).status).toBe(400);
    expect((await settings({ allowedDomains: [], calendarId: "primary" })).status).toBe(200);
    // No customer domain yet: nothing can be matched.
    expect((await sync()).status).toBe(400);
    // Our own domain on the list (to let teammates in) never decides which meetings show: alone, it matches nothing.
    await pool.query(`INSERT INTO app_users (tenant_id, email, name, status) VALUES ($1, $2, 'Cal Owner', 'active')`, [tenantId, `cal-${Date.now()}@vendor.com`]);
    expect((await settings({ allowedDomains: ["vendor.com"], calendarId: "primary" })).status).toBe(200);
    const ownOnly = await sync();
    expect(ownOnly.status).toBe(400);
    expect(JSON.stringify(ownOnly.json)).toContain("Only your own team's domain");
    // With the customer's domain beside it, only meetings the customer is on come in (the internal one below stays out).
    expect((await settings({ allowedDomains: ["mb2dental.com", "vendor.com"], calendarId: "primary" })).status).toBe(200);
    expect((await sync(decoyTenantId)).status).toBe(404);

    const past = new Date(Date.now() - 2 * 86_400_000);
    const future = new Date(Date.now() + 5 * 86_400_000);
    calendarItems = [
      { id: "past1", summary: "MB2 weekly sync", start: { dateTime: past.toISOString() }, end: { dateTime: new Date(past.getTime() + 1_800_000).toISOString() }, attendees: [{ email: "rep@vendor.com" }, { email: "levi@mb2dental.com", displayName: "Levi Stone" }], attachments: [{ fileId: "1AbCdEfGhIjKlMnOp", title: "MB2 weekly sync - Notes by Gemini", mimeType: "application/vnd.google-apps.document" }] },
      { id: "next1", summary: "Business review", start: { dateTime: future.toISOString() }, end: { dateTime: new Date(future.getTime() + 3_600_000).toISOString() }, attendees: [{ email: "dana@mb2dental.com" }] },
      { id: "internal1", summary: "Internal: MB2 deal strategy", start: { dateTime: future.toISOString() }, attendees: [{ email: "rep@vendor.com" }] },
    ];
    notesDoc = { body: { content: [{ paragraph: { elements: [{ textRun: { content: "Wave one is live. Decided to start Colorado Dec 1.\n" } }] } }] } };
    modelReply = JSON.stringify({ summary: "Wave one is live.", decisions: ["Colorado starts Dec 1"], actions: [{ text: "Send the roster", owner: "Levi" }] });
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "http://test.invalid";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test";
    const first = await sync();
    expect(first.json).toMatchObject({ ok: true, drafted: 1 });

    // The customer sees the two meetings they are on, and no minutes yet: the draft is the team's only.
    let pub = await state();
    expect(pub.events.map((e) => e.title).sort()).toEqual(["Business review", "MB2 weekly sync"]);
    expect(pub.minutes).toEqual([]);
    expect(JSON.stringify(pub)).not.toContain("Colorado starts Dec 1");
    expect(JSON.stringify(pub)).not.toContain("mb2dental.com");

    const detail = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { events: { id: number; title: string; minutesStatus: string | null; minutes: { decisions: string[] } | null }[] };
    const draft = detail.events.find((e) => e.title === "MB2 weekly sync")!;
    expect(draft).toMatchObject({ minutesStatus: "draft", minutes: { decisions: ["Colorado starts Dec 1"] } });

    // Another tenant can't touch it; an empty publish is refused; a real publish reaches the customer.
    const patch = (id: number, body: unknown, as = tenantId) => inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/events/${id}`, headers: asTenant(as), body });
    expect((await patch(draft.id, { minutesStatus: "published" }, decoyTenantId)).status).toBe(404);
    const upcoming = detail.events.find((e) => e.title === "Business review")!;
    expect((await patch(upcoming.id, { minutesStatus: "published" })).status).toBe(400);
    expect((await patch(draft.id, { minutes: { summary: "Wave one is live.", decisions: ["Colorado starts Dec 1"], actions: [] }, minutesStatus: "published" })).status).toBe(200);
    pub = await state();
    expect(pub.minutes).toHaveLength(1);
    expect(pub.minutes[0]).toMatchObject({ title: "MB2 weekly sync", decisions: ["Colorado starts Dec 1"] });

    // Hiding a meeting removes it from the customer's calendar; a meeting that leaves the calendar leaves the room, but one with minutes stays.
    expect((await patch(upcoming.id, { hidden: true })).status).toBe(200);
    expect((await state()).events.map((e) => e.title)).toEqual(["MB2 weekly sync"]);
    calendarItems = [];
    expect((await sync()).status).toBe(200);
    const after = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { events: { title: string }[] };
    expect(after.events.map((e) => e.title)).toEqual(["MB2 weekly sync"]);

    // The calendar feed carries the synced meeting.
    expect((await inject(app, { method: "GET", url: `/lp/room/calendar.ics?pageId=${pageId}` })).text).toContain("SUMMARY:MB2 weekly sync");
    calendarItems = null;
    notesDoc = null;
    delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  });

  it("Connect Google: a signed state connects the member, and a room then reads the calendar through that connection", async () => {
    const tenantId = await seedTenant();
    const otherTenantId = await seedTenant();
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental" } }])]);
    const pageId = r.rows[0].id;
    const get = (url: string, as = tenantId) => inject(app, { method: "GET", url, headers: { ...asTenant(as), "x-test-email": "rep@vendor.com" } });
    const settings = (body: unknown) => inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body });

    expect((await get("/lp/google/status")).json).toMatchObject({ configured: true, connection: null });
    // Nothing to read through yet.
    expect((await settings({ allowedDomains: ["mb2dental.com"], calendarConnection: "mine" })).status).toBe(400);

    // The consent URL asks for read-only calendar + docs and carries a signed state; an off-site return path is ignored.
    const url = new URL(((await get(`/lp/google/auth-url?returnTo=${encodeURIComponent("//evil.example/x")}`)).json as { url: string }).url);
    expect(url.searchParams.get("scope")).toContain("calendar.events.readonly");
    expect(url.searchParams.get("scope")).toContain("documents.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
    const state = url.searchParams.get("state")!;

    // A forged or stale state is refused; nothing is stored.
    expect((await inject(app, { method: "GET", url: `/lp/google/callback?code=abc&state=${state.slice(0, -2)}xx` })).status).toBe(400);
    expect((await inject(app, { method: "GET", url: `/lp/google/callback?code=abc&state=${encodeURIComponent(signConnectState({ tenantId, userId: 1, email: "rep@vendor.com", returnTo: "http://localhost/x" }, Date.now() - 11 * 60_000))}` })).status).toBe(400);

    // Unticking a permission on Google's screen doesn't connect.
    googleGrant = { ok: true, refreshToken: "rt-1", scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.events.readonly"], googleEmail: "rep@vendor.com" };
    const partial = await inject(app, { method: "GET", url: `/lp/google/callback?code=abc&state=${encodeURIComponent(state)}` });
    expect(partial.status).toBe(302);
    expect(String(partial.headers.location)).toContain("google=missing_access");
    expect(String(partial.headers.location)).not.toContain("evil.example");
    expect((await get("/lp/google/status")).json).toMatchObject({ connection: null });

    googleGrant = { ok: true, refreshToken: "rt-secret-1", scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.events.readonly", "https://www.googleapis.com/auth/documents.readonly"], googleEmail: "rep@vendor.com" };
    const done = await inject(app, { method: "GET", url: `/lp/google/callback?code=abc&state=${encodeURIComponent(state)}` });
    expect(String(done.headers.location)).toContain("google=connected");
    expect((await get("/lp/google/status")).json).toMatchObject({ connection: { googleEmail: "rep@vendor.com", status: "connected" } });
    // The token is stored encrypted and never returned; another tenant sees no connection.
    const stored = await pool.query<{ refresh_token: string }>(`SELECT refresh_token FROM lp_google_connections WHERE tenant_id = $1`, [tenantId]);
    expect(stored.rows[0].refresh_token).not.toContain("rt-secret-1");
    expect(JSON.stringify((await get("/lp/google/status")).json)).not.toContain("rt-secret-1");
    expect((await get("/lp/google/status", otherTenantId)).json).toMatchObject({ connection: null });

    // The room reads through the member's connection, not the workspace connector.
    expect((await settings({ allowedDomains: ["mb2dental.com"], calendarConnection: "mine", calendarId: "primary" })).status).toBe(200);
    const when = new Date(Date.now() + 3 * 86_400_000);
    calendarItems = [{ id: "g1", summary: "MB2 kickoff", start: { dateTime: when.toISOString() }, attendees: [{ email: "levi@mb2dental.com" }] }];
    googleGets.length = 0;
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/calendar/sync`, headers: asTenant(tenantId) })).status).toBe(200);
    expect(googleGets[0].url).toContain("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(((await post("state", { pageId })).json as { events: { title: string }[] }).events.map((e) => e.title)).toEqual(["MB2 kickoff"]);
    const detail = (await get(`/lp/partner-rooms/${pageId}`)).json as { calendar: { connection: { googleEmail: string; mine: boolean } } };
    expect(detail.calendar.connection).toMatchObject({ googleEmail: "rep@vendor.com", mine: true });

    // Disconnecting stops the room reading, and keeps what is already there.
    expect((await inject(app, { method: "DELETE", url: `/lp/google/connection`, headers: asTenant(tenantId) })).status).toBe(200);
    expect((await get("/lp/google/status")).json).toMatchObject({ connection: null });
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/calendar/sync`, headers: asTenant(tenantId) })).status).toBe(400);
    expect(((await post("state", { pageId })).json as { events: unknown[] }).events).toHaveLength(1);
    calendarItems = null;
  });

  it("asset engagement carries who it was, and the page's own team is always allowed in", async () => {
    const tenantId = await seedTenant();
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental" } }])]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    const ev = (extra: Record<string, unknown>) => post("asset", { pageId, sessionId: "s-1", assetKey: "one-pager", assetTitle: "Partnership one-pager", assetKind: "pdf", ...extra });

    // Identified visitor, anonymous visitor, and junk: all answer 204, junk stores nothing.
    expect((await ev({ action: "view", hl })).status).toBe(204);
    expect((await ev({ action: "time", value: 95, hl })).status).toBe(204);
    expect((await ev({ action: "download", sessionId: "s-2" })).status).toBe(204);
    expect((await post("asset", { pageId, sessionId: "s-3", assetKey: "x", assetKind: "nope", action: "view" })).status).toBe(204);
    expect((await post("asset", { pageId: 2_000_000_000, sessionId: "s-3", assetKey: "x", assetKind: "pdf", action: "view" })).status).toBe(204);

    const detail = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { engagement: { assets: { key: string; views: number; downloads: number; seconds: number; people: string[]; anonymous: number }[]; recent: { who: string | null; action: string }[] } };
    expect(detail.engagement.assets).toHaveLength(1);
    expect(detail.engagement.assets[0]).toMatchObject({ key: "one-pager", views: 1, downloads: 1, seconds: 95, anonymous: 1 });
    expect(detail.engagement.assets[0].people).toHaveLength(1);
    expect(detail.engagement.recent.some((x) => x.action === "download" && x.who === null)).toBe(true);
    // The public state never carries engagement.
    expect(JSON.stringify((await post("state", { pageId, hl })).json)).not.toContain("engagement");

    // A generated launch asset is filed into the kit by the owning tenant only, and only from this app's storage.
    const kit = (body: unknown, as = tenantId) => inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/kit-asset`, headers: asTenant(as), body });
    const file = { key: "social-image-1", kind: "image", title: "Social graphic, link preview", fileUrl: "/api/storage/objects/uploads/generated-1" };
    expect((await kit({ ...file, fileUrl: "https://evil.example/x.png" })).status).toBe(400);
    expect((await kit(file, await seedTenant())).status).toBe(404);
    expect((await kit(file)).status).toBe(200);
    const withKit = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: asTenant(tenantId) })).json as { kit: { partnerName: string; assets: { key: string; hasFile: boolean }[] } };
    expect(withKit.kit.partnerName).toBe("MB2 Dental");
    expect(withKit.kit.assets).toEqual([expect.objectContaining({ key: "social-image-1", hasFile: true })]);

    // Standard files: set once for the workspace, added to a room, never over a room's own file unless asked.
    const std = () => inject(app, { method: "GET", url: `/lp/room-standard-assets`, headers: asTenant(tenantId) });
    expect(((await std()).json as { assets: { key: string; fileUrl: string | null }[] }).assets.map((x) => [x.key, x.fileUrl])).toEqual([["practice-welcome-guide", null], ["success-guide", null]]);
    const putStd = (key: string, fileUrl: string) => inject(app, { method: "PUT", url: `/lp/room-standard-assets/${key}`, headers: asTenant(tenantId), body: { fileUrl } });
    expect((await putStd("practice-welcome-guide", "https://evil.example/guide.pdf")).status).toBe(400);
    expect((await putStd("not-a-standard-file", "/api/storage/objects/uploads/x")).status).toBe(400);
    expect((await putStd("practice-welcome-guide", "/api/storage/objects/uploads/welcome-v1")).status).toBe(200);
    const addStd = (body: unknown = {}) => inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/standard-assets`, headers: asTenant(tenantId), body });
    expect((await addStd()).json).toMatchObject({ added: ["Practice Welcome Guide"], kept: [], missing: ["Success Guide"] });
    // The workspace file changes; this room keeps what it has until someone replaces it on purpose.
    expect((await putStd("practice-welcome-guide", "/api/storage/objects/uploads/welcome-v2")).status).toBe(200);
    expect((await addStd()).json).toMatchObject({ added: [], kept: ["Practice Welcome Guide"] });
    expect((await addStd({ replace: true })).json).toMatchObject({ added: ["Practice Welcome Guide"] });
    const kitFiles = await pool.query<{ assets: { key: string; fileUrl: string }[] }>(`SELECT blocks->0->'props'->'assets' AS assets FROM lp_pages WHERE id = $1`, [pageId]);
    expect(kitFiles.rows[0].assets.find((x) => x.key === "practice-welcome-guide")?.fileUrl).toBe("/api/storage/objects/uploads/welcome-v2");

    // A member of the page's own team is let in without being on the customer's allowed list; a stranger still has to ask.
    const email = `rep-${Math.floor(Math.random() * 1e9)}@vendor-team.com`;
    await pool.query(`INSERT INTO app_users (tenant_id, email, name, status) VALUES ($1, $2, 'Sam Rep', 'active')`, [tenantId, email]);
    sentEmails.length = 0;
    expect((await post("access", { pageId, email })).json).toMatchObject({ status: "sent" });
    const rt = new URL(sentEmails[0].roomUrl).searchParams.get("rt")!;
    expect(((await post("state", { pageId, rt })).json as { viewer: { name: string } }).viewer).toMatchObject({ name: "Sam Rep" });
    expect((await post("win", { pageId, rt, body: "First 100 cases" })).status).toBe(200);
    expect(((await post("access", { pageId, email: "stranger@elsewhere-co.com" })).json as { status: string }).status).not.toBe("sent");
    await pool.query(`DELETE FROM app_users WHERE email = $1`, [email]);
  });

  it("wins feed: photos, tagging people with an email alert, emoji reactions, and a note to the author on a comment", async () => {
    const tenantId = await seedTenant();
    const blocks = [{ id: "w1", type: "room-workspace", props: { team: [{ title: "Your team", members: [{ name: "Riley Owner", email: "riley@vendor-team.com" }, { name: "No Email" }] }] } }];
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'Feed Room', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `feed-${Math.floor(Math.random() * 1e9)}`, JSON.stringify(blocks)]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    const hl2 = await seedHotlink(tenantId, pageId, "kai@roomco.com");
    await pool.query(`UPDATE sales_contacts SET first_name = 'Kai', last_name = 'Second' WHERE tenant_id = $1 AND email = 'kai@roomco.com'`, [tenantId]);
    type Win = { id: number; body: string; images: string[]; mentions: string[]; reactions: { emoji: string; count: number; mine: boolean }[]; likes: number; liked: boolean; comments: { body: string; mentions: string[] }[] };
    type State = { people: { key: string; name: string; email?: string }[]; wins: Win[] };

    // Who can be tagged: names and opaque keys for a known visitor, nothing for a stranger.
    expect(((await post("state", { pageId })).json as State).people).toEqual([]);
    const people = ((await post("state", { pageId, hl })).json as State).people;
    expect(people.map((p) => p.name)).toEqual(["Dana Visitor", "Kai Second", "Riley Owner"]);
    expect(JSON.stringify(people)).not.toContain("@");
    const riley = people.find((p) => p.name === "Riley Owner")!;
    const dana = people.find((p) => p.name === "Dana Visitor")!;

    // Photos: identity needed, images only, and the post keeps only files we host.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]).toString("base64");
    expect((await post("win-image", { pageId, fileName: "team.png", fileBase64: png })).status).toBe(401);
    expect((await post("win-image", { pageId, hl, fileName: "notes.csv", fileBase64: Buffer.from("a,b").toString("base64") })).status).toBe(400);
    const up = await post("win-image", { pageId, hl, fileName: "team.png", fileBase64: png });
    expect(up.json).toEqual({ ok: true, url: expect.stringMatching(/^\/api\/storage\/objects\/uploads\//) });
    const hosted = "/api/storage/objects/uploads/11111111-2222-3333-4444-555555555555";

    // A post that tags Riley (and tries to tag someone who isn't in the room, and the writer).
    digestEmails.length = 0;
    expect((await post("win", { pageId, hl, body: "Huge week, thank you @Riley Owner and @Dana Visitor 🎉", images: [hosted, "https://elsewhere.example/x.png"], mentions: [riley.key, dana.key, "feedfacefeedface"] })).status).toBe(200);
    await new Promise((res) => setTimeout(res, 20));
    expect(digestEmails.map((e) => e.recipientEmail)).toEqual(["riley@vendor-team.com"]);
    expect(digestEmails[0].subject).toBe("Dana Visitor mentioned you in a win · Feed Room");
    expect(digestEmails[0].html).toContain("Huge week, thank you @Riley Owner");
    let win = ((await post("state", { pageId, hl })).json as State).wins[0];
    expect(win).toMatchObject({ images: [hosted], mentions: ["Riley Owner", "Dana Visitor"], reactions: [], likes: 0 });
    // A key sent without the name in the text tags nobody; a photo can be posted on its own.
    digestEmails.length = 0;
    expect((await post("win", { pageId, hl, body: "No names here", mentions: [riley.key] })).status).toBe(200);
    expect((await post("win", { pageId, hl, body: "", images: [hosted] })).status).toBe(200);
    expect((await post("win", { pageId, hl, body: "" })).status).toBe(400);
    await new Promise((res) => setTimeout(res, 20));
    expect(digestEmails).toEqual([]);
    const all = ((await post("state", { pageId, hl })).json as State).wins;
    expect(all.find((w) => w.body === "No names here")!.mentions).toEqual([]);
    expect(all.find((w) => w.body === "")!.images).toEqual([hosted]);

    // Reactions: each emoji toggles on its own; an emoji we don't offer is refused.
    expect((await post("win/like", { pageId, hl, winId: win.id, emoji: "🎉" })).json).toEqual({ ok: true, liked: true });
    expect((await post("win/like", { pageId, hl, winId: win.id })).json).toEqual({ ok: true, liked: true });
    expect((await post("win/like", { pageId, hl: hl2, winId: win.id, emoji: "🎉" })).json).toEqual({ ok: true, liked: true });
    expect((await post("win/like", { pageId, hl, winId: win.id, emoji: "💩" })).status).toBe(400);
    win = ((await post("state", { pageId, hl })).json as State).wins.find((w) => w.id === win.id)!;
    expect(win.reactions).toEqual([{ emoji: "❤️", count: 1, mine: true }, { emoji: "🎉", count: 2, mine: true }]);
    expect(win).toMatchObject({ likes: 3, liked: true });
    expect((await post("win/like", { pageId, hl, winId: win.id, emoji: "🎉" })).json).toEqual({ ok: true, liked: false });
    const anonWin = ((await post("state", { pageId })).json as State).wins.find((w) => w.id === win.id)!;
    expect(anonWin.reactions).toEqual([{ emoji: "❤️", count: 1, mine: false }, { emoji: "🎉", count: 1, mine: false }]);

    // A comment from someone else tells the author; tagging in a comment emails the person tagged; your own comment emails nobody.
    digestEmails.length = 0;
    expect((await post("win/comment", { pageId, hl: hl2, winId: win.id, body: "Well deserved. @Riley Owner can we share this?", mentions: [riley.key] })).status).toBe(200);
    expect((await post("win/comment", { pageId, hl, winId: win.id, body: "Thanks all" })).status).toBe(200);
    await new Promise((res) => setTimeout(res, 20));
    expect(digestEmails.map((e) => [e.recipientEmail, e.subject]).sort()).toEqual([
      ["dana@roomco.com", "Kai Second commented on your win · Feed Room"],
      ["riley@vendor-team.com", "Kai Second mentioned you in a comment · Feed Room"],
    ]);
    win = ((await post("state", { pageId })).json as State).wins.find((w) => w.id === win.id)!;
    expect(win.comments.map((c) => c.mentions)).toEqual([["Riley Owner"], []]);

    // The team's side can tag too.
    digestEmails.length = 0;
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/wins`, headers: { ...asTenant(tenantId), "x-test-email": "rep@vendor-team.com" }, body: { body: "Welcome aboard @Dana Visitor", mentions: [dana.key], images: [hosted] } })).status).toBe(200);
    await new Promise((res) => setTimeout(res, 20));
    expect(digestEmails.map((e) => e.recipientEmail)).toEqual(["dana@roomco.com"]);
  }, 30_000);

  it("automatic rooms: accounts already on the sheet are recorded, a new one gets a draft room once", async () => {
    const tenantId = await seedTenant();
    const otherTenantId = await seedTenant();
    const auto = (as = tenantId) => inject(app, { method: "GET", url: `/lp/room-autocreate`, headers: asTenant(as) });
    const sync = () => inject(app, { method: "POST", url: `/lp/room-autocreate/sync`, headers: asTenant(tenantId) });
    const head = ["Last Activity", "Account Owner", "Account Name", "", "Contract Signed Date"];

    expect((await sync()).status).toBe(400); // off
    expect((await inject(app, { method: "PUT", url: `/lp/room-autocreate`, headers: asTenant(tenantId), body: { enabled: true, sheet: "not a sheet" } })).status).toBe(400);
    expect((await inject(app, { method: "PUT", url: `/lp/room-autocreate`, headers: asTenant(tenantId), body: { enabled: true, sheet: "https://docs.google.com/spreadsheets/d/1VhE7TbaJD_WTLiVhpZ96qMeH_bhBXKPNpVY7uEhOhRM/edit", tab: "Accounts with MSAs Signed" } })).status).toBe(200);
    await putStdFor(tenantId);

    // First read: both existing accounts are recorded, no room is made.
    sheetValues = [head, ["1/1/2026", "A", "Heartland Dental-HQ", "", "1/14/2026"], ["1/2/2026", "B", "MB2 Dental -HQ", "", "2/2/2026"]];
    expect((await sync()).json).toMatchObject({ ok: true, created: [] });
    const pagesBefore = await pool.query(`SELECT id FROM lp_pages WHERE tenant_id = $1`, [tenantId]);
    expect(pagesBefore.rows).toHaveLength(0);
    expect(((await auto()).json as { accounts: { name: string; pageId: number | null }[] }).accounts.map((a) => [a.name, a.pageId]).sort()).toEqual([["Heartland Dental", null], ["MB2 Dental", null]]);

    // A new account appears (and an old one is re-spelled): exactly one draft room, with its name and the standard guide.
    sheetValues = [head, ["1/1/2026", "A", "Heartland Dental - HQ", "", "1/14/2026"], ["1/2/2026", "B", "MB2 Dental", "", "2/2/2026"], ["3/3/2026", "C", "Southeast Dental Partners- Enterprise DSO Parent", "", "3/4/2026"]];
    const second = (await sync()).json as { created: { name: string; pageId: number }[] };
    expect(second.created.map((c) => c.name)).toEqual(["Southeast Dental Partners"]);
    const made = await pool.query<{ title: string; slug: string; status: string; blocks: { type: string; props: { partnerName: string; assets: { key: string; fileUrl?: string }[] } }[] }>(`SELECT title, slug, status, blocks FROM lp_pages WHERE id = $1 AND tenant_id = $2`, [second.created[0].pageId, tenantId]);
    expect(made.rows[0]).toMatchObject({ title: "Southeast Dental Partners Partner Hub", slug: "southeast-dental-partners-hub", status: "draft" });
    const room = made.rows[0].blocks.find((b) => b.type === "room-workspace")!;
    expect(room.props.partnerName).toBe("Southeast Dental Partners");
    expect(room.props.assets.find((a) => a.key === "practice-welcome-guide")?.fileUrl).toBe("/api/storage/objects/uploads/std-welcome");
    // Reading again makes nothing more; another workspace sees none of it.
    expect(((await sync()).json as { created: unknown[] }).created).toEqual([]);
    expect((await pool.query(`SELECT id FROM lp_pages WHERE tenant_id = $1`, [tenantId])).rows).toHaveLength(1);
    expect(((await auto(otherTenantId)).json as { accounts: unknown[]; enabled: boolean })).toMatchObject({ accounts: [], enabled: false });

    // A test run makes the same draft room for a typed-in name, marked as a test, without touching the list.
    expect((await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { name: "x" } })).status).toBe(400);
    const listBefore = ((await auto()).json as { accounts: unknown[] }).accounts.length;
    const test = (await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { name: "Riverbend Dental Group - HQ" } })).json as { pageId: number; name: string; standardFiles: number };
    expect(test).toMatchObject({ name: "Riverbend Dental Group", standardFiles: 1 });
    const testPage = await pool.query<{ title: string; slug: string; status: string }>(`SELECT title, slug, status FROM lp_pages WHERE id = $1 AND tenant_id = $2`, [test.pageId, tenantId]);
    expect(testPage.rows[0]).toMatchObject({ title: "Riverbend Dental Group Partner Hub (test)", slug: "riverbend-dental-group-test-hub", status: "draft" });
    expect(((await auto()).json as { accounts: unknown[] }).accounts).toHaveLength(listBefore);
    const kitOfTest = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${test.pageId}`, headers: asTenant(tenantId) })).json as { kit: { automatic: boolean; partnerName: string } };
    expect(kitOfTest.kit).toMatchObject({ automatic: true, partnerName: "Riverbend Dental Group" });

    // Follow-ups on a new room: an alert email, a row in the "Digital Sales Rooms" tab, and (only when configured) Salesforce.
    const cfgBody = { enabled: true, sheet: "1VhE7TbaJD_WTLiVhpZ96qMeH_bhBXKPNpVY7uEhOhRM", tab: "Accounts with MSAs Signed" };
    const putCfg = (extra: Record<string, unknown>) => inject(app, { method: "PUT", url: `/lp/room-autocreate`, headers: asTenant(tenantId), body: { ...cfgBody, ...extra } });
    expect((await putCfg({ alertEmails: ["not-an-email"] })).status).toBe(400);
    expect((await putCfg({ sfdcField: "Bad Field!" })).status).toBe(400);
    expect((await putCfg({ alertEmails: ["Ops@Vendor-Team.com"], alertOwner: true, sfdcField: "Digital_Sales_Room__c" })).status).toBe(200);
    expect((await auto()).json).toMatchObject({ alertOwner: true, alertEmails: ["ops@vendor-team.com"], logEnabled: true, logTab: null, sfdcField: "Digital_Sales_Room__c" });
    digestEmails.length = 0;
    connectorCalls.length = 0;
    const withFollowUps = (await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { name: "Follow Up Dental" } })).json as { followUps: { alerts: { sent: string[] }; sheet: { ok: boolean; note: string }; sfdc: { ok: boolean; note: string } } };
    expect(withFollowUps.followUps.alerts.sent).toEqual(["ops@vendor-team.com"]);
    expect(digestEmails[0]).toMatchObject({ recipientEmail: "ops@vendor-team.com", subject: "[Test] New Partner Hub: Follow Up Dental" });
    expect(withFollowUps.followUps.sheet).toEqual({ ok: true, note: "Added to “Digital Sales Rooms”" });
    const writes = connectorCalls.filter((c) => c.connector === "google-sheet" && c.method !== "GET");
    expect(writes.some((c) => c.path.endsWith(":batchUpdate") && c.body.includes("Digital Sales Rooms"))).toBe(true); // the tab is created
    const appended = writes.find((c) => c.path.includes(":append"))!;
    expect(appended.path).toContain("valueInputOption=RAW");
    expect(appended.body).toContain("Follow Up Dental");
    expect(appended.body).toContain("Test run");
    // A test never writes to Salesforce.
    expect(withFollowUps.followUps.sfdc.ok).toBe(true);
    expect(withFollowUps.followUps.sfdc.note).toContain("Skipped on a test");
    // Switched off, nothing is logged or sent.
    expect((await putCfg({ logEnabled: false })).status).toBe(200);
    connectorCalls.length = 0;
    const quiet = (await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { name: "Quiet Dental" } })).json as { followUps: { alerts: unknown; sheet: unknown; sfdc: unknown } };
    expect(quiet.followUps).toEqual({ alerts: null, sheet: null, sfdc: null });
    expect(connectorCalls.filter((c) => c.method !== "GET")).toHaveLength(0);

    // An account that was already on the list can be given a room on request, once.
    const create = (key: string, as = tenantId) => inject(app, { method: "POST", url: `/lp/room-autocreate/create`, headers: asTenant(as), body: { key } });
    expect((await create("mb2-dental", otherTenantId)).status).toBe(404);
    const first = (await create("mb2-dental")).json as { pageId: number };
    expect(first.pageId).toBeGreaterThan(0);
    expect((await create("mb2-dental")).json).toMatchObject({ pageId: first.pageId, existed: true });

    // With an id column and a practices tab set, a new room reads its own practices from the locations tab by Salesforce id.
    expect((await inject(app, { method: "PUT", url: `/lp/room-autocreate`, headers: asTenant(tenantId), body: { enabled: true, sheet: "1VhE7TbaJD_WTLiVhpZ96qMeH_bhBXKPNpVY7uEhOhRM", tab: "Accounts with MSAs Signed", practicesTab: "Sheet14" } })).status).toBe(200);
    // The mock returns one grid for every tab, so this grid serves as both the accounts tab and the locations tab.
    sheetValues = [
      ["Account Name", "Account ID", "Parent Account ID", "Status"],
      ["Heartland Dental", "0015d00000AAAAAAAA", "", ""],
      ["MB2 Dental", "0015d000041HyXrAAK", "", ""],
      ["Southeast Dental Partners", "0015d00000BBBBBAAA", "", ""],
      ["Riverbend Group - Parent", "0015d00000CCCCCAAA", "", ""],
      ["Riverbend Smiles Austin", "", "0015d00000CCCCCAAA", "Ramped"],
      ["Riverbend Smiles Dallas", "", "0015d00000CCCCCAAA", "Onboarding"],
      ["Someone Else's Office", "", "0015d00000ZZZZZAAA", "Ramped"],
    ];
    const third = (await sync()).json as { created: { name: string; pageId: number }[] };
    const river = third.created.find((c) => c.name === "Riverbend Group")!;
    expect(river).toBeTruthy();
    const linked = await pool.query<{ sfdc_account_id: string; practices_sheet_tab: string }>(`SELECT sfdc_account_id, practices_sheet_tab FROM lp_room_settings WHERE page_id = $1`, [river.pageId]);
    expect(linked.rows[0]).toMatchObject({ sfdc_account_id: "0015d00000CCCCCAAA", practices_sheet_tab: "Sheet14" });
    const practices = await pool.query<{ name: string; stage: string }>(`SELECT name, stage FROM lp_room_practices WHERE page_id = $1 ORDER BY name`, [river.pageId]);
    expect(practices.rows).toEqual([{ name: "Riverbend Smiles Austin", stage: "live" }, { name: "Riverbend Smiles Dallas", stage: "training_booked" }]);
    // The id column arriving later also links the room made earlier for Southeast.
    const backfilled = await pool.query<{ sfdc_account_id: string }>(`SELECT sfdc_account_id FROM lp_room_settings WHERE page_id = $1`, [second.created[0].pageId]);
    expect(backfilled.rows[0]?.sfdc_account_id).toBe("0015d00000BBBBBAAA");
    sheetValues = null;
  }, 60_000);

  it("a new room is filled from the account's contacts, the team gets a setup checklist, and contacts can be invited once it is published", async () => {
    const tenantId = await seedTenant();
    const otherTenantId = await seedTenant();
    const acct = await pool.query<{ id: number }>(`INSERT INTO sales_accounts (tenant_id, name, status, domain, salesforce_id) VALUES ($1, 'Cedar Dental-HQ', 'active', 'https://www.cedardental.com/', '0015d00000CEDARAAA') RETURNING id`, [tenantId]);
    const contact = (first: string, last: string, title: string, level: string, email: string) =>
      pool.query(`INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, title, title_level, email, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`, [tenantId, acct.rows[0].id, first, last, title, level, email]);
    await contact("Mia", "Manager", "Regional Manager", "Manager", "mia@cedardental.com");
    await contact("Cal", "Chief", "Chief Operating Officer", "C Suite", "cal@cedardental.com");
    await contact("Out", "Sider", "Consultant", "C Suite", "out@elsewhere.com");
    await contact("Bo", "Bounce", "Director of Ops", "Director", "bounce@cedardental.com");

    const { slackService } = await import("../../lib/slack-service");
    // The workspace's practice-microsite template, and another customer's existing microsite that must not be mistaken for Cedar's.
    await pool.query(`INSERT INTO lp_pages (tenant_id, title, slug, status, is_template, template_label, blocks) VALUES ($1, 'New DSO Partner Practice Microsite Template', $2, 'published', true, 'Practice Microsite', $3::jsonb)`, [tenantId, `tpl-${Date.now()}`, JSON.stringify([{ id: "h", type: "dso-practice-hero", props: { eyebrow: "[dso name]  x dandy", headline: "See why practices trust us" } }])]);
    await pool.query(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'Oak Dental Practices Microsite', $2, 'published', $3::jsonb)`, [tenantId, `oak-practices-${Date.now()}`, JSON.stringify([{ id: "h", type: "dso-practice-hero", props: { eyebrow: "Oak x dandy" } }])]);
    vi.mocked(slackService.postMessage).mockClear();
    const test = (await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { name: "Cedar Dental", owner: "Sam Owner" } })).json as { pageId: number; teamFilled: number; contacts: number; domain: string };
    expect(test).toMatchObject({ teamFilled: 3, contacts: 3, domain: "cedardental.com" });

    // The page: the model cover photo, the customer's people (most senior first, only at their domain), the owner leading our side.
    const page = await pool.query<{ blocks: { type: string; props: { heroImageUrl: string; team: { members: { name: string; role?: string; email?: string }[] }[] } }[] }>(`SELECT blocks FROM lp_pages WHERE id = $1`, [test.pageId]);
    const room = page.rows[0].blocks.find((b) => b.type === "room-workspace")!;
    expect(room.props.heroImageUrl).toBe("/room/default-cover.jpg");
    expect(room.props.team[1].members).toEqual([
      { name: "Cal Chief", role: "Chief Operating Officer", email: "cal@cedardental.com" },
      { name: "Bo Bounce", role: "Director of Ops", email: "bounce@cedardental.com" },
      { name: "Mia Manager", role: "Regional Manager", email: "mia@cedardental.com" },
    ]);
    expect(room.props.team[0].members[0]).toEqual({ name: "Sam Owner", role: "Account owner" });
    const settings = await pool.query<{ allowed_domains: string[] }>(`SELECT allowed_domains FROM lp_room_settings WHERE page_id = $1`, [test.pageId]);
    expect(settings.rows[0].allowed_domains).toEqual(["cedardental.com"]);

    // The practice microsite: none existed for Cedar, so a draft was made from the template with the name filled in, and the hub links to it.
    const made = test as unknown as { practiceSite: { pageId: number; title: string; existing: boolean; status: string; url: string } };
    expect(made.practiceSite).toMatchObject({ title: "Cedar Dental Practices Microsite (test)", existing: false, status: "draft" });
    const sitePage = await pool.query<{ slug: string; status: string; is_template: boolean; sfdc_account_id: string | null; blocks: { props: { eyebrow: string } }[] }>(`SELECT slug, status, is_template, sfdc_account_id, blocks FROM lp_pages WHERE id = $1 AND tenant_id = $2`, [made.practiceSite.pageId, tenantId]);
    expect(sitePage.rows[0]).toMatchObject({ slug: "cedar-dental-practices-test", status: "draft", is_template: false, sfdc_account_id: "0015d00000CEDARAAA" });
    expect(sitePage.rows[0].blocks[0].props.eyebrow).toBe("Cedar Dental  x dandy");
    const hubLinks = (room.props as unknown as { links: { title: string; url: string }[] }).links;
    expect(hubLinks[0].url).toBe(made.practiceSite.url);
    expect(hubLinks[0].url.endsWith("/cedar-dental-practices-test")).toBe(true);

    // The same test run from just the Salesforce ID: the account's real name is used, and an ID nobody knows is refused.
    const byId = await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { sfdcId: "0015d00000CEDAR" } });
    expect(byId.json).toMatchObject({ ok: true, name: "Cedar Dental", teamFilled: 3, domain: "cedardental.com", practices: 0 });
    // This time Cedar already has a microsite (the draft just made): it is found, not made again.
    expect((byId.json as { practiceSite: { pageId: number; existing: boolean } }).practiceSite).toMatchObject({ pageId: made.practiceSite.pageId, existing: true });
    // From an existing hub's launch kit: the same page is found and linked; another workspace can't use it.
    const viaKit = await inject(app, { method: "POST", url: `/lp/partner-rooms/${test.pageId}/practice-site`, headers: asTenant(tenantId), body: {} });
    expect(viaKit.json).toMatchObject({ ok: true, pageId: made.practiceSite.pageId, existing: true, link: { key: "practice-site", url: made.practiceSite.url } });
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${test.pageId}/practice-site`, headers: asTenant(otherTenantId), body: {} })).status).toBe(404);
    const idPage = await pool.query<{ title: string }>(`SELECT title FROM lp_pages WHERE id = $1`, [(byId.json as { pageId: number }).pageId]);
    expect(idPage.rows[0].title).toBe("Cedar Dental Partner Hub (test)");
    expect((await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { sfdcId: "0015d00000NOBODY" } })).status).toBe(400);
    expect((await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(tenantId), body: { sfdcId: "not-an-id" } })).status).toBe(400);
    expect((await inject(app, { method: "POST", url: `/lp/room-autocreate/test`, headers: asTenant(otherTenantId), body: { sfdcId: "0015d00000CEDAR" } })).status).toBe(400); // another workspace doesn't know this account

    // Slack: one message with the link, what was done, and the checklist.
    const slack = JSON.stringify(vi.mocked(slackService.postMessage).mock.calls);
    expect(slack).toContain("Customer team filled in from the account (3 people)");
    expect(slack).toContain("Customer email domain set to cedardental.com");
    expect(slack).toContain("Connect your calendar");
    expect(slack).toContain("3 contacts on the account");
    expect(slack).toContain("Practice microsite drafted from your template");

    // The contacts to invite: this tenant only.
    const contactsOf = (as: number) => inject(app, { method: "GET", url: `/lp/partner-rooms/${test.pageId}/account-contacts`, headers: asTenant(as) });
    expect((await contactsOf(otherTenantId)).status).toBe(404);
    const list = (await contactsOf(tenantId)).json as { found: boolean; contacts: { name: string; email: string; invited: boolean }[] };
    expect(list.contacts.map((c) => c.email)).toEqual(["cal@cedardental.com", "bounce@cedardental.com", "mia@cedardental.com"]);
    expect(list.contacts.every((c) => !c.invited)).toBe(true);

    // Inviting: refused while the room is a draft, and for another workspace.
    const invite = (people: unknown, as = tenantId) => inject(app, { method: "POST", url: `/lp/partner-rooms/${test.pageId}/invite`, headers: { ...asTenant(as), "x-test-email": "rep@vendor.com" }, body: { people, note: "See you at kickoff" } });
    inviteEmails.length = 0; // other tests send invitations too
    expect((await invite([{ email: "cal@cedardental.com", name: "Cal Chief" }])).status).toBe(400);
    expect(inviteEmails).toHaveLength(0);
    await pool.query(`UPDATE lp_pages SET status = 'published' WHERE id = $1`, [test.pageId]);
    expect((await invite([{ email: "cal@cedardental.com" }], otherTenantId)).status).toBe(404);
    expect((await invite([{ email: "nope" }])).status).toBe(400);
    const sent = (await invite([{ email: "Cal@CedarDental.com", name: "Cal Chief" }, { email: "cal@cedardental.com" }, { email: "friend@gmail.com", name: "A Friend" }, { email: "bounce@cedardental.com" }])).json as { ok: boolean; sent: string[]; failed: string[] };
    expect(sent).toEqual({ ok: false, sent: ["cal@cedardental.com", "friend@gmail.com"], failed: ["bounce@cedardental.com"] });
    expect(inviteEmails.find((e) => e.recipientEmail === "cal@cedardental.com")).toMatchObject({ invitedBy: "rep@vendor.com", note: "See you at kickoff" });
    // The emailed link opens the room as that person, even at a free-mail address the domain rule would never allow.
    const friend = inviteEmails.find((e) => e.recipientEmail === "friend@gmail.com")!;
    const state = (await post("state", { pageId: test.pageId, rt: tokenFrom(friend.roomUrl) })).json as { viewer: { email: string } | null };
    expect(state.viewer?.email).toBe("friend@gmail.com");
    expect(((await contactsOf(tenantId)).json as { contacts: { email: string; invited: boolean }[] }).contacts.find((c) => c.email === "cal@cedardental.com")?.invited).toBe(true);
  }, 60_000);

  it("practices: a scanner export fills counts without changing stages, and the list sorts by any column", async () => {
    const tenantId = await seedTenant();
    const r = await pool.query<{ id: number }>(`INSERT INTO lp_pages (tenant_id, title, slug, status, blocks) VALUES ($1, 'WS', $2, 'published', $3::jsonb) RETURNING id`, [tenantId, `ws-${Math.floor(Math.random() * 1e9)}`, JSON.stringify([{ id: "w1", type: "room-workspace", props: { partnerName: "MB2 Dental" } }])]);
    const pageId = r.rows[0].id;
    const hl = await seedHotlink(tenantId, pageId, "dana@roomco.com");
    const imp = (body: unknown) => inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/practices/import`, headers: asTenant(tenantId), body });
    expect((await imp({ csv: "name,region,stage,regional manager\nAlpha Dental,Texas,Live,Dana Ruiz\nBravo Dental,Colorado,Scheduling,Sam Ortiz\nCharlie Dental,Arizona,Trained," })).status).toBe(200);

    // The scanner tracker's export, as a .csv file: matched by name, adds scanner data only.
    const file = "Office,Status,Current Total,Trios 3,Trios 5,Dandy Vision,First Opp,Last Opp\nAlpha Dental,Active,4,1,0,3,2023-03-28,2026-11-13\nCharlie Dental,Active,1,0,1,0,2024-05-21,2026-11-13\n";
    const up = await imp({ fileName: "scanner-export.csv", fileBase64: Buffer.from(file).toString("base64") });
    expect(up.json).toMatchObject({ ok: true, added: 0, updated: 2 });
    expect((await imp({ fileName: "empty.csv", fileBase64: Buffer.from("nothing,here\n1,2\n").toString("base64") })).status).toBe(400);

    const list = async (body: Record<string, unknown>) => (await post("practices", { pageId, hl, ...body })).json as { columns: Record<string, boolean>; rows: { name: string; stage: string; scannerCount: number | null; scannerModels: string | null; regionalManager: string | null }[] };
    const byCount = await list({ sort: "scannerCount", dir: "desc" });
    expect(byCount.rows.map((p) => [p.name, p.scannerCount])).toEqual([["Alpha Dental", 4], ["Charlie Dental", 1], ["Bravo Dental", null]]); // blanks last
    expect(byCount.rows[0]).toMatchObject({ stage: "live", scannerModels: "1 Trios 3 · 3 Dandy Vision", regionalManager: "Dana Ruiz" });
    expect(byCount.rows[1].stage).toBe("trained"); // "Active" in the export did not overwrite the rollout stage
    expect(byCount.columns).toMatchObject({ scannerCount: true, manager: true, scanner: true });
    expect((await list({ sort: "stage", dir: "asc" })).rows.map((p) => p.stage)).toEqual(["scheduling", "trained", "live"]);
    expect((await list({ sort: "regionalManager" })).rows.map((p) => p.name)).toEqual(["Alpha Dental", "Bravo Dental", "Charlie Dental"]);
    // A sort name that isn't a column is ignored rather than trusted.
    expect((await list({ sort: "name; DROP TABLE lp_pages" })).rows).toHaveLength(3);
    const state = (await post("state", { pageId })).json as { practices: { scanners?: { total: number; practices: number } } };
    expect(state.practices.scanners).toEqual({ total: 5, practices: 2 });
  });
  it("Sales Console: a rep makes a hub for an account once, finds it in the list, and sees who visited which section", async () => {
    const tenantId = await seedTenant();
    const otherTenantId = await seedTenant();
    const acct = await pool.query<{ id: number }>(`INSERT INTO sales_accounts (tenant_id, name, status, domain, salesforce_id, owner) VALUES ($1, 'Birch Dental Partners', 'active', 'birchdental.com', '0015d00000BIRCHAAA', 'Sam Owner') RETURNING id`, [tenantId]);
    const accountId = acct.rows[0].id;
    await pool.query(`INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, title, title_level, email, status) VALUES ($1, $2, 'Ana', 'Ruiz', 'COO', 'C Suite', 'ana@birchdental.com', 'active')`, [tenantId, accountId]);
    const rep = { ...asTenant(tenantId), "x-test-email": "rep@dandy.example", "x-test-name": "Riley Rep" };

    // The picker: the account is there, with no hub yet. Another workspace cannot see or use it.
    const find = async (headers: Record<string, string>, qs: string) => ((await inject(app, { method: "GET", url: `/lp/partner-hub-accounts?${qs}`, headers })).json as { accounts: { id: number; name: string; hubPageId: number | null }[] }).accounts;
    expect(await find(rep, "q=birch")).toEqual([expect.objectContaining({ id: accountId, hubPageId: null })]);
    expect(await find(asTenant(otherTenantId), "q=birch")).toEqual([]);
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms`, headers: asTenant(otherTenantId), body: { accountId } })).status).toBe(404);
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms`, headers: rep, body: { accountId: "x" } })).status).toBe(404);

    // Create: a draft hub tied to the account; asking again hands back the same one.
    const made = await inject(app, { method: "POST", url: `/lp/partner-rooms`, headers: rep, body: { accountId } });
    expect(made.status).toBe(200);
    const pageId = (made.json as { pageId: number }).pageId;
    expect(made.json).toMatchObject({ ok: true });
    expect((made.json as { existed?: boolean }).existed).toBeUndefined();
    const again = await inject(app, { method: "POST", url: `/lp/partner-rooms`, headers: rep, body: { accountId } });
    expect(again.json).toMatchObject({ pageId, existed: true });
    const row = await pool.query<{ status: string; account_id: number; sfdc_account_id: string; updated_by: string; title: string }>(`SELECT status, account_id, sfdc_account_id, updated_by, title FROM lp_pages WHERE id = $1`, [pageId]);
    expect(row.rows[0]).toMatchObject({ status: "draft", account_id: accountId, sfdc_account_id: "0015d00000BIRCHAAA", updated_by: "rep@dandy.example", title: "Birch Dental Partners Partner Hub" });
    expect((await find(rep, `id=${accountId}`))[0].hubPageId).toBe(pageId);

    // The list: the rep's own, a draft, nothing waiting on us. The owner sees it as theirs too; a third person does not.
    type Hub = { pageId: number; name: string; status: string; url: string; mine: boolean; account: { id: number; owner: string } | null; waitingOnCustomer: number; waitingOnUs: number; views30: number; people30: number; lastVisitAt: string | null };
    const list = async (headers: Record<string, string>) => ((await inject(app, { method: "GET", url: `/lp/partner-rooms`, headers })).json as { hubs: Hub[] }).hubs;
    const mine = (await list(rep)).find((h) => h.pageId === pageId)!;
    expect(mine).toMatchObject({ name: "Birch Dental Partners", status: "draft", url: "", mine: true, account: { id: accountId, owner: "Sam Owner" }, waitingOnUs: 0, people30: 0, lastVisitAt: null });
    expect(mine.waitingOnCustomer).toBeGreaterThan(0);
    expect((await list({ ...asTenant(tenantId), "x-test-email": "sam@dandy.example", "x-test-name": "Sam Owner" })).find((h) => h.pageId === pageId)!.mine).toBe(true);
    expect((await list({ ...asTenant(tenantId), "x-test-email": "other@dandy.example", "x-test-name": "Other Person" })).find((h) => h.pageId === pageId)!.mine).toBe(false);
    expect(await list(asTenant(otherTenantId))).toEqual([]);

    // Setup: nothing done on a fresh draft except the team that was filled in from the account.
    const setup = (await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}/setup`, headers: rep })).json as { status: string; setup: { key: string; done: boolean }[] };
    expect(setup.status).toBe("draft");
    expect(Object.fromEntries(setup.setup.map((i) => [i.key, i.done]))).toMatchObject({ logo: false, team: true, publish: false, invite: false });
    expect((await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}/setup`, headers: asTenant(otherTenantId) })).status).toBe(404);

    // Visits. The hub asks for an email, so a stranger's section view is not recorded; a recognised customer's is, by name.
    await pool.query(`UPDATE lp_pages SET status = 'published' WHERE id = $1`, [pageId]);
    const view = (extra: Record<string, unknown>) => post("view", { pageId, sessionId: "sess-birch-1", viewId: "view-birch-0001", module: "overview", seconds: 0, ...extra });
    expect((await view({})).status).toBe(204);
    expect((await pool.query(`SELECT 1 FROM lp_room_views WHERE page_id = $1`, [pageId])).rowCount).toBe(0);
    await post("access", { pageId, email: "ana@birchdental.com", path: "/birch" });
    const rt = tokenFrom(sentEmails.filter((e) => e.recipientEmail === "ana@birchdental.com").pop()!.roomUrl);

    // The Slack note is off until the team ticks it.
    const { slackService } = await import("../../lib/slack-service");
    vi.mocked(slackService.postMessage).mockClear();
    await view({ rt });
    expect(vi.mocked(slackService.postMessage)).not.toHaveBeenCalled();
    await pool.query(`DELETE FROM lp_room_views WHERE page_id = $1`, [pageId]);
    const saved = await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: rep, body: { visitAlert: true } });
    expect(saved.json).toMatchObject({ visitAlert: true, allowedDomains: ["birchdental.com"] });
    expect(((await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}`, headers: rep })).json as { visitAlert: boolean }).visitAlert).toBe(true);

    // First arrival posts once; leaving the section updates the same row; the next section does not post again.
    await view({ rt });
    await view({ rt, seconds: 40 });
    await view({ rt, seconds: 12 }); // a late, smaller report never shrinks the time
    await view({ rt, viewId: "view-birch-0002", module: "practices", seconds: 0 });
    await view({ rt, viewId: "view-birch-0002", module: "practices", seconds: 90 });
    const slackTexts = vi.mocked(slackService.postMessage).mock.calls.map((c) => JSON.stringify(c[1]));
    expect(slackTexts.filter((t) => t.includes("Partner Hub visit"))).toHaveLength(1);
    expect(slackTexts.find((t) => t.includes("Partner Hub visit"))).toContain("Ana Ruiz");
    // The page's own team is never counted, and junk is dropped.
    expect((await inject(app, { method: "POST", url: `/lp/room/view`, headers: rep, body: { pageId, sessionId: "sess-team-01", viewId: "view-team-0001", module: "overview", seconds: 5 } })).status).toBe(204);
    expect((await view({ rt, viewId: "bad id", module: "overview" })).status).toBe(204);
    const stored = await pool.query<{ view_id: string; module: string; seconds: number; viewer_email: string; viewer_name: string }>(`SELECT view_id, module, seconds, viewer_email, viewer_name FROM lp_room_views WHERE page_id = $1 ORDER BY id`, [pageId]);
    expect(stored.rows).toEqual([
      { view_id: "view-birch-0001", module: "overview", seconds: 40, viewer_email: "ana@birchdental.com", viewer_name: "Ana Ruiz" },
      { view_id: "view-birch-0002", module: "practices", seconds: 90, viewer_email: "ana@birchdental.com", viewer_name: "Ana Ruiz" },
    ]);

    const perf = await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}/performance`, headers: rep });
    expect(perf.json).toMatchObject({ windowDays: 30, visits: 1, visitors: 1, named: 1, anonymous: 0, seconds: 130 });
    const p = perf.json as { people: { email: string; visits: number; modules: { module: string }[] }[]; modules: { module: string; opens: number }[]; days: unknown[]; trackedSince: string | null };
    expect(p.people[0]).toMatchObject({ email: "ana@birchdental.com", visits: 1 });
    expect(p.people[0].modules.map((m) => m.module)).toEqual(["practices", "overview"]);
    expect(p.days).toHaveLength(30);
    expect(p.trackedSince).toBeTruthy();
    expect((await inject(app, { method: "GET", url: `/lp/partner-rooms/${pageId}/performance`, headers: asTenant(otherTenantId) })).status).toBe(404);

    // "Add your team" must show everyone who is already in. Ana is on the Team list, so she is not repeated; someone invited
    // by name keeps that name; someone let in by address alone gets a readable one; a visitor who just signed in sees themself.
    type Listed = { id: number; name: string; email: string; invited?: boolean };
    const listed = async (token: string) => ((await post("state", { pageId, rt: token })).json as { contacts: Listed[] }).contacts;
    expect(await listed(rt)).toEqual([]);
    expect((await inject(app, { method: "POST", url: `/lp/partner-rooms/${pageId}/invite`, headers: rep, body: { people: [{ name: "Dee Dunn", email: "dd@birchdental.com" }, { email: "ana@birchdental.com", name: "Ana Ruiz" }] } })).status).toBe(200);
    await pool.query(`INSERT INTO lp_room_members (tenant_id, page_id, email, status) VALUES ($1, $2, 'kim.lee@birchdental.com', 'allowed')`, [tenantId, pageId]);
    const afterInvite = await listed(rt);
    expect(afterInvite.map((c) => [c.name, c.email, !!c.invited])).toEqual([
      ["Dee Dunn", "dd@birchdental.com", false],
      ["Kim Lee", "kim.lee@birchdental.com", true],
    ]);
    expect(afterInvite[1].id).toBeLessThan(0);
    await post("access", { pageId, email: "zed.fox@birchdental.com", path: "/birch" });
    const zed = tokenFrom(sentEmails.filter((e) => e.recipientEmail === "zed.fox@birchdental.com").pop()!.roomUrl);
    expect((await listed(zed)).map((c) => c.name)).toEqual(["Dee Dunn", "Kim Lee", "Zed Fox"]);
    // A stranger still learns nothing.
    expect(((await post("state", { pageId })).json as { contacts: unknown[] }).contacts).toEqual([]);

    // Back in the list: live, with a link, one person, a last visit.
    const live = (await list(rep)).find((h) => h.pageId === pageId)!;
    expect(live).toMatchObject({ status: "live", people30: 1 });
    expect(live.url).toContain(row.rows[0].title ? "birch-dental-partners-hub" : "");
    expect(live.lastVisitAt).toBeTruthy();
  }, 60_000);
});
