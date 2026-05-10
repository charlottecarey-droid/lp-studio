/**
 * Webhook endpoints for third-party visitor identification services.
 * These are public (no auth) endpoints — external services POST to them.
 *
 * POST /webhooks/rb2b/:secret        — RB2B LinkedIn visitor identification
 * POST /webhooks/apollo/:secret      — Apollo.io website visitor identification
 * POST /webhooks/letterdrop/:secret  — Letterdrop lead/visitor identification
 *
 * Each URL embeds a per-tenant secret (see lib/db schema
 * `tenantWebhookSecrets`). The handler resolves the tenant by
 * (integration, secret); unknown secrets return 404 with no body so an
 * attacker can't probe which integrations a tenant has wired up.
 *
 * All endpoints:
 *   1. Resolve the tenant from the URL secret (404 on miss)
 *   2. Parse the payload
 *   3. Extract LP slug from the page URL
 *   4. Match visitor to an existing account (by domain) and contact (by LinkedIn / email)
 *   5. Write a `visitor_identified` signal scoped to the resolved tenant
 *   6. Broadcast via SSE so the sales console updates in real-time
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesSignalsTable,
  salesAccountsTable,
  salesContactsTable,
  tenantWebhookSecretsTable,
} from "@workspace/db";
import { and, eq, ilike, or } from "drizzle-orm";
import { broadcastSignal } from "./sales/signals";

const router = Router();

type Integration = "rb2b" | "apollo" | "letterdrop";

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Resolve a webhook secret to a tenant id. Returns null if no row matches —
 * callers must convert that into a 404 with no body so the response is
 * indistinguishable from "no such route", preventing enumeration of which
 * tenants have which integrations enabled.
 */
async function resolveTenantBySecret(
  integration: Integration,
  secret: string | undefined,
): Promise<number | null> {
  if (!secret || typeof secret !== "string") return null;
  // Defensive bound — base64url(24) is 32 chars, so anything wildly outside
  // that range can't be a real secret. Avoids hitting the DB for obvious junk.
  if (secret.length < 16 || secret.length > 128) return null;
  const [row] = await db
    .select({ tenantId: tenantWebhookSecretsTable.tenantId })
    .from(tenantWebhookSecretsTable)
    .where(
      and(
        eq(tenantWebhookSecretsTable.integration, integration),
        eq(tenantWebhookSecretsTable.secret, secret),
      ),
    )
    .limit(1);
  return row?.tenantId ?? null;
}

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
 * Try to find a matching account by company domain, scoped to a single
 * tenant. The tenant scope is mandatory: without it, a webhook routed to
 * tenant B could attach an `accountId` belonging to tenant A whenever
 * domains overlap (a common case — many tenants will track visits to the
 * same Fortune 500 companies). Returns the account id, or null.
 */
async function findAccountByDomain(
  tenantId: number,
  domain: string | null,
): Promise<number | null> {
  if (!domain) return null;
  const [row] = await db
    .select({ id: salesAccountsTable.id })
    .from(salesAccountsTable)
    .where(
      and(
        eq(salesAccountsTable.tenantId, tenantId),
        ilike(salesAccountsTable.domain, domain),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * Try to find a matching contact by LinkedIn URL or email, scoped to a
 * single tenant. Same isolation rationale as findAccountByDomain — emails
 * and LinkedIn URLs can legitimately appear in multiple tenants' CRMs and
 * we never want to cross-link them. Returns the contact id, or null.
 */
async function findContact(
  tenantId: number,
  linkedinUrl: string | null,
  email: string | null,
): Promise<number | null> {
  const identityConditions: ReturnType<typeof eq>[] = [];
  if (linkedinUrl) identityConditions.push(eq(salesContactsTable.linkedinUrl, linkedinUrl));
  if (email)       identityConditions.push(ilike(salesContactsTable.email, email));
  if (!identityConditions.length) return null;

  const [row] = await db
    .select({ id: salesContactsTable.id })
    .from(salesContactsTable)
    .where(
      and(
        eq(salesContactsTable.tenantId, tenantId),
        or(...identityConditions),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

// ─── POST /webhooks/rb2b/:secret ─────────────────────────────
/**
 * RB2B identifies LinkedIn users visiting the page and POSTs here. The URL
 * embeds a per-tenant secret so signals route to the right tenant; an
 * unknown secret responds with 404.
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
router.post("/rb2b/:secret", async (req, res): Promise<void> => {
  try {
    const tenantId = await resolveTenantBySecret("rb2b", req.params.secret);
    if (tenantId == null) {
      // 404 with no body — indistinguishable from "no such route" to avoid
      // leaking whether RB2B is configured for any tenant.
      res.status(404).end();
      return;
    }

    // RB2B fires for every visit; only populate identity when they match someone.
    // Log the raw body so we can inspect the payload format if needed.
    console.log("[rb2b] raw body:", JSON.stringify(req.body));

    const props = req.body?.properties ?? req.body ?? {};

    const linkedinUrl: string | null   = props.linkedInUrl || props.linkedin_url || null;
    const email: string | null         = props.email || null;
    const firstName: string            = props.firstName || props.first_name || "";
    const lastName: string             = props.lastName || props.last_name || "";
    const title: string                = props.title || "";
    const companyName: string          = props.companyName || props.company_name || "";
    const companyDomain: string | null = normaliseDomain(props.companyDomain ?? props.company_domain);
    const pageUrl: string | null       = props.pageUrl || props.page_url || null;
    const slug                         = slugFromUrl(pageUrl ?? undefined);

    // Skip signals where RB2B couldn't identify anyone and has no page context.
    const hasIdentity = firstName || lastName || companyName || linkedinUrl || email;
    const hasContext  = pageUrl || slug;
    if (!hasIdentity && !hasContext) {
      console.log("[rb2b] skipping — no identity or page context in payload");
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const [accountId, contactId] = await Promise.all([
      findAccountByDomain(tenantId, companyDomain),
      findContact(tenantId, linkedinUrl, email),
    ]);

    const [signal] = await db
      .insert(salesSignalsTable)
      .values({
        tenantId,
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

// ─── POST /webhooks/apollo/:secret ───────────────────────────
/**
 * Apollo website tracker sends visitor identification events here. The URL
 * embeds a per-tenant secret so signals route to the right tenant; an
 * unknown secret responds with 404.
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
router.post("/apollo/:secret", async (req, res): Promise<void> => {
  try {
    const tenantId = await resolveTenantBySecret("apollo", req.params.secret);
    if (tenantId == null) {
      res.status(404).end();
      return;
    }

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
      findAccountByDomain(tenantId, companyDomain),
      findContact(tenantId, linkedinUrl, email),
    ]);

    const [signal] = await db
      .insert(salesSignalsTable)
      .values({
        tenantId,
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

// ─── POST /webhooks/letterdrop/:secret ───────────────────────
/**
 * Letterdrop sends lead/visitor identification events here. The URL embeds
 * a per-tenant secret so signals route to the right tenant; an unknown
 * secret responds with 404.
 *
 * Letterdrop payload shape (flexible — we capture all common variants):
 * {
 *   "event":       "lead_identified" | "visitor_identified" | "new_lead",
 *   "firstName":   "Jane",
 *   "lastName":    "Doe",
 *   "email":       "jane@acmedental.com",
 *   "title":       "Office Manager",
 *   "company":     "Acme Dental",
 *   "domain":      "acmedental.com",
 *   "linkedinUrl": "https://www.linkedin.com/in/janedoe",
 *   "pageUrl":     "https://partners.meetdandy.com/faster-dentures",
 *   "source":      "letterdrop"
 * }
 *
 * Nested variants (e.g. { lead: { ... } } or { visitor: { ... } }) are
 * also handled by flattening the first nested object found.
 */
router.post("/letterdrop/:secret", async (req, res): Promise<void> => {
  try {
    const tenantId = await resolveTenantBySecret("letterdrop", req.params.secret);
    if (tenantId == null) {
      res.status(404).end();
      return;
    }

    // Letterdrop sends either a single lead object or an array of leads
    const raw = req.body ?? {};
    const leads: Record<string, string | undefined>[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.leads)
        ? raw.leads
        : [raw.lead ?? raw.visitor ?? raw.person ?? raw];

    for (const props of leads) {
      // Letterdrop uses "name" (full name) — split on first space
      const fullName = props.name ?? "";
      const spaceIdx = fullName.indexOf(" ");
      const firstName = spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName;
      const lastName  = spaceIdx > -1 ? fullName.slice(spaceIdx + 1) : "";

      const email: string | null       = props.email ?? null;
      const title: string              = props.job_title ?? props.title ?? "";
      const companyName: string        = props.company_name ?? props.company ?? props.organization ?? "";
      const companyDomain: string | null = normaliseDomain(props.domain ?? props.company_domain);
      const linkedinUrl: string | null   = props.linkedin_url ?? props.linkedinUrl ?? props.linkedin ?? null;
      const pageUrl: string | null       = props.pageUrl ?? props.page_url ?? props.url ?? null;
      const slug = slugFromUrl(pageUrl ?? undefined);

      // Letterdrop-specific fields
      const activityType: string   = props.last_activity_type ?? props.activity_type ?? "";
      const lastActivity: string   = props.last_activity ?? "";
      const engagedWith: string    = props.engaged_with ?? "";
      const postUrl: string        = props.last_engaged_linkedin_post_url ?? props.post_url ?? "";
      const lastEngagedDate: string = props.last_engaged_date ?? "";

      const [accountId, contactId] = await Promise.all([
        findAccountByDomain(tenantId, companyDomain),
        findContact(tenantId, linkedinUrl, email),
      ]);

      const [signal] = await db
        .insert(salesSignalsTable)
        .values({
          tenantId,
          accountId,
          contactId,
          type: "visitor_identified",
          source: "letterdrop",
          metadata: {
            firstName,
            lastName,
            email,
            title,
            companyName,
            companyDomain,
            linkedinUrl,
            pageUrl,
            slug,
            activityType,
            lastActivity,
            engagedWith,
            postUrl,
            lastEngagedDate,
          },
        })
        .returning();

      broadcastSignal(signal);
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /webhooks/letterdrop error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
