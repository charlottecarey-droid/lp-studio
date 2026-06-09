import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import type { DandySideImageV6BlockProps } from "@/lib/block-types";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";

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
      <BlockRefreshButton
        blockType="dandy-side-image-v6"
        fields={["eyebrow", "headline", "badgeText"]}
        values={{ eyebrow: p.eyebrow ?? "", headline: p.headline, badgeText: p.badgeText ?? "" }}
        onApply={(u) => onChange({ ...p, ...u })}
      />
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
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</p>
        <SectionBackgroundControl
          backgroundStyle={p.backgroundStyle}
          bgColor={p.bgColor}
          defaultBgColor="#FDFCFA"
          onChange={(patch) => onChange({ ...p, ...patch })}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={p.textColor ?? "#0F172A"} onChange={(v) => set("textColor", v)} />
          <ColorField label="Accent" value={p.accentColor ?? "#006651"} onChange={(v) => set("accentColor", v)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Headline font</Label>
          <FontSelect value={p.headlineFont} onChange={(v) => set("headlineFont", v)} inheritLabel="Inherit from brand (display)" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Body font</Label>
          <FontSelect value={p.bodyFont} onChange={(v) => set("bodyFont", v)} inheritLabel="Inherit from brand (body)" />
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
          <Label className="text-xs">Action</Label>
          <Select value={p.ctaAction ?? "url"} onValueChange={v => set("ctaAction", v as DandySideImageV6BlockProps["ctaAction"])}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="url" className="text-xs">Open URL</SelectItem>
              <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
              <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
              <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(p.ctaAction ?? "url") === "url" && (
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input value={p.ctaUrl ?? ""} onChange={e => set("ctaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="https://..." />
          </div>
        )}
        {p.ctaAction === "chilipiper" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Chili Piper URL</Label>
            <Input value={p.chilipiperUrl ?? ""} onChange={e => set("chilipiperUrl", e.target.value || undefined)} className="h-8 text-xs font-mono" placeholder="https://yourcompany.chilipiper.com/..." />
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
          <Select value={p.secondaryCtaAction ?? "url"} onValueChange={v => set("secondaryCtaAction", v as DandySideImageV6BlockProps["secondaryCtaAction"])}>
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
            <Input value={p.secondaryChilipiperUrl ?? ""} onChange={e => set("secondaryChilipiperUrl", e.target.value || undefined)} className="h-8 text-xs font-mono" placeholder="https://yourcompany.chilipiper.com/..." />
          </div>
        )}
      </div>

      {(p.ctaAction === "modal-form" || p.ctaAction === "modal-chilipiper" ||
        p.secondaryCtaAction === "modal-form" || p.secondaryCtaAction === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={
            (p.ctaAction === "modal-form" || p.ctaAction === "modal-chilipiper")
              ? p.ctaAction
              : (p.secondaryCtaAction as "modal-form" | "modal-chilipiper")
          }
          value={p}
          onChange={(next) => onChange({ ...p, ...next })}
        />
      )}
    </div>
  );
}
