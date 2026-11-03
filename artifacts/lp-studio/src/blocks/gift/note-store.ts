/**
 * Page-level link between the gift-note block and the gift-hero's envelope
 * intro (same tiny external-store pattern as gift-selection.ts).
 *
 * - The note registers its (already token-resolved) content, so the card
 *   that slides out of the envelope reads the rep's own note — one source.
 * - The envelope marks itself active while it is on the live page; the note
 *   block then hides itself so the same letter doesn't appear twice.
 */
import { useEffect, useSyncExternalStore } from "react";

export interface GiftNoteContent {
  kicker?: string;
  headline?: string;
  greeting?: string;
  body?: string;
  signoff?: string;
  signature?: string;
  repTitle?: string;
  repPhotoUrl?: string;
  calendarUrl?: string;
  calendarText?: string;
}

interface State {
  note: GiftNoteContent | null;
  envelopeActive: boolean;
}

let state: State = { note: null, envelopeActive: false };
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export function registerGiftNote(note: GiftNoteContent | null): void {
  if (JSON.stringify(note) === JSON.stringify(state.note)) return;
  state = { ...state, note };
  emit();
}

export function setEnvelopeActive(active: boolean): void {
  if (active === state.envelopeActive) return;
  state = { ...state, envelopeActive: active };
  emit();
}

export function resetGiftNoteStore(): void {
  state = { note: null, envelopeActive: false };
  emit();
}

export function useGiftNoteStore(): State {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}

/** The note block publishes its content while mounted. */
export function useRegisterGiftNote(note: GiftNoteContent): void {
  const key = JSON.stringify(note);
  useEffect(() => {
    registerGiftNote(JSON.parse(key) as GiftNoteContent);
    return () => registerGiftNote(null);
  }, [key]);
}
