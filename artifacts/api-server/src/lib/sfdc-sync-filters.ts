import { z } from "zod";
import type { SfdcSyncFilters } from "@workspace/db";

/**
 * Salesforce inbound sync filters (Task #1356).
 *
 * These values come from a tenant via the settings UI and are interpolated into
 * a SOQL WHERE clause, so every value MUST be validated and escaped here before
 * it reaches Salesforce. The strategy is defence-in-depth:
 *   1. `SyncFiltersSchema` validates the persisted shape (bounded arrays, typed
 *      year windows, an enum for opportunity status, strict objects).
 *   2. The WHERE builders escape every string value (single-quote + backslash)
 *      and strip control characters, and only ever emit allow-listed field
 *      names — user input never becomes a SOQL identifier or operator.
 *
 * An empty/omitted filter means "sync everything" (the original behaviour), so
 * every builder returns "" when it has nothing to constrain.
 */

const MAX_VALUES_PER_FIELD = 50;
const MAX_VALUE_LENGTH = 255;
const MAX_YEARS = 50;

const stringList = z
  .array(z.string().trim().min(1).max(MAX_VALUE_LENGTH))
  .max(MAX_VALUES_PER_FIELD)
  .optional();

const yearsWindow = z.number().int().min(1).max(MAX_YEARS).optional();

/**
 * Zod validator for the persisted filter shape. `.strict()` rejects unknown
 * keys so a malformed/forged payload can't smuggle extra fields through.
 */
export const SyncFiltersSchema = z
  .object({
    accounts: z
      .object({ types: stringList, industries: stringList, owners: stringList })
      .strict()
      .optional(),
    contacts: z
      .object({ createdWithinYears: yearsWindow })
      .strict()
      .optional(),
    leads: z
      .object({ statuses: stringList, createdWithinYears: yearsWindow })
      .strict()
      .optional(),
    opportunities: z
      .object({
        stages: stringList,
        closedWithinYears: yearsWindow,
        status: z.enum(["all", "open", "won"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/**
 * Escape a string for safe inclusion inside a single-quoted SOQL string
 * literal. Backslash MUST be escaped first, then the single quote. Control
 * characters (including newlines) are stripped — SOQL string literals can't
 * contain raw line breaks and they have no legitimate place in a picklist
 * value, owner name, or stage name.
 */
export function escapeSoqlString(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function inClause(field: string, values: string[] | undefined): string | null {
  if (!values) return null;
  const clean = values
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_VALUES_PER_FIELD);
  if (clean.length === 0) return null;
  const quoted = clean.map((v) => `'${escapeSoqlString(v)}'`).join(", ");
  return `${field} IN (${quoted})`;
}

function clampYears(years: number | undefined): number | null {
  if (typeof years !== "number" || !Number.isFinite(years)) return null;
  const n = Math.floor(years);
  if (n < 1 || n > MAX_YEARS) return null;
  return n;
}

/** SOQL Date literal (YYYY-MM-DD) for N years before today (UTC). */
function dateLiteralYearsAgo(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** SOQL DateTime literal (YYYY-MM-DDThh:mm:ssZ) for N years before today. */
function dateTimeLiteralYearsAgo(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCHours(0, 0, 0, 0);
  return `${d.toISOString().slice(0, 19)}Z`;
}

function joinAnd(conditions: Array<string | null>): string {
  return conditions.filter((c): c is string => !!c).join(" AND ");
}

export function buildAccountWhere(filters: SfdcSyncFilters): string {
  const a = filters.accounts;
  return joinAnd([
    inClause("Type", a?.types),
    inClause("Industry", a?.industries),
    inClause("Owner.Name", a?.owners),
  ]);
}

/**
 * Contacts are scoped to accounts matching the ACCOUNT filter (via the
 * Account.* relationship on Contact) so contacts of excluded accounts are not
 * pulled, plus an optional contact created-date window.
 */
export function buildContactWhere(filters: SfdcSyncFilters): string {
  const a = filters.accounts;
  const conditions: Array<string | null> = [
    inClause("Account.Type", a?.types),
    inClause("Account.Industry", a?.industries),
    inClause("Account.Owner.Name", a?.owners),
  ];
  const years = clampYears(filters.contacts?.createdWithinYears);
  if (years) conditions.push(`CreatedDate >= ${dateTimeLiteralYearsAgo(years)}`);
  return joinAnd(conditions);
}

export function buildLeadWhere(filters: SfdcSyncFilters): string {
  const l = filters.leads;
  const conditions: Array<string | null> = [inClause("Status", l?.statuses)];
  const years = clampYears(l?.createdWithinYears);
  if (years) conditions.push(`CreatedDate >= ${dateTimeLiteralYearsAgo(years)}`);
  return joinAnd(conditions);
}

export function buildOpportunityWhere(filters: SfdcSyncFilters): string {
  const o = filters.opportunities;
  const conditions: Array<string | null> = [inClause("StageName", o?.stages)];
  const years = clampYears(o?.closedWithinYears);
  if (years) conditions.push(`CloseDate >= ${dateLiteralYearsAgo(years)}`);
  if (o?.status === "open") conditions.push("IsClosed = false");
  else if (o?.status === "won") conditions.push("IsWon = true");
  return joinAnd(conditions);
}

/**
 * Splice a WHERE clause into a base SOQL `SELECT ... FROM X LIMIT N` string.
 * The WHERE goes before LIMIT; an empty clause leaves the query untouched so
 * "no filter" pulls everything exactly as before.
 */
export function applyWhere(baseSoql: string, where: string): string {
  if (!where) return baseSoql;
  const limitIdx = baseSoql.search(/\sLIMIT\s/i);
  if (limitIdx === -1) return `${baseSoql} WHERE ${where}`;
  return `${baseSoql.slice(0, limitIdx)} WHERE ${where}${baseSoql.slice(limitIdx)}`;
}

/**
 * Validate and normalise a raw filters payload. Returns the clean object on
 * success or null on any validation failure (the route fails closed).
 */
export function parseSyncFilters(raw: unknown): SfdcSyncFilters | null {
  const result = SyncFiltersSchema.safeParse(raw ?? {});
  return result.success ? (result.data as SfdcSyncFilters) : null;
}
