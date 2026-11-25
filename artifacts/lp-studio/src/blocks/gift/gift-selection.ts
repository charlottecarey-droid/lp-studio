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

/** A gift card offered as a fallback (same shape as a picker option). */
export interface GiftFallbackOption {
  name: string;
  caption?: string;
  imageUrl?: string;
  imageAlt?: string;
  fit?: "contain" | "cover";
  hoverImageUrl?: string;
  hoverImageAlt?: string;
  badge?: string;
}

/**
 * When every gift a page offers has sold out, the server may offer others
 * (GET /lp/gifts/fallback): more gifts of the same tier, else swag. The
 * picker shows these instead of "every gift has been claimed".
 */
export interface GiftFallback { kind: "tier" | "swag"; note: string; options: GiftFallbackOption[]; sizeOptions: string[] }

export interface GiftSelectionState {
  /** Names registered by the picker, in display order. */
  options: string[];
  /** Photo / caption per name, so the form can show a "Your selection" summary. */
  details: Record<string, GiftDetail>;
  /** The visitor's current choice (a name from `options`, or ""). */
  selected: string;
  /** Gifts the vendor sheet says are out of stock, lowercased + trimmed (see isGiftSoldOut). */
  soldOut: string[];
  /** Gifts offered once the page's own are all gone (null until fetched / when there are none). */
  fallback: GiftFallback | null;
}

let state: GiftSelectionState = { options: [], details: {}, selected: "", soldOut: [], fallback: null };
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

/** Record which gifts are out of stock; a sold-out gift can't stay selected. */
export function setSoldOut(names: string[]): void {
  const next = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))].sort();
  if (JSON.stringify(next) === JSON.stringify(state.soldOut)) return;
  const selectedGone = state.selected !== "" && next.includes(state.selected.trim().toLowerCase());
  state = { ...state, soldOut: next, selected: selectedGone ? "" : state.selected };
  emit();
}

export function setGiftFallback(fallback: GiftFallback | null): void {
  if (JSON.stringify(fallback) === JSON.stringify(state.fallback)) return;
  state = { ...state, fallback };
  emit();
}

/** The fallback cards still in stock, or [] (the picker and the form agree on this list). */
export function liveFallbackOptions(s: GiftSelectionState): GiftFallbackOption[] {
  return s.fallback ? s.fallback.options.filter((o) => !isGiftSoldOut(s.soldOut, o.name)) : [];
}

/** How many of the page's gifts are still available (live pages hide the sold-out ones). */
export function useGiftStock(): { total: number; remaining: number } {
  const s = useGiftSelection();
  return { total: s.options.length, remaining: s.options.filter((o) => !isGiftSoldOut(s.soldOut, o)).length };
}

export function isGiftSoldOut(soldOut: string[], name: string): boolean {
  return soldOut.includes(name.trim().toLowerCase());
}

export function getGiftSelection(): GiftSelectionState {
  return state;
}

/** Test/editor helper: forget everything. */
export function resetGiftSelection(): void {
  state = { options: [], details: {}, selected: "", soldOut: [], fallback: null };
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
