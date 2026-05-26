import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import type { DandyHeroV7S3BlockProps } from "@/lib/block-types";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  props: DandyHeroV7S3BlockProps;
  onChange: (p: DandyHeroV7S3BlockProps) => void;
}

export function DandyHeroV7S3Panel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandyHeroV7S3BlockProps>(k: K, v: DandyHeroV7S3BlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateTrust = (i: number, patch: Partial<{ value: string; label: string }>) => {
    const trustItems = (p.trustItems ?? []).map((t, idx) => idx === i ? { ...t, ...patch } : t);
    onChange({ ...p, trustItems });
  };
  const addTrust = () => onChange({ ...p, trustItems: [...(p.trustItems ?? []), { value: "", label: "" }] });
  const removeTrust = (i: number) => onChange({ ...p, trustItems: (p.trustItems ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <BlockRefreshButton
        blockType="dandy-hero-v7-s3"
        fields={["eyebrow", "headline", "subheadline", "ctaText"]}
        values={{ eyebrow: p.eyebrow ?? "", headline: p.headline, subheadline: p.subheadline ?? "", ctaText: p.ctaText ?? "" }}
        onApply={(u) => onChange({ ...p, ...u })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={p.bgColor ?? "var(--brand-primary)"} onChange={e => set("bgColor", e.target.value)} className="w-9 h-8 rounded border cursor-pointer p-0.5" />
          <BrandSwatches className="ml-1" current={p.bgColor} onPick={hex => set("bgColor", hex)} />
          <Input value={p.bgColor ?? "var(--brand-primary)"} onChange={e => set("bgColor", e.target.value)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </div>
      <ImagePicker label="Background Image" value={p.backgroundImageUrl ?? ""} onChange={v => set("backgroundImageUrl", v || undefined)} />
      {p.backgroundImageUrl && (
        <div className="space-y-1.5">
          <Label className="text-xs">Image Opacity <span className="text-muted-foreground font-normal">({Math.round((p.bgImageOpacity ?? 0.15) * 100)}%)</span></Label>
          <input type="range" min={0} max={1} step={0.05} value={p.bgImageOpacity ?? 0.15} onChange={e => set("bgImageOpacity", parseFloat(e.target.value))} className="w-full accent-emerald-700" />
        </div>
      )}

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
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">CTA Action</Label>
          <Select
            value={p.ctaAction ?? "inline-form"}
            onValueChange={v => set("ctaAction", v as DandyHeroV7S3BlockProps["ctaAction"])}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inline-form" className="text-xs">Inline email form (default)</SelectItem>
              <SelectItem value="url" className="text-xs">Open URL</SelectItem>
              <SelectItem value="chilipiper" className="text-xs">Open Chili Piper (iframe)</SelectItem>
              <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
              <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Button Text</Label>
          <Input value={p.ctaText ?? ""} onChange={e => set("ctaText", e.target.value || undefined)} className="h-8 text-xs" placeholder="Get Started" />
        </div>

        {(p.ctaAction ?? "inline-form") === "inline-form" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Input Placeholder</Label>
              <Input value={p.inputPlaceholder ?? ""} onChange={e => set("inputPlaceholder", e.target.value || undefined)} className="h-8 text-xs" placeholder="Enter your work email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Disclaimer</Label>
              <Input value={p.formDisclaimer ?? ""} onChange={e => set("formDisclaimer", e.target.value || undefined)} className="h-8 text-xs" placeholder="No credit card required." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Chili Piper URL (after inline submit)</Label>
              <Input value={p.chilipiperUrl ?? ""} onChange={e => set("chilipiperUrl", e.target.value || undefined)} className="h-8 text-xs font-mono" placeholder="https://meetdandy.chilipiper.com/..." />
              <p className="text-[11px] text-muted-foreground">If set, opens the scheduling modal after form submit.</p>
            </div>
          </>
        )}

        {p.ctaAction === "url" && (
          <div className="space-y-1.5">
            <Label className="text-xs">CTA URL</Label>
            <Input value={p.ctaUrl ?? ""} onChange={e => set("ctaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="#" />
          </div>
        )}

        {p.ctaAction === "chilipiper" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Chili Piper URL</Label>
            <Input value={p.chilipiperUrl ?? ""} onChange={e => set("chilipiperUrl", e.target.value || undefined)} className="h-8 text-xs font-mono" placeholder="https://meetdandy.chilipiper.com/round-robin/..." />
          </div>
        )}

        {(p.ctaAction === "modal-form" || p.ctaAction === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={p.ctaAction}
            value={p}
            onChange={next => onChange({ ...p, ...next })}
          />
        )}
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trust Stats</p>
        {(p.trustItems ?? []).map((t, i) => (
          <div key={i} className="flex gap-1.5 items-center mb-1.5">
            <Input value={t.value} onChange={e => updateTrust(i, { value: e.target.value })} className="h-7 text-xs w-20 shrink-0" placeholder="96%" />
            <Input value={t.label} onChange={e => updateTrust(i, { label: e.target.value })} className="h-7 text-xs flex-1" placeholder="First-time right" />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeTrust(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addTrust}><Plus className="w-3 h-3" /> Add stat</Button>
      </div>
    </div>
  );
}
