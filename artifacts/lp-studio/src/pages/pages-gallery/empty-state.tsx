import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FilterStatus } from "./types";

export function GalleryLoadingState() {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="p-4 flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function NoPagesEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border border-border rounded-lg p-12 text-center">
      <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-foreground mb-1">No pages yet</h3>
      <p className="text-xs text-muted-foreground mb-4">Create your first page to get started.</p>
      <Button size="sm" className="gap-1.5 text-[13px] rounded-lg" onClick={onCreate}>
        <Plus className="w-3.5 h-3.5" />
        Create Page
      </Button>
    </div>
  );
}

export function NoFilteredPagesEmptyState({
  filterStatus,
  onReset,
  segmentName,
  onClearSegment,
}: {
  filterStatus: FilterStatus;
  onReset: () => void;
  segmentName?: string | null;
  onClearSegment?: () => void;
}) {
  if (segmentName && onClearSegment) {
    return (
      <div className="border border-border rounded-lg p-12 text-center">
        <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">No pages tailored for {segmentName} yet</h3>
        <p className="text-xs text-muted-foreground mb-4">Clear the segment filter to see all pages, or create a new one.</p>
        <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={onClearSegment}>
          Clear segment filter
        </Button>
      </div>
    );
  }
  return (
    <div className="border border-border rounded-lg p-12 text-center">
      <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-foreground mb-1">No {filterStatus === "All" ? "pages" : filterStatus === "Mine" ? "pages by you yet" : filterStatus.toLowerCase() + " pages"}</h3>
      <p className="text-xs text-muted-foreground mb-4">Try a different filter or create a new page.</p>
      <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={onReset}>
        View all pages
      </Button>
    </div>
  );
}
