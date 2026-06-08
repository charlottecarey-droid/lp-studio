import type { MediaThumbnailGridBlockProps, MediaThumbnailGridItem } from "@/lib/block-types";
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
  props: MediaThumbnailGridBlockProps;
  onChange: (next: MediaThumbnailGridBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function MediaThumbnailGridPanel({ props, onChange, brandVoiceSet }: Props) {
  const update = (patch: Partial<MediaThumbnailGridBlockProps>) => onChange({ ...props, ...patch });
  const videos = props.videos ?? [];
  const updateVideo = (i: number, patch: Partial<MediaThumbnailGridItem>) =>
    update({ videos: videos.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  const removeVideo = (i: number) => update({ videos: videos.filter((_, idx) => idx !== i) });
  const moveVideo = (i: number, dir: -1 | 1) => update({ videos: moveArr(videos, i, i + dir) });
  const addVideo = () =>
    update({
      videos: [
        ...videos,
        { id: `${Date.now()}`, videoUrl: "", posterUrl: "", title: "New video", duration: "0:00" },
      ],
    });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="media-thumbnail-grid"
          fields={["eyebrow", "heading", "subheading"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", subheading: props.subheading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-thumbnail-grid", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-thumbnail-grid", "heading", props.heading ?? "", {})} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-thumbnail-grid", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Videos</Label>
          <Button size="sm" variant="outline" onClick={addVideo}><Plus className="h-3 w-3 mr-1" />Video</Button>
        </div>
        {videos.map((vid, i) => (
          <div key={vid.id ?? i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Video {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveVideo(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === videos.length - 1} onClick={() => moveVideo(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeVideo(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <VideoPicker
              label="Video"
              value={vid.videoUrl}
              onChange={(url) => updateVideo(i, { videoUrl: url })}
            />
            <p className="text-[11px] text-muted-foreground">Plays in a lightbox when the thumbnail is clicked. Upload, pick from library, or paste a URL.</p>
            <div>
              <Label className="text-[11px] text-muted-foreground">Poster / Thumbnail Image</Label>
              <ImagePicker
                value={vid.posterUrl ?? ""}
                onChange={(url) => updateVideo(i, { posterUrl: url })}
                label="Poster"
                placeholder="https://… or /images/poster.jpg"
                aiHint={vid.title || "Video thumbnail still"}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <AiTextField type="input" value={vid.title} onChange={(v) => updateVideo(i, { title: v })} className="h-8 text-xs" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-thumbnail-grid", "title", vid.title, { heading: props.heading ?? "" })} fieldLabel="Video title" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Duration</Label>
              <Input value={vid.duration} onChange={(e) => updateVideo(i, { duration: e.target.value })} placeholder="4:12" className="h-8 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy("media-thumbnail-grid", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
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
          defaultBgColor="#F8FAFC"
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
