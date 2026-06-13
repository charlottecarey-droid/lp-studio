// Phase 2 — scheduled blog-publish sweep.
//
// The first-party marketing blog (blog_posts) supports SCHEDULED publishing:
// an author sets status='scheduled' + scheduled_at in the future, and this
// out-of-band sweep flips the post to 'published' (stamping published_at) once
// scheduled_at <= now. Modeled on customDomainPoller / emailDomainPoller:
//
//   * Crash-safe: startBlogPublishPoller never lets a scan reject into an
//     unhandled rejection (which would crash the server at boot). Each tick is
//     wrapped in .catch and just logs + retries on the next interval.
//   * Fail-open: a failed DB query or a single bad row is logged and skipped;
//     the loop is never torn down. A scheduled post that fails to flip this
//     pass simply flips on the next pass.
//   * Single-flight + cross-instance safe: an in-process inflight guard plus a
//     pg advisory lock so two app instances never sweep concurrently. The flip
//     itself is an atomic conditional UPDATE (WHERE status='scheduled' AND
//     scheduled_at <= now()), so even without the lock at most one writer wins
//     and double-publish is impossible.
//
// Public read endpoints serve only status='published', so a scheduled post is
// invisible publicly until this sweep flips it.

import { pool } from "@workspace/db";
import { logger } from "./logger";

// Default cadence: every 60s. Schedules are minute-granular in practice, so a
// 1-minute sweep keeps the publish latency well under a couple minutes.
export const BLOG_PUBLISH_POLL_INTERVAL_MS = 60 * 1000;

// Advisory lock pair-key (distinct from the 415/783/etc. poller family).
const ADVISORY_LOCK_CLASSID = 9601;
const ADVISORY_LOCK_OBJID = 1;

// In-process single-flight guard so overlapping ticks within ONE process don't
// both run the sweep.
let inflight: Promise<void> | null = null;

/**
 * One sweep pass: cross-instance advisory lock, then the atomic flip. The lock
 * is a session-scoped lock auto-released when the client is returned.
 */
export async function runBlogPublishSweep(): Promise<number> {
  if (inflight) {
    await inflight;
    return 0;
  }
  let published = 0;
  inflight = (async () => {
    const client = await pool.connect();
    try {
      const lockResult = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1, $2) AS locked`,
        [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID],
      );
      if (!lockResult.rows[0]?.locked) {
        logger.debug("blogPublishPoller: another instance holds the lock — skipping");
        return;
      }
      try {
        published = await flipDueScheduledPosts();
      } finally {
        await client
          .query(`SELECT pg_advisory_unlock($1, $2)`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID])
          .catch((err) =>
            logger.warn({ err }, "blogPublishPoller: advisory unlock failed (auto-releases on disconnect)"),
          );
      }
    } finally {
      client.release();
    }
  })().finally(() => {
    inflight = null;
  });
  await inflight;
  return published;
}

/**
 * Atomic flip: every scheduled post whose scheduled_at is due becomes
 * published in a single UPDATE. published_at is stamped to the scheduled time
 * when known (so ordering reflects the intended publish moment) else now();
 * scheduled_at is cleared. Returns the number of rows published. Fail-open:
 * errors are logged and swallowed (returns 0) so the loop survives.
 *
 * Phase 4 — AUTOPUBLISH GUARDRAIL: a post linked to a content-program topic
 * (topic_id IS NOT NULL) was scheduled by the AUTONOMOUS pipeline, so it is
 * only auto-published when blog_program_settings.autopublish_enabled is true
 * (the strongest oversight gate, OFF by default). Posts a human scheduled
 * directly (topic_id IS NULL) always flip when due — the explicit human
 * scheduling decision IS the oversight, exactly as in Phase 2. So an
 * autonomously-scheduled post with autopublish OFF stays 'scheduled' until a
 * human flips autopublish on (or publishes it manually), and never goes live
 * on its own.
 */
async function flipDueScheduledPosts(): Promise<number> {
  try {
    const result = await pool.query<{ id: number }>(
      `UPDATE blog_posts
          SET status = 'published',
              published_at = COALESCE(published_at, scheduled_at, now()),
              scheduled_at = NULL,
              updated_at = now()
        WHERE status = 'scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= now()
          AND (
            topic_id IS NULL
            OR COALESCE(
              (SELECT autopublish_enabled FROM blog_program_settings WHERE id = 1),
              false
            ) = true
          )
        RETURNING id`,
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      logger.info(
        { count, ids: result.rows.map((r) => r.id) },
        "blogPublishPoller: scheduled posts published",
      );
    }
    return count;
  } catch (err) {
    logger.error({ err }, "blogPublishPoller: scheduled flip failed (non-fatal)");
    return 0;
  }
}

/**
 * Boot-time scheduler. Runs in production (where the marketing site is live)
 * OR when BLOG_PUBLISH_POLLER_ENABLED is set (staging/manual verification).
 * Crash-safe: a scan failure logs + retries on the next interval, never
 * rejecting into an unhandled rejection. Returns the interval handle
 * (`.unref()`-ed) for tests, or null when disabled.
 */
export function startBlogPublishPoller(): NodeJS.Timeout | null {
  const enabled =
    process.env.NODE_ENV === "production" ||
    process.env.BLOG_PUBLISH_POLLER_ENABLED === "1" ||
    process.env.BLOG_PUBLISH_POLLER_ENABLED === "true";
  if (!enabled) return null;

  const safeRun = () =>
    runBlogPublishSweep().catch((err) =>
      logger.error({ err }, "blogPublishPoller: sweep failed (will retry next interval)"),
    );
  void safeRun();
  const handle = setInterval(() => {
    void safeRun();
  }, BLOG_PUBLISH_POLL_INTERVAL_MS);
  handle.unref();
  return handle;
}
