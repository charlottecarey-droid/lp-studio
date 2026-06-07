import type { PasSplitImageBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: PasSplitImageBlockProps;
  onChange: (next: PasSplitImageBlockProps) => void;
}

export function PasSplitImagePanel({ props, onChange }: Props) {
  const update = (patch: Partial<PasSplitImageBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Problem</div>
        <BlockRefreshButton
          blockType="pas-split-image"
          fields={["eyebrow", "problemHeading", "problemBody", "agitateBody", "solutionHeading", "solutionBody"]}
          values={{ eyebrow: props.eyebrow ?? "", problemHeading: props.problemHeading ?? "", problemBody: props.problemBody ?? "", agitateBody: props.agitateBody ?? "", solutionHeading: props.solutionHeading ?? "", solutionBody: props.solutionBody ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-split-image", "eyebrow", props.eyebrow ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Problem heading</Label>
          <AiTextField value={props.problemHeading} onChange={(v) => update({ problemHeading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("pas-split-image", "problemHeading", props.problemHeading ?? "", { problemBody: props.problemBody ?? "" })} fieldLabel="Problem heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Problem body</Label>
          <AiTextField value={props.problemBody ?? ""} onChange={(v) => update({ problemBody: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-split-image", "problemBody", props.problemBody ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Problem body" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Agitate body</Label>
          <AiTextField value={props.agitateBody ?? ""} onChange={(v) => update({ agitateBody: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-split-image", "agitateBody", props.agitateBody ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Agitate body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</div>
        <ImagePicker label="Image" value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} aiHint="problem/solution feature image" />
        <div>
          <Label className="text-[11px] text-muted-foreground">Image alt</Label>
          <Input value={props.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image side</Label>
          <Select value={props.mediaSide ?? "right"} onValueChange={(v) => update({ mediaSide: v as "left" | "right" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left" className="text-xs">Left</SelectItem>
              <SelectItem value="right" className="text-xs">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solution</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Solution heading</Label>
          <AiTextField type="input" value={props.solutionHeading ?? ""} onChange={(v) => update({ solutionHeading: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-split-image", "solutionHeading", props.solutionHeading ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Solution heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Solution body</Label>
          <AiTextField value={props.solutionBody ?? ""} onChange={(v) => update({ solutionBody: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-split-image", "solutionBody", props.solutionBody ?? "", { solutionHeading: props.solutionHeading ?? "" })} fieldLabel="Solution body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-split-image", "ctaLabel", props.ctaLabel ?? "", { solutionHeading: props.solutionHeading ?? "" })} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
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
