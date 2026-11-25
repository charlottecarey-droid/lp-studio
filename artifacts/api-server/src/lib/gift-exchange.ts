/**
 * Holiday gifting exchange — pure rules (Nov 2026). Reps post gifts "up for
 * grabs" (offers) or ask for gifts (requests); each Claim / Give moves ONE gift.
 * The routes (routes/lp/gift-exchange.ts) do the locking, reading and writing.
 */
import { GIFT_TIER_KEYS, type GiftOrderRow, type GiftTierKey, type RepAllocation, type RepGiftSummary } from "./gift-sheet-status";

export type GiftPostKind = "offer" | "request";
export interface TransferLike { fromEmail: string; toEmail: string; tier: string; qty: number }
export interface OpenOfferLike { repEmail: string; tier: string; remaining: number }

export interface TierBalance { tier: GiftTierKey; allocated: number; redeemed: number; received: number; given: number; left: number }

/** Per-tier balance: allocated − claimed by recipients + received − given. */
export function balancesWithTransfers(summary: Pick<RepGiftSummary, "tiers">, transfers: TransferLike[], email: string): TierBalance[] {
  const me = email.trim().toLowerCase();
  return GIFT_TIER_KEYS.map((tier) => {
    const base = summary.tiers.find((t) => t.tier === tier) ?? { allocated: 0, redeemed: 0 };
    let received = 0;
    let given = 0;
    for (const t of transfers) {
      if (t.tier !== tier) continue;
      if (t.toEmail.toLowerCase() === me) received += t.qty;
      if (t.fromEmail.toLowerCase() === me) given += t.qty;
    }
    return { tier, allocated: base.allocated, redeemed: base.redeemed, received, given, left: base.allocated - base.redeemed + received - given };
  });
}

/** What a rep can still put up for grabs: left, minus what their open offers already promise. */
export function availableToOffer(balances: TierBalance[], openOffers: OpenOfferLike[], email: string, tier: GiftTierKey): number {
  const me = email.trim().toLowerCase();
  const left = balances.find((b) => b.tier === tier)?.left ?? 0;
  const promised = openOffers
    .filter((o) => o.repEmail.toLowerCase() === me && o.tier === tier)
    .reduce((n, o) => n + o.remaining, 0);
  return Math.max(0, left - promised);
}

export interface PostInput { kind: GiftPostKind; tier: GiftTierKey; qty: number; note: string }

/** Validates a new post's body. Quantity 1–50, note trimmed to 280 characters. */
export function parsePostInput(body: unknown): PostInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind === "offer" || b.kind === "request" ? b.kind : null;
  if (!kind) return { error: "Choose whether you're giving gifts away or asking for them." };
  const tier = GIFT_TIER_KEYS.find((t) => t === b.tier);
  if (!tier) return { error: "Choose Premium, Mid-value or Swag." };
  const qty = Number(b.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { error: "Quantity must be between 1 and 50." };
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 280) : "";
  return { kind, tier, qty, note };
}

/**
 * Who gives and who receives when `actorEmail` clicks a post's button:
 * Claim on an offer moves a gift poster → actor; Give on a request moves actor → poster.
 */
export function transferForAction(post: { kind: string; repEmail: string }, actorEmail: string): { from: string; to: string } | { error: string } {
  const actor = actorEmail.trim().toLowerCase();
  const poster = post.repEmail.trim().toLowerCase();
  if (!actor) return { error: "Sign in to trade gifts." };
  if (actor === poster) return { error: "That's your own post." };
  if (post.kind === "offer") return { from: poster, to: actor };
  if (post.kind === "request") return { from: actor, to: poster };
  return { error: "Unknown post type." };
}

export interface SendInput { toEmail: string; tier: GiftTierKey; qty: number; note: string }

/** Validates a direct give to one rep: recipient email, tier, quantity 1–50, note ≤ 280. */
export function parseSendInput(body: unknown, fromEmail: string): SendInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const toEmail = typeof b.toEmail === "string" ? b.toEmail.trim().toLowerCase() : "";
  if (!toEmail.includes("@")) return { error: "Choose who to give gifts to." };
  if (toEmail === fromEmail.trim().toLowerCase()) return { error: "You can't give gifts to yourself." };
  const tier = GIFT_TIER_KEYS.find((t) => t === b.tier);
  if (!tier) return { error: "Choose Premium, Mid-value or Swag." };
  const qty = Number(b.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { error: "Quantity must be between 1 and 50." };
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 280) : "";
  return { toEmail, tier, qty, note };
}

/** A thank-you note: trimmed, 1–200 characters. */
export function parseThanks(body: unknown): { giverEmail: string; message: string } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const giverEmail = typeof b.giverEmail === "string" ? b.giverEmail.trim().toLowerCase() : "";
  if (!giverEmail.includes("@")) return { error: "Who are you thanking?" };
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 200) : "";
  if (!message) return { error: "Write a quick thank-you first." };
  return { giverEmail, message };
}

export interface LeaderRow { email: string; name: string; pagesSent: number; claimed: number; rate: number }

/**
 * Claim-rate leaderboard: per rep, recipient claims (orders with their Rep email)
 * ÷ gift pages sent. Reps need `minPages` pages to rank, so one lucky page
 * doesn't top the board. Sorted by rate, then claims, then name.
 */
export function claimLeaderboard(
  pagesByRep: Map<string, number>,
  orders: Pick<GiftOrderRow, "repEmail">[],
  allocations: Map<string, RepAllocation> | undefined,
  minPages = 5,
): LeaderRow[] {
  const claims = new Map<string, number>();
  for (const o of orders) if (o.repEmail) claims.set(o.repEmail, (claims.get(o.repEmail) ?? 0) + 1);
  const rows: LeaderRow[] = [];
  for (const [email, pagesSent] of pagesByRep) {
    if (pagesSent < minPages) continue;
    const claimed = claims.get(email) ?? 0;
    rows.push({ email, name: allocations?.get(email)?.name || email, pagesSent, claimed, rate: Math.min(1, claimed / pagesSent) });
  }
  return rows.sort((a, b) => b.rate - a.rate || b.claimed - a.claimed || a.name.localeCompare(b.name));
}
