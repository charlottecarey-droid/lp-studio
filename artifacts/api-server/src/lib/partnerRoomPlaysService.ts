/**
 * Recommended plays: gather what a hub's rules need from the database, and
 * remember what the team did with each play.
 */
import { db, lpPagesTable, lpRoomPracticeSnapshotsTable, lpRoomPracticesTable, lpRoomSettingsTable, lpRoomTaskStateTable, lpRoomViewsTable, lpRoomWinsTable } from "@workspace/db";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { extractRoomTasks, roomPartnerName, roomWorkspaceProps, resolveRoomBlocks } from "./partnerRoom";
import { firstDateIn } from "./partnerRoomDates";
import { zip5 } from "./partnerRoomGeo";
import { activePlays, recommendPlays, type Play, type PlayInput, type PlayState } from "./partnerRoomPlays";
import { roomStageFromProps, waveKey } from "./partnerRoomStage";
import { zipCentroid } from "./zipCentroids";

export interface HubPlays {
  /** What to show now, best first. */
  plays: Play[];
  /** Every play that applies, including ones the team already acted on (for acting on a play by key). */
  all: Play[];
  /** How many are quiet because they were requested, done or set aside. */
  quiet: number;
  noDirectOutreach: boolean;
  customer: string;
}

export async function hubPlays(page: { id: number; tenantId: number }, now: Date = new Date()): Promise<HubPlays | null> {
  const [row] = await db.select({ blocks: lpPagesTable.blocks, status: lpPagesTable.status, title: lpPagesTable.title }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
  if (!row) return null;
  const blocks = resolveRoomBlocks(row.blocks);
  const props = roomWorkspaceProps(blocks);
  if (!props) return null;
  const stage = roomStageFromProps(props, now);
  const [practices, snapshots, [settings], done, [visit], [win]] = await Promise.all([
    db.select().from(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, page.id)).orderBy(asc(lpRoomPracticesTable.name)).limit(5000),
    db.select({ day: lpRoomPracticeSnapshotsTable.day, byStage: lpRoomPracticeSnapshotsTable.byStage }).from(lpRoomPracticeSnapshotsTable).where(eq(lpRoomPracticeSnapshotsTable.pageId, page.id)).orderBy(asc(lpRoomPracticeSnapshotsTable.day)).limit(400),
    db.select({ noDirectOutreach: lpRoomSettingsTable.noDirectOutreach, playsState: lpRoomSettingsTable.playsState }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1),
    db.select({ taskKey: lpRoomTaskStateTable.taskKey }).from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, page.id)),
    // Team members are never recorded as hub visits, so any named visit is the customer's.
    db.select({ at: sql<string | null>`max(${lpRoomViewsTable.createdAt})` }).from(lpRoomViewsTable).where(and(eq(lpRoomViewsTable.pageId, page.id), isNotNull(lpRoomViewsTable.viewerEmail))),
    db.select({ at: sql<string | null>`max(${lpRoomWinsTable.createdAt})` }).from(lpRoomWinsTable).where(eq(lpRoomWinsTable.pageId, page.id)),
  ]);
  const doneKeys = new Set(done.map((d) => d.taskKey));
  const waveCounts = new Map<string, { total: number; live: number }>();
  for (const p of practices) {
    if (!p.wave) continue;
    const c = waveCounts.get(waveKey(p.wave)) ?? { total: 0, live: 0 };
    waveCounts.set(waveKey(p.wave), { total: c.total + 1, live: c.live + (p.stage === "live" ? 1 : 0) });
  }
  const input: PlayInput = {
    customer: roomPartnerName(blocks) || row.title,
    practices: practices.map((p) => {
      const at = zipCentroid(p.zip);
      return {
        id: p.id, name: p.name, stage: p.stage, city: p.city, state: p.state, region: p.region, regionalManager: p.regionalManager, officeType: p.officeType,
        mailable: !!(p.address ?? "").trim() && !!(p.city ?? "").trim() && !!(p.state ?? "").trim() && !!zip5((p.zip ?? "").slice(0, 10)),
        trainingDay: firstDateIn(p.trainingDate, now), kitSent: !!p.kitSentAt, wave: p.wave, lat: at?.lat ?? null, lng: at?.lng ?? null,
      };
    }),
    day: stage.day,
    stage: stage.stage,
    noDirectOutreach: !!settings?.noDirectOutreach,
    trend: snapshots.map((s) => ({ day: s.day, live: Number((s.byStage as Record<string, number> | null)?.live ?? 0) })),
    published: row.status === "published",
    lastCustomerVisit: visit?.at ? new Date(visit.at) : null,
    lastWin: win?.at ? new Date(win.at) : null,
    openCustomerSteps: [...extractRoomTasks(blocks).keys()].filter((k) => !doneKeys.has(k)).length,
    waves: stage.waves.map((w) => ({ name: w.name, target: w.target, ...(waveCounts.get(waveKey(w.key)) ?? { total: 0, live: 0 }) })),
  };
  const all = recommendPlays(input, now);
  const plays = activePlays(all, (settings?.playsState ?? null) as Record<string, PlayState> | null, now);
  return { plays, all, quiet: all.length - plays.length, noDirectOutreach: input.noDirectOutreach, customer: input.customer };
}

/** Remember what was done with a play; it stays quiet for `days`. Old entries are dropped as they lapse. */
export async function setPlayState(page: { id: number; tenantId: number }, key: string, state: PlayState["state"], by: string, days = 30, now: Date = new Date()): Promise<void> {
  const [row] = await db.select({ playsState: lpRoomSettingsTable.playsState }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1);
  const today = now.toISOString().slice(0, 10);
  const kept = Object.fromEntries(Object.entries((row?.playsState ?? {}) as Record<string, PlayState>).filter(([, v]) => v && v.until >= today));
  const until = new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const next = { ...kept, [key.slice(0, 80)]: { state, until, by: by.slice(0, 120) } };
  await db.insert(lpRoomSettingsTable).values({ pageId: page.id, tenantId: page.tenantId, playsState: next }).onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { playsState: next } });
}

export async function setNoDirectOutreach(page: { id: number; tenantId: number }, on: boolean): Promise<void> {
  await db.insert(lpRoomSettingsTable).values({ pageId: page.id, tenantId: page.tenantId, noDirectOutreach: on }).onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { noDirectOutreach: on } });
}

export async function hubRestrictsOutreach(pageId: number): Promise<boolean> {
  const [row] = await db.select({ on: lpRoomSettingsTable.noDirectOutreach }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, pageId)).limit(1);
  return !!row?.on;
}
