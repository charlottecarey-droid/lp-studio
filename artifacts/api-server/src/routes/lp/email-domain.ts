/**
 * Self-serve custom email-domain wizard (Task #771).
 *
 * Lets an Enterprise tenant (gated by the `customEmailDomain` plan feature)
 * register and verify their OWN sending domain in Resend, without an operator
 * touching the Resend dashboard. The flow:
 *
 *   POST   /lp/email-domain         register { domain } → create in Resend,
 *                                   persist {sendingDomain, customEmailDomainId}
 *                                   on the tenant's brand config, return the
 *                                   DNS records the customer must publish.
 *   GET    /lp/email-domain         current state + LIVE verification status
 *                                   (re-fetched from Resend by id).
 *   POST   /lp/email-domain/verify  re-fetch status by id (the wizard polls
 *                                   this while DNS propagates).
 *   DELETE /lp/email-domain         delete the Resend domain + clear config →
 *                                   reverts to the Tier 1 shared default.
 *
 * FAIL CLOSED: registering only PERSISTS the domain. Whether mail actually
 * sends from it is decided independently by `resolveTenantSender`, which makes
 * a live `getResendDomainStatus` check and falls back to the shared default
 * until Resend reports "verified". So an unverified or mistyped domain never
 * sends — there is no window where a half-configured domain breaks outbound.
 *
 * All routes are gated by `requirePlanFeature("customEmailDomain")` (402 for
 * non-Enterprise; superadmin bypasses, matching the rest of the gate surface).
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, lpBrandSettingsTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";
import { validateDomain } from "../../lib/tenantHosts";
import {
  createResendDomain,
  getResendDomainById,
  getResendDomainByName,
  deleteResendDomain,
  type ResendDnsRecord,
  type ResendDomainVerificationState,
} from "../../lib/resendDomainStatus";

const router = Router();

/**
 * State the wizard renders. `active` is the only field that says "mail is (or
 * will be, on the next cache cycle) sending from this domain" — it is true iff
 * a domain is configured AND Resend reports it verified. The wizard surfaces
 * `records` so the customer can publish DNS; the resolver never reads them.
 */
interface EmailDomainState {
  domain: string | null;
  domainId: string | null;
  status: ResendDomainVerificationState;
  records: ResendDnsRecord[];
  active: boolean;
}

const EMPTY_STATE: EmailDomainState = {
  domain: null,
  domainId: null,
  status: "not_configured",
  records: [],
  active: false,
};

type SalesConsoleSlice = {
  sendingDomain?: unknown;
  customEmailDomainId?: unknown;
  [k: string]: unknown;
};

/** Read the tenant's brand config + the email-domain fields off salesConsole. */
async function readEmailDomainConfig(
  tenantId: number,
): Promise<{ rowId: number | null; config: Record<string, unknown>; sendingDomain: string; domainId: string }> {
  const rows = await db
    .select()
    .from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) {
    return { rowId: null, config: {}, sendingDomain: "", domainId: "" };
  }
  const config = (rows[0].config as Record<string, unknown>) ?? {};
  const sc = (config.salesConsole as SalesConsoleSlice) ?? {};
  return {
    rowId: rows[0].id,
    config,
    sendingDomain: typeof sc.sendingDomain === "string" ? sc.sendingDomain : "",
    domainId: typeof sc.customEmailDomainId === "string" ? sc.customEmailDomainId : "",
  };
}

/**
 * Read-merge-write the email-domain fields into config.salesConsole, leaving
 * every other brand/salesConsole field untouched. Returns nothing; callers
 * re-read or build state from the values they just wrote.
 */
async function persistEmailDomain(
  tenantId: number,
  fields: { sendingDomain: string | null; customEmailDomainId: string | null },
): Promise<void> {
  const { rowId, config } = await readEmailDomainConfig(tenantId);
  const sc: Record<string, unknown> = { ...((config.salesConsole as Record<string, unknown>) ?? {}) };

  if (fields.sendingDomain === null || fields.sendingDomain === "") delete sc.sendingDomain;
  else sc.sendingDomain = fields.sendingDomain;

  if (fields.customEmailDomainId === null || fields.customEmailDomainId === "") delete sc.customEmailDomainId;
  else sc.customEmailDomainId = fields.customEmailDomainId;

  // Re-arm the verification heads-up (Task #783): clearing or changing the
  // registered domain drops the "already notified" marker so a later
  // verification of a newly-registered domain fires again. The marker is also
  // keyed by id, so a fresh Resend id self-re-arms even without this — but
  // clearing it on remove keeps the config tidy.
  if (
    fields.customEmailDomainId === null ||
    fields.customEmailDomainId === "" ||
    sc.customEmailDomainVerifiedNotifiedId !== fields.customEmailDomainId
  ) {
    delete sc.customEmailDomainVerifiedNotifiedId;
  }

  const nextConfig = { ...config, salesConsole: sc };

  if (rowId === null) {
    await db.insert(lpBrandSettingsTable).values({ tenantId, config: nextConfig });
  } else {
    await db
      .update(lpBrandSettingsTable)
      .set({ config: nextConfig, updatedAt: new Date() })
      .where(and(eq(lpBrandSettingsTable.tenantId, tenantId), eq(lpBrandSettingsTable.id, rowId)));
  }
}

/**
 * Build wizard state for a configured domain by re-fetching its live status
 * from Resend by id. Fails open on a Resend outage to `api_unavailable` so the
 * wizard still renders the persisted domain rather than erroring.
 */
async function buildStateFromId(domain: string, domainId: string): Promise<EmailDomainState> {
  const result = await getResendDomainById(domainId);
  if (!result.available || !result.domain) {
    return { domain, domainId, status: "api_unavailable", records: [], active: false };
  }
  const status = result.domain.status;
  return {
    domain: result.domain.name || domain,
    domainId,
    status,
    records: result.domain.records ?? [],
    active: status === "verified",
  };
}

/**
 * Reuse a domain that already exists in our Resend account. Looks it up by name
 * (the create call only tells us it exists, not its id), then builds the full
 * wizard state by id — the list endpoint omits DNS records, so the by-id fetch
 * is what gives the customer the records table + live verification status.
 * Returns null when the lookup fails so the caller can surface a friendly error.
 */
async function reuseExistingResendDomain(domain: string): Promise<EmailDomainState | null> {
  const found = await getResendDomainByName(domain);
  if (!found.available || !found.domain) return null;
  return buildStateFromId(found.domain.name || domain, found.domain.id);
}

// All routes Enterprise-gated. requirePlanFeature returns 402 plan_upgrade_required
// for ineligible tenants (superadmin/no-authUser bypass per the middleware).
router.use("/lp/email-domain", requirePlanFeature("customEmailDomain"));

router.get("/lp/email-domain", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const { sendingDomain: domain, domainId } = await readEmailDomainConfig(tenantId);
    if (!domainId) {
      // No custom domain registered. Surface the persisted sendingDomain (if
      // any) as informational; status stays not_configured (no id to poll).
      res.json({ ...EMPTY_STATE, domain: domain || null });
      return;
    }
    res.json(await buildStateFromId(domain, domainId));
  } catch (err) {
    console.error("[lp/email-domain] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/lp/email-domain", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const raw = typeof req.body?.domain === "string" ? req.body.domain : "";
  const v = validateDomain(raw);
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }
  if (!v.normalized) {
    res.status(400).json({ error: "A domain is required" });
    return;
  }
  const domain = v.normalized;

  try {
    const existing = await readEmailDomainConfig(tenantId);
    // Idempotent re-register of the same domain: just return its live state
    // rather than creating a duplicate Resend domain.
    if (existing.domainId && existing.sendingDomain.toLowerCase() === domain) {
      res.json(await buildStateFromId(domain, existing.domainId));
      return;
    }
    // A different domain is already registered — require an explicit remove
    // first so we never orphan the prior Resend domain.
    if (existing.domainId && existing.sendingDomain.toLowerCase() !== domain) {
      res.status(409).json({
        error: `Remove the current domain (${existing.sendingDomain}) before adding a new one`,
      });
      return;
    }

    const created = await createResendDomain(domain);
    if (!created.available || !created.domain) {
      // The domain already exists in our Resend account (e.g. from an earlier
      // attempt). Reuse it instead of dead-ending: look it up by name, fetch
      // its full record + live verification by id, persist, and return the
      // normal success state — so the experience matches a fresh registration.
      if (created.alreadyRegistered) {
        const reused = await reuseExistingResendDomain(domain);
        if (reused) {
          // Routing stays gated on the live verified check in
          // resolveTenantSender, so reusing a domain never starts unverified
          // sends.
          await persistEmailDomain(tenantId, {
            sendingDomain: reused.domain,
            customEmailDomainId: reused.domainId,
          });
          res.status(200).json(reused);
          return;
        }
        res.status(502).json({
          error:
            "This domain is already registered with our email provider, but we couldn't load its details. Please try again in a moment.",
        });
        return;
      }
      // No API key / Resend down / Resend rejected it. Nothing persisted, so
      // the tenant stays on the shared default — fail closed.
      res.status(502).json({ error: created.error || "Could not register the domain with Resend" });
      return;
    }

    // Persist domain + id. Routing remains gated on the live verified check in
    // resolveTenantSender, so this write alone never starts unverified sends.
    await persistEmailDomain(tenantId, {
      sendingDomain: created.domain.name,
      customEmailDomainId: created.domain.id,
    });

    res.status(201).json({
      domain: created.domain.name,
      domainId: created.domain.id,
      status: created.domain.status,
      records: created.domain.records ?? [],
      active: created.domain.status === "verified",
    } satisfies EmailDomainState);
  } catch (err) {
    console.error("[lp/email-domain] POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/lp/email-domain/verify", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const { sendingDomain: domain, domainId } = await readEmailDomainConfig(tenantId);
    if (!domainId) {
      res.status(400).json({ error: "No custom email domain is registered" });
      return;
    }
    res.json(await buildStateFromId(domain, domainId));
  } catch (err) {
    console.error("[lp/email-domain] POST /verify error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/lp/email-domain", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const { domainId } = await readEmailDomainConfig(tenantId);
    // Best-effort delete in Resend. Even if it fails (already gone, transient
    // error), we still clear the tenant config so the tenant reliably reverts
    // to the shared default — clearing config is the safety-critical step.
    if (domainId) {
      const del = await deleteResendDomain(domainId);
      if (!del.available) {
        console.warn(`[lp/email-domain] Resend delete failed for tenant ${tenantId}: ${del.error}`);
      }
    }
    await persistEmailDomain(tenantId, { sendingDomain: null, customEmailDomainId: null });
    res.json(EMPTY_STATE);
  } catch (err) {
    console.error("[lp/email-domain] DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
