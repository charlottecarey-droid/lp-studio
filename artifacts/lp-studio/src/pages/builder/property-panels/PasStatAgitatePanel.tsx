import type { PasStatAgitateBlockProps, PasAgitateStat } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: PasStatAgitateBlockProps;
  onChange: (next: PasStatAgitateBlockProps) => void;
}

export function PasStatAgitatePanel({ props, onChange }: Props) {
  const update = (patch: Partial<PasStatAgitateBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const updateStat = (i: number, patch: Partial<PasAgitateStat>) =>
    update({ stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const removeStat = (i: number) => update({ stats: stats.filter((_, idx) => idx !== i) });
  const addStat = () => update({ stats: [...stats, { value: "73%", label: "of practices struggle" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Problem</div>
        <BlockRefreshButton
          blockType="pas-stat-agitate"
          fields={["eyebrow", "problemHeading", "problemBody", "solutionHeading", "solutionBody"]}
          values={{ eyebrow: props.eyebrow ?? "", problemHeading: props.problemHeading ?? "", problemBody: props.problemBody ?? "", solutionHeading: props.solutionHeading ?? "", solutionBody: props.solutionBody ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-stat-agitate", "eyebrow", props.eyebrow ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Problem heading</Label>
          <AiTextField value={props.problemHeading} onChange={(v) => update({ problemHeading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("pas-stat-agitate", "problemHeading", props.problemHeading ?? "", { problemBody: props.problemBody ?? "" })} fieldLabel="Problem heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Problem body</Label>
          <AiTextField value={props.problemBody ?? ""} onChange={(v) => update({ problemBody: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-stat-agitate", "problemBody", props.problemBody ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Problem body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agitating stats</div>
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input value={s.value} onChange={(e) => updateStat(i, { value: e.target.value })} placeholder="73%" className="h-8 text-xs w-24 shrink-0 font-semibold" />
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
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solution</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Solution heading</Label>
          <AiTextField type="input" value={props.solutionHeading ?? ""} onChange={(v) => update({ solutionHeading: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-stat-agitate", "solutionHeading", props.solutionHeading ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Solution heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Solution body</Label>
          <AiTextField value={props.solutionBody ?? ""} onChange={(v) => update({ solutionBody: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-stat-agitate", "solutionBody", props.solutionBody ?? "", { solutionHeading: props.solutionHeading ?? "" })} fieldLabel="Solution body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-stat-agitate", "ctaLabel", props.ctaLabel ?? "", { solutionHeading: props.solutionHeading ?? "" })} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#0F172A"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#FFFFFF"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
