/**
 * Saved Partner Hub notes for the builder: list, save (a name already in
 * use updates that note), delete. Workspace-scoped; any signed-in member of
 * the workspace can use them.
 */
import { Router, type Request, type Response } from "express";
import { db, lpRoomSavedNotesTable } from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { cleanSavedNote, savedNoteName } from "../../lib/partnerRoomNotes";

const router = Router();

const shape = (r: typeof lpRoomSavedNotesTable.$inferSelect) => ({ id: r.id, name: r.name, note: r.note, updatedAt: r.updatedAt, createdBy: r.createdBy });

router.get("/lp/room-notes", async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const rows = await db.select().from(lpRoomSavedNotesTable).where(eq(lpRoomSavedNotesTable.tenantId, tenantId)).orderBy(asc(sql`lower(${lpRoomSavedNotesTable.name})`));
  res.json({ notes: rows.map(shape) });
});

router.post("/lp/room-notes", async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const note = cleanSavedNote(req.body?.note);
  if (!note) {
    res.status(400).json({ error: "The note is empty." });
    return;
  }
  const name = savedNoteName(req.body?.name, note);
  const who = req.authUser?.email ?? null;
  const [existing] = await db
    .select({ id: lpRoomSavedNotesTable.id })
    .from(lpRoomSavedNotesTable)
    .where(and(eq(lpRoomSavedNotesTable.tenantId, tenantId), sql`lower(${lpRoomSavedNotesTable.name}) = lower(${name})`));
  if (existing) {
    const [row] = await db.update(lpRoomSavedNotesTable).set({ name, note, updatedAt: new Date() }).where(eq(lpRoomSavedNotesTable.id, existing.id)).returning();
    res.json({ note: shape(row), updated: true });
    return;
  }
  const [row] = await db.insert(lpRoomSavedNotesTable).values({ tenantId, name, note, createdBy: who }).returning();
  res.status(201).json({ note: shape(row), updated: false });
});

router.delete("/lp/room-notes/:id", async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid note" });
    return;
  }
  const gone = await db.delete(lpRoomSavedNotesTable).where(and(eq(lpRoomSavedNotesTable.tenantId, tenantId), eq(lpRoomSavedNotesTable.id, id))).returning({ id: lpRoomSavedNotesTable.id });
  if (gone.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
