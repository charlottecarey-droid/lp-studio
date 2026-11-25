// Holiday gifting exchange for the Sales Console gifting page (Nov 2026).
//   GET    /lp/gifts/my-allocation?email=      → a rep's per-tier balance
//   GET    /lp/gifts/exchange                  → open posts + the signed-in rep's balance
//   POST   /lp/gifts/exchange/posts            → { kind: offer|request, tier, qty, note }
//   POST   /lp/gifts/exchange/posts/:id/act    → Claim (offer) or Give (request): moves ONE gift
//   DELETE /lp/gifts/exchange/posts/:id        → poster cancels their own post
//   POST   /lp/gifts/exchange/send             → { toEmail, tier, qty, note }: give gifts straight to one rep
// Signed-in tenant users only; the acting rep is always the signed-in user.
// Allocation + recipient claims come from the gifting sheet (gift-status.ts);
// rep-to-rep moves live in lp_gift_transfers and are mirrored, best effort, to
// the sheet's Transfers tab. Claim / Give runs under a per-tenant advisory
// lock so two reps can't take the same gift or overdraw a balance.
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, lpGiftPostsTable, lpGiftTransfersTable, lpPagesTable } from "@workspace/db";
import { appendRowToTab } from "../../lib/google-sheets";
import { repGiftSummary, type GiftTierKey } from "../../lib/gift-sheet-status";
import { availableToOffer, balancesWithTransfers, parsePostInput, parseSendInput, transferForAction, type TierBalance } from "../../lib/gift-exchange";
import { giftSheetConfig, giftSourceFormId, loadSheet } from "./gift-status";

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const TRANSFERS_TAB = "Transfers";
const TRANSFERS_HEADER = ["Timestamp", "From", "To", "Tier", "Qty", "Post", "Note"];
const TIER_LABEL: Record<GiftTierKey, string> = { premium: "Premium", mid: "Mid-value", swag: "Swag" };
const LOCK_NS = 74219; // advisory-lock namespace for the gift exchange

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

function signedIn(req: Request, res: Response): { tenantId: number; email: string } | null {
  const u = (req as { authUser?: { tenantId?: number | null; email?: string | null } }).authUser;
  const tenantId = typeof u?.tenantId === "number" ? u.tenantId : null;
  const email = String(u?.email ?? "").trim().toLowerCase();
  if (!tenantId || !email) { res.status(401).json({ error: "Sign in to see gifts." }); return null; }
  return { tenantId, email };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A rep's balance: sheet allocation and claims (fresh read when `fresh`) plus DB transfers. */
async function repBalance(tenantId: number, email: string, opts: { fresh?: boolean; tx?: Tx } = {}) {
  const formId = await giftSourceFormId(tenantId);
  const data = formId ? await loadSheet(tenantId, formId, !!opts.fresh) : null;
  const q = opts.tx ?? db;
  const transfers = await q
    .select({ fromEmail: lpGiftTransfersTable.fromEmail, toEmail: lpGiftTransfersTable.toEmail, tier: lpGiftTransfersTable.tier, qty: lpGiftTransfersTable.qty })
    .from(lpGiftTransfersTable)
    .where(and(eq(lpGiftTransfersTable.tenantId, tenantId), sql`(lower(${lpGiftTransfersTable.fromEmail}) = ${email} or lower(${lpGiftTransfersTable.toEmail}) = ${email})`));
  const summary = data ? repGiftSummary(data, email) : { allocated: false, name: "", tiers: [], untiered: 0 };
  return { configured: !!data?.allocations?.size, formId, summary, balances: balancesWithTransfers(summary, transfers, email) };
}

async function openOffers(tenantId: number, q: Tx | typeof db = db) {
  return q
    .select({ repEmail: lpGiftPostsTable.repEmail, tier: lpGiftPostsTable.tier, remaining: lpGiftPostsTable.remaining })
    .from(lpGiftPostsTable)
    .where(and(eq(lpGiftPostsTable.tenantId, tenantId), eq(lpGiftPostsTable.status, "open"), eq(lpGiftPostsTable.kind, "offer")));
}

function leftOf(balances: TierBalance[], tier: string): number {
  return balances.find((b) => b.tier === tier)?.left ?? 0;
}

router.get("/lp/gifts/my-allocation", limiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const me = signedIn(req, res);
  if (!me) return;
  const email = String(req.query.email ?? me.email).trim().toLowerCase();
  if (!email.includes("@")) { res.status(400).json({ error: "email is required" }); return; }
  try {
    const { configured, summary, balances } = await repBalance(me.tenantId, email);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(lpPagesTable)
      .where(and(
        eq(lpPagesTable.tenantId, me.tenantId),
        eq(lpPagesTable.isTemplate, false),
        sql`lower(${lpPagesTable.pageVariables}->>'rep_email') = ${email}`,
        sql`${lpPagesTable.blocks} @> '[{"type":"gift-form"}]'::jsonb`,
      ));
    res.json({ email, configured, linksSent: n, allocated: summary.allocated, name: summary.name, tiers: balances });
  } catch (err) {
    console.error("gift-exchange: allocation failed:", err);
    res.status(500).json({ error: "Couldn't load the gift allocation." });
  }
});

router.get("/lp/gifts/exchange", limiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const me = signedIn(req, res);
  if (!me) return;
  try {
    const posts = await db
      .select()
      .from(lpGiftPostsTable)
      .where(and(eq(lpGiftPostsTable.tenantId, me.tenantId), eq(lpGiftPostsTable.status, "open")))
      .orderBy(desc(lpGiftPostsTable.createdAt))
      .limit(200);
    const { balances } = await repBalance(me.tenantId, me.email);
    const formId = await giftSourceFormId(me.tenantId);
    const sheet = formId ? await loadSheet(me.tenantId, formId) : null;
    const reps = [...(sheet?.allocations?.values() ?? [])]
      .filter((r) => r.email !== me.email)
      .map((r) => ({ email: r.email, name: r.name }))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    res.json({
      me: me.email,
      balances,
      reps,
      posts: posts.map((p) => ({ id: p.id, kind: p.kind, repEmail: p.repEmail, repName: p.repName, tier: p.tier, qty: p.qty, remaining: p.remaining, note: p.note, createdAt: p.createdAt, mine: p.repEmail.toLowerCase() === me.email })),
    });
  } catch (err) {
    console.error("gift-exchange: list failed:", err);
    res.status(500).json({ error: "Couldn't load gift posts." });
  }
});

router.post("/lp/gifts/exchange/posts", limiter, async (req, res): Promise<void> => {
  const me = signedIn(req, res);
  if (!me) return;
  const input = parsePostInput(req.body);
  if ("error" in input) { res.status(400).json({ error: input.error }); return; }
  try {
    const post = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NS}, ${me.tenantId})`);
      const { summary, balances } = await repBalance(me.tenantId, me.email, { tx });
      if (input.kind === "offer") {
        const free = availableToOffer(balances, await openOffers(me.tenantId, tx), me.email, input.tier);
        if (free < input.qty) throw new HttpError(409, free === 0 ? `You don't have any ${TIER_LABEL[input.tier]} gifts free to give.` : `You only have ${free} ${TIER_LABEL[input.tier]} gift${free === 1 ? "" : "s"} free to give.`);
      }
      const [row] = await tx.insert(lpGiftPostsTable).values({
        tenantId: me.tenantId, kind: input.kind, repEmail: me.email, repName: summary.name, tier: input.tier, qty: input.qty, remaining: input.qty, note: input.note,
      }).returning();
      return row;
    });
    res.status(201).json({ id: post.id });
  } catch (err) {
    if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
    console.error("gift-exchange: post failed:", err);
    res.status(500).json({ error: "Couldn't post that." });
  }
});

router.post("/lp/gifts/exchange/posts/:id/act", limiter, async (req, res): Promise<void> => {
  const me = signedIn(req, res);
  if (!me) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Bad post id" }); return; }
  try {
    const done = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NS}, ${me.tenantId})`);
      const [post] = await tx.select().from(lpGiftPostsTable).where(and(eq(lpGiftPostsTable.tenantId, me.tenantId), eq(lpGiftPostsTable.id, id)));
      if (!post || post.status !== "open" || post.remaining < 1) throw new HttpError(409, "That post is already closed.");
      const move = transferForAction(post, me.email);
      if ("error" in move) throw new HttpError(400, move.error);
      // The giver's balance, with recipient claims read fresh from the sheet.
      const { balances } = await repBalance(me.tenantId, move.from, { fresh: true, tx });
      if (leftOf(balances, post.tier) < 1) {
        if (post.kind === "offer") {
          await tx.update(lpGiftPostsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(lpGiftPostsTable.id, post.id));
          throw new HttpError(409, `${post.repName || post.repEmail} has no ${TIER_LABEL[post.tier as GiftTierKey] ?? post.tier} gifts left, so this post is closed.`);
        }
        throw new HttpError(409, `You don't have any ${TIER_LABEL[post.tier as GiftTierKey] ?? post.tier} gifts left to give.`);
      }
      await tx.insert(lpGiftTransfersTable).values({ tenantId: me.tenantId, postId: post.id, fromEmail: move.from, toEmail: move.to, tier: post.tier, qty: 1, note: post.note });
      const remaining = post.remaining - 1;
      await tx.update(lpGiftPostsTable).set({ remaining, status: remaining === 0 ? "done" : "open", updatedAt: new Date() }).where(eq(lpGiftPostsTable.id, post.id));
      return { post, move, remaining };
    });
    res.json({ ok: true, remaining: done.remaining });
    // Mirror to the sheet after responding; the DB is the record, so a failure only logs.
    void mirrorToSheet(me.tenantId, { from: done.move.from, to: done.move.to, tier: done.post.tier, qty: 1, post: `#${done.post.id} ${done.post.kind}`, note: done.post.note });
  } catch (err) {
    if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
    console.error("gift-exchange: act failed:", err);
    res.status(500).json({ error: "Couldn't move that gift." });
  }
});

/** Best-effort copy of a move to the sheet's Transfers tab; the DB is the record. */
async function mirrorToSheet(tenantId: number, row: { from: string; to: string; tier: string; qty: number; post: string; note: string }): Promise<void> {
  try {
    const formId = await giftSourceFormId(tenantId);
    const cfg = formId ? await giftSheetConfig(tenantId, formId) : null;
    if (!cfg) return;
    await appendRowToTab(cfg, TRANSFERS_TAB, TRANSFERS_HEADER, [new Date().toISOString(), row.from, row.to, TIER_LABEL[row.tier as GiftTierKey] ?? row.tier, row.qty, row.post, row.note]);
  } catch (err) {
    console.error("gift-exchange: Transfers tab append failed:", err);
  }
}

router.post("/lp/gifts/exchange/send", limiter, async (req, res): Promise<void> => {
  const me = signedIn(req, res);
  if (!me) return;
  const input = parseSendInput(req.body, me.email);
  if ("error" in input) { res.status(400).json({ error: input.error }); return; }
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NS}, ${me.tenantId})`);
      const { balances, formId } = await repBalance(me.tenantId, me.email, { fresh: true, tx });
      const sheet = formId ? await loadSheet(me.tenantId, formId) : null;
      if (!sheet?.allocations?.has(input.toEmail)) throw new HttpError(400, "That person isn't on the gifting sheet's Allocations tab.");
      const free = availableToOffer(balances, await openOffers(me.tenantId, tx), me.email, input.tier);
      if (free < input.qty) throw new HttpError(409, free === 0 ? `You don't have any ${TIER_LABEL[input.tier]} gifts free to give.` : `You only have ${free} ${TIER_LABEL[input.tier]} gift${free === 1 ? "" : "s"} free to give.`);
      await tx.insert(lpGiftTransfersTable).values({ tenantId: me.tenantId, postId: null, fromEmail: me.email, toEmail: input.toEmail, tier: input.tier, qty: input.qty, note: input.note });
    });
    res.json({ ok: true });
    void mirrorToSheet(me.tenantId, { from: me.email, to: input.toEmail, tier: input.tier, qty: input.qty, post: "direct", note: input.note });
  } catch (err) {
    if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
    console.error("gift-exchange: send failed:", err);
    res.status(500).json({ error: "Couldn't give those gifts." });
  }
});

router.delete("/lp/gifts/exchange/posts/:id", limiter, async (req, res): Promise<void> => {
  const me = signedIn(req, res);
  if (!me) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Bad post id" }); return; }
  try {
    const updated = await db
      .update(lpGiftPostsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(lpGiftPostsTable.tenantId, me.tenantId), eq(lpGiftPostsTable.id, id), eq(lpGiftPostsTable.status, "open"), sql`lower(${lpGiftPostsTable.repEmail}) = ${me.email}`))
      .returning({ id: lpGiftPostsTable.id });
    if (!updated.length) { res.status(404).json({ error: "That post isn't yours or is already closed." }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error("gift-exchange: cancel failed:", err);
    res.status(500).json({ error: "Couldn't remove that post." });
  }
});

export default router;
