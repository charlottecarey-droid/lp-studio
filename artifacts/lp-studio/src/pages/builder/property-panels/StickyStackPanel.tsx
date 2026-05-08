import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  StickyStackBlockProps,
  StickyStackCard,
} from "@/lib/block-types";
import { EmailCaptureConfigSection } from "./EmailCaptureConfigSection";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";

interface Props {
  props: StickyStackBlockProps;
  onChange: (next: StickyStackBlockProps) => void;
}

export function StickyStackPanel({ props, onChange }: Props) {
  const cards = props.cards ?? [];

  const setCard = (i: number, patch: Partial<StickyStackCard>) =>
    onChange({ ...props, cards: cards.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addCard = () =>
    onChange({ ...props, cards: [...cards, { title: "New card", body: "", imageSide: "right", bgColor: "#0B0B0F", textColor: "#fff", accentColor: "var(--brand-accent)" }] });
  const removeCard = (i: number) =>
    onChange({ ...props, cards: cards.filter((_, idx) => idx !== i) });
  const moveCard = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= cards.length) return;
    const next = [...cards];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...props, cards: next });
  };

  return (
    <div className="space-y-6">
      <BlockRefreshButton
        blockType="sticky-stack"
        fields={["eyebrow", "headline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "" }}
        onApply={(u) => onChange({ ...props, ...u })}
      />
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => onChange({ ...props, eyebrow: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Section headline</Label>
          <Input value={props.headline ?? ""} onChange={(e) => onChange({ ...props, headline: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Background</Label>
            <Input type="color" value={props.bgColor ?? "#FAFAF7"} onChange={(e) => onChange({ ...props, bgColor: e.target.value })} className="h-10" />
            <BrandSwatches className="mt-1.5" current={props.bgColor} onPick={(hex) => onChange({ ...props, bgColor: hex })} />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Scroll length per card (vh)</Label>
            <Input type="number" min={60} max={200} value={props.cardScrollVh ?? 110} onChange={(e) => onChange({ ...props, cardScrollVh: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <EmailCaptureConfigSection
        value={props.email}
        onChange={(email) => onChange({ ...props, email })}
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Cards ({cards.length})</Label>
          <Button size="sm" variant="outline" onClick={addCard}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add card
          </Button>
        </div>
        <div className="space-y-3">
          {cards.map((card, i) => (
            <div key={i} className="border rounded-lg p-3 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 shrink-0">#{i + 1}</span>
                <button onClick={() => moveCard(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveCard(i, 1)} disabled={i === cards.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                <Input value={card.tag ?? ""} onChange={(e) => setCard(i, { tag: e.target.value })} placeholder="TAG" className="h-8 text-xs flex-1" />
                <button onClick={() => removeCard(i)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <Input value={card.title} onChange={(e) => setCard(i, { title: e.target.value })} placeholder="Title" className="h-9 text-sm font-semibold" />
              <Textarea value={card.body ?? ""} onChange={(e) => setCard(i, { body: e.target.value })} placeholder="Body" rows={2} className="text-sm resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={card.ctaText ?? ""} onChange={(e) => setCard(i, { ctaText: e.target.value })} placeholder="CTA text" className="h-8 text-xs" />
                <Input value={card.ctaUrl ?? ""} onChange={(e) => setCard(i, { ctaUrl: e.target.value })} placeholder="CTA URL" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5 pl-1 border-l-2 border-slate-200">
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-2">
                  <input type="checkbox" checked={card.showEmailCapture === true} onChange={(e) => setCard(i, { showEmailCapture: e.target.checked })} className="rounded" />
                  Use email capture pill instead of button
                </label>
                {card.showEmailCapture && (
                  <Input
                    value={card.emailPlaceholder ?? ""}
                    onChange={(e) => setCard(i, { emailPlaceholder: e.target.value })}
                    placeholder="Email placeholder"
                    className="h-8 text-xs ml-2"
                  />
                )}
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Card image (optional)</Label>
                <ImagePicker
                  value={card.imageUrl ?? ""}
                  onChange={(url) => setCard(i, { imageUrl: url })}
                  placeholder="Pick or upload image"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Image side</Label>
                <Select value={card.imageSide ?? "right"} onValueChange={(v) => setCard(i, { imageSide: v as "left" | "right" })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left" className="text-xs">Image left</SelectItem>
                    <SelectItem value="right" className="text-xs">Image right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Card BG</Label>
                  <Input type="color" value={card.bgColor ?? "#0B0B0F"} onChange={(e) => setCard(i, { bgColor: e.target.value })} className="h-8" />
                  <BrandSwatches className="mt-1.5" current={card.bgColor} onPick={(hex) => setCard(i, { bgColor: hex })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Text</Label>
                  <Input type="color" value={card.textColor ?? "#ffffff"} onChange={(e) => setCard(i, { textColor: e.target.value })} className="h-8" />
                  <BrandSwatches className="mt-1.5" current={card.textColor} onPick={(hex) => setCard(i, { textColor: hex })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Accent</Label>
                  <Input type="color" value={card.accentColor ?? "#C7E738"} onChange={(e) => setCard(i, { accentColor: e.target.value })} className="h-8" />
                  <BrandSwatches className="mt-1.5" current={card.accentColor} onPick={(hex) => setCard(i, { accentColor: hex })} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
