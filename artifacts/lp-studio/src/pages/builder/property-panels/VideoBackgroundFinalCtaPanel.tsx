import type { VideoBackgroundFinalCtaBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: VideoBackgroundFinalCtaBlockProps;
  onChange: (next: VideoBackgroundFinalCtaBlockProps) => void;
}

export function VideoBackgroundFinalCtaPanel({ props, onChange }: Props) {
  const update = (patch: Partial<VideoBackgroundFinalCtaBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="video-background-final-cta"
          fields={["eyebrow", "heading", "subheading", "ctaLabel"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", subheading: props.subheading ?? "", ctaLabel: props.ctaLabel ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("video-background-final-cta", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("video-background-final-cta", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("video-background-final-cta", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background video</div>
        <VideoPicker label="Background video" value={props.backgroundVideoUrl ?? ""} onChange={(v) => update({ backgroundVideoUrl: v })} />
        <ImagePicker label="Poster image (fallback)" value={props.posterUrl ?? ""} onChange={(v) => update({ posterUrl: v })} aiHint="video poster frame" />
        <div>
          <Label className="text-[11px] text-muted-foreground">Overlay opacity ({props.overlayOpacity ?? 60}%)</Label>
          <Input type="number" min={0} max={100} value={props.overlayOpacity ?? 60} onChange={(e) => update({ overlayOpacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="h-8 text-xs" />
        </div>
        <ColorField label="Overlay color" value={props.overlayColor ?? "#0F172A"} onChange={(v) => update({ overlayColor: v || undefined })} />
        <div>
          <Label className="text-[11px] text-muted-foreground">Overlay gradient</Label>
          <Select value={props.overlayGradient ?? "none"} onValueChange={(v) => update({ overlayGradient: v as VideoBackgroundFinalCtaBlockProps["overlayGradient"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">No gradient (flat tint)</SelectItem>
              <SelectItem value="top" className="text-xs">Darken top</SelectItem>
              <SelectItem value="bottom" className="text-xs">Darken bottom</SelectItem>
              <SelectItem value="both" className="text-xs">Darken both edges</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">Fades the overlay as a gradient instead of a flat wash.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("video-background-final-cta", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Button color" value={props.ctaButtonColor ?? props.accentColor ?? "#4f46e5"} onChange={(v) => update({ ctaButtonColor: v || undefined })} />
          <ColorField label="Button text (auto)" value={props.ctaButtonTextColor} onChange={(v) => update({ ctaButtonTextColor: v || undefined })} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#0F172A"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#FFFFFF"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edge fade (blend into adjacent sections)</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Fade direction</Label>
          <Select value={props.edgeFade ?? "none"} onValueChange={(v) => update({ edgeFade: v as VideoBackgroundFinalCtaBlockProps["edgeFade"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">No fade</SelectItem>
              <SelectItem value="top" className="text-xs">Fade in from top</SelectItem>
              <SelectItem value="bottom" className="text-xs">Fade out at bottom</SelectItem>
              <SelectItem value="both" className="text-xs">Fade both edges</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(props.edgeFade ?? "none") !== "none" && (
          <>
            <ColorField label="Fade color (match adjacent section)" value={props.edgeFadeColor ?? "#0a0a0a"} onChange={(v) => update({ edgeFadeColor: v || undefined })} />
            <div>
              <Label className="text-[11px] text-muted-foreground">Fade size: {props.edgeFadeSize ?? 25}% of section</Label>
              <Slider min={0} max={60} step={5} value={[props.edgeFadeSize ?? 25]} onValueChange={([v]) => update({ edgeFadeSize: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
