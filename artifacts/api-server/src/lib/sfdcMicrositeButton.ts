import { db, sfdcConnectionsTable, lpBrandSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { sfdcService, SfdcService } from "./sfdc-service";
import { listTemplatesForTenant } from "./templateListing";

// ─── Salesforce "Create Microsite" button (Task #1448) ───────────────────────
//
// A rep clicks a button (Screen Flow) on the Account page in Salesforce; the
// Flow creates an LP_Studio_Microsite_Request__c record. LP Studio polls for
// New requests via the existing per-tenant OAuth connection (pull model — no
// new credentials, works behind the org's firewall), enqueues the existing
// microsite generation job, and writes the finished URL back to the Account.
//
// This module owns:
//   - the custom-object/field API-name contract shared with the org,
//   - feature state stored in sfdc_connections.metadata.micrositeButton
//     (no local schema migration needed),
//   - idempotent auto-provisioning of the objects/fields/permission set via
//     the Tooling + REST APIs (falls back to "manual" with a list of what the
//     admin still has to create),
//   - syncing the segment/template dropdown choices into LP_Studio_Choice__c
//     so the Screen Flow can render brand-accurate pickers.

// ── API-name contract ─────────────────────────────────────────────────────────

export const REQUEST_OBJECT = "LP_Studio_Microsite_Request__c";
export const CHOICE_OBJECT = "LP_Studio_Choice__c";
export const ACCOUNT_URL_FIELD = "LP_Studio_Microsite_URL__c";
export const PERMISSION_SET_NAME = "LP_Studio_Microsites";
export const PERMISSION_SET_LABEL = "LP Studio Microsites";

export const REQUEST_STATUS = {
  new: "New",
  processing: "Processing",
  complete: "Complete",
  failed: "Failed",
} as const;

interface FieldSpec {
  name: string;
  metadata: Record<string, unknown>;
}

// Status__c is deliberately a plain Text field (not a Picklist) — picklist
// creation via the Tooling API needs valueSet payloads that fail on many org
// configs, and the poller treats the value as an exact string anyway.
// All fields are required:false — FieldPermissions rows cannot be created for
// required fields, which would break the permission-set grant below.
const REQUEST_FIELDS: FieldSpec[] = [
  { name: "Account_Id__c", metadata: { type: "Text", label: "Account Id", length: 18, required: false } },
  { name: "Segment_Id__c", metadata: { type: "Text", label: "Segment Id", length: 255, required: false } },
  { name: "Template_Id__c", metadata: { type: "Text", label: "Template Id", length: 255, required: false } },
  { name: "Prompt__c", metadata: { type: "LongTextArea", label: "Prompt", length: 4000, visibleLines: 5, required: false } },
  { name: "Status__c", metadata: { type: "Text", label: "Status", length: 32, required: false } },
  { name: "Job_Id__c", metadata: { type: "Text", label: "Job Id", length: 64, required: false } },
  { name: "Microsite_URL__c", metadata: { type: "Url", label: "Microsite URL", required: false } },
  { name: "Error_Message__c", metadata: { type: "Text", label: "Error Message", length: 255, required: false } },
];

const CHOICE_FIELDS: FieldSpec[] = [
  { name: "Type__c", metadata: { type: "Text", label: "Type", length: 32, required: false } },
  { name: "Choice_Id__c", metadata: { type: "Text", label: "Choice Id", length: 255, required: false } },
  { name: "Label__c", metadata: { type: "Text", label: "Label", length: 255, required: false } },
  { name: "Sort_Order__c", metadata: { type: "Number", label: "Sort Order", precision: 9, scale: 0, required: false } },
  { name: "Active__c", metadata: { type: "Checkbox", label: "Active", defaultValue: "true" } },
];

const CUSTOM_OBJECTS: Array<{ apiName: string; label: string; pluralLabel: string; fields: FieldSpec[] }> = [
  {
    apiName: REQUEST_OBJECT,
    label: "LP Studio Microsite Request",
    pluralLabel: "LP Studio Microsite Requests",
    fields: REQUEST_FIELDS,
  },
  {
    apiName: CHOICE_OBJECT,
    label: "LP Studio Choice",
    pluralLabel: "LP Studio Choices",
    fields: CHOICE_FIELDS,
  },
];

// ── Feature state in sfdc_connections.metadata ────────────────────────────────

export type ProvisionStatus = "unprovisioned" | "provisioned" | "manual";

export interface MicrositeButtonState {
  enabled: boolean;
  provisionStatus: ProvisionStatus;
  /** Human-readable list of pieces the org admin still needs to create. */
  provisionProblems: string[];
  lastProvisionAt: string | null;
  lastChoicesSyncAt: string | null;
  lastPollAt: string | null;
  lastError: string | null;
}

const DEFAULT_STATE: MicrositeButtonState = {
  enabled: false,
  provisionStatus: "unprovisioned",
  provisionProblems: [],
  lastProvisionAt: null,
  lastChoicesSyncAt: null,
  lastPollAt: null,
  lastError: null,
};

export function readMicrositeButtonState(metadata: unknown): MicrositeButtonState {
  const raw = (metadata as { micrositeButton?: Partial<MicrositeButtonState> } | null)?.micrositeButton;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
  return {
    enabled: raw.enabled === true,
    provisionStatus:
      raw.provisionStatus === "provisioned" || raw.provisionStatus === "manual"
        ? raw.provisionStatus
        : "unprovisioned",
    provisionProblems: Array.isArray(raw.provisionProblems)
      ? raw.provisionProblems.filter((p): p is string => typeof p === "string")
      : [],
    lastProvisionAt: typeof raw.lastProvisionAt === "string" ? raw.lastProvisionAt : null,
    lastChoicesSyncAt: typeof raw.lastChoicesSyncAt === "string" ? raw.lastChoicesSyncAt : null,
    lastPollAt: typeof raw.lastPollAt === "string" ? raw.lastPollAt : null,
    lastError: typeof raw.lastError === "string" ? raw.lastError : null,
  };
}

/**
 * Read-modify-write the micrositeButton slice of the connection's metadata
 * jsonb. Other metadata keys are preserved. Returns the new state.
 */
export async function writeMicrositeButtonState(
  connectionId: number,
  patch: Partial<MicrositeButtonState>,
): Promise<MicrositeButtonState> {
  const [row] = await db
    .select({ metadata: sfdcConnectionsTable.metadata })
    .from(sfdcConnectionsTable)
    .where(eq(sfdcConnectionsTable.id, connectionId))
    .limit(1);
  if (!row) throw new Error(`SFDC connection ${connectionId} not found`);
  const current = readMicrositeButtonState(row.metadata);
  const next: MicrositeButtonState = { ...current, ...patch };
  const metadata = {
    ...(row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}),
    micrositeButton: next,
  };
  await db
    .update(sfdcConnectionsTable)
    .set({ metadata })
    .where(eq(sfdcConnectionsTable.id, connectionId));
  return next;
}

// ── Provisioning ──────────────────────────────────────────────────────────────

/** "Already exists" Tooling/REST errors mean a previous run created the piece — treat as success. */
function isAlreadyExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /DUPLICATE_DEVELOPER_NAME|DUPLICATE_VALUE|already exists|duplicate value found/i.test(msg);
}

function shortErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 300);
}

/**
 * Escape a value for embedding in a single-quoted SOQL string literal. Only
 * used for OUR OWN constants (permission set name, object API names) — record
 * ids from Salesforce are validated to the strict alphanumeric shape instead.
 */
function soqlQuote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * Idempotently create the custom objects, fields, Account URL field, and the
 * permission set that grants access to them. Assigns the permission set to
 * the connected integration user (reps must be assigned by the org admin —
 * the Screen Flow runs in the REP's context, which the settings UI
 * instructions call out).
 *
 * Never throws for individual pieces: every failure is collected into
 * `problems` and the overall status becomes "manual" so the settings UI can
 * show exactly what the org admin still needs to create by hand.
 */
export async function provisionMicrositeButton(
  connectionId: number,
): Promise<{ status: ProvisionStatus; problems: string[] }> {
  const problems: string[] = [];

  for (const obj of CUSTOM_OBJECTS) {
    let objectExists = false;
    try {
      objectExists = (await sfdcService.describeSObject(connectionId, obj.apiName)) !== null;
    } catch (err) {
      problems.push(`Could not check ${obj.apiName}: ${shortErr(err)}`);
      continue;
    }

    if (!objectExists) {
      try {
        // Objects go through the SOAP Metadata API — the Tooling API cannot
        // create CustomObject (describe reports createable:false; only
        // CustomField is createable there). ReadWrite sharing so the
        // integration user can read/patch rep-created request rows without
        // View All on a private model.
        await sfdcService.metadataCreateCustomObject(connectionId, {
          fullName: obj.apiName,
          label: obj.label,
          pluralLabel: obj.pluralLabel,
          nameFieldLabel: `${obj.label} #`,
          nameFieldDisplayFormat: "R-{00000}",
          sharingModel: "ReadWrite",
        });
      } catch (err) {
        if (!isAlreadyExistsError(err)) {
          problems.push(`Create object ${obj.apiName} failed: ${shortErr(err)}`);
          continue; // no point creating fields on a missing object
        }
      }
    }

    // Field creation: describe again (fresh object has only standard fields).
    let existingFields = new Set<string>();
    try {
      const desc = await sfdcService.describeSObject(connectionId, obj.apiName);
      existingFields = new Set((desc?.fields ?? []).map((f) => f.name));
    } catch (err) {
      problems.push(`Could not list fields on ${obj.apiName}: ${shortErr(err)}`);
    }
    for (const field of obj.fields) {
      if (existingFields.has(field.name)) continue;
      try {
        await sfdcService.toolingCreate(connectionId, "CustomField", {
          FullName: `${obj.apiName}.${field.name}`,
          Metadata: field.metadata,
        });
      } catch (err) {
        if (!isAlreadyExistsError(err)) {
          problems.push(`Create field ${obj.apiName}.${field.name} failed: ${shortErr(err)}`);
        }
      }
    }
  }

  // Account.LP_Studio_Microsite_URL__c — where the finished URL lands.
  try {
    const accountDesc = await sfdcService.describeSObject(connectionId, "Account");
    const hasUrlField = (accountDesc?.fields ?? []).some((f) => f.name === ACCOUNT_URL_FIELD);
    if (!hasUrlField) {
      await sfdcService.toolingCreate(connectionId, "CustomField", {
        FullName: `Account.${ACCOUNT_URL_FIELD}`,
        Metadata: { type: "Url", label: "LP Studio Microsite URL", required: false },
      });
    }
  } catch (err) {
    if (!isAlreadyExistsError(err)) {
      problems.push(`Create Account.${ACCOUNT_URL_FIELD} failed: ${shortErr(err)}`);
    }
  }

  // Permission set + object/field grants + assignment to the connected user.
  try {
    await ensurePermissionSet(connectionId);
  } catch (err) {
    problems.push(`Permission set setup failed: ${shortErr(err)}`);
  }

  const status: ProvisionStatus = problems.length === 0 ? "provisioned" : "manual";
  await writeMicrositeButtonState(connectionId, {
    provisionStatus: status,
    provisionProblems: problems,
    lastProvisionAt: new Date().toISOString(),
  });
  logger.info({ connectionId, status, problems }, "[sfdc-microsite-button] provisioning finished");
  return { status, problems };
}

async function ensurePermissionSet(connectionId: number): Promise<void> {
  // 1. Find or create the permission set.
  let permSetId: string | null = null;
  const existing = await sfdcService.queryRecords<{ Id: string }>(
    connectionId,
    `SELECT Id FROM PermissionSet WHERE Name = ${soqlQuote(PERMISSION_SET_NAME)} LIMIT 1`,
  );
  if (existing[0]?.Id) {
    permSetId = existing[0].Id;
  } else {
    const created = await sfdcService.createSObject(connectionId, "PermissionSet", {
      Name: PERMISSION_SET_NAME,
      Label: PERMISSION_SET_LABEL,
    });
    permSetId = created.id;
  }
  if (!SfdcService.isValidSfdcId(permSetId)) throw new Error("Permission set id missing");

  // 2. Object permissions for both custom objects.
  const existingObjPerms = await sfdcService.queryRecords<{ SobjectType: string }>(
    connectionId,
    `SELECT SobjectType FROM ObjectPermissions WHERE ParentId = '${permSetId}'`,
  );
  const grantedObjects = new Set(existingObjPerms.map((p) => p.SobjectType));
  for (const obj of CUSTOM_OBJECTS) {
    if (grantedObjects.has(obj.apiName)) continue;
    try {
      await sfdcService.createSObject(connectionId, "ObjectPermissions", {
        ParentId: permSetId,
        SobjectType: obj.apiName,
        PermissionsRead: true,
        PermissionsCreate: true,
        PermissionsEdit: true,
        PermissionsDelete: false,
        PermissionsViewAllRecords: true,
        PermissionsModifyAllRecords: false,
      });
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
    }
  }

  // 3. Field permissions for every custom field (read+edit) incl. the Account URL field.
  const existingFieldPerms = await sfdcService.queryRecords<{ Field: string }>(
    connectionId,
    `SELECT Field FROM FieldPermissions WHERE ParentId = '${permSetId}'`,
  );
  const grantedFields = new Set(existingFieldPerms.map((p) => p.Field));
  const wantedFields: Array<{ sobject: string; field: string }> = [
    ...REQUEST_FIELDS.map((f) => ({ sobject: REQUEST_OBJECT, field: `${REQUEST_OBJECT}.${f.name}` })),
    ...CHOICE_FIELDS.map((f) => ({ sobject: CHOICE_OBJECT, field: `${CHOICE_OBJECT}.${f.name}` })),
    { sobject: "Account", field: `Account.${ACCOUNT_URL_FIELD}` },
  ];
  for (const w of wantedFields) {
    if (grantedFields.has(w.field)) continue;
    try {
      await sfdcService.createSObject(connectionId, "FieldPermissions", {
        ParentId: permSetId,
        SobjectType: w.sobject,
        Field: w.field,
        PermissionsRead: true,
        PermissionsEdit: true,
      });
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
    }
  }

  // 4. Assign to the connected integration user so LP Studio's own API calls
  //    can read/patch the custom objects regardless of the user's profile.
  const userId = await getConnectedUserId(connectionId);
  if (userId) {
    const assigned = await sfdcService.queryRecords<{ Id: string }>(
      connectionId,
      `SELECT Id FROM PermissionSetAssignment WHERE PermissionSetId = '${permSetId}' AND AssigneeId = '${userId}' LIMIT 1`,
    );
    if (!assigned[0]) {
      try {
        await sfdcService.createSObject(connectionId, "PermissionSetAssignment", {
          PermissionSetId: permSetId,
          AssigneeId: userId,
        });
      } catch (err) {
        if (!isAlreadyExistsError(err)) throw err;
      }
    }
  }
}

/** Resolve the connected OAuth user's Salesforce user id via the userinfo endpoint. */
async function getConnectedUserId(connectionId: number): Promise<string | null> {
  try {
    const connection = await sfdcService.getConnectionWithValidToken(connectionId);
    const response = await fetch(`${connection.instanceUrl}/services/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    if (!response.ok) return null;
    const info = await response.json() as { user_id?: string };
    return SfdcService.isValidSfdcId(info.user_id) ? info.user_id : null;
  } catch (err) {
    logger.warn({ connectionId, err: String(err) }, "[sfdc-microsite-button] userinfo lookup failed");
    return null;
  }
}

// ── Choice sync (segments + templates → LP_Studio_Choice__c) ─────────────────

interface DesiredChoice {
  type: "segment" | "template";
  choiceId: string;
  label: string;
  sortOrder: number;
}

interface RemoteChoice {
  Id: string;
  Type__c: string | null;
  Choice_Id__c: string | null;
  Label__c: string | null;
  Sort_Order__c: number | null;
  Active__c: boolean | null;
}

/**
 * Load the tenant's audience segments from brand config — the same
 * lpBrandSettings.config.segments the in-app microsite picker reads.
 */
export async function loadTenantSegments(
  tenantId: number,
): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .select({ config: lpBrandSettingsTable.config })
    .from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  const config = (rows.length > 0 ? rows[0].config : {}) as {
    segments?: Array<{ id?: string; name?: string }>;
  };
  const segments = Array.isArray(config.segments) ? config.segments : [];
  return segments
    .filter((s) => (s?.id ?? "").trim() || (s?.name ?? "").trim())
    .map((s) => ({
      id: ((s.id ?? "").trim() || (s.name ?? "").trim()).slice(0, 255),
      name: ((s.name ?? "").trim() || (s.id ?? "").trim()).slice(0, 255),
    }));
}

/**
 * Upsert the tenant's segment + microsite-template choices into
 * LP_Studio_Choice__c so the org admin's Screen Flow can render live
 * dropdowns. Rows for removed choices are deactivated (Active__c=false), not
 * deleted, so an in-flight Flow selection can still resolve.
 *
 * "Recommended" is NOT synced as a row — the Flow offers it as a static
 * default choice that leaves Segment_Id__c/Template_Id__c blank, which the
 * poller treats as "let LP Studio decide" (freeform generation).
 */
export async function syncMicrositeChoices(
  connectionId: number,
  tenantId: number,
): Promise<{ created: number; updated: number; deactivated: number }> {
  const [segments, templates] = await Promise.all([
    loadTenantSegments(tenantId),
    listTemplatesForTenant(tenantId, { salesMode: true, forMicrosite: true }),
  ]);

  const desired: DesiredChoice[] = [
    ...segments.map((s, i) => ({
      type: "segment" as const,
      choiceId: s.id,
      label: s.name.slice(0, 255),
      sortOrder: i,
    })),
    ...templates.map((t, i) => ({
      type: "template" as const,
      choiceId: String(t.id),
      label: (t.templateLabel || t.title || `Template ${t.id}`).slice(0, 255),
      sortOrder: i,
    })),
  ];
  const desiredByKey = new Map(desired.map((d) => [`${d.type}\u0000${d.choiceId}`, d]));

  const remote = await sfdcService.queryRecords<RemoteChoice>(
    connectionId,
    `SELECT Id, Type__c, Choice_Id__c, Label__c, Sort_Order__c, Active__c FROM ${CHOICE_OBJECT} LIMIT 1000`,
  );
  const remoteByKey = new Map<string, RemoteChoice>();
  for (const r of remote) {
    if (r.Type__c && r.Choice_Id__c) remoteByKey.set(`${r.Type__c}\u0000${r.Choice_Id__c}`, r);
  }

  let created = 0;
  let updated = 0;
  let deactivated = 0;

  for (const [key, d] of desiredByKey) {
    const r = remoteByKey.get(key);
    if (!r) {
      await sfdcService.createSObject(connectionId, CHOICE_OBJECT, {
        Type__c: d.type,
        Choice_Id__c: d.choiceId,
        Label__c: d.label,
        Sort_Order__c: d.sortOrder,
        Active__c: true,
      });
      created++;
    } else if (r.Label__c !== d.label || r.Sort_Order__c !== d.sortOrder || r.Active__c !== true) {
      await sfdcService.updateSObject(connectionId, CHOICE_OBJECT, r.Id, {
        Label__c: d.label,
        Sort_Order__c: d.sortOrder,
        Active__c: true,
      });
      updated++;
    }
  }

  for (const [key, r] of remoteByKey) {
    if (!desiredByKey.has(key) && r.Active__c === true) {
      await sfdcService.updateSObject(connectionId, CHOICE_OBJECT, r.Id, { Active__c: false });
      deactivated++;
    }
  }

  await writeMicrositeButtonState(connectionId, { lastChoicesSyncAt: new Date().toISOString() });
  logger.info(
    { connectionId, tenantId, created, updated, deactivated },
    "[sfdc-microsite-button] choices synced",
  );
  return { created, updated, deactivated };
}
