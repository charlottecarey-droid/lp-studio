import type { GalleryMasonryBlockProps, GalleryImage } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { ImagePicker } from "@/components/ImagePicker";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: GalleryMasonryBlockProps;
  onChange: (next: GalleryMasonryBlockProps) => void;
}

export function GalleryMasonryPanel({ props, onChange }: Props) {
  const update = (patch: Partial<GalleryMasonryBlockProps>) => onChange({ ...props, ...patch });
  const images = props.images ?? [];
  const updateImage = (i: number, patch: Partial<GalleryImage>) =>
    update({ images: images.map((img, idx) => (idx === i ? { ...img, ...patch } : img)) });
  const removeImage = (i: number) => update({ images: images.filter((_, idx) => idx !== i) });
  const moveImage = (i: number, dir: -1 | 1) => update({ images: moveArr(images, i, i + dir) });
  const addImage = () =>
    update({ images: [...images, { id: `${Date.now()}`, src: "", caption: "New image", alt: "", aspect: "aspect-[4/3]" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="gallery-masonry"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("gallery-masonry", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("gallery-masonry", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("gallery-masonry", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Images</Label>
          <Button size="sm" variant="outline" onClick={addImage}><Plus className="h-3 w-3 mr-1" />Image</Button>
        </div>
        {images.map((img, i) => (
          <div key={img.id} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Image {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveImage(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === images.length - 1} onClick={() => moveImage(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeImage(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <ImagePicker value={img.src} onChange={(src) => updateImage(i, { src })} label="Image" aiHint={img.caption || "Lifestyle photo"} />
            <Input value={img.caption} onChange={(e) => updateImage(i, { caption: e.target.value })} placeholder="Caption" className="h-8 text-xs" />
            <Input value={img.alt ?? ""} onChange={(e) => updateImage(i, { alt: e.target.value })} placeholder="Alt text (optional)" className="h-8 text-xs" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Aspect ratio (Tailwind class)</Label>
              <Input value={img.aspect ?? ""} onChange={(e) => updateImage(i, { aspect: e.target.value })} placeholder="aspect-[4/3]" className="h-8 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("gallery-masonry", "ctaLabel", props.ctaLabel ?? "", { headline: props.headline ?? "" })} fieldLabel="Button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
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
