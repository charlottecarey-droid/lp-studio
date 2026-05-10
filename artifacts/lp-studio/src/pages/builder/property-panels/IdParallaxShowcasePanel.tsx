import type { IdParallaxShowcaseBlockProps, IdShowcaseFrame } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: IdParallaxShowcaseBlockProps;
  onChange: (props: IdParallaxShowcaseBlockProps) => void;
}

const POSITION_PRESETS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
] as const;

function isPreset(v: string | undefined): v is (typeof POSITION_PRESETS)[number] {
  return !!v && (POSITION_PRESETS as readonly string[]).includes(v);
}

export function IdParallaxShowcasePanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdParallaxShowcaseBlockProps>) => onChange({ ...props, ...patch });
  const frames = props.frames ?? [];
  const update = (i: number, patch: Partial<IdShowcaseFrame>) =>
    u({ frames: frames.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const strength = props.parallaxStrength ?? 0.5;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heading</div>
        <Input placeholder="Eyebrow" value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Headline (use <em>)" value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs font-mono" />
        <Textarea placeholder="Blurb" value={props.blurb ?? ""} onChange={(e) => u({ blurb: e.target.value })} rows={2} className="text-xs" />
      </div>
      <div className="border rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Parallax strength
          </Label>
          <span className="text-[11px] font-mono text-muted-foreground">{Math.round(strength * 100)}%</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[strength]}
          onValueChange={(v) => u({ parallaxStrength: v[0] })}
        />
        <p className="text-[10px] text-muted-foreground leading-snug">
          Controls how much each frame zooms as it scrolls into view.
          0% = no zoom, 100% = strong zoom-out reveal.
        </p>
      </div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frames (3 max)</div>
      {frames.map((fr, i) => {
        const pos = fr.imagePosition ?? "center";
        const usingCustom = !isPreset(pos);
        return (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Frame {i + 1}</div>
              <Button size="sm" variant="ghost" onClick={() => u({ frames: frames.filter((_, idx) => idx !== i) })}><X className="w-3 h-3" /></Button>
            </div>
            <ImagePicker label="Image" value={fr.imageUrl ?? ""} onChange={(v) => update(i, { imageUrl: v })} />
            <div>
              <Label className="text-[11px] text-muted-foreground">Image focus</Label>
              <Select
                value={usingCustom ? "__custom__" : pos}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    update(i, { imagePosition: "50% 50%" });
                  } else {
                    update(i, { imagePosition: v });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSITION_PRESETS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
                  ))}
                  <SelectItem value="__custom__" className="text-xs">Custom…</SelectItem>
                </SelectContent>
              </Select>
              {usingCustom && (
                <Input
                  className="h-8 text-xs mt-1 font-mono"
                  placeholder="e.g. 30% 20%"
                  value={pos}
                  onChange={(e) => update(i, { imagePosition: e.target.value })}
                />
              )}
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                Picks which part of the photo stays in view if the frame
                crops it. Use Custom for fine control (e.g. <code>30% 20%</code>).
              </p>
            </div>
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
        );
      })}
      {frames.length < 3 && (
        <Button size="sm" variant="outline" onClick={() => u({ frames: [...frames, { imageUrl: "", label: "", headline: "", where: "" }] })}>
          Add frame
        </Button>
      )}
    </div>
  );
}
