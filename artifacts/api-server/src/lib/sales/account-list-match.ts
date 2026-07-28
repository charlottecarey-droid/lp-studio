/**
 * Match an uploaded account list against the accounts already in the system,
 * so a target list from a spreadsheet becomes a campaign audience.
 *
 * The output feeds `sales_audiences.filters.accountIds`, which the existing
 * audience machinery resolves to contacts — so this module deliberately does
 * NOT create a new list concept. It only answers "which of our accounts are
 * these rows?".
 *
 * DESIGN RULE, because this drives EMAIL: a fuzzy match is never applied
 * automatically. Domain matches and exact/normalised name matches are
 * confident enough to include; anything looser is returned as a candidate for
 * a human to confirm. Mailing the wrong company is far worse than leaving a
 * row out, and a silent 90%-confident guess is exactly how that happens.
 *
 * Ambiguity is surfaced, never resolved by picking the first hit.
 */

export interface AccountListRow {
  /** The original line/cell, for showing the user what didn't match. */
  raw: string;
  name?: string;
  domain?: string;
}

export interface SystemAccount {
  id: number;
  name: string;
  displayName?: string | null;
  domain?: string | null;
}

export type MatchMethod = "domain" | "name-exact" | "name-normalized";

export interface AccountMatch {
  input: AccountListRow;
  accountId: number;
  accountName: string;
  method: MatchMethod;
}

export interface AmbiguousMatch {
  input: AccountListRow;
  /** Two or more accounts fit equally well — the user picks, we don't. */
  candidates: { accountId: number; accountName: string; method: MatchMethod }[];
}

export interface ConflictMatch {
  input: AccountListRow;
  /** The row's domain and name point at DIFFERENT accounts. */
  byDomain: { accountId: number; accountName: string };
  byName: { accountId: number; accountName: string };
}

export interface AccountMatchResult {
  matched: AccountMatch[];
  ambiguous: AmbiguousMatch[];
  conflicts: ConflictMatch[];
  unmatched: AccountListRow[];
  /** Input rows that resolved to an account another row already claimed. */
  duplicates: { input: AccountListRow; accountId: number; accountName: string }[];
}

/* ── normalisation ─────────────────────────────────────────────────────── */

/**
 * Reduce anything domain-shaped to a bare host: URLs, emails, and values with
 * a stray path or port all collapse to `acme.com`.
 *
 * `www.` is stripped but no other subdomain is — `shop.acme.com` and
 * `acme.com` are genuinely different hosts and guessing they're the same
 * company is the kind of leap that mails the wrong list.
 */
export function normalizeDomain(value: string): string {
  let v = value.trim().toLowerCase();
  if (!v) return "";
  const at = v.lastIndexOf("@");
  if (at >= 0) v = v.slice(at + 1); // an email address → its domain
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  v = v.split("/")[0].split("?")[0].split("#")[0]; // path/query/fragment
  v = v.split(":")[0]; // port
  v = v.replace(/^www\./, "").replace(/\.+$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v) ? v : "";
}

/** Legal suffixes and decorations that differ between a CRM and a spreadsheet
 *  without changing which company is meant. */
const LEGAL_SUFFIX_RE =
  /\b(?:inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|nv|bv|sa|srl|spa|oy|ab|as|pty|pte|llp|lp|holdings?|group)\b/g;

/**
 * Fold a company name to a comparable key.
 *
 * Note "group" and "holdings" ARE stripped: "Acme Dental Group" and "Acme
 * Dental" are the same account in every list we've seen. That's a deliberate
 * trade — it can over-merge two genuinely different entities, which is why a
 * normalised-name match is still shown in the review step rather than applied
 * blind.
 */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'’"`()]/g, "")
    .replace(/[-–—_/\\]+/g, " ")
    .replace(LEGAL_SUFFIX_RE, " ")
    .replace(/^\s*the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── input parsing ─────────────────────────────────────────────────────── */

const NAME_HEADERS = ["account", "account name", "company", "company name", "name", "organization", "organisation", "customer", "dso"];
const DOMAIN_HEADERS = ["domain", "website", "web site", "url", "site", "web", "email", "email domain"];

const splitLine = (line: string): string[] => {
  // Minimal CSV/TSV split: quoted cells, comma or tab separated.
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === "\t") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

/** Does this bare value look like a domain rather than a company name? */
const looksLikeDomain = (v: string): boolean => normalizeDomain(v) !== "" && !/\s/.test(v.trim());

/**
 * Parse pasted text or an uploaded CSV into rows.
 *
 * Handles: a header row naming the columns (in any order, any casing), or no
 * header at all — in which case each value is classified as a domain or a name
 * on its shape. One column or two, comma or tab.
 */
export function parseAccountList(text: string): AccountListRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (lines.length === 0) return [];

  const firstCells = splitLine(lines[0]).map((c) => c.toLowerCase());
  const nameIdx = firstCells.findIndex((c) => NAME_HEADERS.includes(c));
  const domainIdx = firstCells.findIndex((c) => DOMAIN_HEADERS.includes(c));
  const hasHeader = nameIdx >= 0 || domainIdx >= 0;

  const rows: AccountListRow[] = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = splitLine(line);
    if (cells.every((c) => c === "")) continue;
    const row: AccountListRow = { raw: line };

    if (hasHeader) {
      const name = nameIdx >= 0 ? cells[nameIdx] ?? "" : "";
      const domain = domainIdx >= 0 ? cells[domainIdx] ?? "" : "";
      if (name) row.name = name;
      if (domain) row.domain = domain;
      // A "name" column holding a URL is still a domain.
      if (!row.domain && row.name && looksLikeDomain(row.name)) {
        row.domain = row.name;
        delete row.name;
      }
    } else {
      for (const cell of cells) {
        if (!cell) continue;
        if (!row.domain && looksLikeDomain(cell)) row.domain = cell;
        else if (!row.name) row.name = cell;
      }
    }
    if (row.name || row.domain) rows.push(row);
  }
  return rows;
}

/* ── matching ──────────────────────────────────────────────────────────── */

interface Indexed {
  byDomain: Map<string, SystemAccount[]>;
  byExactName: Map<string, SystemAccount[]>;
  byNormName: Map<string, SystemAccount[]>;
}

function indexAccounts(accounts: SystemAccount[]): Indexed {
  const byDomain = new Map<string, SystemAccount[]>();
  const byExactName = new Map<string, SystemAccount[]>();
  const byNormName = new Map<string, SystemAccount[]>();
  const push = (m: Map<string, SystemAccount[]>, k: string, a: SystemAccount) => {
    if (!k) return;
    const list = m.get(k);
    if (list) { if (!list.some((x) => x.id === a.id)) list.push(a); }
    else m.set(k, [a]);
  };
  for (const a of accounts) {
    push(byDomain, normalizeDomain(a.domain ?? ""), a);
    // Both the raw and the display name are legitimate handles for an account.
    for (const n of [a.name, a.displayName ?? ""]) {
      if (!n) continue;
      push(byExactName, n.trim().toLowerCase(), a);
      push(byNormName, normalizeName(n), a);
    }
  }
  return { byDomain, byExactName, byNormName };
}

const label = (a: SystemAccount): string => (a.displayName?.trim() || a.name).trim();

/**
 * Match rows against accounts.
 *
 * Precedence: domain, then exact name, then normalised name. Domain wins
 * because it's the only identifier in a target list that's actually unique —
 * two different companies routinely share a name, never a domain.
 */
export function matchAccountList(
  rows: AccountListRow[],
  accounts: SystemAccount[],
): AccountMatchResult {
  const idx = indexAccounts(accounts);
  const matched: AccountMatch[] = [];
  const ambiguous: AmbiguousMatch[] = [];
  const conflicts: ConflictMatch[] = [];
  const unmatched: AccountListRow[] = [];
  const duplicates: AccountMatchResult["duplicates"] = [];
  const claimed = new Map<number, string>(); // accountId → the row that claimed it

  for (const row of rows) {
    const domainHits = row.domain ? idx.byDomain.get(normalizeDomain(row.domain)) ?? [] : [];
    const exactHits = row.name ? idx.byExactName.get(row.name.trim().toLowerCase()) ?? [] : [];
    const normHits = row.name ? idx.byNormName.get(normalizeName(row.name)) ?? [] : [];

    const nameHits = exactHits.length > 0 ? exactHits : normHits;
    const nameMethod: MatchMethod = exactHits.length > 0 ? "name-exact" : "name-normalized";

    // Domain and name each resolve to exactly one account, but not the same
    // one — a real signal that the row is wrong, not something to average out.
    if (domainHits.length === 1 && nameHits.length === 1 && domainHits[0].id !== nameHits[0].id) {
      conflicts.push({
        input: row,
        byDomain: { accountId: domainHits[0].id, accountName: label(domainHits[0]) },
        byName: { accountId: nameHits[0].id, accountName: label(nameHits[0]) },
      });
      continue;
    }

    const hits = domainHits.length > 0 ? domainHits : nameHits;
    const method: MatchMethod = domainHits.length > 0 ? "domain" : nameMethod;

    if (hits.length === 0) { unmatched.push(row); continue; }
    if (hits.length > 1) {
      ambiguous.push({
        input: row,
        candidates: hits.map((a) => ({ accountId: a.id, accountName: label(a), method })),
      });
      continue;
    }

    const account = hits[0];
    const priorRow = claimed.get(account.id);
    if (priorRow !== undefined) {
      duplicates.push({ input: row, accountId: account.id, accountName: label(account) });
      continue;
    }
    claimed.set(account.id, row.raw);
    matched.push({ input: row, accountId: account.id, accountName: label(account), method });
  }

  return { matched, ambiguous, conflicts, unmatched, duplicates };
}

/** The account ids to hand to `sales_audiences.filters.accountIds`. */
export function matchedAccountIds(result: AccountMatchResult): number[] {
  return [...new Set(result.matched.map((m) => m.accountId))];
}
