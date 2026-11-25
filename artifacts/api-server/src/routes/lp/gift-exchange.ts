// Holiday gifting exchange for the Sales Console gifting page (Nov 2026).
//   GET    /lp/gifts/my-allocation?email=      → a rep's per-tier balance
//   GET    /lp/gifts/exchange                  → open posts + the signed-in rep's balance
//   POST   /lp/gifts/exchange/posts            → { kind: offer|request, tier, qty, note }; a request takes from the pile first
//   POST   /lp/gifts/exchange/posts/:id/act    → Claim (offer) or Give (request): { qty? } gifts, default 1
//   POST   /lp/gifts/exchange/drop-all         → put every free gift up for grabs
//   DELETE /lp/gifts/exchange/posts/:id        → poster cancels their own post
//   POST   /lp/gifts/exchange/send             → { toEmail, tier, qty, note }: give gifts straight to one rep
//   POST   /lp/gifts/exchange/thanks           → { giverEmail, message }: thank a rep for gifts they gave you
// Signed-in tenant users only; the acting rep is always the signed-in user.
// Allocation + recipient claims come from the gifting sheet (gift-status.ts);
// rep-to-rep moves live in lp_gift_transfers and are mirrored, best effort, to
// the sheet's Transfers tab. Claim / Give runs under a per-tenant advisory
// lock so two reps can't take the same gift or overdraw a balance.
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, lpGiftPostsTable, lpGiftTransfersTable, lpPagesTable } from "@workspace/db";
import { appendRowToTab } from "../../lib/google-sheets";
import { repGiftSummary, type GiftTierKey } from "../../lib/gift-sheet-status";
import { availableToOffer, balancesWithTransfers, claimCountLeaderboard, claimLeaderboard, dropAllPlan, parsePostInput, planPileFill, parseSendInput, parseThanks, transferForAction, type TierBalance } from "../../lib/gift-exchange";
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

/** Holiday gift pages (a gift-form block on the wizard's form) per rep_email, or one rep's count. */
function giftPageFilter(tenantId: number, formId: number | null) {
  return and(
    eq(lpPagesTable.tenantId, tenantId),
    eq(lpPagesTable.isTemplate, false),
    formId
      ? sql`exists (select 1 from jsonb_array_elements(${lpPagesTable.blocks}) b where b->>'type' = 'gift-form' and b->'props'->>'formId' = ${String(formId)})`
      : sql`${lpPagesTable.blocks} @> '[{"type":"gift-form"}]'::jsonb`,
  );
}

async function pagesByRep(tenantId: number, formId: number | null): Promise<Map<string, number>> {
  const rows = await db
    .select({ email: sql<string>`lower(${lpPagesTable.pageVariables}->>'rep_email')`, n: sql<number>`count(*)::int` })
    .from(lpPagesTable)
    .where(and(giftPageFilter(tenantId, formId), sql`coalesce(${lpPagesTable.pageVariables}->>'rep_email', '') <> ''`))
    .groupBy(sql`1`);
  return new Map(rows.map((r) => [r.email, r.n]));
}

function nameFor(allocations: Map<string, { name: string }> | undefined, email: string): string {
  return allocations?.get(email)?.name || email;
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
    const { configured, summary, balances, formId } = await repBalance(me.tenantId, email);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(lpPagesTable)
      .where(and(giftPageFilter(me.tenantId, formId), sql`lower(${lpPagesTable.pageVariables}->>'rep_email') = ${email}`));
    const sheet = formId ? await loadSheet(me.tenantId, formId) : null;
    const thanks = await db
      .select({ toEmail: lpGiftTransfersTable.toEmail, thanks: lpGiftTransfersTable.thanks, thankedAt: lpGiftTransfersTable.thankedAt })
      .from(lpGiftTransfersTable)
      .where(and(eq(lpGiftTransfersTable.tenantId, me.tenantId), sql`lower(${lpGiftTransfersTable.fromEmail}) = ${email}`, isNotNull(lpGiftTransfersTable.thanks)))
      .orderBy(desc(lpGiftTransfersTable.thankedAt))
      .limit(30);
    // One note per thank-you (a thanks covers every gift from that giver, so collapse repeats).
    const seen = new Set<string>();
    const notes = thanks.filter((t) => { const k = `${t.toEmail}|${t.thanks}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 3)
      .map((t) => ({ from: nameFor(sheet?.allocations, t.toEmail.toLowerCase()), message: t.thanks, at: t.thankedAt }));
    res.json({ email, configured, linksSent: n, allocated: summary.allocated, name: summary.name, tiers: balances, thanks: notes });
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
    const unthanked = await db
      .select({ fromEmail: lpGiftTransfersTable.fromEmail, tier: lpGiftTransfersTable.tier, qty: lpGiftTransfersTable.qty })
      .from(lpGiftTransfersTable)
      .where(and(eq(lpGiftTransfersTable.tenantId, me.tenantId), sql`lower(${lpGiftTransfersTable.toEmail}) = ${me.email}`, isNull(lpGiftTransfersTable.thanks)));
    const byGiver = new Map<string, { giverEmail: string; giverName: string; gifts: Record<string, number> }>();
    for (const t of unthanked) {
      const g = t.fromEmail.toLowerCase();
      const row = byGiver.get(g) ?? { giverEmail: g, giverName: nameFor(sheet?.allocations, g), gifts: {} };
      row.gifts[t.tier] = (row.gifts[t.tier] ?? 0) + t.qty;
      byGiver.set(g, row);
    }
    const pages = await pagesByRep(me.tenantId, formId);
    const board = claimLeaderboard(pages, sheet?.orders ?? [], sheet?.allocations);
    const myRank = board.findIndex((r) => r.email === me.email);
    const countBoard = claimCountLeaderboard(pages, sheet?.orders ?? [], sheet?.allocations);
    const myCountRank = countBoard.findIndex((r) => r.email === me.email);
    const reps = [...(sheet?.allocations?.values() ?? [])]
      .filter((r) => r.email !== me.email)
      .map((r) => ({ email: r.email, name: r.name }))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    res.json({
      me: me.email,
      balances,
      reps,
      toThank: [...byGiver.values()],
      leaderboard: { top: board.slice(0, 10).map(({ email, ...r }) => ({ ...r, me: email === me.email })), myRank: myRank >= 0 ? myRank + 1 : null, mine: myRank >= 0 ? board[myRank] : null, ranked: board.length, minPages: 5 },
      mostClaimed: { top: countBoard.slice(0, 10).map(({ email, ...r }) => ({ ...r, me: email === me.email })), myRank: myCountRank >= 0 ? myCountRank + 1 : null, mine: myCountRank >= 0 ? countBoard[myCountRank] : null, ranked: countBoard.length, minPages: 0 },
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
    const out = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NS}, ${me.tenantId})`);
      const { summary, balances } = await repBalance(me.tenantId, me.email, { tx });
      const filled: Array<{ postId: number; from: string; name: string; take: number }> = [];
      let qty = input.qty;
      if (input.kind === "offer") {
        const free = availableToOffer(balances, await openOffers(me.tenantId, tx), me.email, input.tier);
        if (free < input.qty) throw new HttpError(409, free === 0 ? `You don't have any ${TIER_LABEL[input.tier]} gifts free to give.` : `You only have ${free} ${TIER_LABEL[input.tier]} gift${free === 1 ? "" : "s"} free to give.`);
      } else {
        // A request takes what it can from the pile first; only the rest is posted.
        const pile = await tx.select().from(lpGiftPostsTable)
          .where(and(eq(lpGiftPostsTable.tenantId, me.tenantId), eq(lpGiftPostsTable.status, "open"), eq(lpGiftPostsTable.kind, "offer"), eq(lpGiftPostsTable.tier, input.tier)))
          .orderBy(asc(lpGiftPostsTable.createdAt));
        const giverLeft = new Map<string, number>();
        let fresh = true;
        for (const o of pile) {
          const g = o.repEmail.toLowerCase();
          if (g === me.email || giverLeft.has(g)) continue;
          giverLeft.set(g, leftOf((await repBalance(me.tenantId, g, { fresh, tx })).balances, input.tier));
          fresh = false;
        }
        const plan = planPileFill(pile, me.email, input.qty, giverLeft);
        for (const id of plan.exhausted) await tx.update(lpGiftPostsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(lpGiftPostsTable.id, id));
        for (const t of plan.takes) {
          const o = pile.find((p) => p.id === t.postId)!;
          await tx.insert(lpGiftTransfersTable).values({ tenantId: me.tenantId, postId: o.id, fromEmail: t.from, toEmail: me.email, tier: o.tier, qty: t.take, note: o.note });
          const remaining = o.remaining - t.take;
          await tx.update(lpGiftPostsTable).set({ remaining, status: remaining === 0 ? "done" : "open", updatedAt: new Date() }).where(eq(lpGiftPostsTable.id, o.id));
          filled.push({ postId: o.id, from: t.from, name: o.repName || t.from, take: t.take });
        }
        qty = plan.stillNeeded;
      }
      let id: number | null = null;
      if (qty > 0) {
        const [row] = await tx.insert(lpGiftPostsTable).values({
          tenantId: me.tenantId, kind: input.kind, repEmail: me.email, repName: summary.name, tier: input.tier, qty, remaining: qty, note: input.note,
        }).returning({ id: lpGiftPostsTable.id });
        id = row.id;
      }
      return { id, filled, posted: qty };
    });
    res.status(201).json({ id: out.id, posted: out.posted, filled: out.filled.map((f) => ({ name: f.name, qty: f.take })) });
    for (const f of out.filled) void mirrorToSheet(me.tenantId, { from: f.from, to: me.email, tier: input.tier, qty: f.take, post: `#${f.postId} offer (filled a request)`, note: input.note });
  } catch (err) {
    if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
    console.error("gift-exchange: post failed:", err);
    res.status(500).json({ error: "Couldn't post that." });
  }
});

router.post("/lp/gifts/exchange/drop-all", limiter, async (req, res): Promise<void> => {
  const me = signedIn(req, res);
  if (!me) return;
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 280) : "";
  try {
    const dropped = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NS}, ${me.tenantId})`);
      const { summary, balances } = await repBalance(me.tenantId, me.email, { fresh: true, tx });
      const plan = dropAllPlan(balances, await openOffers(me.tenantId, tx), me.email);
      if (!plan.length) throw new HttpError(409, "You don't have any free gifts to drop.");
      for (const t of plan) {
        await tx.insert(lpGiftPostsTable).values({ tenantId: me.tenantId, kind: "offer", repEmail: me.email, repName: summary.name, tier: t.tier, qty: t.qty, remaining: t.qty, note });
      }
      return plan;
    });
    res.status(201).json({ dropped });
  } catch (err) {
    if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
    console.error("gift-exchange: drop-all failed:", err);
    res.status(500).json({ error: "Couldn't drop your gifts." });
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
      const want = Math.max(1, Math.min(Number.isInteger(Number(req.body?.qty)) ? Number(req.body.qty) : 1, post.remaining, 50));
      const { balances } = await repBalance(me.tenantId, move.from, { fresh: true, tx });
      const has = leftOf(balances, post.tier);
      if (has < 1) {
        if (post.kind === "offer") {
          await tx.update(lpGiftPostsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(lpGiftPostsTable.id, post.id));
          throw new HttpError(409, `${post.repName || post.repEmail} has no ${TIER_LABEL[post.tier as GiftTierKey] ?? post.tier} gifts left, so this post is closed.`);
        }
        throw new HttpError(409, `You don't have any ${TIER_LABEL[post.tier as GiftTierKey] ?? post.tier} gifts left to give.`);
      }
      const n = Math.min(want, has);
      await tx.insert(lpGiftTransfersTable).values({ tenantId: me.tenantId, postId: post.id, fromEmail: move.from, toEmail: move.to, tier: post.tier, qty: n, note: post.note });
      const remaining = post.remaining - n;
      await tx.update(lpGiftPostsTable).set({ remaining, status: remaining === 0 ? "done" : "open", updatedAt: new Date() }).where(eq(lpGiftPostsTable.id, post.id));
      return { post, move, remaining, n };
    });
    res.json({ ok: true, remaining: done.remaining, moved: done.n });
    // Mirror to the sheet after responding; the DB is the record, so a failure only logs.
    void mirrorToSheet(me.tenantId, { from: done.move.from, to: done.move.to, tier: done.post.tier, qty: done.n, post: `#${done.post.id} ${done.post.kind}`, note: done.post.note });
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

router.post("/lp/gifts/exchange/thanks", limiter, async (req, res): Promise<void> => {
  const me = signedIn(req, res);
  if (!me) return;
  const input = parseThanks(req.body);
  if ("error" in input) { res.status(400).json({ error: input.error }); return; }
  try {
    const updated = await db
      .update(lpGiftTransfersTable)
      .set({ thanks: input.message, thankedAt: new Date() })
      .where(and(
        eq(lpGiftTransfersTable.tenantId, me.tenantId),
        sql`lower(${lpGiftTransfersTable.toEmail}) = ${me.email}`,
        sql`lower(${lpGiftTransfersTable.fromEmail}) = ${input.giverEmail}`,
        isNull(lpGiftTransfersTable.thanks),
      ))
      .returning({ id: lpGiftTransfersTable.id });
    if (!updated.length) { res.status(404).json({ error: "Nothing from that rep left to thank them for." }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error("gift-exchange: thanks failed:", err);
    res.status(500).json({ error: "Couldn't send your thanks." });
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
