import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DandyVersusBlockProps } from "@/lib/block-types";

interface Props {
  props: DandyVersusBlockProps;
  onChange: (p: DandyVersusBlockProps) => void;
}

export function DandyVersusPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandyVersusBlockProps>(k: K, v: DandyVersusBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const setBullet = (side: "leftBullets" | "rightBullets", i: number, v: string) => {
    const arr = [...(p[side] ?? [])];
    arr[i] = v;
    onChange({ ...p, [side]: arr });
  };
  const addBullet = (side: "leftBullets" | "rightBullets") =>
    onChange({ ...p, [side]: [...(p[side] ?? []), ""] });
  const removeBullet = (side: "leftBullets" | "rightBullets", i: number) =>
    onChange({ ...p, [side]: (p[side] ?? []).filter((_, idx) => idx !== i) });

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
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={p.bgColor ?? "#003A30"} onChange={e => set("bgColor", e.target.value)} className="w-9 h-8 rounded border cursor-pointer p-0.5" />
          <Input value={p.bgColor ?? "#003A30"} onChange={e => set("bgColor", e.target.value)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Left Card (Before)</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={p.leftLabel} onChange={e => set("leftLabel", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input value={p.leftTitle} onChange={e => set("leftTitle", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Input value={p.leftDesc} onChange={e => set("leftDesc", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bullets</Label>
          {(p.leftBullets ?? []).map((b, i) => (
            <div key={i} className="flex gap-1">
              <Input value={b} onChange={e => setBullet("leftBullets", i, e.target.value)} className="h-7 text-xs flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBullet("leftBullets", i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => addBullet("leftBullets")}><Plus className="w-3 h-3" /> Add bullet</Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CTA Text</Label>
          <Input value={p.leftCtaText} onChange={e => set("leftCtaText", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CTA URL</Label>
          <Input value={p.leftCtaUrl} onChange={e => set("leftCtaUrl", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Right Card (Dandy)</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={p.rightLabel} onChange={e => set("rightLabel", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input value={p.rightTitle} onChange={e => set("rightTitle", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Input value={p.rightDesc} onChange={e => set("rightDesc", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bullets</Label>
          {(p.rightBullets ?? []).map((b, i) => (
            <div key={i} className="flex gap-1">
              <Input value={b} onChange={e => setBullet("rightBullets", i, e.target.value)} className="h-7 text-xs flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBullet("rightBullets", i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => addBullet("rightBullets")}><Plus className="w-3 h-3" /> Add bullet</Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CTA Text</Label>
          <Input value={p.rightCtaText} onChange={e => set("rightCtaText", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CTA URL</Label>
          <Input value={p.rightCtaUrl} onChange={e => set("rightCtaUrl", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}
