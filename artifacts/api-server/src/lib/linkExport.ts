import type { Request } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  salesContactsTable,
  salesAccountsTable,
  lpPagesTable,
} from "@workspace/db";
import { ensureHotlinkForContact } from "./ensureHotlink";
import { getTenantOutboundOrigin } from "./tenantHosts";

/**
 * Normalized row shape for the personalized-link export pipeline. Built ONCE
 * from the audience + per-contact hotlinks, then handed to whichever export
 * destination the user picked. Every destination consumes this same shape so
 * adding a new destination never touches the row-building code.
 */
export interface LinkExportRow {
  contactId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  company: string;
  title: string;
  link: string;
}

export interface BuildLinkRowsResult {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  rows: LinkExportRow[];
  skippedNoEmail: number;
}

export class LinkExportError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Build the personalized-link rows for an audience on a landing page.
 *
 * Tenant-scoped throughout: the page, the contacts, and the account names are
 * all filtered by tenantId so a crafted contactIds payload can never reach
 * another tenant's data. A landing page is REQUIRED and must be published —
 * link-only mode is meaningless without a destination page, and we never hand
 * out links to an unpublished page.
 */
export async function buildLinkRows(args: {
  tenantId: number;
  pageId: number;
  contactIds: number[];
  req: Request;
}): Promise<BuildLinkRowsResult> {
  const { tenantId, pageId, contactIds, req } = args;

  if (!pageId || Number.isNaN(pageId)) {
    throw new LinkExportError(400, "A landing page is required to generate personalized links.");
  }
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new LinkExportError(400, "Pick at least one contact to generate links for.");
  }

  // Validate the page belongs to this tenant and is published.
  const [page] = await db
    .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId)));
  if (!page) throw new LinkExportError(404, "Landing page not found.");
  if (page.status !== "published") {
    throw new LinkExportError(400, "The selected landing page is not published yet. Publish it before generating links.");
  }

  // Load contacts — tenant-scoped. A malicious contactIds payload can't pull
  // other tenants' contacts because of the tenantId filter.
  const contacts = await db
    .select()
    .from(salesContactsTable)
    .where(and(
      inArray(salesContactsTable.id, contactIds),
      eq(salesContactsTable.tenantId, tenantId),
    ));

  // Link-only export still needs an email per row (it's the lookup key for
  // Sheets/Marketo and the identity column in CSV), and we only generate for
  // active contacts — mirrors the campaign send path.
  const usable = contacts.filter(c => c.email && c.status === "active");
  const skippedNoEmail = contacts.length - usable.length;

  // Batch-load account names for the {{company}} column.
  const accountIds = [...new Set(usable.map(c => c.accountId).filter((id): id is number => id != null))];
  const accounts = accountIds.length > 0
    ? await db.select({ id: salesAccountsTable.id, name: salesAccountsTable.name })
        .from(salesAccountsTable)
        .where(and(inArray(salesAccountsTable.id, accountIds), eq(salesAccountsTable.tenantId, tenantId)))
    : [];
  const accountNameById = new Map(accounts.map(a => [a.id, a.name]));

  const host = await getTenantOutboundOrigin(tenantId, req);

  const rows: LinkExportRow[] = [];
  for (const contact of usable) {
    const created = await ensureHotlinkForContact(tenantId, contact.id, pageId, contact.salesforceId ?? null);
    const firstName = contact.firstName ?? "";
    const lastName = contact.lastName ?? "";
    rows.push({
      contactId: contact.id,
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(" "),
      email: contact.email!,
      company: contact.accountId ? (accountNameById.get(contact.accountId) ?? "") : "",
      title: contact.title ?? "",
      link: `${host}/p/${created.token}`,
    });
  }

  return {
    pageId: page.id,
    pageTitle: page.title,
    pageSlug: page.slug,
    rows,
    skippedNoEmail,
  };
}
