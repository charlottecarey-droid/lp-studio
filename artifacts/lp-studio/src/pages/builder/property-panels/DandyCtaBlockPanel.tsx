import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandSwatches } from "@/components/BrandSwatches";
import type { DandyCtaBlockProps } from "@/lib/block-types";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

import { BlockRefreshButton } from "@/components/BlockRefreshButton";

interface Props {
  props: DandyCtaBlockProps;
  onChange: (p: DandyCtaBlockProps) => void;
}

export function DandyCtaBlockPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandyCtaBlockProps>(k: K, v: DandyCtaBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  return (
    <div className="space-y-4">
      <BlockRefreshButton
        blockType="dandy-cta-block"
        fields={["eyebrow", "headline", "subheadline", "primaryCtaText"]}
        values={{ eyebrow: p.eyebrow ?? "", headline: p.headline, subheadline: p.subheadline ?? "", primaryCtaText: p.primaryCtaText ?? "" }}
        onApply={(u) => onChange({ ...p, ...u })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Alignment</Label>
        <Select value={p.alignment ?? "center"} onValueChange={v => set("alignment", v as "left" | "center" | "right")}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left" className="text-xs">Left</SelectItem>
            <SelectItem value="center" className="text-xs">Center</SelectItem>
            <SelectItem value="right" className="text-xs">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="w-9 h-8 rounded border cursor-pointer p-0.5" />
          <BrandSwatches className="ml-1" current={p.bgColor} onPick={hex => set("bgColor", hex)} />
          <Input value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </div>
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

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.primaryCtaText ?? ""} onChange={e => set("primaryCtaText", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select value={p.primaryCtaAction ?? "url"} onValueChange={v => set("primaryCtaAction", v as DandyCtaBlockProps["primaryCtaAction"])}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="url" className="text-xs">Open URL</SelectItem>
              <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
              <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
              <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(p.primaryCtaAction ?? "url") === "url" && (
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input value={p.primaryCtaUrl ?? ""} onChange={e => set("primaryCtaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="https://..." />
          </div>
        )}
        {p.primaryCtaAction === "chilipiper" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Chili Piper URL</Label>
            <Input value={p.primaryChilipiperUrl ?? ""} onChange={e => set("primaryChilipiperUrl", e.target.value || undefined)} className="h-8 text-xs font-mono" placeholder="https://meetdandy.chilipiper.com/..." />
          </div>
        )}
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secondary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.secondaryCtaText ?? ""} onChange={e => set("secondaryCtaText", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select value={p.secondaryCtaAction ?? "url"} onValueChange={v => set("secondaryCtaAction", v as DandyCtaBlockProps["secondaryCtaAction"])}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="url" className="text-xs">Open URL</SelectItem>
              <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
              <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
              <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(p.secondaryCtaAction ?? "url") === "url" && (
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input value={p.secondaryCtaUrl ?? ""} onChange={e => set("secondaryCtaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="https://..." />
          </div>
        )}
        {p.secondaryCtaAction === "chilipiper" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Chili Piper URL</Label>
            <Input value={p.secondaryChilipiperUrl ?? ""} onChange={e => set("secondaryChilipiperUrl", e.target.value || undefined)} className="h-8 text-xs font-mono" placeholder="https://meetdandy.chilipiper.com/..." />
          </div>
        )}
      </div>

      {(p.primaryCtaAction === "modal-form" || p.primaryCtaAction === "modal-chilipiper" ||
        p.secondaryCtaAction === "modal-form" || p.secondaryCtaAction === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={
            (p.primaryCtaAction === "modal-form" || p.primaryCtaAction === "modal-chilipiper")
              ? p.primaryCtaAction
              : (p.secondaryCtaAction as "modal-form" | "modal-chilipiper")
          }
          value={p}
          onChange={(next) => onChange({ ...p, ...next })}
        />
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Disclaimer</Label>
        <Input value={p.disclaimer ?? ""} onChange={e => set("disclaimer", e.target.value || undefined)} className="h-8 text-xs" placeholder="No spam. Cancel anytime." />
      </div>
    </div>
  );
}
