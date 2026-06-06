import type { IdStatsBlockProps, IdStatItem } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StatsRefreshButton } from "@/components/BlockRefreshButton";
import { Plus, X } from "lucide-react";

interface Props {
  props: IdStatsBlockProps;
  onChange: (props: IdStatsBlockProps) => void;
}

export function IdStatsPanel({ props, onChange }: Props) {
  const stats = props.stats ?? [];
  const setStats = (next: IdStatItem[]) => onChange({ ...props, stats: next });
  const update = (i: number, patch: Partial<IdStatItem>) =>
    setStats(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats (4 max)</div>
      {stats.length > 0 && (
        <StatsRefreshButton
          blockType="id-stats"
          items={stats.map((s) => ({ value: s.value ?? "", label: s.label ?? "", description: s.description ?? "" }))}
          onApply={(next) => setStats(stats.map((s, idx) => next[idx]
            ? { ...s, value: next[idx].value, label: next[idx].label, description: next[idx].description ?? s.description ?? "" }
            : s))}
        />
      )}
      {stats.map((s, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stat {i + 1}</div>
            <Button size="sm" variant="ghost" onClick={() => setStats(stats.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Value (use &lt;em&gt; for accent number)</Label>
            <Input value={s.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} className="h-8 text-xs font-mono" placeholder="<em>4,000</em>+" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Label</Label>
            <Input value={s.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Description</Label>
            <Textarea value={s.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} rows={2} className="text-xs" />
          </div>
        </div>
      ))}
      {stats.length < 4 && (
        <Button size="sm" variant="outline" onClick={() => setStats([...stats, { value: "", label: "", description: "" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add stat
        </Button>
      )}
    </div>
  );
}
