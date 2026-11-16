/** Account names as a customer would write them. Shared by the automatic rooms and the practice sheet. */

const DECORATION = /\s*(?:[-–—]\s*)?\(?\b(?:enterprise|national|dso|parent|hq)\b\)?\s*$/i;

/**
 * A Salesforce account name as a customer would write it: the trailing
 * bookkeeping words are dropped ("Heartland Dental-HQ", "Smile Brands DSO
 * Enterprise Parent", "PepperPointe Partnerships - National DSO").
 */
export function cleanAccountName(raw: unknown): string {
  let name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  for (let i = 0; i < 6; i++) {
    const next = name.replace(DECORATION, "").replace(/[\s\-–—]+$/, "").trim();
    // Never strip a name down to nothing or to a single short word.
    if (next === name || next.length < 3) break;
    name = next;
  }
  return name.slice(0, 120);
}

/** One account, however it is decorated or capitalised. */
export function accountKey(name: string): string {
  return cleanAccountName(name).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 120);
}
