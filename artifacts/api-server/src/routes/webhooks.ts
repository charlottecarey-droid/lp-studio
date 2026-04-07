/**
 * Webhook endpoints for third-party visitor identification services.
 * These are public (no auth) endpoints — external services POST to them.
 *
 * POST /webhooks/rb2b   — RB2B LinkedIn visitor identification
 * POST /webhooks/apollo — Apollo.io website visitor identification
 *
 * Both endpoints:
 *   1. Parse the payload
 *   2. Extract LP slug from the page URL
 *   3. Match visitor to an existing account (by domain) and contact (by LinkedIn / email)
 *   4. Write a `visitor_identified` signal
 *   5. Broadcast via SSE so the sales console updates in real-time
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesSignalsTable,
  salesAccountsTable,
  salesContactsTable,
} from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { broadcastSignal } from "./sales/signals";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────

/** Extract the LP slug from a full page URL, e.g. "faster-dentures" */
function slugFromUrl(pageUrl: string | undefined): string | null {
  if (!pageUrl) return null;
  try {
    const { pathname } = new URL(pageUrl);
    // pathname is like /lp/faster-dentures or /faster-dentures
    const parts = pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

/** Normalise a domain string — strip www., lowercase, trim. */
function normaliseDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw.toLowerCase().replace(/^www\./, "").trim();
}

/**
 * Try to find a matching account by company domain.
 * Returns the account id, or null if not found.
 */
async function findAccountByDomain(domain: string | null): Promise<number | null> {
  if (!domain) return null;
  const [row] = await db
    .select({ id: salesAccountsTable.id })
    .from(salesAccountsTable)
    .where(ilike(salesAccountsTable.domain, domain))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Try to find a matching contact by LinkedIn URL or email.
 * Returns the contact id, or null if not found.
 */
async function findContact(
  linkedinUrl: string | null,
  email: string | null
): Promise<number | null> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (linkedinUrl) conditions.push(eq(salesContactsTable.linkedinUrl, linkedinUrl));
  if (email)       conditions.push(ilike(salesContactsTable.email, email));
  if (!conditions.length) return null;

  const [row] = await db
    .select({ id: salesContactsTable.id })
    .from(salesContactsTable)
    .where(or(...conditions))
    .limit(1);
  return row?.id ?? null;
}

// ─── POST /webhooks/rb2b ─────────────────────────────────────
/**
 * RB2B identifies LinkedIn users visiting the page and POSTs here.
 *
 * Expected payload shape (RB2B standard):
 * {
 *   "type": "identify",
 *   "properties": {
 *     "linkedInUrl":    "https://www.linkedin.com/in/johndoe",
 *     "firstName":      "John",
 *     "lastName":       "Doe",
 *     "title":          "VP of Sales",
 *     "companyName":    "Acme Corp",
 *     "companyDomain":  "acmedental.com",
 *     "email":          "john@acmedental.com",      // may be absent
 *     "pageUrl":        "https://partners.meetdandy.com/faster-dentures"
 *   }
 * }
 */
router.post("/rb2b", async (req, res): Promise<void> => {
  try {
    const props = req.body?.properties ?? req.body ?? {};

    const linkedinUrl: string | null = props.linkedInUrl ?? props.linkedin_url ?? null;
    const email: string | null       = props.email ?? null;
    const firstName: string          = props.firstName ?? props.first_name ?? "";
    const lastName: string           = props.lastName ?? props.last_name ?? "";
    const title: string              = props.title ?? "";
    const companyName: string        = props.companyName ?? props.company_name ?? "";
    const companyDomain: string | null = normaliseDomain(props.companyDomain ?? props.company_domain);
    const pageUrl: string | null     = props.pageUrl ?? props.page_url ?? null;
    const slug                       = slugFromUrl(pageUrl ?? undefined);

    const [accountId, contactId] = await Promise.all([
      findAccountByDomain(companyDomain),
      findContact(linkedinUrl, email),
    ]);

    const [signal] = await db
      .insert(salesSignalsTable)
      .values({
        tenantId: 1,          // Dandy tenant
        accountId,
        contactId,
        type: "visitor_identified",
        source: "rb2b",
        metadata: {
          firstName,
          lastName,
          title,
          companyName,
          companyDomain,
          linkedinUrl,
          email,
          pageUrl,
          slug,
        },
      })
      .returning();

    broadcastSignal(signal);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /webhooks/rb2b error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /webhooks/apollo ───────────────────────────────────
/**
 * Apollo website tracker sends visitor identification events here.
 *
 * Expected payload shape (Apollo standard webhook):
 * {
 *   "event_type": "website_visitor_identified",
 *   "organization": {
 *     "name":    "Acme Dental Group",
 *     "domain":  "acmedental.com",
 *     "id":      "apollo_org_id"
 *   },
 *   "visitor": {
 *     "ip":       "1.2.3.4",
 *     "page_url": "https://partners.meetdandy.com/faster-dentures",
 *     "user_agent": "..."
 *   }
 * }
 *
 * Also handles person-level identification if Apollo includes person data:
 * {
 *   "person": {
 *     "first_name": "Jane",
 *     "last_name":  "Smith",
 *     "title":      "Office Manager",
 *     "email":      "jane@acmedental.com",
 *     "linkedin_url": "https://www.linkedin.com/in/janesmith"
 *   }
 * }
 */
router.post("/apollo", async (req, res): Promise<void> => {
  try {
    const body = req.body ?? {};

    const org    = body.organization ?? body.org ?? {};
    const visitor = body.visitor ?? {};
    const person = body.person ?? {};

    const companyName: string   = org.name ?? "";
    const companyDomain: string | null = normaliseDomain(org.domain);
    const apolloOrgId: string   = org.id ?? org.apollo_id ?? "";
    const pageUrl: string | null = visitor.page_url ?? visitor.pageUrl ?? body.page_url ?? null;
    const ip: string            = visitor.ip ?? "";
    const slug                  = slugFromUrl(pageUrl ?? undefined);

    const linkedinUrl: string | null = person.linkedin_url ?? person.linkedinUrl ?? null;
    const email: string | null       = person.email ?? null;
    const firstName: string          = person.first_name ?? person.firstName ?? "";
    const lastName: string           = person.last_name ?? person.lastName ?? "";
    const title: string              = person.title ?? "";

    const [accountId, contactId] = await Promise.all([
      findAccountByDomain(companyDomain),
      findContact(linkedinUrl, email),
    ]);

    const [signal] = await db
      .insert(salesSignalsTable)
      .values({
        tenantId: 1,
        accountId,
        contactId,
        type: "visitor_identified",
        source: "apollo",
        metadata: {
          companyName,
          companyDomain,
          apolloOrgId,
          pageUrl,
          ip,
          slug,
          ...(firstName && { firstName, lastName, title, email, linkedinUrl }),
        },
      })
      .returning();

    broadcastSignal(signal);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /webhooks/apollo error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
