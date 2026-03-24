import type { PhotoStripBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: PhotoStripBlockProps;
  onChange: (props: PhotoStripBlockProps) => void;
}

const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5";

export function PhotoStripPanel({ props, onChange }: Props) {
  const set = <K extends keyof PhotoStripBlockProps>(k: K, v: PhotoStripBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  const updateImage = (i: number, key: "src" | "alt", v: string) => {
    const images = props.images.map((img, idx) => idx === i ? { ...img, [key]: v } : img);
    onChange({ ...props, images });
  };
  const addImage = () => onChange({ ...props, images: [...props.images, { src: "", alt: "" }] });
  const removeImage = (i: number) => onChange({ ...props, images: props.images.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <Separator />
      <p className={LABEL}>Appearance</p>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Image Size</Label>
        <Select value={props.imageSize ?? "lg"} onValueChange={v => set("imageSize", v as PhotoStripBlockProps["imageSize"])}>
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="xs">XS – 64px (small logos)</SelectItem>
            <SelectItem value="sm">SM – 100px (large logos)</SelectItem>
            <SelectItem value="md">MD – 160px (standard)</SelectItem>
            <SelectItem value="lg">LG – 240px (product images)</SelectItem>
            <SelectItem value="xl">XL – 320px (large photos)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">
          Gap between items — {props.gap ?? 0}px
        </Label>
        <input
          type="range"
          min={0}
          max={80}
          step={4}
          value={props.gap ?? 0}
          onChange={e => set("gap", Number(e.target.value))}
          className="w-full accent-[#003A30]"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
          <span>None (tight)</span>
          <span>80px</span>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Scroll Speed</Label>
        <Select value={props.speed ?? "normal"} onValueChange={v => set("speed", v as PhotoStripBlockProps["speed"])}>
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="slow">Slow (80s)</SelectItem>
            <SelectItem value="normal">Normal (40s)</SelectItem>
            <SelectItem value="fast">Fast (18s)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Image Fit</Label>
        <Select value={props.objectFit ?? "cover"} onValueChange={v => set("objectFit", v as PhotoStripBlockProps["objectFit"])}>
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover (fills space, may crop)</SelectItem>
            <SelectItem value="contain">Contain (full image, no crop)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1">Use Contain for logos so they aren't cropped.</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Edge Gradient</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Fade edges into background</p>
        </div>
        <Switch
          checked={props.showGradient !== false}
          onCheckedChange={v => set("showGradient", v)}
        />
      </div>

      <Separator />
      <p className={LABEL}>Images</p>

      {props.images.map((img, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Image {i + 1}</span>
            <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500" onClick={() => removeImage(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <ImagePicker
            value={img.src}
            onChange={v => updateImage(i, "src", v)}
            placeholder="Image URL"
            className="mb-1"
          />
          <Input placeholder="Alt text" value={img.alt} onChange={e => updateImage(i, "alt", e.target.value)} className="text-xs h-7" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addImage}>
        <Plus className="w-3.5 h-3.5" /> Add Image
      </Button>
    </div>
  );
}
