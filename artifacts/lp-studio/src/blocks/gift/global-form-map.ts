/**
 * Route a gift-form submission through a linked GLOBAL form without
 * rendering that form's UI.
 *
 * The server keys everything on field LABELS: with `formId` in the lead POST
 * it applies the global form's routing (email, Slack, webhook, Sheets,
 * Marketo, Salesforce, follow-up email, campaign enrolment) and rebuilds the
 * CRM payload as an allowlist of the form's own field labels. So the gift
 * form's values must be filed under the global form's labels for the CRM
 * sync to see them. This maps them by field type and label keywords; any
 * global field with nothing to fill is left out; the gift-specific extras
 * (Gift, Size, shipping lines, Rep…) keep their own labels, which reach the
 * lead record, email, Slack and Sheets but never the CRM (not on the
 * allowlist) — exactly the Marketo-safe behaviour the chat bot relies on.
 */
import type { FormStep } from "@/lib/block-types";
import { resolveHiddenValue } from "@/lib/global-form-submission";

export interface GiftLeadValues {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  role?: string;
  phone?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  gift?: string;
  size?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Which gift value a global-form field wants, judged by its type then its label. */
export function classifyGlobalField(field: { type?: string; label?: string }): keyof GiftLeadValues | "fullName" | "summary" | null {
  const type = field.type ?? "text";
  const label = norm(field.label ?? "");
  // Fields about the REP (rep email, account owner…) are not the recipient's;
  // the gift form fills them natively, so leave them alone.
  if (/\b(rep|owner)\b/.test(label)) return null;
  if (type === "email" || /\be-?mail\b/.test(label)) return "email";
  if (type === "phone" || type === "tel" || /\b(phone|mobile|cell|tel)\b/.test(label)) return "phone";
  if (type === "hidden" || type === "checkbox" || type === "select") return null;
  if (/\b(first|given)\b/.test(label)) return "firstName";
  if (/\b(last|family|surname)\b/.test(label)) return "lastName";
  if (/\b(full name|your name|name)\b/.test(label) && !/company|practice|organi[sz]ation|business/.test(label)) return "fullName";
  if (/company|organi[sz]ation|practice|business|dso|employer/.test(label)) return "company";
  if (/\b(title|role|position)\b/.test(label)) return "role";
  // A field named for delivery/shipping notes takes just the notes, not the whole gift summary.
  if (/(delivery|shipping) (notes?|instructions)/.test(label)) return "notes";
  if (/\bzip|postal|postcode\b/.test(label)) return "zip";
  if (/\bstate|province|region\b/.test(label)) return "state";
  if (/\bcity|town\b/.test(label)) return "city";
  if (/\b(address|street)\b/.test(label)) return "address";
  if (type === "textarea" || /message|notes?|comments?|anything|details|tell us/.test(label)) return "summary";
  return null;
}

/** One line a "message"-type field can carry about the gift. */
export function giftSummary(v: GiftLeadValues): string {
  const parts: string[] = [];
  if (v.gift) parts.push(`Gift: ${v.gift}${v.size ? ` (${v.size})` : ""}`);
  const ship = [v.address, v.address2, v.city, [v.state, v.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (ship) parts.push(`Ship to: ${ship}`);
  if (v.notes) parts.push(`Delivery notes: ${v.notes}`);
  return parts.join("\n");
}

/**
 * Fields keyed by the global form's own labels (hidden fields resolved from
 * the URL/attribution like the generic form does), merged OVER the gift
 * form's native label-keyed fields so nothing is lost. Native keys that the
 * global form already covers (e.g. "Email" vs "Work email") are dropped to
 * avoid duplicates in the lead.
 */
export function mapToGlobalForm(steps: FormStep[] | undefined, values: GiftLeadValues, native: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...native };
  const covered = new Set<keyof GiftLeadValues | "fullName" | "summary">();
  const nativeKeyFor: Partial<Record<keyof GiftLeadValues, string>> = {
    firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", role: "Role",
    address: "Shipping address", address2: "Suite / unit", city: "City", state: "State", zip: "ZIP", notes: "Delivery notes",
  };
  for (const step of steps ?? []) {
    for (const f of step.fields ?? []) {
      if (!f.label) continue;
      if (f.type === "hidden") { out[f.label] = resolveHiddenValue(f.defaultValue ?? ""); continue; }
      const kind = classifyGlobalField(f);
      if (!kind) continue;
      let v = "";
      if (kind === "fullName") v = [values.firstName, values.lastName].filter(Boolean).join(" ");
      else if (kind === "summary") v = giftSummary(values);
      else v = values[kind] ?? "";
      if (!v) continue;
      out[f.label] = v;
      covered.add(kind);
      if (kind === "fullName") { covered.add("firstName"); covered.add("lastName"); }
    }
  }
  // Drop native duplicates of what the global form now carries — unless the
  // global label IS the native label (then it was just overwritten in place).
  for (const kind of covered) {
    const nativeKey = kind === "fullName" || kind === "summary" ? undefined : nativeKeyFor[kind as keyof GiftLeadValues];
    if (!nativeKey) continue;
    const globalUsesSameLabel = (steps ?? []).some((s) => (s.fields ?? []).some((f) => f.label === nativeKey));
    if (!globalUsesSameLabel) delete out[nativeKey];
  }
  return out;
}

export interface PublicGlobalForm {
  id: number;
  name?: string;
  steps: FormStep[];
  redirectUrl?: string | null;
}

/** Fetch the linked global form's public definition once; null when it can't be loaded. */
export async function fetchGlobalForm(formId: number): Promise<PublicGlobalForm | null> {
  try {
    const r = await fetch(`/api/lp/forms/${formId}`);
    if (!r.ok) return null;
    const data = (await r.json()) as PublicGlobalForm;
    return Array.isArray(data?.steps) ? data : null;
  } catch {
    return null;
  }
}
