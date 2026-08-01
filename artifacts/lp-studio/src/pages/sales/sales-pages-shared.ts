/**
 * Shared types + pure helpers for the Sales Pages view (sales-pages.tsx) and
 * its drill-down sheet (SalesPageDrillDown.tsx). Lives in its own module so
 * the two components never form a runtime import cycle.
 */

export interface HotlinkEntry {
  hotlinkId: number;
  token: string;
  contactId: number;
  contactName: string;
}

export interface KnownViewer {
  contactId: number;
  name: string;
  views: number;
  lastViewedAt: string;
}

export interface AlertEmail {
  id: number;
  email: string;
}

/** One row of GET /sales/pages/overview — a page plus the analytics a rep
 *  scans daily (30-day window unless noted). */
export interface PageRow {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  pageStatus: string;
  pageUpdatedAt: string;
  pageCreatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  accountId: number | null;
  accountName: string | null;
  views: number;
  uniques: number;
  /** Avg tab-visible seconds; null until dwell data accrues → render "—". */
  avgDwellSeconds: number | null;
  dwellSamples: number;
  /** All-time last visit. */
  lastVisitAt: string | null;
  knownViewerCount: number;
  knownViewers: KnownViewer[];
  hotlinks: HotlinkEntry[];
}

/** 0 = I created it, 1 = I edited it, 2 = someone else's. Drives the default
 *  "My pages first" sort and the "My Pages" filter. */
export function pageMineRank(
  r: Pick<PageRow, "createdBy" | "updatedBy">,
  myEmail: string,
): 0 | 1 | 2 {
  if (!myEmail) return 2;
  if ((r.createdBy ?? "").toLowerCase() === myEmail) return 0;
  if ((r.updatedBy ?? "").toLowerCase() === myEmail) return 1;
  return 2;
}

/** "2m 05s" / "48s" — analytics-table dwell formatting. "—" for null (a page
 *  with no dwell data yet must never read as zero seconds). */
export function fmtDwell(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}
