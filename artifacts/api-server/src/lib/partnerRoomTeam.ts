/**
 * People in a partner room, filled in for the rep: the customer's team from
 * the account's contacts, a pasted or CSV list of people, the email domain
 * the room accepts, and the setup checklist the team gets when a room is made.
 * Pure helpers; the routes and the automatic-room code do the reading and writing.
 */
import { FREE_MAIL_DOMAINS } from "./partnerRoom";

export interface AccountContact {
  name: string;
  title: string;
  email: string;
  level: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const domainOf = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";

/** Seniority order: executives first. Anything unknown goes last. */
export function levelRank(level: string | null | undefined, title: string | null | undefined): number {
  const l = (level ?? "").toLowerCase();
  const t = (title ?? "").toLowerCase();
  if (/\b(chief|ceo|coo|cfo|cdo|cmo|cto|founder|owner|president)\b/.test(t) && !/vice/.test(t)) return 0;
  if (l.includes("c suite") || l.includes("c-suite")) return 1;
  if (l.includes("vp") || /\bvice president\b|\bvp\b/.test(t)) return 2;
  if (l.includes("director") || t.includes("director")) return 3;
  if (l.includes("manager") || t.includes("manager")) return 4;
  return 5;
}

/** A bare host from a website or domain field ("https://www.mb2dental.com/about" → "mb2dental.com"). */
export function cleanDomain(raw: string | null | undefined): string | null {
  const host = (raw ?? "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#:\s]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && !FREE_MAIL_DOMAINS.has(host) ? host : null;
}

/** The work domain most of these addresses share (never a free-mail one), or null. */
export function mainEmailDomain(emails: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const e of emails) {
    const d = domainOf(e ?? "");
    if (d && !FREE_MAIL_DOMAINS.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [d, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = d;
  return best;
}

/**
 * The account's contacts as people for a room: named, with a work address,
 * one per address, most senior first. With a domain, only people at it (a
 * consultant or a stale address at another company is left out).
 */
export function rankAccountContacts(rows: { firstName?: string | null; lastName?: string | null; title?: string | null; email?: string | null; titleLevel?: string | null; status?: string | null }[], domain: string | null): AccountContact[] {
  const seen = new Set<string>();
  const out: (AccountContact & { rank: number })[] = [];
  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.replace(/\s+/g, " ").trim();
    if (!name || !EMAIL_RE.test(email) || seen.has(email)) continue;
    if (r.status && r.status !== "active") continue;
    if (domain ? domainOf(email) !== domain : FREE_MAIL_DOMAINS.has(domainOf(email))) continue;
    seen.add(email);
    const title = (r.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    out.push({ name: name.slice(0, 80), title, email, level: (r.titleLevel ?? "").trim(), rank: levelRank(r.titleLevel, r.title) + (title ? 0 : 0.5) });
  }
  return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(({ rank: _rank, ...c }) => c);
}

/* ── The Team module ─────────────────────────────────────────────────────── */

export interface TeamPerson {
  name: string;
  role?: string;
  email?: string;
}

type Block = { type?: unknown; props?: Record<string, unknown> };
type Group = { title?: unknown; members?: unknown; hidden?: unknown };
const isPlaceholder = (name: unknown) => typeof name !== "string" || !name.trim() || /^\[.*\]$/.test(name.trim()) || name.trim() === "New person";

/** Which group is the customer's: the one titled with the account-name variable, else the second. */
function groupIndex(groups: Group[], side: "partner" | "ours"): number {
  if (groups.length === 0) return -1;
  const partner = groups.findIndex((g) => typeof g.title === "string" && /\[partner|\{\{\s*account/i.test(g.title));
  if (side === "partner") return partner >= 0 ? partner : groups.length > 1 ? 1 : -1;
  return partner === 0 ? (groups.length > 1 ? 1 : -1) : 0;
}

/**
 * Put people on one side of the room's Team module. Someone already there
 * (same address, or same name) is left as written; the template's "[Name]"
 * placeholders are dropped once real people are in. With `first`, the new
 * people lead the group. Returns the new blocks, or null when the page has no
 * workspace block or nothing changed.
 */
export function addTeamPeople(blocks: unknown, side: "partner" | "ours", people: TeamPerson[], opts: { first?: boolean; keepPlaceholders?: boolean } = {}): unknown[] | null {
  if (!Array.isArray(blocks) || people.length === 0) return null;
  let changed = false;
  const next = (blocks as Block[]).map((b) => {
    if (!b || typeof b !== "object" || b.type !== "room-workspace" || changed) return b;
    const groups = Array.isArray(b.props?.team) ? (b.props!.team as Group[]) : [];
    const at = groupIndex(groups, side);
    if (at < 0) return b;
    const current = Array.isArray(groups[at].members) ? (groups[at].members as Record<string, unknown>[]) : [];
    const has = (p: TeamPerson) =>
      current.some((m) => (p.email && typeof m.email === "string" && m.email.trim().toLowerCase() === p.email.trim().toLowerCase()) || (typeof m.name === "string" && m.name.trim().toLowerCase() === p.name.trim().toLowerCase()));
    const fresh = people.filter((p) => p.name.trim() && !has(p)).map((p) => ({ name: p.name.trim(), role: (p.role ?? "").trim(), ...(p.email ? { email: p.email.trim().toLowerCase() } : {}) }));
    if (fresh.length === 0) return b;
    const kept = opts.keepPlaceholders ? current : current.filter((m) => !isPlaceholder(m.name));
    changed = true;
    const members = opts.first ? [...fresh, ...kept] : [...kept, ...fresh];
    return { ...b, props: { ...b.props, team: groups.map((g, i) => (i === at ? { ...g, members } : g)) } };
  });
  return changed ? next : null;
}

/**
 * Put the account owner (as Salesforce has them, via the signed-accounts sheet) on our side of the Team
 * module: the member whose role is "Account owner" takes the new name (and address, when known); with no
 * such member, the owner is added first. Everyone else is left alone. Null when nothing changes.
 */
export function setTeamOwner(blocks: unknown, owner: { name: string; email?: string | null }): unknown[] | null {
  const name = owner.name.trim();
  if (!Array.isArray(blocks) || !name) return null;
  let changed = false;
  const next = (blocks as Block[]).map((b) => {
    if (!b || typeof b !== "object" || b.type !== "room-workspace" || changed) return b;
    const groups = Array.isArray(b.props?.team) ? (b.props!.team as Group[]) : [];
    const at = groupIndex(groups, "ours");
    if (at < 0) return b;
    const members = Array.isArray(groups[at].members) ? (groups[at].members as Record<string, unknown>[]) : [];
    const i = members.findIndex((m) => typeof m.role === "string" && /^account owner$/i.test(m.role.trim()));
    if (i >= 0) {
      const m = members[i];
      if (typeof m.name === "string" && m.name.trim().toLowerCase() === name.toLowerCase()) return b;
      const { email: _old, ...rest } = m;
      const updated = { ...rest, name, ...(owner.email ? { email: owner.email.trim().toLowerCase() } : {}) };
      changed = true;
      return { ...b, props: { ...b.props, team: groups.map((g, gi) => (gi === at ? { ...g, members: members.map((x, xi) => (xi === i ? updated : x)) } : g)) } };
    }
    changed = true;
    const added = { name, role: "Account owner", ...(owner.email ? { email: owner.email.trim().toLowerCase() } : {}) };
    return { ...b, props: { ...b.props, team: groups.map((g, gi) => (gi === at ? { ...g, members: [added, ...members] } : g)) } };
  });
  return changed ? next : null;
}

/* ── The setup checklist the team gets with a new room ───────────────────── */

export interface RoomSetupFacts {
  standardFiles: number;
  /** People put on the customer's side of the Team module from the account's contacts. */
  teamFilled: number;
  /** Contacts on the account who can be invited. */
  contacts: number;
  /** The customer's email domain, when it could be worked out. */
  domain: string | null;
  practicesLinked: boolean;
  ownerNamed: boolean;
  /** The practice microsite: "found" (one already existed), "drafted" (made from the template), or none. */
  practiceSite?: "found" | "drafted" | null;
}

export const EMPTY_SETUP_FACTS: RoomSetupFacts = { standardFiles: 0, teamFilled: 0, contacts: 0, domain: null, practicesLinked: false, ownerNamed: false };

export interface SetupItem {
  done: boolean;
  text: string;
}

/** What was done automatically, then what a person still has to do, in the order to do it. */
export function roomSetupChecklist(f: RoomSetupFacts): SetupItem[] {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return [
    { done: true, text: `Draft Partner Hub created${f.standardFiles ? ` with ${n(f.standardFiles, "standard guide", "standard guides")}` : ""}` },
    f.teamFilled
      ? { done: true, text: `Customer team filled in from the account (${n(f.teamFilled, "person", "people")}). Check it is the right group` }
      : { done: false, text: "Add the customer's team (Team module: add people, paste a list, or pull from the account)" },
    f.domain ? { done: true, text: `Customer email domain set to ${f.domain}` } : { done: false, text: "Add the customer's email domain (Manage → Settings)" },
    f.practicesLinked ? { done: true, text: "Practice list linked to the locations sheet" } : { done: false, text: "Connect the practice list (Manage → Practices & files)" },
    f.practiceSite === "found"
      ? { done: true, text: "Practice microsite found and linked in the launch kit" }
      : f.practiceSite === "drafted"
        ? { done: true, text: "Practice microsite drafted from your template. Review and publish it" }
        : { done: false, text: "Create the practice microsite (no practice-microsite template was found to make one from)" },
    { done: false, text: "Add the customer's logo and the kickoff date" },
    { done: false, text: f.ownerNamed ? "Fill in the rest of your team (the account owner is already on it)" : "Fill in your team, with emails so people can be tagged" },
    { done: false, text: "Connect your calendar (Manage → Calendar & minutes) so meetings and minutes appear" },
    { done: false, text: "Connect the account's Slack channel (Manage → Settings)" },
    { done: false, text: "Open the Launch kit tab once to create the one-pager, graphics and media kit" },
    { done: true, text: "Asks for a work email before showing anything (invited people go straight in)" },
    { done: false, text: `Publish, then invite the customer's team (Manage → Settings → Invite)${f.contacts ? `: ${n(f.contacts, "contact", "contacts")} on the account` : ""}` },
  ];
}

const slackSafe = (s: string) => s.replace(/[<>&*_~`]/g, " ");

/** The Slack blocks for one new room: what it is, where to open it, and the setup checklist. */
export function roomCreatedSlackBlocks(name: string, links: { edit: string; room: string }, facts: RoomSetupFacts, opts: { test?: boolean } = {}): unknown[] {
  const items = roomSetupChecklist(facts);
  const line = (i: SetupItem) => `${i.done ? "✅" : "◻️"} ${slackSafe(i.text)}`;
  return [
    { type: "section", text: { type: "mrkdwn", text: `${opts.test ? "🧪 *Test run:*" : "🚪"} *Partner Hub created as a draft for ${slackSafe(name)}*${opts.test ? ", the way it would be when an account is added to the signed-accounts sheet" : ""}. Nobody outside the team can see it until it is published.${links.edit.startsWith("http") ? `\n<${links.edit}|Open it in LP Studio>` : ""}` } },
    { type: "section", text: { type: "mrkdwn", text: `*Done for you*\n${items.filter((i) => i.done).map(line).join("\n")}` } },
    { type: "section", text: { type: "mrkdwn", text: `*Your setup checklist*\n${items.filter((i) => !i.done).map(line).join("\n")}` } },
  ];
}

/* ── People who are in the hub but not on its team list ───────────────────── */

/** A readable name from an address when nothing better is known: "dana.ruiz@x.com" → "Dana Ruiz". Falls back to the address. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter((w) => /^[a-z]{2,}$/i.test(w));
  if (parts.length === 0 || parts.length > 3) return email;
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/**
 * The customer's people who can get into the hub (invited, or signed in) but
 * are on neither the Team module nor the list of people the customer added.
 * Without them "Add your team" tells someone who is already in that nobody is
 * listed. `listed` = addresses already shown; `ours` = our own team's.
 */
export function unlistedPeople(access: { email: string; name?: string | null }[], listed: (string | null | undefined)[], ours: (string | null | undefined)[] = []): { name: string; email: string }[] {
  const key = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
  const skip = new Set([...listed, ...ours].map(key).filter(Boolean));
  const out: { name: string; email: string }[] = [];
  for (const a of access) {
    const email = key(a.email);
    if (!email || skip.has(email)) continue;
    skip.add(email);
    out.push({ email, name: a.name?.trim() || nameFromEmail(email) });
  }
  return out;
}
