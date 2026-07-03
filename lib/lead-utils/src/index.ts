/**
 * Shared lead helpers used by both the api-server (backend) and lp-studio
 * (frontend). Keeping the field extraction + test-lead heuristic in one place
 * means "what counts as a test/junk lead" stays identical across the dashboard
 * widget, the master leads list, the per-page list, and the summary counts.
 */

export type LeadFields = Record<string, unknown>;

/**
 * Build a normalized accessor over a lead's submitted fields. Form authors use
 * wildly varying keys ("first_name", "First Name", "firstName"), so we index
 * each value under a normalized key (lowercase, alphanumerics only). The first
 * non-empty value per normalized key wins, so an empty "first_name" can't
 * shadow a populated "First Name" synonym.
 */
export function fieldAccessor(fields: LeadFields): (...keys: string[]) => string {
  const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string") continue;
    const nk = normKey(k);
    const val = v.trim();
    if (nk && val && norm[nk] === undefined) norm[nk] = val;
  }
  return (...keys: string[]): string => {
    for (const k of keys) {
      const v = norm[normKey(k)];
      if (v) return v;
    }
    return "";
  };
}

/**
 * Pulls a human name out of a lead's submitted fields, matching the common
 * shapes (name / fullName / firstName + lastName) via the normalized accessor.
 * Returns null when no usable name is present.
 */
export function leadName(fields: LeadFields): string | null {
  const get = fieldAccessor(fields);
  const full = get("name", "fullName", "full_name");
  if (full) return full;
  const first = get("firstName", "first_name");
  const last = get("lastName", "last_name");
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return null;
}

/**
 * Pulls a contact email out of a lead's submitted fields.
 */
export function leadEmail(fields: LeadFields): string {
  const get = fieldAccessor(fields);
  return get("email", "workEmail", "work_email", "emailAddress");
}

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function isKeyboardRun(token: string): boolean {
  if (token.length < 4) return false;
  return KEYBOARD_ROWS.some(
    (row) => row.includes(token) || [...row].reverse().join("").includes(token),
  );
}

/**
 * Heuristic for "this name looks like random/keyboard-mash gibberish" — e.g.
 * "asdfgh", "qwerty", "qwxz". Deliberately conservative so it won't flag real
 * short names: only judges alphabetic tokens of length >= 4, treats "y" as a
 * vowel (so "Lynn" stays valid), and only applies the vowel/consonant-run
 * rules to single-token names (real people usually submit first + last).
 */
export function looksLikeGibberishName(name: string): boolean {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return false;
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  // Keyboard mash in any token (e.g. "asdfgh", "qwerty").
  if (tokens.some((t) => /^[a-z]+$/.test(t) && isKeyboardRun(t))) return true;

  // The vowel / consonant-run rules only judge a single-token name, since a
  // multi-word string is far less likely to be random mash.
  if (tokens.length === 1) {
    const t = tokens[0];
    if (/^[a-z]+$/.test(t) && t.length >= 4) {
      // No vowels at all (treating y as a vowel) → "qwxz", "bcdfg".
      if (!/[aeiouy]/.test(t)) return true;
      // Improbable run of 5+ consecutive consonants.
      if (/[^aeiouy]{5,}/.test(t)) return true;
    }
  }
  return false;
}

/**
 * Heuristic for "this looks like a test/junk submission". The leads table has
 * no test flag, so we sniff common throw-away patterns: disposable/test email
 * domains, "test"/"+test"/"qa"/"demo" local parts, filler names like
 * "Test User" / "John Doe", and gibberish names made of random/keyboard-mash
 * letters. Used to keep day-to-day lead lists and counts focused on real
 * activity (the leads themselves are hidden, not deleted, until a user acts).
 */
export function isTestLead(fields: LeadFields): boolean {
  const get = fieldAccessor(fields);
  const email = get("email", "workEmail", "work_email", "emailAddress").toLowerCase();
  if (email) {
    if (/@(example\.(com|org|net)|test\.com|mailinator\.com|tempmail\.[a-z]+|10minutemail\.[a-z]+|yopmail\.com)$/i.test(email)) return true;
    const local = email.split("@")[0] ?? "";
    if (/^test(\d+)?$/.test(local) || /\+test/.test(local) || /^qa([._+-]|\d|$)/.test(local) || local === "demo") return true;
  }
  const name = (get("name", "fullName", "full_name") || `${get("firstName", "first_name")} ${get("lastName", "last_name")}`.trim()).toLowerCase();
  if (name) {
    if (/^(test( user)?|testing|john doe|jane doe|asdf+|qwerty|foo( bar)?)$/i.test(name)) return true;
    if (/\btest\b/.test(name) && name.length < 20) return true;
    if (looksLikeGibberishName(name)) return true;
  }
  return false;
}

/**
 * Clean display form of a CRM account name (July 2026). Imported account
 * names carry dedupe/location decoration the UI and generated pages should
 * never show: "Heartland Dental-HQ", "Bridge Dental Group- HQ",
 * "TAG - The Aspen Group (Aspen Dental)-HQ", "Acme Dental, LLC". Strips
 * trailing "HQ"-style decoration (with any separator/bracket) and trailing
 * corporate suffixes, preserving the original casing of what remains. Falls
 * back to the trimmed input when stripping would leave nothing. This is the
 * DISPLAY form — matching uses its own lowercased normalization
 * (signalAttribution.normalizeCompanyName), deliberately separate.
 */
export function cleanAccountDisplayName(raw: string | null | undefined): string {
  const original = (raw ?? "").trim();
  if (!original) return "";
  let out = original;
  // Trailing "HQ" decoration: "-HQ", "- HQ", "–HQ", "(HQ)", "[HQ]", " HQ"
  out = out.replace(/[\s\-–—]*[([]?\s*HQ\s*[)\]]?$/i, "").trim();
  // Trailing corporate suffixes, with optional preceding comma/period
  out = out.replace(/[\s,]*\b(LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Ltd\.?|PLLC|P\.C\.)$/i, "").trim();
  // Leftover trailing separators from the stripping above
  out = out.replace(/[\s\-–—,]+$/, "").trim();
  return out.length >= 2 ? out : original;
}
