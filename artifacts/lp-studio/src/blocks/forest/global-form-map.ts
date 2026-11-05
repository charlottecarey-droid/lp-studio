/**
 * Route the forest-close "Talk to the team" submission through a linked
 * GLOBAL form without rendering that form's UI — the same approach as the
 * gift form's mapper (blocks/gift/global-form-map.ts).
 *
 * The server keys everything on field LABELS: with `formId` in the lead POST
 * it applies the global form's routing (email, Slack, webhook, Sheets,
 * Marketo, Salesforce, follow-up email, redirect) and rebuilds the CRM
 * payload as an allowlist of the form's own field labels. So the close
 * form's values are filed under the global form's labels, judged by field
 * type and label keywords (`classifyGlobalField`), hidden fields resolve
 * from the URL/attribution, and native duplicates the global form now covers
 * are dropped. The qualifying selects (locations, lab strategy, prompt) keep
 * their own labels — they reach the lead record, email, Slack and Sheets but
 * never the CRM unless a textarea/message field on the global form takes the
 * one-line summary.
 */
import type { FormStep } from "@/lib/block-types";
import { resolveHiddenValue } from "@/lib/global-form-submission";
import { classifyGlobalField, fetchGlobalForm, type PublicGlobalForm } from "@/blocks/gift/global-form-map";

export { fetchGlobalForm, type PublicGlobalForm };

export interface ForestLeadValues {
  name?: string;
  email?: string;
  org?: string;
  role?: string;
  locations?: string;
  stage?: string;
  why?: string;
}

/** The labels the close form carries natively (the keys the lead is filed under without a global form). */
export interface ForestNativeLabels {
  role: string;
  locations: string;
  stage: string;
  why: string;
}

/** Split "Jane Q. Smith" into first ("Jane") and last ("Q. Smith") on the first space. */
export function splitName(name: string | undefined): { first: string; last: string } {
  const s = (name ?? "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: "" };
  const i = s.indexOf(" ");
  return i === -1 ? { first: s, last: "" } : { first: s.slice(0, i), last: s.slice(i + 1) };
}

/** The multi-line summary a message/notes field on the global form can carry. */
export function forestSummary(v: ForestLeadValues, labels: ForestNativeLabels): string {
  const parts: string[] = [];
  if (v.locations) parts.push(`${labels.locations}: ${v.locations}`);
  if (v.stage) parts.push(`${labels.stage}: ${v.stage}`);
  if (v.why) parts.push(`${labels.why}: ${v.why}`);
  return parts.join("\n");
}

/**
 * Fields keyed by the global form's own labels, merged OVER the close form's
 * native label-keyed fields so nothing is lost. Native keys the global form
 * now covers (e.g. "Email" vs "Work email", "Organization" vs "Company") are
 * dropped to avoid duplicates on the lead.
 */
export function mapToGlobalForm(steps: FormStep[] | undefined, values: ForestLeadValues, labels: ForestNativeLabels, native: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...native };
  const { first, last } = splitName(values.name);
  const covered = new Set<string>();
  const nativeKeyFor: Record<string, string | undefined> = {
    fullName: "Name", firstName: "Name", lastName: "Name", email: "Email", company: "Organization", role: labels.role,
  };
  for (const step of steps ?? []) {
    for (const f of step.fields ?? []) {
      if (!f.label) continue;
      if (f.type === "hidden") { out[f.label] = resolveHiddenValue(f.defaultValue ?? ""); continue; }
      const kind = classifyGlobalField(f);
      if (!kind) continue;
      let v = "";
      switch (kind) {
        case "fullName": v = (values.name ?? "").trim(); break;
        case "firstName": v = first; break;
        case "lastName": v = last; break;
        case "email": v = (values.email ?? "").trim(); break;
        case "company": v = (values.org ?? "").trim(); break;
        case "role": v = (values.role ?? "").trim(); break;
        case "summary": v = forestSummary(values, labels); break;
        default: v = ""; // phone, address lines, notes… — the close form has nothing to offer
      }
      if (!v) continue;
      out[f.label] = v;
      covered.add(kind);
    }
  }
  // "Name" is only redundant once BOTH halves (or the full name) are filed elsewhere.
  const nameCovered = covered.has("fullName") || (covered.has("firstName") && covered.has("lastName"));
  for (const kind of covered) {
    if (kind === "firstName" || kind === "lastName" || kind === "fullName") continue;
    const nativeKey = nativeKeyFor[kind];
    if (!nativeKey) continue;
    const globalUsesSameLabel = (steps ?? []).some((s) => (s.fields ?? []).some((f) => f.label === nativeKey));
    if (!globalUsesSameLabel) delete out[nativeKey];
  }
  if (nameCovered && !(steps ?? []).some((s) => (s.fields ?? []).some((f) => f.label === "Name"))) delete out.Name;
  return out;
}
