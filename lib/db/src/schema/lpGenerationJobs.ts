import { pgTable, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * lp_generation_jobs — async job records for AI page/microsite generation
 * (July 2026 reliability workstream).
 *
 * Generation was a single long synchronous request (research + scrape +
 * model + critique + image fills — worst case minutes) racing gateway idle
 * timeouts and dying with client disconnects even after the tokens were
 * spent. A job row decouples the work from the submitting connection: the
 * client submits, gets an id, and re-attaches to progress (or fetches the
 * final result) at will. The runner is IN-PROCESS (Replit runs a single
 * instance); rows exist so results survive the submitting connection — NOT
 * the process. `heartbeat_at` lets readers detect jobs orphaned by an
 * instance recycle and fail them honestly instead of showing "running"
 * forever.
 *
 * Fine-grained progress events (block deltas) are buffered in process memory
 * only; the row persists coarse state: status, current stage, final result.
 */
export const lpGenerationJobsTable = pgTable("lp_generation_jobs", {
  id: text("id").primaryKey(), // uuid, minted by the server
  tenantId: integer("tenant_id").notNull(),
  /** Which generator runs the job. */
  kind: text("kind").notNull(), // "page" (microsite rides the same table later)
  status: text("status").notNull().default("queued"), // queued | running | succeeded | failed
  /** The original request body, replayed verbatim into the generator. */
  request: jsonb("request").notNull(),
  /** Last coarse stage id the generator reported (research/context/model/…). */
  stage: text("stage"),
  /** Terminal payload — same JSON the sync endpoint returns. */
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  /** Touched (throttled) while the runner is alive; stale heartbeat on a
   *  "running" row = the instance recycled mid-job. */
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
}, (table) => [
  index("lp_generation_jobs_tenant_created_idx").on(table.tenantId, table.createdAt),
]);

export type LpGenerationJob = typeof lpGenerationJobsTable.$inferSelect;
