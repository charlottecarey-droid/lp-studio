import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { BuildLinkRowsResult, LinkExportRow } from "./linkExport";
import { appendPersonalizedLinkRows, type SheetsConfig } from "./google-sheets";
import { syncLinksToMarketoStaticList, type MarketoConfig } from "./notifications";
import { decryptConfigCredentials } from "./encryption";

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

// ─── Registry ───────────────────────────────────────────────────────────────
// To add a destination, implement ExportDestination and add it here. Nothing
// else changes — the route and wizard discover it automatically.
const DESTINATIONS: ExportDestination[] = [
  csvDestination,
  googleSheetDestination,
  marketoDestination,
];

export function getDestination(id: string): ExportDestination | undefined {
  return DESTINATIONS.find(d => d.id === id);
}

export interface DestinationSummary {
  id: string;
  displayName: string;
  description: string;
  resultType: "file" | "message";
  configured: boolean;
  options: Array<{ key: string; label: string; placeholder?: string; required?: boolean }>;
}

/** Resolve every destination's display info + per-tenant configured state. */
export async function listDestinations(tenantId: number): Promise<DestinationSummary[]> {
  return Promise.all(DESTINATIONS.map(async d => {
    let configured = false;
    try {
      configured = await d.isConfigured(tenantId);
    } catch (err) {
      logger.error({ err, destination: d.id, tenantId }, "destination isConfigured check failed");
    }
    return {
      id: d.id,
      displayName: d.displayName,
      description: d.description,
      resultType: d.resultType,
      configured,
      options: d.options ?? [],
    };
  }));
}
