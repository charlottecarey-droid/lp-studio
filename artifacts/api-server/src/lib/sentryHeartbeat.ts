import { Sentry, isSentryInitialized } from "./sentry";
import { logger } from "./logger";

export const SENTRY_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
export const SENTRY_HEARTBEAT_TAG = "heartbeat";
export const SENTRY_HEARTBEAT_MESSAGE = "api-server heartbeat";

/**
 * Emit a low-severity Sentry event so the prod project always has a
 * predictable signal. Without this, "no events for N hours" alerts are
 * ambiguous — silence could mean Sentry is broken (DSN rejected, network
 * egress blocked, quota exhausted) OR it could mean the app simply had no
 * errors. The heartbeat removes the ambiguity: if the alert rule stops
 * seeing heartbeat events, ingestion is broken.
 *
 * Wired up in server.ts (boot + setInterval). See
 * `lib/SENTRY_PROD_ALERT_VERIFICATION.md` for the matching Sentry alert
 * rule and how to verify it end-to-end.
 */
export function captureSentryHeartbeat(): void {
  if (!isSentryInitialized()) return;
  try {
    Sentry.captureMessage(SENTRY_HEARTBEAT_MESSAGE, {
      level: "info",
      tags: { [SENTRY_HEARTBEAT_TAG]: "true" },
      // Stable fingerprint so every heartbeat collapses into one Sentry
      // issue instead of spamming the inbox with a fresh issue per ping.
      fingerprint: ["api-server-heartbeat"],
    });
  } catch (err) {
    logger.warn({ err }, "sentry heartbeat capture failed (non-fatal)");
  }
}

/**
 * Boot-time heartbeat scheduler. Only runs in production so dev/staging
 * Sentry projects don't get polluted with info events. Returns the
 * interval handle (already `.unref()`-ed) for tests; callers can ignore.
 */
export function startSentryHeartbeat(): NodeJS.Timeout | null {
  if (!isSentryInitialized()) return null;
  if (process.env.NODE_ENV !== "production") return null;
  captureSentryHeartbeat();
  const handle = setInterval(captureSentryHeartbeat, SENTRY_HEARTBEAT_INTERVAL_MS);
  handle.unref();
  return handle;
}
