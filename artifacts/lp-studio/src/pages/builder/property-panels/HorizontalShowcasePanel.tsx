import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  HorizontalShowcaseBlockProps,
  HorizontalShowcasePanel,
} from "@/lib/block-types";
import { EmailCaptureConfigSection } from "./EmailCaptureConfigSection";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";

interface Props {
  props: HorizontalShowcaseBlockProps;
  onChange: (next: HorizontalShowcaseBlockProps) => void;
}

export function HorizontalShowcasePanel({ props, onChange }: Props) {
  const panels = props.panels ?? [];

  const setPanel = (i: number, patch: Partial<HorizontalShowcasePanel>) =>
    onChange({ ...props, panels: panels.map((p, idx) => idx === i ? { ...p, ...patch } : p) });
  const addPanel = () =>
    onChange({ ...props, panels: [...panels, { title: "New panel", body: "", alignment: "left", bgColor: "#16161D", overlayColor: "rgba(0,0,0,0.55)", accentColor: "var(--brand-accent)" }] });
  const removePanel = (i: number) =>
    onChange({ ...props, panels: panels.filter((_, idx) => idx !== i) });
  const movePanel = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= panels.length) return;
    const next = [...panels];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...props, panels: next });
  };

  return (
    <div className="space-y-6">
      <BlockRefreshButton
        blockType="horizontal-showcase"
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
            <Input type="color" value={props.bgColor ?? "#0B0B0F"} onChange={(e) => onChange({ ...props, bgColor: e.target.value })} className="h-10" />
            <BrandSwatches className="mt-1.5" current={props.bgColor} onPick={(hex) => onChange({ ...props, bgColor: hex })} />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Scroll length per panel (vh)</Label>
            <Input type="number" min={50} max={200} value={props.panelHeightVh ?? 90} onChange={(e) => onChange({ ...props, panelHeightVh: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <EmailCaptureConfigSection
        value={props.email}
        onChange={(email) => onChange({ ...props, email })}
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Panels ({panels.length})</Label>
          <Button size="sm" variant="outline" onClick={addPanel}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add panel
          </Button>
        </div>
        <div className="space-y-3">
          {panels.map((panel, i) => (
            <div key={i} className="border rounded-lg p-3 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 shrink-0">#{i + 1}</span>
                <button onClick={() => movePanel(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => movePanel(i, 1)} disabled={i === panels.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                <Input value={panel.tag ?? ""} onChange={(e) => setPanel(i, { tag: e.target.value })} placeholder="TAG" className="h-8 text-xs flex-1" />
                <button onClick={() => removePanel(i)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <Input value={panel.title} onChange={(e) => setPanel(i, { title: e.target.value })} placeholder="Title" className="h-9 text-sm font-semibold" />
              <Textarea value={panel.body ?? ""} onChange={(e) => setPanel(i, { body: e.target.value })} placeholder="Body" rows={2} className="text-sm resize-none" />
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Panel image</Label>
                <ImagePicker
                  value={panel.imageUrl ?? ""}
                  onChange={(url) => setPanel(i, { imageUrl: url })}
                  placeholder="Pick or upload image"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Alignment</Label>
                <Select value={panel.alignment ?? "left"} onValueChange={(v) => setPanel(i, { alignment: v as "left" | "center" | "right" })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left" className="text-xs">Align left</SelectItem>
                    <SelectItem value="center" className="text-xs">Align center</SelectItem>
                    <SelectItem value="right" className="text-xs">Align right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={panel.ctaText ?? ""} onChange={(e) => setPanel(i, { ctaText: e.target.value })} placeholder="CTA text" className="h-8 text-xs" />
                <Input value={panel.ctaUrl ?? ""} onChange={(e) => setPanel(i, { ctaUrl: e.target.value })} placeholder="CTA URL" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5 pl-1 border-l-2 border-slate-200">
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-2">
                  <input type="checkbox" checked={panel.showEmailCapture === true} onChange={(e) => setPanel(i, { showEmailCapture: e.target.checked })} className="rounded" />
                  Use email capture pill instead of button
                </label>
                {panel.showEmailCapture && (
                  <Input
                    value={panel.emailPlaceholder ?? ""}
                    onChange={(e) => setPanel(i, { emailPlaceholder: e.target.value })}
                    placeholder="Email placeholder"
                    className="h-8 text-xs ml-2"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">BG</Label>
                  <Input type="color" value={panel.bgColor ?? "#16161D"} onChange={(e) => setPanel(i, { bgColor: e.target.value })} className="h-8" />
                  <BrandSwatches className="mt-1.5" current={panel.bgColor} onPick={(hex) => setPanel(i, { bgColor: hex })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Accent</Label>
                  <Input type="color" value={panel.accentColor ?? "#C7E738"} onChange={(e) => setPanel(i, { accentColor: e.target.value })} className="h-8" />
                  <BrandSwatches className="mt-1.5" current={panel.accentColor} onPick={(hex) => setPanel(i, { accentColor: hex })} />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Overlay (rgba over image)</Label>
                <Input value={panel.overlayColor ?? ""} onChange={(e) => setPanel(i, { overlayColor: e.target.value })} placeholder="rgba(0,0,0,0.55)" className="h-8 text-[10px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
