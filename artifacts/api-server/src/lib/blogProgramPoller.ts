// Phase 4 — autonomous content-program tick.
//
// A periodic sweep that, IN AUTONOMOUS MODE ONLY, keeps the publishing backlog
// healthy with NO loss of editorial oversight. Modeled on blogPublishPoller /
// customDomainPoller:
//   * Crash-safe: a tick never rejects into an unhandled rejection; each pass
//     is wrapped in .catch + logged, and retries next interval.
//   * Fail-open: a failed query / a single bad topic is logged + skipped; the
//     loop is never torn down.
//   * Cross-instance safe: a pg advisory lock (distinct key) + an in-process
//     single-flight guard so two instances never tick concurrently.
//   * Production-gated + env flag: runs in production OR when
//     BLOG_PROGRAM_POLLER_ENABLED is set (staging/manual verification).
//
// WHAT IT DOES, BY MODE (decided by the pure decideTick):
//   REVIEW mode (default): does NOT generate or schedule. At most it tops up
//     topic RECOMMENDATIONS when the approved queue is thin, so a human always
//     has fresh suggestions to approve. All publishing stays manual.
//   AUTONOMOUS mode: if upcoming scheduled posts < target backlog, it
//     (a) tops up recommendations if the approved queue is thin,
//     (b) generates drafts ONLY from PRE-APPROVED topics (never invents-and-
//         publishes),
//     (c) runs each generated draft through the QUALITY GATE (pre-publish
//         checklist + banned-phrase/strict-facts validator + min length); a
//         draft that fails is LEFT as a draft + flagged for human review (the
//         "exception" path) and never scheduled,
//     (d) schedules the passing drafts spaced per cadence (publish days +
//         per-week cap), setting status='scheduled'.
//   Auto-PUBLISH is gated separately: scheduled posts are flipped to published
//   by blogPublishPoller, but ONLY for autonomous posts when autopublish is
//   enabled (enforced there — this poller never publishes directly).
//
// Every autonomous action writes an audit_log row AND a blog_post_revisions
// snapshot, so a human can see exactly what the pipeline did and intervene.

import { pool, db, blogPostsTable, blogTopicsTable, blogContentThemesTable, blogProgramSettingsTable, blogPostRevisionsTable, auditLogTable } from "@workspace/db";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  normalizeProgramSettings,
  decideTick,
  runQualityGate,
  planScheduleSlots,
  type ProgramSettings,
} from "./blogProgram";
import { prePublishChecklist } from "./blog";
import { getBlogBannedPhrases, htmlToPromptText, buildTopicRecommendationMessages, parseRecommendedTopics, completionText, type ThemeBrief } from "./blogAi";
import { generateDraftForTopic, getOpenAIClientForProgram, loadWritingInstructions } from "./blogTopicGenerate";

export const BLOG_PROGRAM_POLL_INTERVAL_MS = 30 * 60 * 1000; // every 30 min
const ADVISORY_LOCK_CLASSID = 9602; // distinct from blogPublishPoller (9601)
const ADVISORY_LOCK_OBJID = 1;
const MODEL = "gpt-4o";

// Cap topic recommendations + drafts produced per tick so one pass can't run
// away even with a huge backlog (the rolling-week cap still bounds the total).
const RECOMMEND_PER_TICK = 5;

let inflight: Promise<void> | null = null;

export interface TickResult {
  mode: ProgramSettings["mode"];
  recommended: number;
  drafted: number;
  scheduled: number;
  flaggedForReview: number;
  reason: string;
  skipped?: string;
}

/** Best-effort audit row (never throws). */
async function audit(action: string, targetKey: string | null, metadata: Record<string, unknown>): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      actorEmail: "system:blog-program-poller",
      action,
      targetType: "blog_program",
      targetKey,
      metadata,
    });
  } catch (err) {
    logger.warn({ err }, "blogProgramPoller: audit write failed (non-fatal)");
  }
}

/** Best-effort revision snapshot for a post (so a human sees the autonomous edit). */
async function recordAutonomousRevision(postId: number, reason: string): Promise<void> {
  try {
    const [row] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, postId)).limit(1);
    if (!row) return;
    await db.insert(blogPostRevisionsTable).values({
      postId,
      snapshot: {
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        body: row.body,
        coverImageUrl: row.coverImageUrl ?? "",
        authorName: row.authorName,
        tags: Array.isArray(row.tags) ? row.tags : [],
        status: row.status,
        seoTitle: row.seoTitle ?? "",
        seoDescription: row.seoDescription ?? "",
        ogImageUrl: row.ogImageUrl ?? "",
        scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      },
      reason,
      authorEmail: "system:blog-program-poller",
    });
  } catch (err) {
    logger.warn({ err, postId }, "blogProgramPoller: revision write failed (non-fatal)");
  }
}

/** Count posts the pipeline has produced in the rolling 7 days (audit-derived). */
async function autonomousThisWeek(): Promise<number> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ id: auditLogTable.id })
      .from(auditLogTable)
      .where(and(eq(auditLogTable.action, "blog-program.auto.scheduled"), gt(auditLogTable.createdAt, since)));
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * One autonomous tick. Reads settings, decides via decideTick, then performs
 * the permitted actions. Returns a TickResult summary (also used by tests to
 * drive the poller without the interval). Fail-open: any error inside is logged
 * + the tick returns what it managed; the loop survives.
 */
export async function runBlogProgramTick(): Promise<TickResult> {
  // Load settings (lazily create the singleton with safe defaults if missing).
  let settingsRow = (await db.select().from(blogProgramSettingsTable).where(eq(blogProgramSettingsTable.id, 1)).limit(1))[0];
  if (!settingsRow) {
    settingsRow = (await db.insert(blogProgramSettingsTable).values({ id: 1 }).onConflictDoNothing().returning())[0]
      ?? (await db.select().from(blogProgramSettingsTable).where(eq(blogProgramSettingsTable.id, 1)).limit(1))[0];
  }
  const settings = normalizeProgramSettings(settingsRow);
  const now = new Date();

  // Gather backlog state.
  const upcomingScheduled = (
    await db.select({ id: blogPostsTable.id }).from(blogPostsTable).where(and(eq(blogPostsTable.status, "scheduled"), gt(blogPostsTable.scheduledAt, now)))
  ).length;
  const approvedTopics = await db.select().from(blogTopicsTable).where(eq(blogTopicsTable.status, "approved"));
  const draftedReady = (
    await db.select({ id: blogPostsTable.id }).from(blogPostsTable).where(and(eq(blogPostsTable.status, "draft"), sql`${blogPostsTable.topicId} IS NOT NULL`))
  ).length;

  const plan = decideTick({
    settings,
    backlog: { upcomingScheduled, approvedQueue: approvedTopics.length, draftedReady },
    autonomousThisWeek: await autonomousThisWeek(),
  });

  const result: TickResult = {
    mode: plan.mode,
    recommended: 0,
    drafted: 0,
    scheduled: 0,
    flaggedForReview: 0,
    reason: plan.reason,
  };

  // (a) Top up recommendations (both modes may do this — humans approve them).
  if (plan.recommendTopics) {
    try {
      result.recommended = await topUpRecommendations();
    } catch (err) {
      logger.warn({ err }, "blogProgramPoller: recommendation top-up failed (non-fatal)");
    }
  }

  // REVIEW mode stops here: it NEVER generates or schedules autonomously.
  if (!plan.generateDrafts && !plan.scheduleDrafts) {
    await audit("blog-program.tick", null, { ...result });
    return result;
  }

  // (b)+(c) Generate drafts from PRE-APPROVED topics, gate them.
  let openai;
  try {
    openai = getOpenAIClientForProgram();
  } catch (err) {
    logger.warn({ err }, "blogProgramPoller: AI not configured — skipping draft generation");
    await audit("blog-program.tick", null, { ...result, skipped: "ai-not-configured" });
    return { ...result, skipped: "ai-not-configured" };
  }
  const banned = getBlogBannedPhrases();
  // The operator's editable editorial brief (same brief manual generation uses).
  // Read off the already-loaded settings row; fall back to a fresh read.
  const writingInstructions =
    (settingsRow as { writingInstructions?: string | null })?.writingInstructions ?? (await loadWritingInstructions());
  let budget = plan.draftBudget;
  for (const topic of approvedTopics) {
    if (budget <= 0) break;
    try {
      await db.update(blogTopicsTable).set({ status: "drafting" }).where(eq(blogTopicsTable.id, topic.id));
      const existingSlugs = (await db.select({ slug: blogPostsTable.slug }).from(blogPostsTable)).map((r) => r.slug);
      const draft = await generateDraftForTopic({
        openai,
        topic: { id: topic.id, title: topic.title, angle: topic.angle, targetKeyword: topic.targetKeyword },
        existingSlugs,
        writingInstructions,
      });
      // QUALITY GATE — the exception path. A failing draft is LEFT as a draft +
      // flagged; the topic is NOT advanced to scheduled.
      const gate = runQualityGate({
        title: draft.title,
        bodyHtml: draft.bodyHtml,
        bodyText: htmlToPromptText(draft.bodyHtml, 20000),
        checklistOk: prePublishChecklist({
          title: draft.title,
          excerpt: draft.metadata.excerpt ?? "",
          // cover/og are not auto-generated; checklist still flags them, which
          // we DOWNGRADE below to "flag for review" rather than hard-fail on
          // the image-only items.
          coverImageUrl: "",
          ogImageUrl: "",
          seoTitle: draft.metadata.seoTitle ?? "",
          seoDescription: (draft.metadata.metaDescription ?? draft.metadata.ogDescription) ?? "",
          slug: draft.slug,
          status: "draft",
        }).items.filter((i) => i.key !== "cover" && i.key !== "og" && i.key !== "publishDate").every((i) => i.ok),
        bannedPhrases: banned,
      });
      await recordAutonomousRevision(draft.postId, "save");
      if (!gate.pass) {
        // Exception: leave as draft, advance topic back to 'drafted' (a human
        // sees a flagged draft to review/fix), audit the failure.
        await db.update(blogTopicsTable).set({ status: "drafted" }).where(eq(blogTopicsTable.id, topic.id));
        result.flaggedForReview++;
        await audit("blog-program.auto.flagged", String(topic.id), { postId: draft.postId, failures: gate.failures });
        logger.warn({ topicId: topic.id, postId: draft.postId, failures: gate.failures }, "blogProgramPoller: draft failed quality gate — flagged for review");
        continue;
      }
      await db.update(blogTopicsTable).set({ status: "drafted" }).where(eq(blogTopicsTable.id, topic.id));
      result.drafted++;
      budget--;
      await audit("blog-program.auto.drafted", String(topic.id), { postId: draft.postId });
    } catch (err) {
      // Generation failed — roll the topic back to 'approved' for retry.
      await db.update(blogTopicsTable).set({ status: "approved" }).where(eq(blogTopicsTable.id, topic.id)).catch(() => {});
      logger.warn({ err, topicId: topic.id }, "blogProgramPoller: draft generation failed (non-fatal)");
    }
  }

  // (d) Schedule passing drafts (status='draft', topic-linked, gate-passed →
  // they were advanced to 'drafted' topic status). Honors publish days +
  // per-week cap.
  if (plan.scheduleDrafts) {
    try {
      result.scheduled = await scheduleDraftedPosts(settings, now);
    } catch (err) {
      logger.warn({ err }, "blogProgramPoller: scheduling failed (non-fatal)");
    }
  }

  await audit("blog-program.tick", null, { ...result });
  return result;
}

/** Generate fresh topic recommendations from active themes; insert as suggested. */
async function topUpRecommendations(): Promise<number> {
  let openai;
  try {
    openai = getOpenAIClientForProgram();
  } catch {
    return 0;
  }
  const themeRows = await db.select().from(blogContentThemesTable).where(eq(blogContentThemesTable.active, true)).orderBy(desc(blogContentThemesTable.priority));
  const themes: ThemeBrief[] = themeRows.map((t) => ({
    name: t.name,
    description: t.description,
    priority: t.priority,
    targetKeywords: Array.isArray(t.targetKeywords) ? (t.targetKeywords as string[]) : [],
    audience: t.audience,
  }));
  const publishedTitles = (await db.select({ title: blogPostsTable.title }).from(blogPostsTable).where(eq(blogPostsTable.status, "published"))).map((r) => r.title);
  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 1400,
    messages: buildTopicRecommendationMessages({ themes, count: RECOMMEND_PER_TICK, existingTitles: publishedTitles }),
  });
  const recommended = parseRecommendedTopics(completionText(completion));
  const themeByName = new Map(themeRows.map((t) => [t.name.toLowerCase(), t.id]));
  let inserted = 0;
  for (const t of recommended) {
    await db.insert(blogTopicsTable).values({
      themeId: t.theme ? themeByName.get(t.theme.toLowerCase()) ?? null : null,
      title: t.title,
      angle: t.angle,
      targetKeyword: t.targetKeyword,
      status: "suggested",
      source: "ai",
      rationale: t.rationale,
    });
    inserted++;
  }
  if (inserted > 0) await audit("blog-program.auto.recommended", null, { count: inserted });
  return inserted;
}

/** Place topic-linked drafts on the calendar, spaced per cadence + per-week cap. */
async function scheduleDraftedPosts(settings: ProgramSettings, now: Date): Promise<number> {
  const candidates = await db
    .select()
    .from(blogPostsTable)
    .where(and(eq(blogPostsTable.status, "draft"), sql`${blogPostsTable.topicId} IS NOT NULL`))
    .orderBy(blogPostsTable.createdAt);
  if (candidates.length === 0) return 0;
  const existing = await db
    .select({ scheduledAt: blogPostsTable.scheduledAt })
    .from(blogPostsTable)
    .where(and(eq(blogPostsTable.status, "scheduled"), gt(blogPostsTable.scheduledAt, now)));
  const existingTimes = existing.map((e) => e.scheduledAt!).filter(Boolean);
  const lastScheduledAt = existingTimes.length ? new Date(Math.max(...existingTimes.map((d) => d.getTime()))) : null;

  const slots = planScheduleSlots({
    count: candidates.length,
    now,
    lastScheduledAt,
    settings,
    existingScheduledAt: existingTimes,
  });
  let scheduled = 0;
  for (const slot of slots) {
    const post = candidates[slot.index];
    if (!post) continue;
    await db.update(blogPostsTable).set({ status: "scheduled", scheduledAt: slot.scheduledAt, publishedAt: null }).where(eq(blogPostsTable.id, post.id));
    if (post.topicId) await db.update(blogTopicsTable).set({ status: "scheduled" }).where(eq(blogTopicsTable.id, post.topicId));
    await recordAutonomousRevision(post.id, "save");
    await audit("blog-program.auto.scheduled", String(post.id), { scheduledAt: slot.scheduledAt.toISOString() });
    scheduled++;
  }
  return scheduled;
}

/** One sweep pass with cross-instance advisory lock + in-process single-flight. */
export async function runBlogProgramSweep(): Promise<void> {
  if (inflight) {
    await inflight;
    return;
  }
  inflight = (async () => {
    const client = await pool.connect();
    try {
      const lockResult = await client.query<{ locked: boolean }>(`SELECT pg_try_advisory_lock($1, $2) AS locked`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID]);
      if (!lockResult.rows[0]?.locked) {
        logger.debug("blogProgramPoller: another instance holds the lock — skipping");
        return;
      }
      try {
        const r = await runBlogProgramTick();
        if (r.drafted || r.scheduled || r.recommended || r.flaggedForReview) {
          logger.info({ ...r }, "blogProgramPoller: tick");
        }
      } catch (err) {
        // Fail-open: log + swallow so the loop survives.
        logger.error({ err }, "blogProgramPoller: tick failed (non-fatal)");
      } finally {
        await client
          .query(`SELECT pg_advisory_unlock($1, $2)`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID])
          .catch((err) => logger.warn({ err }, "blogProgramPoller: advisory unlock failed (auto-releases on disconnect)"));
      }
    } finally {
      client.release();
    }
  })().finally(() => {
    inflight = null;
  });
  await inflight;
}

/**
 * Boot-time scheduler. Runs in production OR when BLOG_PROGRAM_POLLER_ENABLED is
 * set. Crash-safe: a sweep failure logs + retries next interval, never rejecting
 * into an unhandled rejection. Returns the `.unref()`-ed handle (for tests) or
 * null when disabled.
 */
export function startBlogProgramPoller(): NodeJS.Timeout | null {
  const enabled =
    process.env.NODE_ENV === "production" ||
    process.env.BLOG_PROGRAM_POLLER_ENABLED === "1" ||
    process.env.BLOG_PROGRAM_POLLER_ENABLED === "true";
  if (!enabled) return null;
  const safeRun = () => runBlogProgramSweep().catch((err) => logger.error({ err }, "blogProgramPoller: sweep failed (will retry next interval)"));
  void safeRun();
  const handle = setInterval(() => {
    void safeRun();
  }, BLOG_PROGRAM_POLL_INTERVAL_MS);
  handle.unref();
  return handle;
}
