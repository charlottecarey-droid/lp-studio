/**
 * Partner rooms — pure helpers shared by the public and internal room routes.
 *
 * No database access here on purpose: everything in this file is unit-tested
 * without DATABASE_URL (importing @workspace/db throws without one).
 *
 * Identity model
 * --------------
 * Viewing a room is open. ACTING (ticking a task, uploading a file) needs one
 * of two proofs:
 *
 *   - a personal link: the visitor arrived through a sales hotlink for this
 *     page, so the contact behind it is already known; or
 *   - a room token: the visitor asked for access with a work email, the
 *     address was allowed (its domain or the address itself), and we emailed a
 *     link carrying a signed token.
 *
 * The room token is an HMAC-signed statement "this browser controls <email>
 * for room <pageId> until <exp>". It is deliberately NOT single-use: mail
 * scanners and link previews fetch emailed URLs before the person does, and a
 * redeem-on-open token would be burned by them (see the emailed-link contract
 * in routes/auth.ts). Nothing is redeemed, so a prefetch is harmless.
 * Revocation still works because every action re-checks that the address is
 * allowed right now.
 */
import { isGiftStep } from "./partnerRoomGift";
import crypto from "crypto";
import { splitAddress, usingDandyStage, zip5 } from "./partnerRoomGeo";
import { firstDateIn } from "./partnerRoomDates";

export const ROOM_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let devSecret: string | null = null;
function roomTokenKey(): string {
  const k = process.env.WORKER_HOST_SECRET;
  if (k && k.length > 0) return `partner-room:${k}`;
  // Dev without secrets: a per-process key, so tokens die on restart.
  if (!devSecret) devSecret = crypto.randomBytes(32).toString("hex");
  return devSecret;
}

export interface RoomTokenClaims {
  pageId: number;
  email: string;
  exp: number;
}

export function signRoomToken(pageId: number, email: string, now: number = Date.now()): string {
  const claims: RoomTokenClaims = { pageId, email: normalizeEmail(email) ?? "", exp: now + ROOM_TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto.createHmac("sha256", roomTokenKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** The claims when the token is ours, for this page, and unexpired; otherwise null. */
export function verifyRoomToken(token: unknown, pageId: number, now: number = Date.now()): RoomTokenClaims | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", roomTokenKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<RoomTokenClaims>;
    if (typeof claims.pageId !== "number" || claims.pageId !== pageId) return null;
    if (typeof claims.exp !== "number" || claims.exp < now) return null;
    const email = normalizeEmail(claims.email);
    if (!email) return null;
    return { pageId: claims.pageId, email, exp: claims.exp };
  } catch {
    return null;
  }
}

/** Lower-cased, trimmed address, or null when it does not look like one. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > 254) return null;
  if (!/^[^\s@<>"',;:]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e)) return null;
  return e;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/** "@MB2Dental.com " → "mb2dental.com"; null when it is not a plausible domain. */
export function normalizeDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) || d.length > 253) return null;
  return d;
}

/** Free-mail domains can never be allowed wholesale — anyone can make an address there. */
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com",
]);

export type RoomMemberStatus = "allowed" | "requested" | "denied";

/**
 * May this address act in the room right now?
 * An explicit member row always wins (allowed or denied); otherwise the
 * address's domain must be on the room's list.
 */
export function isEmailAllowed(email: string, allowedDomains: readonly string[], memberStatus: RoomMemberStatus | null | undefined): boolean {
  if (memberStatus === "allowed") return true;
  if (memberStatus === "denied") return false;
  const domain = emailDomain(email);
  if (FREE_MAIL_DOMAINS.has(domain)) return false;
  return allowedDomains.includes(domain);
}

/* ── Tasks: read from the page's hub-plan blocks ─────────────────────────── */

export type RoomTaskAction = "check" | "upload";

export interface RoomTask {
  key: string;
  title: string;
  action: RoomTaskAction;
}

/** Same rule as the block (BlockHubPlan `planTaskKey`): explicit key, else a slug of the task text. */
export function planTaskKey(row: { key?: unknown; task?: unknown }): string {
  const explicit = typeof row.key === "string" ? row.key.trim() : "";
  if (explicit) return explicit.slice(0, 80);
  const text = typeof row.task === "string" ? row.task : "";
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** The key of one meeting action item ("ma-<meeting>-<what>"). Must match `roomMeetingActionKey` in the room block. */
export function meetingActionKey(meetingKey: string, text: string): string {
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `ma-${slug(meetingKey).slice(0, 24)}-${slug(text).slice(0, 48)}`.replace(/-+$/, "");
}

export const ROOM_MILESTONE_STATUSES = ["done", "on-track", "pending", "blocking", "not-started"] as const;

export interface MilestonePatch {
  status?: (typeof ROOM_MILESTONE_STATUSES)[number];
  ourOwner?: string;
  partnerOwner?: string;
  target?: string;
}

/** A milestone edit from the request body: only the fields named, cleaned. Null when nothing valid is being changed. */
export function parseMilestonePatch(body: unknown): MilestonePatch | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: MilestonePatch = {};
  if (b.status !== undefined) {
    if (!(ROOM_MILESTONE_STATUSES as readonly string[]).includes(String(b.status))) return null;
    out.status = String(b.status) as MilestonePatch["status"];
  }
  for (const f of ["ourOwner", "partnerOwner", "target"] as const) {
    if (b[f] === undefined) continue;
    if (typeof b[f] !== "string") return null;
    out[f] = (b[f] as string).replace(/\s+/g, " ").trim().slice(0, f === "target" ? 40 : 80);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Change one milestone of the room's action plan (found by its key). Returns
 * the new blocks, or null when the page has no such milestone.
 */
export function setRoomMilestone(blocks: unknown, key: string, patch: MilestonePatch): unknown[] | null {
  if (!Array.isArray(blocks) || !key) return null;
  let done = false;
  const next = blocks.map((b) => {
    if (done || !b || typeof b !== "object" || (b as { type?: unknown }).type !== "room-workspace") return b;
    const props = (b as { props?: Record<string, unknown> }).props ?? {};
    const groups = Array.isArray(props.planGroups) ? (props.planGroups as { rows?: unknown }[]) : [];
    const planGroups = groups.map((g) => {
      if (done || !g || !Array.isArray(g.rows)) return g;
      const rows = g.rows.map((r) => {
        if (done || !r || typeof r !== "object" || planTaskKey(r as { key?: unknown; task?: unknown }) !== key) return r;
        done = true;
        return { ...(r as object), ...patch };
      });
      return done ? { ...g, rows } : g;
    });
    return done ? { ...(b as object), props: { ...props, planGroups } } : b;
  });
  return done ? next : null;
}

/** Block types that make a page a room. `room-workspace` keeps its plan in `planGroups`, `hub-plan` in `lanes`. */
export const ROOM_BLOCK_TYPES = ["room-workspace", "hub-plan"] as const;

/* ── A hub that asks for an email before showing anything ─────────────────── */

/** What a signed-out visitor to a gated hub is sent: the cover, and nothing under it. */
export const ROOM_COVER_PROPS = ["partnerName", "partnerShort", "partnerLogoUrl", "partnerLogoScale", "brandLogoScale", "partnerLogoOriginal", "eyebrow", "title", "lede", "heroImageUrl", "heroImageAlt", "coverStyle", "coverPhotoScrolls", "headline", "accentColor"] as const;

const isGatedRoom = (b: unknown): b is { type: string; props: Record<string, unknown> } =>
  !!b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace" && (b as { props?: { requireEmail?: unknown } }).props?.requireEmail === true;

/** True when the page's hub shows its practice map to anyone who can open it (the team switched it on); otherwise the map is for the team only. */
export function roomSharesMap(blocks: unknown): boolean {
  return Array.isArray(blocks) && blocks.some((b) => !!b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace" && (b as { props?: { shareMap?: unknown } }).props?.shareMap === true);
}

/** True when the page's hub asks for an email before showing its contents. */
export function roomRequiresEmail(blocks: unknown): boolean {
  return Array.isArray(blocks) && blocks.some(isGatedRoom);
}

/**
 * The page's blocks as they may be sent to anyone: a gated hub keeps only its
 * cover (names, logos, headline, photo) and is marked `gated`. The plan, the
 * people, the kit and everything else stay on the server until the visitor
 * is recognised, when the room's state hands them over. Other blocks, and
 * hubs that are not gated, pass through untouched.
 */
export function gateRoomBlocks(blocks: unknown): unknown {
  if (!Array.isArray(blocks) || !blocks.some(isGatedRoom)) return blocks;
  return blocks.map((b) => {
    if (!isGatedRoom(b)) return b;
    const cover: Record<string, unknown> = { requireEmail: true, gated: true };
    for (const k of ROOM_COVER_PROPS) if (b.props[k] !== undefined) cover[k] = b.props[k];
    return { ...b, props: cover };
  });
}

/** The hub block's own props as saved (variables intact), for handing to a recognised visitor of a gated hub. */
export function roomWorkspaceProps(blocks: unknown): Record<string, unknown> | null {
  const b = Array.isArray(blocks) ? blocks.find((x) => !!x && typeof x === "object" && (x as { type?: unknown }).type === "room-workspace") : null;
  return b ? (((b as { props?: Record<string, unknown> }).props ?? {}) as Record<string, unknown>) : null;
}

/** True when the page carries a room block (so it has room state even with no customer tasks). */
export function pageIsRoom(blocks: unknown): boolean {
  return Array.isArray(blocks) && blocks.some((b) => !!b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace");
}

/** Every task on the page a customer may act on, keyed. Later duplicates of a key are ignored. */
/**
 * Plan steps completed by handing over a file, even on a hub saved when they
 * were only a tick ("Share your brand guidelines" had nothing to share with).
 * Mirrors the block's ROOM_UPLOAD_STEP_KEYS.
 */
export const ROOM_UPLOAD_STEP_KEYS = new Set(["brand-guidelines"]);

/**
 * The customer's logo. A hub's Overview checklist usually has an "Upload your
 * logo" step (`onboard-logo`); the action plan's brand step offers the same
 * upload under `customer-logo`, which stands in for that step (or is filed on
 * its own on a hub with no such step, without joining the hub's task list). An image uploaded for either becomes
 * the hub's logo.
 */
export const ROOM_LOGO_TASK_KEY = "customer-logo";
export const ROOM_LOGO_STEP_KEY = "onboard-logo";
/** The task a logo upload is filed under on this hub. */
export function roomLogoTask(tasks: Map<string, RoomTask>): RoomTask {
  const step = tasks.get(ROOM_LOGO_STEP_KEY);
  // No such step on this hub: the upload still has somewhere to go, without adding a step to anyone's list.
  return step?.action === "upload" ? step : { key: ROOM_LOGO_TASK_KEY, title: "Upload your logo", action: "upload" };
}
/** A file that can be shown as a logo (a picture, not a PDF or a zip of brand files). */
export function isLogoImage(contentType: string): boolean {
  return contentType === "image/png" || contentType === "image/jpeg";
}

export function extractRoomTasks(blocks: unknown): Map<string, RoomTask> {
  const out = new Map<string, RoomTask>();
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    const type = b && typeof b === "object" ? (b as { type?: unknown }).type : null;
    if (type !== "hub-plan" && type !== "room-workspace") continue;
    const props = (b as { props?: { lanes?: unknown; planGroups?: unknown; onboarding?: { steps?: unknown } } }).props;
    // Onboarding steps are tasks too: an upload, a tick, or "add your team"
    // (ticked by hand, or automatically when the customer adds a contact).
    if (type === "room-workspace" && roomAsksGoalAgreement([b]) && !out.has(ROOM_GOALS_AGREED_KEY)) {
      out.set(ROOM_GOALS_AGREED_KEY, { key: ROOM_GOALS_AGREED_KEY, title: "Goals agreed", action: "check" });
    }
    const steps = type === "room-workspace" ? props?.onboarding?.steps : null;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        if (!step || typeof step !== "object") continue;
        // The welcome gift is each person's own (partnerRoomGift), never one tick for the whole hub.
        if (isGiftStep(step as { key?: unknown; title?: unknown })) continue;
        const a = (step as { action?: unknown }).action;
        const key = planTaskKey({ key: (step as { key?: unknown }).key, task: (step as { title?: unknown }).title });
        if (!key || out.has(key) || !["upload", "check", "team", "link", "request"].includes(String(a))) continue;
        out.set(key, { key, title: String((step as { title?: unknown }).title ?? key), action: a === "upload" ? "upload" : "check" });
      }
    }
    // Action items from the meetings typed into the page can be ticked off too.
    const meetings = type === "room-workspace" ? (b as { props?: { meetings?: { items?: unknown } } }).props?.meetings?.items : null;
    if (Array.isArray(meetings)) {
      for (const m of meetings) {
        const actions = (m as { actions?: unknown })?.actions;
        if (!m || typeof m !== "object" || (m as { hidden?: unknown }).hidden === true || !Array.isArray(actions)) continue;
        for (const a of actions) {
          const text = typeof (a as { text?: unknown })?.text === "string" ? (a as { text: string }).text.trim() : "";
          const key = text ? meetingActionKey(String((m as { key?: unknown }).key ?? ""), text) : "";
          if (key && !out.has(key)) out.set(key, { key, title: text, action: "check" });
        }
      }
    }
    const lanes = (type === "room-workspace" ? props?.planGroups : props?.lanes) ?? [];
    if (!Array.isArray(lanes)) continue;
    for (const lane of lanes) {
      const rows = (lane as { rows?: unknown })?.rows;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        // Set aside when the hub moved past its rollout: nothing to wait on or remind anyone about.
        if ((row as { retired?: unknown }).retired === true) continue;
        const action = (row as { customerAction?: unknown }).customerAction;
        if (action !== "check" && action !== "upload") continue;
        const key = planTaskKey(row as { key?: unknown; task?: unknown });
        if (!key || out.has(key)) continue;
        out.set(key, { key, title: String((row as { task?: unknown }).task ?? key), action: ROOM_UPLOAD_STEP_KEYS.has(key) ? "upload" : action });
      }
    }
  }
  return out;
}

/* ── Uploads ─────────────────────────────────────────────────────────────── */

/** JSON bodies are capped at 10 MB by express.json; base64 inflates by 4/3. */
export const ROOM_UPLOAD_MAX_BYTES = 7 * 1024 * 1024;

const UPLOAD_TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
};
export const ROOM_UPLOAD_EXTENSIONS = Object.keys(UPLOAD_TYPES);

/** Strip any path, control characters and odd punctuation; keep the extension. */
export function sanitizeFileName(raw: unknown): string {
  const base = (typeof raw === "string" ? raw : "").split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(-120) || "upload";
}

function magicMatches(ext: string, buf: Buffer): boolean {
  const head = buf.subarray(0, 8);
  const zip = head[0] === 0x50 && head[1] === 0x4b; // PK — xlsx/docx/pptx/zip
  const ole = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0; // legacy Office
  switch (ext) {
    case "xlsx": case "docx": case "pptx": case "zip": return zip;
    case "xls": case "doc": return ole;
    case "pdf": return head.subarray(0, 5).toString("latin1") === "%PDF-";
    case "png": return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    case "jpg": case "jpeg": return head[0] === 0xff && head[1] === 0xd8;
    case "csv": return !buf.subarray(0, 4096).includes(0); // text: no NUL bytes
    default: return false;
  }
}

export type ParsedUpload =
  | { ok: true; buffer: Buffer; fileName: string; contentType: string }
  | { ok: false; error: string };

/** Decode + validate an upload sent as strict base64 in a JSON body. The content type comes from the extension, never the client. */
export function parseRoomUpload(fileNameRaw: unknown, fileBase64Raw: unknown): ParsedUpload {
  const fileName = sanitizeFileName(fileNameRaw);
  const ext = (fileName.includes(".") ? fileName.split(".").pop() ?? "" : "").toLowerCase();
  const contentType = UPLOAD_TYPES[ext];
  if (!contentType) return { ok: false, error: `That file type isn't supported. Use ${ROOM_UPLOAD_EXTENSIONS.join(", ")}.` };
  if (typeof fileBase64Raw !== "string" || !fileBase64Raw) return { ok: false, error: "No file uploaded" };
  const b64 = (fileBase64Raw.includes(",") ? fileBase64Raw.slice(fileBase64Raw.indexOf(",") + 1) : fileBase64Raw).replace(/\s+/g, "");
  if (!b64 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, error: "Invalid file encoding" };
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0) return { ok: false, error: "No file uploaded" };
  if (buffer.length > ROOM_UPLOAD_MAX_BYTES) return { ok: false, error: "File too large. Maximum size is 7 MB." };
  if (!magicMatches(ext, buffer)) return { ok: false, error: "The file's contents don't match its type." };
  return { ok: true, buffer, fileName, contentType };
}

/** A site path on our own host: starts with one "/", no scheme tricks, bounded. */
export function safeRoomPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300) return null;
  return raw.split(/[?#]/)[0];
}

/* ── Requests ────────────────────────────────────────────────────────────── */

export const ROOM_REQUEST_KINDS = ["asset_change", "marketing", "training", "event", "reporting", "other"] as const;
export type RoomRequestKind = (typeof ROOM_REQUEST_KINDS)[number];
export const ROOM_REQUEST_STATUSES = ["new", "in_progress", "review", "done"] as const;
export type RoomRequestStatus = (typeof ROOM_REQUEST_STATUSES)[number];

export const ROOM_REQUEST_KIND_LABEL: Record<RoomRequestKind, string> = {
  asset_change: "Asset change",
  marketing: "Marketing",
  training: "Training",
  event: "Event",
  reporting: "Reporting",
  other: "Other",
};

const cleanText = (raw: unknown, max: number): string =>
  typeof raw === "string" ? raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "";

export type ParsedRoomRequest =
  | { ok: true; kind: RoomRequestKind; subject: string; details: string | null; assetKey: string | null }
  | { ok: false; error: string };

/** Validate a visitor's request. Unknown kinds fall back to "other"; a subject is required. */
export function parseRoomRequest(body: { kind?: unknown; subject?: unknown; details?: unknown; assetKey?: unknown }): ParsedRoomRequest {
  const kind = (ROOM_REQUEST_KINDS as readonly string[]).includes(String(body.kind)) ? (body.kind as RoomRequestKind) : "other";
  const subject = cleanText(body.subject, 160);
  const details = cleanText(body.details, 4000);
  if (!subject && !details) return { ok: false, error: "Tell us what you need" };
  const assetKey = cleanText(body.assetKey, 80);
  return { ok: true, kind, subject: subject || details.slice(0, 80), details: details || null, assetKey: assetKey || null };
}

/* ── Onboarding, choices, contacts, wins ─────────────────────────────────── */

/** Key of the onboarding step that "add your team" completes, if the page has one. */
export function onboardingTeamStepKey(blocks: unknown): string | null {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (!b || typeof b !== "object" || (b as { type?: unknown }).type !== "room-workspace") continue;
    const steps = (b as { props?: { onboarding?: { steps?: unknown } } }).props?.onboarding?.steps;
    if (!Array.isArray(steps)) continue;
    for (const step of steps) {
      if (step && typeof step === "object" && (step as { action?: unknown }).action === "team") {
        return planTaskKey({ key: (step as { key?: unknown }).key, task: (step as { title?: unknown }).title }) || null;
      }
    }
  }
  return null;
}

export interface RoomChoiceSpec {
  key: string;
  title: string;
  options: string[];
  /** What the program is, who it reaches and when, as the plan says: carried into the brief marketing gets. */
  description?: string;
  audience?: string;
  when?: string;
}

/**
 * Decisions the page offers the customer: marketing programs with options
 * (Include / Not now, an amount, an event format). A program without options
 * is fixed ("in plan") and takes no choice.
 */
/**
 * Programs the customer always decides on, even on a hub saved before they
 * carried choices (the announcement and the welcome kits used to be fixed on
 * every hub). Mirrors the block's ROOM_PROGRAM_DEFAULT_OPTIONS.
 */
export const ROOM_PROGRAM_DEFAULT_OPTIONS: Record<string, string[]> = {
  "mk-announcement": ["Include", "Not now"],
  "mk-welcome-kits": ["Include", "Not now"],
};

export function extractRoomChoices(blocks: unknown): Map<string, RoomChoiceSpec> {
  const out = new Map<string, RoomChoiceSpec>();
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    if (!b || typeof b !== "object" || (b as { type?: unknown }).type !== "room-workspace") continue;
    const groups = (b as { props?: { marketing?: { groups?: unknown } } }).props?.marketing?.groups;
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      const programs = (g as { programs?: unknown })?.programs;
      if (!Array.isArray(programs)) continue;
      for (const p of programs) {
        if (!p || typeof p !== "object") continue;
        const rawOptions = (p as { options?: unknown }).options;
        const own = Array.isArray(rawOptions) ? rawOptions.filter((o): o is string => typeof o === "string" && !!o.trim()).map((o) => o.trim()) : [];
        const key = planTaskKey({ key: (p as { key?: unknown }).key, task: (p as { title?: unknown }).title });
        const rawKey = (p as { key?: unknown }).key;
        const options = own.length >= 2 ? own : (ROOM_PROGRAM_DEFAULT_OPTIONS[typeof rawKey === "string" ? rawKey.trim() : ""] ?? own);
        if (!key || options.length < 2 || out.has(key)) continue;
        const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined);
        const info = p as { description?: unknown; audience?: unknown; when?: unknown };
        out.set(key, { key, title: String((p as { title?: unknown }).title ?? key), options, ...(txt(info.description) ? { description: txt(info.description) } : {}), ...(txt(info.audience) ? { audience: txt(info.audience) } : {}), ...(txt(info.when) ? { when: txt(info.when) } : {}) });
      }
    }
  }
  return out;
}

export type ParsedRoomContact = { ok: true; name: string; role: string | null; email: string | null } | { ok: false; error: string };

export function parseRoomContact(body: { name?: unknown; role?: unknown; email?: unknown }): ParsedRoomContact {
  const name = cleanText(body.name, 120);
  if (!name) return { ok: false, error: "Add a name" };
  const emailRaw = cleanText(body.email, 254);
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) return { ok: false, error: "That email doesn't look right" };
  return { ok: true, name, role: cleanText(body.role, 120) || null, email };
}

export type ParsedRoomWin = { ok: true; body: string; headline: string | null; region: string | null } | { ok: false; error: string };

export function parseRoomWin(input: { body?: unknown; headline?: unknown; region?: unknown }): ParsedRoomWin {
  const body = cleanText(input.body, 1500);
  if (!body) return { ok: false, error: "Write a few words about the win" };
  return { ok: true, body, headline: cleanText(input.headline, 120) || null, region: cleanText(input.region, 80) || null };
}

/** A comment's text, or null when empty. */
export function parseRoomComment(raw: unknown): string | null {
  return cleanText(raw, 1000) || null;
}

/* ── Practices ───────────────────────────────────────────────────────────── */

export const ROOM_PRACTICE_STAGES = ["not_started", "scheduling", "training_booked", "trained", "live"] as const;
export type RoomPracticeStage = (typeof ROOM_PRACTICE_STAGES)[number];

/** "Live", "training booked", "TRAINED" … → a stage; anything unknown is not_started. */
export function normalizePracticeStage(raw: unknown): RoomPracticeStage {
  const v = typeof raw === "string" ? raw.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
  if ((ROOM_PRACTICE_STAGES as readonly string[]).includes(v)) return v as RoomPracticeStage;
  // Salesforce account statuses: Ramping / Ramped = ordering; Onboarding = in training; Pre-Onboarding = being scheduled.
  if (v === "active" || v === "activated" || v === "ordering" || v === "ramped" || v === "ramping") return "live";
  if (v === "booked" || v === "training_scheduled" || v === "scheduled" || v === "onboarding") return "training_booked";
  if (v === "pre_onboarding") return "scheduling";
  if (v === "training_complete" || v === "training_completed" || v === "complete") return "trained";
  return "not_started";
}

export interface RoomPracticeInput {
  externalId: string | null;
  name: string;
  region: string | null;
  city: string | null;
  state: string | null;
  wave: string | null;
  stage: RoomPracticeStage;
  /** False when the source row said nothing about the stage (an update then keeps the saved one). */
  stageGiven: boolean;
  trainingDate: string | null;
  liveDate: string | null;
  scannerSent: string | null;
  scannerActivated: string | null;
  regionalManager: string | null;
  /** Scanners at the practice now; null when the source doesn't say. */
  scannerCount: number | null;
  scannerModels: string | null;
  /** More of what a Salesforce report carries, as written there. Optional so older callers need not set them. */
  scannerBrand?: string | null;
  contractSigned?: string | null;
  sourceStatus?: string | null;
  /** Internal: shown to the team only. */
  owner?: string | null;
  lastActivity?: string | null;
  /** Where the practice is and what kind it is, when the list carries them (a location list with addresses). */
  address?: string | null;
  zip?: string | null;
  officeType?: string | null;
  phone?: string | null;
  officeManager?: string | null;
  /** What the practice orders, when the list carries a first-order date per product line: the lines it has ordered ([] = none yet). Undefined = the list has no such columns, so what is saved stays. */
  products?: string[];
  /** The day of its last order (YYYY-MM-DD), worked out from "days since last order". */
  lastOrderDay?: string | null;
  /** The day its tenth order was delivered: the practice has ramped. */
  tenthOrderDay?: string | null;
  ordersAllTime?: number | null;
  ordersLastMonth?: number | null;
  ordersThisMonth?: number | null;
}

/** The product lines a Salesforce report dates the first order of ("01st Implant Order Placed"), in the order they are shown. */
export const PRODUCT_LINES: [string, string][] = [
  ["simple restorative", "Simple restorative"],
  ["complex restorative", "Complex restorative"],
  ["removable", "Removable"],
  ["full denture", "Full denture"],
  ["partial denture", "Partial denture"],
  ["implant", "Implant"],
  ["aligner", "Aligner"],
  ["surgical guide", "Surgical guide"],
  ["other", "Other"],
];
/** How long since a practice last ordered, in the groups the scorecard charts. */
export const ORDER_RECENCY = ["week", "month", "quarter", "lapsed"] as const;
export type OrderRecency = (typeof ORDER_RECENCY)[number];

/** The first day of each group, counting back from today (YYYY-MM-DD): within 7 days, 8–30, 31–90, more than 90. */
export function recencyCutoffs(now: Date = new Date()): { week: string; month: string; quarter: string } {
  const back = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n)).toISOString().slice(0, 10);
  return { week: back(7), month: back(30), quarter: back(90) };
}

export function recencyOf(day: string, now: Date = new Date()): OrderRecency {
  const c = recencyCutoffs(now);
  return day >= c.week ? "week" : day >= c.month ? "month" : day >= c.quarter ? "quarter" : "lapsed";
}

/** How many practices last ordered in each group, out of those whose last order is known. */
export function orderRecencySummary(days: (string | null)[], now: Date = new Date()): { known: number; buckets: { key: OrderRecency; practices: number }[] } {
  const known = days.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  return { known: known.length, buckets: ORDER_RECENCY.map((key) => ({ key, practices: known.filter((d) => recencyOf(d, now) === key).length })) };
}

const productColumn = (line: string) => `01st ${line} order placed`;

/**
 * How many practices order each product line, from each practice's saved
 * list ("Implant, Aligner"). `ordering` = practices with at least one line on
 * record: the fair denominator, since a practice with no product dates may
 * simply be missing them in the report. Lines in the standard order.
 */
export function productLineSummary(saved: string[]): { ordering: number; lines: { line: string; practices: number }[] } {
  const lists = saved.map((v) => v.split(", ").filter(Boolean)).filter((l) => l.length > 0);
  return { ordering: lists.length, lines: PRODUCT_LINES.map(([, label]) => ({ line: label, practices: lists.filter((l) => l.includes(label)).length })) };
}

const SCANNER_MODEL_COLUMNS: [string, string][] = [["trios 3", "Trios 3"], ["trios 5", "Trios 5"], ["dandy vision", "Dandy Vision"], ["medit", "Medit"], ["itero", "iTero"]];

/** Salesforce writes "None" for an empty picklist. */
const noneAsBlank = (v: string | null) => (v && /^(none|n\/a|-)$/i.test(v) ? null : v);

/** One practice row from a pasted list or an API body; null when it has no name. */
export function parsePracticeRow(row: Record<string, unknown>, now: Date = new Date()): RoomPracticeInput | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = cleanText(row[k], 160);
      if (v) return v;
    }
    return null;
  };
  // "Office" is the scanner tracker's export: its Status column says whether the office is active, not where it is in the rollout.
  const fromScannerExport = !get("name", "practice", "practice_name", "practice name", "account", "account name") && !!get("office", "office name");
  const name = get("name", "practice", "practice_name", "practice name", "account", "account name", "office", "office name");
  if (!name) return null;
  const count = get("scannerCount", "scanner_count", "scanners", "scanner count", "current total", "total scanners");
  const models = SCANNER_MODEL_COLUMNS.map(([col, label]) => [Number(get(col)), label] as const).filter(([n]) => Number.isFinite(n) && n > 0).map(([n, label]) => `${n} ${label}`).join(" · ");
  // An address on one line ("166 Furman Road Ste B, Boone, NC 28607") also gives the city, state and ZIP when they have no column of their own.
  // Salesforce reports carry two addresses. Shipping is where the practice is; billing is often the group's head office, so it is the fallback.
  const addressRaw = get("address", "street address", "street", "shipping street", "shipping address line 1", "billing street", "billing address line 1");
  const parts = splitAddress(addressRaw);
  const state = get("state", "shipping state/province", "shipping state", "billing state/province", "billing state", "billing state / province") ?? parts.state;
  // A plain "Using Dandy: Yes / No" column says whether the office orders today, whatever the file's other columns are.
  const using = usingDandyStage(get("using dandy", "on dandy", "uses dandy", "dandy customer"));
  const stageText = get("stage", "status");
  return {
    externalId: get("externalId", "external_id", "sfdc_id", "sfdc id", "salesforce_id", "id", "account id", "18 digit id", "account id (18)"),
    name,
    // No region column (a plain Salesforce report): group by state.
    region: get("region", "market", "region / regional manager") ?? state,
    city: get("city", "shipping city", "billing city") ?? parts.city,
    state,
    wave: get("wave"),
    stage: using ?? (fromScannerExport ? "not_started" : normalizePracticeStage(stageText)),
    stageGiven: !!using || (!fromScannerExport && !!stageText),
    // "Training Date" as written; when it is blank, the first date in "Training Dates" (a practice can have several sessions).
    trainingDate: get("trainingDate", "training_date", "training date", "training") ?? firstDateIn(get("training dates", "trainingDates", "training_dates")),
    liveDate: get("liveDate", "live_date", "live date", "activated date", "activated"),
    // Salesforce's own column names for the scanner dates are accepted as they are.
    scannerSent: get("scannerSent", "scanner_sent", "scanner sent", "scanner delivered", "scanner shipped", "scanner sent date", "first opp"),
    scannerActivated: get("scannerActivated", "scanner_activated", "scanner activated", "scanner connected", "scanner activation date"),
    regionalManager: get("regionalManager", "regional_manager", "regional manager", "regional manager name", "region manager", "rm", "rdo", "regional director", "regional director of operations", "dbo", "rd"),
    scannerCount: count != null && /^\d{1,4}$/.test(count) ? Number(count) : null,
    scannerModels: get("scannerModels", "scanner_models", "scanner models", "scanner type") ?? (models || null),
    scannerBrand: noneAsBlank(get("scannerBrand", "scanner_brand", "scanner brand", "brand of scanner at office", "brand of scanner")),
    contractSigned: get("contractSigned", "contract_signed", "contract signed date", "contract signed"),
    sourceStatus: fromScannerExport ? null : get("status", "stage"),
    owner: get("owner", "account owner"),
    lastActivity: get("lastActivity", "last_activity", "last activity"),
    address: addressRaw ? parts.street || addressRaw : null,
    zip: zip5(get("zip", "zip code", "postal code", "postcode")) ?? zip5(get("shipping zip/postal code", "shipping zip")) ?? zip5(get("billing zip/postal code", "billing zip")) ?? parts.zip,
    officeType: get("officeType", "office_type", "office type", "practice type", "location type"),
    phone: get("phone", "phone number", "office phone"),
    officeManager: get("officeManager", "office_manager", "office manager", "practice manager"),
    // Orders, when the list is a report that carries them. A column that isn't there says nothing; one that is there and blank says "none".
    ...(PRODUCT_LINES.some(([line]) => productColumn(line) in row) ? { products: PRODUCT_LINES.filter(([line]) => get(productColumn(line))).map(([, label]) => label) } : {}),
    ...(daysSinceKey(row) ? { lastOrderDay: dayAgo(get(daysSinceKey(row)!), now) } : {}),
    ...("date of tenth order delivered" in row ? { tenthOrderDay: firstDateIn(get("date of tenth order delivered"), now) } : {}),
    ...("# orders (all-time)" in row ? { ordersAllTime: wholeNumber(get("# orders (all-time)")) } : {}),
    ...("# orders (last month)" in row ? { ordersLastMonth: wholeNumber(get("# orders (last month)")) } : {}),
    ...("# orders (this month)" in row ? { ordersThisMonth: wholeNumber(get("# orders (this month)")) } : {}),
  };
}

const wholeNumber = (v: string | null) => (v != null && /^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : null);
/** The report's "days since last order" column, whatever its exact name ("Days Since Non Canceled Orders(for flow)"). */
const daysSinceKey = (row: Record<string, unknown>) => Object.keys(row).find((k) => /^days since .*orders?\b/.test(k)) ?? null;
/** N days before today as YYYY-MM-DD; null when it isn't a number of days. */
function dayAgo(v: string | null, now: Date): string | null {
  const n = wholeNumber(v);
  if (n === null || n > 20_000) return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n)).toISOString().slice(0, 10);
}

/** Split one CSV line, honouring quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** A pasted practice list (CSV or tab-separated, first line = headers) → rows. Capped at 5,000. */
export function parsePracticeCsv(text: unknown): RoomPracticeInput[] {
  if (typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const out: RoomPracticeInput[] = [];
  for (const line of lines.slice(1, 5001)) {
    const cells = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    const parsed = parsePracticeRow(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

/* ── Asana ───────────────────────────────────────────────────────────────── */

/** Request kinds that are marketing work and go to the marketing intake in Asana. */
export const ASANA_REQUEST_KINDS: readonly string[] = ["asset_change", "marketing", "event"];

/** "Expansion Support - MB2 Dental - Change to: one-pager" */
export function asanaRequestTaskName(partnerName: string, subject: string): string {
  const clean = (v: string) => v.replace(/\s+/g, " ").trim();
  return `Expansion Support - ${clean(partnerName) || "Customer"} - ${clean(subject) || "Request"}`.slice(0, 250);
}

/** The partner's name from the page's workspace block. */
export function roomPartnerName(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  for (const b of blocks) {
    if (b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace") {
      const n = (b as { props?: { partnerName?: unknown } }).props?.partnerName;
      if (typeof n === "string" && n.trim()) return n.trim();
    }
  }
  return "";
}

/** True when the page shows a goals module that asks the customer to agree to the goals. */
export function roomAsksGoalAgreement(blocks: unknown): boolean {
  return Array.isArray(blocks) && blocks.some((b) => !!b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace" && Array.isArray((b as { props?: { goals?: { items?: unknown } } }).props?.goals?.items));
}
export const ROOM_GOALS_AGREED_KEY = "goals-agreed";

/* ── Calendar feed ───────────────────────────────────────────────────────── */

/**
 * The room's visible, dated calendar events as an iCalendar feed (all-day
 * entries; the time of day rides in the description so no time zone is
 * guessed). Null when the page has no workspace block.
 */
export function roomCalendarIcs(blocks: unknown, calendarName: string, synced: { id: number; title: string; startsAt: string; endsAt: string | null; allDay: boolean }[] = []): string | null {
  if (!Array.isArray(blocks)) return null;
  const block = blocks.find((b) => b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace") as { props?: { calendar?: { events?: unknown } } } | undefined;
  if (!block) return null;
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Partner Room//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(calendarName)}`];
  const events = Array.isArray(block.props?.calendar?.events) ? (block.props!.calendar!.events as Record<string, unknown>[]) : [];
  for (const e of events.slice(0, 500)) {
    const date = typeof e?.date === "string" ? e.date.trim() : "";
    const title = cleanText(e?.title, 200);
    if (!e || e.hidden || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) continue;
    const day = date.replace(/-/g, "");
    const next = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + 1));
    const end = `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, "0")}${String(next.getUTCDate()).padStart(2, "0")}`;
    const key = planTaskKey({ key: e.key, task: e.title });
    lines.push("BEGIN:VEVENT", `UID:${key}-${day}@partner-room`, `DTSTAMP:${day}T000000Z`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc([cleanText(e.time, 80), cleanText(e.detail, 500)].filter(Boolean).join(" · "))}`, "END:VEVENT");
  }
  // Meetings synced from the team's calendar carry their real start and end.
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  for (const e of synced.slice(0, 600)) {
    const start = new Date(e.startsAt);
    const title = cleanText(e.title, 200);
    if (Number.isNaN(start.getTime()) || !title) continue;
    const end = e.endsAt && !Number.isNaN(new Date(e.endsAt).getTime()) ? new Date(e.endsAt) : new Date(start.getTime() + (e.allDay ? 86_400_000 : 30 * 60_000));
    const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:meeting-${e.id}@partner-room`, `DTSTAMP:${stamp(start.toISOString())}`, ...(e.allDay ? [`DTSTART;VALUE=DATE:${day(start)}`, `DTEND;VALUE=DATE:${day(end)}`] : [`DTSTART:${stamp(start.toISOString())}`, `DTEND:${stamp(end.toISOString())}`]), `SUMMARY:${esc(title)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/* ── Launch kit: generated assets ────────────────────────────────────────── */

export interface RoomKitInfo {
  partnerName: string;
  partnerLogoUrl: string;
  heroImageUrl: string;
  /** The cover's logo sizes in percent (100 when unset), so the generated assets size the logos the same way. */
  partnerLogoScale: number;
  brandLogoScale: number;
  /** The cover keeps the customer logo's own colours (otherwise it is drawn in white, there and on the generated assets). */
  partnerLogoOriginal: boolean;
  /** The first launch-kit link (the sign-up page), for the one-pager's QR code. */
  signupUrl: string;
  assets: { key: string; title: string; kind: string; hasFile: boolean; hidden: boolean; /** The team's own upload, which nothing generated replaces. */ own: boolean; /** What a generated file was made from; blank for a file someone uploaded. */ madeFrom: string; /** Where the item's file is (a hosted path or an address), when it has one. */ url: string }[];
  /** The kit's written pieces (announcement email, social posts, approved description), for the media kit document. */
  texts: { title: string; description: string; body: string }[];
  /** The kit's links, for the media kit document. */
  links: { title: string; url: string }[];
}

const workspaceBlock = (blocks: unknown): { props?: Record<string, unknown> } | null =>
  Array.isArray(blocks) ? ((blocks.find((b) => b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace") as { props?: Record<string, unknown> } | undefined) ?? null) : null;

/** What the launch-asset generator needs from the page: names, logo, cover photo, and which kit files exist. */
export function roomKitInfo(blocks: unknown): RoomKitInfo | null {
  const props = workspaceBlock(blocks)?.props;
  if (!props) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const links = Array.isArray(props.links) ? (props.links as Record<string, unknown>[]) : [];
  const assets = Array.isArray(props.assets) ? (props.assets as Record<string, unknown>[]) : [];
  return {
    partnerName: str(props.partnerName),
    partnerLogoUrl: str(props.partnerLogoUrl),
    heroImageUrl: str(props.heroImageUrl),
    partnerLogoScale: typeof props.partnerLogoScale === "number" && props.partnerLogoScale > 0 ? props.partnerLogoScale : 100,
    brandLogoScale: typeof props.brandLogoScale === "number" && props.brandLogoScale > 0 ? props.brandLogoScale : 100,
    partnerLogoOriginal: props.partnerLogoOriginal === true,
    // An uploaded file among the links is a resource, never the sign-up page.
    signupUrl: str(links.find((l) => l && !l.hidden && !str(l.fileUrl) && /^https?:\/\//.test(str(l.url)))?.url),
    assets: assets.filter((a) => a && typeof a === "object").map((a) => ({ key: str(a.key) || planTaskKey({ task: a.title }), title: str(a.title), kind: str(a.kind), madeFrom: str(a.madeFrom), own: kitAssetIsOwn(a), hasFile: !!(str(a.fileUrl) || str(a.videoUrl) || str(a.externalUrl) || str(a.body)), hidden: a.hidden === true, url: str(a.fileUrl) || str(a.videoUrl) })),
    texts: assets.filter((a) => a && !a.hidden && a.kind === "text" && str(a.body)).map((a) => ({ title: str(a.title), description: str(a.description), body: typeof a.body === "string" ? a.body.trim().slice(0, 8000) : "" })).slice(0, 20),
    links: [
      ...links.filter((l) => l && !l.hidden && !str(l.fileUrl) && /^https?:\/\//.test(str(l.url))).map((l) => ({ title: str(l.title), url: str(l.url) })),
      ...assets.filter((a) => a && !a.hidden && a.kind === "link" && /^https?:\/\//.test(str(a.externalUrl))).map((a) => ({ title: str(a.title), url: str(a.externalUrl) })),
    ].slice(0, 20),
  };
}

export interface RoomKitAssetInput {
  key: string;
  kind: "pdf" | "image";
  title: string;
  description?: string;
  fileUrl: string;
  /** What a generated file was made from (names, logos, sizes). Absent for a file someone uploaded. */
  madeFrom?: string;
  /** The team's own file, uploaded in place of the one we make. It stays until someone removes it. */
  own?: boolean;
}

/** A kit entry holding the team's own file: marked so, or (from before the mark existed) replaced with no record of having been generated. */
const kitAssetIsOwn = (a: Record<string, unknown> | undefined): boolean => !!a && typeof a.fileUrl === "string" && !!a.fileUrl.trim() && (a.own === true || a.madeFrom === "");

/** Whether the kit's entry under this key is the team's own upload, which nothing generated may replace. */
export function roomKitAssetIsOwn(blocks: unknown, key: string): boolean {
  const props = workspaceBlock(blocks)?.props ?? {};
  const assets = Array.isArray(props.assets) ? (props.assets as Record<string, unknown>[]) : [];
  return kitAssetIsOwn(assets.find((a) => a && (typeof a.key === "string" && a.key.trim() ? a.key.trim() : planTaskKey({ task: a.title })) === key));
}

/**
 * Take the team's own file back out of a kit entry, so the generated one can
 * be made again. The entry stays (hidden, as an entry with no file is).
 * Returns new blocks, or null when the page has no workspace block.
 */
export function clearRoomKitAsset(blocks: unknown, key: string): unknown[] | null {
  const block = workspaceBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const props = block.props ?? {};
  const assets = Array.isArray(props.assets) ? (props.assets as Record<string, unknown>[]) : [];
  const next = assets.map((a) => {
    if (!a || (typeof a.key === "string" && a.key.trim() ? a.key.trim() : planTaskKey({ task: a.title })) !== key) return a;
    const { own: _own, madeFrom: _made, ...rest } = a;
    return { ...rest, fileUrl: "", hidden: true };
  });
  return blocks.map((b) => (b === block ? { ...(b as object), props: { ...props, assets: next } } : b));
}

/** A generated file's address must be this app's own storage: never an outside URL. */
export function parseRoomKitAsset(raw: unknown): RoomKitAssetInput | null {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  const fileUrl = typeof b.fileUrl === "string" ? b.fileUrl.trim() : "";
  const title = cleanText(b.title, 120);
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(key) || (b.kind !== "pdf" && b.kind !== "image") || !title) return null;
  if (!/^\/api\/storage\/[A-Za-z0-9/_.-]{1,300}$/.test(fileUrl) || fileUrl.includes("..")) return null;
  const madeFrom = typeof b.madeFrom === "string" ? b.madeFrom.trim().slice(0, 600) : "";
  return { key, kind: b.kind, title, description: cleanText(b.description, 200) || undefined, fileUrl, ...(madeFrom ? { madeFrom } : {}), ...(b.own === true && !madeFrom ? { own: true } : {}) };
}

/**
 * Put a generated file into the room's launch kit: fill the asset with that
 * key (and show it), or add it when the kit has none. Returns new blocks, or
 * null when the page has no workspace block. Everything else is untouched.
 */
export function setRoomKitAsset(blocks: unknown, asset: RoomKitAssetInput): unknown[] | null {
  const block = workspaceBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const props = block.props ?? {};
  const assets = Array.isArray(props.assets) ? (props.assets as Record<string, unknown>[]) : [];
  const keyOf = (a: Record<string, unknown>) => (typeof a?.key === "string" && a.key.trim() ? a.key.trim() : planTaskKey({ task: a?.title }));
  const at = assets.findIndex((a) => a && keyOf(a) === asset.key);
  const next =
    at >= 0
      ? // An uploaded file drops the record of what the old one was made from, so it is never made again over the upload.
        assets.map((a, i) => (i === at ? { ...a, kind: asset.kind, fileUrl: asset.fileUrl, hidden: false, madeFrom: asset.madeFrom ?? "", own: !asset.madeFrom } : a))
      : [...assets, { key: asset.key, kind: asset.kind, title: asset.title, ...(asset.description ? { description: asset.description } : {}), fileUrl: asset.fileUrl, ...(asset.madeFrom ? { madeFrom: asset.madeFrom } : { own: true }) }];
  return blocks.map((b) => (b === block ? { ...(b as object), props: { ...props, assets: next } } : b));
}

/* ── Goals, edited from the hub's manage pop-up ──────────────────────────── */

export const ROOM_GOAL_METRICS = ["manual", "practices_live", "practices_trained", "plan_complete"] as const;
export const ROOM_GOAL_STATUSES = ["on-track", "pending", "done"] as const;
export const ROOM_GOALS_MAX = 20;

export interface RoomGoalInput {
  key: string;
  title: string;
  detail?: string;
  target?: string;
  targetValue?: number;
  metric: (typeof ROOM_GOAL_METRICS)[number];
  current?: string;
  currentValue?: number;
  source?: string;
  status: (typeof ROOM_GOAL_STATUSES)[number];
  owner?: string;
  hidden?: boolean;
}
export interface RoomGoalsInput {
  intro: string;
  askAgreement: boolean;
  /** The whole Goals section is switched off in the hub. */
  moduleHidden: boolean;
  items: RoomGoalInput[];
}

const goalNumber = (raw: unknown): number | undefined => (typeof raw === "number" && Number.isFinite(raw) && Math.abs(raw) <= 1e12 ? raw : undefined);

function cleanGoals(raw: unknown): { goals: RoomGoalsInput; error: string | null } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(b.items) ? b.items : [];
  const items: RoomGoalInput[] = [];
  const used = new Set<string>();
  let error: string | null = list.length > ROOM_GOALS_MAX ? `A hub can have up to ${ROOM_GOALS_MAX} goals.` : null;
  for (const entry of list.slice(0, ROOM_GOALS_MAX)) {
    const g = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const title = cleanText(g.title, 160);
    if (!title) {
      error = error ?? "Every goal needs a name.";
      continue;
    }
    const typedKey = typeof g.key === "string" ? g.key.trim() : "";
    let key = /^[A-Za-z0-9][A-Za-z0-9_-]{0,60}$/.test(typedKey) ? typedKey : planTaskKey({ task: title }) || "goal";
    for (let n = 2; used.has(key); n++) key = `${key.replace(/-\d+$/, "")}-${n}`;
    used.add(key);
    const metric = (ROOM_GOAL_METRICS as readonly string[]).includes(g.metric as string) ? (g.metric as RoomGoalInput["metric"]) : "manual";
    const status = (ROOM_GOAL_STATUSES as readonly string[]).includes(g.status as string) ? (g.status as RoomGoalInput["status"]) : "on-track";
    const detail = cleanText(g.detail, 300);
    const target = cleanText(g.target, 80);
    const targetValue = goalNumber(g.targetValue);
    const current = cleanText(g.current, 80);
    const currentValue = goalNumber(g.currentValue);
    const source = cleanText(g.source, 160);
    const owner = cleanText(g.owner, 120);
    items.push({
      key,
      title,
      ...(detail ? { detail } : {}),
      ...(target ? { target } : {}),
      ...(targetValue !== undefined ? { targetValue } : {}),
      metric,
      // A counted goal's value comes from the hub itself; a typed one would only go stale.
      ...(metric === "manual" && current ? { current } : {}),
      ...(metric === "manual" && currentValue !== undefined ? { currentValue } : {}),
      ...(metric === "manual" && source ? { source } : {}),
      status,
      ...(owner ? { owner } : {}),
      ...(g.hidden === true ? { hidden: true } : {}),
    });
  }
  return { goals: { intro: cleanText(b.intro, 400), askAgreement: b.askAgreement === true, moduleHidden: b.moduleHidden === true, items }, error };
}

/** What the team sent from the manage pop-up, checked. Nothing is saved when any goal is unusable. */
export function parseRoomGoals(raw: unknown): { ok: true; goals: RoomGoalsInput } | { ok: false; error: string } {
  const { goals, error } = cleanGoals(raw);
  return error ? { ok: false, error } : { ok: true, goals };
}

/**
 * The hub's goals as they are STORED (account-name variables left as typed,
 * because the pop-up writes them back). Null when the page has no workspace block.
 */
export function roomGoalsInfo(blocks: unknown): RoomGoalsInput | null {
  const props = workspaceBlock(blocks)?.props;
  if (!props) return null;
  const goals = (props.goals && typeof props.goals === "object" ? props.goals : {}) as Record<string, unknown>;
  const hidden = Array.isArray(props.hiddenModules) && props.hiddenModules.includes("goals");
  // Lenient on the way out: a goal the builder left half-typed is dropped from the list, not an error.
  return cleanGoals({ ...goals, moduleHidden: hidden }).goals;
}

/**
 * Replace the hub's goals. Returns new blocks, or null when the page has no
 * workspace block. Everything else on the page is untouched.
 */
export function setRoomGoals(blocks: unknown, goals: RoomGoalsInput): unknown[] | null {
  const block = workspaceBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const props = block.props ?? {};
  const before = (props.goals && typeof props.goals === "object" ? props.goals : {}) as Record<string, unknown>;
  const hiddenBefore = Array.isArray(props.hiddenModules) ? (props.hiddenModules as unknown[]) : [];
  const hiddenModules = goals.moduleHidden ? (hiddenBefore.includes("goals") ? hiddenBefore : [...hiddenBefore, "goals"]) : hiddenBefore.filter((m) => m !== "goals");
  const next = { ...props, goals: { ...before, intro: goals.intro, askAgreement: goals.askAgreement, items: goals.items }, hiddenModules };
  return blocks.map((b) => (b === block ? { ...(b as object), props: next } : b));
}

/* ── The cover, edited from the team's pop-up ────────────────────────────── */

export const ROOM_COVER_STYLES = ["fade", "split", "fullbleed", "light"] as const;
export type RoomCoverStyle = (typeof ROOM_COVER_STYLES)[number];

export interface RoomCoverInput {
  /** Blank = the default headline ("Customer × Us Partnership Hub"). */
  headline: string;
  /** The small label above the headline. Blank hides it. */
  eyebrow: string;
  coverStyle: RoomCoverStyle;
  /** Fading-photo cover only: the photo scrolls with the page instead of staying put. */
  coverPhotoScrolls: boolean;
}

function coverText(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

export function parseRoomCover(raw: unknown): { ok: true; cover: RoomCoverInput } | { ok: false; error: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = coverText(r.headline);
  const eyebrow = coverText(r.eyebrow);
  if (headline.length > 160) return { ok: false, error: "Keep the headline under 160 characters." };
  if (eyebrow.length > 80) return { ok: false, error: "Keep the label under 80 characters." };
  const coverStyle = (ROOM_COVER_STYLES as readonly unknown[]).includes(r.coverStyle) ? (r.coverStyle as RoomCoverStyle) : "fade";
  return { ok: true, cover: { headline, eyebrow, coverStyle, coverPhotoScrolls: r.coverPhotoScrolls === true } };
}

/** The hub's cover as stored (account-name variables left as typed), or null when the page has no workspace block. */
export function roomCoverInfo(blocks: unknown): RoomCoverInput | null {
  const props = workspaceBlock(blocks)?.props;
  if (!props) return null;
  const parsed = parseRoomCover(props);
  return parsed.ok ? parsed.cover : { headline: "", eyebrow: coverText(props.eyebrow).slice(0, 80), coverStyle: "fade", coverPhotoScrolls: props.coverPhotoScrolls === true };
}

/** Replace the cover's text and style. Returns new blocks, or null when the page has no workspace block. */
export function setRoomCover(blocks: unknown, cover: RoomCoverInput): unknown[] | null {
  const block = workspaceBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const next = { ...(block.props ?? {}), headline: cover.headline, eyebrow: cover.eyebrow, coverStyle: cover.coverStyle, coverPhotoScrolls: cover.coverPhotoScrolls };
  return blocks.map((b) => (b === block ? { ...(b as object), props: next } : b));
}

/* ── Which parts of the Overview a hub shows, set from the team's pop-up ─── */

/** The parts of the Overview a rep can switch off. Mirrors the block's ROOM_OVERVIEW_SECTIONS. */
export const ROOM_OVERVIEW_SECTIONS = ["progress", "next", "coming", "overdue", "orders", "feed"] as const;
export type RoomOverviewSection = (typeof ROOM_OVERVIEW_SECTIONS)[number];

/** Keep only known section names, once each, in the standard order. */
export function parseRoomOverviewHidden(raw: unknown): RoomOverviewSection[] {
  const asked = new Set(Array.isArray(raw) ? raw : []);
  return ROOM_OVERVIEW_SECTIONS.filter((k) => asked.has(k));
}

/** The Overview sections hidden on this hub, or null when the page has no workspace block. */
export function roomOverviewHidden(blocks: unknown): RoomOverviewSection[] | null {
  const props = workspaceBlock(blocks)?.props;
  return props ? parseRoomOverviewHidden(props.hiddenOverview) : null;
}

/** Replace the hidden Overview sections. Returns new blocks, or null when the page has no workspace block. */
export function setRoomOverviewHidden(blocks: unknown, hidden: RoomOverviewSection[]): unknown[] | null {
  const block = workspaceBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const next = { ...(block.props ?? {}), hiddenOverview: hidden };
  return blocks.map((b) => (b === block ? { ...(b as object), props: next } : b));
}

/* ── The hub's Important links, edited from the team's pop-up ────────────── */

export interface RoomLinkInput {
  /** Set on links the app files itself (the practice microsite), so it can find them again. */
  key?: string;
  title: string;
  description?: string;
  url: string;
  hidden?: boolean;
  /** An uploaded file (PDF or image) instead of a web page. It opens in the hub's viewer. `url` is then the same address. */
  fileUrl?: string;
  kind?: "pdf" | "image";
  /** The name its opens are counted under. Set when a link is renamed, so the count carries over. */
  viewKey?: string;
}
export const ROOM_LINKS_MAX = 30;
const linkViewKey = (v: unknown): { viewKey?: string } => (typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(v.trim()) ? { viewKey: v.trim() } : {});
/** Where an uploaded resource may live: our own storage, or an https address the upload route handed back. */
const isStoredFileUrl = (u: string) => u.length <= 2000 && (/^\/api\/storage\/[\w\-./%]+$/.test(u) || /^https:\/\/[^\s]+$/.test(u));

/** Check a list of links from the pop-up: each needs a name and a web address. */
export function parseRoomLinks(raw: unknown): { ok: true; links: RoomLinkInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Send the list of links." };
  if (raw.length > ROOM_LINKS_MAX) return { ok: false, error: `Keep it to ${ROOM_LINKS_MAX} links.` };
  const links: RoomLinkInput[] = [];
  for (const item of raw) {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const title = coverText(r.title);
    const description = coverText(r.description);
    let url = typeof r.url === "string" ? r.url.trim() : "";
    // "drive.google.com/…" pasted without the scheme is still a web address.
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
    if (!title) return { ok: false, error: "Give each link a name." };
    if (title.length > 120) return { ok: false, error: "Keep link names under 120 characters." };
    if (description.length > 200) return { ok: false, error: "Keep link descriptions under 200 characters." };
    const fileUrl = typeof r.fileUrl === "string" ? r.fileUrl.trim() : "";
    if (fileUrl) {
      if (!isStoredFileUrl(fileUrl)) return { ok: false, error: `“${title}” isn't a file this hub can show. Upload it again.` };
      links.push({ ...(typeof r.key === "string" && r.key.trim() ? { key: r.key.trim().slice(0, 80) } : {}), title, ...(description ? { description } : {}), url: fileUrl, fileUrl, kind: r.kind === "image" ? "image" : "pdf", ...linkViewKey(r.viewKey), ...(r.hidden === true ? { hidden: true } : {}) });
      continue;
    }
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || !/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".") || url.length > 2000) return { ok: false, error: `“${title}” needs a web address that starts with https://` };
    links.push({ ...(typeof r.key === "string" && r.key.trim() ? { key: r.key.trim().slice(0, 80) } : {}), title, ...(description ? { description } : {}), url, ...linkViewKey(r.viewKey), ...(r.hidden === true ? { hidden: true } : {}) });
  }
  return { ok: true, links };
}

/** The hub's links as stored, or null when the page has no workspace block. */
export function roomLinksInfo(blocks: unknown): RoomLinkInput[] | null {
  const props = workspaceBlock(blocks)?.props;
  if (!props) return null;
  const stored = Array.isArray(props.links) ? (props.links as Record<string, unknown>[]) : [];
  return stored
    .filter((l) => l && typeof l === "object")
    .map((l) => ({ ...(typeof l.key === "string" && l.key ? { key: l.key } : {}), title: coverText(l.title), ...(coverText(l.description) ? { description: coverText(l.description) } : {}), url: typeof l.url === "string" ? l.url : "", ...(typeof l.fileUrl === "string" && l.fileUrl ? { fileUrl: l.fileUrl, kind: l.kind === "image" ? ("image" as const) : ("pdf" as const) } : {}), ...linkViewKey(l.viewKey), ...(l.hidden === true ? { hidden: true } : {}) }));
}

/** Replace the hub's links. Returns new blocks, or null when the page has no workspace block. */
export function setRoomLinks(blocks: unknown, links: RoomLinkInput[]): unknown[] | null {
  const block = workspaceBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const next = { ...(block.props ?? {}), links };
  return blocks.map((b) => (b === block ? { ...(b as object), props: next } : b));
}

/** The launch-kit files that are the same for every customer. Uploaded once per workspace. */
export const ROOM_STANDARD_ASSETS: { key: string; title: string; description: string }[] = [
  { key: "practice-welcome-guide", title: "Practice Welcome Guide", description: "What a practice can expect: training, first cases and who to call" },
  { key: "success-guide", title: "Success Guide", description: "The 90-day plan: how the partnership runs and what it delivers" },
];

/* ── The account name as a variable ──────────────────────────────────────── */

// The builder's page-level names for the same thing ({{account_name}}, {{company}}, {{company_name}}) work too.
const ACCOUNT_TOKEN = /\{\{\s*(?:account|account_name|company|company_name)\s*\}\}|\[partner name\]/gi;
const ACCOUNT_SHORT_TOKEN = /\{\{\s*account_short\s*\}\}|\[partner\]/gi;
const NAME_KEYS = new Set(["partnerName", "partnerShort", "regionalsNoun", "locationsNoun"]);

/** Replace the account-name variables in one string. `{{account}}` / `[Partner name]` → the name; `{{account_short}}` / `[Partner]` → the short name (or the name). */
export function fillAccountName(text: string, name: string, short: string): string {
  return text.includes("{{") || text.includes("[") ? text.replace(ACCOUNT_TOKEN, name).replace(ACCOUNT_SHORT_TOKEN, short) : text;
}

const REGIONALS = /\b(regional)\s+(manager|leader)(s?)\b/gi;
const isAcronym = (w: string) => (w.match(/[A-Z]/g) ?? []).length >= 2;
const capWord = (w: string) => (isAcronym(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const lowWord = (w: string) => (isAcronym(w) ? w : w.toLowerCase());

/**
 * What the customer calls its regional managers ("DBOs", "RDs", "regional
 * directors", plural): every "regional manager(s)" / "regional leader(s)"
 * becomes it, keeping the sentence's capitals; acronyms keep theirs. Blank
 * leaves the text alone. Same rule as the hub page's `fillRegionalsWord`
 * (blocks/hub/room-words.ts).
 */
export function fillRegionalsWord(text: string, word: string): string {
  const plural = word.replace(/\s+/g, " ").trim();
  if (!plural || !/regional/i.test(text)) return text;
  const singular = /s$/i.test(plural) && plural.length > 1 ? plural.slice(0, -1) : plural;
  return text.replace(REGIONALS, (_m, first: string, second: string, s: string) => {
    const words = (s ? plural : singular).split(" ");
    if (/^[A-Z]/.test(first) && /^[A-Z]/.test(second)) return words.map(capWord).join(" ");
    if (/^[A-Z]/.test(first)) return words.map((w, i) => (i === 0 ? capWord(w) : lowWord(w))).join(" ");
    return words.map(lowWord).join(" ");
  });
}

function fillDeep(node: unknown, name: string, short: string, regionals = ""): unknown {
  if (typeof node === "string") return fillRegionalsWord(name ? fillAccountName(node, name, short) : node, regionals);
  if (Array.isArray(node)) {
    let changed = false;
    const out = node.map((n) => {
      const r = fillDeep(n, name, short, regionals);
      if (r !== n) changed = true;
      return r;
    });
    return changed ? out : node;
  }
  if (node && typeof node === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      const r = NAME_KEYS.has(k) ? v : fillDeep(v, name, short, regionals);
      if (r !== v) changed = true;
      out[k] = r;
    }
    return changed ? out : node;
  }
  return node;
}

/**
 * A room page's blocks with the account-name variables filled from the room's
 * customer name, so every reader (tasks, digest, feed, kit) sees the same
 * text the page shows. Untouched while the name is blank or still a placeholder.
 * Read-only use: always write the ORIGINAL blocks back, never these.
 */
export function resolveRoomBlocks<T>(blocks: T): T {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => {
    if (!b || typeof b !== "object" || (b as { type?: unknown }).type !== "room-workspace") return b;
    const props = (b as { props?: Record<string, unknown> }).props ?? {};
    const typed = typeof props.partnerName === "string" ? props.partnerName.trim() : "";
    const name = !typed || /^\[partner/i.test(typed) || /\{\{/.test(typed) ? "" : typed;
    const regionals = typeof props.regionalsNoun === "string" ? props.regionalsNoun.trim() : "";
    if (!name && !regionals) return b;
    const short = typeof props.partnerShort === "string" && props.partnerShort.trim() && !/^\[partner/i.test(props.partnerShort.trim()) ? props.partnerShort.trim() : name;
    const next = fillDeep(props, name, short, regionals);
    return next === props ? b : { ...b, props: next };
  }) as unknown as T;
}

/**
 * What a hub's share card says. A hub page is one big block whose props hold
 * an internal `title` ("launch plan") and the customer's logo, so the general
 * card walk printed "launch plan" beside a second logo. The card shows what the
 * cover shows instead: the typed headline, else "Customer × Us Partnership
 * Hub", with no second logo (the headline already names the customer).
 * Null when the page is not a hub.
 */
export function roomOgCardCopy(blocks: unknown, brandName: string): { headline: string; subheadline: string } | null {
  const resolved = resolveRoomBlocks(blocks);
  const block = Array.isArray(resolved)
    ? (resolved as unknown[]).find((b) => !!b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace")
    : null;
  if (!block) return null;
  const props = (block as { props?: Record<string, unknown> }).props ?? {};
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const named = text(props.partnerName);
  const partner = !named || /^\[partner/i.test(named) || /\{\{/.test(named) ? "" : named;
  const brand = brandName.trim();
  const fallback = [partner, brand].filter(Boolean).join(" × ");
  return {
    headline: text(props.headline) || `${fallback} Partnership Hub`.trim(),
    subheadline: text(props.lede),
  };
}

/* ── Account and team, edited from the team's pop-up ─────────────────────── */

/** The page props the pop-up's Account settings may change. Mirrors the client's ROOM_ACCOUNT_KEYS. */
export const ROOM_ACCOUNT_KEYS = ["partnerName", "partnerShort", "locationsNoun", "regionalsNoun", "partnerLogoUrl", "partnerLogoOriginal", "partnerLogoScale", "brandLogoScale", "requireEmail", "shareMap", "look", "scheduleUrl", "scheduleRep", "scheduleLabel", "scheduleAction", "scheduleChilipiperUrl", "scheduleVideoUrl", "modalChilipiperUrl", "modalFormSource", "modalFormId", "modalMarketoBaseUrl", "modalMarketoMunchkinId", "modalMarketoFormId", "modalChiliPiperHandoffUrl", "modalChiliPiperHandoffMode", "modalChiliPiperHandoffFieldMap", "modalHeadline", "modalSubheadline", "modalSubmitText", "modalSuccessMessage", "modalDisclaimer", "modalShowFirstName", "modalShowLastName", "modalShowPhone", "modalShowCompany", "kickoffDate", "rolloutDays", "headline", "eyebrow", "coverStyle", "coverPhotoScrolls", "heroImageUrl", "feedPhotoUrl"] as const;
export const ROOM_TEAM_MAX_GROUPS = 8;
export const ROOM_TEAM_MAX_MEMBERS = 200;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** A picture's address: this app's own storage, another path on this site, or a web address. Never a script. */
function imageAddress(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  if (s.length > 1000 || /\s/.test(s) || s.includes("..")) return null;
  return /^https?:\/\//i.test(s) || /^\/[A-Za-z0-9]/.test(s) ? s : null;
}
const webAddress = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  return s.length <= 500 && !/\s/.test(s) && /^https?:\/\/[^/]+/i.test(s) ? s : null;
};
const percent = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(300, Math.max(50, Math.round(v))) : 100);

/**
 * The Account settings as sent by the pop-up. Only the keys that were sent
 * are returned, so a caller that sends a few changes only those.
 */
export function parseRoomAccount(raw: unknown): Parsed<Record<string, unknown>> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const has = (k: (typeof ROOM_ACCOUNT_KEYS)[number]) => r[k] !== undefined;
  if (has("partnerName")) {
    const name = cleanText(r.partnerName, 120);
    if (!name) return { ok: false, error: "Add the customer's name." };
    out.partnerName = name;
  }
  if (has("partnerShort")) out.partnerShort = cleanText(r.partnerShort, 60);
  // What the customer calls its locations and its regional managers, plural ("offices", "DBOs").
  for (const k of ["locationsNoun", "regionalsNoun"] as const) if (has(k)) out[k] = cleanText(r[k], 40);
  for (const k of ["partnerLogoUrl", "heroImageUrl", "feedPhotoUrl"] as const) {
    if (!has(k)) continue;
    const url = imageAddress(r[k]);
    if (url === null) return { ok: false, error: "One of the pictures has an address that can't be used. Upload it again." };
    out[k] = url;
  }
  for (const k of ["partnerLogoOriginal", "requireEmail", "shareMap", "coverPhotoScrolls"] as const) if (has(k)) out[k] = r[k] === true;
  for (const k of ["partnerLogoScale", "brandLogoScale"] as const) if (has(k)) out[k] = percent(r[k]);
  if (has("look")) out.look = r.look === "polished" ? "polished" : "classic";
  // The top-bar button does what any button in LP Studio can: a link, a Chili Piper popup, a form or a video.
  const ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"];
  if (has("scheduleAction")) out.scheduleAction = ACTIONS.includes(String(r.scheduleAction)) ? r.scheduleAction : "url";
  const linkAction = !has("scheduleAction") || out.scheduleAction === "url";
  if (has("scheduleUrl")) {
    const url = webAddress(r.scheduleUrl);
    // Only a button that opens the link needs the link to be right; any other kind ignores a half-typed one.
    if (url === null && linkAction) return { ok: false, error: "The button’s link needs to start with https://" };
    out.scheduleUrl = url ?? "";
  }
  for (const k of ["scheduleChilipiperUrl", "scheduleVideoUrl", "modalChilipiperUrl", "modalMarketoBaseUrl", "modalChiliPiperHandoffUrl"] as const) {
    if (!has(k)) continue;
    const url = webAddress(r[k]);
    if (url === null) return { ok: false, error: "One of the button’s links needs to start with https://" };
    out[k] = url;
  }
  for (const k of ["modalFormSource", "modalMarketoMunchkinId", "modalMarketoFormId", "modalChiliPiperHandoffMode", "modalHeadline", "modalSubheadline", "modalSubmitText", "modalSuccessMessage", "modalDisclaimer"] as const) if (has(k)) out[k] = cleanText(r[k], 600);
  for (const k of ["modalShowFirstName", "modalShowLastName", "modalShowPhone", "modalShowCompany"] as const) if (has(k)) out[k] = r[k] === true;
  if (has("modalFormId")) out.modalFormId = typeof r.modalFormId === "number" && Number.isInteger(r.modalFormId) && r.modalFormId > 0 ? r.modalFormId : typeof r.modalFormId === "string" && /^\d{1,9}$/.test(r.modalFormId.trim()) ? Number(r.modalFormId.trim()) : null;
  if (has("modalChiliPiperHandoffFieldMap")) {
    // A small map of form field → Chili Piper field. Anything else is dropped.
    const map = r.modalChiliPiperHandoffFieldMap;
    out.modalChiliPiperHandoffFieldMap = map && typeof map === "object" && !Array.isArray(map) && JSON.stringify(map).length <= 4000 ? Object.fromEntries(Object.entries(map as Record<string, unknown>).filter(([k, v]) => typeof v === "string" && k.length <= 80 && v.length <= 200).slice(0, 40)) : null;
  }
  if (has("scheduleRep")) out.scheduleRep = cleanText(r.scheduleRep, 120);
  if (has("scheduleLabel")) out.scheduleLabel = cleanText(r.scheduleLabel, 40);
  if (has("kickoffDate")) {
    const d = typeof r.kickoffDate === "string" ? r.kickoffDate.trim() : "";
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, error: "Pick the kickoff date from the calendar." };
    out.kickoffDate = d;
  }
  if (has("rolloutDays")) out.rolloutDays = Math.min(730, Math.max(1, Math.round(Number(r.rolloutDays)) || 90));
  if (has("headline") || has("eyebrow") || has("coverStyle")) {
    const cover = parseRoomCover(r);
    if (!cover.ok) return cover;
    if (has("headline")) out.headline = cover.cover.headline;
    if (has("eyebrow")) out.eyebrow = cover.cover.eyebrow;
    if (has("coverStyle")) out.coverStyle = cover.cover.coverStyle;
  }
  return { ok: true, value: out };
}

/** The team list as sent by the pop-up: the note beside the heading and the groups of named people. */
export function parseRoomTeam(raw: unknown): Parsed<{ teamNote: string; team: Record<string, unknown>[] }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const groups = Array.isArray(r.team) ? r.team : [];
  if (groups.length > ROOM_TEAM_MAX_GROUPS) return { ok: false, error: `Keep the team to ${ROOM_TEAM_MAX_GROUPS} groups.` };
  const team: Record<string, unknown>[] = [];
  for (const g of groups) {
    const group = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
    const list = Array.isArray(group.members) ? group.members : [];
    if (list.length > ROOM_TEAM_MAX_MEMBERS) return { ok: false, error: `A group can hold ${ROOM_TEAM_MAX_MEMBERS} people.` };
    const members: Record<string, unknown>[] = [];
    for (const m of list) {
      const person = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
      const name = cleanText(person.name, 120);
      if (!name) continue;
      const photoUrl = imageAddress(person.photoUrl);
      const bookingUrl = webAddress(person.bookingUrl);
      if (photoUrl === null) return { ok: false, error: `${name}'s photo has an address that can't be used. Upload it again.` };
      if (bookingUrl === null) return { ok: false, error: `${name}'s booking link needs to start with https://` };
      const email = cleanText(person.email, 200);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: `${name}'s email doesn't look right.` };
      const text = { role: cleanText(person.role, 120), owns: cleanText(person.owns, 200), when: cleanText(person.when, 200), email, phone: cleanText(person.phone, 40), bookingUrl, photoUrl };
      members.push({ name, ...Object.fromEntries(Object.entries(text).filter(([, v]) => v)), ...(person.hidden === true ? { hidden: true } : {}) });
    }
    team.push({ title: cleanText(group.title, 80) || "Team", members, ...(group.hidden === true ? { hidden: true } : {}) });
  }
  return { ok: true, value: { teamNote: cleanText(r.teamNote, 200), team } };
}

/** The Account settings and team list as stored (account-name variables left as typed), or null when the page has no workspace block. */
export function roomAccountInfo(blocks: unknown): { account: Record<string, unknown>; team: { teamNote: string; team: unknown[] } } | null {
  const props = workspaceBlock(blocks)?.props;
  if (!props) return null;
  const account: Record<string, unknown> = {};
  for (const k of ROOM_ACCOUNT_KEYS) if (props[k] !== undefined) account[k] = props[k];
  return { account, team: { teamNote: typeof props.teamNote === "string" ? props.teamNote : "", team: Array.isArray(props.team) ? props.team : [] } };
}

/** Lay parsed settings over the hub block's props. Returns new blocks, or null when the page has no workspace block. Everything else is untouched. */
export function setRoomProps(blocks: unknown, patch: Record<string, unknown>): unknown[] | null {
  const block = workspaceBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  return blocks.map((b) => (b === block ? { ...(b as object), props: { ...(block.props ?? {}), ...patch } } : b));
}
