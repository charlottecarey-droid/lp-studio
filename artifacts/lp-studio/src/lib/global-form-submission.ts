/**
 * Shared global-form submission building.
 *
 * A lead "from" a global form must always carry EXACTLY the form's fields —
 * every label, in definition order, blanks included, hidden fields resolved —
 * because downstream consumers are positional or name-sensitive: the Google
 * Sheets sync appends values in key order under a header row established by
 * earlier submissions, the CRM syncs map/allowlist by label, and the leads
 * table derives its columns from the keys. A submission with different keys
 * (or a different order) lands scrambled next to real form submissions.
 *
 * BlockForm builds its payload with `buildGlobalFormSubmissionFields`; the
 * chat-capture block routes the bot's answers through
 * `buildLinkedFormLeadFields` so a chat lead is byte-compatible with a form
 * lead. Keep both on these helpers — a hand-rolled fields loop in a block is
 * exactly how the drift happened.
 */

import type { FormStep, StepCondition } from "@/lib/block-types";

/** Evaluate a StepCondition against the current field values (keyed by field id). */
export function evalCondition(cond: StepCondition, values: Record<string, string>): boolean {
  const actual = (values[cond.fieldId] ?? "").trim().toLowerCase();
  const expected = cond.value.trim().toLowerCase();
  switch (cond.operator) {
    case "equals": return actual === expected;
    case "not_equals": return actual !== expected;
    case "contains": return actual.includes(expected);
    case "any_of": return expected.split("|").map(s => s.trim().toLowerCase()).includes(actual);
    default: return true;
  }
}

// URL-param-backed tokens. The right-hand side is the URL query parameter name.
// All of these are also persisted in localStorage on first hit so attribution
// survives page navigation (matches Google Ads / GA's recommended pattern).
const URL_PARAM_TOKENS: Record<string, string> = {
  "{{utm_source}}":   "utm_source",
  "{{utm_medium}}":   "utm_medium",
  "{{utm_campaign}}": "utm_campaign",
  "{{utm_content}}":  "utm_content",
  "{{utm_term}}":     "utm_term",
  "{{utm_ad_id}}":    "utm_ad_id",
  "{{gclid}}":        "gclid",
  "{{fbclid}}":       "fbclid",
  "{{gbraid}}":       "gbraid",
  "{{wbraid}}":       "wbraid",
  "{{msclkid}}":      "msclkid",
};
const LS_PREFIX = "lpstudio_attr_";

function readPersistedParam(name: string): string {
  if (typeof window === "undefined") return "";
  const live = new URLSearchParams(window.location.search).get(name);
  if (live) {
    try { window.localStorage.setItem(LS_PREFIX + name, live); } catch { /* private mode */ }
    return live;
  }
  try { return window.localStorage.getItem(LS_PREFIX + name) ?? ""; } catch { return ""; }
}

// Read the GA4 client ID from the `_ga` cookie (format: GA1.2.<clientId-2-parts>.<timestamp>).
function readGaClientId(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!m) return "";
  const parts = decodeURIComponent(m[1]).split(".");
  // GA1.2.123456789.1700000000 → "123456789.1700000000"
  if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
  return "";
}

/** Resolve a hidden field's template ({{utm_source}}, {{gclid}}, {{ga_client_id}},
 *  {{page_url}}, …) against the current URL, localStorage attribution, and cookies. */
export function resolveHiddenValue(template: string): string {
  if (!template) return "";
  let result = template;
  for (const [token, param] of Object.entries(URL_PARAM_TOKENS)) {
    if (!result.includes(token)) continue;
    result = result.replaceAll(token, readPersistedParam(param));
  }
  if (result.includes("{{ga_client_id}}")) {
    result = result.replaceAll("{{ga_client_id}}", readGaClientId());
  }
  result = result.replaceAll("{{page_url}}",   typeof window !== "undefined" ? window.location.href : "");
  result = result.replaceAll("{{page_title}}", typeof document !== "undefined" ? document.title : "");
  result = result.replaceAll("{{referrer}}",   typeof document !== "undefined" ? document.referrer : "");
  return result;
}

/**
 * Build the canonical fields payload for a global-form submission: every
 * field label in definition order, hidden fields resolved, condition-hidden
 * steps/fields omitted, unanswered visible fields as "". `values` is keyed by
 * FIELD ID (BlockForm's live fieldValues shape).
 */
export function buildGlobalFormSubmissionFields(
  steps: FormStep[],
  values: Record<string, string>,
): Record<string, string> {
  const allFields: Record<string, string> = {};
  for (const s of steps) {
    for (const field of s.fields) {
      if (field.type === "hidden") {
        allFields[field.label] = resolveHiddenValue(field.defaultValue ?? "");
        continue;
      }
      if (s.condition && !evalCondition(s.condition, values)) continue;
      if (field.visibilityCondition && !evalCondition(field.visibilityCondition, values)) continue;
      allFields[field.label] = values[field.id] ?? "";
    }
  }
  return allFields;
}

/** Bot-collected identity args from the chat block's capture_lead action. */
export interface ChatLeadArgs {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
}

/** Values the bot collected that found no matching form field — the caller
 *  appends these under generic labels so the data is never dropped. */
export interface ChatLeadLeftovers {
  email?: string;
  name?: string;
  company?: string;
  phone?: string;
}

/** Classify a form-field label into the identity concepts the bot collects.
 *  Order matters: "Company Name" must classify as company, not name. */
function conceptFor(label: string): "email" | "firstName" | "lastName" | "company" | "phone" | "fullName" | null {
  if (/e-?mail/i.test(label)) return "email";
  if (/first\s*name/i.test(label)) return "firstName";
  if (/last\s*name|surname/i.test(label)) return "lastName";
  if (/company|organi[sz]ation|practice|business/i.test(label)) return "company";
  if (/phone|mobile/i.test(label)) return "phone";
  if (/name/i.test(label)) return "fullName";
  return null;
}

/**
 * Route a chat capture into a linked global form's field definitions so the
 * lead submits EXACTLY like a form submission (see module docstring).
 *
 *  1. `formAnswers` (keyed by form-field label — the bot is grounded on the
 *     linked form's labels) match case-insensitively.
 *  2. The bot's dedicated identity args fill any email/name/company/phone
 *     field the answers left blank; a full name splits across First/Last
 *     Name fields when the form has them.
 *  3. Everything else follows the canonical builder: definition order,
 *     hidden fields resolved, blanks for unanswered.
 *
 * Bot values with no matching form field come back as `leftovers` so the
 * caller can append them under its generic labels instead of losing them.
 */
export function buildLinkedFormLeadFields(
  steps: FormStep[],
  formAnswers: Record<string, string>,
  bot: ChatLeadArgs,
): { fields: Record<string, string>; leftovers: ChatLeadLeftovers } {
  const answersByLabel = new Map<string, string>();
  for (const [k, v] of Object.entries(formAnswers)) {
    if (k.trim() && v.trim()) answersByLabel.set(k.trim().toLowerCase(), v.trim());
  }

  const name = (bot.name ?? "").trim();
  const nameParts = name.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  const conceptValues: Record<string, string> = {
    email: bot.email.trim(),
    firstName,
    lastName,
    fullName: name,
    company: (bot.company ?? "").trim(),
    phone: (bot.phone ?? "").trim(),
  };

  const used = { email: false, name: false, company: false, phone: false };
  const values: Record<string, string> = {};
  for (const s of steps) {
    for (const field of s.fields) {
      if (field.type === "hidden") continue;
      const answered = answersByLabel.get(field.label.trim().toLowerCase());
      let value = answered ?? "";
      const concept = conceptFor(field.label);
      if (!value && concept && conceptValues[concept]) {
        value = conceptValues[concept];
      }
      // An answer under an identity label also counts as that concept being
      // captured on the form, so it must not reappear as a generic leftover.
      if (concept && value) {
        if (concept === "email") used.email = true;
        else if (concept === "company") used.company = true;
        else if (concept === "phone") used.phone = true;
        else used.name = true;
      }
      values[field.id] = value;
    }
  }

  const leftovers: ChatLeadLeftovers = {};
  if (conceptValues.email && !used.email) leftovers.email = conceptValues.email;
  if (name && !used.name) leftovers.name = name;
  if (conceptValues.company && !used.company) leftovers.company = conceptValues.company;
  if (conceptValues.phone && !used.phone) leftovers.phone = conceptValues.phone;

  return { fields: buildGlobalFormSubmissionFields(steps, values), leftovers };
}
