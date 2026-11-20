/**
 * Where a Partner Hub's marketing requests go in Asana, and who gets them.
 *
 * In order: the hub's own project (set in its pop-up) → the workspace's
 * project for all hubs (Settings → Partner Hubs) → the project of the
 * workspace's Asana connection. The assignee is the workspace's choice for
 * hubs; none set = unassigned.
 */
import { db, lpRoomAutocreateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export { ASANA_GID_RE, pickAsanaTarget } from "./partnerRoomAsanaPick";
import { pickAsanaTarget } from "./partnerRoomAsanaPick";

export async function hubAsanaTarget(tenantId: number, roomProjectGid: string | null | undefined): Promise<{ projectGid: string | null; assigneeGid: string | null }> {
  const [cfg] = await db.select({ projectGid: lpRoomAutocreateTable.asanaProjectGid, assigneeGid: lpRoomAutocreateTable.asanaAssigneeGid }).from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
  return pickAsanaTarget(roomProjectGid, cfg ?? null);
}
