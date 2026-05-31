import { renderEmail, expandEmailVars } from "./emailRender";
import { getTenantNotificationTemplate } from "./tenantNotificationTemplates";
import { resolveTenantShell, type TenantShellSource } from "./tenantEmailShell";

/**
 * Render a tenant-scope notification email (Task #588) — the tenant mirror of
 * `renderSystemEmail` in `notifications.ts`. Resolves the tenant's template
 * (DB override → code default) and brand-derived shell, then renders the body
 * into that shell.
 *
 * Returns null when the template is disabled or produces an empty document, so
 * callers can fall through to their legacy hardcoded send (resilience contract).
 */

/** Plain-text {{token}} substitution for the subject line (no HTML escaping). */
function interpolatePlainText(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : "",
  );
}

export interface RenderTenantEmailInput {
  tenantId: number;
  key: string;
  /** Escaped scalar substitutions for the body + shell. */
  vars: Record<string, string>;
  /** Raw HTML slots injected into the body after escaped interpolation. */
  rawSlots?: Record<string, string>;
  /** Override the resolved subject (e.g. the tenant's sales-template subject). */
  subjectOverride?: string;
}

export interface RenderTenantEmailResult {
  subject: string;
  html: string;
  /** Provenance of the shell used (for send observability). */
  shellSource: TenantShellSource;
}

export async function renderTenantEmail(
  input: RenderTenantEmailInput,
): Promise<RenderTenantEmailResult | null> {
  const tpl = await getTenantNotificationTemplate(input.tenantId, input.key);
  if (!tpl.enabled) return null;
  const body = (tpl.bodyHtml ?? "").trim();
  if (!body) return null;

  const { shell, source, physicalAddress } = await resolveTenantShell(input.tenantId);
  // Inject the tenant's saved postal address into the `{{physicalAddress}}` footer
  // token unless the caller explicitly supplied one. expandEmailVars then defaults
  // any still-missing value to "" so an unset address omits the footer line cleanly.
  const withAddress =
    input.vars.physicalAddress === undefined && physicalAddress
      ? { ...input.vars, physicalAddress }
      : input.vars;
  const expanded = expandEmailVars(withAddress);
  const html = renderEmail({
    shell,
    bodyHtml: tpl.bodyHtml,
    wrapInShell: tpl.wrapInShell,
    vars: expanded,
    rawSlots: input.rawSlots,
  });
  if (!html || !html.trim()) return null;

  const subject = (
    input.subjectOverride ??
    interpolatePlainText(tpl.emailSubject ?? "", expanded)
  ).trim();
  if (!subject) return null;

  return { subject, html, shellSource: source };
}
