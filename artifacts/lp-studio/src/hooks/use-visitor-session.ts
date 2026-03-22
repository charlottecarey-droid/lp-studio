import { useState, useEffect } from "react";

/**
 * Manages a persistent session ID for visitors so they are consistently
 * bucketed into the same variant for a given test.
 */
export function useVisitorSession(testSlug: string) {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (!testSlug) return;
    
    const key = `lp-studio-session-${testSlug}`;
    let id = localStorage.getItem(key);
    
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    
    setSessionId(id);
  }, [testSlug]);

  return sessionId;
}
