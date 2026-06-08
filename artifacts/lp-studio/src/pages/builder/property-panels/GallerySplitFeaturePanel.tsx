import type { GallerySplitFeatureBlockProps, GalleryImage } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: GallerySplitFeatureBlockProps;
  onChange: (next: GallerySplitFeatureBlockProps) => void;
}

export function GallerySplitFeaturePanel({ props, onChange }: Props) {
  const update = (patch: Partial<GallerySplitFeatureBlockProps>) => onChange({ ...props, ...patch });
  const images = props.images ?? [];
  const updateImage = (i: number, patch: Partial<GalleryImage>) =>
    update({ images: images.map((img, idx) => (idx === i ? { ...img, ...patch } : img)) });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="gallery-split-feature"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("gallery-split-feature", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("gallery-split-feature", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("gallery-split-feature", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Images</div>
        <div className="border rounded-md p-3 space-y-2">
          <span className="text-xs font-medium">Hero image</span>
          <ImagePicker value={props.imageUrl} onChange={(src) => update({ imageUrl: src })} label="Hero image" aiHint={props.headline || "Lifestyle photo"} />
        </div>
        {images.map((img, i) => (
          <div key={img.id} className="border rounded-md p-3 space-y-2">
            <span className="text-xs font-medium">Grid image {i + 1}</span>
            <ImagePicker value={img.src} onChange={(src) => updateImage(i, { src })} label="Image" aiHint={img.caption || "Lifestyle photo"} />
            <Input value={img.alt ?? ""} onChange={(e) => updateImage(i, { alt: e.target.value })} placeholder="Alt text (optional)" className="h-8 text-xs" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Primary button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("gallery-split-feature", "ctaLabel", props.ctaLabel ?? "", { headline: props.headline ?? "" })} fieldLabel="Primary button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Primary button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Secondary button label</Label>
          <AiTextField type="input" value={props.ctaSecondaryLabel ?? ""} onChange={(v) => update({ ctaSecondaryLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("gallery-split-feature", "ctaSecondaryLabel", props.ctaSecondaryLabel ?? "", { headline: props.headline ?? "" })} fieldLabel="Secondary button label" />
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
