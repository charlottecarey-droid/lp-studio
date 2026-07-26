/**
 * Pins the agenda-builder flow end to end against real Postgres:
 *
 *   1. POST /events/:id/agendas runs deterministic matching — role-tagged
 *      sessions are picked, slot conflicts resolve to the higher score,
 *      reserved slots are always pinned.
 *   2. POST /agendas/:id/publish renders ONE `event-agenda` block onto a new
 *      lp_page with the account name in the headline and sessions grouped by
 *      day; the agenda row records lp_page_id + published status.
 *   3. Republishing UPDATES the same page (stable share URL, no duplicate).
 *   4. Session re-import upserts by source_key instead of duplicating, and
 *      keeps tags that were edited in-app.
 *
 * Auth: routes read req.authUser via getTenantId, so the test app injects a
 * minimal authUser for the seeded tenant instead of running the full cookie
 * stack.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import { pool } from "@workspace/db";
import { inject } from "../../test-utils/injectRequest";
import eventsRouter from "./events";

const TENANT_SLUG = `it-agenda-flow-${Date.now()}`;

let tenantId: number;
let accountId: number;
let eventId: number;
let app: Express;

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM sales_event_agendas WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM sales_event_sessions WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM sales_events WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  }
}

beforeAll(async () => {
  if (!dbAvailable) return;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Agenda Flow Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  const a = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, industry, abm_tier)
     VALUES ($1, 'Evergreen Dental Group', 'Dental', 'Tier 1')
     RETURNING id`,
    [tenantId],
  );
  accountId = a.rows[0].id;

  app = express();
  app.use(express.json());
  // Minimal auth hydration — getTenantId only reads authUser.tenantId here.
  app.use((req, _res, next) => {
    req.authUser = { tenantId } as typeof req.authUser;
    next();
  });
  app.use(eventsRouter);

  const eventRes = await inject(app, {
    method: "POST",
    url: "/events",
    body: { name: "Summit 2026", location: "Austin, TX", startDate: "2026-10-20", endDate: "2026-10-21" },
  });
  expect(eventRes.status).toBe(200);
  eventId = (eventRes.json as { event: { id: number } }).event.id;

  // Catalog: two conflicting 9am sessions (role-tagged beats industry-only),
  // a reserved dinner with no tags, and a day-2 session.
  const sessions = [
    { title: "Industry only", day: "2026-10-20", startTime: "09:00", endTime: "10:00", tags: { industries: ["Dental"] } },
    { title: "Role and industry", day: "2026-10-20", startTime: "09:30", endTime: "10:30", tags: { roles: ["COO"], industries: ["Dental"] } },
    { title: "Welcome dinner", day: "2026-10-20", startTime: "18:30", endTime: "20:00", isReservedSlot: true },
    { title: "Day two roundtable", day: "2026-10-21", startTime: "10:00", endTime: "11:00", tags: { roles: ["COO"] } },
    { title: "Irrelevant workshop", day: "2026-10-21", startTime: "14:00", endTime: "15:00", tags: { roles: ["BIM/VDC"] } },
  ];
  for (const s of sessions) {
    const res = await inject(app, { method: "POST", url: `/events/${eventId}/sessions`, body: s });
    expect(res.status).toBe(200);
  }
}, 30_000);

afterAll(async () => {
  await cleanup();
});

describe.skipIf(!dbAvailable)("agenda builder flow", () => {
  let agendaId: number;
  let firstSlug: string;

  it("matches role-tagged sessions, resolves conflicts, pins reserved slots", async () => {
    const res = await inject(app, {
      method: "POST",
      url: `/events/${eventId}/agendas`,
      body: { accountId, attendeeRoles: ["COO"] },
    });
    expect(res.status).toBe(200);
    const { agenda, match } = res.json as { agenda: { id: number; selections: { sessionId: number }[] }; match: { considered: unknown[] } };
    agendaId = agenda.id;

    const pickedTitles = await titlesFor(agenda.selections.map((s: { sessionId: number }) => s.sessionId));
    // Conflict at 9am → "Role and industry" (score 5) beats "Industry only" (2);
    // dinner is pinned despite zero tags; irrelevant workshop is left out.
    expect(pickedTitles).toEqual([
      "Role and industry",
      "Welcome dinner",
      "Day two roundtable",
    ]);
    // Every considered session carries a score entry for the swap UI.
    expect(match.considered).toHaveLength(5);
  });

  it("publishes ONE event-agenda block grouped by day, personalized to the account", async () => {
    const res = await inject(app, { method: "POST", url: `/agendas/${agendaId}/publish` });
    expect(res.status).toBe(200);
    const { slug, url, pageId } = res.json as { slug: string; url: string; pageId: number };
    firstSlug = slug;
    expect(url).toBe(`/lp/${slug}`);

    const { rows } = await pool.query<{ blocks: { type: string; props: Record<string, unknown> }[] }>(
      `SELECT blocks FROM lp_pages WHERE id = $1 AND tenant_id = $2`,
      [pageId, tenantId],
    );
    expect(rows).toHaveLength(1);
    const blocks = rows[0].blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("event-agenda");

    const props = blocks[0].props as {
      headline: string;
      accountName: string;
      days: { label: string; sessions: { title: string; isReserved?: boolean }[] }[];
    };
    expect(props.accountName).toBe("Evergreen Dental Group");
    expect(props.headline).toContain("Evergreen Dental Group");
    expect(props.days).toHaveLength(2);
    expect(props.days[0].sessions.map((s) => s.title)).toEqual(["Role and industry", "Welcome dinner"]);
    expect(props.days[0].sessions[1].isReserved).toBe(true);

    const agendaRow = await pool.query<{ status: string; lp_page_id: number }>(
      `SELECT status, lp_page_id FROM sales_event_agendas WHERE id = $1`,
      [agendaId],
    );
    expect(agendaRow.rows[0].status).toBe("published");
    expect(agendaRow.rows[0].lp_page_id).toBe(pageId);
  });

  it("republish updates the same page — the share URL never changes", async () => {
    const res = await inject(app, { method: "POST", url: `/agendas/${agendaId}/publish` });
    expect(res.status).toBe(200);
    expect((res.json as { slug: string }).slug).toBe(firstSlug);

    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM lp_pages WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it("re-import upserts by source key and preserves in-app tag edits", async () => {
    // Manual session creation marks tags edited-in-app; re-import the same
    // (title, day, start) with different tags + a room — room updates, tags don't.
    const importRes = await inject(app, {
      method: "POST",
      url: `/events/${eventId}/sessions/import`,
      body: {
        rows: [
          { title: "Role and industry", day: "2026-10-20", startTime: "09:30", room: "Salon B", tags: { roles: ["CFO"] } },
          { title: "Brand new session", day: "2026-10-21", startTime: "16:00", tags: { roles: ["COO"] } },
        ],
      },
    });
    expect(importRes.status).toBe(200);
    expect(importRes.json).toMatchObject({ created: 1, updated: 1 });

    const { rows } = await pool.query<{ room: string | null; tags: { roles?: string[] } }>(
      `SELECT room, tags FROM sales_event_sessions
       WHERE event_id = $1 AND title = 'Role and industry'`,
      [eventId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].room).toBe("Salon B");           // source field updated
    expect(rows[0].tags.roles).toEqual(["COO"]);    // in-app tag edit preserved
  });
});

async function titlesFor(sessionIds: number[]): Promise<string[]> {
  if (sessionIds.length === 0) return [];
  const { rows } = await pool.query<{ id: number; title: string }>(
    `SELECT id, title FROM sales_event_sessions WHERE id = ANY($1::int[])`,
    [sessionIds],
  );
  const byId = new Map(rows.map((r) => [r.id, r.title]));
  return sessionIds.map((id) => byId.get(id) ?? `missing-${id}`);
}
