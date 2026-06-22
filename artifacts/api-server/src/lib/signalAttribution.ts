import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";

/**
 * Resolve a contact by email, strictly scoped to a single tenant.
 *
 * Used by every engagement-signal recording path to attach a contactId when
 * one isn't already known (e.g. a send/hotlink relationship). It mirrors the
 * tenant-scoped email match the inbound-email path uses and MUST NOT fall back
 * to a global/cross-tenant lookup — the same person's email can legitimately
 * exist in multiple tenants' CRMs, and a global match would leak attribution
 * across tenants.
 *
 * Returns the contact id + its accountId, or null when there is no confident
 * single-tenant match.
 */
export async function resolveContactByEmail(
  tenantId: number,
  email: string | null | undefined,
): Promise<{ id: number; accountId: number | null } | null> {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return null;
  const [row] = await db
    .select({ id: salesContactsTable.id, accountId: salesContactsTable.accountId })
    .from(salesContactsTable)
    .where(and(
      eq(salesContactsTable.tenantId, tenantId),
      ilike(salesContactsTable.email, trimmed),
    ))
    .limit(1);
  return row ?? null;
}

/** Normalise a domain string — strip protocol, www., path, lowercase, trim. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  if (!d) return null;
  // Tolerate a full URL or an email-derived domain being passed in.
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  d = d.trim();
  return d || null;
}

/**
 * Canonicalise a LinkedIn profile URL for equality matching: lowercase, drop
 * the protocol + `www.`, and strip any query string / trailing slash. Two URLs
 * that point at the same profile (with/without scheme, trailing slash, or
 * tracking params) then compare equal. Returns null for empty input.
 */
export function normalizeLinkedinUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u = raw.trim().toLowerCase();
  if (!u) return null;
  u = u.replace(/^https?:\/\//, "").replace(/^www\./, "");
  u = u.split("?")[0].split("#")[0];
  u = u.replace(/\/+$/, "");
  return u || null;
}

/** SQL fragment that canonicalises a LinkedIn URL column the same way
 *  `normalizeLinkedinUrl` does (strip protocol, www., query/fragment, and any
 *  trailing slash — but KEEP the path), so an indexless equality match lines up. */
function linkedinColExpr(col: typeof salesContactsTable.linkedinUrl) {
  return sql`regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(${col}), '^https?://', ''), '^www\\.', ''), '[?#].*$', ''), '/+$', '')`;
}

export interface SignalIdentity {
  email?: string | null;
  linkedinUrl?: string | null;
  companyDomain?: string | null;
  companyName?: string | null;
}

export interface SignalLinkage {
  contactId: number | null;
  accountId: number | null;
}

/**
 * Centralised, strictly tenant-scoped matcher for engagement signals. Every
 * ingest path (rb2b / apollo / letterdrop webhooks, POST /signals, form
 * submits, inbound replies) and the retroactive backfill resolve linkage
 * through this one helper so the rules can never drift between paths.
 *
 * Resolution order (each step tenant-scoped, exact/canonical — never fuzzy, so
 * we never mis-attribute):
 *   contact: email (case-insensitive) → LinkedIn URL (canonicalised)
 *   account: the resolved contact's accountId → company domain → company name
 *
 * FAIL CLOSED: a null tenantId returns no linkage. The same email / LinkedIn /
 * domain legitimately appears in multiple tenants' CRMs, so a global lookup
 * would leak attribution across tenants — never add one.
 */
export async function resolveSignalLinkage(
  tenantId: number | null | undefined,
  identity: SignalIdentity,
): Promise<SignalLinkage> {
  if (tenantId == null) return { contactId: null, accountId: null };

  const email = (identity.email ?? "").trim();
  const linkedin = normalizeLinkedinUrl(identity.linkedinUrl);
  const domain = normalizeDomain(identity.companyDomain);
  const companyName = (identity.companyName ?? "").trim();

  let contactId: number | null = null;
  let accountId: number | null = null;

  // ── Contact: email first, then canonical LinkedIn URL ──
  if (email) {
    const [row] = await db
      .select({ id: salesContactsTable.id, accountId: salesContactsTable.accountId })
      .from(salesContactsTable)
      .where(and(
        eq(salesContactsTable.tenantId, tenantId),
        ilike(salesContactsTable.email, email),
      ))
      .limit(1);
    if (row) { contactId = row.id; accountId = row.accountId; }
  }
  if (contactId == null && linkedin) {
    const [row] = await db
      .select({ id: salesContactsTable.id, accountId: salesContactsTable.accountId })
      .from(salesContactsTable)
      .where(and(
        eq(salesContactsTable.tenantId, tenantId),
        eq(linkedinColExpr(salesContactsTable.linkedinUrl), linkedin),
      ))
      .limit(1);
    if (row) { contactId = row.id; accountId = row.accountId; }
  }

  // ── Account: prefer the matched contact's account, else domain, else name ──
  if (accountId == null && domain) {
    const [row] = await db
      .select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(and(
        eq(salesAccountsTable.tenantId, tenantId),
        ilike(salesAccountsTable.domain, domain),
      ))
      .limit(1);
    if (row) accountId = row.id;
  }
  if (accountId == null && companyName) {
    const [row] = await db
      .select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(and(
        eq(salesAccountsTable.tenantId, tenantId),
        ilike(salesAccountsTable.name, companyName),
      ))
      .limit(1);
    if (row) accountId = row.id;
  }

  return { contactId, accountId };
}

/**
 * Human-readable fallback label for a signal `source`, derived from the signal
 * type. Used when a recording path has no more specific source (e.g. the page
 * title or email subject) so the activity feed never shows a bare placeholder
 * like "outreach".
 */
export function readableSignalSource(type: string): string {
  const map: Record<string, string> = {
    email_open: "Opened email",
    email_click: "Clicked email link",
    email_sent: "Email sent",
    email_replied: "Replied to email",
    email_bounced: "Email bounced",
    email_complained: "Marked as spam",
    page_view: "Viewed page",
    form_submit: "Submitted form",
    link_click: "Clicked link",
    visitor_identified: "Identified visitor",
  };
  return map[type] ?? "Engagement";
}
