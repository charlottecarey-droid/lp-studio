import type { BenefitsStatLedBlockProps, BenefitsStatLedItem } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { BenefitsCtaSection } from "./BenefitsAlternatingRowsPanel";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: BenefitsStatLedBlockProps;
  onChange: (next: BenefitsStatLedBlockProps) => void;
}

export function BenefitsStatLedPanel({ props, onChange }: Props) {
  const update = (patch: Partial<BenefitsStatLedBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const updateStat = (i: number, patch: Partial<BenefitsStatLedItem>) =>
    update({ stats: stats.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const removeStat = (i: number) => update({ stats: stats.filter((_, idx) => idx !== i) });
  const moveStat = (i: number, dir: -1 | 1) => update({ stats: moveArr(stats, i, i + dir) });
  const addStat = () => update({ stats: [...stats, { stat: "2x", title: "New stat", description: "", icon: "TrendingUp" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="benefits-stat-led"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("benefits-stat-led", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("benefits-stat-led", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("benefits-stat-led", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading alignment</Label>
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-md border p-0.5">
            {(["left", "center"] as const).map((align) => {
              const active = (props.headingAlign ?? "left") === align;
              return (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ headingAlign: align })}
                  className={`rounded px-2 py-1 text-xs capitalize transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {align}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</div>
          <Button size="sm" variant="outline" onClick={addStat}><Plus className="h-3 w-3 mr-1" />Stat</Button>
        </div>
        {stats.map((s, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Stat {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveStat(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === stats.length - 1} onClick={() => moveStat(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeStat(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Stat value</Label>
                <Input value={s.stat} onChange={(e) => updateStat(i, { stat: e.target.value })} placeholder="3.5x" className="h-8 text-xs" />
              </div>
              <IconPicker label="Icon" value={s.icon} onChange={(v) => updateStat(i, { icon: v })} aiHint="Stat icon" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input value={s.title} onChange={(e) => updateStat(i, { title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <Input value={s.description} onChange={(e) => updateStat(i, { description: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="benefits-stat-led" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#171717"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
