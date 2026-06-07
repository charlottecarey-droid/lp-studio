import type { MediaLoopingShowcaseBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { VideoPicker } from "@/components/VideoPicker";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: MediaLoopingShowcaseBlockProps;
  onChange: (next: MediaLoopingShowcaseBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function MediaLoopingShowcasePanel({ props, onChange, brandVoiceSet }: Props) {
  const update = (patch: Partial<MediaLoopingShowcaseBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="media-looping-showcase"
          fields={["heading", "subheading"]}
          values={{ heading: props.heading ?? "", subheading: props.subheading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-looping-showcase", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-looping-showcase", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video</div>
        <VideoPicker
          label="Background Video"
          value={props.videoUrl}
          onChange={(url) => update({ videoUrl: url })}
        />
        <p className="text-[11px] text-muted-foreground">Autoplays muted and looping behind the copy; the play button opens it in a lightbox. Upload, pick from library, or paste a URL.</p>
        <div>
          <Label className="text-[11px] text-muted-foreground">Poster / Fallback Image</Label>
          <ImagePicker
            value={props.posterUrl ?? ""}
            onChange={(url) => update({ posterUrl: url })}
            label="Poster"
            placeholder="https://… or /images/poster.jpg"
            aiHint={props.heading || "Cinematic background still"}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Shown before the video loads, or when no video is set.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-looping-showcase", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#000000"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#FFFFFF"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
          <ColorField label="Muted text" value={props.mutedColor ?? "#94A3B8"} onChange={(v) => update({ mutedColor: v })} />
        </div>
      </div>
    </div>
  );
}
