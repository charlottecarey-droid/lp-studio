/**
 * CRM-facing field shaping for global forms.
 *
 * A global form's field defs (lp_forms.steps) may flag individual fields with
 * `excludeFromCrmSync: true`. Those fields are still captured on the lead and
 * still flow to email notifications, Google Sheets, Slack, and webhooks — but
 * they are stripped from the CRM/marketing sync payloads (Marketo, HubSpot,
 * Salesforce). Rationale: Marketo's createOrUpdate is all-or-nothing — a
 * single field name that doesn't exist in the Marketo instance causes the
 * ENTIRE lead to be skipped, so custom-only fields must never reach it.
 *
 * For the same reason, a global-form submission's CRM payload is an
 * ALLOWLIST rebuilt from the form definition (buildGlobalFormCrmFields):
 * only the form's own fields — in definition order — plus submitted keys
 * explicitly named in the per-form CRM field mappings. Producers like the
 * chat-capture bot attach extra keys ("Chat Summary", "Source",
 * "_chatConversationId") that would otherwise poison the whole sync.
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

const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Build the CRM-facing view of a global-form submission: the form's own
 * fields in DEFINITION order (minus excludeFromCrmSync), then any extra
 * submitted keys explicitly named in the per-form CRM field mappings —
 * an explicit mapping is an opt-in, so e.g. mapping "Chat Summary" lets
 * the chat bot's notes through. Everything else the producer attached is
 * dropped, so a chat-capture lead syncs with exactly the fields (and
 * order) a plain form submission would.
 */
export function buildGlobalFormCrmFields(
  steps: unknown,
  fields: Record<string, unknown>,
  mappedLabels: Iterable<string> = [],
): Record<string, unknown> {
  const suppressed = collectCrmSuppressedLabels(steps);
  const out: Record<string, unknown> = {};
  const formLabels: string[] = [];

  if (Array.isArray(steps)) {
    for (const step of steps as StepLike[]) {
      const defs = step?.fields;
      if (!Array.isArray(defs)) continue;
      for (const def of defs as SuppressibleField[]) {
        const label = typeof def?.label === "string" ? def.label : "";
        if (!label || suppressed.has(label)) continue;
        formLabels.push(label);
        if (has(fields, label) && !has(out, label)) out[label] = fields[label];
      }
    }
  }

  for (const label of mappedLabels) {
    if (!label || suppressed.has(label) || has(out, label)) continue;
    if (has(fields, label)) out[label] = fields[label];
  }

  // Email rescue: the CRMs key on email (Marketo lookupField, HubSpot
  // id-property), so a payload without one is dead on arrival. If the bot
  // filed the email under a fallback key ("Email") instead of the form's
  // own label, carry it over — under the form's email-ish label when one
  // exists so the per-form mapping still applies. Suppressed email fields
  // stay suppressed.
  const emailish = (k: string) => /email/i.test(k);
  if (!Object.keys(out).some(emailish)) {
    const submittedKey = Object.keys(fields).find(k => emailish(k) && !suppressed.has(k));
    if (submittedKey) {
      const formEmailLabel = formLabels.find(emailish);
      out[formEmailLabel ?? submittedKey] = fields[submittedKey];
    }
  }

  return out;
}
