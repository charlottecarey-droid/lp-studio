// Sales-console account tier labels.
//
// Dandy uses its own internal ABM tier codes (ENT / STRAT / LENT). Every other
// tenant should see plain numeric tiers (1 / 2 / 3) instead of Dandy's jargon.
// `displayTier` maps known Dandy codes to their numeric equivalent for non-Dandy
// tenants and passes through anything it does not recognise (e.g. tiers imported
// from a CRM) so no data is hidden.

// Canonical stored tier codes. The value written to the database is ALWAYS one
// of these, regardless of tenant — only the visible label changes. This keeps
// new and imported records consistent and avoids ambiguous duplicate filters.
const CANONICAL_TIERS = ["ENT", "STRAT", "LENT"] as const;

const DANDY_CODE_TO_NUMBER: Record<string, string> = {
  ENT: "1",
  STRAT: "2",
  LENT: "3",
};

export interface TierOption {
  /** Canonical value persisted to the database. */
  value: string;
  /** Label shown to the user (numeric for non-Dandy tenants). */
  label: string;
}

/** Options shown in the "create / edit account" tier picker. */
export function tierOptions(isDandy: boolean): readonly TierOption[] {
  return CANONICAL_TIERS.map((value) => ({
    value,
    label: displayTier(value, isDandy),
  }));
}

/** Human-readable tier label for a stored tier value. */
export function displayTier(value: string | null | undefined, isDandy: boolean): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (isDandy) return v;
  return DANDY_CODE_TO_NUMBER[v.toUpperCase()] ?? v;
}
