import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import type { DandyVideoTestimonialsBlockProps } from "@/lib/block-types";

interface Props {
  props: DandyVideoTestimonialsBlockProps;
  onChange: (p: DandyVideoTestimonialsBlockProps) => void;
}

export function DandyVideoTestimonialsPanel({ props: p, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const set = <K extends keyof DandyVideoTestimonialsBlockProps>(k: K, v: DandyVideoTestimonialsBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateItem = (i: number, patch: Partial<typeof p.items[0]>) => {
    const items = p.items.map((item, idx) => idx === i ? { ...item, ...patch } : item);
    onChange({ ...p, items });
  };
  const addItem = () => onChange({ ...p, items: [...p.items, { imageUrl: "", name: "", practiceName: "", videoId: "" }] });
  const removeItem = (i: number) => onChange({ ...p, items: p.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Eyebrow</Label>
        <Input value={p.eyebrow ?? ""} onChange={e => set("eyebrow", e.target.value || undefined)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Headline</Label>
        <Input value={p.headline} onChange={e => set("headline", e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subheadline</Label>
        <Input value={p.subheadline ?? ""} onChange={e => set("subheadline", e.target.value || undefined)} className="h-8 text-xs" />
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Testimonials</p>
        <div className="space-y-2">
          {p.items.map((item, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/30 hover:bg-muted/60 transition-colors"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span>{item.name || `Testimonial ${i + 1}`}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); removeItem(i); }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                  {openIdx === i ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </button>
              {openIdx === i && (
                <div className="p-3 space-y-3">
                  <ImagePicker label="Thumbnail / Poster" value={item.imageUrl} onChange={v => updateItem(i, { imageUrl: v })} />
                  <VideoPicker label="Video File" value={item.videoId ?? ""} onChange={v => updateItem(i, { videoId: v || undefined })} />
                  <p className="text-[11px] text-muted-foreground -mt-1">Upload a video file or paste a direct video URL. Used when the card is tapped.</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={item.name} onChange={e => updateItem(i, { name: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Practice Name</Label>
                    <Input value={item.practiceName} onChange={e => updateItem(i, { practiceName: e.target.value })} className="h-7 text-xs" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addItem}><Plus className="w-3 h-3" /> Add testimonial</Button>
        </div>
      </div>
    </div>
  );
}
