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
const DEFAULT_FIELD_MAP: Record<string, string> = {
  Email: "email",
  email: "email",
  EmailAddress: "email",
  FirstName: "firstName",
  firstName: "firstName",
  "First Name": "firstName",
  LastName: "lastName",
  lastName: "lastName",
  "Last Name": "lastName",
  Phone: "phone",
  phone: "phone",
  PhoneNumber: "phone",
  Company: "company",
  company: "company",
  CompanyName: "company",
  Title: "title",
  title: "title",
  JobTitle: "title",
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
  const fieldMap = { ...DEFAULT_FIELD_MAP, ...(config.fieldMap ?? {}) };

  // Resolve the (cpKey -> value) pairs once so we don't trip the
  // "first non-empty wins" rule when multiple aliases map to the same key.
  const params: [string, string][] = [];
  const seen = new Set<string>();
  for (const [marketoKey, cpKey] of Object.entries(fieldMap)) {
    if (!cpKey || seen.has(cpKey)) continue;
    const raw = vals[marketoKey];
    if (typeof raw !== "string" || raw.length === 0) continue;
    params.push([cpKey, raw]);
    seen.add(cpKey);
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
