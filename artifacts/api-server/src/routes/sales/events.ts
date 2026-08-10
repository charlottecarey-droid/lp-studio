import { Router } from "express";
import { randomBytes } from "node:crypto";
import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesEventsTable,
  salesEventSessionsTable,
  salesEventAgendasTable,
  salesAccountsTable,
  salesContactsTable,
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
import { personalizeAgendaProps } from "../../lib/sales/agenda-tokens";
import type { AccountTeamMember, RainfocusConfig } from "@workspace/db";
import { loadHeadshotIndex, attachHeadshots } from "../../lib/sales/rep-headshots";
import {
  credsFromConfig,
  syncRainfocusEvent,
  recordSyncOutcome,
  redactRainfocusConfig,
} from "../../lib/sales/rainfocus-sync";
import {
  matchAgendaSessions,
  catalogRoleOptions,
  catalogSegmentOptions,
  resolveAgendaSegment,
  agendaMatchFacts,
  labelsMatch,
  sessionSourceKey,
  type MatchableSession,
} from "../../lib/sales/agenda-matching";
import { importAgendaFromUrl, AgendaImportError } from "../../lib/sales/agenda-import";
import { cleanSessionTitle } from "../../lib/sales/rainfocus";
import {
  parseRainfocusEmbed,
  fetchRainfocusCatalog,
  mapRainfocusSessions,
  rainfocusVocabulary,
  pickFeaturedSpeakers,
  mapRainfocusSponsors,
  deriveEventDetails,
} from "../../lib/sales/rainfocus";
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

/**
 * Shape an event for the API.
 *
 * The RainFocus token is public by design but must not be echoed back on every
 * read — `connected` is what the UI actually needs. Applied to EVERY response
 * that returns an event, so a new endpoint can't leak it by omission.
 */
/**
 * Strip the per-account / per-event CONTENT fields off a saved event-agenda
 * prop object, leaving only styling and house copy. Used for both the tenant
 * governance default and the per-event style template, so the two can never
 * disagree about what counts as "style". `headline` is deliberately KEPT — it
 * is token-aware ({{company_name}}) and part of the authored look.
 * `team` is stripped because it auto-fills from the account at publish.
 */
function stripPerAccountAgendaFields(props: Record<string, unknown>): Record<string, unknown> {
  const {
    days: _days, eyebrow: _eyebrow, accountName: _accountName,
    eventName: _eventName, eventLocation: _eventLocation, eventDates: _eventDates,
    personalNote: _personalNote, sessionCount: _sessionCount,
    accountLogoUrl: _accountLogoUrl, accountLogoAlt: _accountLogoAlt,
    team: _team,
    ...styleAndSettings
  } = props;
  return styleAndSettings;
}

function forApi<T extends { rainfocusConfig?: unknown }>(event: T) {
  return { ...event, rainfocusConfig: redactRainfocusConfig(event.rainfocusConfig as never) };
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
    // `SELECT e.*` includes rainfocus_config, so redact here too — this list
    // is the easiest place for the token to leak by accident.
    res.json({
      events: (rows.rows as Record<string, unknown>[]).map((r) => ({
        ...r,
        rainfocus_config: redactRainfocusConfig(r.rainfocus_config as never),
      })),
    });
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
    res.json({ event: forApi(event) });
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
    res.json({
      event: forApi(event),
      sessions,
      roleOptions: catalogRoleOptions(sessions.map(toMatchable)),
      // The segment vocabulary the catalog actually uses, so a rep picks the
      // conference's names rather than guessing at the CRM's.
      segmentOptions: catalogSegmentOptions(sessions.map(toMatchable)),
    });
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
    // Embed link-param name (see migration 0136): must be URL-param-safe
    // because it's spliced verbatim into customer-site links AND read back
    // by the loader via URLSearchParams. null/"" resets to the loader
    // default ("lp_agenda").
    const { embedParam } = req.body as { embedParam?: unknown };
    if (embedParam !== undefined) {
      if (embedParam === null || embedParam === "") {
        patch.embedParam = null;
      } else if (typeof embedParam === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(embedParam)) {
        patch.embedParam = embedParam;
      } else {
        res.status(400).json({ error: "Embed param must be 1–32 letters, digits, hyphens or underscores." });
        return;
      }
    }
    // CSS selector of the site's own agenda widget (snippet data-hide, see
    // migration 0137). Free-form — selectors have no safe regex — but the
    // snippet builder attribute-escapes it and the loader wraps
    // querySelectorAll in try/catch, so a bad one degrades to "no hide".
    const { embedHideSelector } = req.body as { embedHideSelector?: unknown };
    if (embedHideSelector !== undefined) {
      if (embedHideSelector === null || embedHideSelector === "") {
        patch.embedHideSelector = null;
      } else if (typeof embedHideSelector === "string" && embedHideSelector.trim().length <= 200) {
        patch.embedHideSelector = embedHideSelector.trim();
      } else {
        res.status(400).json({ error: "Fallback selector must be 200 characters or fewer." });
        return;
      }
    }
    // Default agenda for tokenless visitors (snippet data-default). NULL =
    // no default: the widget stays invisible and the site's own agenda
    // (RainFocus) keeps the page. Choosing one mints its embed token if the
    // agenda predates the embed feature.
    const { embedDefaultAgendaId } = req.body as { embedDefaultAgendaId?: unknown };
    if (embedDefaultAgendaId !== undefined) {
      if (embedDefaultAgendaId === null) {
        patch.embedDefaultAgendaId = null;
      } else {
        const defaultAgendaId = Number(embedDefaultAgendaId);
        const [candidate] = Number.isFinite(defaultAgendaId)
          ? await db
              .select({
                id: salesEventAgendasTable.id,
                status: salesEventAgendasTable.status,
                lpPageId: salesEventAgendasTable.lpPageId,
                embedToken: salesEventAgendasTable.embedToken,
              })
              .from(salesEventAgendasTable)
              .where(and(
                eq(salesEventAgendasTable.tenantId, tenantId),
                eq(salesEventAgendasTable.eventId, eventId),
                eq(salesEventAgendasTable.id, defaultAgendaId),
              ))
          : [];
        if (!candidate || candidate.status !== "published" || candidate.lpPageId == null) {
          res.status(400).json({ error: "The default agenda must be a published agenda of this event." });
          return;
        }
        if (!candidate.embedToken) {
          await db
            .update(salesEventAgendasTable)
            .set({ embedToken: randomBytes(16).toString("base64url") })
            .where(eq(salesEventAgendasTable.id, candidate.id));
        }
        patch.embedDefaultAgendaId = candidate.id;
      }
    }
    const { styleTemplatePageId } = req.body as { styleTemplatePageId?: unknown };
    if (styleTemplatePageId !== undefined) {
      if (styleTemplatePageId === null) {
        patch.styleTemplatePageId = null;
      } else {
        const pageId = Number(styleTemplatePageId);
        // Validate ownership AND that the page actually carries an
        // event-agenda block — pointing an event at an arbitrary page would
        // silently publish agendas with no styling source.
        const [page] = await db
          .select({ id: lpPagesTable.id, blocks: lpPagesTable.blocks })
          .from(lpPagesTable)
          .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
        const hasAgendaBlock = Array.isArray(page?.blocks)
          && (page.blocks as { type?: string }[]).some((b) => b?.type === "event-agenda");
        if (!page || !hasAgendaBlock) {
          res.status(400).json({ error: "That page doesn't contain an event-agenda block." });
          return;
        }
        patch.styleTemplatePageId = pageId;
      }
    }
    if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
    const [event] = await db
      .update(salesEventsTable)
      .set(patch)
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)))
      .returning();
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    res.json({ event: forApi(event) });
  } catch (err) {
    console.error("[sales/events] patch error", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

/**
 * Delete an event, its session catalog, and its agendas.
 *
 * sales_event_sessions and sales_event_agendas are ON DELETE CASCADE, so this
 * is not a small delete — it takes the whole catalog and every agenda built
 * from it, and there is no undo.
 *
 * PUBLISHED PAGES SURVIVE. lp_pages is not cascaded from here (the FK only
 * runs the other way, nulling agenda.lp_page_id if a page is deleted), so a
 * page a customer has already been sent stays live at its URL. What's lost is
 * the agenda behind it: nobody can edit or republish that page from the event
 * again. That's a decision the rep has to make knowingly, so when published
 * agendas exist we refuse and hand back the counts; the client re-sends with
 * ?force=true once the human has confirmed.
 */
router.delete("/events/:eventId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }

    const [event] = await db
      .select({ id: salesEventsTable.id, name: salesEventsTable.name })
      .from(salesEventsTable)
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    // Count first — the cascade makes this unrecoverable, so the human sees
    // the blast radius before it happens, not after.
    const counts = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM sales_event_sessions
          WHERE tenant_id = ${tenantId} AND event_id = ${eventId}) AS sessions,
        (SELECT COUNT(*)::int FROM sales_event_agendas
          WHERE tenant_id = ${tenantId} AND event_id = ${eventId}) AS agendas,
        (SELECT COUNT(*)::int FROM sales_event_agendas
          WHERE tenant_id = ${tenantId} AND event_id = ${eventId}
            AND status = 'published') AS published
    `);
    const row = counts.rows[0] as { sessions?: number; agendas?: number; published?: number };
    const impact = {
      sessions: Number(row?.sessions ?? 0),
      agendas: Number(row?.agendas ?? 0),
      published: Number(row?.published ?? 0),
    };

    const force = String((req.query.force as string) ?? "") === "true";
    if (impact.published > 0 && !force) {
      res.status(409).json({
        error: "This event has published agendas.",
        requiresConfirmation: true,
        eventName: event.name,
        impact,
      });
      return;
    }

    const [deleted] = await db
      .delete(salesEventsTable)
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)))
      .returning({ id: salesEventsTable.id });
    if (!deleted) { res.status(404).json({ error: "Event not found" }); return; }
    res.json({ ok: true, impact });
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

  /**
   * Fallback index for rows stored BEFORE session titles were cleaned.
   *
   * The source key is derived from the title, so dropping a catalog's trailing
   * "OFFERING 2" changes it. Without this, the first re-import after that change
   * would insert a duplicate of every affected session instead of updating it.
   * Ambiguous cleaned titles are skipped rather than guessed at.
   */
  const cleanedKey = (title: string, day: string | null, startTime: string | null) =>
    sessionSourceKey(cleanSessionTitle(title), day, startTime);
  const cleanedCounts = new Map<string, number>();
  for (const row of existing) {
    const k = cleanedKey(row.title, row.day, row.startTime);
    cleanedCounts.set(k, (cleanedCounts.get(k) ?? 0) + 1);
  }
  const byCleanedTitle = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    const k = cleanedKey(row.title, row.day, row.startTime);
    if ((cleanedCounts.get(k) ?? 0) === 1) byCleanedTitle.set(k, row);
  }

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
    // Exact key first, then the pre-cleaning fallback above.
    const prior = bySourceKey.get(sourceKey) ?? byCleanedTitle.get(sourceKey);
    if (prior) {
      await db
        .update(salesEventSessionsTable)
        .set({
          title: parsed.title,
          // Adopt the key derived from the cleaned title, so a row matched via
          // the fallback stops needing the fallback on the next import.
          sourceKey,
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

/**
 * Import from a RainFocus widget embed.
 *
 * Most big conferences run their catalog on RainFocus and embed it as a
 * widget whose apiToken + widgetId ship in public client-side HTML. Given that
 * pair we query the catalog API directly, which beats the Firecrawl + LLM path
 * on every axis: session type, track, Role and Audience arrive as TYPED fields
 * instead of being inferred, `times[]` carries real ISO dates so .ics data
 * comes free, and pagination is explicit so nothing is truncated.
 *
 * Verified live against a 168-session catalog: 168/168 mapped, 0 skipped.
 *
 * No SSRF guard needed on a pasted URL here because there ISN'T one — the host
 * comes from an allowlist keyed by the embed's `env`, so user input can never
 * point this at an arbitrary origin.
 *
 * Rows go through the SAME upsertSessionRows path as CSV and URL import, so
 * source-key matching and `tagsEditedInApp` protection apply unchanged.
 */
router.post("/events/:eventId/import-rainfocus", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const { embed, apiToken, widgetId, env } = req.body as {
      embed?: unknown; apiToken?: unknown; widgetId?: unknown; env?: unknown;
    };

    // Accept either a pasted embed snippet or the three fields directly.
    const creds = typeof embed === "string" && embed.trim()
      ? parseRainfocusEmbed(embed)
      : parseRainfocusEmbed(
          `apiToken: '${String(apiToken ?? "")}', widgetId: '${String(widgetId ?? "")}', env: '${String(env ?? "prod")}'`,
        );
    if ("error" in creds) { res.status(400).json({ error: creds.error }); return; }

    const catalog = await fetchRainfocusCatalog(creds, "session");
    if ("error" in catalog) { res.status(502).json({ error: catalog.error }); return; }

    const { rows, skipped } = mapRainfocusSessions(catalog.items);

    /**
     * An agenda page is more than its schedule, so pull the keynote speakers
     * and sponsors too. Both are best-effort: a widget scoped to sessions
     * only will refuse these, which must NOT fail the session import that
     * already succeeded.
     */
    const [speakerCat, exhibitorCat] = await Promise.all([
      fetchRainfocusCatalog(creds, "speaker").catch(() => ({ error: "unavailable" })),
      fetchRainfocusCatalog(creds, "exhibitor").catch(() => ({ error: "unavailable" })),
    ]);
    const featuredSpeakers = "error" in speakerCat ? [] : pickFeaturedSpeakers(speakerCat.items);
    const sponsors = "error" in exhibitorCat ? [] : mapRainfocusSponsors(exhibitorCat.items);
    const derived = deriveEventDetails(catalog.items);
    if (rows.length === 0) {
      res.status(422).json({
        error: "That widget returned no sessions. A speaker-only catalog widget won't carry the agenda — use the session catalog widget.",
      });
      return;
    }

    const result = await upsertSessionRows(tenantId, eventId, rows as unknown[]);

    // Fill event fields the user hasn't set, and stash the non-session catalog
    // for the publish route. Never overwrite something already entered by hand.
    const eventPatch: Record<string, unknown> = {
      // Keep the connection so auto-sync can re-run unattended. The token is
      // redacted whenever the event is read back.
      rainfocusConfig: {
        ...((event.rainfocusConfig ?? {}) as Record<string, unknown>),
        apiToken: creds.apiToken,
        widgetId: creds.widgetId,
        env: creds.env,
      },
      catalogExtras: {
        speakers: featuredSpeakers,
        sponsors,
        derived,
        importedAt: new Date().toISOString(),
      },
    };
    if (!event.startDate && derived.startDate) eventPatch.startDate = derived.startDate;
    if (!event.endDate && derived.endDate) eventPatch.endDate = derived.endDate;
    await db
      .update(salesEventsTable)
      .set(eventPatch)
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)));

    res.json({
      ...result,
      extracted: rows.length,
      total: catalog.total,
      skipped,
      truncated: catalog.truncated,
      vocabulary: rainfocusVocabulary(rows),
      speakers: featuredSpeakers.length,
      sponsors: sponsors.length,
      derived,
    });
  } catch (err) {
    console.error("[sales/events] rainfocus import error", err);
    res.status(500).json({ error: "Failed to import from RainFocus" });
  }
});

/**
 * Suggest which of the event's audience-role chips fit an account, based on
 * who we actually have contacts for there.
 *
 * The two vocabularies don't line up on their own — a RainFocus catalog says
 * "Executive" / "Precon/Planning" while the CRM says "COO / VP of Operations"
 * — so this reuses `labelsMatch`, the same fuzzy comparison the session
 * matcher uses (acronym expansion, stemming, generic-rank-word stripping).
 * That keeps one definition of "these two job labels mean the same thing"
 * rather than a second, subtly different one here.
 *
 * Returns WHY each chip was suggested, so a rep can see it came from real
 * contacts and drop it if their attendee list differs.
 */
router.get("/events/:eventId/accounts/:accountId/suggested-roles", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    const accountId = parseInt(req.params.accountId, 10);
    if (isNaN(eventId) || isNaN(accountId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const sessions = await loadEventSessions(tenantId, eventId);
    const catalog = catalogRoleOptions(sessions.map(toMatchable));

    const contacts = await db
      .select({
        role: salesContactsTable.role,
        contactRole: salesContactsTable.contactRole,
        title: salesContactsTable.title,
        titleLevel: salesContactsTable.titleLevel,
        department: salesContactsTable.department,
      })
      .from(salesContactsTable)
      .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.accountId, accountId)));

    // Every label the CRM gives us for this account's people. Job title is
    // included last: it's the noisiest field, but for accounts whose contacts
    // were never role-coded it's the only signal there is.
    const contactLabels = new Set<string>();
    for (const c of contacts) {
      for (const v of [c.role, c.contactRole, c.titleLevel, c.department, c.title]) {
        const t = (v ?? "").trim();
        if (t) contactLabels.add(t);
      }
    }

    const suggested = catalog
      .map(({ role, count }) => {
        const from = [...contactLabels].filter((label) => labelsMatch(label, role));
        return { role, sessionCount: count, from };
      })
      .filter((s) => s.from.length > 0);

    res.json({ suggested, contactCount: contacts.length, catalogSize: catalog.length });
  } catch (err) {
    console.error("[sales/events] suggested-roles error", err);
    res.status(500).json({ error: "Failed to suggest roles" });
  }
});

/**
 * Turn auto-sync on/off for an event.
 *
 * Requires a stored connection: enabling a schedule with no credentials would
 * produce a toggle that silently never runs.
 */
router.patch("/events/:eventId/rainfocus", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const config = (event.rainfocusConfig ?? {}) as RainfocusConfig;
    const autoSync = Boolean((req.body as { autoSync?: unknown })?.autoSync);
    if (autoSync && !credsFromConfig(config)) {
      res.status(400).json({ error: "Import from RainFocus once first — auto-sync needs the widget connection." });
      return;
    }
    const next: RainfocusConfig = { ...config, autoSync };
    await db
      .update(salesEventsTable)
      .set({ rainfocusConfig: next })
      .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)));
    res.json(redactRainfocusConfig(next));
  } catch (err) {
    console.error("[sales/events] rainfocus config error", err);
    res.status(500).json({ error: "Failed to update auto-sync" });
  }
});

/** Re-sync now, using the stored connection. Same engine as the poller. */
router.post("/events/:eventId/rainfocus/sync", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
    const event = await loadEvent(tenantId, eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const config = (event.rainfocusConfig ?? {}) as RainfocusConfig;
    const creds = credsFromConfig(config);
    if (!creds) {
      res.status(400).json({ error: "No RainFocus connection stored for this event yet." });
      return;
    }
    const result = await syncRainfocusEvent(tenantId, eventId, creds);
    await recordSyncOutcome(tenantId, eventId, config, result);
    if (!result.ok) { res.status(502).json({ error: result.error }); return; }
    res.json(result.summary);
  } catch (err) {
    console.error("[sales/events] rainfocus sync error", err);
    res.status(500).json({ error: "Failed to sync from RainFocus" });
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
    // Lazily mint embed tokens for published agendas that predate the embed
    // feature (same rule as the single-agenda GET) — the list drives the
    // per-row link copy and the links CSV export, so published rows must
    // always carry one.
    for (const r of rows) {
      if (!r.agenda.embedToken && r.agenda.status === "published" && r.agenda.lpPageId) {
        r.agenda.embedToken = randomBytes(16).toString("base64url");
        await db
          .update(salesEventAgendasTable)
          .set({ embedToken: r.agenda.embedToken })
          .where(and(eq(salesEventAgendasTable.tenantId, tenantId), eq(salesEventAgendasTable.id, r.agenda.id)));
      }
    }
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

    const { accountId, attendeeRoles, segmentOverride } = req.body as {
      accountId?: unknown; attendeeRoles?: unknown; segmentOverride?: unknown;
    };
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
    const override = typeof segmentOverride === "string" ? segmentOverride.trim() || null : null;
    const sessions = await loadEventSessions(tenantId, eventId);
    const match = matchAgendaSessions(sessions.map(toMatchable), agendaMatchFacts(account, override), roles);

    const [agenda] = await db.insert(salesEventAgendasTable).values({
      eventId,
      tenantId,
      accountId,
      accountNameSnapshot: account.displayName || account.name,
      attendeeRoles: roles,
      segmentOverride: override,
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
    const match = matchAgendaSessions(
      sessions.map(toMatchable),
      agendaMatchFacts(account, agenda.segmentOverride),
      (agenda.attendeeRoles ?? []) as string[],
    );
    let pageSlug: string | null = null;
    if (agenda.lpPageId) {
      const [page] = await db
        .select({ slug: lpPagesTable.slug })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, agenda.lpPageId)));
      pageSlug = page?.slug ?? null;
    }
    // Lazy-mint the embed token for agendas PUBLISHED BEFORE the embed
    // feature existed — without this, their dialogs never show the Embed
    // row until someone thinks to republish. Same never-rotate contract as
    // the publish route; the write-on-GET is a one-time backfill per row.
    if (!agenda.embedToken && agenda.status === "published" && agenda.lpPageId) {
      agenda.embedToken = randomBytes(16).toString("base64url");
      await db
        .update(salesEventAgendasTable)
        .set({ embedToken: agenda.embedToken })
        .where(eq(salesEventAgendasTable.id, agenda.id));
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
    if (body.segmentOverride !== undefined) {
      // "" clears the override and falls back to the account's CRM segment.
      patch.segmentOverride = typeof body.segmentOverride === "string" && body.segmentOverride.trim()
        ? body.segmentOverride.trim()
        : null;
    }
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
    const match = matchAgendaSessions(
      sessions.map(toMatchable),
      agendaMatchFacts(account, agenda.segmentOverride),
      (agenda.attendeeRoles ?? []) as string[],
    );
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
        // The agenda's segment, not the raw CRM one — the why-attend copy
        // should speak to the persona the rep is actually writing for.
        segment: resolveAgendaSegment(account, agenda.segmentOverride),
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
        savedDefaultProps = stripPerAccountAgendaFields(row.props as Record<string, unknown>);
      }
      if (row?.block_settings && typeof row.block_settings === "object") {
        savedDefaultSettings = row.block_settings as Record<string, unknown>;
      }
    } catch (defaultsErr) {
      console.warn("[sales/events] block-defaults lookup failed (publishing without)", String(defaultsErr));
    }

    /**
     * Per-event style template: the look of ONE chosen agenda page, applied to
     * every agenda published for this event. Sits ABOVE tenant governance
     * (event-specific beats tenant-wide) and BELOW per-account data. Content
     * fields are stripped by the same helper governance uses, so "style" means
     * the same thing in both layers. A deleted/emptied template degrades to {}.
     */
    let eventTemplateProps: Record<string, unknown> = {};
    if (event.styleTemplatePageId) {
      const [tpl] = await db
        .select({ blocks: lpPagesTable.blocks })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, event.styleTemplatePageId)));
      const agendaBlock = Array.isArray(tpl?.blocks)
        ? (tpl.blocks as { type?: string; props?: Record<string, unknown> }[]).find((b) => b?.type === "event-agenda")
        : undefined;
      if (agendaBlock?.props) {
        eventTemplateProps = stripPerAccountAgendaFields(agendaBlock.props);
      }
    }

    /** Non-session catalog data stashed by the RainFocus import, if any. */
    const extras = (event.catalogExtras ?? {}) as {
      speakers?: unknown[];
      sponsors?: unknown[];
    };
    const catalogSpeakers = Array.isArray(extras.speakers) ? extras.speakers : [];
    const catalogSponsors = Array.isArray(extras.sponsors) ? extras.sponsors : [];

    /**
     * Fill the "account team" section from the account's own team (Salesforce
     * AccountTeamMember and/or hand-edited), so a rep doesn't retype the people
     * already recorded against the account.
     *
     * `photoUrl` is deliberately DROPPED. Salesforce's SmallPhotoUrl needs a
     * Salesforce session to fetch, so embedding it in a public landing page
     * renders a broken image — the block's initials fallback looks better than
     * that. The URL stays on the account for in-app use.
     *
     * Job title beats TeamMemberRole for display: "Enterprise Account
     * Executive" tells the reader who they're talking to; "Account Manager"
     * describes our internal coverage model.
     */
    const accountTeamRaw = ((account?.accountTeam?.members ?? []) as AccountTeamMember[])
      .filter((m) => m.name?.trim())
      .map((m) => {
        const person: { name: string; title?: string; email?: string; phone?: string; imageUrl?: string } = {
          name: m.name.trim(),
        };
        const title = (m.title || m.role || "").trim();
        if (title) person.title = title;
        if (m.email?.trim()) person.email = m.email.trim();
        if (m.phone?.trim()) person.phone = m.phone.trim();
        return person;
      });

    /**
     * Borrow each rep's headshot from the Sales Reps library.
     *
     * The library record already holds a photo in our own storage; a
     * Salesforce-synced team member has a name and email but no usable image.
     * Matching is email-first — two people share a name, nobody shares a work
     * email — and an ambiguous name is skipped rather than guessed, because the
     * wrong face on a named person is worse than initials.
     */
    const accountTeamPeople = accountTeamRaw.length
      ? attachHeadshots(accountTeamRaw, await loadHeadshotIndex(tenantId))
      : accountTeamRaw;

    const blockProps = {
      // Canned fallbacks — a saved default overrides any of these.
      subheadline: `A schedule curated for your team — every session picked for ${accountName}.`,
      headline: `${accountName}, your agenda is ready`,
      showRsvp: true,
      rsvpHeading: `Confirm your spot at ${event.name}`,
      ctaHeadline: "Questions before the event?",
      ctaSubheadline: "Your account team is one message away.",
      ctaText: "Get in touch",
      ctaUrl: brandCtx.chilipiperUrl || brandCtx.defaultCtaUrl || "#",

      // Tenant governance default (colors, toggles, rsvpFormId, house copy).
      ...savedDefaultProps,

      // This event's style template — one page's look shared by every agenda
      // of the event, so Groundbreak pages match while an executive event can
      // run premium styling. Beats tenant governance, loses to account data.
      ...eventTemplateProps,

      // Per-account data — always wins.
      eyebrow: eyebrowParts.join(" · "),
      accountName,
      eventName: event.name,
      eventLocation: event.location ?? "",
      eventDates: formatDateRange(event.startDate, event.endDate),
      personalNote: agenda.personalNote ?? "",
      days,
      sessionCount: selections.length,

      // Keynote speakers and sponsors captured by the catalog import. Spread
      // conditionally so an event with no import — or an author who curated
      // these by hand in Block Defaults — keeps whatever is already there.
      ...(catalogSpeakers.length ? { speakers: catalogSpeakers } : {}),
      ...(catalogSponsors.length ? { sponsors: catalogSponsors } : {}),
      ...(accountTeamPeople.length ? { team: accountTeamPeople } : {}),
    };

    /**
     * Personalise EVERY string in the props, not just the three fields the
     * publish route happens to write. An author who types {{company_name}} in
     * a section headline, a note or a resource title gets the account name
     * there too. Unknown tokens are left intact so DTR can still resolve
     * {{keyword}} and friends from the visitor's URL at runtime.
     */
    const { props: personalizedProps, report: tokenReport } = personalizeAgendaProps(blockProps, {
      accountName,
      eventName: event.name,
      eventLocation: event.location ?? undefined,
      eventDates: formatDateRange(event.startDate, event.endDate) || undefined,
    });

    const block = {
      id: `event-agenda-${makeId()}`,
      type: "event-agenda",
      blockSettings: savedDefaultSettings,
      props: personalizedProps,
    };

    const title = `${accountName} — ${event.name} Agenda`;

    /**
     * Mint the embed token on first publish; NEVER rotate it after. Links
     * carrying it live on the customer's own website (`?<embed_param>=<token>`
     * → /api/embed/agenda/:token), so a republish must not break them — same
     * stability contract as lp_page_id/slug above. 16 random bytes,
     * base64url (22 chars): opaque, unguessable, URL-safe.
     */
    let embedToken = agenda.embedToken;
    if (!embedToken) {
      embedToken = randomBytes(16).toString("base64url");
      await db
        .update(salesEventAgendasTable)
        .set({ embedToken })
        .where(eq(salesEventAgendasTable.id, agenda.id));
    }

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
        res.json({
          pageId: page.id, slug: page.slug, url: `/lp/${page.slug}`,
          embedToken,
          tokens: { replaced: tokenReport.replaced, unfilled: tokenReport.unknown },
        });
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

    res.json({
          pageId: page.id, slug: page.slug, url: `/lp/${page.slug}`,
          embedToken,
          tokens: { replaced: tokenReport.replaced, unfilled: tokenReport.unknown },
        });
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
