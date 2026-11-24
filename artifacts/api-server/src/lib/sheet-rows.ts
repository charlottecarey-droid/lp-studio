/**
 * Place a lead's fields under the right sheet columns BY HEADER NAME.
 *
 * The sheet writer used to append `Object.keys(fields)` positionally under
 * whatever header the first-ever row wrote. Two forms (or one form whose
 * optional fields vary, e.g. the gift form's Size, which only swag pages
 * ask) sharing a tab then shifted values under the wrong columns. Here a
 * field with no column yet gets one appended to the header, and every row is
 * laid out against the header as it stands.
 */
export const FIXED_LEAD_COLUMNS = ["Timestamp", "Page", "Slug", "Variant"] as const;

export function alignLeadRow(
  existingHeader: string[] | null,
  fixed: [string, string, string, string],
  fields: Record<string, unknown>,
): { header: string[]; row: string[]; headerChanged: boolean } {
  const fieldKeys = Object.keys(fields).filter((k) => !k.startsWith("_"));
  const header = existingHeader && existingHeader.length ? [...existingHeader] : [...FIXED_LEAD_COLUMNS];
  const before = header.length;
  for (const k of fieldKeys) if (!header.includes(k)) header.push(k);
  const byName: Record<string, string> = {};
  FIXED_LEAD_COLUMNS.forEach((c, i) => { byName[c] = fixed[i]; });
  for (const k of fieldKeys) byName[k] = String(fields[k] ?? "");
  const row = header.map((h) => byName[h] ?? "");
  return { header, row, headerChanged: !existingHeader || !existingHeader.length || header.length !== before };
}
