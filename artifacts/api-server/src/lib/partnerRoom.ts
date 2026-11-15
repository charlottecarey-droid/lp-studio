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
import crypto from "crypto";

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

/** Block types that make a page a room. `room-workspace` keeps its plan in `planGroups`, `hub-plan` in `lanes`. */
export const ROOM_BLOCK_TYPES = ["room-workspace", "hub-plan"] as const;

/** True when the page carries a room block (so it has room state even with no customer tasks). */
export function pageIsRoom(blocks: unknown): boolean {
  return Array.isArray(blocks) && blocks.some((b) => !!b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace");
}

/** Every task on the page a customer may act on, keyed. Later duplicates of a key are ignored. */
export function extractRoomTasks(blocks: unknown): Map<string, RoomTask> {
  const out = new Map<string, RoomTask>();
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    const type = b && typeof b === "object" ? (b as { type?: unknown }).type : null;
    if (type !== "hub-plan" && type !== "room-workspace") continue;
    const props = (b as { props?: { lanes?: unknown; planGroups?: unknown } }).props;
    const lanes = (type === "room-workspace" ? props?.planGroups : props?.lanes) ?? [];
    if (!Array.isArray(lanes)) continue;
    for (const lane of lanes) {
      const rows = (lane as { rows?: unknown })?.rows;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const action = (row as { customerAction?: unknown }).customerAction;
        if (action !== "check" && action !== "upload") continue;
        const key = planTaskKey(row as { key?: unknown; task?: unknown });
        if (!key || out.has(key)) continue;
        out.set(key, { key, title: String((row as { task?: unknown }).task ?? key), action });
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
