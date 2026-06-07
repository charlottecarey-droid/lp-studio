import { and, eq, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable } from "@workspace/db";

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
