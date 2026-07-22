/**
 * Per-field CRM sync suppression for global forms.
 *
 * A global form's field defs (lp_forms.steps) may flag individual fields with
 * `excludeFromCrmSync: true`. Those fields are still captured on the lead and
 * still flow to email notifications, Google Sheets, Slack, and webhooks — but
 * they are stripped from the CRM/marketing sync payloads (Marketo, HubSpot,
 * Salesforce). Rationale: Marketo's createOrUpdate is all-or-nothing — a
 * single field name that doesn't exist in the Marketo instance causes the
 * ENTIRE lead to be skipped, so custom-only fields must never reach it.
 *
 * Submitted lead fields are keyed by field LABEL (BlockForm submits
 * `allFields[field.label] = value`), so suppression matches on labels.
 */

interface SuppressibleField {
  label?: unknown;
  excludeFromCrmSync?: unknown;
}

interface StepLike {
  fields?: unknown;
}

/** Collect the labels of fields flagged excludeFromCrmSync from a form's
 *  steps JSON. Tolerant of malformed step data (returns only what parses). */
export function collectCrmSuppressedLabels(steps: unknown): Set<string> {
  const suppressed = new Set<string>();
  if (!Array.isArray(steps)) return suppressed;
  for (const step of steps as StepLike[]) {
    const fields = step?.fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields as SuppressibleField[]) {
      if (field?.excludeFromCrmSync === true && typeof field.label === "string" && field.label) {
        suppressed.add(field.label);
      }
    }
  }
  return suppressed;
}

/** Return a copy of the submitted fields without the suppressed labels.
 *  Returns the original object untouched when nothing is suppressed. */
export function omitSuppressedFields(
  fields: Record<string, unknown>,
  suppressed: Set<string>,
): Record<string, unknown> {
  if (suppressed.size === 0) return fields;
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !suppressed.has(key)));
}
