import type { FullBleedSplitBlockProps } from "@/lib/block-types";
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
  props: FullBleedSplitBlockProps;
  onChange: (next: FullBleedSplitBlockProps) => void;
}

export function FullBleedSplitPanel({ props, onChange }: Props) {
  const update = (patch: Partial<FullBleedSplitBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="full-bleed-split"
          fields={["eyebrow", "heading", "body", "ctaLabel"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", body: props.body ?? "", ctaLabel: props.ctaLabel ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("full-bleed-split", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("full-bleed-split", "heading", props.heading ?? "", { eyebrow: props.eyebrow ?? "", body: props.body ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Body</Label>
          <AiTextField value={props.body ?? ""} onChange={(v) => update({ body: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("full-bleed-split", "body", props.body ?? "", { heading: props.heading ?? "" })} fieldLabel="Body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</div>
        <ImagePicker label="Image" value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} aiHint="full-height feature image" />
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
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("full-bleed-split", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Panel background" value={props.panelBgColor ?? "#4f46e5"} onChange={(v) => update({ panelBgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#FFFFFF"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#FFFFFF"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
