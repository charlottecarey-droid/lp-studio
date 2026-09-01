/**
 * Pure email/domain string helpers, extracted from signalAttribution so
 * modules that only need string work (e.g. the assumed-email guesser behind
 * the signals CSV export) don't transitively import the db client — which
 * throws at import time when DATABASE_URL is unset, breaking pure unit tests.
 * signalAttribution re-exports these, so existing importers are unaffected.
 */

/** Normalise a domain string — strip protocol, www., path, lowercase, trim. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  if (!d) return null;
  // Tolerate a full URL or an email-derived domain being passed in.
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  d = d.trim();
  return d || null;
}

/**
 * Free / personal email providers whose domain tells us NOTHING about the
 * visitor's company. We must never derive a "company domain" from these — a
 * gmail.com address is not Gmail Inc., and matching on it would mis-attribute
 * every consumer-email visitor to the same bogus account.
 */
const FREE_EMAIL_DOMAINS = new Set<string>([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "aol.com", "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.net", "mail.com", "zoho.com", "yandex.com",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net",
  "bellsouth.net", "cox.net", "charter.net", "earthlink.net",
]);

/**
 * Derive a company domain from a corporate email address. Returns the lowercased
 * domain after the `@`, or null when the input is empty, malformed, or a known
 * free/personal provider (so we never enrich a consumer address into a fake
 * company domain). Pure string work — no fuzzy matching, fully deterministic.
 */
export function deriveDomainFromEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  const domain = trimmed.split("@")[1]?.trim();
  if (!domain || !domain.includes(".")) return null;
  if (FREE_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}
