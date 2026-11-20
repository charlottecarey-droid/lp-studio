/**
 * Welcome kits: the row a practice adds to the marketing team's recipient
 * sheet (the one their direct-mail workflow reads), and which practices can
 * be sent one. Pure: the sheet and the database are in partnerRoomKitService.
 *
 * The column names are the marketing template's own ("Expansion workflow -
 * Welcome Kit, Video Mailer, Magalog Recipients"), minus its blank column and
 * its second first-name column, plus "Date added". Rows are placed by column
 * NAME, so a tab that still has the old layout (or columns in another order)
 * is filled correctly too.
 */

export const KIT_DATE_HEADER = "Date added";

export const KIT_HEADERS = ["Practice BDR", "Parent Account", "NameFirst", "NameLast", "CompanyName", "AddressLine1", "AddressLine2", "City", "Province", "PostalCode", "CountryCode", "Email", "Phone", "VERSION", "Parent Account ID", "Contact18", "Account18", "Welcome kit delivery", "Video Mailer delivery", "Magalog delivery", KIT_DATE_HEADER] as const;

/** A welcome kit is addressed to the office, not a person. */
export const KIT_NAME_FIRST = "Doctor";
export const KIT_NAME_LAST = "and Staff";

export interface KitPractice {
  id: number;
  externalId: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  owner: string | null;
  kitSentAt: Date | null;
}

export interface KitContext {
  /** The customer (the parent account) and its Salesforce id. */
  parentAccount: string;
  parentAccountId: string | null;
  /** YYYY-MM-DD. */
  date: string;
}

const key = (h: unknown) => String(h ?? "").trim().toLowerCase();

/** What one practice puts under each column name. */
export function kitValues(p: KitPractice, ctx: KitContext): Record<string, string> {
  const id = p.externalId ?? "";
  return {
    "practice bdr": p.owner ?? "",
    "parent account": ctx.parentAccount,
    namefirst: KIT_NAME_FIRST,
    namelast: KIT_NAME_LAST,
    // The template's second first-name column, for a tab that still has it.
    firstname: KIT_NAME_FIRST,
    companyname: p.name,
    addressline1: p.address ?? "",
    addressline2: "",
    city: p.city ?? "",
    province: p.state ?? "",
    postalcode: p.zip ?? "",
    countrycode: "US",
    email: "",
    phone: p.phone ?? "",
    // In the template VERSION carries the practice's account id, the same as Account18.
    version: id,
    "parent account id": ctx.parentAccountId ?? "",
    contact18: "",
    account18: id,
    [key(KIT_DATE_HEADER)]: ctx.date,
  };
}

/** A value can't run as a formula in the sheet (rows are also written RAW). */
const plain = (v: string) => (/^[=+\-@\t]/.test(v) ? `'${v}` : v);

/**
 * Rows for the tab as it is: each value under the column with its name, blank
 * under a column we have nothing for. Returns the column names to use, which
 * gain "Date added" at the end when the tab has none (`headersChanged`).
 */
export function kitRows(existingHeaders: unknown[] | null, practices: KitPractice[], ctx: KitContext): { headers: string[]; headersChanged: boolean; rows: string[][] } {
  const had = (existingHeaders ?? []).map((h) => String(h ?? ""));
  // An empty tab (or a new one) gets the standard columns.
  const blank = had.every((h) => !h.trim());
  let headers = blank ? [...KIT_HEADERS] : had;
  let headersChanged = blank;
  if (!headers.some((h) => key(h) === key(KIT_DATE_HEADER))) {
    headers = [...headers, KIT_DATE_HEADER];
    headersChanged = true;
  }
  const rows = practices.map((p) => {
    const v = kitValues(p, ctx);
    return headers.map((h) => plain(v[key(h)] ?? ""));
  });
  return { headers, headersChanged, rows };
}

export interface KitPlan {
  /** Ready to send. */
  send: KitPractice[];
  /** Already on the list: never sent twice. */
  already: KitPractice[];
  /** No full mailing address (street, city, state, ZIP). */
  noAddress: KitPractice[];
}

/** Sort the ticked practices into what can be mailed and what can't. */
export function planKits(practices: KitPractice[]): KitPlan {
  const plan: KitPlan = { send: [], already: [], noAddress: [] };
  for (const p of practices) {
    if (p.kitSentAt) plan.already.push(p);
    else if (!(p.address ?? "").trim() || !(p.city ?? "").trim() || !(p.state ?? "").trim() || !/^\d{5}/.test((p.zip ?? "").trim())) plan.noAddress.push(p);
    else plan.send.push(p);
  }
  return plan;
}

export const DEFAULT_KIT_TAB = "Send Welcome Kits";

/** What marketing is told when practices are added. */
export function kitNotice(customer: string, names: string[], by: string, sheetUrl: string): { title: string; lines: string[] } {
  const n = names.length;
  const shown = names.slice(0, 25);
  return {
    title: `${n} ${n === 1 ? "practice" : "practices"} added to the welcome kit list`,
    lines: [`${by} added ${n} ${customer} ${n === 1 ? "practice" : "practices"} to the welcome kit list.`, ...shown.map((name) => `• ${name}`), ...(n > shown.length ? [`…and ${n - shown.length} more`] : []), `List: ${sheetUrl}`],
  };
}
