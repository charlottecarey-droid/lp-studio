import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { BeforeAfterGalleryBlockProps, BeforeAfterPair } from "@/lib/block-types";
import { ImagePicker } from "@/components/ImagePicker";
import { ColorField } from "./BlockSettingsPanel";

interface Props {
  props: BeforeAfterGalleryBlockProps;
  onChange: (next: BeforeAfterGalleryBlockProps) => void;
}

export function BeforeAfterGalleryPanel({ props, onChange }: Props) {
  const update = (patch: Partial<BeforeAfterGalleryBlockProps>) => onChange({ ...props, ...patch });
  const updatePair = (i: number, patch: Partial<BeforeAfterPair>) => {
    update({ pairs: props.pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  };
  const removePair = (i: number) => update({ pairs: props.pairs.filter((_, idx) => idx !== i) });
  const addPair = () => update({
    pairs: [...props.pairs, { beforeSrc: "", beforeAlt: "Before", afterSrc: "", afterAlt: "After" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Eyebrow</Label>
        <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Headline</Label>
        <Input value={props.headline} onChange={(e) => update({ headline: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Subheadline</Label>
        <Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Before label</Label>
          <Input value={props.beforeLabel ?? "Before"} onChange={(e) => update({ beforeLabel: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">After label</Label>
          <Input value={props.afterLabel ?? "After"} onChange={(e) => update({ afterLabel: e.target.value })} />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Pairs</Label>
          <Button size="sm" variant="outline" onClick={addPair}><Plus className="h-3 w-3 mr-1" />Pair</Button>
        </div>
        {props.pairs.map((pair, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Pair {i + 1}</span>
              <Button size="icon" variant="ghost" onClick={() => removePair(i)}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <div>
              <Label className="text-xs">Before image</Label>
              <ImagePicker value={pair.beforeSrc} onChange={(src) => updatePair(i, { beforeSrc: src })} />
              <Input value={pair.beforeAlt} onChange={(e) => updatePair(i, { beforeAlt: e.target.value })} placeholder="Alt text" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">After image</Label>
              <ImagePicker value={pair.afterSrc} onChange={(src) => updatePair(i, { afterSrc: src })} />
              <Input value={pair.afterAlt} onChange={(e) => updatePair(i, { afterAlt: e.target.value })} placeholder="Alt text" className="mt-1" />
            </div>
            <Input value={pair.caption ?? ""} onChange={(e) => updatePair(i, { caption: e.target.value })} placeholder="Caption (optional)" />
          </div>
        ))}
      </div>

      <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
      <ColorField label="Text" value={props.textColor ?? "#0B0B0C"} onChange={(v) => update({ textColor: v })} />
      <ColorField label="Accent" value={props.accentColor ?? "#0B6B3A"} onChange={(v) => update({ accentColor: v })} />
    </div>
  );
}
