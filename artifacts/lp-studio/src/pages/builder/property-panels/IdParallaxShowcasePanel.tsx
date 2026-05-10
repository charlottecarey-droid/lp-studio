import type { IdParallaxShowcaseBlockProps, IdShowcaseFrame } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: IdParallaxShowcaseBlockProps;
  onChange: (props: IdParallaxShowcaseBlockProps) => void;
}

export function IdParallaxShowcasePanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdParallaxShowcaseBlockProps>) => onChange({ ...props, ...patch });
  const frames = props.frames ?? [];
  const update = (i: number, patch: Partial<IdShowcaseFrame>) =>
    u({ frames: frames.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heading</div>
        <Input placeholder="Eyebrow" value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Headline (use <em>)" value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs font-mono" />
        <Textarea placeholder="Blurb" value={props.blurb ?? ""} onChange={(e) => u({ blurb: e.target.value })} rows={2} className="text-xs" />
      </div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frames (3 max)</div>
      {frames.map((fr, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Frame {i + 1}</div>
            <Button size="sm" variant="ghost" onClick={() => u({ frames: frames.filter((_, idx) => idx !== i) })}><X className="w-3 h-3" /></Button>
          </div>
          <ImagePicker label="Image" value={fr.imageUrl ?? ""} onChange={(v) => update(i, { imageUrl: v })} />
          <div>
            <Label className="text-[11px] text-muted-foreground">Label</Label>
            <Input value={fr.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Headline (use &lt;em&gt;)</Label>
            <Input value={fr.headline ?? ""} onChange={(e) => update(i, { headline: e.target.value })} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Where</Label>
            <Input value={fr.where ?? ""} onChange={(e) => update(i, { where: e.target.value })} className="h-8 text-xs" />
          </div>
        </div>
      ))}
      {frames.length < 3 && (
        <Button size="sm" variant="outline" onClick={() => u({ frames: [...frames, { imageUrl: "", label: "", headline: "", where: "" }] })}>
          Add frame
        </Button>
      )}
    </div>
  );
}
