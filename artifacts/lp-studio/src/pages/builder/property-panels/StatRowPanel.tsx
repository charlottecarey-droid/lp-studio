import type { StatRowBlockProps, StatRowItem } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";

interface Props {
  props: StatRowBlockProps;
  onChange: (next: StatRowBlockProps) => void;
}

export function StatRowPanel({ props, onChange }: Props) {
  const update = (patch: Partial<StatRowBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const updateStat = (i: number, patch: Partial<StatRowItem>) =>
    update({ stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const removeStat = (i: number) => update({ stats: stats.filter((_, idx) => idx !== i) });
  const addStat = () => update({ stats: [...stats, { value: "100+", label: "New stat" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Header</div>
        <BlockRefreshButton
          blockType="stat-row"
          fields={["eyebrow", "heading"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("stat-row", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField type="input" value={props.heading ?? ""} onChange={(v) => update({ heading: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("stat-row", "heading", props.heading ?? "", { eyebrow: props.eyebrow ?? "" })} fieldLabel="Heading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</div>
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input value={s.value} onChange={(e) => updateStat(i, { value: e.target.value })} placeholder="10k+" className="h-8 text-xs w-24 shrink-0 font-semibold" />
            <Input value={s.label} onChange={(e) => updateStat(i, { label: e.target.value })} placeholder="Label" className="h-8 text-xs" />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeStat(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addStat}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add stat
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
