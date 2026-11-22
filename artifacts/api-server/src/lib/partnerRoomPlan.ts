/**
 * A Partner Hub's mutual action plan (MAP), edited from the hub's Settings:
 * read it, save it, and bring one in from a spreadsheet.
 *
 * The plan is the room block's `planGroups` (what the hub's Action plan tab
 * shows; in expansion the rollout plan is kept apart in `rolloutPlanGroups`
 * and isn't touched here). Phases hold steps; a step's `key` ties it to the
 * customer's saved ticks and uploads, so a step that keeps its name keeps its
 * key through edits and imports.
 *
 * Spreadsheet format (the template, and "Download this plan"): one row per
 * step, columns Phase, Checkpoint, Step, Target date, Our owner, Customer
 * owner, Status, Customer can, Note. Phase may be left blank to continue the
 * phase above. Imports accept CSV or .xlsx and the usual other names for each
 * column ("Task", "Milestone", "Due", "Dandy owner", "DSO owner"…).
 */
import { csvCell } from "./partnerRoomRoster";
import { planTaskKey } from "./partnerRoom";

export type PlanStatus = "done" | "on-track" | "pending" | "blocking" | "not-started";
export interface PlanRow {
  key?: string;
  task: string;
  target?: string;
  ourOwner?: string;
  partnerOwner?: string;
  status?: PlanStatus;
  customerAction?: "check" | "upload";
  uploadLabel?: string;
  note?: string;
  hidden?: boolean;
  retired?: boolean;
}
export interface PlanGroup {
  title: string;
  checkpoint?: string;
  hidden?: boolean;
  rows: PlanRow[];
}

const MAX_GROUPS = 30;
const MAX_ROWS = 150;
const STATUSES: PlanStatus[] = ["done", "on-track", "pending", "blocking", "not-started"];

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+$/g, "").slice(0, max) : "");

/** A plan as sent by the hub's Settings, cleaned: known fields, sizes capped, empty steps dropped. */
export function cleanPlanGroups(raw: unknown): PlanGroup[] {
  const groups = Array.isArray(raw) ? raw : [];
  return groups.slice(0, MAX_GROUPS).flatMap((g): PlanGroup[] => {
    if (!g || typeof g !== "object") return [];
    const gg = g as Record<string, unknown>;
    const rows = (Array.isArray(gg.rows) ? gg.rows : []).slice(0, MAX_ROWS).flatMap((r): PlanRow[] => {
      if (!r || typeof r !== "object") return [];
      const rr = r as Record<string, unknown>;
      const task = str(rr.task, 300).trim();
      if (!task) return [];
      const status = STATUSES.includes(rr.status as PlanStatus) ? (rr.status as PlanStatus) : "not-started";
      const action = rr.customerAction === "check" || rr.customerAction === "upload" ? rr.customerAction : undefined;
      const out: PlanRow = { task, status };
      const key = str(rr.key, 80).trim();
      if (key) out.key = key;
      for (const f of ["target", "ourOwner", "partnerOwner", "note", "uploadLabel"] as const) {
        const v = str(rr[f], f === "note" ? 1000 : 160).trim();
        if (v) out[f] = v;
      }
      if (action) out.customerAction = action;
      if (rr.hidden === true) out.hidden = true;
      if (rr.retired === true) out.retired = true;
      return [out];
    });
    const title = str(gg.title, 160).trim() || "Action plan";
    const checkpoint = str(gg.checkpoint, 400).trim();
    return [{ title, ...(checkpoint ? { checkpoint } : {}), ...(gg.hidden === true ? { hidden: true } : {}), rows }];
  });
}

const roomBlock = (blocks: unknown): { props?: Record<string, unknown> } | null =>
  (Array.isArray(blocks) ? blocks : []).find((b) => (b as { type?: string })?.type === "room-workspace") as { props?: Record<string, unknown> } | null;

/** The hub's plan as stored. Null when the page isn't a Partner Hub. */
export function roomPlanInfo(blocks: unknown): { groups: PlanGroup[]; expansion: boolean } | null {
  const props = roomBlock(blocks)?.props;
  if (!props) return null;
  return { groups: cleanPlanGroups(props.planGroups), expansion: props.stage === "expansion" };
}

/** Replace the hub's plan. New blocks, or null when the page isn't a Partner Hub. Nothing else on the page changes. */
export function setRoomPlan(blocks: unknown, groups: PlanGroup[]): unknown[] | null {
  const block = roomBlock(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  return blocks.map((b) => (b === block ? { ...(b as object), props: { ...(block.props ?? {}), planGroups: groups } } : b));
}

/* ── Spreadsheet ─────────────────────────────────────────────────────────── */

export const PLAN_COLUMNS = ["Phase", "Checkpoint", "Step", "Target date", "Our owner", "Customer owner", "Status", "Customer can", "Note"] as const;

const STATUS_WORD: Record<PlanStatus, string> = { "not-started": "Not started", "on-track": "On track", pending: "Pending", blocking: "Overdue", done: "Done" };
const ACTION_WORD = { none: "View only", check: "Mark complete", upload: "Upload a file" } as const;

/** What the template's columns accept, for the guide shown beside the download. */
export const PLAN_COLUMN_GUIDE: { column: (typeof PLAN_COLUMNS)[number]; required?: boolean; accepts: string }[] = [
  { column: "Phase", accepts: "The phase the step belongs to. Leave blank to continue the phase above." },
  { column: "Checkpoint", accepts: "What done looks like for the phase (one per phase is enough)." },
  { column: "Step", required: true, accepts: "The step itself. Rows without one are skipped." },
  { column: "Target date", accepts: "A date (2026-12-15 or 12/15/2026) or words (Week 2, By kickoff)." },
  { column: "Our owner", accepts: "Who on your team owns it." },
  { column: "Customer owner", accepts: "Who on the customer's side owns it." },
  { column: "Status", accepts: "Not started, On track, Pending, Overdue or Done. Blank = Not started." },
  { column: "Customer can", accepts: "View only, Mark complete or Upload a file. Blank = View only." },
  { column: "Note", accepts: "Anything else the customer should know." },
];

const EXAMPLE: PlanGroup[] = [
  {
    title: "Days 0–15 · Get set up",
    checkpoint: "Practice list in · kickoff held",
    rows: [
      { task: "Upload your practice list", target: "Week 1", ourOwner: "Account manager", partnerOwner: "Operations lead", status: "not-started", customerAction: "upload", note: "Practice names, addresses and an office contact" },
      { task: "Join the executive kickoff", target: "Week 2", ourOwner: "Account executive", partnerOwner: "Executive sponsor", status: "not-started", customerAction: "check" },
    ],
  },
  {
    title: "Days 15–30 · Launch",
    rows: [
      { task: "Send the partnership announcement", target: "Week 3", ourOwner: "Partner marketing", partnerOwner: "Communications", status: "not-started", customerAction: "check" },
      { task: "Confirm the first practices and training dates", target: "Week 4", ourOwner: "Implementation", partnerOwner: "Operations lead", status: "not-started" },
    ],
  },
];

/** The plan as a spreadsheet (CSV): the template's example steps, or a hub's own plan to edit and bring back in. */
export function planCsv(groups: PlanGroup[] | null): string {
  const lines = [PLAN_COLUMNS.join(",")];
  for (const g of groups && groups.length ? groups : EXAMPLE) {
    g.rows.forEach((r, i) => {
      lines.push(
        [
          g.title,
          i === 0 ? g.checkpoint ?? "" : "",
          r.task,
          r.target ?? "",
          r.ourOwner ?? "",
          r.partnerOwner ?? "",
          STATUS_WORD[r.status ?? "not-started"],
          ACTION_WORD[r.customerAction ?? "none"],
          r.note ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    });
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Parse CSV text into rows, quoted cells (with commas and line breaks) included. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  // Tab- or comma-separated: whichever appears more in the first few lines (a title row's stray comma doesn't decide it).
  const head = s.split(/\r?\n/).slice(0, 6).join("\n");
  const delim = (head.match(/\t/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? "\t" : ",";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
}

const HEADER_ALIASES: Record<(typeof PLAN_COLUMNS)[number], RegExp> = {
  Phase: /^(phase|stage|group|section|workstream|period)$/,
  Checkpoint: /^(checkpoint|done looks like|exit criteria|milestone gate)$/,
  Step: /^(step|task|milestone|action|item|activity|deliverable|what)$/,
  "Target date": /^(target( date)?|due( date)?|date|deadline|when|timing)$/,
  "Our owner": /^(our owner|dandy owner|owner \(?(dandy|us|ours)\)?|account team owner|vendor owner|our side|owner)$/,
  "Customer owner": /^(customer owner|their owner|partner owner|dso owner|client owner|owner \(?(customer|partner|dso|them|client)\)?|customer side)$/,
  Status: /^(status|state|progress)$/,
  "Customer can": /^(customer can|customer action|action type|customer)$/,
  Note: /^(notes?|comments?|details?|description)$/,
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9()]+/g, " ").replace(/\s+/g, " ").trim();

function statusFrom(word: string): PlanStatus | null {
  const w = norm(word);
  if (!w) return "not-started";
  if (/^(done|complete|completed|finished|closed|yes)$/.test(w)) return "done";
  if (/^(on track|in progress|started|underway|active|ongoing)$/.test(w)) return "on-track";
  if (/^(pending|waiting|at risk|on hold|scheduled)$/.test(w)) return "pending";
  if (/^(overdue|blocking|blocked|late|behind|off track)$/.test(w)) return "blocking";
  if (/^(not started|to do|todo|open|new|planned|no)$/.test(w)) return "not-started";
  return null;
}

function actionFrom(word: string): "check" | "upload" | undefined | null {
  const w = norm(word);
  if (!w || /^(view( only)?|none|read( only)?|no)$/.test(w)) return undefined;
  if (/(upload|file|attach)/.test(w)) return "upload";
  if (/(complete|check|tick|confirm|mark|done)/.test(w)) return "check";
  return null;
}

/** A target as text: a recognisable date becomes YYYY-MM-DD (Excel's day numbers too); anything else is kept as typed. */
export function targetFrom(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : "";
  };
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (us) return iso(us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]), Number(us[1]), Number(us[2])) || v;
  // Excel stores dates as days since 1899-12-30; a plain number in the date range is one of those.
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const n = Math.floor(Number(v));
    if (n > 36000 && n < 60000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
  }
  return v.slice(0, 160);
}

/** Read a MAP spreadsheet's rows (header first). Problems come back as plain sentences; rows that can't be used are skipped. */
export function parsePlanRows(rows: string[][]): { groups: PlanGroup[]; steps: number; warnings: string[]; error?: string } {
  // The header is the first row that names a Step column (a title row above it is fine).
  const at = rows.findIndex((r) => r.some((c) => HEADER_ALIASES.Step.test(norm(c))));
  if (at < 0) return { groups: [], steps: 0, warnings: [], error: "No Step column found. Use the template, or name the column with the steps “Step”." };
  const header = rows[at].map(norm);
  const col = Object.fromEntries(PLAN_COLUMNS.map((c) => [c, header.findIndex((h) => HEADER_ALIASES[c].test(h))])) as Record<(typeof PLAN_COLUMNS)[number], number>;
  // "Owner" alone (no side named) is ours; a second bare "Owner" is the customer's.
  if (col["Customer owner"] < 0) {
    const owners = header.map((h, i) => (h === "owner" ? i : -1)).filter((i) => i >= 0);
    if (owners.length > 1) col["Customer owner"] = owners[1];
  }
  const cell = (r: string[], c: (typeof PLAN_COLUMNS)[number]) => (col[c] >= 0 ? (r[col[c]] ?? "").trim() : "");
  const groups: PlanGroup[] = [];
  const warnings: string[] = [];
  let steps = 0;
  let phase = "";
  rows.slice(at + 1).forEach((r, i) => {
    const line = at + i + 2;
    const task = cell(r, "Step");
    const phaseCell = cell(r, "Phase");
    if (phaseCell) phase = phaseCell;
    if (!task) {
      if (r.some((c) => c.trim())) warnings.push(`Row ${line}: no step, skipped.`);
      return;
    }
    const title = (phase || "Action plan").slice(0, 160);
    let g = groups.find((x) => x.title.toLowerCase() === title.toLowerCase());
    if (!g) {
      if (groups.length >= MAX_GROUPS) {
        warnings.push(`Row ${line}: more than ${MAX_GROUPS} phases, skipped.`);
        return;
      }
      g = { title, rows: [] };
      groups.push(g);
    }
    const checkpoint = cell(r, "Checkpoint");
    if (checkpoint && !g.checkpoint) g.checkpoint = checkpoint.slice(0, 400);
    if (g.rows.length >= MAX_ROWS) {
      warnings.push(`Row ${line}: more than ${MAX_ROWS} steps in “${title}”, skipped.`);
      return;
    }
    const statusWord = cell(r, "Status");
    const status = statusFrom(statusWord);
    if (status === null) warnings.push(`Row ${line}: status “${statusWord}” not recognised, set to Not started.`);
    const actionWord = cell(r, "Customer can");
    const action = actionFrom(actionWord);
    if (action === null) warnings.push(`Row ${line}: “${actionWord}” under Customer can not recognised, set to View only.`);
    const row: PlanRow = { task: task.slice(0, 300), status: status ?? "not-started" };
    const target = targetFrom(cell(r, "Target date"));
    if (target) row.target = target;
    const ours = cell(r, "Our owner");
    if (ours) row.ourOwner = ours.slice(0, 160);
    const theirs = cell(r, "Customer owner");
    if (theirs) row.partnerOwner = theirs.slice(0, 160);
    if (action) row.customerAction = action;
    const note = cell(r, "Note");
    if (note) row.note = note.slice(0, 1000);
    g.rows.push(row);
    steps += 1;
  });
  if (steps === 0) return { groups: [], steps: 0, warnings, error: "No steps found under the Step column." };
  return { groups, steps, warnings };
}

/**
 * Bring imported steps into the hub's plan. "replace": the plan becomes the import; "add": the import's
 * steps join the phase of the same name (or a new phase at the end). Either way a step whose name matches
 * one already on the plan keeps that step's key, so the customer's ticks and uploads stay with it; every
 * other step gets a key that is unique on the plan.
 */
export function mergeImportedPlan(current: PlanGroup[], imported: PlanGroup[], mode: "replace" | "add"): PlanGroup[] {
  const existingKeys = new Map<string, string>();
  for (const g of current) for (const r of g.rows) existingKeys.set(r.task.trim().toLowerCase(), r.key || planTaskKey(r));
  const used = new Set<string>();
  const base: PlanGroup[] = mode === "add" ? current.map((g) => ({ ...g, rows: [...g.rows] })) : [];
  if (mode === "add") for (const g of base) for (const r of g.rows) used.add(r.key || planTaskKey(r));
  const keyFor = (task: string) => {
    const kept = existingKeys.get(task.trim().toLowerCase());
    if (kept && !used.has(kept)) {
      used.add(kept);
      return kept;
    }
    const stem = planTaskKey({ task }) || "step";
    let key = stem;
    for (let n = 2; used.has(key); n++) key = `${stem}-${n}`.slice(0, 80);
    used.add(key);
    return key;
  };
  for (const g of imported) {
    let target = base.find((x) => x.title.toLowerCase() === g.title.toLowerCase());
    if (!target) {
      target = { title: g.title, ...(g.checkpoint ? { checkpoint: g.checkpoint } : {}), rows: [] };
      base.push(target);
    } else if (g.checkpoint && !target.checkpoint) target.checkpoint = g.checkpoint;
    for (const r of g.rows) {
      if (mode === "add" && target.rows.some((x) => x.task.trim().toLowerCase() === r.task.trim().toLowerCase())) continue;
      target.rows.push({ ...r, key: keyFor(r.task) });
    }
  }
  return base;
}
