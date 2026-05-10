import type { ParallaxImageHeroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { Switch } from "@/components/ui/switch";

interface Props {
  props: ParallaxImageHeroBlockProps;
  onChange: (props: ParallaxImageHeroBlockProps) => void;
}

export function ParallaxImageHeroPanel({ props, onChange }: Props) {
  const u = (patch: Partial<ParallaxImageHeroBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background image (also used as video poster)</div>
        <ImagePicker value={props.imageUrl} onChange={(url) => u({ imageUrl: url })} />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background video (optional)</div>
        <VideoPicker value={props.videoUrl ?? ""} onChange={(v) => u({ videoUrl: v || undefined })} />
        <p className="text-[10px] text-muted-foreground">When set, replaces the static image with a looping background video. The image above is used as the poster / reduced-motion fallback.</p>
        {props.videoUrl && (
          <div className="flex items-center justify-between pt-1">
            <Label className="text-[11px] text-muted-foreground">Autoplay video</Label>
            <Switch checked={props.videoAutoplay !== false} onCheckedChange={(v) => u({ videoAutoplay: v })} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top corners</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow (top-left)</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" placeholder="● LIVE AT DYKEMA 2026" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Reference label (top-right)</Label>
          <Input value={props.referenceLabel ?? ""} onChange={(e) => u({ referenceLabel: e.target.value })} className="h-8 text-xs" placeholder="FE-02" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Input value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs" placeholder="The first and only AI dental lab." />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Accent word (italic + colored)</Label>
          <Input value={props.headlineAccentWord ?? ""} onChange={(e) => u({ headlineAccentWord: e.target.value })} className="h-8 text-xs" placeholder="AI" />
          <div className="text-[10px] text-muted-foreground mt-1">Must appear exactly inside the headline.</div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Accent color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={props.accentColor ?? "#C7E738"}
              onChange={(e) => u({ accentColor: e.target.value })}
              className="h-8 w-10 p-0 border rounded cursor-pointer"
            />
            <Input value={props.accentColor ?? ""} onChange={(e) => u({ accentColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="#C7E738" />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Text color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={props.textColor ?? "#FFFFFF"}
              onChange={(e) => u({ textColor: e.target.value })}
              className="h-8 w-10 p-0 border rounded cursor-pointer"
            />
            <Input value={props.textColor ?? ""} onChange={(e) => u({ textColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="#FFFFFF" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bottom row</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA text (bottom-left)</Label>
          <Input value={props.ctaText ?? ""} onChange={(e) => u({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Take a tour" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => u({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Brand mark text (bottom-right)</Label>
          <Input value={props.brandMark ?? ""} onChange={(e) => u({ brandMark: e.target.value })} className="h-8 text-xs" placeholder="dandy" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Brand mark logo (overrides text)</Label>
          <ImagePicker value={props.brandMarkLogoUrl ?? ""} onChange={(url) => u({ brandMarkLogoUrl: url })} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Effects</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Parallax strength: {Math.round((props.parallaxStrength ?? 0.35) * 100)}%
          </Label>
          <Slider
            min={0}
            max={80}
            step={5}
            value={[Math.round((props.parallaxStrength ?? 0.35) * 100)]}
            onValueChange={([v]) => u({ parallaxStrength: v / 100 })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Overlay opacity: {props.overlayOpacity ?? 35}%
          </Label>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[props.overlayOpacity ?? 35]}
            onValueChange={([v]) => u({ overlayOpacity: v })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Overlay color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={props.overlayColor ?? "#000000"}
              onChange={(e) => u({ overlayColor: e.target.value })}
              className="h-8 w-10 p-0 border rounded cursor-pointer"
            />
            <Input value={props.overlayColor ?? ""} onChange={(e) => u({ overlayColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="#000000" />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Section height</Label>
          <Select value={props.minHeight ?? "full"} onValueChange={(v) => u({ minHeight: v as "full" | "large" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full viewport (100vh)</SelectItem>
              <SelectItem value="large">Large (85vh)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
