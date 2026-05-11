import { Search, Star, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterStatus, SortBy } from "./types";

interface Props {
  filterStatus: FilterStatus;
  setFilterStatus: (s: FilterStatus) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  showMine: boolean;
}

export function FiltersBar({
  filterStatus,
  setFilterStatus,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
  showMine,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex gap-1 flex-wrap">
        {((["All", "Mine", "Draft", "Published", "Running", "Templates"] as const)
          .filter(s => s !== "Mine" || showMine)
        ).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap flex items-center gap-1.5",
              filterStatus === status
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            title={status === "Mine" ? "Pages you authored or last updated" : undefined}
          >
            {status === "Mine" && <User className="w-3 h-3" />}
            {status === "Templates" && <Star className="w-3 h-3" />}
            {status === "Mine" ? "My Pages" : status}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
        <label className="text-[12px] text-muted-foreground shrink-0" htmlFor="pages-sort-by">
          Sort
        </label>
        <select
          id="pages-sort-by"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          className="text-[13px] border border-border rounded-lg bg-background py-1.5 pl-2.5 pr-7 outline-none focus:ring-1 focus:ring-ring"
          title="Sort pages"
        >
          <option value="recent">Recent</option>
          <option value="author">Author</option>
        </select>
      </div>
      <div className="relative w-full sm:w-56">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search by title, slug, or author…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-8 py-1.5 text-[13px] border border-border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
