import { useEffect } from "react";

/**
 * Time-on-page collector for landing pages (Sales Pages analytics).
 *
 * Counts only tab-VISIBLE time: the timer pauses while the page is hidden
 * (backgrounded tab, minimized window), so "avg time on page" measures real
 * attention rather than open tabs. Reports the session's CUMULATIVE total —
 * the server MAX-merges it onto the visit row, so replays are harmless.
 *
 * Flush points: visibilitychange→hidden and pagehide use sendBeacon (the
 * reliable unload path — same pattern as use-heatmap-tracker); a 15s interval
 * flush covers long reads and mobile browsers that never fire pagehide.
 * Capped at 30 minutes, matching the server-side cap.
 */

const API_BASE = "/api";
const MAX_SECONDS = 1800;
const FLUSH_INTERVAL_MS = 15_000;

export function useDwellTracker(
  pageId: number | undefined | null,
  sessionId: string | undefined | null,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || !pageId || !sessionId) return;

    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let accumulatedMs = 0;
    let lastSentSeconds = 0;

    const totalSeconds = () =>
      Math.min(
        MAX_SECONDS,
        Math.round((accumulatedMs + (visibleSince ? Date.now() - visibleSince : 0)) / 1000),
      );

    const send = (useBeacon: boolean) => {
      const seconds = totalSeconds();
      if (seconds < 1 || seconds <= lastSentSeconds) return;
      lastSentSeconds = seconds;
      const payload = JSON.stringify({ pageId, sessionId, seconds });
      // Blob wrapper so sendBeacon posts Content-Type: application/json —
      // its text/plain default bypasses express.json() (see heatmap hook).
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(`${API_BASE}/lp/track/dwell`, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(`${API_BASE}/lp/track/dwell`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    const pause = () => {
      if (visibleSince) {
        accumulatedMs += Date.now() - visibleSince;
        visibleSince = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        pause();
        send(true);
      } else if (!visibleSince) {
        visibleSince = Date.now();
      }
    };

    const handlePageHide = () => {
      pause();
      send(true);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    const interval = setInterval(() => send(false), FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      clearInterval(interval);
      // SPA route change away from the page counts as leaving it.
      pause();
      send(true);
    };
  }, [enabled, pageId, sessionId]);
}
