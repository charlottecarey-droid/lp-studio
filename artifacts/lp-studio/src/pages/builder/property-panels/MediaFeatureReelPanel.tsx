import type { MediaFeatureReelBlockProps, MediaFeatureReelFeature } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
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
  props: MediaFeatureReelBlockProps;
  onChange: (next: MediaFeatureReelBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function MediaFeatureReelPanel({ props, onChange, brandVoiceSet }: Props) {
  const update = (patch: Partial<MediaFeatureReelBlockProps>) => onChange({ ...props, ...patch });
  const features = props.features ?? [];
  const updateFeature = (i: number, patch: Partial<MediaFeatureReelFeature>) =>
    update({ features: features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const removeFeature = (i: number) => update({ features: features.filter((_, idx) => idx !== i) });
  const moveFeature = (i: number, dir: -1 | 1) => update({ features: moveArr(features, i, i + dir) });
  const addFeature = () =>
    update({ features: [...features, { icon: "Sparkles", title: "New feature", desc: "Short description." }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="media-feature-reel"
          fields={["heading"]}
          values={{ heading: props.heading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-feature-reel", "heading", props.heading ?? "", {})} fieldLabel="Heading" />
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
            aiHint={props.heading || "Product showcase still"}
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
            <IconPicker label="Icon" value={feat.icon} onChange={(v) => updateFeature(i, { icon: v })} aiHint="Feature icon" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <AiTextField type="input" value={feat.title} onChange={(v) => updateFeature(i, { title: v })} className="h-8 text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-feature-reel", "title", feat.title, { heading: props.heading ?? "" })} fieldLabel="Feature title" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <AiTextField value={feat.desc} onChange={(v) => updateFeature(i, { desc: v })} rows={2} className="text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-feature-reel", "desc", feat.desc, { title: feat.title })} fieldLabel="Feature description" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Primary button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-feature-reel", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Primary button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Primary button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Secondary button label</Label>
          <AiTextField type="input" value={props.ctaSecondaryLabel ?? ""} onChange={(v) => update({ ctaSecondaryLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-feature-reel", "ctaSecondaryLabel", props.ctaSecondaryLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Secondary button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Secondary button URL</Label>
          <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
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
