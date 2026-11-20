/**
 * Partner Hub map, reading side: pull the city, state and ZIP out of an
 * address written on one line, and read a "Using Dandy" column. Pure text
 * work; the ZIP → map position table lives in `zipCentroids.ts`.
 */
/** "28607", "28607-1234" or " 28607 " → the first five digits; null when it isn't a US ZIP. */
export function zip5(raw: unknown): string | null {
  const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(typeof raw === "string" ? raw : "");
  return m ? m[1] : null;
}

export interface AddressParts {
  /** The street line (everything before the city), or the whole text when it can't be split. */
  street: string;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * Split an address written on one line ("166 Furman Road Ste B, Boone, NC 28607").
 * The state and ZIP are read from the end. The city is only taken when a comma
 * sets it apart from the street: "816 1st Ave S Conover, NC 28613" has no way
 * to tell where the street stops, so the city stays with the street.
 */
export function splitAddress(raw: unknown): AddressParts {
  const text = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  const m = /^(.*?)[,\s]+([A-Za-z]{2})[,\s]+(\d{5})(?:-\d{4})?$/.exec(text);
  if (!m) {
    const z = /(?:^|[\s,])(\d{5})(?:-\d{4})?$/.exec(text);
    return { street: text, city: null, state: null, zip: z ? z[1] : null };
  }
  const before = m[1].replace(/[,\s]+$/, "");
  const cut = before.lastIndexOf(",");
  const city = cut > 0 ? before.slice(cut + 1).trim() : "";
  // A "city" with a digit in it is a suite or unit ("…, Suite 103"), not a city.
  const cityOk = !!city && !/\d/.test(city);
  return { street: cityOk ? before.slice(0, cut).trim() : before, city: cityOk ? city : null, state: m[2].toUpperCase(), zip: m[3] };
}

/** A "Using Dandy" column: yes → live, no → not started; anything else says nothing. */
export function usingDandyStage(raw: unknown): "live" | "not_started" | null {
  const v = (typeof raw === "string" ? raw : "").trim().toLowerCase();
  if (/^(yes|y|true|1|active|customer)$/.test(v)) return "live";
  if (/^(no|n|false|0)$/.test(v)) return "not_started";
  return null;
}
