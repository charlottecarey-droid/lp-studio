import { Router } from "express";
import { eq, and, gt, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  lpPageCommentsTable,
  lpPageReviewsTable,
  lpPagePresenceTable,
  lpPagesTable,
} from "@workspace/db";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// ─── Email Helpers ─────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function getTenantUserEmails(tenantId: number): Promise<Array<{ email: string; name: string }>> {
  const { rows } = await pool.query<{ email: string; name: string }>(
    `SELECT email, name FROM app_users WHERE tenant_id = $1 AND email IS NOT NULL`,
    [tenantId]
  );
  return rows;
}

async function sendCollaborationEmail(to: string[], subject: string, html: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey || to.length === 0) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <notifications@ent.meetdandy.com>",
        to,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error("Failed to send collaboration email", err);
  }
}

async function notifyNewComment(pageId: number, authorName: string, message: string, pageUrl?: string) {
  try {
    const [page] = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, tenantId: lpPagesTable.tenantId })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.id, pageId));
    if (!page?.tenantId) return;
    const users = await getTenantUserEmails(page.tenantId);
    const to = users.map(u => u.email).filter(Boolean);
    if (to.length === 0) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
  <div style="background:#003A30;padding:20px 28px">
    <h1 style="margin:0;color:#C7E738;font-size:17px;font-weight:700">New Comment</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px">${escapeHtml(page.title)}</p>
  </div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#003A30">${escapeHtml(authorName)}</p>
    <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.6">${escapeHtml(message)}</p>
    ${pageUrl ? `<div style="margin-top:20px"><a href="${escapeHtml(pageUrl)}" style="background:#003A30;color:#C7E738;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">View Page →</a></div>` : ""}
  </div>
</div>
</body></html>`;
    await sendCollaborationEmail(to, `💬 New comment on "${page.title}"`, html);
  } catch (err) {
    console.error("notifyNewComment failed", err);
  }
}

async function notifyReviewDecision(pageId: number, reviewerName: string, status: string, decisionComment?: string | null) {
  try {
    const [page] = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, tenantId: lpPagesTable.tenantId })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.id, pageId));
    if (!page?.tenantId) return;
    const users = await getTenantUserEmails(page.tenantId);
    const to = users.map(u => u.email).filter(Boolean);
    if (to.length === 0) return;
    const isApproved = status === "approved";
    const statusLabel = isApproved ? "✅ Approved" : "🔄 Changes Requested";
    const statusColor = isApproved ? "#16a34a" : "#d97706";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
  <div style="background:#003A30;padding:20px 28px">
    <h1 style="margin:0;color:#C7E738;font-size:17px;font-weight:700">Review Decision</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px">${escapeHtml(page.title)}</p>
  </div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 12px;font-size:15px;color:#1e293b"><strong>${escapeHtml(reviewerName)}</strong> reviewed your page.</p>
    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:${statusColor}">${statusLabel}</p>
    ${decisionComment ? `<p style="margin:0;font-size:14px;color:#475569;line-height:1.6;background:#f8fafc;border-left:3px solid ${statusColor};padding:12px 16px;border-radius:4px">${escapeHtml(decisionComment)}</p>` : ""}
  </div>
</div>
</body></html>`;
    await sendCollaborationEmail(to, `${statusLabel}: "${page.title}"`, html);
  } catch (err) {
    console.error("notifyReviewDecision failed", err);
  }
}

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

  // Fire-and-forget email notification for top-level comments only
  if (!parsed.data.parentId) {
    void notifyNewComment(pageId, parsed.data.authorName, parsed.data.message);
  }

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

  res.status(201).json({ ...review, reviewUrl: `/review/${token}` });
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

  // Fire-and-forget email notification for approved / changes_requested decisions
  void notifyReviewDecision(review.pageId, parsed.data.reviewerName, parsed.data.status, parsed.data.decisionComment);

  res.json(review);
});

router.delete("/lp/pages/:pageId/reviews/:reviewId", async (req, res): Promise<void> => {
  const pageId = parseInt(req.params.pageId, 10);
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(pageId) || isNaN(reviewId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(lpPageReviewsTable)
    .where(and(eq(lpPageReviewsTable.id, reviewId), eq(lpPageReviewsTable.pageId, pageId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Review not found" }); return; }
  res.json({ success: true });
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

  try {
    await db
      .insert(lpPagePresenceTable)
      .values({ pageId, viewerId: parsed.data.viewerId, displayName: parsed.data.displayName, lastSeen: new Date() })
      .onConflictDoNothing();
  } catch (err: any) {
    // Page was deleted while the builder tab was still open — FK violation.
    // Return 404 so the client knows the page is gone.
    if (err?.message?.includes("foreign key constraint")) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    throw err;
  }

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
