import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ImagePicker } from "@/components/ImagePicker";
import type { DandyColumnsV2BlockProps } from "@/lib/block-types";

interface Props {
  props: DandyColumnsV2BlockProps;
  onChange: (p: DandyColumnsV2BlockProps) => void;
}

export function DandyColumnsV2Panel({ props: p, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const set = <K extends keyof DandyColumnsV2BlockProps>(k: K, v: DandyColumnsV2BlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateItem = (i: number, patch: Partial<typeof p.items[0]>) => {
    const items = p.items.map((item, idx) => idx === i ? { ...item, ...patch } : item);
    onChange({ ...p, items });
  };
  const setBullet = (i: number, bi: number, v: string) => {
    const items = p.items.map((item, idx) => {
      if (idx !== i) return item;
      const bullets = [...(item.bullets ?? [])];
      bullets[bi] = v;
      return { ...item, bullets };
    });
    onChange({ ...p, items });
  };
  const addBullet = (i: number) => updateItem(i, { bullets: [...(p.items[i].bullets ?? []), ""] });
  const removeBullet = (i: number, bi: number) =>
    updateItem(i, { bullets: (p.items[i].bullets ?? []).filter((_, idx) => idx !== bi) });
  const addItem = () => onChange({ ...p, items: [...p.items, { imageUrl: "", title: "", description: "", bullets: [], ctaText: "", ctaUrl: "" }] });
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Columns</p>
        <div className="space-y-2">
          {p.items.map((item, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/30 hover:bg-muted/60 transition-colors"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span>{item.title || `Column ${i + 1}`}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); removeItem(i); }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                  {openIdx === i ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </button>
              {openIdx === i && (
                <div className="p-3 space-y-3">
                  <ImagePicker label="Image" value={item.imageUrl} onChange={v => updateItem(i, { imageUrl: v })} />
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input value={item.title} onChange={e => updateItem(i, { title: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={item.description} onChange={e => updateItem(i, { description: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bullets</Label>
                    {(item.bullets ?? []).map((b, bi) => (
                      <div key={bi} className="flex gap-1 mb-1">
                        <Input value={b} onChange={e => setBullet(i, bi, e.target.value)} className="h-6 text-xs flex-1" />
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeBullet(i, bi)}><Trash2 className="w-2.5 h-2.5" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="w-full h-6 text-xs gap-1" onClick={() => addBullet(i)}><Plus className="w-2.5 h-2.5" /> Add bullet</Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CTA Text</Label>
                    <Input value={item.ctaText} onChange={e => updateItem(i, { ctaText: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CTA URL</Label>
                    <Input value={item.ctaUrl} onChange={e => updateItem(i, { ctaUrl: e.target.value })} className="h-7 text-xs" placeholder="https://..." />
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addItem}><Plus className="w-3 h-3" /> Add column</Button>
        </div>
      </div>
    </div>
  );
}
