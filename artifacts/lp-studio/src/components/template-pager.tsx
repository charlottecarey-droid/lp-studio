import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shared pager for the two template libraries (task #1371). Renders Prev/Next
// plus numbered page buttons; the parent only mounts it when totalPages > 1.
export function TemplatePager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const go = (p: number) => onPageChange(Math.min(Math.max(1, p), totalPages));

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-4"
      aria-label="Template pages"
    >
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === page ? "default" : "outline"}
          size="sm"
          className="min-w-9"
          aria-current={p === page ? "page" : undefined}
          onClick={() => go(p)}
        >
          {p}
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
