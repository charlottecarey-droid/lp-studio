import { useState, useEffect } from "react";

/**
 * Generate a v4-ish UUID without relying on `crypto.randomUUID()`, which is
 * only available on iOS Safari 15.4+. On older iPhones/iPads (and any other
 * environment missing it) calling `crypto.randomUUID()` throws, which used
 * to leave the public viewer's sessionId as "" forever — the page-config
 * query is gated on `!!sessionId`, so the spinner never resolved. See
 * landing-page-viewer.tsx and the iPad/iPhone "page won't load" report.
 */
function safeUuid(): string {
  const c: Crypto | undefined =
    typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    try { return c.randomUUID(); } catch { /* fall through */ }
  }
  if (c && typeof c.getRandomValues === "function") {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10, 16).join("")}`;
  }
  // Last-ditch fallback (non-cryptographic). Acceptable because this ID is
  // only used to bucket a visitor into the same A/B variant — not a secret.
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Manages a persistent session ID for visitors so they are consistently
 * bucketed into the same variant for a given test.
 */
export function useVisitorSession(testSlug: string) {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (!testSlug) return;

    try {
      const key = `lp-studio-session-${testSlug}`;
      let id = localStorage.getItem(key);

      if (!id) {
        id = safeUuid();
        try { localStorage.setItem(key, id); } catch { /* storage full / blocked */ }
      }

      setSessionId(id);
    } catch {
      // localStorage blocked (e.g. private mode, storage quota) — generate a
      // temporary in-memory session ID so the page still loads.
      setSessionId(safeUuid());
    }
  }, [testSlug]);

  return sessionId;
}
