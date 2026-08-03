/**
 * Audiences — the console's ONE saved-group concept.
 *
 * There used to be three, and a rep had to learn all of them:
 *   - "Saved views" on Accounts and the dashboard: account filter criteria, in
 *     localStorage.
 *   - "Saved lists" on Pages: a set of account ids, also in localStorage.
 *   - "Audiences" on Contacts: contacts, in the database, and the only one
 *     campaigns could actually use.
 *
 * They are all the same idea — a named definition of "who" — so they are all
 * audiences now, stored server-side in `sales_audiences`. The two localStorage
 * ones were also a quiet data-loss bug: they never followed a rep to another
 * browser or machine, and clearing site data wiped them.
 *
 * A definition is either CRITERIA (re-evaluated on read, so it picks up
 * accounts that later qualify) or EXPLICIT IDS (a fixed snapshot). Both live in
 * the same `filters` blob; see the server's AudienceFilters for the contract.
 */

const API_BASE = "/api";

export interface AudienceFilters {
  /** Explicit people. Short-circuits every other filter when present. */
  contactIds?: number[];
  /** Explicit accounts — what a Pages "saved list" was. */
  accountIds?: number[];
  // Account criteria — what an Accounts "saved view" was.
  owners?: string[];
  abmTiers?: string[];
  abmStages?: string[];
  practiceSegments?: string[];
  // Contact criteria.
  titleKeywords?: string[];
  departments?: string[];
  contactRoles?: string[];
  statuses?: string[];
  tiers?: string[];
  titleLevels?: string[];
}

export interface Audience {
  id: number;
  name: string;
  description: string | null;
  filters: AudienceFilters;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

/** True when the audience is defined by criteria rather than a fixed id list —
 *  i.e. it will pick up newly-matching records on its own. */
export function isDynamic(a: Audience): boolean {
  const f = a.filters ?? {};
  return !(f.contactIds?.length || f.accountIds?.length);
}

/** Human summary of what an audience selects, for list rows and pickers. */
export function describeAudience(a: Audience): string {
  const f = a.filters ?? {};
  if (f.contactIds?.length) return `${f.contactIds.length} contact${f.contactIds.length === 1 ? "" : "s"}`;
  if (f.accountIds?.length) return `${f.accountIds.length} account${f.accountIds.length === 1 ? "" : "s"}`;
  const parts: string[] = [];
  if (f.owners?.length) parts.push(f.owners.length === 1 ? `owned by ${f.owners[0]}` : `${f.owners.length} owners`);
  if (f.abmTiers?.length) parts.push(f.abmTiers.join(", "));
  if (f.abmStages?.length) parts.push(f.abmStages.join(", "));
  if (f.practiceSegments?.length) parts.push(f.practiceSegments.join(", "));
  if (f.titleLevels?.length) parts.push(f.titleLevels.join(", "));
  return parts.length > 0 ? parts.join(" · ") : "Everyone";
}

export async function listAudiences(): Promise<Audience[]> {
  const res = await fetch(`${API_BASE}/sales/audiences`);
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export async function createAudience(input: {
  name: string;
  description?: string;
  filters: AudienceFilters;
}): Promise<Audience | null> {
  const res = await fetch(`${API_BASE}/sales/audiences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.ok ? (await res.json()) as Audience : null;
}

export async function updateAudience(
  id: number,
  input: { name?: string; description?: string; filters?: AudienceFilters },
): Promise<Audience | null> {
  const res = await fetch(`${API_BASE}/sales/audiences/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.ok ? (await res.json()) as Audience : null;
}

export async function deleteAudience(id: number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/sales/audiences/${id}`, { method: "DELETE" });
  return res.ok;
}

// ─── One-time migration off localStorage ─────────────────────────────────────

/**
 * Legacy shapes. Kept only so the first load after this ships can lift a rep's
 * existing saved views/lists into the database instead of appearing to delete
 * their work. The keys are namespaced per user id, which is why the caller
 * passes them in.
 */
interface LegacySavedView {
  id: string;
  name: string;
  filters?: {
    ownerFilters?: string[];
    abmTierFilters?: string[];
    abmStageFilters?: string[];
    segmentFilters?: string[];
  };
}

interface LegacySavedList {
  id: string;
  name: string;
  accountIds: number[];
}

/** Marker so a successful migration never runs twice, even if the rep deletes
 *  the audiences it created (re-importing them would be worse than losing
 *  them). */
const MIGRATED_KEY = "sc_audiences_migrated_v1";

function alreadyMigrated(scope: string): boolean {
  try { return localStorage.getItem(`${MIGRATED_KEY}:${scope}`) === "1"; } catch { return false; }
}

function markMigrated(scope: string): void {
  try { localStorage.setItem(`${MIGRATED_KEY}:${scope}`, "1"); } catch { /* private mode — retry next load */ }
}

/**
 * Lift legacy localStorage saved views into audiences. Idempotent per browser,
 * and skips names that already exist server-side so two of a rep's browsers
 * don't create duplicates of the same view.
 *
 * Best-effort by design: a failure here must never block the page. The worst
 * case is that the rep re-creates a view.
 */
export async function migrateLegacySavedViews(
  viewsKey: string | null,
  existing: Audience[],
): Promise<Audience[]> {
  if (!viewsKey || alreadyMigrated(viewsKey)) return [];
  let legacy: LegacySavedView[] = [];
  try {
    legacy = JSON.parse(localStorage.getItem(viewsKey) ?? "[]");
  } catch { return []; }
  if (!Array.isArray(legacy) || legacy.length === 0) { markMigrated(viewsKey); return []; }

  const taken = new Set(existing.map(a => a.name.trim().toLowerCase()));
  const created: Audience[] = [];
  for (const v of legacy) {
    const name = (v?.name ?? "").trim();
    if (!name || taken.has(name.toLowerCase())) continue;
    const f = v.filters ?? {};
    const audience = await createAudience({
      name,
      description: "Imported from a saved view.",
      filters: {
        owners: f.ownerFilters ?? [],
        abmTiers: f.abmTierFilters ?? [],
        abmStages: f.abmStageFilters ?? [],
        practiceSegments: f.segmentFilters ?? [],
      },
    }).catch(() => null);
    if (audience) { created.push(audience); taken.add(name.toLowerCase()); }
  }
  markMigrated(viewsKey);
  return created;
}

/** Same, for the Pages page's account-id "saved lists". */
export async function migrateLegacySavedLists(
  listsKey: string,
  existing: Audience[],
): Promise<Audience[]> {
  if (alreadyMigrated(listsKey)) return [];
  let legacy: LegacySavedList[] = [];
  try {
    legacy = JSON.parse(localStorage.getItem(listsKey) ?? "[]");
  } catch { return []; }
  if (!Array.isArray(legacy) || legacy.length === 0) { markMigrated(listsKey); return []; }

  const taken = new Set(existing.map(a => a.name.trim().toLowerCase()));
  const created: Audience[] = [];
  for (const l of legacy) {
    const name = (l?.name ?? "").trim();
    if (!name || taken.has(name.toLowerCase())) continue;
    const accountIds = Array.isArray(l.accountIds) ? l.accountIds.filter(n => typeof n === "number") : [];
    if (accountIds.length === 0) continue;
    const audience = await createAudience({
      name,
      description: "Imported from a saved list.",
      filters: { accountIds },
    }).catch(() => null);
    if (audience) { created.push(audience); taken.add(name.toLowerCase()); }
  }
  markMigrated(listsKey);
  return created;
}
