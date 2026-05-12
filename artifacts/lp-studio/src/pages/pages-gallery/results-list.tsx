import { Dispatch, SetStateAction } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PageRow } from "./page-row";
import type { Page, PerfScore, Test } from "./types";

interface PaginationLike {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  pageItems: Page[];
  setPage: (p: number) => void;
}

interface Props {
  pagesPag: PaginationLike;
  isAdmin: boolean;
  micrositeDomain: string | null;
  runningTests: Test[];
  perfScores: Record<number, PerfScore>;
  commentCounts: Record<number, number>;
  segmentNameById: Record<string, string>;
  selectedIds: Set<number>;
  setSelectedIds: Dispatch<SetStateAction<Set<number>>>;
  onToggleSelect: (id: number) => void;
  cloningPageId: number | null;
  onClone: (page: Page) => void;
  onAbTest: (page: Page) => void;
  onLinks: (page: Page) => void;
  onShare: (page: Page) => void;
  onDelete: (page: Page) => void;
  onTemplateSaved: (updated: Page) => void;
}

export function ResultsList({
  pagesPag,
  isAdmin,
  micrositeDomain,
  runningTests,
  perfScores,
  commentCounts,
  segmentNameById,
  selectedIds,
  setSelectedIds,
  onToggleSelect,
  cloningPageId,
  onClone,
  onAbTest,
  onLinks,
  onShare,
  onDelete,
  onTemplateSaved,
}: Props) {
  const allOnPageSelected = pagesPag.pageItems.length > 0 && pagesPag.pageItems.every(p => selectedIds.has(p.id));

  return (
    <>
      {/* Table header */}
      <div className={`hidden md:grid gap-3 px-4 pb-1 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider ${isAdmin ? "grid-cols-[28px_1fr_100px_80px_80px_100px_130px_120px]" : "grid-cols-[28px_1fr_100px_80px_80px_100px_120px]"}`}>
        <span>
          <input
            type="checkbox"
            className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-primary cursor-pointer mt-0.5"
            checked={allOnPageSelected}
            onChange={e => {
              if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...pagesPag.pageItems.map(p => p.id)]));
              else setSelectedIds(prev => { const next = new Set(prev); pagesPag.pageItems.forEach(p => next.delete(p.id)); return next; });
            }}
          />
        </span>
        <span>Page</span>
        <span>Status</span>
        <span>Blocks</span>
        <span>Score</span>
        <span>Updated</span>
        {isAdmin && <span>Author</span>}
        <span className="text-right">Actions</span>
      </div>

      {/* No overflow-hidden on the container so dropdown menus aren't clipped */}
      <div className="border border-border rounded-lg divide-y divide-border/40">
        {pagesPag.pageItems.map(page => (
          <PageRow
            key={page.id}
            page={page}
            isAdmin={isAdmin}
            micrositeDomain={micrositeDomain}
            isRunning={runningTests.some(t => t.slug === page.slug)}
            perf={perfScores[page.id]}
            commentCount={commentCounts[page.id] ?? 0}
            segmentName={page.segmentId ? segmentNameById[page.segmentId] ?? null : null}
            selected={selectedIds.has(page.id)}
            onToggleSelect={() => onToggleSelect(page.id)}
            cloningPageId={cloningPageId}
            onClone={() => onClone(page)}
            onAbTest={() => onAbTest(page)}
            onLinks={() => onLinks(page)}
            onShare={() => onShare(page)}
            onDelete={() => onDelete(page)}
            onTemplateSaved={onTemplateSaved}
          />
        ))}
      </div>
      <PaginationBar
        page={pagesPag.page} totalPages={pagesPag.totalPages}
        from={pagesPag.from} to={pagesPag.to} total={pagesPag.total}
        onPage={pagesPag.setPage} label="pages"
      />
    </>
  );
}
