/**
 * Daily holiday-gifting summary for Slack (Nov 2026) — pure builder.
 * The poller (lib/giftingDigestPoller.ts) gathers the numbers; this turns them
 * into Block Kit, leaving out empty sections, and returns null on a day with no
 * activity so the channel isn't spammed with zeros.
 */
import type { GiftTierKey } from "./gift-sheet-status";

export interface DigestInput {
  now: Date;
  /** Claims in the window, by tier (fallback swag counts as swag). */
  claimedInWindow: Record<GiftTierKey, number>;
  pagesInWindow: number;
  /** Rep-to-rep moves and new posts in the window (activity, not shown as numbers). */
  exchangeActivity: number;
  /** Campaign to date per tier: claimed of ordered. */
  totals: Record<GiftTierKey, { claimed: number; ordered: number }>;
  offers: Array<{ name: string; tier: GiftTierKey; remaining: number }>;
  requests: Array<{ name: string; tier: GiftTierKey; remaining: number }>;
  mostClaimed: Array<{ name: string; claimed: number }>;
  bestRate: Array<{ name: string; rate: number }>;
  /** Gifts at or under 10% of stock (0 = sold out). */
  runningLow: Array<{ name: string; left: number }>;
  appUrl: string;
  timeZone?: string;
}

const LABEL: Record<GiftTierKey, string> = { premium: "Premium", mid: "Mid-value", swag: "Swag" };
const TIERS: GiftTierKey[] = ["premium", "mid", "swag"];

/** Gifts at or under 10% of their ordered quantity (always including sold out), lowest first. */
export function runningLowGifts(gifts: Array<{ name: string; ordered: number; claimed: number }>): Array<{ name: string; left: number }> {
  return gifts
    .filter((g) => g.ordered > 0 && g.ordered - g.claimed <= Math.max(0, Math.floor(g.ordered * 0.1)))
    .map((g) => ({ name: g.name, left: Math.max(0, g.ordered - g.claimed) }))
    .sort((a, b) => a.left - b.left || a.name.localeCompare(b.name));
}

function groupByPerson(rows: Array<{ name: string; tier: GiftTierKey; remaining: number }>): string {
  return rows.slice(0, 6).map((r) => `${r.remaining} ${LABEL[r.tier]} (${r.name})`).join(", ") + (rows.length > 6 ? ` and ${rows.length - 6} more` : "");
}

export function buildGiftingDigest(d: DigestInput, opts: { force?: boolean } = {}): { text: string; blocks: unknown[] } | null {
  const claimedToday = TIERS.reduce((n, t) => n + d.claimedInWindow[t], 0);
  if (!opts.force && claimedToday + d.pagesInWindow + d.exchangeActivity === 0) return null;

  const date = new Intl.DateTimeFormat("en-US", { timeZone: d.timeZone ?? "America/Chicago", weekday: "short", month: "short", day: "numeric" }).format(d.now);
  const lines: string[] = [];
  const since: string[] = [];
  if (claimedToday) {
    const parts = TIERS.filter((t) => d.claimedInWindow[t]).map((t) => `${d.claimedInWindow[t]} ${LABEL[t]}`);
    since.push(`${claimedToday} gift${claimedToday === 1 ? "" : "s"} claimed (${parts.join(", ")})`);
  }
  if (d.pagesInWindow) since.push(`${d.pagesInWindow} new gift page${d.pagesInWindow === 1 ? "" : "s"} sent`);
  lines.push(since.length ? `*Since the last update:* ${since.join(" · ")}` : "*Since the last update:* no new claims or pages");

  const total = TIERS.reduce((n, t) => n + d.totals[t].claimed, 0);
  const ordered = TIERS.reduce((n, t) => n + d.totals[t].ordered, 0);
  if (ordered) lines.push(`*Campaign so far:* ${total} of ${ordered} claimed · ${TIERS.map((t) => `${LABEL[t]} ${d.totals[t].claimed}/${d.totals[t].ordered}`).join(" · ")}`);
  if (d.offers.length) lines.push(`*Up for grabs:* ${groupByPerson(d.offers)}`);
  if (d.requests.length) lines.push(`*Reps hunting:* ${groupByPerson(d.requests)}`);
  if (d.mostClaimed.length) lines.push(`:trophy: *Most claimed:* ${d.mostClaimed.slice(0, 3).map((r) => `${r.name} ${r.claimed}`).join(" · ")}`);
  if (d.bestRate.length) lines.push(`:dart: *Best claim rate:* ${d.bestRate.slice(0, 3).map((r) => `${r.name} ${Math.round(r.rate * 100)}%`).join(" · ")}`);
  if (d.runningLow.length) lines.push(`:warning: *Running low:* ${d.runningLow.slice(0, 5).map((g) => (g.left ? `${g.name} (${g.left} left)` : `${g.name} (sold out)`)).join(", ")}`);

  const title = `:gift: Holiday gifting, ${date}`;
  return {
    text: `${title}: ${claimedToday} gifts claimed since the last update`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${title}*` } },
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open the gift exchange" }, url: d.appUrl }] },
    ],
  };
}

/** Chicago-time pieces for scheduling: YYYY-MM-DD, hour 0–23, and weekday 0 (Sun)–6. */
export function zonedClock(now: Date, timeZone = "America/Chicago"): { date: string; hour: number; weekday: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(now).map((p) => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday };
}

/** Due when it's a weekday, at or past the configured hour, and not yet sent today (Chicago time). */
export function digestDue(now: Date, cfg: { enabled?: boolean; channelId?: string; hour?: number; lastSentDate?: string }): boolean {
  if (!cfg.enabled || !cfg.channelId) return false;
  const c = zonedClock(now);
  if (c.weekday === 0 || c.weekday === 6) return false;
  return c.hour >= (Number.isInteger(cfg.hour) ? cfg.hour! : 9) && cfg.lastSentDate !== c.date;
}

export interface GiftingDigestSettings { enabled: boolean; channelId: string; hour: number; lastSentDate?: string; lastSentAt?: string }

/** Settings from slack_connections.metadata.giftingDigest, with defaults (off, 9am). */
export function readDigestSettings(metadata: unknown): GiftingDigestSettings {
  const g = ((metadata ?? {}) as { giftingDigest?: Partial<GiftingDigestSettings> }).giftingDigest ?? {};
  const hour = Number(g.hour);
  return {
    enabled: g.enabled === true,
    channelId: typeof g.channelId === "string" ? g.channelId.trim() : "",
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9,
    lastSentDate: typeof g.lastSentDate === "string" ? g.lastSentDate : undefined,
    lastSentAt: typeof g.lastSentAt === "string" ? g.lastSentAt : undefined,
  };
}

/** Validates a settings PATCH: channel ids look like C…/G…, hour 0–23. */
export function parseDigestSettingsPatch(body: unknown): Partial<GiftingDigestSettings> | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: Partial<GiftingDigestSettings> = {};
  if (b.enabled !== undefined) out.enabled = b.enabled === true;
  if (b.channelId !== undefined) {
    const id = String(b.channelId).trim();
    if (id && !/^[CG][A-Z0-9]{6,}$/.test(id)) return { error: "That doesn't look like a Slack channel ID (it starts with C, e.g. C0CLWPPUKKP)." };
    out.channelId = id;
  }
  if (b.hour !== undefined) {
    const h = Number(b.hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) return { error: "Hour must be 0–23." };
    out.hour = h;
  }
  return out;
}
