/**
 * The workspace's saved Partner Hub notes, for the builder: pinned notes a
 * rep saved to add to any hub ("Book your kickoff call", "Lab tour invite").
 * One shared copy for the whole builder window (the preview's Add section
 * menu and the side panel see the same list), loaded once and kept current
 * by every save and delete.
 */
import { useEffect, useState } from "react";
import { OVERVIEW_NOTE_EYEBROW, newOverviewExtra, type RoomOverviewExtra } from "@/blocks/hub/RoomOverviewExtras";

const API = "/api/lp/room-notes";

export interface SavedNoteBody {
  eyebrow?: string;
  title?: string;
  body?: string;
  items?: { title: string; url: string; description?: string }[];
}

export interface SavedRoomNote {
  id: number;
  name: string;
  note: SavedNoteBody;
  updatedAt: string;
}

let notes: SavedRoomNote[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

async function load(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch(API, { credentials: "include" });
      const data = res.ok ? ((await res.json()) as { notes?: SavedRoomNote[] }) : { notes: [] };
      notes = data.notes ?? [];
    } catch {
      notes = notes ?? [];
    } finally {
      loading = null;
      emit();
    }
  })();
  return loading;
}

/** The saved notes (empty until loaded). `enabled` false (the live page) never asks the server. */
export function useSavedRoomNotes(enabled: boolean): SavedRoomNote[] {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const fn = () => tick((n) => n + 1);
    listeners.add(fn);
    if (notes === null) void load();
    return () => {
      listeners.delete(fn);
    };
  }, [enabled]);
  return enabled ? notes ?? [] : [];
}

/** What a note on a hub keeps when saved: its words and links (not who signs it, nor its date). */
export function savedBodyFrom(x: RoomOverviewExtra): SavedNoteBody {
  return {
    ...(x.eyebrow !== undefined ? { eyebrow: x.eyebrow } : {}),
    title: x.title ?? "",
    body: x.body ?? "",
    items: (x.items ?? []).filter((i) => (i.title ?? "").trim()),
  };
}

/** Save a note under a name; a name already in the library (any case) updates that note. */
export async function saveRoomNote(name: string, x: RoomOverviewExtra): Promise<{ note: SavedRoomNote; updated: boolean }> {
  const res = await fetch(API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, note: savedBodyFrom(x) }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Couldn't save the note");
  const out = (await res.json()) as { note: SavedRoomNote; updated: boolean };
  notes = [...(notes ?? []).filter((n) => n.id !== out.note.id), out.note].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  emit();
  return out;
}

export async function deleteRoomNote(id: number): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok && res.status !== 404) throw new Error("Couldn't delete the note");
  notes = (notes ?? []).filter((n) => n.id !== id);
  emit();
}

/** A saved note as a new section on a hub: pinned today, signed by that hub's account owner (the default). */
export function extraFromSaved(saved: SavedRoomNote, existing: RoomOverviewExtra[]): RoomOverviewExtra {
  const base = newOverviewExtra("text", existing);
  const n = saved.note ?? {};
  return {
    ...base,
    eyebrow: n.eyebrow ?? OVERVIEW_NOTE_EYEBROW,
    title: n.title ?? "",
    body: n.body ?? "",
    items: (n.items ?? []).map((i) => ({ title: i.title, url: i.url, ...(i.description ? { description: i.description } : {}) })),
  };
}

/** Tests and the dev preview only: set the list (null = load again next time) and redraw anything showing it. */
export function resetSavedRoomNotesForTests(list: SavedRoomNote[] | null = null): void {
  notes = list;
  loading = null;
  emit();
}
