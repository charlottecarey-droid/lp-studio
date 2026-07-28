/**
 * Personalise an agenda's copy at publish time.
 *
 * The publish route used to write the account name into three specific fields
 * (hero headline, subheadline, CTA). Anything else an author wrote — a section
 * headline, a personal note, a resource title — kept its literal
 * `{{company_name}}` on the live page.
 *
 * This substitutes across EVERY string in the block's props instead, so a
 * token works wherever it's typed.
 *
 * TWO RULES THAT MATTER:
 *
 * 1. UNKNOWN TOKENS ARE LEFT ALONE. The same `{{…}}` syntax is used by DTR
 *    (`lib/dtr.ts`), which resolves `{{keyword}}`, `{{city}}` and friends from
 *    the VISITOR's URL parameters at runtime. Blanking unknown tokens here —
 *    which is what the email renderer does — would silently break every
 *    dynamic-text page. Leaving them intact also means a typo stays visible to
 *    the author instead of quietly deleting their copy.
 *
 * 2. NO HTML ESCAPING. These values land in React text props, which escape on
 *    render. Escaping here would double-encode "Smith & Jones" into
 *    "Smith &amp; Jones" on the page.
 */

/** Same shape the email renderer matches, so authors only learn one syntax. */
const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g;

export interface AgendaTokenFacts {
  accountName: string;
  eventName?: string;
  eventLocation?: string;
  eventDates?: string;
  /** Whoever the agenda is signed by, when we know. */
  senderName?: string;
}

/**
 * Build the substitution map.
 *
 * Several spellings map to the same value on purpose. `company` is the
 * canonical token elsewhere in the app (lib/notification-variables), but
 * `company_name` and `account_name` are what people actually type, and a
 * token that silently does nothing is worse than a redundant alias.
 */
export function buildAgendaTokens(facts: AgendaTokenFacts): Record<string, string> {
  const account = facts.accountName?.trim() ?? "";
  const vars: Record<string, string> = {
    company: account,
    company_name: account,
    companyname: account,
    account: account,
    account_name: account,
    accountname: account,
    customer: account,
    customer_name: account,
  };
  const add = (value: string | undefined, ...keys: string[]) => {
    const v = (value ?? "").trim();
    if (!v) return;
    for (const k of keys) vars[k] = v;
  };
  add(facts.eventName, "event", "event_name", "eventname");
  // NOT "city": DTR already owns `{{city}}` as the VISITOR's city, resolved
  // from URL params at runtime. Claiming it here would silently overwrite that
  // with the venue on every agenda page.
  add(facts.eventLocation, "location", "event_location", "eventlocation");
  add(facts.eventDates, "dates", "event_dates", "eventdates");
  add(facts.senderName, "sender_name", "sendername", "rep_name", "repname");
  return vars;
}

export interface InterpolateReport {
  /** How many token occurrences were replaced. */
  replaced: number;
  /** Distinct tokens we left alone because we had no value for them. Surfaced
   *  so the UI can say "you typed {{compnay}} and nothing filled it in" —
   *  DTR tokens legitimately show up here too. */
  unknown: string[];
}

/** Substitute one string. */
export function interpolateText(
  text: string,
  vars: Record<string, string>,
  report?: InterpolateReport,
): string {
  return text.replace(TOKEN_RE, (match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const value = vars[key];
    if (value === undefined) {
      if (report && !report.unknown.includes(rawKey)) report.unknown.push(rawKey);
      return match; // rule 1 — leave it for DTR / leave the typo visible
    }
    if (report) report.replaced += 1;
    return value;
  });
}

/**
 * Recursively substitute through a props tree: strings, arrays, and plain
 * objects. Non-plain values (numbers, booleans, null, Date) pass through
 * untouched, and object KEYS are never rewritten.
 */
export function interpolateDeep<T>(value: T, vars: Record<string, string>, report?: InterpolateReport): T {
  if (typeof value === "string") {
    return interpolateText(value, vars, report) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => interpolateDeep(v, vars, report)) as unknown as T;
  }
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateDeep(v, vars, report);
    }
    return out as unknown as T;
  }
  return value;
}

/** Convenience: substitute a whole props object and report what happened. */
export function personalizeAgendaProps<T extends Record<string, unknown>>(
  props: T,
  facts: AgendaTokenFacts,
): { props: T; report: InterpolateReport } {
  const report: InterpolateReport = { replaced: 0, unknown: [] };
  const vars = buildAgendaTokens(facts);
  return { props: interpolateDeep(props, vars, report), report };
}
