/**
 * Shared derivation of the business-case template personalization values
 * ({{company_name}} / {{practice_count}}). Both the generation-time bake
 * (generate-microsite.ts) and the view-time hotlink resolver (hotlinks.ts)
 * derive these tokens through here so a personalized page renders the SAME
 * values whether the tokens were substituted at generation time or resolved
 * live at view time.
 */

export function deriveCompanyName(
  account: { displayName?: string | null; name?: string | null } | null | undefined,
): string {
  return (account?.displayName ?? account?.name ?? "").trim();
}

export function derivePracticeCount(
  briefingData: Record<string, unknown> | null | undefined,
  account?: { numLocations?: number | null } | null,
): string {
  const sizeAndLocations = briefingData?.sizeAndLocations as
    | Record<string, unknown>
    | undefined;
  const rawCount = sizeAndLocations?.locationCount;
  if (rawCount != null && String(rawCount).trim() !== "") {
    return String(rawCount).trim();
  }
  if (account?.numLocations != null) return String(account.numLocations);
  return "multiple";
}
