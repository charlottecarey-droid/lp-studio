/**
 * Shared registry of `{{variable}}` tokens that authors can drop into email
 * templates (lifecycle/transactional) and sales campaigns.
 *
 * Imported by BOTH the api-server (to expose the catalog over the editor API
 * and to build sample/preview substitution maps) and the lp-studio frontend
 * (the variable inserter). Keeping one source of truth means the pill the
 * author clicks and the value the server substitutes can never drift.
 *
 * A `VariableDefinition` is metadata only — the actual values are supplied at
 * send time by the dispatcher's context map. `sample` is the value used for
 * the live preview and test-send so the operator sees a realistic render.
 */

export interface VariableDefinition {
  /** Token name without braces, e.g. `tenantName`. Matched by `/\{\{\s*(\w+)\s*\}\}/`. */
  token: string;
  /** Human label shown in the inserter, e.g. "Workspace name". */
  label: string;
  /** One-line description of what the value is at send time. */
  description: string;
  /** Realistic value used for live preview and test-send rendering. */
  sample: string;
  /** Grouping for the inserter UI, e.g. "Workspace", "Billing". */
  group: string;
}

/** `{{token}}` — the exact text inserted into the editor. */
export function variableInsertText(v: Pick<VariableDefinition, "token">): string {
  return `{{${v.token}}}`;
}

/** Build a `token -> sample` map for preview/test-send rendering. */
export function buildSampleVars(defs: readonly VariableDefinition[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) out[d.token] = d.sample;
  return out;
}

/**
 * Platform lifecycle / transactional email variables (trial nudges, welcome,
 * and any future system message rendered through the dispatcher shell).
 */
export const PLATFORM_NOTIFICATION_VARIABLES: readonly VariableDefinition[] = [
  {
    token: "tenantName",
    label: "Workspace name",
    description: "The recipient's workspace / company name.",
    sample: "Acme Dental",
    group: "Workspace",
  },
  {
    token: "recipientName",
    label: "Recipient first name",
    description: "First name of the person receiving the email (falls back to “there”).",
    sample: "Jordan",
    group: "Recipient",
  },
  {
    token: "recipientEmail",
    label: "Recipient email",
    description: "Email address the message is sent to.",
    sample: "jordan@acmedental.com",
    group: "Recipient",
  },
  {
    token: "workspaceUrl",
    label: "Workspace URL",
    description: "Link to the recipient's workspace home.",
    sample: "https://acme.lpstudio.ai",
    group: "Links",
  },
  {
    token: "workspaceHost",
    label: "Workspace host",
    description: "The workspace domain without scheme, for display in copy.",
    sample: "acme.lpstudio.ai",
    group: "Links",
  },
  {
    token: "acceptUrl",
    label: "Accept-invite link",
    description: "The invitation accept / sign-in link (workspace invite email).",
    sample: "https://app.lpstudio.ai/invite/sample",
    group: "Links",
  },
  {
    token: "inviterName",
    label: "Inviter name",
    description: "Name of the teammate who sent the workspace invitation.",
    sample: "Taylor",
    group: "Recipient",
  },
  {
    token: "billingUrl",
    label: "Billing URL",
    description: "Link to the workspace billing / plan page.",
    sample: "https://acme.lpstudio.ai/settings/billing",
    group: "Links",
  },
  {
    token: "ctaUrl",
    label: "CTA link",
    description: "The primary button link (billing URL, else workspace URL).",
    sample: "https://acme.lpstudio.ai/settings/billing",
    group: "Links",
  },
  {
    token: "daysRemaining",
    label: "Days remaining",
    description: "Days left on the Growth trial.",
    sample: "3",
    group: "Trial",
  },
  {
    token: "headline",
    label: "Headline",
    description: "The email's header headline (shown in the branded shell).",
    sample: "Your Growth trial ends soon",
    group: "Workspace",
  },
  {
    token: "subject",
    label: "Subject line",
    description: "The email subject (used in the shell <title>; defaults to the headline).",
    sample: "Your Growth trial ends soon",
    group: "Workspace",
  },
  {
    token: "preheaderText",
    label: "Preheader text",
    description: "Short inbox preview text shown after the subject in most clients.",
    sample: "A quick note about your workspace.",
    group: "Workspace",
  },
  {
    token: "unsubscribeUrl",
    label: "Unsubscribe URL",
    description: "Link recipients use to manage email preferences (defaults to workspace settings).",
    sample: "https://acme.lpstudio.ai/settings/notifications",
    group: "Links",
  },
  {
    token: "physicalAddress",
    label: "Mailing address",
    description: "CAN-SPAM postal address shown in the footer. Set your real address here.",
    sample: "123 Market St, Suite 400, San Francisco, CA 94103",
    group: "Compliance",
  },
  {
    token: "currentYear",
    label: "Current year",
    description: "The current year, for the footer copyright line (filled automatically).",
    sample: String(new Date().getUTCFullYear()),
    group: "Compliance",
  },
];

/**
 * Tenant-scoped notification email variables (Task #588 — Phase 2). These are
 * the tokens a tenant admin can drop into their own tenant-scope templates
 * (lead notification, new comment, review decision, form follow-up) rendered
 * through the per-tenant brand-derived shell.
 *
 * Distinct from PLATFORM_NOTIFICATION_VARIABLES: tenant templates address a
 * tenant's own leads/collaborators, never LP Studio billing/trial concepts.
 */
export const TENANT_NOTIFICATION_VARIABLES: readonly VariableDefinition[] = [
  {
    token: "brandName",
    label: "Brand name",
    description: "Your workspace / brand name (used in the email shell + footer).",
    sample: "Acme Dental",
    group: "Brand",
  },
  {
    token: "pageTitle",
    label: "Page title",
    description: "Title of the landing page the event relates to.",
    sample: "Spring Implant Promo",
    group: "Content",
  },
  {
    token: "submittedAt",
    label: "Submitted at",
    description: "When the lead was submitted (lead notification).",
    sample: "May 31, 2026, 2:14 PM",
    group: "Lead",
  },
  {
    token: "authorName",
    label: "Comment author",
    description: "Name of the person who left the comment (new comment email).",
    sample: "Taylor Reed",
    group: "Collaboration",
  },
  {
    token: "message",
    label: "Comment message",
    description: "Body of the comment that was left (new comment email).",
    sample: "Can we make the headline punchier?",
    group: "Collaboration",
  },
  {
    token: "reviewerName",
    label: "Reviewer name",
    description: "Name of the reviewer (review decision email).",
    sample: "Jordan Lee",
    group: "Collaboration",
  },
  {
    token: "statusLabel",
    label: "Review status",
    description: "The review outcome label, e.g. “✅ Approved” (review decision email).",
    sample: "✅ Approved",
    group: "Collaboration",
  },
  {
    token: "recipientEmail",
    label: "Recipient email",
    description: "Email address the message is sent to.",
    sample: "jordan@acmedental.com",
    group: "Recipient",
  },
  {
    token: "workspaceUrl",
    label: "Workspace URL",
    description: "Link to your workspace home.",
    sample: "https://acme.lpstudio.ai",
    group: "Links",
  },
  {
    token: "unsubscribeUrl",
    label: "Manage preferences URL",
    description: "Link recipients use to manage email preferences (defaults to workspace settings).",
    sample: "https://acme.lpstudio.ai/settings/notifications",
    group: "Compliance",
  },
  {
    token: "physicalAddress",
    label: "Mailing address",
    description: "CAN-SPAM postal address shown in the footer. Set your real address here.",
    sample: "123 Market St, Suite 400, San Francisco, CA 94103",
    group: "Compliance",
  },
  {
    token: "currentYear",
    label: "Current year",
    description: "The current year, for the footer copyright line (filled automatically).",
    sample: String(new Date().getUTCFullYear()),
    group: "Compliance",
  },
];

/**
 * Sales campaign variables. Mirrors the tokens the campaign send path
 * substitutes; kept here so the shared variable inserter can serve both the
 * superadmin email editor and the campaign composer from one catalog.
 */
export const CAMPAIGN_VARIABLES: readonly VariableDefinition[] = [
  {
    token: "firstName",
    label: "First name",
    description: "Contact's first name.",
    sample: "Jordan",
    group: "Contact",
  },
  {
    token: "lastName",
    label: "Last name",
    description: "Contact's last name.",
    sample: "Rivera",
    group: "Contact",
  },
  {
    token: "company",
    label: "Company",
    description: "Contact's company / account name.",
    sample: "Acme Dental",
    group: "Contact",
  },
  {
    token: "title",
    label: "Job title",
    description: "Contact's job title.",
    sample: "Practice Manager",
    group: "Contact",
  },
];
