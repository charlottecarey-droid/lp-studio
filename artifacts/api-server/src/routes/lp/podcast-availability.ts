// Public endpoint that reads "OPEN" recording slots from the Margin Line podcast
// guest tracker Google Sheet (or any other configured sheet) and returns them
// to the guest application form on the content-series landing block.
//
// Wired via the Replit Google Sheets integration (connector id
// `connection:conn_google-sheet_*`). Auth/token refresh is handled by the
// ReplitConnectors proxy; we only need to forward the GET to the Sheets v4
// values endpoint.
import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, lpPagesTable } from "@workspace/db";

const router = Router();
const connectors = new ReplitConnectors();

// Walks a page's blocks tree and collects every (sheetId, tab) pair configured
// on a content-series block. Used to guarantee that the public availability
// endpoint can only read sheets that are actually wired into a real page —
// preventing the route from being abused as a generic Sheets-read proxy.
function collectAllowedAvailability(blocks: unknown): Set<string> {
  const allowed = new Set<string>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    const kind = typeof obj.kind === "string" ? obj.kind : typeof obj.type === "string" ? obj.type : null;
    if (kind === "content-series") {
      const props = (obj.props ?? obj) as Record<string, unknown>;
      const sheetId = typeof props.availabilitySheetId === "string" ? props.availabilitySheetId : null;
      if (sheetId) {
        const tab = typeof props.availabilitySheetTab === "string" && props.availabilitySheetTab
          ? props.availabilitySheetTab
          : "Scheduled";
        allowed.add(`${sheetId}::${tab}`);
      }
    }
    for (const value of Object.values(obj)) walk(value);
  };
  walk(blocks);
  return allowed;
}

interface Slot {
  start: string;
  end: string;
  label: string;
}
interface DateEntry {
  date: string;
  dateLabel: string;
  slots: Slot[];
}
interface AvailabilityResponse {
  dates: DateEntry[];
  fetchedAt: string;
}

const SHEET_ID_RE = /^[A-Za-z0-9_-]{20,}$/;
const TAB_RE = /^[A-Za-z0-9 _-]{1,64}$/;

const cache = new Map<string, { at: number; data: AvailabilityResponse }>();
const CACHE_TTL_MS = 60_000;

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function parseDate(raw: string): { date: string; label: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let y: number;
  let mo: number;
  let d: number;
  let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    y = parseInt(m[1], 10);
    mo = parseInt(m[2], 10);
    d = parseInt(m[3], 10);
  } else if ((m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    mo = parseInt(m[1], 10);
    d = parseInt(m[2], 10);
    y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  // Round-trip check: JS Date silently normalizes invalid days like Feb 31 →
  // March 3. Reject anything that doesn't survive the round-trip.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  const iso = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()];
  const monName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo - 1];
  return { date: iso, label: `${dayName} ${monName} ${d}` };
}

function fmt12(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const min = mins % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return min === 0 ? `${h12} ${ap}` : `${h12}:${String(min).padStart(2, "0")} ${ap}`;
}
function fmt24(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function parseTimeRange(raw: string): Slot[] {
  const upper = raw.trim().toUpperCase();
  if (!upper || upper === "OPEN" || upper === "TBD" || upper === "TBA") {
    return [{ start: "", end: "", label: "Flexible — we'll coordinate" }];
  }
  const cleaned = raw
    .replace(/\s+ET\b/i, "")
    .replace(/[\u2013\u2014]/g, "-")
    .trim();
  const m = cleaned.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i);
  if (!m) return [];
  const [, sh, sm, sapRaw, eh, em, eapRaw] = m;
  const eap = eapRaw.toUpperCase();
  const sap = (sapRaw ?? eap).toUpperCase();
  const to24 = (h: string, ap: string): number => {
    let n = parseInt(h, 10);
    if (ap === "PM" && n !== 12) n += 12;
    if (ap === "AM" && n === 12) n = 0;
    return n;
  };
  const startMin = to24(sh, sap) * 60 + (sm ? parseInt(sm, 10) : 0);
  const endMin = to24(eh, eap) * 60 + (em ? parseInt(em, 10) : 0);
  if (endMin <= startMin) return [];

  const slots: Slot[] = [];
  const duration = endMin - startMin;
  if (duration <= 60) {
    slots.push({
      start: fmt24(startMin),
      end: fmt24(endMin),
      label: `${fmt12(startMin)}–${fmt12(endMin)} ET`,
    });
  } else {
    for (let s = startMin; s + 60 <= endMin; s += 60) {
      slots.push({
        start: fmt24(s),
        end: fmt24(s + 60),
        label: `${fmt12(s)}–${fmt12(s + 60)} ET`,
      });
    }
  }
  return slots;
}

router.get("/lp/podcast-availability", limiter, async (req, res): Promise<void> => {
  const sheetId = String(req.query.sheetId || "");
  if (!SHEET_ID_RE.test(sheetId)) {
    res.status(400).json({ error: "Invalid sheetId" });
    return;
  }
  const tab = String(req.query.tab || "Scheduled");
  if (!TAB_RE.test(tab)) {
    res.status(400).json({ error: "Invalid tab name" });
    return;
  }
  // Access control: the (sheetId, tab) pair must be configured on a block of
  // the page identified by `pageId`. This prevents the route from being abused
  // as a generic Google Sheets read proxy against any sheet our connector can
  // see — callers must reference a real page that owns the configuration.
  const pageIdRaw = String(req.query.pageId || "");
  const pageId = /^\d+$/.test(pageIdRaw) ? parseInt(pageIdRaw, 10) : NaN;
  if (!Number.isFinite(pageId)) {
    res.status(400).json({ error: "Missing or invalid pageId" });
    return;
  }
  try {
    const rows = await db
      .select({ blocks: lpPagesTable.blocks })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.id, pageId))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    const allowed = collectAllowedAvailability(rows[0].blocks);
    if (!allowed.has(`${sheetId}::${tab}`)) {
      res.status(403).json({ error: "Sheet not configured for this page" });
      return;
    }
  } catch (err) {
    console.error("[podcast-availability] page lookup failed:", err);
    res.status(500).json({ error: "Page lookup failed" });
    return;
  }

  const cacheKey = `${sheetId}::${tab}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.json(cached.data);
    return;
  }

  try {
    const range = encodeURIComponent(`${tab}!C2:E1000`);
    const resp = await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${sheetId}/values/${range}`,
      { method: "GET" },
    );
    if (!resp.ok) {
      const text = await resp.text();
      console.error("[podcast-availability] sheets API error:", resp.status, text.slice(0, 500));
      res.status(502).json({ error: "Sheets API error" });
      return;
    }
    const data = (await resp.json()) as { values?: string[][] };
    const rows = data.values ?? [];

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const byDate = new Map<string, DateEntry>();
    for (const row of rows) {
      const status = (row[0] ?? "").trim();
      if (status.toUpperCase() !== "OPEN") continue;
      const parsedDate = parseDate(row[1] ?? "");
      if (!parsedDate) continue;
      // Filter past dates
      const dateMs = Date.parse(`${parsedDate.date}T00:00:00Z`);
      if (Number.isFinite(dateMs) && dateMs < today.getTime()) continue;

      const slots = parseTimeRange(row[2] ?? "");
      if (!slots.length) continue;

      const entry = byDate.get(parsedDate.date) ?? {
        date: parsedDate.date,
        dateLabel: parsedDate.label,
        slots: [],
      };
      entry.slots.push(...slots);
      byDate.set(parsedDate.date, entry);
    }

    const dates = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const result: AvailabilityResponse = { dates, fetchedAt: new Date().toISOString() };
    cache.set(cacheKey, { at: Date.now(), data: result });
    res.json(result);
  } catch (err) {
    console.error("[podcast-availability] error:", err);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// ---------------------------------------------------------------------------
// Submission writeback: append guest applications to the same Google Sheet
// (under a separate "Applications" tab so the existing Scheduled tab is left
// untouched). Called from the /lp/leads handler in a background task.
// ---------------------------------------------------------------------------

const APPLICATIONS_TAB = "Applications";
const APPLICATION_HEADERS = [
  "Submitted At (UTC)",
  "Picked Date(s)",
  "Picked Time(s)",
  "Scheduling Comments",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Company / Practice",
  "Role / Title",
  "Story / Notes",
  "Source",
  "Page",
  "All Fields (JSON)",
];

/** Parse the picker's storage format. Each line is one pick of the form
 *  `YYYY-MM-DD|HH:MM|HH:MM::Fri May 29 · 1 PM–2 PM ET`. Returns the dates
 *  and times as separate "; "-joined strings for the dedicated columns. */
function pickSlots(value: string | undefined): { dates: string; times: string } {
  if (!value) return { dates: "", times: "" };
  const lines = value.split("\n").map(s => s.trim()).filter(Boolean);
  const dates: string[] = [];
  const times: string[] = [];
  for (const line of lines) {
    const sep = line.indexOf("::");
    const display = sep >= 0 ? line.slice(sep + 2) : line;
    const dotIdx = display.indexOf(" · ");
    if (dotIdx >= 0) {
      dates.push(display.slice(0, dotIdx));
      times.push(display.slice(dotIdx + 3));
    } else {
      dates.push(display);
    }
  }
  // Dedupe dates (multiple slots on the same day).
  const uniqDates = Array.from(new Set(dates));
  return { dates: uniqDates.join("; "), times: times.join("; ") };
}

function pickField(fields: Record<string, unknown>, ...names: string[]): string {
  for (const n of names) {
    const v = fields[n];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

async function ensureApplicationsTab(sheetId: string): Promise<void> {
  // Read the spreadsheet metadata to see if the tab already exists. If not,
  // batchUpdate to add it and seed the header row.
  const metaResp = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${sheetId}?fields=sheets(properties(title))`,
    { method: "GET" },
  );
  if (!metaResp.ok) {
    throw new Error(`Sheets metadata fetch failed (${metaResp.status})`);
  }
  const meta = (await metaResp.json()) as { sheets?: { properties?: { title?: string } }[] };
  const exists = (meta.sheets ?? []).some(s => s.properties?.title === APPLICATIONS_TAB);
  if (exists) return;

  const addResp = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: APPLICATIONS_TAB } } }],
      }),
    },
  );
  if (!addResp.ok) {
    const text = await addResp.text();
    throw new Error(`Failed to create Applications tab (${addResp.status}): ${text.slice(0, 300)}`);
  }
  const headerResp = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${APPLICATIONS_TAB}!A1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [APPLICATION_HEADERS] }),
    },
  );
  if (!headerResp.ok) {
    const text = await headerResp.text();
    throw new Error(`Failed to write headers (${headerResp.status}): ${text.slice(0, 300)}`);
  }
}

/**
 * Append a guest-form submission to the Applications tab of the configured
 * podcast tracker spreadsheet for the given page. Resolves silently when
 * the page has no content-series block with `availabilitySheetId` set.
 */
export async function appendGuestApplicationToSheet(
  pageId: number,
  fields: Record<string, unknown>,
  pageSlug: string,
): Promise<void> {
  const rows = await db
    .select({ blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, pageId))
    .limit(1);
  if (!rows.length) return;
  const allowed = collectAllowedAvailability(rows[0].blocks);
  if (!allowed.size) return;
  // Use the first configured sheetId on the page (typically only one).
  const first = allowed.values().next().value as string;
  const [sheetId] = first.split("::");

  await ensureApplicationsTab(sheetId);

  const slots = pickSlots(typeof fields.preferred_slot === "string" ? fields.preferred_slot : undefined);
  const row: string[] = [
    new Date().toISOString(),
    slots.dates,
    slots.times,
    pickField(fields, "availability_comments"),
    pickField(fields, "first_name", "firstName", "first"),
    pickField(fields, "last_name", "lastName", "last"),
    pickField(fields, "email", "Email"),
    pickField(fields, "phone", "Phone"),
    pickField(fields, "company", "practice", "Company", "Practice"),
    pickField(fields, "role", "title", "Role", "Title"),
    pickField(fields, "story", "notes", "message", "tell_us", "Story", "Notes"),
    typeof fields._source === "string" ? fields._source : "content-series-guest",
    pageSlug,
    JSON.stringify(fields),
  ];

  const appendResp = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${APPLICATIONS_TAB}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    },
  );
  if (!appendResp.ok) {
    const text = await appendResp.text();
    throw new Error(`Append failed (${appendResp.status}): ${text.slice(0, 300)}`);
  }
}

export default router;
