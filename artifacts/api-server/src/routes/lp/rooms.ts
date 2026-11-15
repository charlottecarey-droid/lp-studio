/**
 * Partner rooms — the working state behind a customer-facing room page.
 *
 * PUBLIC (LP_PUBLIC allowlist, POST /lp/room/*): what a visitor to the room
 * page can do. Viewing is open; acting needs a proven identity (see
 * lib/partnerRoom.ts): a personal link (sales hotlink for THIS page) or a
 * room token emailed to an allowed address. Every handler re-derives the
 * tenant from the page row and re-checks the identity — nothing from the
 * browser is trusted.
 *
 * TENANT (auth-gated, /lp/partner-rooms/*): settings (allowed domains, Slack
 * channel), people (allow / deny / requests), completed tasks, and uploads —
 * the ONLY place an uploaded file can be downloaded.
 */
import { Router, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  db,
  lpPagesTable,
  lpRoomMembersTable,
  lpRoomSettingsTable,
  lpRoomTaskStateTable,
  lpRoomUploadsTable,
  salesContactsTable,
  salesHotlinksTable,
  tenantsTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { ObjectStorageService } from "../../lib/objectStorage";
import { getActiveHostsForTenant } from "../../lib/tenantHosts";
import { getRequestHost, getRequestProto } from "../../lib/requestHost";
import { sendRoomAccessEmail } from "../../lib/notifications";
import { slackService } from "../../lib/slack-service";
import {
  extractRoomTasks,
  isEmailAllowed,
  normalizeDomain,
  normalizeEmail,
  parseRoomUpload,
  safeRoomPath,
  signRoomToken,
  verifyRoomToken,
  FREE_MAIL_DOMAINS,
  type RoomMemberStatus,
  type RoomTask,
} from "../../lib/partnerRoom";

const router = Router();
const objectStorage = new ObjectStorageService();
const ROOM_UPLOAD_FOLDER = "room-uploads";

// Reads are cheap and fire on every room view; writes and access requests
// are rare for a real person, so their ceilings are low.
const stateLimiter = rateLimit({ name: "room-state", windowMs: 60_000, max: envLimit("RATE_LIMIT_ROOM_STATE_PER_MIN", 120) });
const actionLimiter = rateLimit({ name: "room-action", windowMs: 60_000, max: envLimit("RATE_LIMIT_ROOM_ACTION_PER_MIN", 20) });
const accessLimiter = rateLimit({ name: "room-access", windowMs: 10 * 60_000, max: envLimit("RATE_LIMIT_ROOM_ACCESS_PER_10MIN", 6) });

interface RoomPage {
  id: number;
  tenantId: number;
  title: string;
  slug: string;
  tasks: Map<string, RoomTask>;
}

async function loadRoomPage(pageIdRaw: unknown): Promise<RoomPage | null> {
  const pageId = typeof pageIdRaw === "number" ? Math.floor(pageIdRaw) : NaN;
  if (!Number.isFinite(pageId) || pageId <= 0) return null;
  const [page] = await db
    .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, title: lpPagesTable.title, slug: lpPagesTable.slug, blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, pageId))
    .limit(1);
  if (!page || page.tenantId == null) return null;
  return { id: page.id, tenantId: page.tenantId, title: page.title, slug: page.slug, tasks: extractRoomTasks(page.blocks) };
}

async function loadSettings(pageId: number): Promise<{ allowedDomains: string[]; slackChannelId: string | null }> {
  const [row] = await db
    .select({ allowedDomains: lpRoomSettingsTable.allowedDomains, slackChannelId: lpRoomSettingsTable.slackChannelId })
    .from(lpRoomSettingsTable)
    .where(eq(lpRoomSettingsTable.pageId, pageId))
    .limit(1);
  return { allowedDomains: Array.isArray(row?.allowedDomains) ? row.allowedDomains : [], slackChannelId: row?.slackChannelId ?? null };
}

async function memberStatus(pageId: number, email: string): Promise<RoomMemberStatus | null> {
  const [row] = await db
    .select({ status: lpRoomMembersTable.status })
    .from(lpRoomMembersTable)
    .where(and(eq(lpRoomMembersTable.pageId, pageId), eq(lpRoomMembersTable.email, email)))
    .limit(1);
  return (row?.status as RoomMemberStatus | undefined) ?? null;
}

interface Viewer {
  email: string;
  name: string | null;
  via: "link" | "email";
}

/**
 * Who is acting? A personal link for THIS page wins (the contact is known);
 * otherwise a valid room token whose address is still allowed. Null = anonymous.
 */
async function resolveViewer(page: RoomPage, body: { hl?: unknown; rt?: unknown }): Promise<Viewer | null> {
  const hl = typeof body.hl === "string" ? body.hl.trim() : "";
  if (hl && hl.length <= 64) {
    const [row] = await db
      .select({
        pageId: salesHotlinksTable.pageId,
        isActive: salesHotlinksTable.isActive,
        tenantId: salesHotlinksTable.tenantId,
        email: salesContactsTable.email,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
      })
      .from(salesHotlinksTable)
      .leftJoin(salesContactsTable, eq(salesContactsTable.id, salesHotlinksTable.contactId))
      .where(eq(salesHotlinksTable.token, hl))
      .limit(1);
    const email = normalizeEmail(row?.email);
    if (row && row.isActive && row.pageId === page.id && row.tenantId === page.tenantId && email) {
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || null;
      return { email, name, via: "link" };
    }
  }
  const claims = verifyRoomToken(body.rt, page.id);
  if (claims) {
    const [settings, status] = await Promise.all([loadSettings(page.id), memberStatus(page.id, claims.email)]);
    if (isEmailAllowed(claims.email, settings.allowedDomains, status)) return { email: claims.email, name: null, via: "email" };
  }
  return null;
}

async function roomPageUrl(req: Request, page: RoomPage, pathRaw: unknown): Promise<string> {
  const hosts = await getActiveHostsForTenant(page.tenantId);
  const reqHost = getRequestHost(req).toLowerCase();
  const path = safeRoomPath(pathRaw);
  // The visitor is ON the room page, so their own host + path is the best
  // link — but only when that host really belongs to this tenant (or we are
  // not in production). Otherwise build it from the tenant's own domain.
  if (path && (hosts.includes(reqHost) || process.env.NODE_ENV !== "production")) {
    return `${getRequestProto(req)}://${reqHost}${path}`;
  }
  const [tenant] = await db
    .select({ domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, page.tenantId))
    .limit(1);
  if (tenant?.micrositeDomain) return `https://${tenant.micrositeDomain}/${page.slug}`;
  if (tenant?.domain) return `https://${tenant.domain}/lp/${page.slug}`;
  return `${getRequestProto(req)}://${reqHost}/lp/${page.slug}`;
}

function postToSlack(page: RoomPage, channelId: string | null, headline: string, lines: string[], pageUrl?: string): void {
  const text = `${headline} — ${page.title}`;
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: headline, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
    { type: "context", elements: [{ type: "mrkdwn", text: `${page.title}${pageUrl ? ` · <${pageUrl}|Open the room>` : ""}` }] },
  ];
  void slackService.postMessage(page.tenantId, { blocks, text, channelId: channelId ?? undefined }).catch(() => {});
}

const mrk = (s: string) => s.replace(/[<>&*_~`]/g, " ");

/* ── PUBLIC ──────────────────────────────────────────────────────────────── */

/**
 * Room state for the page. Anyone gets which tasks are done (so the page
 * reads the same for every visitor); only an identified viewer gets WHO did
 * it and the name of the file received.
 */
router.post("/lp/room/state", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await loadRoomPage(req.body?.pageId);
    if (!page) {
      res.json({ viewer: null, tasks: {} });
      return;
    }
    const viewer = await resolveViewer(page, req.body ?? {});
    const [states, uploads] = await Promise.all([
      db.select().from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, page.id)),
      db
        .select({ taskKey: lpRoomUploadsTable.taskKey, fileName: lpRoomUploadsTable.fileName, createdAt: lpRoomUploadsTable.createdAt, by: lpRoomUploadsTable.uploadedByEmail })
        .from(lpRoomUploadsTable)
        .where(eq(lpRoomUploadsTable.pageId, page.id))
        .orderBy(desc(lpRoomUploadsTable.createdAt)),
    ]);
    const tasks: Record<string, { done: boolean; at: string; by?: string; fileName?: string }> = {};
    for (const s of states) {
      if (!page.tasks.has(s.taskKey)) continue;
      tasks[s.taskKey] = { done: true, at: s.completedAt.toISOString(), ...(viewer ? { by: s.completedByName || s.completedByEmail } : {}) };
    }
    if (viewer) {
      for (const u of uploads) {
        const t = tasks[u.taskKey];
        if (t && !t.fileName) t.fileName = u.fileName; // newest first
      }
    }
    res.json({ viewer: viewer ? { email: viewer.email, name: viewer.name } : null, tasks });
  } catch (err) {
    req.log.error({ err }, "room state failed");
    res.status(500).json({ error: "Could not load the room" });
  }
});

/**
 * Ask to act in the room with a work email. Allowed address → we email a
 * link carrying a room token. Anything else → recorded as a request and the
 * team is told in Slack. The answer says which, so the page can tell the
 * visitor what happens next.
 */
router.post("/lp/room/access", accessLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await loadRoomPage(req.body?.pageId);
    const email = normalizeEmail(req.body?.email);
    if (!page || !email) {
      res.status(400).json({ error: "Enter a valid work email" });
      return;
    }
    const [settings, status] = await Promise.all([loadSettings(page.id), memberStatus(page.id, email)]);
    const url = await roomPageUrl(req, page, req.body?.path);
    if (isEmailAllowed(email, settings.allowedDomains, status)) {
      const sent = await sendRoomAccessEmail({
        recipientEmail: email,
        roomUrl: `${url}?rt=${encodeURIComponent(signRoomToken(page.id, email))}`,
        roomTitle: page.title,
        tenantId: page.tenantId,
      });
      if (!sent) {
        res.status(502).json({ error: "We couldn't send the email. Please try again in a minute." });
        return;
      }
      res.json({ status: "sent" });
      return;
    }
    if (status === "denied") {
      // Same answer as a fresh request: don't tell a refused address it was refused.
      res.json({ status: "requested" });
      return;
    }
    if (status !== "requested") {
      await db
        .insert(lpRoomMembersTable)
        .values({ tenantId: page.tenantId, pageId: page.id, email, status: "requested" })
        .onConflictDoNothing();
      postToSlack(page, settings.slackChannelId, "🔑 Room access requested", [`*${mrk(email)}* asked for access to upload files and mark tasks done.`, "Approve or decline from the page's Room panel in LP Studio."], url);
    }
    res.json({ status: "requested" });
  } catch (err) {
    req.log.error({ err }, "room access failed");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

async function requireActor(req: Request, res: Response): Promise<{ page: RoomPage; viewer: Viewer; task: RoomTask } | null> {
  const page = await loadRoomPage(req.body?.pageId);
  if (!page) {
    res.status(404).json({ error: "Room not found" });
    return null;
  }
  const viewer = await resolveViewer(page, req.body ?? {});
  if (!viewer) {
    res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
    return null;
  }
  const key = typeof req.body?.taskKey === "string" ? req.body.taskKey : "";
  const task = page.tasks.get(key);
  if (!task) {
    res.status(404).json({ error: "That task isn't on this page any more" });
    return null;
  }
  return { page, viewer, task };
}

async function markDone(page: RoomPage, taskKey: string, viewer: Viewer): Promise<void> {
  await db
    .insert(lpRoomTaskStateTable)
    .values({ tenantId: page.tenantId, pageId: page.id, taskKey, completedByEmail: viewer.email, completedByName: viewer.name })
    .onConflictDoUpdate({
      target: [lpRoomTaskStateTable.pageId, lpRoomTaskStateTable.taskKey],
      set: { completedByEmail: viewer.email, completedByName: viewer.name, completedAt: sql`now()` },
    });
}

/** Tick (or un-tick) a task the page marks as the customer's to complete. */
router.post("/lp/room/task", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = await requireActor(req, res);
    if (!actor) return;
    const { page, viewer, task } = actor;
    const done = req.body?.done !== false;
    if (task.action === "upload" && done) {
      res.status(400).json({ error: "Upload the file to complete this task" });
      return;
    }
    if (done) {
      await markDone(page, task.key, viewer);
      const settings = await loadSettings(page.id);
      postToSlack(page, settings.slackChannelId, "✅ Task marked done", [`*${mrk(viewer.name || viewer.email)}* marked *${mrk(task.title)}* as done.`], await roomPageUrl(req, page, req.body?.path));
    } else {
      await db.delete(lpRoomTaskStateTable).where(and(eq(lpRoomTaskStateTable.pageId, page.id), eq(lpRoomTaskStateTable.taskKey, task.key)));
    }
    res.json({ ok: true, done });
  } catch (err) {
    req.log.error({ err }, "room task failed");
    res.status(500).json({ error: "Could not update the task" });
  }
});

/**
 * Hand over a file for an upload task. JSON + base64 on purpose: the edge WAF
 * in front of custom-domain hosts rejects raw binary POSTs (see the PDF
 * upload route). The file lands in a private folder the public serve route
 * cannot reach; the response never includes a URL.
 */
router.post("/lp/room/upload", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = await requireActor(req, res);
    if (!actor) return;
    const { page, viewer, task } = actor;
    if (task.action !== "upload") {
      res.status(400).json({ error: "This task doesn't take a file" });
      return;
    }
    const parsed = parseRoomUpload(req.body?.fileName, req.body?.fileBase64);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const objectPath = await objectStorage.uploadObjectEntity(parsed.buffer, parsed.contentType, { tenantId: page.tenantId, folder: ROOM_UPLOAD_FOLDER });
    await db.insert(lpRoomUploadsTable).values({
      tenantId: page.tenantId,
      pageId: page.id,
      taskKey: task.key,
      fileName: parsed.fileName,
      contentType: parsed.contentType,
      sizeBytes: parsed.buffer.length,
      objectPath,
      uploadedByEmail: viewer.email,
      uploadedByName: viewer.name,
    });
    await markDone(page, task.key, viewer);
    const settings = await loadSettings(page.id);
    postToSlack(
      page,
      settings.slackChannelId,
      "📎 File received",
      [`*${mrk(viewer.name || viewer.email)}* uploaded *${mrk(parsed.fileName)}* for *${mrk(task.title)}*.`, "Download it from the page's Room panel in LP Studio."],
      await roomPageUrl(req, page, req.body?.path),
    );
    res.json({ ok: true, fileName: parsed.fileName });
  } catch (err) {
    req.log.error({ err }, "room upload failed");
    res.status(500).json({ error: "Upload failed. Please try again." });
  }
});

/* ── TENANT (auth-gated) ─────────────────────────────────────────────────── */

async function ownedRoomPage(req: Request, res: Response): Promise<RoomPage | null> {
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return null;
  const page = await loadRoomPage(Number(req.params.pageId));
  if (!page || page.tenantId !== tenantId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return page;
}

router.get("/lp/partner-rooms/:pageId", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const [settings, members, states, uploads] = await Promise.all([
      loadSettings(page.id),
      db.select().from(lpRoomMembersTable).where(eq(lpRoomMembersTable.pageId, page.id)).orderBy(desc(lpRoomMembersTable.updatedAt)),
      db.select().from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, page.id)),
      db.select().from(lpRoomUploadsTable).where(eq(lpRoomUploadsTable.pageId, page.id)).orderBy(desc(lpRoomUploadsTable.createdAt)),
    ]);
    const stateByKey = new Map(states.map((s) => [s.taskKey, s]));
    res.json({
      isRoom: page.tasks.size > 0,
      settings,
      tasks: [...page.tasks.values()].map((t) => {
        const s = stateByKey.get(t.key);
        return { key: t.key, title: t.title, action: t.action, done: !!s, completedBy: s ? s.completedByName || s.completedByEmail : null, completedAt: s?.completedAt.toISOString() ?? null };
      }),
      members: members.map((m) => ({ id: m.id, email: m.email, status: m.status, updatedAt: m.updatedAt.toISOString() })),
      uploads: uploads.map((u) => ({
        id: u.id,
        taskKey: u.taskKey,
        taskTitle: page.tasks.get(u.taskKey)?.title ?? u.taskKey,
        fileName: u.fileName,
        sizeBytes: u.sizeBytes,
        uploadedBy: u.uploadedByName || u.uploadedByEmail,
        uploadedByEmail: u.uploadedByEmail,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "room detail failed");
    res.status(500).json({ error: "Could not load the room" });
  }
});

router.patch("/lp/partner-rooms/:pageId/settings", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const rawDomains: unknown[] = Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains : [];
    const domains: string[] = [];
    for (const raw of rawDomains.slice(0, 25)) {
      const d = normalizeDomain(raw);
      if (!d) {
        res.status(400).json({ error: `"${String(raw)}" isn't a valid email domain` });
        return;
      }
      if (FREE_MAIL_DOMAINS.has(d)) {
        res.status(400).json({ error: `${d} is a public email provider, so anyone could get in. Add those people one by one instead.` });
        return;
      }
      if (!domains.includes(d)) domains.push(d);
    }
    const channelRaw = typeof req.body?.slackChannelId === "string" ? req.body.slackChannelId.trim() : "";
    if (channelRaw && !/^[A-Z0-9]{6,20}$/.test(channelRaw)) {
      res.status(400).json({ error: "That doesn't look like a Slack channel ID (for example C0123ABCDEF)" });
      return;
    }
    await db
      .insert(lpRoomSettingsTable)
      .values({ pageId: page.id, tenantId: page.tenantId, allowedDomains: domains, slackChannelId: channelRaw || null })
      .onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { allowedDomains: domains, slackChannelId: channelRaw || null, updatedAt: sql`now()` } });
    res.json({ allowedDomains: domains, slackChannelId: channelRaw || null });
  } catch (err) {
    req.log.error({ err }, "room settings failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/** Allow, deny or remove one address. `status: null` removes the row. */
router.post("/lp/partner-rooms/:pageId/members", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const email = normalizeEmail(req.body?.email);
    const status = req.body?.status;
    if (!email) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }
    if (status === null) {
      await db.delete(lpRoomMembersTable).where(and(eq(lpRoomMembersTable.pageId, page.id), eq(lpRoomMembersTable.email, email)));
      res.json({ ok: true });
      return;
    }
    if (status !== "allowed" && status !== "denied") {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    await db
      .insert(lpRoomMembersTable)
      .values({ tenantId: page.tenantId, pageId: page.id, email, status })
      .onConflictDoUpdate({ target: [lpRoomMembersTable.pageId, lpRoomMembersTable.email], set: { status, updatedAt: sql`now()` } });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room member failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/** Re-open a task the customer completed (their uploads are kept). */
router.delete("/lp/partner-rooms/:pageId/tasks/:taskKey", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    await db.delete(lpRoomTaskStateTable).where(and(eq(lpRoomTaskStateTable.pageId, page.id), eq(lpRoomTaskStateTable.taskKey, String(req.params.taskKey))));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room task reset failed");
    res.status(500).json({ error: "Could not update" });
  }
});

/** The only way to read an uploaded file: signed in, same tenant, as an attachment. */
router.get("/lp/partner-rooms/uploads/:id/download", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const id = Number(req.params.id);
    const [row] = Number.isFinite(id)
      ? await db.select().from(lpRoomUploadsTable).where(and(eq(lpRoomUploadsTable.id, id), eq(lpRoomUploadsTable.tenantId, tenantId))).limit(1)
      : [];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const file = await objectStorage.getObjectEntityFile(row.objectPath);
    res.setHeader("Content-Type", row.contentType);
    res.setHeader("Content-Length", String(row.sizeBytes));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    (file.createReadStream() as Readable).on("error", () => res.destroy()).pipe(res);
  } catch (err) {
    req.log.error({ err }, "room download failed");
    if (!res.headersSent) res.status(404).json({ error: "Not found" });
  }
});

export default router;
