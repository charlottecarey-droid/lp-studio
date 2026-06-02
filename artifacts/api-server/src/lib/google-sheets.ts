import { google } from "googleapis";

export interface SheetsConfig {
  sheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
  tabName?: string;
}

export interface LeadRow {
  submittedAt: string;
  pageTitle: string;
  pageSlug: string;
  variantName?: string;
  fields: Record<string, unknown>;
}

function makeAuth(config: SheetsConfig) {
  const key = config.privateKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email: config.serviceAccountEmail,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function testSheetsConnection(config: SheetsConfig): Promise<{ ok: boolean; title?: string; error?: string }> {
  try {
    const auth = makeAuth(config);
    const sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: config.sheetId });
    return { ok: true, title: meta.data.properties?.title ?? "Untitled" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export interface PersonalizedLinkRow {
  fullName: string;
  email: string;
  company: string;
  title: string;
  link: string;
}

/**
 * Append personalized-link rows to a tab in the connected Google Sheet.
 * Creates the tab + header row on first use, then appends one row per contact.
 * Used by the no-email "Generate personalized links only" export flow.
 */
export async function appendPersonalizedLinkRows(
  config: SheetsConfig,
  args: { pageTitle: string; rows: PersonalizedLinkRow[] },
): Promise<{ appended: number }> {
  if (args.rows.length === 0) return { appended: 0 };
  const auth = makeAuth(config);
  const sheets = google.sheets({ version: "v4", auth });
  const tabName = config.tabName || "Personalized Links";
  const spreadsheetId = config.sheetId;

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets ?? [];
  const tabExists = existingSheets.some(s => s.properties?.title === tabName);

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  const range = `'${tabName}'!A1`;
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const existingRows = existing.data.values ?? [];

  if (existingRows.length === 0) {
    const headers = ["Generated", "Page", "Name", "Email", "Company", "Title", "Personalized Link"];
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  const generatedAt = new Date().toISOString();
  const values = args.rows.map(r => [
    generatedAt,
    args.pageTitle,
    r.fullName,
    r.email,
    r.company,
    r.title,
    r.link,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  return { appended: values.length };
}

export async function appendLeadRow(config: SheetsConfig, lead: LeadRow): Promise<void> {
  const auth = makeAuth(config);
  const sheets = google.sheets({ version: "v4", auth });
  const tabName = config.tabName || "Leads";
  const spreadsheetId = config.sheetId;

  const fieldKeys = Object.keys(lead.fields).filter(k => !k.startsWith("_"));

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets ?? [];
  const tabExists = existingSheets.some(s => s.properties?.title === tabName);

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  const range = `'${tabName}'!A1`;
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const existingRows = existing.data.values ?? [];

  if (existingRows.length === 0) {
    const headers = ["Timestamp", "Page", "Slug", "Variant", ...fieldKeys];
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  const row = [
    lead.submittedAt,
    lead.pageTitle,
    lead.pageSlug,
    lead.variantName ?? "",
    ...fieldKeys.map(k => String(lead.fields[k] ?? "")),
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}
