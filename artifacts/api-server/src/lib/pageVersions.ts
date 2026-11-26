/**
 * Page version history (migration 0175).
 *
 * A version is a snapshot of a page's editable content. Snapshots are taken:
 *   - before a save that changes content, at most once per editing session
 *     (SESSION_MS since the last snapshot by the same person), so builder
 *     autosaves don't flood the history;
 *   - always when the save carries a note (an explicit checkpoint);
 *   - always for saves made through the Claude connector, so every change
 *     Claude makes can be undone on its own (author shows "… via Claude");
 *   - before a restore (so a restore can itself be undone);
 *   - before a status change (publish / unpublish);
 *   - before a delete (so a deleted page can be brought back).
 *
 * Restoring puts the snapshot's content back on the page and keeps the page's
 * current status: restoring never publishes or unpublishes anything by itself.
 */
import type { Request } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, lpPagesTable, lpPageVersionsTable, type LpPage } from "@workspace/db";
import { getInternalAuthUser } from "../middleware/internalAuth";

/** Content columns captured in a snapshot and written back by a restore. */
export const SNAPSHOT_FIELDS = [
  "title",
  "slug",
  "blocks",
  "customCss",
  "metaTitle",
  "metaDescription",
  "ogImage",
  "pageVariables",
  "ctaDefault",
  "styleOverrides",
  "animationsEnabled",
  "smoothScroll",
  "showCookieBanner",
  "audienceType",
  "segmentId",
  "accountId",
  "allowIndexing",
  "allowFollowing",
] as const satisfies readonly (keyof LpPage)[];

export type PageSnapshot = Partial<Pick<LpPage, (typeof SNAPSHOT_FIELDS)[number]>>;

export type VersionReason = "save" | "checkpoint" | "restore" | "delete" | "publish" | "unpublish";

const SESSION_MS = 15 * 60_000;
/** Versions kept per page; older ones are pruned on insert. Delete snapshots are never pruned. */
const KEEP_PER_PAGE = 100;

/**
 * Who a version is credited to, and whether the change came through the Claude
 * connector. The connector's in-process requests carry an internal auth user
 * (lib/mcp/dispatch.ts) that a browser request can't set, so this can't be faked.
 */
export function versionAuthor(req: Request): { by: string | null; viaClaude: boolean } {
  const viaClaude = getInternalAuthUser(req) !== undefined;
  const email = req.authUser?.email ?? null;
  return { by: email && viaClaude ? `${email} via Claude` : email, viaClaude };
}

export function snapshotOf(page: LpPage): PageSnapshot {
  const out: Record<string, unknown> = {};
  for (const k of SNAPSHOT_FIELDS) out[k] = page[k] ?? null;
  return out as PageSnapshot;
}

/** Trim a free-text note to one tidy line. */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 500) : null;
}

/**
 * Snapshot `page` as it is now. With reason "save" the snapshot is skipped
 * when this person already has one for this page inside the session window
 * (unless a note was given). Never throws: history must never break a save.
 */
export async function recordPageVersion(
  page: LpPage,
  opts: { reason: VersionReason; note?: string | null; by?: string | null; always?: boolean },
): Promise<number | null> {
  try {
    const note = cleanNote(opts.note);
    if (opts.reason === "save" && !note && !opts.always) {
      const [last] = await db
        .select({ createdAt: lpPageVersionsTable.createdAt, createdBy: lpPageVersionsTable.createdBy })
        .from(lpPageVersionsTable)
        .where(and(eq(lpPageVersionsTable.tenantId, page.tenantId), eq(lpPageVersionsTable.pageId, page.id)))
        .orderBy(desc(lpPageVersionsTable.createdAt))
        .limit(1);
      if (last && (last.createdBy ?? null) === (opts.by ?? null) && Date.now() - new Date(last.createdAt).getTime() < SESSION_MS) {
        return null;
      }
    }
    const [row] = await db
      .insert(lpPageVersionsTable)
      .values({
        tenantId: page.tenantId,
        pageId: page.id,
        title: page.title ?? "",
        slug: page.slug ?? "",
        status: page.status ?? "draft",
        snapshot: snapshotOf(page),
        reason: note && opts.reason === "save" ? "checkpoint" : opts.reason,
        note,
        createdBy: opts.by ?? null,
      })
      .returning({ id: lpPageVersionsTable.id });
    // Prune: keep the newest KEEP_PER_PAGE non-delete versions for this page.
    await db.execute(sql`
      DELETE FROM lp_page_versions
       WHERE tenant_id = ${page.tenantId} AND page_id = ${page.id} AND reason <> 'delete'
         AND id NOT IN (
           SELECT id FROM lp_page_versions
            WHERE tenant_id = ${page.tenantId} AND page_id = ${page.id} AND reason <> 'delete'
            ORDER BY created_at DESC, id DESC
            LIMIT ${KEEP_PER_PAGE}
         )`);
    return row?.id ?? null;
  } catch (err) {
    console.error("[pageVersions] snapshot failed (non-fatal):", String(err));
    return null;
  }
}

export async function loadPage(tenantId: number, pageId: number): Promise<LpPage | null> {
  const [page] = await db
    .select()
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
  return page ?? null;
}

/** Summary row for a history list (no snapshot body). */
export function versionSummary(v: typeof lpPageVersionsTable.$inferSelect) {
  const blocks = (v.snapshot as PageSnapshot | null)?.blocks;
  return {
    id: v.id,
    pageId: v.pageId,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    reason: v.reason,
    note: v.note,
    title: v.title,
    slug: v.slug,
    status: v.status,
    blockCount: Array.isArray(blocks) ? blocks.length : 0,
  };
}
