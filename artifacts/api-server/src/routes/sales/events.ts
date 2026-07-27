import { Router } from "express";
import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesEventsTable,
  salesEventSessionsTable,
  salesEventAgendasTable,
  salesAccountsTable,
  lpPagesTable,
  lpPageVisitsTable,
  lpLeadsTable,
  lpBrandSettingsTable,
  type SalesEventSession,
  type AgendaSelection,
  type EventSessionTags,
  type EventSessionSpeaker,
} from "@workspace/db";
import { fieldAccessor, isTestLead } from "@workspace/lead-utils";
import { getTenantId } from "../../middleware/requireAuth";
import { getSalesBrandContext } from "../../lib/salesBrandContext";
import {
  matchAgendaSessions,
  catalogRoleOptions,
  sessionSourceKey,
  type MatchableSession,
} from "../../lib/sales/agenda-matching";
import { importAgendaFromUrl, AgendaImportError } from "../../lib/sales/agenda-import";
import { generateWhyAttendBlurbs } from "../../lib/sales/agenda-blurbs";
import { suggestSessionRoleTags } from "../../lib/sales/agenda-tagging";
import { isSafePublicHost } from "../../lib/brand-import/net-guard";
import { AIChatError } from "../../lib/ai-utils";

const router = Router();

// ─── Conference agenda builder (July 2026) ───────────────────────────────────
// A tenant enters an event's session catalog once (CSV/manual; URL scrape is
// phase 2), then assembles a per-account agenda: deterministic tag matching
// proposes sessions, the rep adjusts, publish renders an `event-agenda`
// full-page lp_page at a share link. Selections live on sales_event_agendas
// (not only in page props) so re-matching, PDF export, and analytics all work
// from the same row.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

/** "2026-10-20" → "Tuesday, Oct 20" (UTC-noon anchor avoids TZ day drift). */
function formatDayLabel(day: string | null): string {
  if (!day) return "Schedule";
  const d = new Date(`${day}T12:00:00Z`);
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "09:00" → "9:00 AM"; passthrough for anything unparseable. */
function formatTime(hhmm: string | null): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = parseInt(m[1], 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

function formatTimeRange(start: string | null, end: string | null): string {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

/** "2026-03-10".."2026-03-12" → "Mar 10–12, 2026" (best-effort). */
function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(`${start}T12:00:00Z`);
  if (isNaN(s.getTime())) return "";
  const startLabel = s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const year = s.getUTCFullYear();
  if (!end || end === start) return `${startLabel}, ${year}`;
  const e = new Date(`${end}T12:00:00Z`);
  if (isNaN(e.getTime())) return `${startLabel}, ${year}`;
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const endLabel = sameMonth
    ? String(e.getUTCDate())
    : e.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${startLabel}–${endLabel}, ${year}`;
}

function toMatchable(s: SalesEventSession): MatchableSession {
  return {
    id: s.id,
    title: s.title,
    day: s.day,
    startTime: s.startTime,
    endTime: s.endTime,
    isReservedSlot: s.isReservedSlot,
    tags: (s.tags ?? {}) as MatchableSession["tags"],
    sessionType: s.sessionType,
  };
}

/**
 * Buyer-persona roles from brand settings, used only to SEED the AI tagger's
 * vocabulary (the catalog's own roles come first). Best-effort: a tenant with
 * no personas just gets a smaller vocabulary. Reads both config shapes —
 * top-level and nested under "brand" — like getSalesBrandContext does.
 */
async function loadBrandPersonaRoles(tenantId: number): Promise<string[]> {
  try {
    const [row] = await db
      .select({ config: lpBrandSettingsTable.config })
      .from(lpBrandSettingsTable)
      .where(eq(lpBrandSettingsTable.tenantId, tenantId))
      .limit(1);
    const config = (row?.config ?? {}) as Record<string, unknown>;
    const nested = (config["brand"] ?? {}) as Record<string, unknown>;
    const segments = (nested["segments"] ?? config["segments"]) as unknown;
    const roles: string[] = [];
    if (Array.isArray(segments)) {
      for (const seg of segments) {
        const personas = (seg as { personas?: unknown })?.personas;
        if (!Array.isArray(personas)) continue;
        for (const p of personas) {
          const role = (p as { role?: unknown })?.role;
          if (typeof role === "string" && role.trim()) roles.push(role.trim());
        }
      }
    }
    return roles;
  } catch {
    return [];
  }
}

async function loadEvent(tenantId: number, eventId: number) {
  const [event] = await db
    .select()
    .from(salesEventsTable)
    .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)));
  return event ?? null;
}

async function loadEventSessions(tenantId: number, eventId: number): Promise<SalesEventSession[]> {
  return db
    .select()
    .from(salesEventSessionsTable)
    .where(and(eq(salesEventSessionsTable.tenantId, tenantId), eq(salesEventSessionsTable.eventId, eventId)))
    .orderBy(asc(salesEventSessionsTable.day), asc(salesEventSessionsTable.startTime), asc(salesEventSessionsTable.title));
}

// ─── Events CRUD ─────────────────────────────────────────────────────────────

router.get("/events", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const rows = await db.execute(sql`
      SELECT e.*,
        (SELECT COUNT(*)::int FROM sales_event_sessions s WHERE s.event_id = e.id) AS session_count,
        (SELECT COUNT(*)::int FROM sales_event_agendas a WHERE a.event_id = e.id) AS agenda_count
      FROM sales_events e
      WHERE e.tenant_id = ${tenantId}
      ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC
    `);
    res.json({ events: rows.rows });
  } catch (err) {
    console.error("[sales/events] list error", err);
    res.status(500).json({ error: "Failed to list events" });
  }
});

router.post("/events", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { name, location, startDate, endDate, description, sourceUrl } = req.body as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [event] = await db.insert(salesEventsTable).values({
      tenantId,
      name: name.trim(),
      location: typeof location === "string" ? location : null,
      startDate: typeof startDate === "string" && startDate ? startDate : null,
      endDate: typeof endDate === "string" && endDate ? endDate : null,
      description: typeof description === "string" ? description : null,
      sourceUrl: typeof sourceUrl === "string" ? sourceUrl : null,
      createdBy: (req as { authUser?: { email?: string } }).authUser?.email ?? null,
    }).returning();
    res.json({ event });
  } catch (err) {
    console.error("[sales/events] create error", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

router.get("/events/:eventId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    const sessions = await loadEventSessions(tenantId, eventId);
    // roleOptions = the role vocabulary this catalog actually uses, most-used
    // first. The builder offers these as chips so a picked role can genuinely
    // match something (brand personas often use different words entirely).
    res.json({ event, sessions, roleOptions: catalogRoleOptions(sessions.map(toMatchable)) });
  } catch (err) {
    console.error("[sales/events] get error", err);
    res.status(500).json({ error: "Failed to load event" });
  }
});

router.patch("/events/:eventId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const { name, location, startDate, endDate, description, sourceUrl, status } = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) patch.name = name.trim();
    if (location !== undefined) patch.location = typeof location === "string" ? location : null;
    if (startDate !== undefined) patch.startDate = typeof startDate === "string" && startDate ? startDate : null;
    if (endDate !== undefined) patch.endDate = typeof endDate === "string" && endDate ? endDate : null;
    if (description !== undefined) patch.description = typeof description === "string" ? description : null;
    if (sourceUrl !== undefined) patch.sourceUrl = typeof sourceUrl === "string" ? sourceUrl : null;
    if (typeof status === "string" && ["draft", "active", "archived"].includes(status)) patch.status = status;
    if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
    const [event] = await db
      .update(salesEventsTable)
      .set(patch)
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)))
      .returning();
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    res.json({ event });
  } catch (err) {
    console.error("[sales/events] patch error", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

router.delete("/events/:eventId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const [deleted] = await db
      .delete(salesEventsTable)
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)))
      .returning({ id: salesEventsTable.id });
    if (!deleted) { res.status(404).json({ error: "Event not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error("[sales/events] delete error", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ─── Session catalog ─────────────────────────────────────────────────────────

function parseSessionBody(body: Record<string, unknown>): {
  title?: string;
  description: string | null;
  day: string | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  sessionType: string | null;
  track: string | null;
  speakers: EventSessionSpeaker[];
  tags: EventSessionTags;
  isReservedSlot: boolean;
} {
  const speakers = Array.isArray(body.speakers)
    ? (body.speakers as unknown[])
        .map((s) => {
          const obj = (s ?? {}) as Record<string, unknown>;
          if (typeof obj.name !== "string" || !obj.name.trim()) return null;
          return {
            name: obj.name.trim(),
            title: typeof obj.title === "string" ? obj.title : undefined,
            org: typeof obj.org === "string" ? obj.org : undefined,
          } as EventSessionSpeaker;
        })
        .filter((s): s is EventSessionSpeaker => s !== null)
    : [];
  const rawTags = (body.tags ?? {}) as Record<string, unknown>;
  const tags: EventSessionTags = {
    roles: asStringArray(rawTags.roles),
    industries: asStringArray(rawTags.industries),
    topics: asStringArray(rawTags.topics),
    tiers: asStringArray(rawTags.tiers),
  };
  return {
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined,
    description: typeof body.description === "string" ? body.description : null,
    day: typeof body.day === "string" && body.day ? body.day : null,
    startTime: typeof body.startTime === "string" && body.startTime ? body.startTime : null,
    endTime: typeof body.endTime === "string" && body.endTime ? body.endTime : null,
    room: typeof body.room === "string" ? body.room : null,
    sessionType: typeof body.sessionType === "string" ? body.sessionType : null,
    track: typeof body.track === "string" ? body.track : null,
    speakers,
    tags,
    isReservedSlot: body.isReservedSlot === true,
  };
}

router.post("/events/:eventId/sessions", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    const parsed = parseSessionBody(req.body as Record<string, unknown>);
    if (!parsed.title) { res.status(400).json({ error: "title is required" }); return; }
    const [session] = await db.insert(salesEventSessionsTable).values({
      eventId,
      tenantId,
      title: parsed.title,
      description: parsed.description,
      day: parsed.day,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      room: parsed.room,
      sessionType: parsed.sessionType,
      track: parsed.track,
      speakers: parsed.speakers,
      tags: parsed.tags,
      // Manual entry counts as in-app authorship: a later re-import must not
      // clobber what a human typed.
      tagsEditedInApp: true,
      isReservedSlot: parsed.isReservedSlot,
      sourceKey: sessionSourceKey(parsed.title, parsed.day, parsed.startTime),
    }).returning();
    res.json({ session });
  } catch (err) {
    console.error("[sales/events] session create error", err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.patch("/events/:eventId/sessions/:sessionId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(eventId) || isNaN(sessionId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const body = req.body as Record<string, unknown>;
    const parsed = parseSessionBody(body);
    const patch: Record<string, unknown> = {};
    if (parsed.title) patch.title = parsed.title;
    if (body.description !== undefined) patch.description = parsed.description;
    if (body.day !== undefined) patch.day = parsed.day;
    if (body.startTime !== undefined) patch.startTime = parsed.startTime;
    if (body.endTime !== undefined) patch.endTime = parsed.endTime;
    if (body.room !== undefined) patch.room = parsed.room;
    if (body.sessionType !== undefined) patch.sessionType = parsed.sessionType;
    if (body.track !== undefined) patch.track = parsed.track;
    if (body.speakers !== undefined) patch.speakers = parsed.speakers;
    if (body.isReservedSlot !== undefined) patch.isReservedSlot = parsed.isReservedSlot;
    if (body.tags !== undefined) {
      patch.tags = parsed.tags;
      patch.tagsEditedInApp = true; // re-imports keep hands off from now on
    }
    if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
    const [session] = await db
      .update(salesEventSessionsTable)
      .set(patch)
      .where(and(
        eq(salesEventSessionsTable.tenantId, tenantId),
        eq(salesEventSessionsTable.eventId, eventId),
        eq(salesEventSessionsTable.id, sessionId),
      ))
      .returning();
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    res.json({ session });
  } catch (err) {
    console.error("[sales/events] session patch error", err);
    res.status(500).json({ error: "Failed to update session" });
  }
});

router.delete("/events/:eventId/sessions/:sessionId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(eventId) || isNaN(sessionId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [deleted] = await db
      .delete(salesEventSessionsTable)
      .where(and(
        eq(salesEventSessionsTable.tenantId, tenantId),
        eq(salesEventSessionsTable.eventId, eventId),
        eq(salesEventSessionsTable.id, sessionId),
      ))
      .returning({ id: salesEventSessionsTable.id });
    if (!deleted) { res.status(404).json({ error: "Session not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error("[sales/events] session delete error", err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

/**
 * Bulk session import (CSV parsed client-side → rows array, matching the
 * contacts import contract). Upserts by source_key (slug of title+day+start)
 * so re-imports update times/rooms without duplicating; rows whose tags were
 * edited in-app keep those tags.
 */
router.post("/events/:eventId/sessions/import", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    const { rows } = req.body as { rows?: unknown[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "rows array is required and must not be empty" });
      return;
    }
    if (rows.length > 2000) {
      res.status(400).json({ error: "Too many rows (max 2000)" });
      return;
    }

    const result = await upsertSessionRows(tenantId, eventId, rows);
    res.json(result);
  } catch (err) {
    console.error("[sales/events] session import error", err);
    res.status(500).json({ error: "Failed to import sessions" });
  }
});

/**
 * Shared upsert for both import doors (CSV rows and URL extraction). Matches
 * rows to existing sessions by source_key (title+day+start); updates refresh
 * source fields but never clobber tags edited in-app.
 */
async function upsertSessionRows(
  tenantId: number,
  eventId: number,
  rows: unknown[],
): Promise<{ created: number; updated: number; errors: { row: number; error: string }[] }> {
  const existing = await loadEventSessions(tenantId, eventId);
  const bySourceKey = new Map(existing.filter((s) => s.sourceKey).map((s) => [s.sourceKey as string, s]));

  let created = 0;
  let updated = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = parseSessionBody((rows[i] ?? {}) as Record<string, unknown>);
    if (!parsed.title) {
      errors.push({ row: i + 1, error: "Missing title" });
      continue;
    }
    const sourceKey = sessionSourceKey(parsed.title, parsed.day, parsed.startTime);
    const prior = bySourceKey.get(sourceKey);
    if (prior) {
      await db
        .update(salesEventSessionsTable)
        .set({
          title: parsed.title,
          description: parsed.description ?? prior.description,
          day: parsed.day ?? prior.day,
          startTime: parsed.startTime ?? prior.startTime,
          endTime: parsed.endTime ?? prior.endTime,
          room: parsed.room ?? prior.room,
          sessionType: parsed.sessionType ?? prior.sessionType,
          track: parsed.track ?? prior.track,
          speakers: parsed.speakers.length > 0 ? parsed.speakers : prior.speakers,
          // In-app tag edits win over re-imported values.
          ...(prior.tagsEditedInApp ? {} : { tags: parsed.tags }),
        })
        .where(eq(salesEventSessionsTable.id, prior.id));
      updated++;
    } else {
      const [inserted] = await db.insert(salesEventSessionsTable).values({
        eventId,
        tenantId,
        title: parsed.title,
        description: parsed.description,
        day: parsed.day,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        room: parsed.room,
        sessionType: parsed.sessionType,
        track: parsed.track,
        speakers: parsed.speakers,
        tags: parsed.tags,
        isReservedSlot: parsed.isReservedSlot,
        sourceKey,
      }).returning();
      bySourceKey.set(sourceKey, inserted);
      created++;
    }
  }

  return { created, updated, errors };
}

/**
 * URL import (phase 2): scrape a public agenda page (JS-rendered via
 * Firecrawl), LLM-extract sessions, and upsert through the same source_key
 * path as CSV import — re-running against an updated agenda page refreshes
 * times/rooms without duplicating or clobbering in-app tag edits.
 *
 * SSRF: user-pasted URL — scheme + isSafePublicHost validation is mandatory
 * here (the firecrawl-lockdown contract for URL-ingest routes).
 */
router.post("/events/:eventId/import", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const { url } = req.body as { url?: unknown };
    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      res.status(400).json({ error: "That doesn't look like a valid URL" });
      return;
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      res.status(400).json({ error: "Only http(s) URLs can be imported" });
      return;
    }
    if (!(await isSafePublicHost(parsedUrl.hostname))) {
      res.status(400).json({ error: "That host can't be reached from here" });
      return;
    }

    const imported = await importAgendaFromUrl(parsedUrl.toString(), {
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
    });
    if (imported.rows.length === 0) {
      res.status(422).json({ error: "No sessions were found on that page. If the agenda is behind a login or a calendar widget, use the CSV import instead." });
      return;
    }

    const result = await upsertSessionRows(tenantId, eventId, imported.rows as unknown[]);
    await db
      .update(salesEventsTable)
      .set({ sourceUrl: parsedUrl.toString() })
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)));

    res.json({ ...result, extracted: imported.rows.length, truncated: imported.truncated });
  } catch (err) {
    if (err instanceof AgendaImportError) {
      const status = err.code === "scrape_not_configured" ? 503 : err.code === "page_empty" ? 422 : 502;
      res.status(status).json({ error: err.message });
      return;
    }
    console.error("[sales/events] url import error", err);
    res.status(500).json({ error: "Failed to import from that URL" });
  }
});

// ─── Agendas ─────────────────────────────────────────────────────────────────

router.get("/events/:eventId/agendas", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const rows = await db
      .select({
        agenda: salesEventAgendasTable,
        accountName: salesAccountsTable.name,
        accountDisplayName: salesAccountsTable.displayName,
        pageSlug: lpPagesTable.slug,
      })
      .from(salesEventAgendasTable)
      .leftJoin(salesAccountsTable, eq(salesEventAgendasTable.accountId, salesAccountsTable.id))
      .leftJoin(lpPagesTable, eq(salesEventAgendasTable.lpPageId, lpPagesTable.id))
      .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.eventId, eventId)))
      .orderBy(desc(salesEventAgendasTable.updatedAt));
    res.json({
      agendas: rows.map((r) => ({
        ...r.agenda,
        accountName: r.accountDisplayName || r.accountName || r.agenda.accountNameSnapshot,
        pageUrl: r.pageSlug ? `/lp/${r.pageSlug}` : null,
      })),
    });
  } catch (err) {
    console.error("[sales/events] agendas list error", err);
    res.status(500).json({ error: "Failed to list agendas" });
  }
});

/**
 * Create a draft agenda for an account: run deterministic matching over the
 * event's catalog and store the proposed selections. Response includes the
 * full scored `considered` list so the builder UI can offer swaps.
 */
router.post("/events/:eventId/agendas", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const { accountId, attendeeRoles } = req.body as { accountId?: unknown; attendeeRoles?: unknown };
    if (typeof accountId !== "number" || !Number.isFinite(accountId)) {
      res.status(400).json({ error: "accountId is required" });
      return;
    }
    const [account] = await db
      .select()
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, accountId)));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const roles = asStringArray(attendeeRoles);
    const sessions = await loadEventSessions(tenantId, eventId);
    const match = matchAgendaSessions(sessions.map(toMatchable), account, roles);

    const [agenda] = await db.insert(salesEventAgendasTable).values({
      eventId,
      tenantId,
      accountId,
      accountNameSnapshot: account.displayName || account.name,
      attendeeRoles: roles,
      selections: match.selected.map((s) => ({ sessionId: s.sessionId })),
      createdBy: (req as { authUser?: { email?: string } }).authUser?.email ?? null,
    }).returning();

    res.json({ agenda, match });
  } catch (err) {
    console.error("[sales/events] agenda create error", err);
    res.status(500).json({ error: "Failed to create agenda" });
  }
});

async function loadAgenda(tenantId: number, agendaId: number) {
  const [agenda] = await db
    .select()
    .from(salesEventAgendasTable)
    .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.id, agendaId)));
  return agenda ?? null;
}

router.get("/agendas/:agendaId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const agendaId = parseInt(req.params.agendaId, 10);
    if (isNaN(agendaId)) { res.status(400).json({ error: "Invalid agendaId" }); return; }
    const agenda = await loadAgenda(tenantId, agendaId);
    if (!agenda) { res.status(404).json({ error: "Agenda not found" }); return; }
    const sessions = await loadEventSessions(tenantId, agenda.eventId);
    const account = agenda.accountId
      ? (await db
          .select()
          .from(salesAccountsTable)
          .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, agenda.accountId))))[0] ?? null
      : null;
    // Re-score on every load so the swap UI always reflects the live catalog.
    const match = matchAgendaSessions(sessions.map(toMatchable), account ?? {}, (agenda.attendeeRoles ?? []) as string[]);
    let pageSlug: string | null = null;
    if (agenda.lpPageId) {
      const [page] = await db
        .select({ slug: lpPagesTable.slug })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, agenda.lpPageId)));
      pageSlug = page?.slug ?? null;
    }
    res.json({
      agenda,
      sessions,
      account,
      scores: match.considered,
      pageUrl: pageSlug ? `/lp/${pageSlug}` : null,
    });
  } catch (err) {
    console.error("[sales/events] agenda get error", err);
    res.status(500).json({ error: "Failed to load agenda" });
  }
});

router.patch("/agendas/:agendaId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const agendaId = parseInt(req.params.agendaId, 10);
    if (isNaN(agendaId)) { res.status(400).json({ error: "Invalid agendaId" }); return; }
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.selections !== undefined) {
      if (!Array.isArray(body.selections)) { res.status(400).json({ error: "selections must be an array" }); return; }
      const selections: AgendaSelection[] = (body.selections as unknown[])
        .map((s) => {
          const obj = (s ?? {}) as Record<string, unknown>;
          if (typeof obj.sessionId !== "number") return null;
          return {
            sessionId: obj.sessionId,
            blurbOverride: typeof obj.blurbOverride === "string" && obj.blurbOverride.trim()
              ? obj.blurbOverride
              : undefined,
          } as AgendaSelection;
        })
        .filter((s): s is AgendaSelection => s !== null);
      patch.selections = selections;
    }
    if (body.attendeeRoles !== undefined) patch.attendeeRoles = asStringArray(body.attendeeRoles);
    if (body.personalNote !== undefined) patch.personalNote = typeof body.personalNote === "string" ? body.personalNote : null;
    if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
    const [agenda] = await db
      .update(salesEventAgendasTable)
      .set(patch)
      .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.id, agendaId)))
      .returning();
    if (!agenda) { res.status(404).json({ error: "Agenda not found" }); return; }
    res.json({ agenda });
  } catch (err) {
    console.error("[sales/events] agenda patch error", err);
    res.status(500).json({ error: "Failed to update agenda" });
  }
});

router.delete("/agendas/:agendaId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const agendaId = parseInt(req.params.agendaId, 10);
    if (isNaN(agendaId)) { res.status(400).json({ error: "Invalid agendaId" }); return; }
    const [deleted] = await db
      .delete(salesEventAgendasTable)
      .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.id, agendaId)))
      .returning({ id: salesEventAgendasTable.id });
    if (!deleted) { res.status(404).json({ error: "Agenda not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error("[sales/events] agenda delete error", err);
    res.status(500).json({ error: "Failed to delete agenda" });
  }
});

/**
 * Re-run matching against the current catalog (after catalog edits or role
 * changes). Keeps blurb overrides for sessions that stay selected.
 */
router.post("/agendas/:agendaId/rematch", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const agendaId = parseInt(req.params.agendaId, 10);
    if (isNaN(agendaId)) { res.status(400).json({ error: "Invalid agendaId" }); return; }
    const agenda = await loadAgenda(tenantId, agendaId);
    if (!agenda) { res.status(404).json({ error: "Agenda not found" }); return; }
    const account = agenda.accountId
      ? (await db
          .select()
          .from(salesAccountsTable)
          .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, agenda.accountId))))[0] ?? null
      : null;
    const sessions = await loadEventSessions(tenantId, agenda.eventId);
    const match = matchAgendaSessions(sessions.map(toMatchable), account ?? {}, (agenda.attendeeRoles ?? []) as string[]);
    const priorBlurbs = new Map(((agenda.selections ?? []) as AgendaSelection[]).map((s) => [s.sessionId, s.blurbOverride]));
    const selections: AgendaSelection[] = match.selected.map((s) => ({
      sessionId: s.sessionId,
      blurbOverride: priorBlurbs.get(s.sessionId),
    }));
    const [updated] = await db
      .update(salesEventAgendasTable)
      .set({ selections })
      .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.id, agendaId)))
      .returning();
    res.json({ agenda: updated, match });
  } catch (err) {
    console.error("[sales/events] agenda rematch error", err);
    res.status(500).json({ error: "Failed to rematch agenda" });
  }
});

/**
 * AI why-attend blurbs (phase 2): draft one grounded "why this matters for
 * {account}" line per selected session. By default only sessions WITHOUT a
 * blurb are filled (rep edits are never overwritten); pass force:true to
 * redraft everything. The rep reviews/edits in the agenda editor before
 * publish — nothing here goes straight to the page.
 */
/**
 * AI role tagging for a catalog (phase 2 follow-up). Most imported agendas
 * arrive untagged, which left role matching with nothing to intersect. This
 * infers each session's audience from its own title/description/track and
 * writes `tags.roles`.
 *
 * Only sessions WITHOUT roles are tagged by default, and rows whose tags were
 * edited in-app are never touched unless `force` is set — the same authorship
 * rule the CSV/URL import upsert follows. The model is seeded with the roles
 * already in use (catalog first, then brand personas) so it reuses that
 * vocabulary instead of inventing a competing one.
 */
router.post("/events/:eventId/suggest-tags", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    const force = (req.body as { force?: unknown })?.force === true;

    const sessions = await loadEventSessions(tenantId, eventId);
    const targets = sessions.filter((s) => {
      if (!force && s.tagsEditedInApp) return false;
      const roles = ((s.tags ?? {}) as EventSessionTags).roles ?? [];
      return force || roles.length === 0;
    });
    if (targets.length === 0) {
      res.json({ tagged: 0, skipped: sessions.length, roleOptions: catalogRoleOptions(sessions.map(toMatchable)) });
      return;
    }

    // Vocabulary the tenant already uses: the catalog's own roles first (those
    // are what the builder offers as chips), then brand personas.
    const catalogRoles = catalogRoleOptions(sessions.map(toMatchable)).map((r) => r.role);
    const brandRoles = await loadBrandPersonaRoles(tenantId);
    const vocabulary = [...new Set([...catalogRoles, ...brandRoles])].slice(0, 30);

    const suggestions = await suggestSessionRoleTags(
      targets.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        sessionType: s.sessionType,
        track: s.track,
      })),
      vocabulary,
    );

    let tagged = 0;
    let leftOpen = 0;
    for (const [sessionId, roles] of suggestions) {
      if (roles.length === 0) { leftOpen++; continue; }
      const prior = targets.find((t) => t.id === sessionId);
      if (!prior) continue;
      const priorTags = (prior.tags ?? {}) as EventSessionTags;
      await db
        .update(salesEventSessionsTable)
        // NOT tagsEditedInApp — these are machine suggestions, so a later
        // re-import may still refresh them; a human edit locks them.
        .set({ tags: { ...priorTags, roles } })
        .where(and(
          eq(salesEventSessionsTable.tenantId, tenantId),
          eq(salesEventSessionsTable.id, sessionId),
        ));
      tagged++;
    }

    const refreshed = await loadEventSessions(tenantId, eventId);
    res.json({
      tagged,
      leftOpen,
      considered: targets.length,
      roleOptions: catalogRoleOptions(refreshed.map(toMatchable)),
    });
  } catch (err) {
    if (err instanceof AIChatError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error("[sales/events] suggest-tags error", err);
    res.status(500).json({ error: "Failed to suggest tags" });
  }
});

router.post("/agendas/:agendaId/generate-blurbs", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const agendaId = parseInt(req.params.agendaId, 10);
    if (isNaN(agendaId)) { res.status(400).json({ error: "Invalid agendaId" }); return; }
    const agenda = await loadAgenda(tenantId, agendaId);
    if (!agenda) { res.status(404).json({ error: "Agenda not found" }); return; }
    const force = (req.body as { force?: unknown })?.force === true;

    const account = agenda.accountId
      ? (await db
          .select()
          .from(salesAccountsTable)
          .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, agenda.accountId))))[0] ?? null
      : null;

    const sessions = await loadEventSessions(tenantId, agenda.eventId);
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const selections = (agenda.selections ?? []) as AgendaSelection[];
    const targets = selections
      .filter((sel) => (force || !sel.blurbOverride?.trim()) && byId.has(sel.sessionId))
      .map((sel) => {
        const s = byId.get(sel.sessionId) as SalesEventSession;
        return {
          id: s.id,
          title: s.title,
          description: s.description,
          sessionType: s.sessionType,
          track: s.track,
          roles: ((s.tags ?? {}) as EventSessionTags).roles ?? [],
        };
      });
    if (targets.length === 0) {
      res.json({ agenda, generated: 0 });
      return;
    }

    const blurbs = await generateWhyAttendBlurbs(
      {
        name: account?.displayName || account?.name || agenda.accountNameSnapshot || "the account",
        industry: account?.industry,
        segment: account?.segment,
        abmTier: account?.abmTier,
        numLocations: account?.numLocations,
        city: account?.city,
        state: account?.state,
      },
      (agenda.attendeeRoles ?? []) as string[],
      targets,
    );

    const nextSelections: AgendaSelection[] = selections.map((sel) => {
      const drafted = blurbs.get(sel.sessionId);
      if (!drafted) return sel;
      if (sel.blurbOverride?.trim() && !force) return sel;
      return { ...sel, blurbOverride: drafted };
    });

    const [updated] = await db
      .update(salesEventAgendasTable)
      .set({ selections: nextSelections })
      .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.id, agendaId)))
      .returning();

    res.json({ agenda: updated, generated: blurbs.size });
  } catch (err) {
    if (err instanceof AIChatError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error("[sales/events] generate-blurbs error", err);
    res.status(500).json({ error: "Failed to draft blurbs" });
  }
});

// ─── Publish ─────────────────────────────────────────────────────────────────

/**
 * Publish (or republish) the agenda as an lp_page built from the
 * `event-agenda` full-page block. First publish inserts and stores lp_page_id
 * on the agenda; later publishes update the same page so the share link never
 * changes.
 */
router.post("/agendas/:agendaId/publish", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const agendaId = parseInt(req.params.agendaId, 10);
    if (isNaN(agendaId)) { res.status(400).json({ error: "Invalid agendaId" }); return; }
    const agenda = await loadAgenda(tenantId, agendaId);
    if (!agenda) { res.status(404).json({ error: "Agenda not found" }); return; }
    const event = await loadEvent(tenantId, agenda.eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const account = agenda.accountId
      ? (await db
          .select()
          .from(salesAccountsTable)
          .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, agenda.accountId))))[0] ?? null
      : null;
    const accountName = account?.displayName || account?.name || agenda.accountNameSnapshot || "Your team";

    const sessions = await loadEventSessions(tenantId, agenda.eventId);
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const selections = ((agenda.selections ?? []) as AgendaSelection[])
      .map((sel) => {
        const session = byId.get(sel.sessionId);
        return session ? { session, blurb: sel.blurbOverride } : null;
      })
      .filter((s): s is { session: SalesEventSession; blurb: string | undefined } => s !== null);
    if (selections.length === 0) {
      res.status(400).json({ error: "Agenda has no sessions selected" });
      return;
    }

    // Group picked sessions by day, chronologically (selections are stored in
    // rep-chosen order; day grouping keeps the page scannable regardless).
    const dayKeys = [...new Set(selections.map((s) => s.session.day ?? ""))].sort();
    const days = dayKeys.map((dayKey) => ({
      label: formatDayLabel(dayKey || null),
      // Machine date + times ride along for the block's .ics download; the
      // editorial `time`/`label` strings stay the rendered truth.
      date: dayKey,
      sessions: selections
        .filter((s) => (s.session.day ?? "") === dayKey)
        .map(({ session, blurb }) => ({
          time: formatTimeRange(session.startTime, session.endTime),
          startTime: session.startTime ?? "",
          endTime: session.endTime ?? "",
          title: session.title,
          room: session.room ?? "",
          sessionType: session.sessionType ?? "",
          track: session.track ?? "",
          description: session.description ?? "",
          whyAttend: blurb ?? "",
          speakers: ((session.speakers ?? []) as EventSessionSpeaker[]).map((sp) => ({
            name: sp.name,
            title: [sp.title, sp.org].filter(Boolean).join(", "),
          })),
          isReserved: session.isReservedSlot,
        })),
    }));

    const brandCtx = await getSalesBrandContext(tenantId);
    const eyebrowParts = [event.name, event.location, formatDateRange(event.startDate, event.endDate)].filter(Boolean);

    // Tenant's saved block default for event-agenda (Block Defaults /
    // governance editor writes lp_block_defaults). Publish layers props as
    // canned fallbacks → SAVED DEFAULT → per-account fields, so a tenant's
    // saved palette, section toggles, linked RSVP form, and house copy apply
    // to every published agenda, while the per-account data (headline, days,
    // note, counts) always wins. Best-effort: a missing row changes nothing.
    let savedDefaultProps: Record<string, unknown> = {};
    let savedDefaultSettings: Record<string, unknown> = {};
    try {
      const defaults = await db.execute(
        sql`SELECT props, block_settings FROM lp_block_defaults
            WHERE tenant_id = ${tenantId} AND block_type = 'event-agenda'`,
      );
      const row = defaults.rows[0] as { props?: unknown; block_settings?: unknown } | undefined;
      if (row?.props && typeof row.props === "object") {
        // The Block Defaults editor snapshots the WHOLE prop object, sample
        // schedule included — strip the per-account/per-event fields so stale
        // sample content can never shadow the published agenda's own data.
        const {
          days: _days, eyebrow: _eyebrow, headline: _headline, accountName: _accountName,
          eventName: _eventName, eventLocation: _eventLocation, eventDates: _eventDates,
          personalNote: _personalNote, sessionCount: _sessionCount,
          accountLogoUrl: _accountLogoUrl, accountLogoAlt: _accountLogoAlt,
          ...styleAndSettings
        } = row.props as Record<string, unknown>;
        savedDefaultProps = styleAndSettings;
      }
      if (row?.block_settings && typeof row.block_settings === "object") {
        savedDefaultSettings = row.block_settings as Record<string, unknown>;
      }
    } catch (defaultsErr) {
      console.warn("[sales/events] block-defaults lookup failed (publishing without)", String(defaultsErr));
    }

    const blockProps = {
      // Canned fallbacks — a saved default overrides any of these.
      subheadline: `A schedule curated for your team — every session picked for ${accountName}.`,
      showRsvp: true,
      rsvpHeading: `Confirm your spot at ${event.name}`,
      ctaHeadline: "Questions before the event?",
      ctaSubheadline: "Your account team is one message away.",
      ctaText: "Get in touch",
      ctaUrl: brandCtx.chilipiperUrl || brandCtx.defaultCtaUrl || "#",

      // Tenant governance default (colors, toggles, rsvpFormId, house copy).
      ...savedDefaultProps,

      // Per-account data — always wins.
      eyebrow: eyebrowParts.join(" · "),
      headline: `${accountName}, your agenda is ready`,
      accountName,
      eventName: event.name,
      eventLocation: event.location ?? "",
      eventDates: formatDateRange(event.startDate, event.endDate),
      personalNote: agenda.personalNote ?? "",
      days,
      sessionCount: selections.length,
    };

    const block = {
      id: `event-agenda-${makeId()}`,
      type: "event-agenda",
      blockSettings: savedDefaultSettings,
      props: blockProps,
    };

    const title = `${accountName} — ${event.name} Agenda`;

    if (agenda.lpPageId) {
      const [page] = await db
        .update(lpPagesTable)
        .set({ title, blocks: [block] as unknown as typeof lpPagesTable.$inferInsert["blocks"], status: "published" })
        .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, agenda.lpPageId)))
        .returning({ id: lpPagesTable.id, slug: lpPagesTable.slug });
      if (page) {
        await db
          .update(salesEventAgendasTable)
          .set({ status: "published", publishedAt: new Date() })
          .where(eq(salesEventAgendasTable.id, agenda.id));
        res.json({ pageId: page.id, slug: page.slug, url: `/lp/${page.slug}` });
        return;
      }
      // Page was deleted out from under us (lp_page_id is SET NULL on delete,
      // but guard against races) — fall through to a fresh insert.
    }

    const baseSlug = `agenda-${slugify(accountName)}-${slugify(event.name)}`;
    let finalSlug = baseSlug;
    // Slug conflicts are scoped per tenant (mirrors web-one-pager).
    for (let attempt = 1; attempt <= 20; attempt++) {
      const conflict = await db
        .select({ id: lpPagesTable.id })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, finalSlug)))
        .limit(1);
      if (conflict.length === 0) break;
      finalSlug = `${baseSlug}-${attempt}`;
    }

    const [page] = await db.insert(lpPagesTable).values({
      tenantId,
      title,
      slug: finalSlug,
      status: "published",
      blocks: [block] as unknown as typeof lpPagesTable.$inferInsert["blocks"],
    }).returning({ id: lpPagesTable.id, slug: lpPagesTable.slug });

    await db
      .update(salesEventAgendasTable)
      .set({ status: "published", publishedAt: new Date(), lpPageId: page.id })
      .where(eq(salesEventAgendasTable.id, agenda.id));

    res.json({ pageId: page.id, slug: page.slug, url: `/lp/${page.slug}` });
  } catch (err) {
    console.error("[sales/events] agenda publish error", err);
    res.status(500).json({ error: "Failed to publish agenda" });
  }
});

// ─── Per-event analytics rollup (phase 3) ────────────────────────────────────
// One call answers "is this event program working": per-agenda page traffic
// (lp_page_visits — server-stamped on the public serve path), lead + RSVP
// counts (lp_leads; RSVPs are the event-agenda block's inline form, stamped
// Source="Agenda RSVP"), and which catalog sessions reps actually pick.
router.get("/events/:eventId/analytics", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const agendaRows = await db
      .select({
        id: salesEventAgendasTable.id,
        accountId: salesEventAgendasTable.accountId,
        accountNameSnapshot: salesEventAgendasTable.accountNameSnapshot,
        selections: salesEventAgendasTable.selections,
        status: salesEventAgendasTable.status,
        lpPageId: salesEventAgendasTable.lpPageId,
        publishedAt: salesEventAgendasTable.publishedAt,
        accountDisplayName: salesAccountsTable.displayName,
        accountName: salesAccountsTable.name,
        slug: lpPagesTable.slug,
      })
      .from(salesEventAgendasTable)
      .leftJoin(
        salesAccountsTable,
        and(eq(salesAccountsTable.id, salesEventAgendasTable.accountId), eq(salesAccountsTable.tenantId, tenantId)),
      )
      .leftJoin(
        lpPagesTable,
        and(eq(lpPagesTable.id, salesEventAgendasTable.lpPageId), eq(lpPagesTable.tenantId, tenantId)),
      )
      .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.eventId, eventId)));

    // Only pages that still exist (lp_page_id is SET NULL on delete, but the
    // tenant-scoped join is the belt-and-braces guard).
    const pageIds = agendaRows
      .filter((a) => a.slug !== null && typeof a.lpPageId === "number")
      .map((a) => a.lpPageId as number);

    const visitRows = pageIds.length
      ? await db
          .select({
            pageId: lpPageVisitsTable.pageId,
            visits: sql<number>`count(*)::int`,
            uniqueVisitors: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int`,
          })
          .from(lpPageVisitsTable)
          .where(inArray(lpPageVisitsTable.pageId, pageIds))
          .groupBy(lpPageVisitsTable.pageId)
      : [];
    const visitsByPage = new Map(visitRows.map((r) => [r.pageId, r]));

    // Test-lead filtering is a JS heuristic (isTestLead), so leads are counted
    // in JS — same pattern as GET /lp/analytics/pages.
    const leadRows = pageIds.length
      ? await db
          .select({ pageId: lpLeadsTable.pageId, fields: lpLeadsTable.fields })
          .from(lpLeadsTable)
          .where(and(eq(lpLeadsTable.tenantId, tenantId), inArray(lpLeadsTable.pageId, pageIds)))
      : [];
    const leadsByPage = new Map<number, { leads: number; rsvps: number }>();
    for (const lead of leadRows) {
      const fields = (lead.fields ?? {}) as Record<string, unknown>;
      if (isTestLead(fields)) continue;
      const entry = leadsByPage.get(lead.pageId) ?? { leads: 0, rsvps: 0 };
      entry.leads++;
      if (fieldAccessor(fields)("source") === "Agenda RSVP") entry.rsvps++;
      leadsByPage.set(lead.pageId, entry);
    }

    const agendas = agendaRows
      .map((a) => {
        const pageId = a.slug !== null && typeof a.lpPageId === "number" ? a.lpPageId : null;
        const visits = pageId !== null ? visitsByPage.get(pageId) : undefined;
        const leads = pageId !== null ? leadsByPage.get(pageId) : undefined;
        return {
          id: a.id,
          accountName: a.accountDisplayName || a.accountName || a.accountNameSnapshot || "—",
          status: a.status,
          pageId,
          url: a.slug !== null ? `/lp/${a.slug}` : null,
          publishedAt: a.publishedAt,
          sessionCount: ((a.selections ?? []) as AgendaSelection[]).length,
          visits: visits?.visits ?? 0,
          uniqueVisitors: visits?.uniqueVisitors ?? 0,
          leads: leads?.leads ?? 0,
          rsvps: leads?.rsvps ?? 0,
        };
      })
      .sort((x, y) => y.visits - x.visits || y.rsvps - x.rsvps || x.accountName.localeCompare(y.accountName));

    // Which catalog sessions reps actually put on agendas — informs what to
    // reserve/expand next time.
    const pickCounts = new Map<number, number>();
    for (const a of agendaRows) {
      for (const sel of (a.selections ?? []) as AgendaSelection[]) {
        pickCounts.set(sel.sessionId, (pickCounts.get(sel.sessionId) ?? 0) + 1);
      }
    }
    const sessions = await loadEventSessions(tenantId, eventId);
    const topSessions = sessions
      .filter((s) => pickCounts.has(s.id))
      .map((s) => ({
        sessionId: s.id,
        title: s.title,
        day: s.day,
        startTime: s.startTime,
        isReservedSlot: s.isReservedSlot,
        pickCount: pickCounts.get(s.id) ?? 0,
      }))
      .sort((x, y) => y.pickCount - x.pickCount || x.title.localeCompare(y.title))
      .slice(0, 10);

    const summary = {
      agendas: agendaRows.length,
      published: agendaRows.filter((a) => a.status === "published").length,
      visits: agendas.reduce((n, a) => n + a.visits, 0),
      uniqueVisitors: agendas.reduce((n, a) => n + a.uniqueVisitors, 0),
      leads: agendas.reduce((n, a) => n + a.leads, 0),
      rsvps: agendas.reduce((n, a) => n + a.rsvps, 0),
    };

    res.json({ summary, agendas, topSessions });
  } catch (err) {
    console.error("[sales/events] analytics error", err);
    res.status(500).json({ error: "Failed to load event analytics" });
  }
});

export default router;
