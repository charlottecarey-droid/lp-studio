/**
 * Partner rooms: the customer's roster.
 *
 * One file answers three questions: which practices are in the rollout, who
 * the doctors are at each, and who the regional and office managers are. The
 * template is one row per doctor with the practice's details repeated on
 * each row, so a doctor is tied to a practice by being on its row. A practice
 * with no doctors listed yet is one row with the doctor columns blank.
 *
 * The template is prefilled from the practices we already hold (from
 * Salesforce), each with its Practice ID. When the file comes back, a row is
 * matched to a practice by that ID first, then by name. So a customer who
 * corrects a name, or fills in an address, still lands on the right practice.
 *
 * A workbook with two tabs (practices; doctors with a practice column) reads
 * the same way: every row of every tab is a practice, a doctor, or both.
 *
 * Pure functions; the routes do the reading and writing.
 */
import { practiceNameKey, rowsFromUpload } from "./partnerRoomReconcile";
import { splitAddress } from "./partnerRoomGeo";

export const ROSTER_COLUMNS = ["Practice ID", "Practice name", "Street address", "City", "State", "ZIP", "Phone", "Office type", "Regional manager", "Office manager", "Doctor name", "Doctor email", "Doctor NPI", "Doctor role"] as const;

type Field = "practiceId" | "practiceName" | "address" | "city" | "state" | "zip" | "phone" | "officeType" | "regionalManager" | "officeManager" | "doctorName" | "doctorEmail" | "npi" | "role";

/** Column names people actually use, mapped to the template's fields. */
const ALIASES: Record<Field, RegExp> = {
  practiceId: /^(practice id|location id|office id|account id|salesforce id|sfdc id|18 digit id|id)$/i,
  practiceName: /^(practice( name)?|location( name)?|office( name)?|account( name)?|clinic( name)?)$/i,
  address: /^(street( address)?|address( line)?( 1)?|billing street|shipping street|mailing address)$/i,
  city: /^(city|billing city|shipping city)$/i,
  state: /^(state|st|province|billing state(\/province)?|state\/province)$/i,
  zip: /^(zip( code)?|postal( code)?|postcode|billing zip(\/postal code)?)$/i,
  phone: /^(phone( number)?|office phone|practice phone|telephone)$/i,
  officeType: /^(office type|practice type|location type|type of (office|practice))$/i,
  regionalManager: /^(regional manager( name)?|regional|region manager|rm|rdo|regional director( of operations)?)$/i,
  officeManager: /^(office manager( name)?|practice manager( name)?|om|office contact)$/i,
  doctorName: /^(doctor( name)?|dr\.?( name)?|provider( name)?|dentist( name)?|clinician( name)?)$/i,
  doctorEmail: /^(doctor email|provider email|dentist email|email( address)?|e-mail)$/i,
  npi: /^(npi|doctor npi|provider npi|npi number)$/i,
  role: /^(doctor role|role|specialty|speciality|title|provider type)$/i,
};

export interface RosterRow {
  practiceId: string;
  practiceName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  officeType: string;
  regionalManager: string;
  officeManager: string;
  doctorName: string;
  doctorEmail: string;
  npi: string;
  role: string;
}

const clean = (v: unknown, max = 160) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Every roster row in an uploaded file. A sheet counts when it has a practice
 * column (name or ID); on it, each row gives a practice, a doctor, or both.
 * Null when no sheet has one (the file is not a roster).
 */
export function parseRoster(fileName: string, buf: Buffer): { rows: RosterRow[]; hasDoctors: boolean; columns: Field[] } | null {
  let sheets: { sheet: string; rows: string[][] }[];
  try {
    sheets = rowsFromUpload(fileName, buf);
  } catch {
    return null;
  }
  const out: RosterRow[] = [];
  const found = new Set<Field>();
  for (const { rows } of sheets) {
    // The header row: the first of the top 25 that names a practice column.
    const at = rows.slice(0, 25).findIndex((r) => r.some((c) => ALIASES.practiceName.test(c.trim()) || /^practice id$/i.test(c.trim())));
    if (at < 0) continue;
    const cols = new Map<Field, number>();
    rows[at].forEach((cell, i) => {
      const h = cell.trim();
      for (const f of Object.keys(ALIASES) as Field[]) {
        if (!cols.has(f) && ALIASES[f].test(h)) {
          cols.set(f, i);
          break;
        }
      }
    });
    // "Email" on a sheet with no doctor column is the practice's own address, not a doctor's.
    if (!cols.has("doctorName")) cols.delete("doctorEmail");
    for (const f of cols.keys()) found.add(f);
    for (const raw of rows.slice(at + 1, at + 20_001)) {
      const get = (f: Field) => (cols.has(f) ? clean(raw[cols.get(f)!]) : "");
      // An address on one line also gives the city, state and ZIP when they have no column of their own.
      const parts = splitAddress(get("address"));
      const row: RosterRow = { practiceId: get("practiceId"), practiceName: get("practiceName"), address: parts.zip ? parts.street : get("address"), city: get("city") || parts.city || "", state: get("state") || parts.state || "", zip: get("zip").slice(0, 12) || parts.zip || "", phone: get("phone").slice(0, 40), officeType: get("officeType").slice(0, 60), regionalManager: get("regionalManager"), officeManager: get("officeManager"), doctorName: get("doctorName"), doctorEmail: get("doctorEmail").toLowerCase(), npi: get("npi").replace(/\D/g, "").slice(0, 10), role: get("role") };
      if ((!row.practiceName && !row.practiceId && !row.doctorName) || /^example\b/i.test(row.practiceName)) continue;
      out.push(row);
    }
  }
  return found.size ? { rows: out, hasDoctors: found.has("doctorName"), columns: [...found] } : null;
}

export interface RosterPractice {
  id: number;
  externalId: string | null;
  name: string;
}

export interface RosterDoctor {
  practiceId: number | null;
  practiceName: string;
  name: string;
  email: string | null;
  npi: string | null;
  role: string | null;
}

export interface RosterPracticeUpdate {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  officeType?: string;
  regionalManager?: string;
  officeManager?: string;
}

export interface RosterResult {
  /** Distinct practices on the roster, and how many of them are practices we hold. */
  practices: number;
  matched: number;
  /** On the roster, not among the practices we hold (Salesforce is missing them, or they are spelled too differently to tell). */
  unmatched: string[];
  /** Ours that the roster does not list. */
  notOnRoster: string[];
  /** Matched by a close name rather than the ID or the exact name: worth a look. */
  likely: { roster: string; ours: string }[];
  doctors: number;
  /** Doctors whose practice could not be matched. */
  doctorsUnmatched: number;
  /** Things the customer should fix in the file. */
  issues: string[];
  enriched: number;
  /** Practices the roster named that we did not hold, and so were added (set when a roster is applied). */
  added?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sfid = (v: string) => (/^[a-zA-Z0-9]{15,18}$/.test(v) ? v.slice(0, 15) : "");

/**
 * Tie each roster row to a practice we hold and work out what to save: the
 * details to add to each practice, the doctors, and what did not line up.
 */
export function matchRoster(rows: RosterRow[], practices: RosterPractice[]): { updates: RosterPracticeUpdate[]; doctors: RosterDoctor[]; result: RosterResult } {
  const byId = new Map<string, RosterPractice>();
  const byKey = new Map<string, RosterPractice>();
  for (const p of practices) {
    byId.set(String(p.id), p);
    if (p.externalId) byId.set(sfid(p.externalId) || p.externalId, p);
    const k = practiceNameKey(p.name);
    if (k && !byKey.has(k)) byKey.set(k, p);
  }
  const likely = new Map<string, { roster: string; ours: string }>();
  const find = (row: RosterRow): RosterPractice | null => {
    const id = row.practiceId.trim();
    if (id) {
      const hit = byId.get(id) ?? byId.get(sfid(id));
      if (hit) return hit;
    }
    const key = practiceNameKey(row.practiceName);
    if (!key) return null;
    const exact = byKey.get(key);
    if (exact) return exact;
    // A close name: exactly one of ours contains it, or is contained by it ("Main Street Dental" / "Main Street Dental of Dallas").
    if (key.length >= 6) {
      const near = [...byKey.entries()].filter(([k]) => k.length >= 6 && (k.includes(key) || key.includes(k)));
      if (near.length === 1) {
        likely.set(key, { roster: row.practiceName, ours: near[0][1].name });
        return near[0][1];
      }
    }
    return null;
  };

  const updates = new Map<number, RosterPracticeUpdate>();
  const doctors: RosterDoctor[] = [];
  const seenPractice = new Map<string, RosterPractice | null>();
  const seenDoctor = new Set<string>();
  const unmatched = new Set<string>();
  const issues = new Set<string>();
  let doctorsUnmatched = 0;
  let noPractice = 0;
  let badEmails = 0;
  let duplicateDoctors = 0;
  let last: { name: string; hit: RosterPractice | null } | null = null;

  for (const row of rows) {
    // A doctor row with the practice left blank belongs to the practice above it (the way a merged cell reads once exported).
    const label = row.practiceName || row.practiceId;
    let hit: RosterPractice | null;
    let practiceName: string;
    if (label) {
      const cacheKey = `${row.practiceId}|${practiceNameKey(row.practiceName)}`;
      if (!seenPractice.has(cacheKey)) seenPractice.set(cacheKey, find(row));
      hit = seenPractice.get(cacheKey) ?? null;
      practiceName = row.practiceName || hit?.name || row.practiceId;
      last = { name: practiceName, hit };
      if (!hit) unmatched.add(practiceName);
    } else if (last) {
      hit = last.hit;
      practiceName = last.name;
    } else {
      hit = null;
      practiceName = "";
      if (row.doctorName) noPractice++;
    }
    if (hit) {
      const u = updates.get(hit.id) ?? { id: hit.id };
      for (const f of ["address", "city", "state", "zip", "phone", "officeType", "regionalManager", "officeManager"] as const) if (row[f] && !u[f]) u[f] = row[f];
      updates.set(hit.id, u);
    }
    if (!row.doctorName) continue;
    const dKey = `${hit?.id ?? practiceNameKey(practiceName)}|${row.npi || row.doctorEmail || row.doctorName.toLowerCase()}`;
    if (seenDoctor.has(dKey)) {
      duplicateDoctors++;
      continue;
    }
    seenDoctor.add(dKey);
    const emailOk = !row.doctorEmail || EMAIL_RE.test(row.doctorEmail);
    if (!emailOk) badEmails++;
    if (!hit) doctorsUnmatched++;
    doctors.push({ practiceId: hit?.id ?? null, practiceName, name: row.doctorName.slice(0, 120), email: emailOk && row.doctorEmail ? row.doctorEmail : null, npi: row.npi.length === 10 ? row.npi : null, role: row.role || null });
  }

  if (noPractice) issues.add(`${noPractice} doctor${noPractice === 1 ? " has" : "s have"} no practice on their row.`);
  if (badEmails) issues.add(`${badEmails} doctor email${badEmails === 1 ? " doesn't" : "s don't"} look like an address.`);
  if (duplicateDoctors) issues.add(`${duplicateDoctors} doctor${duplicateDoctors === 1 ? " is" : "s are"} listed twice at the same practice.`);

  const matchedIds = new Set([...seenPractice.values()].filter((p): p is RosterPractice => !!p).map((p) => p.id));
  const enriched = [...updates.values()].filter((u) => Object.keys(u).length > 1).length;
  return {
    updates: [...updates.values()].filter((u) => Object.keys(u).length > 1),
    doctors,
    result: {
      practices: matchedIds.size + unmatched.size,
      matched: matchedIds.size,
      unmatched: [...unmatched].slice(0, 500),
      notOnRoster: practices.filter((p) => !matchedIds.has(p.id)).map((p) => p.name).slice(0, 500),
      likely: [...likely.values()].slice(0, 200),
      doctors: doctors.length,
      doctorsUnmatched,
      issues: [...issues],
      enriched,
    },
  };
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) || /^[=+\-@\t]/.test(v) ? `"${(/^[=+\-@\t]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"` : v);

/**
 * The roster template for a room, as CSV: the column names, then one row per
 * practice we hold with what we know filled in and the doctor columns blank.
 * The customer adds a row per doctor (copying the practice's row), corrects
 * anything wrong, and adds practices we are missing at the bottom.
 */
export function rosterTemplateCsv(practices: { id: number; externalId: string | null; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; phone?: string | null; officeType?: string | null; regionalManager: string | null; officeManager: string | null }[]): string {
  const lines = [ROSTER_COLUMNS.join(",")];
  for (const p of practices) {
    lines.push([p.externalId || String(p.id), p.name, p.address ?? "", p.city ?? "", p.state ?? "", p.zip ?? "", p.phone ?? "", p.officeType ?? "", p.regionalManager ?? "", p.officeManager ?? "", "", "", "", ""].map(csvCell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
