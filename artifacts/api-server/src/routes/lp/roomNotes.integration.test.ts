/**
 * Saved Partner Hub notes (Nov 2026): GET / POST (a name in use updates that
 * note) / DELETE /lp/room-notes, workspace-scoped. Runs on ephemeral Postgres,
 * or on a test database via LP_IT_DATABASE_URL (marker-guarded).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, pgBinariesAvailable, type EphemeralPg } from "../../test-utils/ephemeralPg";

// Hermetic suite — builds its own throwaway cluster from the local Postgres
// binaries, so gate on those (NOT the Neon TCP probe). Probed at module scope
// because the top-level beforeAll runs even when the describe is skipped.
// Or a disposable database already on the current schema (a Neon test branch): set
// LP_IT_DATABASE_URL. It must hold a zz_test_branch_marker table, so a production
// URL can never be used by mistake.
const externalDb = process.env.LP_IT_DATABASE_URL ?? "";
const localPg = !!externalDb || pgBinariesAvailable();

type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-rn-${randomUUID()}`;
let tenantId: number;

function resolveLibDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "lib", "db");
    if (existsSync(path.join(candidate, "drizzle.config.ts"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate lib/db from " + process.cwd());
}

const SID_B = `it-rn-b-${randomUUID()}`;
let tenantB: number;

function call(method: string, url: string, body?: unknown, sid = SID): Promise<InjectResponse> {
  return inject(app, { method, url, headers: { cookie: `${SESSION_COOKIE}=${sid}` }, ...(body === undefined ? {} : { body }) });
}

async function session(sid: string, tenant: number, userId: number) {
  const sess = JSON.stringify({ userId, email: `it-rn-${userId}@example.test`, name: "IT", avatarUrl: null, tenantId: tenant, role: "admin", permissions: {}, isAdmin: true, appUserRole: null });
  await pgMod.pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sess],
  );
}

beforeAll(async () => {
  if (!localPg) return;
  if (externalDb) {
    process.env.NEON_DATABASE_URL = externalDb;
    process.env.DATABASE_URL = externalDb;
  } else {
    epg = startEphemeralPg();
    process.env.NEON_DATABASE_URL = epg.connectionString;
    process.env.DATABASE_URL = epg.connectionString;
    const push = spawnSync("npx", ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"], { cwd: resolveLibDbDir(), encoding: "utf8", env: process.env });
    if (push.status !== 0) throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }
  pgMod = await import("@workspace/db");
  if (externalDb) {
    const marker = await pgMod.pool.query(`SELECT to_regclass('public.zz_test_branch_marker') IS NOT NULL AS ok`);
    if (!marker.rows[0]?.ok) throw new Error("LP_IT_DATABASE_URL has no zz_test_branch_marker table: refusing to run against it");
  }
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const notesRouter = (await import("./roomNotes")).default;
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(notesRouter);
  const mk = async (label: string) => {
    const uniq = randomUUID().slice(0, 8);
    const t = await pgMod.pool.query<{ id: number }>(
      `INSERT INTO tenants (name, slug, status, plan, settings) VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb) RETURNING id`,
      [`IT RoomNotes ${label} ${uniq}`, `it-rn-${label}-${uniq}`],
    );
    return t.rows[0].id;
  };
  tenantId = await mk("a");
  tenantB = await mk("b");
  await session(SID, tenantId, 990001401);
  await session(SID_B, tenantB, 990001402);
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

describe.skipIf(!localPg)("saved Partner Hub notes API", () => {
  const kickoff = { title: "Let's book your kickoff call", body: "Hi {first name},\n\nPick a time.", items: [{ title: "Book your kickoff call", url: "{booking link}" }] };

  it("saves a note, lists it, and saving the same name again (any case) updates it", async () => {
    const first = await call("POST", "/lp/room-notes", { name: "Book your kickoff call", note: kickoff });
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({ updated: false, note: { name: "Book your kickoff call", note: { title: kickoff.title } } });
    const again = await call("POST", "/lp/room-notes", { name: "book your KICKOFF call", note: { ...kickoff, title: "Kickoff time" } });
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ updated: true, note: { name: "book your KICKOFF call", note: { title: "Kickoff time" } } });
    const list = (await call("GET", "/lp/room-notes")).json as { notes: { name: string }[] };
    expect(list.notes.map((n) => n.name)).toEqual(["book your KICKOFF call"]);
  });

  it("refuses an empty note", async () => {
    expect((await call("POST", "/lp/room-notes", { name: "Empty", note: { title: " " } })).status).toBe(400);
  });

  it("each workspace sees and deletes only its own notes", async () => {
    await call("POST", "/lp/room-notes", { name: "Lab tour invite", note: { title: "You're invited" } });
    const theirs = (await call("GET", "/lp/room-notes", undefined, SID_B)).json as { notes: unknown[] };
    expect(theirs.notes).toEqual([]);
    const mine = (await call("GET", "/lp/room-notes")).json as { notes: { id: number; name: string }[] };
    const lab = mine.notes.find((n) => n.name === "Lab tour invite")!;
    expect((await call("DELETE", `/lp/room-notes/${lab.id}`, undefined, SID_B)).status).toBe(404);
    expect((await call("DELETE", `/lp/room-notes/${lab.id}`)).status).toBe(200);
    const after = (await call("GET", "/lp/room-notes")).json as { notes: { name: string }[] };
    expect(after.notes.map((n) => n.name)).not.toContain("Lab tour invite");
  });

  it("needs a signed-in workspace member", async () => {
    const res = await inject(app, { method: "GET", url: "/lp/room-notes" });
    expect([401, 403]).toContain(res.status);
  });
});
