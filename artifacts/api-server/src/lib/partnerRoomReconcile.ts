/**
 * Partner rooms — compare the customer's uploaded practice list with the
 * practices we hold for the room (from a Salesforce report, a paste or a
 * sync), so the team can see what Salesforce is missing. Pure functions.
 */
import { readXlsx } from "./xlsxLite";

/** "Main Street Dental, P.C." and "main street dental pc" are the same practice. */
export function practiceNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(llc|inc|pc|pllc|pa|dds|dmd|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PRACTICE_HEADER = /^(practice( name)?|location( name)?|office( name)?|account( name)?)$/i;
const DOCTOR_HEADER = /^(doctor( name)?|dr\.?( name)?|provider( name)?|dentist( name)?|clinician( name)?)$/i;
const GENERIC_NAME_HEADER = /^(name|full name)$/i;

/** Find the header row and the column whose header matches; returns that column's values below it. */
export function columnValues(rows: string[][], header: RegExp): { values: string[]; header: string } | null {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const c = rows[r].findIndex((cell) => header.test(cell.trim()));
    if (c < 0) continue;
    const values = rows
      .slice(r + 1)
      .map((row) => (row[c] ?? "").trim())
      .filter((v) => v && !/^example\b/i.test(v));
    return { values, header: rows[r][c].trim() };
  }
  return null;
}

/** Rows from an uploaded roster: .xlsx (every sheet, the most likely one first), or CSV / tab-separated text. */
export function rowsFromUpload(fileName: string, buf: Buffer): { sheet: string; rows: string[][] }[] {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (ext === "xlsx") {
    const sheets = readXlsx(buf).map((s) => ({ sheet: s.name, rows: s.rows }));
    return sheets.sort((a, b) => Number(/practice|location|roster|doctor/i.test(b.sheet)) - Number(/practice|location|roster|doctor/i.test(a.sheet)));
  }
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    const text = buf.toString("utf8").replace(/^\uFEFF/, "");
    const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((line) => {
      const out: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === "," || ch === "\t") { out.push(cur.trim()); cur = ""; } else cur += ch;
      }
      out.push(cur.trim());
      return out;
    });
    return [{ sheet: fileName, rows }];
  }
  throw new Error("unsupported");
}

/**
 * A named column in an upload. A specific header ("Practice name") wins on any
 * sheet, even when the sheet has no rows yet; a bare "Name" column only counts
 * on a single-sheet file or a sheet whose own name says what it lists.
 */
function findColumn(fileName: string, buf: Buffer, specific: RegExp, sheetHint: RegExp): { values: string[]; sheet: string; header: string } | null {
  const sheets = rowsFromUpload(fileName, buf);
  for (const { sheet, rows } of sheets) {
    const col = columnValues(rows, specific);
    if (col) return { ...col, sheet };
  }
  for (const { sheet, rows } of sheets) {
    if (sheets.length > 1 && !sheetHint.test(sheet)) continue;
    const col = columnValues(rows, GENERIC_NAME_HEADER);
    if (col) return { ...col, sheet };
  }
  return null;
}

/** The practice names in an uploaded list, or null when no sheet has a recognisable column. */
export function practiceNamesFromUpload(fileName: string, buf: Buffer): { names: string[]; sheet: string; header: string } | null {
  const col = findColumn(fileName, buf, PRACTICE_HEADER, /practice|location|office/i);
  return col ? { names: col.values, sheet: col.sheet, header: col.header } : null;
}

/** How many doctors an uploaded roster lists (rows under a doctor column). */
export function doctorCountFromUpload(fileName: string, buf: Buffer): { count: number; sheet: string } | null {
  const col = findColumn(fileName, buf, DOCTOR_HEADER, /doctor|provider|dentist|clinician/i);
  return col ? { count: col.values.length, sheet: col.sheet } : null;
}

export interface Reconciliation {
  uploaded: number;
  inRoom: number;
  matched: number;
  /** On the customer's list, not in what we hold: Salesforce is missing these. */
  missingFromRoom: string[];
  /** In what we hold, not on the customer's list: closed, renamed, or not part of the rollout. */
  notOnUpload: string[];
}

export function reconcilePractices(uploadedNames: string[], roomNames: string[]): Reconciliation {
  const room = new Map(roomNames.map((n) => [practiceNameKey(n), n]));
  const seen = new Set<string>();
  const missingFromRoom: string[] = [];
  let matched = 0;
  let uploaded = 0;
  for (const name of uploadedNames) {
    const key = practiceNameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uploaded++;
    if (room.has(key)) matched++;
    else missingFromRoom.push(name);
  }
  const notOnUpload = [...room.entries()].filter(([key]) => key && !seen.has(key)).map(([, name]) => name);
  return { uploaded, inRoom: room.size, matched, missingFromRoom, notOnUpload };
}
