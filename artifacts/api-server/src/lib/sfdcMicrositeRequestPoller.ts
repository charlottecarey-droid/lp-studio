// Task #1448 — Salesforce "Create Microsite" button request poller.
//
// Pull model riding the existing per-tenant Salesforce OAuth connection: a
// rep's Screen Flow creates an LP_Studio_Microsite_Request__c record (Status
// "New"); this poller finds those records, enqueues the existing microsite
// generation job, and — on a later tick — writes the finished page URL back
// to the Account and marks the request Complete/Failed. No new credentials,
// no inbound calls from Salesforce.
//
// ── Tick shape (per tenant, under a per-tenant advisory lock) ──────────
//   1. FINALIZE: Processing requests → look up their generation job.
//        succeeded → resolve public URL, maybe auto-publish (see policy
//                    below), PATCH Account URL (live pages only), PATCH
//                    request Complete.
//        failed    → PATCH request Failed + readable reason.
//        stale     → no job progress for >2h → PATCH Failed.
//   2. PICKUP: New requests (oldest first, LIMIT 5/tick) → validate, claim
//      (PATCH Processing FIRST — crash residue is covered by the stale
//      sweep), enqueue job, PATCH Job_Id__c.
//   3. Choice sync when stale >1h (segments/templates → LP_Studio_Choice__c).
//
// ── Publish policy (architect ruling, locked) ──────────────────────────
//   Auto-publish ONLY when the tenant's review workflow is OFF AND the page
//   has zero pending fact flags AND the flag check itself succeeded
//   (fail closed). Otherwise the page stays draft and the request gets a
//   review-token preview URL + "awaiting review" note instead; the Account
//   URL field is only ever written with LIVE page URLs.
//
// ── Overlap protection ──────────────────────────────────────────────────
// Same two layers as marketoSyncPoller: an in-process inflight guard plus a
// per-tenant transaction-scoped advisory lock (classid 1448) so two app
// instances can't double-claim the same tenant's requests.

import crypto from "node:crypto";
import {
  pool,
  db,
  sfdcConnectionsTable,
  tenantsTable,
  salesAccountsTable,
  lpPagesTable,
  lpPageReviewsTable,
  lpGenerationJobsTable,
  salesSignalsTable,
} from "@workspace/db";
import { eq, and, gt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { sfdcService, SfdcService } from "./sfdc-service";
import {
  REQUEST_OBJECT,
  REQUEST_STATUS,
  ACCOUNT_URL_FIELD,
  readMicrositeButtonState,
  writeMicrositeButtonState,
  loadTenantSegments,
  syncMicrositeChoices,
} from "./sfdcMicrositeButton";
import { listTemplatesForTenant } from "./templateListing";
import { createGenerationJob, startGenerationJob, getGenerationJob } from "./generationJobs";
import { getTenantPlanFeatures } from "./planFeatures";
import { tenantRequiresReview } from "./tenantSettings";
import { getPendingFactFlagState } from "../routes/lp/fact-flags";
import { canonicalTenantHost } from "./tenantHosts";
import { triggerPublishedRender } from "./triggerPublishedRender";

export const SFDC_MICROSITE_POLL_INTERVAL_MS = 60 * 1000;
// Defer the first sweep off the cold-start path (startup-probe starvation —
// see memory: r2-boot-sweeps-vs-startup-probe).
export const SFDC_MICROSITE_BOOT_DELAY_MS = 75 * 1000;

// Task number as the advisory-lock class id; tenant id is the object id.
const ADVISORY_LOCK_CLASSID = 1448;

/** Max requests claimed per tenant per tick. */
export const PICKUP_LIMIT = 5;
/** Per-tenant hourly cap on SFDC-sourced generations (quota backstop). */
export const HOURLY_CAP = 15;
/** A Processing request with no job progress for this long is failed. */
export const STALE_PROCESSING_MS = 2 * 60 * 60 * 1000;
/** Re-sync the Screen Flow dropdown choices when older than this. */
const CHOICES_SYNC_STALE_MS = 60 * 60 * 1000;

const ERROR_FIELD_MAX = 255;

export type EligibleConnection = { connectionId: number; tenantId: number };

let inflight: Promise<void> | null = null;

// ── Small pure helpers (unit-tested) ─────────────────────────────────────────

/** Trim, strip control characters (keep \n and \t), cap at 2000 chars. */
export function sanitizePrompt(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, 2000);
}

/** Exact-match a rep-picked segment id against the tenant's segment list. */
export function resolveSegmentChoice(
  raw: unknown,
  segments: Array<{ id: string }>,
): string | null {
  if (typeof raw !== "string") return null;
  const wanted = raw.trim();
  if (!wanted) return null;
  return segments.some((s) => s.id === wanted) ? wanted : null;
}

/** Parse + validate a rep-picked template id against the eligible-template ids. */
export function resolveTemplateChoice(
  raw: unknown,
  eligibleIds: ReadonlySet<number>,
): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{1,10}$/.test(trimmed)) return null;
  const id = Number(trimmed);
  return eligibleIds.has(id) ? id : null;
}

export function truncateError(msg: string): string {
  return msg.slice(0, ERROR_FIELD_MAX);
}

// ── Eligibility ───────────────────────────────────────────────────────────────

/**
 * Connections eligible for polling: status "connected", active tenant,
 * micrositeButton.enabled === true in the connection metadata, AND the
 * tenant's live plan includes the Sales Console.
 */
export async function listEligibleConnections(): Promise<EligibleConnection[]> {
  const rows = await db
    .select({
      connectionId: sfdcConnectionsTable.id,
      tenantId: sfdcConnectionsTable.tenantId,
      metadata: sfdcConnectionsTable.metadata,
    })
    .from(sfdcConnectionsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, sfdcConnectionsTable.tenantId))
    .where(and(
      eq(sfdcConnectionsTable.status, "connected"),
      eq(tenantsTable.status, "active"),
    ));
  const enabled = rows.filter(
    (r): r is typeof r & { tenantId: number } =>
      r.tenantId != null && readMicrositeButtonState(r.metadata).enabled,
  );
  const out: EligibleConnection[] = [];
  for (const r of enabled) {
    try {
      const { features } = await getTenantPlanFeatures(r.tenantId);
      if (features.salesConsole) out.push({ connectionId: r.connectionId, tenantId: r.tenantId });
    } catch (err) {
      logger.warn({ err: String(err), tenantId: r.tenantId }, "[sfdc-microsite-poller] plan lookup failed — skipping tenant");
    }
  }
  return out;
}

// ── Remote request row shape ──────────────────────────────────────────────────

interface RemoteRequest {
  Id: string;
  Account_Id__c: string | null;
  Segment_Id__c: string | null;
  Template_Id__c: string | null;
  Prompt__c: string | null;
  Status__c: string | null;
  Job_Id__c: string | null;
  SystemModstamp: string | null;
}

const REQUEST_FIELDS_SOQL =
  "Id, Account_Id__c, Segment_Id__c, Template_Id__c, Prompt__c, Status__c, Job_Id__c, SystemModstamp";

async function patchRequest(
  connectionId: number,
  requestId: string,
  fields: Record<string, unknown>,
): Promise<boolean> {
  try {
    await sfdcService.updateSObject(connectionId, REQUEST_OBJECT, requestId, fields);
    return true;
  } catch (err) {
    logger.error({ err: String(err), connectionId, requestId }, "[sfdc-microsite-poller] request PATCH failed");
    return false;
  }
}

async function failRequest(connectionId: number, requestId: string, reason: string): Promise<void> {
  await patchRequest(connectionId, requestId, {
    Status__c: REQUEST_STATUS.failed,
    Error_Message__c: truncateError(reason),
  });
}

// ── URL resolution ────────────────────────────────────────────────────────────

interface TenantHostInfo {
  /** Live URL for a published page with the given slug. */
  liveUrl: (slug: string) => string;
  /** Preview URL (review-token flow) for a draft page. */
  previewUrl: (slug: string, token: string) => string;
  /** Host passed to triggerPublishedRender. */
  requestHost: string;
}

/**
 * Request-free host resolution: microsite domain (pages served at root) →
 * custom domain / managed subdomain (pages under /lp/). Returns null when the
 * tenant has no reachable public host — the request is failed explicitly
 * rather than writing back a broken URL.
 */
export async function resolveTenantHostInfo(tenantId: number): Promise<TenantHostInfo | null> {
  const [t] = await db
    .select({
      slug: tenantsTable.slug,
      domain: tenantsTable.domain,
      micrositeDomain: tenantsTable.micrositeDomain,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  if (!t) return null;
  const canonical = canonicalTenantHost({ domain: t.domain ?? null, slug: t.slug ?? null });
  const microsite = (t.micrositeDomain ?? "").trim().toLowerCase() || null;
  if (!microsite && !canonical) return null;
  return {
    liveUrl: (slug) =>
      microsite
        ? `https://${microsite}/${encodeURIComponent(slug)}`
        : `https://${canonical}/lp/${encodeURIComponent(slug)}`,
    // Preview runs in the SaaS app shell, so it always uses the workspace
    // host (microsite domains only serve published pages).
    previewUrl: (slug, token) =>
      `https://${canonical ?? microsite}/preview/${encodeURIComponent(slug)}?reviewToken=${encodeURIComponent(token)}`,
    requestHost: microsite ?? canonical!,
  };
}

/** Mint (or reuse) a pending review token so the preview link works without a session. */
async function mintReviewToken(pageId: number): Promise<string | null> {
  try {
    const [existing] = await db
      .select({ token: lpPageReviewsTable.token })
      .from(lpPageReviewsTable)
      .where(and(eq(lpPageReviewsTable.pageId, pageId), eq(lpPageReviewsTable.status, "pending")))
      .orderBy(sql`${lpPageReviewsTable.createdAt} DESC`)
      .limit(1);
    if (existing?.token) return existing.token;
    const fresh = crypto.randomBytes(24).toString("hex");
    const [inserted] = await db
      .insert(lpPageReviewsTable)
      .values({ pageId, token: fresh, status: "pending" })
      .returning({ token: lpPageReviewsTable.token });
    return inserted?.token ?? fresh;
  } catch (err) {
    logger.warn({ err: String(err), pageId }, "[sfdc-microsite-poller] review token mint failed");
    return null;
  }
}

// ── Finalize phase ────────────────────────────────────────────────────────────

async function finalizeProcessingRequests(
  conn: EligibleConnection,
  processing: RemoteRequest[],
): Promise<void> {
  for (const req of processing) {
    try {
      await finalizeOne(conn, req);
    } catch (err) {
      logger.error(
        { err: String(err), tenantId: conn.tenantId, requestId: req.Id },
        "[sfdc-microsite-poller] finalize failed for request (non-fatal)",
      );
    }
  }
}

function isStale(req: RemoteRequest): boolean {
  const stamp = req.SystemModstamp ? Date.parse(req.SystemModstamp) : NaN;
  // Unparseable timestamp → treat as stale (fail closed rather than leaving
  // a zombie Processing row forever).
  if (Number.isNaN(stamp)) return true;
  return Date.now() - stamp > STALE_PROCESSING_MS;
}

async function finalizeOne(conn: EligibleConnection, req: RemoteRequest): Promise<void> {
  const jobId = (req.Job_Id__c ?? "").trim();
  const looksLikeJobId = /^[0-9a-f-]{36}$/i.test(jobId);

  if (!looksLikeJobId) {
    // Crash residue: claimed (Processing) but the job id PATCH never landed.
    if (isStale(req)) {
      await failRequest(conn.connectionId, req.Id, "The generation job was lost (server interrupted). Please click the button again.");
    }
    return;
  }

  const job = await getGenerationJob(jobId, conn.tenantId);
  if (!job) {
    if (isStale(req)) {
      await failRequest(conn.connectionId, req.Id, "The generation job could not be found. Please click the button again.");
    }
    return;
  }

  if (job.status === "queued" || job.status === "running") {
    if (isStale(req)) {
      await failRequest(conn.connectionId, req.Id, "The generation timed out. Please click the button again.");
    }
    return;
  }

  if (job.status === "failed") {
    await failRequest(
      conn.connectionId,
      req.Id,
      truncateError(job.error || "Microsite generation failed. Please try again."),
    );
    return;
  }

  // succeeded — job.result carries { page: { id, slug }, blocks, degradations }.
  const result = job.result as { page?: { id?: number; slug?: string } } | null;
  const pageId = result?.page?.id;
  const slug = result?.page?.slug;
  if (typeof pageId !== "number" || typeof slug !== "string" || !slug) {
    await failRequest(conn.connectionId, req.Id, "Generation finished but the page could not be located.");
    return;
  }

  const hostInfo = await resolveTenantHostInfo(conn.tenantId);
  if (!hostInfo) {
    await failRequest(conn.connectionId, req.Id, "The workspace has no public site address configured — set one in LP Studio settings and retry.");
    return;
  }

  // ── Publish policy (architect ruling) ──
  let publish = false;
  if (!(await tenantRequiresReview(conn.tenantId))) {
    const flags = await getPendingFactFlagState(conn.tenantId, pageId);
    publish = flags.ok && flags.pending === 0;
  }

  if (publish) {
    await db
      .update(lpPagesTable)
      .set({ status: "published", updatedAt: new Date(), updatedBy: "system:sfdc-microsite-button" })
      .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, conn.tenantId)));
    // Fire-and-forget prerender; never throws. Content-series notifications
    // are deliberately NOT triggered here (sales microsites aren't series
    // content).
    triggerPublishedRender({ pageId, requestHost: hostInfo.requestHost });

    const liveUrl = hostInfo.liveUrl(slug);
    // Account write-back is best-effort — a missing/renamed field must not
    // fail an otherwise-complete request.
    if (SfdcService.isValidSfdcId(req.Account_Id__c)) {
      try {
        await sfdcService.updateSObject(conn.connectionId, "Account", req.Account_Id__c, {
          [ACCOUNT_URL_FIELD]: liveUrl,
        });
      } catch (err) {
        logger.warn({ err: String(err), tenantId: conn.tenantId, requestId: req.Id }, "[sfdc-microsite-poller] Account URL write-back failed (non-fatal)");
      }
    }
    await patchRequest(conn.connectionId, req.Id, {
      Status__c: REQUEST_STATUS.complete,
      Microsite_URL__c: liveUrl,
      Error_Message__c: "",
    });
    return;
  }

  // Review required (or fact flags pending / check failed): leave the page in
  // draft, hand back a tokenized preview link. The Account field only ever
  // receives LIVE urls, so it is not written here.
  const token = await mintReviewToken(pageId);
  const previewUrl = token ? hostInfo.previewUrl(slug, token) : null;
  await patchRequest(conn.connectionId, req.Id, {
    Status__c: REQUEST_STATUS.complete,
    Microsite_URL__c: previewUrl ?? "",
    Error_Message__c: truncateError(
      "Page created as a draft awaiting review in LP Studio — the link is a preview, not the live page.",
    ),
  });
}

// ── Pickup phase ──────────────────────────────────────────────────────────────

/** SFDC-sourced generations enqueued for this tenant in the last hour. */
export async function countRecentSfdcJobs(tenantId: number): Promise<number> {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(lpGenerationJobsTable)
    .where(and(
      eq(lpGenerationJobsTable.tenantId, tenantId),
      eq(lpGenerationJobsTable.kind, "microsite"),
      gt(lpGenerationJobsTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      sql`${lpGenerationJobsTable.request} ->> 'source' = 'sfdc'`,
    ));
  return r[0]?.c ?? 0;
}

async function pickupNewRequests(
  conn: EligibleConnection,
  newRequests: RemoteRequest[],
  processingAccounts: Set<string>,
): Promise<void> {
  if (newRequests.length === 0) return;

  let budget: number;
  try {
    budget = HOURLY_CAP - (await countRecentSfdcJobs(conn.tenantId));
  } catch (err) {
    logger.error({ err: String(err), tenantId: conn.tenantId }, "[sfdc-microsite-poller] hourly-cap query failed — skipping pickup this tick");
    return;
  }
  if (budget <= 0) {
    logger.warn({ tenantId: conn.tenantId }, "[sfdc-microsite-poller] hourly cap reached — leaving New requests for a later tick");
    return;
  }

  // Load the validation sets once per tenant per tick.
  const [segments, templates] = await Promise.all([
    loadTenantSegments(conn.tenantId),
    listTemplatesForTenant(conn.tenantId, { salesMode: true, forMicrosite: true }),
  ]);
  const templateIds = new Set(templates.map((t) => t.id));

  for (const req of newRequests) {
    if (budget <= 0) break;
    try {
      const claimed = await pickupOne(conn, req, segments, templateIds, processingAccounts);
      if (claimed) budget--;
    } catch (err) {
      logger.error(
        { err: String(err), tenantId: conn.tenantId, requestId: req.Id },
        "[sfdc-microsite-poller] pickup failed for request (non-fatal)",
      );
    }
  }
}

async function pickupOne(
  conn: EligibleConnection,
  req: RemoteRequest,
  segments: Array<{ id: string }>,
  templateIds: ReadonlySet<number>,
  processingAccounts: Set<string>,
): Promise<boolean> {
  const sfdcAccountId = (req.Account_Id__c ?? "").trim();
  if (!SfdcService.isValidSfdcId(sfdcAccountId)) {
    await failRequest(conn.connectionId, req.Id, "The request has no valid Salesforce Account id.");
    return false;
  }

  // One in-flight generation per account: a second click while the first is
  // still Processing fails fast with a readable reason.
  if (processingAccounts.has(sfdcAccountId)) {
    await failRequest(conn.connectionId, req.Id, "A microsite for this account is already being generated — check back in a couple of minutes.");
    return false;
  }

  // Resolve (or pull) the local Sales Console account.
  let localAccountId: number;
  const [existing] = await db
    .select({ id: salesAccountsTable.id })
    .from(salesAccountsTable)
    .where(and(
      eq(salesAccountsTable.tenantId, conn.tenantId),
      eq(salesAccountsTable.salesforceId, sfdcAccountId),
    ))
    .limit(1);
  if (existing) {
    localAccountId = existing.id;
  } else {
    try {
      const pulled = await sfdcService.syncSingleAccount(conn.connectionId, conn.tenantId, sfdcAccountId);
      localAccountId = pulled.id;
    } catch (err) {
      await failRequest(conn.connectionId, req.Id, truncateError(`Could not load the account from Salesforce: ${err instanceof Error ? err.message : String(err)}`));
      return false;
    }
  }

  // Rep choices: unknown/blank segment or template falls back to
  // "Recommended" (freeform) rather than failing the request.
  const segmentId = resolveSegmentChoice(req.Segment_Id__c, segments);
  const templateId = resolveTemplateChoice(req.Template_Id__c, templateIds);
  const prompt = sanitizePrompt(req.Prompt__c);

  // ── Claim FIRST (architect ruling): Processing before enqueue, so a crash
  // can never double-enqueue. Crash residue (Processing without Job_Id__c) is
  // failed by the stale sweep.
  const claimed = await patchRequest(conn.connectionId, req.Id, {
    Status__c: REQUEST_STATUS.processing,
    Error_Message__c: "",
  });
  if (!claimed) return false;
  processingAccounts.add(sfdcAccountId);

  const jobRequest: Record<string, unknown> = {
    accountId: localAccountId,
    source: "sfdc",
    sfdcRequestId: req.Id,
    ...(segmentId ? { segmentId } : {}),
    ...(templateId ? { templateId } : {}),
    ...(prompt ? { prompt } : {}),
  };

  let jobId: string;
  try {
    jobId = await createGenerationJob({ tenantId: conn.tenantId, kind: "microsite", request: jobRequest });
    startGenerationJob(jobId, conn.tenantId, "microsite", jobRequest);
  } catch (err) {
    await failRequest(conn.connectionId, req.Id, truncateError(`Could not start the generation: ${err instanceof Error ? err.message : String(err)}`));
    return false;
  }

  await patchRequest(conn.connectionId, req.Id, { Job_Id__c: jobId });

  // Spec step 6: record the trigger as account activity in LP Studio.
  // Best-effort — a signal write failure must never fail the request itself.
  try {
    await db.insert(salesSignalsTable).values({
      tenantId: conn.tenantId,
      accountId: localAccountId,
      type: "microsite_requested",
      source: "Salesforce microsite button",
      metadata: { sfdcRequestId: req.Id, jobId, ...(segmentId ? { segmentId } : {}), ...(templateId ? { templateId } : {}) },
    });
  } catch (err) {
    logger.warn(
      { err: String(err), tenantId: conn.tenantId, requestId: req.Id },
      "[sfdc-microsite-poller] account-activity signal write failed (non-fatal)",
    );
  }

  logger.info(
    { tenantId: conn.tenantId, requestId: req.Id, jobId, accountId: localAccountId, segmentId, templateId },
    "[sfdc-microsite-poller] request claimed and job enqueued",
  );
  return true;
}

// ── Per-tenant tick ───────────────────────────────────────────────────────────

export async function runTenantTick(conn: EligibleConnection): Promise<void> {
  // One SOQL round-trip for both phases.
  const rows = await sfdcService.queryRecords<RemoteRequest>(
    conn.connectionId,
    `SELECT ${REQUEST_FIELDS_SOQL} FROM ${REQUEST_OBJECT} WHERE Status__c IN ('${REQUEST_STATUS.new}', '${REQUEST_STATUS.processing}') ORDER BY CreatedDate ASC LIMIT 200`,
  );
  const processing = rows.filter((r) => r.Status__c === REQUEST_STATUS.processing);
  const fresh = rows.filter((r) => r.Status__c === REQUEST_STATUS.new).slice(0, PICKUP_LIMIT);

  await finalizeProcessingRequests(conn, processing);

  // Accounts still generating after finalize — used by pickup's dedupe. Rebuilt
  // from the pre-finalize snapshot minus nothing (finalize PATCHes terminal
  // states remotely, but a conservative superset only means a duplicate click
  // fails fast this tick, which is the desired behavior anyway).
  const processingAccounts = new Set(
    processing
      .map((r) => (r.Account_Id__c ?? "").trim())
      .filter((id) => SfdcService.isValidSfdcId(id)),
  );

  await pickupNewRequests(conn, fresh, processingAccounts);

  // Keep the Screen Flow dropdowns fresh (hourly, piggybacked on the poll).
  try {
    const [row] = await db
      .select({ metadata: sfdcConnectionsTable.metadata })
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.id, conn.connectionId))
      .limit(1);
    const state = readMicrositeButtonState(row?.metadata);
    const last = state.lastChoicesSyncAt ? Date.parse(state.lastChoicesSyncAt) : NaN;
    if (Number.isNaN(last) || Date.now() - last > CHOICES_SYNC_STALE_MS) {
      await syncMicrositeChoices(conn.connectionId, conn.tenantId);
    }
  } catch (err) {
    logger.warn({ err: String(err), tenantId: conn.tenantId }, "[sfdc-microsite-poller] choice sync failed (non-fatal)");
  }

  await writeMicrositeButtonState(conn.connectionId, { lastPollAt: new Date().toISOString(), lastError: null })
    .catch(() => {});
}

// ── Sweep + scheduler ─────────────────────────────────────────────────────────

export async function runSfdcMicrositePollForConnection(conn: EligibleConnection): Promise<"ran" | "skipped"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1, $2) AS locked",
      [ADVISORY_LOCK_CLASSID, conn.tenantId],
    );
    if (!lock.rows[0]?.locked) {
      await client.query("ROLLBACK");
      return "skipped";
    }
    try {
      await runTenantTick(conn);
    } finally {
      await client.query("COMMIT").catch((err) =>
        logger.warn({ err, tenantId: conn.tenantId }, "[sfdc-microsite-poller] commit (lock release) failed"),
      );
    }
    return "ran";
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    logger.error(
      { err: String(err), tenantId: conn.tenantId, connectionId: conn.connectionId },
      "[sfdc-microsite-poller] tenant tick failed (non-fatal)",
    );
    await writeMicrositeButtonState(conn.connectionId, {
      lastError: truncateError(err instanceof Error ? err.message : String(err)),
    }).catch(() => {});
    return "skipped";
  } finally {
    client.release();
  }
}

export async function runSfdcMicrositePoll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    let conns: EligibleConnection[];
    try {
      conns = await listEligibleConnections();
    } catch (err) {
      logger.error({ err: String(err) }, "[sfdc-microsite-poller] eligibility query failed (non-fatal)");
      return;
    }
    for (const c of conns) {
      await runSfdcMicrositePollForConnection(c);
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

/**
 * Boot-time scheduler. Production-only unless SFDC_MICROSITE_POLLER_ENABLED=1
 * (dev/e2e opt-in). First sweep deferred off the cold-start path.
 */
export function startSfdcMicrositeRequestPoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production" && process.env.SFDC_MICROSITE_POLLER_ENABLED !== "1") return null;
  const handle = setInterval(() => {
    void runSfdcMicrositePoll().catch((err) => logger.error({ err: String(err) }, "[sfdc-microsite-poller] interval run failed"));
  }, SFDC_MICROSITE_POLL_INTERVAL_MS);
  handle.unref();
  setTimeout(() => {
    void runSfdcMicrositePoll().catch((err) => logger.error({ err: String(err) }, "[sfdc-microsite-poller] boot run failed"));
  }, SFDC_MICROSITE_BOOT_DELAY_MS).unref();
  return handle;
}
