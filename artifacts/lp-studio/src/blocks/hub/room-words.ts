import { createContext, useContext } from "react";

/**
 * What the customer calls its regional managers ("DBOs", "RDs", "regional
 * directors"). Set per hub (`regionalsNoun`); blank keeps "regional managers".
 * Every "regional manager(s)" and "regional leader(s)" the hub shows is
 * swapped for it, keeping the sentence's capitals: "Regional Managers" (an
 * owner column) → "DBOs", "Regional managers book…" → "Regional directors
 * book…", "your regional managers" → "your RDs". Acronyms keep their
 * capitals everywhere. Same rule as the server's `fillRegionalsWord`.
 */
const REGIONALS = /\b(regional)\s+(manager|leader)(s?)\b/gi;

/** A word in capitals (DBO, RDs) is an acronym and is never lower- or title-cased. */
const isAcronym = (w: string) => (w.match(/[A-Z]/g) ?? []).length >= 2;
const cap = (w: string) => (isAcronym(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const low = (w: string) => (isAcronym(w) ? w : w.toLowerCase());

export function fillRegionalsWord(text: string, word: string): string {
  const plural = word.replace(/\s+/g, " ").trim();
  if (!plural || !/regional/i.test(text)) return text;
  const singular = /s$/i.test(plural) && plural.length > 1 ? plural.slice(0, -1) : plural;
  return text.replace(REGIONALS, (_m, first: string, second: string, s: string) => {
    const words = (s ? plural : singular).split(" ");
    const title = /^[A-Z]/.test(first) && /^[A-Z]/.test(second);
    if (title) return words.map(cap).join(" ");
    if (/^[A-Z]/.test(first)) return words.map((w, i) => (i === 0 ? cap(w) : low(w))).join(" ");
    return words.map(low).join(" ");
  });
}

/** The hub's word for its regional managers, for the parts of the page that print the label themselves (scorecard, map). */
export const RegionalsWord = createContext("");

/** `rw("Regional manager")` → the hub's word, in the same form. */
export function useRegionalsWord(): (text: string) => string {
  const word = useContext(RegionalsWord);
  return (text: string) => fillRegionalsWord(text, word);
}
