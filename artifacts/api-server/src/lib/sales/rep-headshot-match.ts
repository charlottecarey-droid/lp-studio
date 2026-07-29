/**
 * Rep-headshot matching, with NO database import.
 *
 * Split from `rep-headshots.ts` deliberately: that module imports `db`, which
 * throws at IMPORT time without DATABASE_URL, so nothing beside it can be unit
 * tested. The matching rules are exactly what deserves tests.
 *
 * The library record already carries a `photo` (uploaded through ImagePicker,
 * hosted in our own object storage), and the dso-meet-team block already uses
 * it. What was missing is the LOOKUP: an account team synced from Salesforce
 * has names and emails but no usable image, because Salesforce's SmallPhotoUrl
 * needs a Salesforce session to fetch and renders broken on a public page.
 *
 * So: match the person to their library record and borrow the photo that's
 * already there. One headshot per rep, maintained in one place, reused by
 * agendas, microsites and anything else that renders people.
 *
 * MATCHING IS EMAIL-FIRST. Two people can share a name; nobody shares a work
 * email. A name match is only used when there's exactly ONE library record with
 * that name — putting the wrong face on a named person is a worse failure than
 * showing initials, and it's the kind of thing nobody notices until a customer
 * does.
 */
/** Build the index from raw library `content` blobs. Pure. */
export function buildHeadshotIndex(contents: Record<string, unknown>[]): HeadshotIndex {
  const byEmail = new Map<string, string>();
  const nameCandidates = new Map<string, Set<string>>();

  for (const c of contents) {
    const photo = String(c.photo ?? "").trim();
    if (!photo) continue; // a record with no headshot tells us nothing
    const email = normEmail(String(c.email ?? ""));
    const name = normName(String(c.name ?? ""));
    if (email && !byEmail.has(email)) byEmail.set(email, photo);
    if (name) {
      const set = nameCandidates.get(name) ?? new Set<string>();
      set.add(photo);
      nameCandidates.set(name, set);
    }
  }

  const byName = new Map<string, string>();
  for (const [name, photos] of nameCandidates) {
    // Ambiguous name → no match. Better initials than the wrong face.
    if (photos.size === 1) byName.set(name, [...photos][0]);
  }
  return { byEmail, byName };
}

export interface HeadshotIndex {
  byEmail: Map<string, string>;
  /** Only names that are UNAMBIGUOUS in the library. */
  byName: Map<string, string>;
}

const normEmail = (v: string): string => v.trim().toLowerCase();
/** Fold case, punctuation and doubled spaces so "O'Brien" ≈ "OBrien". */
const normName = (v: string): string =>
  v.toLowerCase().replace(/[.'’-]/g, "").replace(/\s+/g, " ").trim();

export interface HeadshotTarget {
  name?: string;
  email?: string;
  imageUrl?: string;
}

/**
 * Fill in `imageUrl` from the library where it's missing.
 *
 * Never overwrites an image already set — someone who picked a specific photo
 * for this page meant it.
 */
export function attachHeadshots<T extends HeadshotTarget>(people: T[], index: HeadshotIndex): T[] {
  return people.map((p) => {
    if (p.imageUrl?.trim()) return p;
    const byEmail = p.email ? index.byEmail.get(normEmail(p.email)) : undefined;
    const photo = byEmail ?? (p.name ? index.byName.get(normName(p.name)) : undefined);
    return photo ? { ...p, imageUrl: photo } : p;
  });
}

/** How many of these people the library can put a face to — for reporting. */
export function countHeadshotMatches(people: HeadshotTarget[], index: HeadshotIndex): number {
  return people.filter((p) => {
    if (p.imageUrl?.trim()) return false;
    const byEmail = p.email ? index.byEmail.get(normEmail(p.email)) : undefined;
    return Boolean(byEmail ?? (p.name ? index.byName.get(normName(p.name)) : undefined));
  }).length;
}
