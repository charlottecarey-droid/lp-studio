/**
 * The wins feed's extras: photos, tagging people ("@Dana Lee"), emoji
 * reactions, and the emails that tell someone they were tagged or that their
 * post got a comment. Pure helpers; the routes do the reading and writing.
 *
 * Tagging never exposes an address: the page gets each person's name and an
 * opaque key, sends the keys back, and the server turns keys into addresses.
 */
import crypto from "crypto";

/* ── Reactions ───────────────────────────────────────────────────────────── */

export const ROOM_REACTIONS = ["❤️", "👏", "🎉", "🔥", "🙌", "💪"] as const;
export const DEFAULT_REACTION = ROOM_REACTIONS[0];

/** The reaction asked for; the heart when none is named; null when it isn't one we offer. */
export function parseReaction(raw: unknown): string | null {
  if (raw == null || raw === "") return DEFAULT_REACTION;
  return typeof raw === "string" && (ROOM_REACTIONS as readonly string[]).includes(raw) ? raw : null;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Counts per emoji in the order we offer them, leaving out any nobody used. */
export function countReactions(rows: { emoji: string; email: string }[], viewerEmail: string | null): ReactionCount[] {
  const out: ReactionCount[] = [];
  for (const emoji of ROOM_REACTIONS) {
    const mine = rows.filter((r) => r.emoji === emoji);
    if (mine.length > 0) out.push({ emoji, count: mine.length, mine: !!viewerEmail && mine.some((r) => r.email === viewerEmail) });
  }
  return out;
}

/* ── Photos ──────────────────────────────────────────────────────────────── */

export const WIN_IMAGE_MAX = 4;
const HOSTED_IMAGE_RE = /^\/api\/storage\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Only files we host ourselves, at most four, no repeats. Anything else is dropped. */
export function parseWinImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && HOSTED_IMAGE_RE.test(v) && !out.includes(v)) out.push(v);
    if (out.length === WIN_IMAGE_MAX) break;
  }
  return out;
}

/* ── People who can be tagged ────────────────────────────────────────────── */

export interface RoomPerson {
  key: string;
  name: string;
  email: string;
}

/** Stable per room and address, and says nothing about the address. */
export function personKey(pageId: number, email: string): string {
  return crypto.createHash("sha256").update(`room-person:${pageId}:${email.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One entry per address, first name seen wins; people with no name or no address can't be tagged. */
export function buildRoomPeople(pageId: number, sources: { name?: string | null; email?: string | null }[]): RoomPerson[] {
  const seen = new Map<string, RoomPerson>();
  for (const s of sources) {
    const email = (s.email ?? "").trim().toLowerCase();
    const name = (s.name ?? "").replace(/\s+/g, " ").trim();
    if (!name || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.set(email, { key: personKey(pageId, email), name: name.slice(0, 80), email });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Named people with an address on the room's Team module (hidden groups and people left out). */
export function teamPeopleFromBlocks(blocks: unknown): { name: string; email: string }[] {
  const out: { name: string; email: string }[] = [];
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    if (!b || typeof b !== "object" || (b as { type?: unknown }).type !== "room-workspace") continue;
    const groups = (b as { props?: { team?: unknown } }).props?.team;
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      if (!g || typeof g !== "object" || (g as { hidden?: unknown }).hidden === true) continue;
      const members = (g as { members?: unknown }).members;
      if (!Array.isArray(members)) continue;
      for (const m of members) {
        if (!m || typeof m !== "object" || (m as { hidden?: unknown }).hidden === true) continue;
        const { name, email } = m as { name?: unknown; email?: unknown };
        if (typeof name === "string" && typeof email === "string" && name.trim() && email.trim()) out.push({ name, email });
      }
    }
  }
  return out;
}

export const MENTION_MAX = 10;

/**
 * The people actually tagged: keys the page sent that are in this room's
 * directory AND whose "@Name" is still in the text (so deleting the name
 * before posting un-tags them).
 */
export function resolveMentions(text: string, keysRaw: unknown, people: RoomPerson[]): RoomPerson[] {
  if (!Array.isArray(keysRaw)) return [];
  const lower = text.toLowerCase();
  const out: RoomPerson[] = [];
  for (const k of keysRaw) {
    if (typeof k !== "string") continue;
    const person = people.find((p) => p.key === k);
    if (!person || out.includes(person) || !lower.includes(`@${person.name.toLowerCase()}`)) continue;
    out.push(person);
    if (out.length === MENTION_MAX) break;
  }
  return out;
}

/* ── Emails ──────────────────────────────────────────────────────────────── */

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type FeedAlertKind = "mention_post" | "mention_comment" | "comment_on_yours";

/** The email for one feed alert. `text` is what was written; `room` is the page title. */
export function feedAlertEmail(input: { kind: FeedAlertKind; byName: string; room: string; text: string; url: string }): { subject: string; html: string } {
  const by = input.byName.trim() || "Someone";
  const subject =
    input.kind === "comment_on_yours" ? `${by} commented on your win` : input.kind === "mention_comment" ? `${by} mentioned you in a comment` : `${by} mentioned you in a win`;
  const lead =
    input.kind === "comment_on_yours" ? `${esc(by)} commented on the win you shared` : input.kind === "mention_comment" ? `${esc(by)} mentioned you in a comment` : `${esc(by)} mentioned you in a win`;
  const snippet = input.text.length > 600 ? `${input.text.slice(0, 600).trimEnd()}…` : input.text;
  return {
    subject: `${subject} · ${input.room}`.slice(0, 180),
    html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#18201c;max-width:560px">
<p style="margin:0 0 12px"><strong>${lead}</strong> in ${esc(input.room)}.</p>
<p style="margin:0 0 16px;padding:12px 16px;background:#f5f6f3;border-radius:8px;white-space:pre-wrap">${esc(snippet)}</p>
<p style="margin:0 0 16px"><a href="${esc(input.url)}" style="display:inline-block;background:#18201c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open the Partner Hub</a></p>
<p style="margin:0;color:#68726c;font-size:13px">You're getting this because you're part of this Partner Hub.</p>
</div>`,
  };
}

export interface FeedAlert {
  email: string;
  kind: FeedAlertKind;
}

/**
 * Who to email about a post or comment: everyone tagged, plus (for a comment)
 * the person who shared the win. Never the writer; one email per address,
 * with being tagged taking priority over "someone commented".
 */
export function feedAlertsFor(input: { authorEmail: string; mentioned: RoomPerson[]; comment: boolean; winAuthorEmail?: string | null }): FeedAlert[] {
  const self = input.authorEmail.trim().toLowerCase();
  const out = new Map<string, FeedAlert>();
  for (const p of input.mentioned) {
    if (p.email !== self) out.set(p.email, { email: p.email, kind: input.comment ? "mention_comment" : "mention_post" });
  }
  const owner = (input.winAuthorEmail ?? "").trim().toLowerCase();
  if (input.comment && owner && owner !== self && !out.has(owner)) out.set(owner, { email: owner, kind: "comment_on_yours" });
  return [...out.values()];
}
