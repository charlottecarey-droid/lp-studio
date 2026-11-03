/**
 * Small RFC 4180 CSV reader for spreadsheet uploads (Programmatic Pages).
 *
 * Handles what Google Sheets / Excel actually export: quoted fields with
 * commas, line breaks and doubled quotes ("He said ""hi"""), CRLF or LF line
 * endings, a UTF-8 BOM, and a trailing newline. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** "First Name" / "first-name" / " FIRST_NAME " → "first_name". */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/** URL-safe slug: lowercase ascii words joined by hyphens. */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface BulkCsvRow {
  slug: string;
  variables: Record<string, string>;
  /** True when the slug was built from the person's name / company. */
  autoSlug: boolean;
}

/**
 * Rows for bulk page generation. A `slug` column is optional: when it is
 * missing or blank, the slug is built from first_name + last_name + company
 * (e.g. "gilberto-ruiz-apex-dental"), made unique within the file.
 */
export function parseBulkCsv(text: string): BulkCsvRow[] {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("The CSV needs a header row and at least one data row.");
  const headers = table[0].map(normalizeHeader);
  const hasSlug = headers.includes("slug");
  const canDerive = headers.includes("first_name") || headers.includes("name") || headers.includes("company");
  if (!hasSlug && !canDerive) throw new Error("The CSV needs a 'slug' column, or first_name / company columns to build one from.");
  const used = new Set<string>();
  const out: BulkCsvRow[] = [];
  for (const cells of table.slice(1)) {
    const variables: Record<string, string> = {};
    let slug = "";
    headers.forEach((h, i) => {
      if (!h) return;
      const v = (cells[i] ?? "").trim();
      if (h === "slug") slug = v;
      else variables[h] = v;
    });
    let autoSlug = false;
    if (!slug) {
      slug = [variables.first_name || variables.name, variables.last_name, variables.company].filter(Boolean).join(" ");
      autoSlug = true;
    }
    let base = slugify(slug);
    if (!base) continue;
    let candidate = base;
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`;
    base = candidate;
    used.add(base);
    out.push({ slug: base, variables, autoSlug });
  }
  return out;
}

/** Quote one value for CSV output. */
export function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
