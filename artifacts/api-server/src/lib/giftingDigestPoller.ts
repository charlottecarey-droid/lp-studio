/**
 * Weekday holiday-gifting summary to Slack (Nov 2026). Every 10 minutes: for
 * each Slack connection with metadata.giftingDigest.enabled, if it's a weekday
 * at/after the configured Chicago hour and today's summary hasn't gone out,
 * claim today atomically (so two instances can't both post), build the summary
 * for the window since the last one, and post it to the configured channel.
 * Days with no activity are marked done without posting.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, slackConnectionsTable } from "@workspace/db";
import { logger } from "./logger";
import { slackService } from "./slack-service";
import { digestDue, readDigestSettings, zonedClock } from "./gifting-digest";
import { giftingDigestFor } from "../routes/lp/gift-exchange";

const TICK_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
let inflight = false;

/** Send one tenant's summary now. `force` posts even on a quiet day (Send now). Returns whether Slack accepted it. */
export async function sendGiftingDigest(tenantId: number, channelId: string, opts: { now: Date; since?: Date; force?: boolean }): Promise<"sent" | "quiet" | "failed"> {
  const since = opts.since ?? new Date(opts.now.getTime() - DAY_MS);
  const msg = await giftingDigestFor(tenantId, { now: opts.now, since, force: opts.force });
  if (!msg) return "quiet";
  const ok = await slackService.postMessage(tenantId, { ...msg, channelId });
  return ok ? "sent" : "failed";
}

export async function runGiftingDigestTick(now = new Date()): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const rows = await db.select().from(slackConnectionsTable)
      .where(and(eq(slackConnectionsTable.status, "connected"), sql`(${slackConnectionsTable.metadata}->'giftingDigest'->>'enabled')::boolean is true`));
    for (const row of rows) {
      const cfg = readDigestSettings(row.metadata);
      if (!digestDue(now, cfg)) continue;
      const today = zonedClock(now).date;
      // Claim today's run: only one tick (or instance) gets the row back.
      const claimed = await db.update(slackConnectionsTable)
        .set({ metadata: sql`jsonb_set(coalesce(${slackConnectionsTable.metadata}, '{}'::jsonb), '{giftingDigest,lastSentDate}', to_jsonb(${today}::text))` })
        .where(and(eq(slackConnectionsTable.id, row.id), sql`coalesce(${slackConnectionsTable.metadata}->'giftingDigest'->>'lastSentDate', '') <> ${today}`))
        .returning({ id: slackConnectionsTable.id });
      if (!claimed.length) continue;
      const since = cfg.lastSentAt && Number.isFinite(Date.parse(cfg.lastSentAt)) ? new Date(cfg.lastSentAt) : new Date(now.getTime() - DAY_MS);
      const result = await sendGiftingDigest(row.tenantId, cfg.channelId, { now, since }).catch((err) => {
        logger.error({ err, tenantId: row.tenantId }, "gifting digest failed");
        return "failed" as const;
      });
      if (result !== "failed") {
        await db.update(slackConnectionsTable)
          .set({ metadata: sql`jsonb_set(coalesce(${slackConnectionsTable.metadata}, '{}'::jsonb), '{giftingDigest,lastSentAt}', to_jsonb(${now.toISOString()}::text))` })
          .where(eq(slackConnectionsTable.id, row.id));
      }
      logger.info({ tenantId: row.tenantId, result }, "gifting digest");
    }
  } catch (err) {
    logger.error({ err }, "gifting digest tick failed");
  } finally {
    inflight = false;
  }
}

export function startGiftingDigestPoller(): void {
  const enabled = process.env.GIFTING_DIGEST_POLLER_ENABLED === "1" || process.env.NODE_ENV === "production";
  if (!enabled) return;
  setInterval(() => void runGiftingDigestTick(), TICK_MS).unref?.();
  logger.info("gifting digest poller started");
}
