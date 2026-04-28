import type { ChiliPiperHandoffConfig } from "@/lib/block-types";

/**
 * Default Marketo → Chili Piper field mapping. Marketo's REST field names
 * use a mix of casings depending on how the form was built (legacy fields
 * are PascalCase, newer ones are camelCase), so the defaults cover both
 * variants and converge on Chili Piper's documented prefill keys
 * (https://help.chilipiper.com/hc/en-us/articles/360036013713).
 *
 * Tenants can fully override this via `chiliPiperConfig.fieldMap`.
 */
// Each entry maps one source field name (Marketo REST key OR a native
// lp-studio form's label) to the Chili Piper query-param key(s) we should
// write the value under.
//
// Why arrays? Chili Piper concierge / inbound-router URLs accept *both*
// camelCase (`?firstName=…`) and lowercase (`?firstname=…`) for prefill,
// but the casing a given router actually consumes depends on how the
// router's form was built — there is no portable convention. Writing both
// spellings every time is harmless (the router silently drops keys it
// doesn't know) and means the prefill works regardless of the router's
// internal config, so the visitor never sees an empty First/Last name
// field on the scheduler page.
const DEFAULT_FIELD_MAP: Record<string, string | string[]> = {
  Email: "email",
  email: "email",
  EmailAddress: "email",
  // Native lp-studio forms label this field "Email Address" by default.
  "Email Address": "email",
  FirstName: ["firstName", "firstname"],
  firstName: ["firstName", "firstname"],
  "First Name": ["firstName", "firstname"],
  LastName: ["lastName", "lastname"],
  lastName: ["lastName", "lastname"],
  "Last Name": ["lastName", "lastname"],
  Phone: "phone",
  phone: "phone",
  PhoneNumber: "phone",
  // Native default phone-field label.
  "Phone Number": "phone",
  Company: ["company", "companyName"],
  company: ["company", "companyName"],
  CompanyName: ["company", "companyName"],
  "Company Name": ["company", "companyName"],
  Title: ["title", "jobTitle"],
  title: ["title", "jobTitle"],
  JobTitle: ["title", "jobTitle"],
  Country: "country",
  country: "country",
  State: "state",
  state: "state",
};

/**
 * Append `vals` to the Chili Piper URL as query parameters using the
 * configured (or default) Marketo→CP field map. Empty values are skipped.
 *
 * - Existing query params on the URL are preserved.
 * - The same CP key is only set once even if multiple Marketo fields map to
 *   it (first non-empty value wins) — guarantees deterministic URLs.
 * - Falls back to plain string concatenation if `URL` parsing fails so a
 *   slightly-malformed scheduler link still gets a hand-off attempt.
 */
export function buildChiliPiperHandoffUrl(
  config: ChiliPiperHandoffConfig,
  vals: Record<string, string>,
): string {
  const fieldMap: Record<string, string | string[]> = {
    ...DEFAULT_FIELD_MAP,
    ...(config.fieldMap ?? {}),
  };

  // Resolve the (cpKey -> value) pairs once so we don't trip the
  // "first non-empty wins" rule when multiple aliases map to the same key.
  // A single source field may fan out to multiple CP keys (e.g. both
  // `firstName` and `firstname`) so each target key is recorded separately.
  const params: [string, string][] = [];
  const seen = new Set<string>();
  for (const [sourceKey, cpKeyOrKeys] of Object.entries(fieldMap)) {
    const raw = vals[sourceKey];
    if (typeof raw !== "string" || raw.length === 0) continue;
    const cpKeys = Array.isArray(cpKeyOrKeys) ? cpKeyOrKeys : [cpKeyOrKeys];
    for (const cpKey of cpKeys) {
      if (!cpKey || seen.has(cpKey)) continue;
      params.push([cpKey, raw]);
      seen.add(cpKey);
    }
  }

  if (params.length === 0) return config.url;

  try {
    const url = new URL(config.url);
    for (const [k, v] of params) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  } catch {
    // Malformed URL — fall back to manual append so the user still
    // reaches the scheduler.
    const sep = config.url.includes("?") ? "&" : "?";
    const qs = params
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return `${config.url}${sep}${qs}`;
  }
}
