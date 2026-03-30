/**
 * Dynamic Text Replacement (DTR)
 *
 * Replaces {{param_name}} tokens in text with URL query parameter values.
 * Supports fallback text: {{param_name|fallback text}}
 *
 * Common tokens:
 *   {{keyword}}       - Google Ads keyword
 *   {{utm_source}}    - UTM source
 *   {{utm_medium}}    - UTM medium
 *   {{utm_campaign}}  - UTM campaign
 *   {{utm_term}}      - UTM term
 *   {{utm_content}}   - UTM content
 *   {{gclid}}         - Google click ID
 *   {{city}}          - Visitor city (if available)
 */

// Token pattern: {{param_name}} or {{param_name|fallback text}}
const TOKEN_RE = /\{\{([^{}|]+?)(?:\|([^{}]*?))?\}\}/g;

/** Parse URL search params once */
export function getDtrParams(): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const sp = new URLSearchParams(window.location.search);
    sp.forEach((value, key) => {
      params[key.toLowerCase()] = value;
    });
  } catch {
    // SSR or test environment
  }
  return params;
}

/** Replace all {{tokens}} in a string with URL param values */
export function replaceDtrTokens(text: string, params: Record<string, string>): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(TOKEN_RE, (_match, paramName: string, fallback?: string) => {
    const key = paramName.trim().toLowerCase();
    return params[key] ?? fallback?.trim() ?? "";
  });
}

/** Deep-walk an object/array and replace DTR tokens in all string values */
export function applyDtr<T>(value: T, params: Record<string, string>): T {
  if (!params || Object.keys(params).length === 0) return value;
  if (typeof value === "string") return replaceDtrTokens(value, params) as T;
  if (Array.isArray(value)) return value.map(item => applyDtr(item, params)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = applyDtr(v, params);
    }
    return result as T;
  }
  return value;
}

/** List of common DTR tokens for the UI token inserter */
export const DTR_TOKENS = [
  { token: "{{keyword}}", label: "Keyword", description: "Search keyword from ad" },
  { token: "{{utm_source}}", label: "UTM Source", description: "Traffic source" },
  { token: "{{utm_medium}}", label: "UTM Medium", description: "Marketing medium" },
  { token: "{{utm_campaign}}", label: "UTM Campaign", description: "Campaign name" },
  { token: "{{utm_term}}", label: "UTM Term", description: "Paid search term" },
  { token: "{{utm_content}}", label: "UTM Content", description: "Ad content variant" },
  { token: "{{city}}", label: "City", description: "Visitor's city" },
] as const;
