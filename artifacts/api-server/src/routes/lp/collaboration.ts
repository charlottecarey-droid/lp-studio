import { Router } from "express";
import { eq, and, gt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  lpPageCommentsTable,
  lpPageReviewsTable,
  lpPagePresenceTable,
  lpPagesTable,
} from "@workspace/db";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// ─── Comments ────────────────────────────────────────────────────────────────

router.get("/lp/pages/:pageId/comments", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid pageId" }); return; }

  const comments = await db
    .select()
    .from(lpPageCommentsTable)
    .where(eq(lpPageCommentsTable.pageId, pageId))
    .orderBy(lpPageCommentsTable.createdAt);

  const byBlock: Record<number, {
    blockIndex: number;
    threads: Record<number, { comment: typeof comments[0]; replies: typeof comments }>
  }> = {};

  for (const c of comments) {
    if (!byBlock[c.blockIndex]) byBlock[c.blockIndex] = { blockIndex: c.blockIndex, threads: {} };
    if (c.parentId === null || c.parentId === undefined) {
      if (!byBlock[c.blockIndex].threads[c.id]) {
        byBlock[c.blockIndex].threads[c.id] = { comment: c, replies: [] };
      } else {
        byBlock[c.blockIndex].threads[c.id].comment = c;
      }
    }
  }
  for (const c of comments) {
    if (c.parentId !== null && c.parentId !== undefined) {
      const block = byBlock[c.blockIndex];
      if (block && block.threads[c.parentId]) {
        block.threads[c.parentId].replies.push(c);
      }
    }
  }

  const result = Object.values(byBlock).map(b => ({
    blockIndex: b.blockIndex,
    threads: Object.values(b.threads),
  }));

  res.json(result);
});

const CreateCommentBody = z.object({
  blockIndex: z.number().int().default(0),
  authorName: z.string().min(1),
  message: z.string().min(1),
  parentId: z.number().int().optional(),
});

router.post("/lp/pages/:pageId/comments", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid pageId" }); return; }

  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [comment] = await db
    .insert(lpPageCommentsTable)
    .values({
      pageId,
      blockIndex: parsed.data.blockIndex,
      authorName: parsed.data.authorName,
      message: parsed.data.message,
      parentId: parsed.data.parentId ?? null,
    })
    .returning();

  res.status(201).json(comment);
});

router.patch("/lp/pages/:pageId/comments/:commentId", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  const commentId = parseInt(req.params.commentId, 10);
  if (isNaN(pageId) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = z.object({ resolved: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [comment] = await db
    .update(lpPageCommentsTable)
    .set({ resolved: parsed.data.resolved })
    .where(and(eq(lpPageCommentsTable.id, commentId), eq(lpPageCommentsTable.pageId, pageId)))
    .returning();

  if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }
  res.json(comment);
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

router.post("/lp/pages/:pageId/reviews", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid pageId" }); return; }

  const [page] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, pageId));
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }

  const token = crypto.randomBytes(24).toString("hex");
  const [review] = await db
    .insert(lpPageReviewsTable)
    .values({ pageId, token, status: "pending" })
    .returning();

  res.status(201).json({ ...review, reviewUrl: `/review/${pageId}?token=${token}` });
});

router.get("/lp/pages/:pageId/reviews", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid pageId" }); return; }

  const reviews = await db
    .select()
    .from(lpPageReviewsTable)
    .where(eq(lpPageReviewsTable.pageId, pageId))
    .orderBy(lpPageReviewsTable.createdAt);

  res.json(reviews);
});

router.get("/lp/review/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [review] = await db
    .select()
    .from(lpPageReviewsTable)
    .where(eq(lpPageReviewsTable.token, token));

  if (!review) { res.status(404).json({ error: "Review not found" }); return; }

  const [page] = await db
    .select()
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, review.pageId));

  if (!page) { res.status(404).json({ error: "Page not found" }); return; }

  res.json({ review, page });
});

const UpdateReviewBody = z.object({
  reviewerName: z.string().min(1),
  status: z.enum(["approved", "changes_requested"]),
  decisionComment: z.string().optional(),
});

router.patch("/lp/review/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const parsed = UpdateReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [review] = await db
    .update(lpPageReviewsTable)
    .set({
      reviewerName: parsed.data.reviewerName,
      status: parsed.data.status,
      decisionComment: parsed.data.decisionComment ?? null,
      updatedAt: new Date(),
    })
    .where(eq(lpPageReviewsTable.token, token))
    .returning();

  if (!review) { res.status(404).json({ error: "Review not found" }); return; }
  res.json(review);
});

// ─── Presence ─────────────────────────────────────────────────────────────────

const PRESENCE_TTL_SECONDS = 30;

const UpsertPresenceBody = z.object({
  viewerId: z.string().min(1),
  displayName: z.string().min(1).default("Anonymous"),
});

router.post("/lp/pages/:pageId/presence", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid pageId" }); return; }

  const parsed = UpsertPresenceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db
    .insert(lpPagePresenceTable)
    .values({ pageId, viewerId: parsed.data.viewerId, displayName: parsed.data.displayName, lastSeen: new Date() })
    .onConflictDoNothing();

  await db
    .update(lpPagePresenceTable)
    .set({ displayName: parsed.data.displayName, lastSeen: new Date() })
    .where(and(eq(lpPagePresenceTable.pageId, pageId), eq(lpPagePresenceTable.viewerId, parsed.data.viewerId)));

  const cutoff = new Date(Date.now() - PRESENCE_TTL_SECONDS * 1000);
  const viewers = await db
    .select()
    .from(lpPagePresenceTable)
    .where(and(eq(lpPagePresenceTable.pageId, pageId), gt(lpPagePresenceTable.lastSeen, cutoff)));

  await db
    .delete(lpPagePresenceTable)
    .where(and(eq(lpPagePresenceTable.pageId, pageId), sql`last_seen < ${cutoff.toISOString()}`));

  res.json(viewers.slice(0, 5));
});

router.get("/lp/pages/:pageId/presence", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid pageId" }); return; }

  const cutoff = new Date(Date.now() - PRESENCE_TTL_SECONDS * 1000);
  const viewers = await db
    .select()
    .from(lpPagePresenceTable)
    .where(and(eq(lpPagePresenceTable.pageId, pageId), gt(lpPagePresenceTable.lastSeen, cutoff)));

  res.json(viewers.slice(0, 5));
});

export default router;
