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
        const a = (step as { action?: unknown }).action;
        const key = planTaskKey({ key: (step as { key?: unknown }).key, task: (step as { title?: unknown }).title });
        if (!key || out.has(key) || !["upload", "check", "team", "link", "request"].includes(String(a))) continue;
        out.set(key, { key, title: String((step as { title?: unknown }).title ?? key), action: a === "upload" ? "upload" : "check" });
      }
    }
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
}

/**
 * Decisions the page offers the customer: marketing programs with options
 * (Include / Not now, an amount, an event format). A program without options
 * is fixed ("in plan") and takes no choice.
 */
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
        const options = Array.isArray(rawOptions) ? rawOptions.filter((o): o is string => typeof o === "string" && !!o.trim()).map((o) => o.trim()) : [];
        const key = planTaskKey({ key: (p as { key?: unknown }).key, task: (p as { title?: unknown }).title });
        if (!key || options.length < 2 || out.has(key)) continue;
        out.set(key, { key, title: String((p as { title?: unknown }).title ?? key), options });
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
}

/** One practice row from a pasted list or an API body; null when it has no name. */
export function parsePracticeRow(row: Record<string, unknown>): RoomPracticeInput | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = cleanText(row[k], 160);
      if (v) return v;
    }
    return null;
  };
  const name = get("name", "practice", "practice_name", "practice name", "account", "account name");
  if (!name) return null;
  const state = get("state", "billing state/province", "billing state", "billing state / province");
  return {
    externalId: get("externalId", "external_id", "sfdc_id", "sfdc id", "salesforce_id", "id", "account id", "18 digit id", "account id (18)"),
    name,
    // No region column (a plain Salesforce report): group by state.
    region: get("region", "market", "region / regional manager") ?? state,
    city: get("city", "billing city"),
    state,
    wave: get("wave"),
    stage: normalizePracticeStage(get("stage", "status")),
    stageGiven: !!get("stage", "status"),
    trainingDate: get("trainingDate", "training_date", "training date", "training"),
    liveDate: get("liveDate", "live_date", "live date", "activated date", "activated"),
  };
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
  /** The first launch-kit link (the sign-up page), for the one-pager's QR code. */
  signupUrl: string;
  assets: { key: string; title: string; kind: string; hasFile: boolean; hidden: boolean }[];
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
    signupUrl: str(links.find((l) => l && !l.hidden && /^https?:\/\//.test(str(l.url)))?.url),
    assets: assets.filter((a) => a && typeof a === "object").map((a) => ({ key: str(a.key) || planTaskKey({ task: a.title }), title: str(a.title), kind: str(a.kind), hasFile: !!(str(a.fileUrl) || str(a.videoUrl) || str(a.externalUrl) || str(a.body)), hidden: a.hidden === true })),
  };
}

export interface RoomKitAssetInput {
  key: string;
  kind: "pdf" | "image";
  title: string;
  description?: string;
  fileUrl: string;
}

/** A generated file's address must be this app's own storage: never an outside URL. */
export function parseRoomKitAsset(raw: unknown): RoomKitAssetInput | null {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  const fileUrl = typeof b.fileUrl === "string" ? b.fileUrl.trim() : "";
  const title = cleanText(b.title, 120);
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(key) || (b.kind !== "pdf" && b.kind !== "image") || !title) return null;
  if (!/^\/api\/storage\/[A-Za-z0-9/_.-]{1,300}$/.test(fileUrl) || fileUrl.includes("..")) return null;
  return { key, kind: b.kind, title, description: cleanText(b.description, 200) || undefined, fileUrl };
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
      ? assets.map((a, i) => (i === at ? { ...a, kind: asset.kind, fileUrl: asset.fileUrl, hidden: false } : a))
      : [...assets, { key: asset.key, kind: asset.kind, title: asset.title, ...(asset.description ? { description: asset.description } : {}), fileUrl: asset.fileUrl }];
  return blocks.map((b) => (b === block ? { ...(b as object), props: { ...props, assets: next } } : b));
}

/** The launch-kit files that are the same for every customer. Uploaded once per workspace. */
export const ROOM_STANDARD_ASSETS: { key: string; title: string; description: string }[] = [
  { key: "practice-welcome-guide", title: "Practice Welcome Guide", description: "What a practice can expect: training, first cases and who to call" },
  { key: "success-guide", title: "Success Guide", description: "The 90-day plan: how the partnership runs and what it delivers" },
];
