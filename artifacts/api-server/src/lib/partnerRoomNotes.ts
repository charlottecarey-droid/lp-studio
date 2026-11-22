/**
 * Saved Partner Hub notes (lp_room_saved_notes): the words and links of a
 * pinned note, kept to add to any hub. Who signs it and its date belong to
 * the hub it lands in, so they are never stored here.
 */

export interface SavedNoteBody {
  eyebrow?: string;
  title?: string;
  body?: string;
  items?: { title: string; url: string; description?: string }[];
}

/** The link address that becomes the signer's own booking page in each hub. */
export const BOOKING_LINK_TOKEN = "{booking link}";

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const okUrl = (u: string) => /^(https?:\/\/|mailto:)/i.test(u) || u.trim().toLowerCase() === BOOKING_LINK_TOKEN;

/** A note as sent by the builder, cleaned: known fields only, sizes capped, links that can't be opened dropped. Null when nothing is left. */
export function cleanSavedNote(raw: unknown): SavedNoteBody | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : [])
    .slice(0, 8)
    .map((i) => (i && typeof i === "object" ? (i as Record<string, unknown>) : {}))
    .map((i) => ({ title: (str(i.title, 120) ?? "").trim(), url: (str(i.url, 2000) ?? "").trim(), description: str(i.description, 300)?.trim() || undefined }))
    // Keep a link the rep is still filling in only when it has a name; drop ones that could never open.
    .filter((i) => i.title && (!i.url || okUrl(i.url)));
  const out: SavedNoteBody = {
    ...(typeof r.eyebrow === "string" ? { eyebrow: str(r.eyebrow, 120)!.trim() } : {}),
    title: (str(r.title, 200) ?? "").trim(),
    body: (str(r.body, 5000) ?? "").trim(),
    items,
  };
  return out.title || out.body || items.length ? out : null;
}

/** The name a note is saved under: what the rep typed, else its title. */
export function savedNoteName(name: unknown, note: SavedNoteBody): string {
  return ((typeof name === "string" ? name : "").trim() || (note.title ?? "").trim() || "Untitled note").slice(0, 120);
}
