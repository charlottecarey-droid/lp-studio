/**
 * Page-level gift selection shared between the Holiday Gift blocks.
 *
 * The picker registers its option names on mount and writes the visitor's
 * choice; the form reads both, so the gift names live in ONE place (the
 * picker) and "Choose this one" on a card pre-fills step one of the form.
 * A tiny external store (no context provider needed — the blocks are
 * siblings rendered by BlockRenderer) with React 18's useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";

export interface GiftSelectionState {
  /** Names registered by the picker, in display order. */
  options: string[];
  /** The visitor's current choice (a name from `options`, or ""). */
  selected: string;
}

let state: GiftSelectionState = { options: [], selected: "" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function registerGiftOptions(options: string[]): void {
  const next = options.map((o) => o.trim()).filter(Boolean);
  if (next.length === state.options.length && next.every((o, i) => o === state.options[i])) return;
  state = { ...state, options: next, selected: next.includes(state.selected) ? state.selected : state.selected };
  emit();
}

export function selectGift(name: string): void {
  const next = name.trim();
  if (next === state.selected) return;
  state = { ...state, selected: next };
  emit();
}

export function getGiftSelection(): GiftSelectionState {
  return state;
}

/** Test/editor helper: forget everything. */
export function resetGiftSelection(): void {
  state = { options: [], selected: "" };
  emit();
}

export function useGiftSelection(): GiftSelectionState {
  // The server snapshot is the live store too: pages are client-rendered, and
  // the static-render path (OG capture, SSR tests) should see what the picker
  // registered rather than an always-empty placeholder.
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

/** `?gift=Lab%20Tour%20in%20a%20Box` on the page URL pre-selects a gift (reps can deep-link). */
export function readGiftFromSearch(search: string, options: string[]): string {
  if (!search) return "";
  let raw = "";
  try {
    raw = new URLSearchParams(search).get("gift") ?? "";
  } catch {
    return "";
  }
  const wanted = raw.trim().toLowerCase();
  if (!wanted) return "";
  return options.find((o) => o.toLowerCase() === wanted) ?? "";
}
