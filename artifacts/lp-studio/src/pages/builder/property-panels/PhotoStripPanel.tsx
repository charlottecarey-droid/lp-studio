import type { PhotoStripBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: PhotoStripBlockProps;
  onChange: (props: PhotoStripBlockProps) => void;
}

export function PhotoStripPanel({ props, onChange }: Props) {
  const updateImage = (i: number, key: "src" | "alt", v: string) => {
    const images = props.images.map((img, idx) => idx === i ? { ...img, [key]: v } : img);
    onChange({ ...props, images });
  };
  const addImage = () => onChange({ ...props, images: [...props.images, { src: "", alt: "" }] });
  const removeImage = (i: number) => onChange({ ...props, images: props.images.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Images</Label>
      {props.images.map((img, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Image {i + 1}</span>
            <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500" onClick={() => removeImage(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <Input placeholder="Image URL" value={img.src} onChange={e => updateImage(i, "src", e.target.value)} className="text-xs h-7" />
          <Input placeholder="Alt text" value={img.alt} onChange={e => updateImage(i, "alt", e.target.value)} className="text-xs h-7" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addImage}>
        <Plus className="w-3.5 h-3.5" /> Add Image
      </Button>
    </div>
  );
}
