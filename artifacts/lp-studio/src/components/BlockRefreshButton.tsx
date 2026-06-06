import { useState } from "react";
import { RefreshCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshBlockCopy, refreshBlockStats, type StatItem } from "@/lib/copy-api";

interface BlockRefreshButtonProps {
  blockType: string;
  fields: string[];
  values: Record<string, string>;
  onApply: (updated: Record<string, string>) => void;
  label?: string;
}

export function BlockRefreshButton({
  blockType,
  fields,
  values,
  onApply,
  label = "Refresh copy",
}: BlockRefreshButtonProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await refreshBlockCopy(blockType, fields, values);
      onApply(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex justify-end -mt-1 mb-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5 text-emerald-700 hover:text-emerald-800"
        disabled={busy}
        onClick={run}
        title={err ?? "Regenerate all text fields in this block using your brand voice and active page brief"}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
        {label}
      </Button>
    </div>
  );
}

interface StatsRefreshButtonProps {
  blockType: string;
  items: StatItem[];
  onApply: (items: StatItem[]) => void;
  label?: string;
}

/** Block-level "Refresh stats" affordance for array-shaped stat blocks
 *  (Trust Bar, ID Stats, …). Sends the current items to the copy-refresh
 *  endpoint and applies the regenerated array. Honors strict-facts mode
 *  server-side: unapproved numbers fall back to the existing value. */
export function StatsRefreshButton({
  blockType,
  items,
  onApply,
  label = "Refresh copy",
}: StatsRefreshButtonProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const next = await refreshBlockStats(blockType, items);
      onApply(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex justify-end -mt-1 mb-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5 text-emerald-700 hover:text-emerald-800"
        disabled={busy}
        onClick={run}
        title={err ?? "Regenerate every stat in this block using your brand voice and active page brief"}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
        {label}
      </Button>
    </div>
  );
}
