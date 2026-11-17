/**
 * Google Sheets for partner rooms (the signed-accounts tab, each room's
 * practice list, the log of rooms created).
 *
 * Signs in the same way lead sync does: as the workspace's Google service
 * account (Settings → Integrations → Google Sheets). A sheet only has to be
 * shared with that address. A workspace with no service account falls back to
 * the Replit Google Sheets connection.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { google } from "googleapis";
import { getIntegration } from "./lpIntegrationsStore";
import { logger } from "./logger";

export interface SheetsResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  /** Who the sheet must be shared with: the service account's address, or a description of the fallback connection. */
  sharedWith: string;
}

const FALLBACK_ACCOUNT = "the Google account connected to LP Studio";
const tokens = new Map<string, { token: string; expires: number }>();
let connectors: ReplitConnectors | null = null;

async function serviceAccount(tenantId: number): Promise<{ email: string; key: string } | null> {
  const row = await getIntegration("google_sheets", tenantId).catch(() => null);
  const cfg = (row?.config ?? {}) as { serviceAccountEmail?: unknown; privateKey?: unknown };
  const email = typeof cfg.serviceAccountEmail === "string" ? cfg.serviceAccountEmail.trim() : "";
  const key = typeof cfg.privateKey === "string" ? cfg.privateKey.replace(/\\n/g, "\n") : "";
  return email && key ? { email, key } : null;
}

/** The address a sheet must be shared with for this workspace, or null when it has no service account. */
export async function roomSheetsAccount(tenantId: number): Promise<string | null> {
  return (await serviceAccount(tenantId))?.email ?? null;
}

async function accessToken(account: { email: string; key: string }): Promise<string | null> {
  const cached = tokens.get(account.email);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const auth = new google.auth.JWT({ email: account.email, key: account.key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const { token } = await auth.getAccessToken();
  if (!token) return null;
  tokens.set(account.email, { token, expires: Date.now() + 45 * 60_000 });
  return token;
}

/** One Sheets API call (`path` starts at /v4/…) as this workspace. Never throws for a refused sign-in: that comes back as a 401. */
export async function roomSheetsRequest(tenantId: number, path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<SheetsResponse> {
  const account = await serviceAccount(tenantId);
  if (!account) {
    connectors ??= new ReplitConnectors();
    const r = await connectors.proxy("google-sheet", path, { method: "GET", ...init });
    return { ok: r.ok, status: r.status, json: () => r.json(), text: () => r.text(), sharedWith: FALLBACK_ACCOUNT };
  }
  const refused = (): SheetsResponse => ({ ok: false, status: 401, json: async () => ({}), text: async () => "", sharedWith: account.email });
  let token: string | null;
  try {
    token = await accessToken(account);
  } catch (err) {
    logger.warn({ err, tenantId }, "room sheets: the service account could not sign in");
    return refused();
  }
  if (!token) return refused();
  const r = await fetch(`https://sheets.googleapis.com${path}`, { method: init.method ?? "GET", headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` }, body: init.body });
  if (r.status === 401) tokens.delete(account.email);
  return { ok: r.ok, status: r.status, json: () => r.json(), text: () => r.text(), sharedWith: account.email };
}

/** What to tell a person when a sheet read or write is refused. */
export function sheetProblem(status: number, sharedWith: string, tab = "", need: "view" | "edit" = "view"): string {
  if (status === 400 && tab) return `The workbook has no tab named “${tab}”. Check the spelling and spaces.`;
  if (status === 401) return sharedWith === FALLBACK_ACCOUNT ? "LP Studio isn't signed in to Google Sheets. Connect a Google service account under Settings → Integrations → Google Sheets." : "The Google service account couldn't sign in. Check its key under Settings → Integrations → Google Sheets.";
  if (status === 403 || status === 404) return `Couldn't open the sheet. Share it with ${sharedWith}${need === "edit" ? " as an Editor" : ""}, and check the tab name.`;
  return `Google Sheets returned an error (${status}).`;
}

/** For tests. */
export function __resetRoomSheets(): void {
  tokens.clear();
  connectors = null;
}
