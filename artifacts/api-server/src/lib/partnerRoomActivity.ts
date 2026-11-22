/**
 * A short record of what the account team did to a hub: who published it,
 * sent a reminder, replied to a request, changed its settings. It is written
 * from one place (a hook on the hub's own routes) rather than from each
 * route, so a new route is covered by adding a line here.
 */
import type { NextFunction, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, lpRoomActivityTable } from "@workspace/db";

/**
 * What a successful change to a hub is called. `rest` is the path after
 * `/lp/partner-rooms/:pageId/`. Null for anything not worth a line (reads,
 * previews, dry runs, files made by the kit).
 */
export function activityLabel(method: string, rest: string, body: Record<string, unknown> | undefined): string | null {
  const b = body ?? {};
  const m = method.toUpperCase();
  const path = rest.replace(/^\/+|\/+$/g, "");
  if (m === "GET") return null;
  if (path === "publish") return b.publish === false ? "Unpublished the hub" : "Published the hub";
  if (path === "archive") return b.archived === false ? "Brought the hub back from the archive" : "Archived the hub";
  if (path === "remind") return "Sent the customer a reminder";
  if (path === "invite") return "Invited people from the customer’s team";
  if (path === "members") return "Changed who has access";
  if (path === "plan-queue/send") return "Sent the marketing plan to marketing";
  if (path === "welcome-kits") return b.dryRun === true ? null : "Sent welcome kits";
  if (path === "digest/send") return "Sent the weekly digest";
  if (path === "account") return b.team !== undefined && b.account === undefined ? "Changed the team" : "Changed the account settings";
  if (path === "settings") return "Changed settings";
  if (path === "stage" || path === "stage/extend") return "Changed the stage or waves";
  if (path === "goals") return "Changed the goals";
  if (path === "cover") return "Changed the cover";
  if (path === "overview") return "Changed the Overview sections";
  if (path === "links") return "Changed the important links";
  if (/^requests\/\d+$/.test(path)) return b.reply !== undefined ? "Replied to a request" : b.status === "done" ? "Finished a request" : "Updated a request";
  if (path === "practices" && m === "DELETE") return "Removed all practices";
  if (path === "practices/wave") return "Moved practices to a wave";
  if (/^practices\/(import|sync-salesforce|sync-sheet)$/.test(path)) return "Updated the practice list";
  if (/^practices\/\d+$/.test(path)) return "Changed a practice";
  if (/^uploads\/\d+$/.test(path) && m === "DELETE") return "Deleted a file the customer sent";
  if (/^tasks\//.test(path) && m === "DELETE") return "Reopened a step for the customer";
  if (path === "wins") return "Posted to the News Feed";
  return null;
}

/** The same person doing the same thing again within this long is one line, not many (a row of switches, a run of stage changes). */
export const ACTIVITY_QUIET_MS = 10 * 60 * 1000;

/** Hook for the hub routers: after a change succeeds, note who did what. Never slows or fails the request. */
export function recordHubActivity(req: Request, res: Response, next: NextFunction): void {
  const flagged = req as Request & { hubActivityNoted?: boolean };
  if (flagged.hubActivityNoted || req.method === "GET") return next();
  flagged.hubActivityNoted = true;
  const pageId = Number(req.params.pageId);
  const rest = req.path;
  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !Number.isInteger(pageId) || pageId <= 0) return;
    const user = req.authUser;
    const action = activityLabel(req.method, rest, req.body as Record<string, unknown> | undefined);
    if (!action || !user || user.tenantId == null) return;
    const actor = user.name || user.email;
    void (async () => {
      const [last] = await db.select({ actor: lpRoomActivityTable.actor, action: lpRoomActivityTable.action, createdAt: lpRoomActivityTable.createdAt }).from(lpRoomActivityTable).where(and(eq(lpRoomActivityTable.pageId, pageId), eq(lpRoomActivityTable.tenantId, user.tenantId!))).orderBy(desc(lpRoomActivityTable.createdAt)).limit(1);
      if (last && last.actor === actor && last.action === action && Date.now() - last.createdAt.getTime() < ACTIVITY_QUIET_MS) return;
      await db.insert(lpRoomActivityTable).values({ tenantId: user.tenantId!, pageId, actor, action });
    })().catch((err) => req.log?.warn?.({ err }, "hub activity note failed"));
  });
  next();
}

/** The hub's latest activity, newest first. */
export async function hubActivity(tenantId: number, pageId: number, limit = 40): Promise<{ actor: string; action: string; at: string }[]> {
  const rows = await db.select().from(lpRoomActivityTable).where(and(eq(lpRoomActivityTable.pageId, pageId), eq(lpRoomActivityTable.tenantId, tenantId))).orderBy(desc(lpRoomActivityTable.createdAt)).limit(limit);
  return rows.map((r) => ({ actor: r.actor, action: r.action, at: r.createdAt.toISOString() }));
}
