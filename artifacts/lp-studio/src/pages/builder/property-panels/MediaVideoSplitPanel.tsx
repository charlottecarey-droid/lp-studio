import type { MediaVideoSplitBlockProps } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { VideoPicker } from "@/components/VideoPicker";
import { ImagePicker } from "@/components/ImagePicker";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: MediaVideoSplitBlockProps;
  onChange: (next: MediaVideoSplitBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function MediaVideoSplitPanel({ props, onChange, brandVoiceSet }: Props) {
  const update = (patch: Partial<MediaVideoSplitBlockProps>) => onChange({ ...props, ...patch });
  const features = props.features ?? [];
  const updateFeature = (i: number, value: string) =>
    update({ features: features.map((f, idx) => (idx === i ? value : f)) });
  const removeFeature = (i: number) => update({ features: features.filter((_, idx) => idx !== i) });
  const moveFeature = (i: number, dir: -1 | 1) => update({ features: moveArr(features, i, i + dir) });
  const addFeature = () => update({ features: [...features, "New feature"] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="media-video-split"
          fields={["eyebrow", "heading", "description"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", description: props.description ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-video-split", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-video-split", "heading", props.heading ?? "", {})} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Description</Label>
          <AiTextField value={props.description ?? ""} onChange={(v) => update({ description: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-video-split", "description", props.description ?? "", { heading: props.heading ?? "" })} fieldLabel="Description" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video</div>
        <VideoPicker
          label="Video"
          value={props.videoUrl}
          onChange={(url) => update({ videoUrl: url })}
        />
        <p className="text-[11px] text-muted-foreground">Plays in a lightbox when the poster is clicked. Upload, pick from library, or paste a URL.</p>
        <div>
          <Label className="text-[11px] text-muted-foreground">Poster / Preview Image</Label>
          <ImagePicker
            value={props.posterUrl ?? ""}
            onChange={(url) => update({ posterUrl: url })}
            label="Poster"
            placeholder="https://… or /images/poster.jpg"
            aiHint={props.heading || "Product demo still"}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Shown before the video plays.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features</Label>
          <Button size="sm" variant="outline" onClick={addFeature}><Plus className="h-3 w-3 mr-1" />Feature</Button>
        </div>
        {features.map((feat, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Feature {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveFeature(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === features.length - 1} onClick={() => moveFeature(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeFeature(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <AiTextField type="input" value={feat} onChange={(v) => updateFeature(i, v)} className="h-8 text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-video-split", "feature", feat, { heading: props.heading ?? "" })} fieldLabel="Feature" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Primary button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-video-split", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Primary button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Primary button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Secondary button label</Label>
          <AiTextField type="input" value={props.ctaSecondaryLabel ?? ""} onChange={(v) => update({ ctaSecondaryLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-video-split", "ctaSecondaryLabel", props.ctaSecondaryLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Secondary button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Secondary button URL</Label>
          <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Video side (desktop)</Label>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {(["left", "right"] as const).map((side) => (
              <Button
                key={side}
                size="sm"
                variant={(props.mediaSide ?? "right") === side ? "default" : "outline"}
                className="h-8 text-xs capitalize"
                onClick={() => update({ mediaSide: side })}
              >
                {side}
              </Button>
            ))}
          </div>
        </div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
