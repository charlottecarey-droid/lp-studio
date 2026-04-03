import { useState, useEffect } from "react";

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
        id = crypto.randomUUID();
        try { localStorage.setItem(key, id); } catch { /* storage full / blocked */ }
      }

      setSessionId(id);
    } catch {
      // localStorage blocked (e.g. private mode, storage quota) — generate a
      // temporary in-memory session ID so the page still loads.
      setSessionId(crypto.randomUUID());
    }
  }, [testSlug]);

  return sessionId;
}
