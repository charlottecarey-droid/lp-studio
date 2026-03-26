import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PageSize } from "@/hooks/use-paginated-list";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalFiltered: number;
  pageSize: PageSize;
  pageSizes: PageSize[];
  search: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
}

export default function PaginationControls({
  page,
  totalPages,
  totalFiltered,
  pageSize,
  pageSizes,
  search,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  searchPlaceholder = "Search…",
}: PaginationControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {/* Count */}
        <span>{totalFiltered} result{totalFiltered !== 1 ? "s" : ""}</span>

        {/* Page size */}
        <div className="flex items-center gap-1.5">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="h-7 px-1.5 rounded border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Page nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[4rem] text-center text-foreground font-medium">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
