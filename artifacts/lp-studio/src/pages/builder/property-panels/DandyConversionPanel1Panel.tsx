import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DandyConversionPanel1BlockProps } from "@/lib/block-types";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  props: DandyConversionPanel1BlockProps;
  onChange: (p: DandyConversionPanel1BlockProps) => void;
}

export function DandyConversionPanel1Panel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandyConversionPanel1BlockProps>(k: K, v: DandyConversionPanel1BlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateStat = (i: number, patch: Partial<{ value: string; label: string }>) => {
    const stats = (p.stats ?? []).map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onChange({ ...p, stats });
  };
  const addStat = () => onChange({ ...p, stats: [...(p.stats ?? []), { value: "", label: "" }] });
  const removeStat = (i: number) => onChange({ ...p, stats: (p.stats ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <BlockRefreshButton
        blockType="dandy-conversion-panel-1"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: p.eyebrow ?? "", headline: p.headline, subheadline: p.subheadline ?? "" }}
        onApply={(u) => onChange({ ...p, ...u })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Style</Label>
        <Select value={p.style ?? "teal"} onValueChange={v => set("style", v as "teal" | "lime" | "medium" | "white")}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="teal" className="text-xs">Dark Teal</SelectItem>
            <SelectItem value="medium" className="text-xs">Medium Green</SelectItem>
            <SelectItem value="lime" className="text-xs">Lime</SelectItem>
            <SelectItem value="white" className="text-xs">White</SelectItem>
          </SelectContent>
        </Select>
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
          <Select value={p.primaryCtaAction ?? "url"} onValueChange={v => set("primaryCtaAction", v as DandyConversionPanel1BlockProps["primaryCtaAction"])}>
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
          <Select value={p.secondaryCtaAction ?? "url"} onValueChange={v => set("secondaryCtaAction", v as DandyConversionPanel1BlockProps["secondaryCtaAction"])}>
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

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stats</p>
        {(p.stats ?? []).map((s, i) => (
          <div key={i} className="flex gap-1.5 items-center mb-1.5">
            <Input value={s.value} onChange={e => updateStat(i, { value: e.target.value })} className="h-7 text-xs w-20 shrink-0" placeholder="96%" />
            <Input value={s.label} onChange={e => updateStat(i, { label: e.target.value })} className="h-7 text-xs flex-1" placeholder="First-time right" />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeStat(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addStat}><Plus className="w-3 h-3" /> Add stat</Button>
      </div>
    </div>
  );
}
