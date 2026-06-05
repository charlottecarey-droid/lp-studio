import { createHmac } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { BuildLinkRowsResult, LinkExportRow } from "./linkExport";
import { appendPersonalizedLinkRows, type SheetsConfig } from "./google-sheets";
import { syncLinksToMarketoStaticList, type MarketoConfig } from "./notifications";
import { decryptConfigCredentials } from "./encryption";
import { sfdcService } from "./sfdc-service";

/**
 * Pluggable export-destination abstraction.
 *
 * The audience + personalized links are built ONCE into a normalized
 * `LinkExportRow[]` (see linkExport.ts), then handed to whichever destination
 * the user selected. Each destination implements the same interface, and the
 * wizard renders the available destinations from `listDestinations()` rather
 * than hardcoding a button per destination. Adding a future destination (e.g.
 * Clay) is a single new registration in `DESTINATIONS` below — no route,
 * row-building, or wizard changes required.
 */

/** A delivery either streams a file back to the browser or returns a status message. */
export type ExportDeliveryResult =
  | { kind: "file"; filename: string; contentType: string; body: string; message: string }
  | { kind: "message"; message: string };

export interface DeliverArgs {
  tenantId: number;
  build: BuildLinkRowsResult;
  /** Free-form per-destination options collected by the wizard (e.g. Marketo list id). */
  options: Record<string, unknown>;
}

export interface ExportDestination {
  id: string;
  displayName: string;
  description: string;
  /** Whether result of `deliver` is a downloadable file or an in-app status message. */
  resultType: "file" | "message";
  /**
   * False when the destination exists on the homepage promise but isn't shippable
   * yet (e.g. no integration built). Surfaced to the UI as a "coming soon" gate so
   * the picker honestly mirrors what's named on the marketing site. Defaults true.
   */
  available?: boolean;
  /** In-app path where the tenant connects this destination (shown in the gate hint). */
  setupPath?: string;
  /** Optional extra inputs the wizard should collect before delivering. */
  options?: Array<{ key: string; label: string; placeholder?: string; required?: boolean }>;
  /** True when this destination can run for the tenant (e.g. integration connected). */
  isConfigured(tenantId: number): Promise<boolean>;
  deliver(args: DeliverArgs): Promise<ExportDeliveryResult>;
}

// ─── Shared integration reader ──────────────────────────────────────────────
// Returns DECRYPTED config so isConfigured() + the deliver() push paths read
// the live secret. Legacy plaintext values pass through unchanged.
async function getIntegration(provider: string, tenantId: number): Promise<{ config: unknown; enabled: boolean } | null> {
  const rows = await db.execute(sql`
    SELECT config, enabled FROM lp_integrations WHERE provider = ${provider} AND tenant_id = ${tenantId}
  `);
  const row = (rows.rows[0] as { config: unknown; enabled: boolean } | undefined) ?? null;
  if (!row) return null;
  const config =
    row.config && typeof row.config === "object"
      ? decryptConfigCredentials(provider, row.config as Record<string, unknown>)
      : row.config;
  return { config, enabled: row.enabled };
}

// ─── Outbound webhook helpers ───────────────────────────────────────────────
interface WebhookConfig {
  url: string;
  signingSecret?: string;
}

/**
 * Validate a tenant-supplied webhook URL before we POST to it. Even though the
 * URL is set by a workspace admin, an outbound fetch to an attacker-influenced
 * address is an SSRF surface, so we require https and reject loopback / private
 * / link-local hosts. The actual fetch additionally uses redirect:"manual" so a
 * 3xx can't bounce us onto an internal host after this check.
 */
export function assertPublicHttpsUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Webhook URL is not a valid URL.");
  }
  if (u.protocol !== "https:") throw new Error("Webhook URL must use https://.");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isPrivate =
    host === "localhost" || host.endsWith(".localhost") ||
    host.endsWith(".local") || host.endsWith(".internal") ||
    host === "0.0.0.0" || host === "::1" || host === "::" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^::ffff:127\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe80:/.test(host);
  if (isPrivate) throw new Error("Webhook URL must point to a public host, not a private/loopback address.");
  return u;
}

// ─── CSV helpers ────────────────────────────────────────────────────────────
function csvCell(value: string): string {
  // Quote when the cell contains a delimiter, quote, or newline; escape quotes.
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function rowsToCsv(rows: LinkExportRow[]): string {
  const header = ["First Name", "Last Name", "Email", "Company", "Title", "Personalized Link"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([r.firstName, r.lastName, r.email, r.company, r.title, r.link].map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

function safeFilenameBase(pageSlug: string): string {
  const base = (pageSlug || "personalized-links").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return base || "personalized-links";
}

// ─── CSV destination ────────────────────────────────────────────────────────
const csvDestination: ExportDestination = {
  id: "csv",
  displayName: "Download CSV",
  description: "Download a spreadsheet of contacts and their personalized links.",
  resultType: "file",
  async isConfigured() {
    return true; // no integration required
  },
  async deliver({ build }) {
    const body = rowsToCsv(build.rows);
    return {
      kind: "file",
      filename: `${safeFilenameBase(build.pageSlug)}-links.csv`,
      contentType: "text/csv; charset=utf-8",
      body,
      message: `Exported ${build.rows.length} personalized link${build.rows.length === 1 ? "" : "s"} to CSV.`,
    };
  },
};

// ─── Google Sheet destination ───────────────────────────────────────────────
const googleSheetDestination: ExportDestination = {
  id: "google_sheets",
  displayName: "Send to Google Sheet",
  description: "Append a row per contact to your connected Google Sheet.",
  resultType: "message",
  async isConfigured(tenantId) {
    const row = await getIntegration("google_sheets", tenantId);
    if (!row || !row.enabled) return false;
    const cfg = row.config as Partial<SheetsConfig> | null;
    return !!(cfg?.sheetId && cfg?.serviceAccountEmail && cfg?.privateKey);
  },
  async deliver({ tenantId, build }) {
    const row = await getIntegration("google_sheets", tenantId);
    if (!row || !row.enabled) throw new Error("Google Sheets is not connected for this workspace.");
    const cfg = row.config as SheetsConfig;
    const { appended } = await appendPersonalizedLinkRows(cfg, {
      pageTitle: build.pageTitle,
      rows: build.rows.map(r => ({
        fullName: r.fullName,
        email: r.email,
        company: r.company,
        title: r.title,
        link: r.link,
      })),
    });
    return { kind: "message", message: `Added ${appended} personalized link${appended === 1 ? "" : "s"} to your Google Sheet.` };
  },
};

// ─── Marketo static-list destination ────────────────────────────────────────
const marketoDestination: ExportDestination = {
  id: "marketo",
  displayName: "Push to Marketo static list",
  description: "Create/update each contact in Marketo, store the link on a field, and add them to a static list.",
  resultType: "message",
  options: [
    { key: "listId", label: "Marketo static list ID", placeholder: "e.g. 1042", required: true },
    { key: "linkFieldName", label: "Marketo field for the link (REST API name)", placeholder: "e.g. lpMicrositeUrl", required: true },
  ],
  async isConfigured(tenantId) {
    const row = await getIntegration("marketo", tenantId);
    if (!row || !row.enabled) return false;
    const cfg = row.config as Partial<MarketoConfig> | null;
    return !!(cfg?.munchkinId && cfg?.clientId && cfg?.clientSecret);
  },
  async deliver({ tenantId, build, options }) {
    const row = await getIntegration("marketo", tenantId);
    if (!row || !row.enabled) throw new Error("Marketo is not connected for this workspace.");
    const cfg = row.config as MarketoConfig;
    const listId = String(options.listId ?? "").trim();
    const linkFieldName = String(options.linkFieldName ?? "").trim();
    if (!listId) throw new Error("Enter the Marketo static list ID to push to.");
    if (!linkFieldName) throw new Error("Enter the Marketo field that should store the personalized link.");

    const result = await syncLinksToMarketoStaticList(cfg, {
      listId,
      linkFieldName,
      rows: build.rows.map(r => ({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        company: r.company,
        link: r.link,
      })),
    });

    let message = `Synced ${result.created} contact${result.created === 1 ? "" : "s"} to Marketo and added ${result.addedToList} to list ${listId}.`;
    if (result.failed > 0) {
      message += ` ${result.failed} could not be synced${result.reasons.length ? `: ${result.reasons.join("; ")}` : "."}`;
    }
    return { kind: "message", message };
  },
};

// ─── Salesforce destination ─────────────────────────────────────────────────
// Writes each contact's personalized link onto a field of their synced
// Salesforce Contact record, via the existing Salesforce SYNC connection
// (sfdc_connections / OAuth) that already pulls accounts + contacts. Contacts
// that were never synced (no Salesforce id) are skipped and reported.
const salesforceDestination: ExportDestination = {
  id: "salesforce",
  displayName: "Push to Salesforce",
  description: "Write each contact's personalized link onto a field of their synced Salesforce Contact.",
  resultType: "message",
  setupPath: "/sales/sfdc",
  options: [
    { key: "fieldName", label: "Salesforce Contact field (API name)", placeholder: "e.g. LP_Microsite_URL__c", required: true },
  ],
  async isConfigured(tenantId) {
    const conn = await sfdcService.getActiveConnection(tenantId);
    return !!conn;
  },
  async deliver({ tenantId, build, options }) {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) throw new Error("Salesforce is not connected for this workspace. Connect it under Sales → Salesforce.");
    const fieldName = String(options.fieldName ?? "").trim();
    if (!fieldName) throw new Error("Enter the Salesforce Contact field that should store the personalized link.");

    let updated = 0;
    let failed = 0;
    let skippedNoSfid = 0;
    const withSfid = build.rows.filter(r => r.salesforceId);
    skippedNoSfid = build.rows.length - withSfid.length;

    // Bounded concurrency — each update is a Salesforce PATCH round-trip.
    let next = 0;
    async function worker(): Promise<void> {
      for (;;) {
        const i = next++;
        if (i >= withSfid.length) return;
        const r = withSfid[i];
        try {
          const ok = await sfdcService.updateContactField(conn!.id, r.salesforceId!, { [fieldName]: r.link });
          if (ok) updated++; else failed++;
        } catch (err) {
          failed++;
          logger.error({ err, tenantId, contactId: r.contactId }, "salesforce link push failed");
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, withSfid.length) }, () => worker()));

    let message = `Wrote the personalized link to ${updated} Salesforce Contact${updated === 1 ? "" : "s"} on field ${fieldName}.`;
    if (failed > 0) message += ` ${failed} could not be updated.`;
    if (skippedNoSfid > 0) message += ` ${skippedNoSfid} skipped (not synced from Salesforce).`;
    return { kind: "message", message };
  },
};

// ─── Generic webhook destination ────────────────────────────────────────────
// POSTs the built rows as a single signed JSON payload to a tenant-configured
// HTTPS endpoint — the "or any webhook" half of the homepage promise. The body
// is HMAC-SHA256 signed (when a signing secret is set) so the receiver can
// verify authenticity.
const webhookDestination: ExportDestination = {
  id: "webhook",
  displayName: "Send to a webhook",
  description: "POST every contact and their personalized link as one signed JSON payload to your HTTPS endpoint.",
  resultType: "message",
  setupPath: "/integrations",
  async isConfigured(tenantId) {
    const row = await getIntegration("webhook", tenantId);
    if (!row || !row.enabled) return false;
    const cfg = row.config as Partial<WebhookConfig> | null;
    if (!cfg?.url) return false;
    try {
      assertPublicHttpsUrl(cfg.url);
      return true;
    } catch {
      return false;
    }
  },
  async deliver({ tenantId, build }) {
    const row = await getIntegration("webhook", tenantId);
    if (!row || !row.enabled) throw new Error("No webhook is configured for this workspace.");
    const cfg = row.config as WebhookConfig;
    const url = assertPublicHttpsUrl(String(cfg.url ?? ""));

    const payload = {
      event: "personalized_links.export",
      sentAt: new Date().toISOString(),
      page: { id: build.pageId, title: build.pageTitle, slug: build.pageSlug },
      count: build.rows.length,
      rows: build.rows.map(r => ({
        contactId: r.contactId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        company: r.company,
        title: r.title,
        link: r.link,
        salesforceId: r.salesforceId,
      })),
    };
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "LPStudio-Webhook/1",
    };
    if (cfg.signingSecret) {
      const sig = createHmac("sha256", cfg.signingSecret).update(body).digest("hex");
      headers["X-LPStudio-Signature"] = `sha256=${sig}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
      // Reject redirects (manual mode surfaces them as opaqueredirect / 3xx) so a
      // crafted endpoint can't bounce us to an internal host post-validation.
      if (resp.type === "opaqueredirect" || (resp.status >= 300 && resp.status < 400)) {
        throw new Error("Webhook endpoint returned a redirect, which is not allowed.");
      }
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Webhook responded ${resp.status}${text ? `: ${text.slice(0, 200)}` : ""}.`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Webhook request timed out after 15s.");
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeout);
    }

    return { kind: "message", message: `Posted ${build.rows.length} personalized link${build.rows.length === 1 ? "" : "s"} to your webhook.` };
  },
};

// ─── HubSpot destination (gated) ────────────────────────────────────────────
// Named on the homepage but no HubSpot integration is built yet, so it's
// surfaced as an honest "coming soon" gate rather than a button that can never
// work. Flip `available` to true and implement isConfigured/deliver when the
// HubSpot integration ships.
const hubspotDestination: ExportDestination = {
  id: "hubspot",
  displayName: "Push to HubSpot",
  description: "Sync each contact and their personalized link into HubSpot.",
  resultType: "message",
  available: false,
  async isConfigured() {
    return false;
  },
  async deliver() {
    throw new Error("HubSpot export isn't available yet.");
  },
};

// ─── Registry ───────────────────────────────────────────────────────────────
// To add a destination, implement ExportDestination and add it here. Nothing
// else changes — the route and wizard discover it automatically.
const DESTINATIONS: ExportDestination[] = [
  csvDestination,
  googleSheetDestination,
  marketoDestination,
  salesforceDestination,
  hubspotDestination,
  webhookDestination,
];

export function getDestination(id: string): ExportDestination | undefined {
  return DESTINATIONS.find(d => d.id === id);
}

export interface DestinationSummary {
  id: string;
  displayName: string;
  description: string;
  resultType: "file" | "message";
  /** False = named on the homepage but not shippable yet ("coming soon" gate). */
  available: boolean;
  configured: boolean;
  /** In-app path where the tenant connects this destination, when applicable. */
  setupPath?: string;
  options: Array<{ key: string; label: string; placeholder?: string; required?: boolean }>;
}

/** Resolve every destination's display info + per-tenant configured state. */
export async function listDestinations(tenantId: number): Promise<DestinationSummary[]> {
  return Promise.all(DESTINATIONS.map(async d => {
    const available = d.available !== false;
    let configured = false;
    // Skip the per-tenant connection probe for not-yet-available destinations —
    // they can never be configured, so there's nothing to check.
    if (available) {
      try {
        configured = await d.isConfigured(tenantId);
      } catch (err) {
        logger.error({ err, destination: d.id, tenantId }, "destination isConfigured check failed");
      }
    }
    return {
      id: d.id,
      displayName: d.displayName,
      description: d.description,
      resultType: d.resultType,
      available,
      configured,
      setupPath: d.setupPath,
      options: d.options ?? [],
    };
  }));
}
