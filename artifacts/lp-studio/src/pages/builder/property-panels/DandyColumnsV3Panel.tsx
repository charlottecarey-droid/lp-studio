import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import type { DandyColumnsV3BlockProps } from "@/lib/block-types";

interface Props {
  props: DandyColumnsV3BlockProps;
  onChange: (p: DandyColumnsV3BlockProps) => void;
}

export function DandyColumnsV3Panel({ props: p, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const set = <K extends keyof DandyColumnsV3BlockProps>(k: K, v: DandyColumnsV3BlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateItem = (i: number, patch: Partial<typeof p.items[0]>) => {
    const items = p.items.map((item, idx) => idx === i ? { ...item, ...patch } : item);
    onChange({ ...p, items });
  };
  const addItem = () => onChange({ ...p, items: [...p.items, { imageUrl: "", title: "", description: "" }] });
  const removeItem = (i: number) => onChange({ ...p, items: p.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <BlockRefreshButton
        blockType="dandy-columns-v3"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: p.eyebrow ?? "", headline: p.headline, subheadline: p.subheadline ?? "" }}
        onApply={(u) => onChange({ ...p, ...u })}
      />
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
        <Label className="text-xs">Header alignment</Label>
        <div className="flex gap-1">
          {(["left", "center"] as const).map((opt) => {
            const active = (p.headerAlign ?? "left") === opt;
            return (
              <Button
                key={opt}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-7 text-xs flex-1 capitalize"
                onClick={() => set("headerAlign", opt)}
              >
                {opt}
              </Button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">Centers the eyebrow, headline and subheadline over the columns.</p>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Numbers</p>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show numbers (01., 02., 03.)</Label>
          <Switch
            checked={p.showNumbers ?? true}
            onCheckedChange={(v) => set("showNumbers", v)}
          />
        </div>
        {(p.showNumbers ?? true) && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Number color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={p.numberColor ?? "#000000"}
                  onChange={(e) => set("numberColor", e.target.value)}
                  className="w-9 h-9 rounded border cursor-pointer flex-shrink-0"
                />
                <BrandSwatches className="ml-1" current={p.numberColor} onPick={(hex) => set("numberColor", hex)} />
                <Input
                  value={p.numberColor ?? ""}
                  placeholder="var(--brand-accent)"
                  onChange={(e) => set("numberColor", e.target.value || undefined)}
                  className="text-xs font-mono h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Spacing to title</Label>
              <div className="flex gap-1">
                {(["tight", "normal", "loose"] as const).map((opt) => {
                  const active = (p.numberGap ?? "normal") === opt;
                  return (
                    <Button
                      key={opt}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="h-7 text-xs flex-1 capitalize"
                      onClick={() => set("numberGap", opt)}
                    >
                      {opt}
                    </Button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Steps / Features</p>
        <div className="space-y-2">
          {p.items.map((item, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/30 hover:bg-muted/60 transition-colors"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span>{item.title || `Step ${i + 1}`}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); removeItem(i); }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                  {openIdx === i ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </button>
              {openIdx === i && (
                <div className="p-3 space-y-3">
                  <ImagePicker label="Icon / Image" value={item.imageUrl} onChange={v => updateItem(i, { imageUrl: v })} />
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input value={item.title} onChange={e => updateItem(i, { title: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={item.description} onChange={e => updateItem(i, { description: e.target.value })} className="h-7 text-xs" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addItem}><Plus className="w-3 h-3" /> Add step</Button>
        </div>
      </div>
    </div>
  );
}
