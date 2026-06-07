import type { SplitMediaRowBlockProps } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  props: SplitMediaRowBlockProps;
  onChange: (next: SplitMediaRowBlockProps) => void;
}

export function SplitMediaRowPanel({ props, onChange }: Props) {
  const update = (patch: Partial<SplitMediaRowBlockProps>) => onChange({ ...props, ...patch });
  const bullets = props.bullets ?? [];
  const updateBullet = (i: number, v: string) => update({ bullets: bullets.map((b, idx) => (idx === i ? v : b)) });
  const removeBullet = (i: number) => update({ bullets: bullets.filter((_, idx) => idx !== i) });
  const addBullet = () => update({ bullets: [...bullets, "New point"] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="split-media-row"
          fields={["eyebrow", "heading", "body", "ctaLabel"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", body: props.body ?? "", ctaLabel: props.ctaLabel ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("split-media-row", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("split-media-row", "heading", props.heading ?? "", { eyebrow: props.eyebrow ?? "", body: props.body ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Body</Label>
          <AiTextField value={props.body ?? ""} onChange={(v) => update({ body: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("split-media-row", "body", props.body ?? "", { heading: props.heading ?? "" })} fieldLabel="Body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bullets</div>
        {bullets.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input value={b} onChange={(e) => updateBullet(i, e.target.value)} className="h-8 text-xs" />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeBullet(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addBullet}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add bullet
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</div>
        <ImagePicker label="Image" value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} aiHint="section supporting image" />
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
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("split-media-row", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
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
