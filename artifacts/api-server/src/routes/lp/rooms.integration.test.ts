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
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { Readable } from "stream";
import { dbAvailable } from "../../test-utils/dbAvailable";

const stored = new Map<string, Buffer>();
const sentEmails: { recipientEmail: string; roomUrl: string }[] = [];

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
vi.mock("../../lib/notifications", () => ({
  sendRoomAccessEmail: vi.fn(async (p: { recipientEmail: string; roomUrl: string }) => {
    sentEmails.push(p);
    return true;
  }),
  sendRoomDigestEmail: vi.fn(async (p: { recipientEmail: string; subject: string; html: string }) => {
    digestEmails.push(p);
    return true;
  }),
}));
vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    async proxy() {
      return sheetValues ? { ok: true, json: async () => ({ values: sheetValues }) } : { ok: false, status: 403, text: async () => "forbidden" };
    }
  },
}));
vi.mock("../../lib/slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));

import { pool } from "@workspace/db";
import { inject } from "../../test-utils/injectRequest";
import { __clearRecordedAsanaCalls, __getRecordedAsanaCalls } from "../../lib/asana";
import roomsRouter from "./rooms";

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
const asTenant = (tenantId: number) => ({ "x-test-tenant": String(tenantId), "content-type": "application/json" });
const XLSX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("roster-bytes")]);
const tokenFrom = (url: string) => decodeURIComponent(url.split("?rt=")[1]);

beforeAll(() => {
  app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: unknown }).log = { error: () => {}, warn: () => {}, info: () => {} };
    const t = req.header("x-test-tenant");
    if (t) (req as unknown as { authUser: unknown }).authUser = { userId: 1, tenantId: Number(t) };
    next();
  });
  app.use(roomsRouter);
});

afterAll(async () => {
  for (const id of tenants) {
    await pool.query(`DELETE FROM lp_room_win_likes WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_room_win_comments WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [id]).catch(() => {});
    for (const table of ["lp_room_practices", "lp_room_wins", "lp_room_contacts", "lp_room_choices", "lp_room_requests", "lp_room_uploads", "lp_room_task_state", "lp_room_members", "lp_room_settings", "sales_hotlinks", "sales_contacts", "sales_accounts", "lp_pages"]) {
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
    expect(state.json).toEqual({ viewer: null, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], practices: { total: 0, byStage: {}, regions: [] } });
    expect((await post("state", { pageId: 2_000_000_000 })).json).toEqual({ viewer: null, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], practices: { total: 0, byStage: {}, regions: [] } });
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
    expect(anon.json).toEqual({ viewer: null, tasks: { announce: { done: true, at: expect.any(String) } }, requests: [], choices: {}, wins: [], contacts: [], practices: { total: 0, byStage: {}, regions: [] } });
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
    expect(s1.contacts).toEqual([expect.objectContaining({ name: "Sam Rivera", email: "sam@roomco.com" })]);
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
    expect(((await post("state", { pageId, hl })).json as { contacts: unknown[] }).contacts).toEqual([]);
  });

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
    expect(anon.practices).toEqual({ total: 4, byStage: { live: 1, trained: 1, scheduling: 1, not_started: 1 }, regions: ["Colorado", "North Texas"] });
    expect((await post("practices", { pageId })).status).toBe(401);
    const all = (await post("practices", { pageId, hl })).json as { total: number; rows: { name: string; stage: string }[] };
    expect(all.total).toBe(4);
    const tx = (await post("practices", { pageId, hl, region: "North Texas" })).json as { total: number; rows: { name: string; stage: string }[] };
    expect(tx.rows.map((p) => `${p.name}:${p.stage}`)).toEqual(["Lakeside Family:trained", "Main Street Dental:live"]);
    expect(((await post("practices", { pageId, hl, q: "summit" })).json as { total: number }).total).toBe(1);

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

    // Settings: Salesforce and Asana ids are validated.
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], sfdcAccountId: "not an id" } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], asanaProjectGid: "abc" } })).status).toBe(400);
    expect((await inject(app, { method: "PATCH", url: `/lp/partner-rooms/${pageId}/settings`, headers: asTenant(tenantId), body: { allowedDomains: [], sfdcAccountId: "0015d000041HyXrAAK", asanaProjectGid: "1212539527149031" } })).json).toMatchObject({ sfdcAccountId: "0015d000041HyXrAAK", asanaProjectGid: "1212539527149031" });
  });

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
    expect(raised.json).toMatchObject({ ok: true, name: "RevOps - MB2 Dental - Add 1 child account to Salesforce" });
    const call = __getRecordedAsanaCalls().find((c) => c.tenantId === tenantId)!;
    expect(call.payload.name).toBe("RevOps - MB2 Dental - Add 1 child account to Salesforce");
    expect(String(call.payload.notes)).toContain("- Brand New Dental");
    expect(call.payload.intakeStatus).not.toBe("submitted"); // not a marketing request
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
});
