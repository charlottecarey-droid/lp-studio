import { CheckSquare, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  deleting: boolean;
}

export function BulkActionBar({ count, onClear, onDelete, deleting }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-foreground/5 border border-border rounded-lg">
      <CheckSquare className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-foreground">{count} page{count > 1 ? "s" : ""} selected</span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear selection
        </button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5 text-xs h-7 px-3 rounded-lg"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {deleting ? "Deleting…" : `Delete ${count}`}
        </Button>
      </div>
    </div>
  );
}
