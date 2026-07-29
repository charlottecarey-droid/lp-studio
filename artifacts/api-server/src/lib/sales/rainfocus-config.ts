/**
 * Pure helpers for a stored RainFocus connection.
 *
 * Deliberately separate from `rainfocus-sync.ts`: that module imports `db`,
 * which throws at IMPORT time without DATABASE_URL, so anything living beside
 * it can only be tested with a database. Credential handling is exactly the
 * logic that should be unit-testable, so it lives here.
 */
import type { RainfocusConfig } from "@workspace/db";
import type { RainfocusCredentials } from "./rainfocus";

export function credsFromConfig(config: RainfocusConfig | null | undefined): RainfocusCredentials | null {
  const apiToken = config?.apiToken?.trim();
  const widgetId = config?.widgetId?.trim();
  if (!apiToken || !widgetId) return null;
  return { apiToken, widgetId, env: config?.env?.trim() || "prod" };
}

/**
 * Strip the token before an event goes out over the API.
 *
 * The widget token is public by design, but echoing it in every GET is a habit
 * worth not forming. `connected` is what the UI actually needs.
 */
export function redactRainfocusConfig(
  config: RainfocusConfig | null | undefined,
): Omit<RainfocusConfig, "apiToken"> & { connected: boolean } {
  const c = config ?? {};
  const { apiToken: _apiToken, ...rest } = c;
  return { ...rest, connected: Boolean(c.apiToken && c.widgetId) };
}
