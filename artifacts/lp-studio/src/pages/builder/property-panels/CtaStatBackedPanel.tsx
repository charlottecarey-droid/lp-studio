import type { CtaStatBackedBlockProps } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: CtaStatBackedBlockProps;
  onChange: (next: CtaStatBackedBlockProps) => void;
}

export function CtaStatBackedPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CtaStatBackedBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];

  const updateStat = (i: number, key: "value" | "label", value: string) =>
    update({ stats: stats.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) });
  const removeStat = (i: number) => update({ stats: stats.filter((_, idx) => idx !== i) });
  const moveStat = (i: number, dir: -1 | 1) => update({ stats: moveArr(stats, i, i + dir) });
  const addStat = () => update({ stats: [...stats, { value: "100%", label: "New stat" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="cta-stat-backed"
          fields={["heading", "subheading", "ctaPrimaryLabel", "ctaSecondaryLabel"]}
          values={{
            heading: props.heading ?? "",
            subheading: props.subheading ?? "",
            ctaPrimaryLabel: props.ctaPrimaryLabel ?? "",
            ctaSecondaryLabel: props.ctaSecondaryLabel ?? "",
          }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("cta-stat-backed", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("cta-stat-backed", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</Label>
          <Button size="sm" variant="outline" onClick={addStat}><Plus className="h-3 w-3 mr-1" />Stat</Button>
        </div>
        {stats.map((stat, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Stat {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveStat(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === stats.length - 1} onClick={() => moveStat(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeStat(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Value</Label>
              <Input value={stat.value} onChange={(e) => updateStat(i, "value", e.target.value)} className="h-8 text-xs" placeholder="99.99%" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Label</Label>
              <Input value={stat.label} onChange={(e) => updateStat(i, "label", e.target.value)} className="h-8 text-xs" placeholder="Uptime SLA" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buttons</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary label</Label>
            <Input value={props.ctaPrimaryLabel ?? ""} onChange={(e) => update({ ctaPrimaryLabel: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary URL</Label>
            <Input value={props.ctaPrimaryUrl ?? ""} onChange={(e) => update({ ctaPrimaryUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary label</Label>
            <Input value={props.ctaSecondaryLabel ?? ""} onChange={(e) => update({ ctaSecondaryLabel: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary URL</Label>
            <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Surface" value={props.surfaceColor ?? "#FFFFFF"} onChange={(v) => update({ surfaceColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
