import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/ImagePicker";
import type { DandySideImageV6BlockProps } from "@/lib/block-types";

interface Props {
  props: DandySideImageV6BlockProps;
  onChange: (p: DandySideImageV6BlockProps) => void;
}

export function DandySideImageV6Panel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandySideImageV6BlockProps>(k: K, v: DandySideImageV6BlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const setBullet = (i: number, v: string) => {
    const bullets = [...(p.bullets ?? [])];
    bullets[i] = v;
    onChange({ ...p, bullets });
  };
  const addBullet = () => onChange({ ...p, bullets: [...(p.bullets ?? []), ""] });
  const removeBullet = (i: number) => onChange({ ...p, bullets: (p.bullets ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Image Position</Label>
        <Select value={p.imagePosition ?? "right"} onValueChange={v => set("imagePosition", v as "left" | "right")}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="right" className="text-xs">Image Right</SelectItem>
            <SelectItem value="left" className="text-xs">Image Left</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ImagePicker label="Image" value={p.imageUrl ?? ""} onChange={v => set("imageUrl", v || undefined)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Image Badge Text</Label>
        <Input value={p.badgeText ?? ""} onChange={e => set("badgeText", e.target.value || undefined)} className="h-8 text-xs" placeholder="e.g. 96% first-time right" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="w-9 h-8 rounded border cursor-pointer p-0.5" />
          <Input value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </div>
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy</p>
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
        <div className="space-y-1.5">
          <Label className="text-xs">Bullets</Label>
          {(p.bullets ?? []).map((b, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <Input value={b} onChange={e => setBullet(i, e.target.value)} className="h-7 text-xs flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBullet(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addBullet}><Plus className="w-3 h-3" /> Add bullet</Button>
        </div>
      </div>
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.ctaText ?? ""} onChange={e => set("ctaText", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.ctaUrl ?? ""} onChange={e => set("ctaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secondary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.secondaryCtaText ?? ""} onChange={e => set("secondaryCtaText", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.secondaryCtaUrl ?? ""} onChange={e => set("secondaryCtaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}
