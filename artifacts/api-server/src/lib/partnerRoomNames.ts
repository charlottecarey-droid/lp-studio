/** Account names as a customer would write them. Shared by the automatic rooms and the practice sheet. */

const DECORATION = /\s*(?:[-–—]\s*)?\(?\b(?:enterprise|national|dso|parent|hq|account|corporate)\b\)?\s*$/i;

/** Small words that stay lower case inside a name ("Bank of the West"). */
const SMALL = new Set(["of", "and", "the", "for", "at", "in", "on", "by", "to", "or", "a", "an", "de", "la"]);
/** Company suffixes written as words, not letters ("Inc", "Co"). */
const SUFFIX_WORDS = new Map([["inc", "Inc"], ["co", "Co"], ["corp", "Corp"], ["ltd", "Ltd"], ["llp", "LLP"], ["llc", "LLC"], ["pllc", "PLLC"], ["pc", "PC"], ["pa", "PA"], ["dds", "DDS"], ["dmd", "DMD"], ["usa", "USA"], ["us", "US"], ["uk", "UK"], ["dso", "DSO"], ["dpo", "DPO"]]);

/** One word of a name written in capitals, as a person would write it: "DENTAL" → "Dental", but MB2, PDS, TX and LLC stay. */
function wordCase(word: string, first: boolean): string {
  // Keep the punctuation around the letters: "(INDIANAPOLIS)", "SMILE-BRANDS", "O'NEIL".
  return word.replace(/[A-Za-z0-9]+/g, (w, at: number) => {
    const lower = w.toLowerCase();
    const known = SUFFIX_WORDS.get(lower);
    if (known) return known;
    if (/\d/.test(w)) return w.toUpperCase(); // MB2, 24/7
    if (!first && at === 0 && SMALL.has(lower)) return lower;
    if (w.length === 2 && !SMALL.has(lower)) return w.toUpperCase(); // a state or initials: TX, NY, JD
    if (w.length <= 4 && !/[aeiou]/i.test(w)) return w.toUpperCase(); // letters, not a word: PDS, DDS, SDP
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

/** A name typed all in capitals, written normally. A name with any lower-case letter is left as it was written. */
function fixCapitals(name: string): string {
  if (!/[A-Z]{2}/.test(name) || /[a-z]/.test(name)) return name;
  return name
    .split(" ")
    .map((w, i) => wordCase(w, i === 0))
    .join(" ");
}

/**
 * A Salesforce account name as a customer would write it: the trailing
 * bookkeeping words are dropped ("Heartland Dental-HQ", "Smile Brands DSO
 * Enterprise Parent", "PepperPointe Partnerships - National DSO"), and a
 * name written all in capitals is written normally ("MB2 DENTAL SOLUTIONS"
 * → "MB2 Dental Solutions").
 */
export function cleanAccountName(raw: unknown): string {
  let name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  for (let i = 0; i < 8; i++) {
    const next = name.replace(DECORATION, "").replace(/[\s\-–—,]+$/, "").trim();
    // Never strip a name down to nothing or to a single short word.
    if (next === name || next.length < 3) break;
    name = next;
  }
  return fixCapitals(name).slice(0, 120);
}

/** One account, however it is decorated or capitalised. */
export function accountKey(name: string): string {
  return cleanAccountName(name).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 120);
}
