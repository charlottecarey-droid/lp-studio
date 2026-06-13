// Phase 4 — LP Studio blog content program (autonomous publishing) routes.
//
// Superadmin-only, rate-limited endpoints for the content program:
//   Themes CRUD                     — the strategic guardrails.
//   Program-settings get/update     — mode + cadence + guardrails + autopublish.
//   POST /admin/blog/topics/recommend     — AI tops up topic recommendations.
//   Topics list + approve/reject + manual add.
//   POST /admin/blog/topics/:id/generate  — run an APPROVED topic through the
//       Phase-3 outline→draft→metadata pipeline → a blog_posts DRAFT.
//   POST /admin/blog/schedule       — place drafted/approved posts onto the
//       calendar, spaced per cadence (respecting publish days + per-week cap).
//   GET  /admin/blog/calendar       — upcoming scheduled posts (the backlog).
//
// Nothing here auto-publishes: generate creates a DRAFT, schedule sets
// status='scheduled' (the existing blogPublishPoller flips scheduled→published
// only when due AND, for autonomously-produced posts, only when autopublish is
// enabled — enforced in the program poller). Oversight stays with the human by
// default (REVIEW mode + autopublish off).

import { Router } from "express";
import { db, blogPostsTable, blogContentThemesTable, blogTopicsTable, blogProgramSettingsTable, auditLogTable } from "@workspace/db";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { getClientIp } from "../../lib/geo";
import { withOpenAIConcurrency } from "../../lib/brand-import/openai-semaphore";
import {
  buildTopicRecommendationMessages,
  parseRecommendedTopics,
  completionText,
  type ThemeBrief,
} from "../../lib/blogAi";
import {
  normalizeProgramSettings,
  canTransitionTopic,
  isTopicStatus,
  planScheduleSlots,
  type ProgramSettings,
  type TopicStatus,
} from "../../lib/blogProgram";
import { generateDraftForTopic, getOpenAIClientForProgram, loadWritingInstructions } from "../../lib/blogTopicGenerate";

const router = Router();
const MODEL = "gpt-4o";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function intOr(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}
function adminEmail(req: import("express").Request): string | null {
  const u = (req as { authUser?: { email?: string } }).authUser;
  return typeof u?.email === "string" ? u.email : null;
}
function adminKey(req: import("express").Request): string {
  const email = adminEmail(req);
  if (email) return `sa:${email.toLowerCase()}`;
  return `ip:${getClientIp(req) || req.ip || "unknown"}`;
}

// Generation/recommendation hit OpenAI — keep the same budget guard as blog-ai.
const programAiLimiter = rateLimit({
  name: "blog-program-ai",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_BLOG_AI_PER_MIN", 20),
  keyFn: adminKey,
});

function mapAiError(err: unknown, res: import("express").Response): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not configured/i.test(msg)) {
    res.status(503).json({ error: msg });
    return;
  }
  res.status(502).json({ error: "AI request failed. Try again." });
}

/** Best-effort audit-log write for a program action (never throws). */
async function audit(action: string, targetKey: string | null, metadata: Record<string, unknown>, email: string | null): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      actorEmail: email,
      action,
      targetType: "blog_program",
      targetKey,
      metadata,
    });
  } catch (err) {
    console.error("blog-program audit failed:", String(err));
  }
}

// ── Program settings (singleton id=1) ────────────────────────────────────────

function settingsToApi(r: typeof blogProgramSettingsTable.$inferSelect) {
  return {
    mode: r.mode,
    postsPerWeek: r.postsPerWeek,
    targetBacklogDays: r.targetBacklogDays,
    publishDays: Array.isArray(r.publishDays) ? r.publishDays : [],
    publishHour: r.publishHour,
    maxAutonomousPerWeek: r.maxAutonomousPerWeek,
    autopublishEnabled: r.autopublishEnabled,
    defaultThemeId: r.defaultThemeId ?? null,
    writingInstructions: r.writingInstructions ?? "",
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

/** Read the singleton, lazily creating it with safe defaults if missing. */
export async function loadProgramSettingsRow(): Promise<typeof blogProgramSettingsTable.$inferSelect> {
  const [existing] = await db.select().from(blogProgramSettingsTable).where(eq(blogProgramSettingsTable.id, 1)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(blogProgramSettingsTable)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [row] = await db.select().from(blogProgramSettingsTable).where(eq(blogProgramSettingsTable.id, 1)).limit(1);
  return row;
}

router.get("/admin/blog/program/settings", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const row = await loadProgramSettingsRow();
    res.json({ settings: settingsToApi(row) });
  } catch (err) {
    console.error("GET /admin/blog/program/settings error:", String(err));
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.put("/admin/blog/program/settings", requireSuperadmin, async (req, res): Promise<void> => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const current = await loadProgramSettingsRow();
    // Normalize/clamp every field through the pure normalizer (the guardrail
    // bounds — backlog 30–90, cadence + per-week caps — live there).
    const normalized: ProgramSettings = normalizeProgramSettings({
      mode: b.mode,
      postsPerWeek: b.postsPerWeek,
      targetBacklogDays: b.targetBacklogDays,
      publishDays: b.publishDays,
      publishHour: b.publishHour,
      maxAutonomousPerWeek: b.maxAutonomousPerWeek,
      autopublishEnabled: b.autopublishEnabled,
    });
    const defaultThemeId =
      b.defaultThemeId === null || b.defaultThemeId === undefined
        ? null
        : intOr(b.defaultThemeId, 0) || null;

    // Writing instructions: only update when the client sends the field (so a
    // settings save that omits it never wipes the operator's brief). Bounded to
    // a sane ceiling. Empty string is allowed (the prompt builders fall back to
    // the seeded default, and the UI's "Reset to default" sends the default text).
    const writingInstructions =
      typeof b.writingInstructions === "string"
        ? b.writingInstructions.slice(0, 8000)
        : current.writingInstructions;

    const [row] = await db
      .update(blogProgramSettingsTable)
      .set({
        mode: normalized.mode,
        postsPerWeek: normalized.postsPerWeek,
        targetBacklogDays: normalized.targetBacklogDays,
        publishDays: normalized.publishDays,
        publishHour: normalized.publishHour,
        maxAutonomousPerWeek: normalized.maxAutonomousPerWeek,
        autopublishEnabled: normalized.autopublishEnabled,
        defaultThemeId,
        writingInstructions,
      })
      .where(eq(blogProgramSettingsTable.id, 1))
      .returning();

    // Audit any change to the safety-critical knobs (mode / autopublish).
    if (current.mode !== normalized.mode || current.autopublishEnabled !== normalized.autopublishEnabled) {
      await audit(
        "blog-program.settings.changed",
        "1",
        {
          mode: { from: current.mode, to: normalized.mode },
          autopublishEnabled: { from: current.autopublishEnabled, to: normalized.autopublishEnabled },
        },
        adminEmail(req),
      );
    }
    res.json({ settings: settingsToApi(row) });
  } catch (err) {
    console.error("PUT /admin/blog/program/settings error:", String(err));
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ── Themes CRUD ──────────────────────────────────────────────────────────────

function themeToApi(r: typeof blogContentThemesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    priority: r.priority,
    targetKeywords: Array.isArray(r.targetKeywords) ? r.targetKeywords : [],
    audience: r.audience,
    active: r.active,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
  };
}

function toKeywords(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

router.get("/admin/blog/program/themes", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(blogContentThemesTable)
      .orderBy(desc(blogContentThemesTable.active), desc(blogContentThemesTable.priority), blogContentThemesTable.id);
    res.json({ themes: rows.map(themeToApi) });
  } catch (err) {
    console.error("GET /admin/blog/program/themes error:", String(err));
    res.status(500).json({ error: "Failed to load themes" });
  }
});

router.post("/admin/blog/program/themes", requireSuperadmin, async (req, res): Promise<void> => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = str(b.name).trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [row] = await db
      .insert(blogContentThemesTable)
      .values({
        name,
        description: str(b.description).trim(),
        priority: Math.max(1, Math.min(5, intOr(b.priority, 3))),
        targetKeywords: toKeywords(b.targetKeywords),
        audience: str(b.audience).trim(),
        active: b.active === false ? false : true,
      })
      .returning();
    res.status(201).json({ theme: themeToApi(row) });
  } catch (err) {
    console.error("POST /admin/blog/program/themes error:", String(err));
    res.status(500).json({ error: "Failed to create theme" });
  }
});

router.put("/admin/blog/program/themes/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = str(b.name).trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [row] = await db
      .update(blogContentThemesTable)
      .set({
        name,
        description: str(b.description).trim(),
        priority: Math.max(1, Math.min(5, intOr(b.priority, 3))),
        targetKeywords: toKeywords(b.targetKeywords),
        audience: str(b.audience).trim(),
        active: b.active === false ? false : true,
      })
      .where(eq(blogContentThemesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ theme: themeToApi(row) });
  } catch (err) {
    console.error("PUT /admin/blog/program/themes/:id error:", String(err));
    res.status(500).json({ error: "Failed to update theme" });
  }
});

router.delete("/admin/blog/program/themes/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(blogContentThemesTable).where(eq(blogContentThemesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/blog/program/themes/:id error:", String(err));
    res.status(500).json({ error: "Failed to delete theme" });
  }
});

// ── Topics ───────────────────────────────────────────────────────────────────

function topicToApi(r: typeof blogTopicsTable.$inferSelect) {
  return {
    id: r.id,
    themeId: r.themeId ?? null,
    title: r.title,
    angle: r.angle,
    targetKeyword: r.targetKeyword,
    status: r.status,
    source: r.source,
    rationale: r.rationale,
    postId: r.postId ?? null,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decidedBy: r.decidedBy ?? null,
  };
}

router.get("/admin/blog/program/topics", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const statusFilter = str(req.query.status).trim();
    const base = db.select().from(blogTopicsTable);
    const rows = isTopicStatus(statusFilter)
      ? await base.where(eq(blogTopicsTable.status, statusFilter)).orderBy(desc(blogTopicsTable.createdAt))
      : await base.orderBy(desc(blogTopicsTable.createdAt)).limit(500);
    res.json({ topics: rows.map(topicToApi) });
  } catch (err) {
    console.error("GET /admin/blog/program/topics error:", String(err));
    res.status(500).json({ error: "Failed to load topics" });
  }
});

// Manual add — a human-authored topic lands as status='suggested' (source
// 'manual'), so it still goes through the same approve gate.
router.post("/admin/blog/program/topics", requireSuperadmin, async (req, res): Promise<void> => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const title = str(b.title).trim();
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  try {
    const [row] = await db
      .insert(blogTopicsTable)
      .values({
        themeId: b.themeId ? intOr(b.themeId, 0) || null : null,
        title,
        angle: str(b.angle).trim(),
        targetKeyword: str(b.targetKeyword).trim(),
        status: "suggested",
        source: "manual",
        rationale: str(b.rationale).trim(),
      })
      .returning();
    res.status(201).json({ topic: topicToApi(row) });
  } catch (err) {
    console.error("POST /admin/blog/program/topics error:", String(err));
    res.status(500).json({ error: "Failed to add topic" });
  }
});

// Edit a topic's editable fields (title/angle/keyword/theme) while suggested.
router.put("/admin/blog/program/topics/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const title = str(b.title).trim();
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  try {
    const [row] = await db
      .update(blogTopicsTable)
      .set({
        title,
        angle: str(b.angle).trim(),
        targetKeyword: str(b.targetKeyword).trim(),
        themeId: b.themeId ? intOr(b.themeId, 0) || null : null,
        rationale: str(b.rationale).trim(),
      })
      .where(eq(blogTopicsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ topic: topicToApi(row) });
  } catch (err) {
    console.error("PUT /admin/blog/program/topics/:id error:", String(err));
    res.status(500).json({ error: "Failed to update topic" });
  }
});

// Approve / reject — a guarded status transition with audit.
router.post("/admin/blog/program/topics/:id/decision", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const decision = str((req.body ?? {}).decision).trim();
  const to: TopicStatus | null = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : null;
  if (!to) {
    res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
    return;
  }
  try {
    const [existing] = await db.select().from(blogTopicsTable).where(eq(blogTopicsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canTransitionTopic(existing.status as TopicStatus, to)) {
      res.status(409).json({ error: `Cannot ${decision} a topic in status '${existing.status}'` });
      return;
    }
    const email = adminEmail(req);
    const [row] = await db
      .update(blogTopicsTable)
      .set({ status: to, decidedAt: new Date(), decidedBy: email })
      .where(eq(blogTopicsTable.id, id))
      .returning();
    await audit(`blog-program.topic.${decision}`, String(id), { title: existing.title }, email);
    res.json({ topic: topicToApi(row) });
  } catch (err) {
    console.error("POST /admin/blog/program/topics/:id/decision error:", String(err));
    res.status(500).json({ error: "Failed to decide topic" });
  }
});

// ── Recommend topics (AI) ────────────────────────────────────────────────────

router.post("/admin/blog/program/topics/recommend", requireSuperadmin, programAiLimiter, async (req, res): Promise<void> => {
  const count = Math.max(1, Math.min(15, intOr((req.body ?? {}).count, 5)));
  let openai: ReturnType<typeof getOpenAIClientForProgram>;
  try {
    openai = getOpenAIClientForProgram();
  } catch (e) {
    res.status(503).json({ error: String(e instanceof Error ? e.message : e) });
    return;
  }
  try {
    const themeRows = await db
      .select()
      .from(blogContentThemesTable)
      .where(eq(blogContentThemesTable.active, true))
      .orderBy(desc(blogContentThemesTable.priority));
    const themes: ThemeBrief[] = themeRows.map((t) => ({
      name: t.name,
      description: t.description,
      priority: t.priority,
      targetKeywords: Array.isArray(t.targetKeywords) ? (t.targetKeywords as string[]) : [],
      audience: t.audience,
    }));
    const publishedTitles = (
      await db
        .select({ title: blogPostsTable.title })
        .from(blogPostsTable)
        .where(eq(blogPostsTable.status, "published"))
    ).map((r) => r.title);

    const completion = await withOpenAIConcurrency(() =>
      openai.chat.completions.create({
        model: MODEL,
        max_completion_tokens: 1400,
        messages: buildTopicRecommendationMessages({ themes, count, existingTitles: publishedTitles }),
      }),
    );
    const recommended = parseRecommendedTopics(completionText(completion));
    if (recommended.length === 0) {
      res.status(502).json({ error: "AI returned no topics. Try again or add detail to the themes." });
      return;
    }
    // Map theme name → id for linking.
    const themeByName = new Map(themeRows.map((t) => [t.name.toLowerCase(), t.id]));
    const inserted = [];
    for (const t of recommended) {
      const [row] = await db
        .insert(blogTopicsTable)
        .values({
          themeId: t.theme ? themeByName.get(t.theme.toLowerCase()) ?? null : null,
          title: t.title,
          angle: t.angle,
          targetKeyword: t.targetKeyword,
          status: "suggested",
          source: "ai",
          rationale: t.rationale,
        })
        .returning();
      inserted.push(topicToApi(row));
    }
    await audit("blog-program.topics.recommended", null, { count: inserted.length }, adminEmail(req));
    res.json({ topics: inserted });
  } catch (err) {
    console.error("POST /admin/blog/program/topics/recommend error:", String(err));
    mapAiError(err, res);
  }
});

// ── Generate draft from an approved topic ────────────────────────────────────

router.post("/admin/blog/program/topics/:id/generate", requireSuperadmin, programAiLimiter, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  let openai: ReturnType<typeof getOpenAIClientForProgram>;
  try {
    openai = getOpenAIClientForProgram();
  } catch (e) {
    res.status(503).json({ error: String(e instanceof Error ? e.message : e) });
    return;
  }
  try {
    const [topic] = await db.select().from(blogTopicsTable).where(eq(blogTopicsTable.id, id)).limit(1);
    if (!topic) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Only an APPROVED (or re-drafting) topic may be generated — preserves the
    // approve gate. A suggested/rejected topic cannot jump straight to a draft.
    if (!canTransitionTopic(topic.status as TopicStatus, "drafting")) {
      res.status(409).json({ error: `Topic must be approved before generating (status='${topic.status}')` });
      return;
    }
    await db.update(blogTopicsTable).set({ status: "drafting" }).where(eq(blogTopicsTable.id, id));
    const existingSlugs = (await db.select({ slug: blogPostsTable.slug }).from(blogPostsTable)).map((r) => r.slug);

    const writingInstructions = await loadWritingInstructions();
    let draft;
    try {
      draft = await generateDraftForTopic({
        openai,
        topic: { id: topic.id, title: topic.title, angle: topic.angle, targetKeyword: topic.targetKeyword },
        existingSlugs,
        withConcurrency: withOpenAIConcurrency,
        writingInstructions,
      });
    } catch (genErr) {
      // Generation failed — fall back to 'approved' so it can be retried.
      await db.update(blogTopicsTable).set({ status: "approved" }).where(eq(blogTopicsTable.id, id));
      throw genErr;
    }
    await db.update(blogTopicsTable).set({ status: "drafted" }).where(eq(blogTopicsTable.id, id));
    await audit("blog-program.topic.generated", String(id), { postId: draft.postId }, adminEmail(req));
    res.json({ topic: { ...topicToApi(topic), status: "drafted", postId: draft.postId }, post: { id: draft.postId, slug: draft.slug, title: draft.title } });
  } catch (err) {
    console.error("POST /admin/blog/program/topics/:id/generate error:", String(err));
    mapAiError(err, res);
  }
});

// ── Scheduling + calendar ─────────────────────────────────────────────────────

// Place drafted posts (status='draft', topicId set) onto the calendar, spaced
// per cadence. Sets blog_posts.status='scheduled' + scheduledAt and advances
// the linked topic to 'scheduled'. Honors publish days + the per-week cap via
// the pure planScheduleSlots. Manual trigger of the same logic the autonomous
// poller uses.
router.post("/admin/blog/program/schedule", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const settingsRow = await loadProgramSettingsRow();
    const settings = normalizeProgramSettings(settingsRow);
    const now = new Date();

    // Candidate drafts: posts linked to a topic, still drafts. Optional explicit
    // postIds list narrows it.
    const requestedIds = Array.isArray((req.body ?? {}).postIds)
      ? ((req.body as { postIds: unknown[] }).postIds.map((x) => intOr(x, 0)).filter((n) => n > 0))
      : null;
    const draftRows = await db
      .select()
      .from(blogPostsTable)
      .where(and(eq(blogPostsTable.status, "draft"), sql`${blogPostsTable.topicId} IS NOT NULL`))
      .orderBy(blogPostsTable.createdAt);
    const candidates = requestedIds ? draftRows.filter((r) => requestedIds.includes(r.id)) : draftRows;
    if (candidates.length === 0) {
      res.json({ scheduled: [] });
      return;
    }

    // Existing future-scheduled times (for the per-week cap across runs) +
    // the latest, so new slots start after it.
    const existing = await db
      .select({ scheduledAt: blogPostsTable.scheduledAt })
      .from(blogPostsTable)
      .where(and(eq(blogPostsTable.status, "scheduled"), gt(blogPostsTable.scheduledAt, now)));
    const existingTimes = existing.map((e) => e.scheduledAt!).filter(Boolean);
    const lastScheduledAt = existingTimes.length
      ? new Date(Math.max(...existingTimes.map((d) => d.getTime())))
      : null;

    const plan = planScheduleSlots({
      count: candidates.length,
      now,
      lastScheduledAt,
      settings,
      existingScheduledAt: existingTimes,
    });

    const scheduled: Array<{ postId: number; scheduledAt: string }> = [];
    for (const slot of plan) {
      const post = candidates[slot.index];
      if (!post) continue;
      await db
        .update(blogPostsTable)
        .set({ status: "scheduled", scheduledAt: slot.scheduledAt, publishedAt: null })
        .where(eq(blogPostsTable.id, post.id));
      if (post.topicId) {
        await db.update(blogTopicsTable).set({ status: "scheduled" }).where(eq(blogTopicsTable.id, post.topicId));
      }
      scheduled.push({ postId: post.id, scheduledAt: slot.scheduledAt.toISOString() });
    }
    await audit("blog-program.scheduled", null, { count: scheduled.length }, adminEmail(req));
    res.json({ scheduled });
  } catch (err) {
    console.error("POST /admin/blog/program/schedule error:", String(err));
    res.status(500).json({ error: "Failed to schedule posts" });
  }
});

// Calendar: upcoming scheduled posts (the backlog) + a count summary.
router.get("/admin/blog/program/calendar", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const now = new Date();
    const rows = await db
      .select({
        id: blogPostsTable.id,
        title: blogPostsTable.title,
        slug: blogPostsTable.slug,
        scheduledAt: blogPostsTable.scheduledAt,
        topicId: blogPostsTable.topicId,
      })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.status, "scheduled"))
      .orderBy(blogPostsTable.scheduledAt)
      .limit(200);
    const upcoming = rows.filter((r) => r.scheduledAt && r.scheduledAt.getTime() > now.getTime());
    res.json({
      calendar: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
        topicId: r.topicId ?? null,
      })),
      upcomingCount: upcoming.length,
    });
  } catch (err) {
    console.error("GET /admin/blog/program/calendar error:", String(err));
    res.status(500).json({ error: "Failed to load calendar" });
  }
});

export default router;
