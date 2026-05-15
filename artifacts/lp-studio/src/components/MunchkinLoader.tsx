import { useEffect } from "react";

interface MunchkinGlobal {
  init: (munchkinId: string, opts?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    Munchkin?: MunchkinGlobal;
  }
}

const SCRIPT_ID = "marketo-munchkin-script";
const SCRIPT_SRC = "https://munchkin.marketo.net/munchkin.js";

let scriptPromise: Promise<void> | null = null;
const initedIds = new Set<string>();

function loadMunchkinScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Munchkin) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Munchkin script")));
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = SCRIPT_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Munchkin script"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Injects Marketo's Munchkin visitor-tracking script and calls
 * `Munchkin.init(munchkinId)` exactly once per Munchkin ID per page load.
 *
 * The Munchkin script is what associates a visitor's browser with their
 * Marketo lead record via a first-party `_mkto_trk` cookie. Without it
 * any Forms2 submit (including BlockForm's hidden "ghost" submit) lands
 * in Marketo as an anonymous lead and Smart Campaigns / GA4 listeners
 * tied to "this visitor's existing session" never fire.
 *
 * Mount this anywhere we know a Marketo Munchkin ID — it's idempotent
 * across remounts and across multiple instances on the same page.
 * Renders nothing.
 */
export function MunchkinLoader({ munchkinId }: { munchkinId: string }) {
  useEffect(() => {
    if (!munchkinId) return;
    if (initedIds.has(munchkinId)) return;
    let cancelled = false;
    loadMunchkinScript()
      .then(() => {
        if (cancelled || !window.Munchkin) return;
        if (initedIds.has(munchkinId)) return;
        try {
          window.Munchkin.init(munchkinId);
          initedIds.add(munchkinId);
        } catch {
          // Munchkin sometimes throws on double-init when a prior page
          // (SPA navigation) already initialised the same ID. Swallow —
          // the cookie is already set and that's all we need.
        }
      })
      .catch(() => {
        // Network failure / CSP block / ad-blocker — degrade silently.
        // The Forms2 submit will still work; it just won't carry the
        // Munchkin cookie association.
      });
    return () => {
      cancelled = true;
    };
  }, [munchkinId]);
  return null;
}
