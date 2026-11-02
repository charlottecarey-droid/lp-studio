import type { DsoMinimalHeroBlockProps } from "@/lib/block-types";
import type { BackgroundStyle } from "@/lib/bg-styles";
import type { CtaSuiteFields, CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { Field, PanelSection } from "./glow/GlowPanelKit";
import { Plus, Trash2 } from "lucide-react";

const CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;
const BG_OPTIONS: Array<{ value: BackgroundStyle; label: string }> = [
  { value: "white", label: "White" },
  { value: "light-gray", label: "Light gray" },
  { value: "muted", label: "Muted" },
  { value: "dark", label: "Dark" },
  { value: "dandy-green", label: "Brand" },
  { value: "black", label: "Black" },
];

interface Props {
  props: DsoMinimalHeroBlockProps;
  onChange: (props: DsoMinimalHeroBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function DsoMinimalHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<DsoMinimalHeroBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const setStats = (next: DsoMinimalHeroBlockProps["stats"]) => update({ stats: next });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="dso-minimal-hero"
        fields={["eyebrow", "headline", "headlineMuted", "subheadline", "ctaText"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", headlineMuted: props.headlineMuted ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Eyebrow (small line above the headline)">
          <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" placeholder="For multi-location groups" />
        </Field>
        <Field label="Headline — first part (ink)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("dso-minimal-hero", "headline", props.headline ?? "", { headlineMuted: props.headlineMuted ?? "" })} />
        </Field>
        <Field label="Headline — second part (muted)">
          <AiTextField value={props.headlineMuted ?? ""} onChange={(v) => update({ headlineMuted: v })} rows={2} className="text-xs" fieldLabel="Second part"
            onSuggest={() => suggestCopy("dso-minimal-hero", "headlineMuted", props.headlineMuted ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <Field label="Supporting line">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("dso-minimal-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
      </PanelSection>

      <PanelSection title="Media card" defaultOpen>
        <VideoPicker label="Video (mp4 from the library plays muted on loop; embeds also work)" value={props.mediaVideoUrl ?? ""} onChange={(v) => update({ mediaVideoUrl: v })} />
        <Field label="Image (poster for the video, or the graphic itself)">
          <ImagePicker value={props.mediaImageUrl ?? ""} onChange={(v) => update({ mediaImageUrl: v })} />
        </Field>
        <Field label="Alt text">
          <Input value={props.mediaImageAlt ?? ""} onChange={(e) => update({ mediaImageAlt: e.target.value })} className="h-8 text-xs" />
        </Field>
        <Field label="Aspect">
          <Select value={props.mediaAspect ?? "16/9"} onValueChange={(v) => update({ mediaAspect: v as DsoMinimalHeroBlockProps["mediaAspect"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="16/9" className="text-xs">16:9</SelectItem>
              <SelectItem value="21/9" className="text-xs">21:9 (cinematic)</SelectItem>
              <SelectItem value="3/2" className="text-xs">3:2</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </PanelSection>

      <PanelSection title="Call to action" defaultOpen>
        <Field label="CTA text">
          <Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Schedule a demo" />
        </Field>
        <CtaActionConfigSection
          value={props as CtaSuiteFields}
          onChange={(v) => onChange({ ...props, ...v } as DsoMinimalHeroBlockProps)}
          allowedActions={CTA_ACTIONS}
          hideModalConfig
          {...ctaSource}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Button color" value={props.ctaButtonColor ?? ""} onChange={(v) => update({ ctaButtonColor: v || undefined })} />
          <ColorField label="Button text" value={props.ctaButtonTextColor ?? ""} onChange={(v) => update({ ctaButtonTextColor: v || undefined })} />
        </div>
        <CtaSecondaryConfigSection
          value={props as CtaSecondaryFields}
          onChange={(v) => onChange({ ...props, ...v } as DsoMinimalHeroBlockProps)}
          allowedActions={CTA_ACTIONS}
          labelPlaceholder="See how it works"
        />
        {(props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper" ||
          props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={
              props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
                ? props.ctaAction
                : (props.ctaSecondaryAction as "modal-form" | "modal-chilipiper")
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </PanelSection>

      <PanelSection title={`Numbers (${stats.length} of 4)`} hint="Optional hairline row under the media">
        {stats.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Number {i + 1}</span>
              <button type="button" onClick={() => setStats(stats.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={s.value} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} placeholder="50%" className="h-7 text-xs" />
              <Input value={s.label} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="Fewer denture appointments" className="h-7 text-xs" />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={stats.length >= 4} onClick={() => setStats([...stats, { value: "", label: "" }])}><Plus className="w-3 h-3" /> Add number</Button>
      </PanelSection>

      <PanelSection title="Nav and surface">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Built-in nav (logo + button)</Label>
          <Switch checked={props.showNav !== false} onCheckedChange={(v) => update({ showNav: v })} />
        </div>
        <Field label="Nav button text (defaults to the CTA text)">
          <Input value={props.navCtaText ?? ""} onChange={(e) => update({ navCtaText: e.target.value })} className="h-8 text-xs" placeholder="Schedule a demo" />
        </Field>
        <Field label="Nav edge gutter (px)">
          <Input type="number" min={8} max={96} value={props.navGutter ?? 20} onChange={(e) => update({ navGutter: Math.max(8, Math.min(96, parseInt(e.target.value, 10) || 20)) })} className="h-8 w-24 text-xs" />
        </Field>
        <Field label="Background">
          <Select value={props.backgroundStyle ?? "white"} onValueChange={(v) => update({ backgroundStyle: v as BackgroundStyle })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{BG_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </PanelSection>
    </div>
  );
}
