// Task #1138 — telemetry for the Strict Facts review flow. There is no
// analytics pipeline in api-server, so events are emitted as structured pino
// logs (the existing convention) with a stable `event` field that downstream
// log-based analytics can key on. Firing telemetry must never throw.
import { logger } from "../logger";

export type FactFlagEvent =
  | "fact_flag_created"
  | "fact_flag_approved"
  | "fact_flag_edited"
  | "fact_flag_swapped"
  | "fact_flag_removed"
  | "fact_flag_undo"
  | "fact_flag_library_upgrade"
  | "fact_flag_bulk_approved"
  | "fact_flag_published_with_bulk_approve"
  | "fact_flag_quote_approve_confirmed"
  | "fact_flag_advisory_detected";

export function trackFactEvent(event: FactFlagEvent, props: Record<string, unknown> = {}): void {
  try {
    logger.info({ event, ...props }, `[fact-flags] ${event}`);
  } catch {
    /* telemetry is best-effort — never block the request */
  }
}
