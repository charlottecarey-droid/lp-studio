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

export interface GiftDetail {
  imageUrl?: string;
  imageAlt?: string;
  caption?: string;
  fit?: "contain" | "cover";
}

export interface GiftSelectionState {
  /** Names registered by the picker, in display order. */
  options: string[];
  /** Photo / caption per name, so the form can show a "Your selection" summary. */
  details: Record<string, GiftDetail>;
  /** The visitor's current choice (a name from `options`, or ""). */
  selected: string;
}

let state: GiftSelectionState = { options: [], details: {}, selected: "" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function registerGiftOptions(options: string[], details?: Record<string, GiftDetail>): void {
  const next = options.map((o) => o.trim()).filter(Boolean);
  const nextDetails: Record<string, GiftDetail> = {};
  if (details) for (const name of next) if (details[name]) nextDetails[name] = details[name];
  const sameOptions = next.length === state.options.length && next.every((o, i) => o === state.options[i]);
  const sameDetails = JSON.stringify(nextDetails) === JSON.stringify(details ? state.details : nextDetails);
  if (sameOptions && (sameDetails || !details)) return;
  state = { ...state, options: next, details: details ? nextDetails : state.details };
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
  state = { options: [], details: {}, selected: "" };
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
