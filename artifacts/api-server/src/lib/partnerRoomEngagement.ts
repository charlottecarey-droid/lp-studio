/**
 * Partner rooms: asset engagement for the team. Pure: turns raw asset events
 * (view / open / download / progress / time) into one row per asset.
 */
export interface AssetEventRow {
  assetKey: string;
  assetTitle: string | null;
  assetKind: string;
  action: string;
  value: number | null;
  sessionId: string;
  viewerEmail: string | null;
  viewerName: string | null;
  createdAt: Date;
}

export interface RoomAssetStat {
  key: string;
  title: string;
  kind: string;
  /** Times it was opened: in the viewer or in a new tab. */
  views: number;
  downloads: number;
  /** Seconds spent with it open in the viewer, in total. */
  seconds: number;
  /** Furthest any viewer got through a video (0, 25, 50, 75 or 100). */
  maxProgress: number;
  /** Distinct people, named where known, most recent first. */
  people: string[];
  /** Distinct visitors nobody could name (sessions with no identity). */
  anonymous: number;
  lastAt: string;
}

export function summarizeAssetEvents(events: AssetEventRow[]): RoomAssetStat[] {
  const byKey = new Map<string, RoomAssetStat & { anonSessions: Set<string>; named: Set<string> }>();
  // Newest first, so titles and "people" come out most-recent-first.
  for (const e of [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    let s = byKey.get(e.assetKey);
    if (!s) {
      s = { key: e.assetKey, title: e.assetTitle || e.assetKey, kind: e.assetKind, views: 0, downloads: 0, seconds: 0, maxProgress: 0, people: [], anonymous: 0, lastAt: e.createdAt.toISOString(), anonSessions: new Set(), named: new Set() };
      byKey.set(e.assetKey, s);
    }
    if (e.action === "view" || e.action === "open") s.views++;
    else if (e.action === "download") s.downloads++;
    else if (e.action === "time") s.seconds += Math.max(0, Math.min(e.value ?? 0, 4 * 3600));
    else if (e.action === "progress") s.maxProgress = Math.max(s.maxProgress, Math.min(100, e.value ?? 0));
    const who = (e.viewerName || e.viewerEmail || "").trim();
    if (who) {
      const id = (e.viewerEmail || who).toLowerCase();
      if (!s.named.has(id)) {
        s.named.add(id);
        if (s.people.length < 8) s.people.push(who);
      }
    } else s.anonSessions.add(e.sessionId);
  }
  return [...byKey.values()]
    .map(({ anonSessions, named: _named, ...s }) => ({ ...s, anonymous: anonSessions.size }))
    .sort((a, b) => b.views + b.downloads - (a.views + a.downloads) || b.lastAt.localeCompare(a.lastAt));
}
