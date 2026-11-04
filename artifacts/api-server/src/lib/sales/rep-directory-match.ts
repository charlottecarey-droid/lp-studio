/**
 * Rep directory for bulk-generated pages (Programmatic Pages).
 *
 * A spreadsheet row only needs the rep's work email (`rep_email`); the rest
 * of the rep's details come from the Sales Reps library (Content Library
 * `team_member` records) so reps never retype their name, role, headshot or
 * booking link. Pure functions — the query lives in `rep-directory.ts`.
 *
 * Library quirks handled here:
 *   - duplicate records per rep (one with the link, another with the photo)
 *     are merged by email, first non-empty value of each field wins;
 *   - booking links live in `chilipiperUrl` or, on older records,
 *     `calendlyUrl`;
 *   - stray whitespace / casing in stored emails.
 */
export interface RepProfile {
  name: string;
  firstName: string;
  title: string;
  email: string;
  phone: string;
  photo: string;
  calendar: string;
}

export type RepDirectory = Map<string, RepProfile>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function buildRepDirectory(contents: Array<Record<string, unknown>>): RepDirectory {
  const dir: RepDirectory = new Map();
  for (const c of contents) {
    const email = str(c.email).toLowerCase();
    if (!email) continue;
    const next: RepProfile = {
      name: str(c.name),
      firstName: str(c.name).split(/\s+/)[0] ?? "",
      title: str(c.role),
      email,
      phone: str(c.phone),
      photo: str(c.photo),
      calendar: str(c.chilipiperUrl) || str(c.calendlyUrl),
    };
    const prev = dir.get(email);
    if (!prev) { dir.set(email, next); continue; }
    const merged = { ...prev };
    for (const k of Object.keys(next) as Array<keyof RepProfile>) {
      if (!merged[k] && next[k]) merged[k] = next[k];
    }
    dir.set(email, merged);
  }
  return dir;
}

/** Variable names the gift templates read. */
export const REP_VARIABLES = ["rep_name", "rep_first_name", "rep_title", "rep_photo", "rep_calendar", "rep_phone"] as const;

/**
 * Fill a row's rep_* variables from its `rep_email`. Values the row already
 * has win (a sheet can override e.g. rep_title). Returns whether the email
 * matched a library record.
 */
export function fillRepVariables(variables: Record<string, string>, dir: RepDirectory): { vars: Record<string, string>; matched: boolean | null } {
  const email = str(variables.rep_email).toLowerCase();
  if (!email) return { vars: variables, matched: null };
  const rep = dir.get(email);
  if (!rep) return { vars: variables, matched: false };
  const fromLibrary: Record<string, string> = {
    rep_name: rep.name,
    rep_first_name: rep.firstName,
    rep_title: rep.title,
    rep_photo: rep.photo,
    rep_calendar: rep.calendar,
    rep_phone: rep.phone,
  };
  const vars = { ...variables };
  for (const [k, v] of Object.entries(fromLibrary)) {
    if (!str(vars[k]) && v) vars[k] = v;
  }
  return { vars, matched: true };
}

/**
 * The rep a submission names, if any: a field labelled "Rep email" (any
 * casing/spacing; "Sales rep email" and "rep_email" count too). Pages
 * created from a gift template carry the rep's email in such a field so
 * the rep can be notified about their own prospect's submission.
 */
export function findRepEmailField(fields: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string" || !v.includes("@")) continue;
    const key = k.toLowerCase().replace(/[^a-z]/g, "");
    if (key === "repemail" || key === "salesrepemail" || key === "accountowneremail" || key === "owneremail") return v.trim().toLowerCase();
  }
  return "";
}

/**
 * The address to notify for a submission's rep: the "Rep email" field, but
 * only when it names someone in the tenant's Sales Reps library. A public
 * form post can carry any field, so without this allowlist a stranger could
 * make the server mail lead notifications to arbitrary addresses.
 */
export function resolveRepRecipient(fields: Record<string, unknown>, dir: RepDirectory): string | null {
  const email = findRepEmailField(fields);
  if (!email) return null;
  return dir.has(email) ? email : null;
}
