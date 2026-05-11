import { useEffect, useRef } from "react";

export type ShortcutScope = "global" | "builder";

export interface Shortcut {
  id: string;
  keys: string;
  label: string;
  group?: string;
  scope?: ShortcutScope;
  handler: (e: KeyboardEvent) => void;
  skipInEditable?: boolean;
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const p = (navigator.platform || "").toLowerCase();
  const ua = (navigator.userAgent || "").toLowerCase();
  return p.includes("mac") || ua.includes("mac os") || ua.includes("iphone") || ua.includes("ipad");
}

interface ParsedShortcut {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function parse(combo: string): ParsedShortcut {
  const parts = combo.toLowerCase().split("+").map(p => p.trim());
  const out: ParsedShortcut = { mod: false, shift: false, alt: false, key: "" };
  for (const p of parts) {
    if (p === "mod" || p === "cmd" || p === "ctrl") out.mod = true;
    else if (p === "shift") out.shift = true;
    else if (p === "alt" || p === "opt" || p === "option") out.alt = true;
    else out.key = p;
  }
  return out;
}

function matches(e: KeyboardEvent, combo: string): boolean {
  const p = parse(combo);
  const modPressed = e.metaKey || e.ctrlKey;
  if (p.mod !== modPressed) return false;
  if (p.shift !== e.shiftKey) return false;
  if (p.alt !== e.altKey) return false;
  const key = e.key.toLowerCase();
  if (p.key === "esc") return key === "escape";
  return key === p.key;
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t instanceof HTMLInputElement) return true;
  if (t instanceof HTMLTextAreaElement) return true;
  if (t.isContentEditable) return true;
  if (t.getAttribute("role") === "textbox") return true;
  return false;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const s of ref.current) {
        if (!matches(e, s.keys)) continue;
        const skipInEditable = s.skipInEditable ?? true;
        if (skipInEditable && isEditableTarget(e.target)) return;
        e.preventDefault();
        s.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function formatShortcutKeys(combo: string, mac: boolean = isMac()): string[] {
  const p = parse(combo);
  const out: string[] = [];
  if (p.mod) out.push(mac ? "⌘" : "Ctrl");
  if (p.shift) out.push(mac ? "⇧" : "Shift");
  if (p.alt) out.push(mac ? "⌥" : "Alt");
  if (p.key) {
    if (p.key === "esc") out.push("Esc");
    else if (p.key.length === 1) out.push(p.key.toUpperCase());
    else out.push(p.key.charAt(0).toUpperCase() + p.key.slice(1));
  }
  return out;
}
