import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { decryptConfigCredentials } from "./encryption";

/**
 * Asana integration helpers (task #108).
 *
 * Auth model: per-tenant Personal Access Token + projectId stored in the
 * existing lp_integrations table (provider='asana'). PAT is the lowest-friction
 * option for tenants and matches the storage pattern used by Marketo/Sheets.
 *
 * Failure model: every helper here is best-effort. Submit-for-Review must NOT
 * fail just because Asana is misconfigured or unreachable, so all errors are
 * caught, logged, and returned as `{ ok: false, warning }`. Callers surface the
 * warning to the requester but keep the workflow moving.
 *
 * Test mode: when `process.env.ASANA_FAKE_MODE === '1'`, real HTTP is bypassed.
 * Calls are appended to an in-memory queue exposed for the Playwright suite via
 * `__getRecordedAsanaCalls()` so tests can assert task creation without a live
 * Asana account.
 */

export interface AsanaConfig {
  pat: string;
  workspaceId?: string | null;
  projectId: string;
  defaultAssigneeGid?: string | null;
}

export interface CreateReviewTaskInput {
  tenantId: number;
  pageId: number;
  pageTitle: string;
  requesterEmail: string;
  previewUrl: string;
  reviewUrl: string;
}

export interface AsanaCallRecord {
  kind: "create" | "comment_complete";
  tenantId: number;
  pageId?: number;
  taskId?: string;
  payload: Record<string, unknown>;
  ts: number;
}

const recordedCalls: AsanaCallRecord[] = [];
let fakeTaskCounter = 1000;

export function __getRecordedAsanaCalls(): AsanaCallRecord[] {
  return recordedCalls;
}
export function __clearRecordedAsanaCalls(): void {
  recordedCalls.length = 0;
}

function isFakeMode(): boolean {
  return process.env.ASANA_FAKE_MODE === "1" || process.env.NODE_ENV === "test";
}

export async function getAsanaConfig(tenantId: number): Promise<AsanaConfig | null> {
  const rows = await db.execute(sql`
    SELECT config, enabled FROM lp_integrations
     WHERE provider = 'asana' AND tenant_id = ${tenantId}
  `);
  const row = rows.rows[0] as { config: AsanaConfig | null; enabled: boolean } | undefined;
  if (!row || !row.enabled || !row.config) return null;
  // Decrypt the PAT (and any future credential fields) before returning so
  // callers hold the live token. Legacy plaintext passes through unchanged.
  const config = decryptConfigCredentials("asana", row.config as unknown as Record<string, unknown>) as unknown as AsanaConfig;
  if (!config.pat || !config.projectId) return null;
  return config;
}

export interface AsanaResult {
  ok: boolean;
  taskId?: string;
  warning?: string;
}

export async function createReviewTask(input: CreateReviewTaskInput): Promise<AsanaResult> {
  const config = await getAsanaConfig(input.tenantId);
  if (!config) {
    return { ok: false, warning: "Asana is not configured for this workspace — reviewers were not notified in Asana." };
  }

  const name = `Review request: ${input.pageTitle}`;
  const notes = [
    `${input.requesterEmail} requested review for landing page "${input.pageTitle}".`,
    "",
    `Preview: ${input.previewUrl}`,
    `Review in LP Studio: ${input.reviewUrl}`,
  ].join("\n");

  const payload: Record<string, unknown> = {
    name,
    notes,
    projects: [config.projectId],
  };
  if (config.defaultAssigneeGid) payload.assignee = config.defaultAssigneeGid;
  if (config.workspaceId) payload.workspace = config.workspaceId;

  if (isFakeMode()) {
    const taskId = `fake-${++fakeTaskCounter}`;
    recordedCalls.push({
      kind: "create",
      tenantId: input.tenantId,
      pageId: input.pageId,
      taskId,
      payload,
      ts: Date.now(),
    });
    return { ok: true, taskId };
  }

  try {
    const res = await fetch("https://app.asana.com/api/1.0/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[asana] create task failed", res.status, body.slice(0, 500));
      return { ok: false, warning: `Asana task creation failed (HTTP ${res.status}). The page is still in review.` };
    }
    const json = (await res.json()) as { data?: { gid?: string } };
    return { ok: true, taskId: json.data?.gid };
  } catch (err) {
    console.error("[asana] create task error", err);
    return { ok: false, warning: "Could not reach Asana. The page is still in review." };
  }
}

export interface CommentAndCompleteInput {
  tenantId: number;
  pageId: number;
  taskId: string;
  comment: string;
}

export async function commentAndCompleteTask(input: CommentAndCompleteInput): Promise<AsanaResult> {
  const config = await getAsanaConfig(input.tenantId);
  if (!config) return { ok: false, warning: "Asana is not configured." };

  const payload = { taskId: input.taskId, comment: input.comment };

  if (isFakeMode()) {
    recordedCalls.push({
      kind: "comment_complete",
      tenantId: input.tenantId,
      pageId: input.pageId,
      taskId: input.taskId,
      payload,
      ts: Date.now(),
    });
    return { ok: true, taskId: input.taskId };
  }

  try {
    // Best-effort: post comment, then complete the task. Either step failing
    // doesn't block the page-status flip in lp-studio, but we surface the
    // failure as a warning instead of silently swallowing it.
    const commentRes = await fetch(`https://app.asana.com/api/1.0/tasks/${input.taskId}/stories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { text: input.comment } }),
    });
    if (!commentRes.ok) {
      const body = await commentRes.text().catch(() => "");
      console.error("[asana] comment failed", commentRes.status, body.slice(0, 500));
      return { ok: false, taskId: input.taskId, warning: `Asana comment failed (HTTP ${commentRes.status}). The page-status change went through, but the task is still open.` };
    }
    const completeRes = await fetch(`https://app.asana.com/api/1.0/tasks/${input.taskId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { completed: true } }),
    });
    if (!completeRes.ok) {
      const body = await completeRes.text().catch(() => "");
      console.error("[asana] complete failed", completeRes.status, body.slice(0, 500));
      return { ok: false, taskId: input.taskId, warning: `Asana task close failed (HTTP ${completeRes.status}). Comment posted, but the task is still open.` };
    }
    return { ok: true, taskId: input.taskId };
  } catch (err) {
    console.error("[asana] comment/complete error", err);
    return { ok: false, warning: "Could not update the Asana task." };
  }
}


/* ── Partner-room marketing requests → the marketing intake project ──────── */

export interface CreateIntakeTaskInput {
  tenantId: number;
  pageId: number;
  name: string;
  notes: string;
  /** Project to file under. Blank = the tenant's configured project. */
  projectGid?: string | null;
  /** Custom field to set on the task, matched by NAME on the project (case-insensitive). */
  statusFieldName?: string;
  statusOptionName?: string;
}

/**
 * Create a task for a marketing request and set its "Intake status" custom
 * field to "Submitted", so the marketing intake picks it up. The field and
 * option are looked up by name on the project, so nothing here hard-codes a
 * workspace's ids; when the field or option is missing the task is still
 * created and the warning says what was not set. Best-effort, never throws.
 */
export async function createIntakeTask(input: CreateIntakeTaskInput): Promise<AsanaResult> {
  const config = await getAsanaConfig(input.tenantId);
  if (!config) return { ok: false, warning: "Asana is not connected for this workspace." };
  const project = (input.projectGid ?? "").trim() || config.projectId;
  const fieldName = (input.statusFieldName ?? "Intake status").toLowerCase();
  const optionName = (input.statusOptionName ?? "Submitted").toLowerCase();
  const payload: Record<string, unknown> = { name: input.name, notes: input.notes, projects: [project] };
  if (config.workspaceId) payload.workspace = config.workspaceId;

  if (isFakeMode()) {
    const taskId = `fake-${++fakeTaskCounter}`;
    recordedCalls.push({ kind: "create", tenantId: input.tenantId, pageId: input.pageId, taskId, payload: { ...payload, intakeStatus: optionName }, ts: Date.now() });
    return { ok: true, taskId };
  }

  const headers = { Authorization: `Bearer ${config.pat}`, "Content-Type": "application/json" };
  let warning: string | undefined;
  try {
    const fieldsRes = await fetch(`https://app.asana.com/api/1.0/projects/${encodeURIComponent(project)}/custom_field_settings?opt_fields=custom_field.name,custom_field.enum_options.name,custom_field.enum_options.enabled`, { headers });
    if (fieldsRes.ok) {
      const json = (await fieldsRes.json()) as { data?: { custom_field?: { gid?: string; name?: string; enum_options?: { gid?: string; name?: string; enabled?: boolean }[] } }[] };
      const field = (json.data ?? []).map((d) => d.custom_field).find((f) => (f?.name ?? "").trim().toLowerCase() === fieldName);
      const option = field?.enum_options?.find((o) => (o.name ?? "").trim().toLowerCase() === optionName && o.enabled !== false);
      if (field?.gid && option?.gid) payload.custom_fields = { [field.gid]: option.gid };
      else warning = `The Asana project has no "${input.statusFieldName ?? "Intake status"}" field with a "${input.statusOptionName ?? "Submitted"}" option, so the status was not set.`;
    } else {
      warning = `Could not read the Asana project's fields (HTTP ${fieldsRes.status}), so the intake status was not set.`;
    }
    const res = await fetch("https://app.asana.com/api/1.0/tasks", { method: "POST", headers, body: JSON.stringify({ data: payload }) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[asana] intake task failed", res.status, body.slice(0, 500));
      return { ok: false, warning: `Asana task creation failed (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as { data?: { gid?: string } };
    return { ok: true, taskId: json.data?.gid, warning };
  } catch (err) {
    console.error("[asana] intake task error", err);
    return { ok: false, warning: "Could not reach Asana." };
  }
}
