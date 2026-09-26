import type { GlowVideoHeroBlockProps } from "@/blocks/BlockGlowVideoHero";
import type { SocialProofLogo } from "@/lib/block-types";
import type { CtaSuiteFields, CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { IconPicker } from "@/components/IconPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { Field, GlowColorFields, ItemHeader, MediaOptionsFields, MediaSlotFields, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Plus } from "lucide-react";

const CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

interface Props {
  props: GlowVideoHeroBlockProps;
  onChange: (props: GlowVideoHeroBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function GlowVideoHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<GlowVideoHeroBlockProps>) => onChange({ ...props, ...patch });
  const logos = props.logos ?? [];
  const setLogos = (next: SocialProofLogo[]) => update({ logos: next });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="glow-video-hero"
        fields={["eyebrow", "headline", "subheadline", "ctaText"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Eyebrow">
          <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" placeholder="Short positioning line" />
        </Field>
        <IconPicker label="Eyebrow icon" value={props.eyebrowIcon ?? ""} onChange={(v) => update({ eyebrowIcon: v })} aiHint="Small brand mark" />
        <Field label="Headline">
          <AiTextField
            value={props.headline ?? ""}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("glow-video-hero", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })}
            fieldLabel="Headline"
          />
        </Field>
        <Field label="Subheadline">
          <Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" />
        </Field>
        <Field label="Alignment">
          <Select value={props.align ?? "center"} onValueChange={(v) => update({ align: v as "center" | "left" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center" className="text-xs">Centered</SelectItem>
              <SelectItem value="left" className="text-xs">Left</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </PanelSection>

      <PanelSection title="Hero video / graphic" hint="The big panel under the headline" defaultOpen>
        <MediaSlotFields
          value={{ videoUrl: props.mediaVideoUrl, imageUrl: props.mediaImageUrl, imageAlt: props.mediaImageAlt }}
          onChange={(p) =>
            update({
              ...(p.videoUrl !== undefined ? { mediaVideoUrl: p.videoUrl } : {}),
              ...(p.imageUrl !== undefined ? { mediaImageUrl: p.imageUrl } : {}),
              ...(p.imageAlt !== undefined ? { mediaImageAlt: p.imageAlt } : {}),
            })
          }
        />
        <MediaOptionsFields
          value={{ mediaBlend: props.mediaBlend, mediaEdgeFade: props.mediaEdgeFade, mediaAspect: props.mediaAspect }}
          onChange={(p) => update(p)}
        />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">"Play with sound" pill (native video)</Label>
          <Switch checked={!!props.showSoundToggle} onCheckedChange={(c) => update({ showSoundToggle: c })} />
        </div>
        {props.showSoundToggle && (
          <Input value={props.soundToggleLabel ?? ""} onChange={(e) => update({ soundToggleLabel: e.target.value })} placeholder="Play with sound" className="h-8 text-xs" />
        )}
      </PanelSection>

      <PanelSection title="Call to action" defaultOpen>
        <Field label="CTA text">
          <Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Get started" />
        </Field>
        <CtaActionConfigSection
          value={props as CtaSuiteFields}
          onChange={(v) => onChange({ ...props, ...v } as GlowVideoHeroBlockProps)}
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
          onChange={(v) => onChange({ ...props, ...v } as GlowVideoHeroBlockProps)}
          allowedActions={CTA_ACTIONS}
          labelPlaceholder="See a demo"
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

      <PanelSection title={`Trusted-by logos (${logos.length})`} hint="Optional row under the video">
        <Field label="Row label">
          <Input value={props.logosLabel ?? ""} onChange={(e) => update({ logosLabel: e.target.value })} className="h-8 text-xs" placeholder="Trusted by teams at" />
        </Field>
        <div className="space-y-2">
          {logos.map((logo, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader
                label={logo.name || `Logo ${i + 1}`}
                index={i}
                total={logos.length}
                onMove={(dir) => setLogos(moveItem(logos, i, dir))}
                onRemove={() => setLogos(logos.filter((_, idx) => idx !== i))}
              />
              <Input value={logo.name} onChange={(e) => setLogos(logos.map((l, idx) => (idx === i ? { ...l, name: e.target.value } : l)))} placeholder="Company name (shown as text when no image)" className="h-8 text-xs" />
              <ImagePicker value={logo.imageUrl ?? ""} onChange={(url) => setLogos(logos.map((l, idx) => (idx === i ? { ...l, imageUrl: url || undefined } : l)))} placeholder="Logo image (optional)" />
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setLogos([...logos, { name: "New logo" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add logo
        </Button>
      </PanelSection>

      <PanelSection title="Colors">
        <GlowColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}
