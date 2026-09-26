import type { GlowFinalCtaBlockProps } from "@/blocks/BlockGlowFinalCta";
import type { CtaSuiteFields, CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { Field, GlowColorFields, PanelSection } from "./glow/GlowPanelKit";

const CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

interface Props {
  props: GlowFinalCtaBlockProps;
  onChange: (props: GlowFinalCtaBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function GlowFinalCtaPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<GlowFinalCtaBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="glow-final-cta"
        fields={["headline", "subheadline", "ctaText"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline">
          <AiTextField
            value={props.headline ?? ""}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("glow-final-cta", "headline", props.headline ?? "", {})}
            fieldLabel="Headline"
          />
        </Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Footnote under buttons"><Input value={props.footnote ?? ""} onChange={(e) => update({ footnote: e.target.value })} className="h-8 text-xs" placeholder="No credit card required" /></Field>
      </PanelSection>

      <PanelSection title="Call to action" defaultOpen>
        <Field label="CTA text">
          <Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Get started" />
        </Field>
        <CtaActionConfigSection
          value={props as CtaSuiteFields}
          onChange={(v) => onChange({ ...props, ...v } as GlowFinalCtaBlockProps)}
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
          onChange={(v) => onChange({ ...props, ...v } as GlowFinalCtaBlockProps)}
          allowedActions={CTA_ACTIONS}
          labelPlaceholder="Talk to us"
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

      <PanelSection title="Style">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Glow from the bottom edge</Label>
          <Switch checked={props.showGlow !== false} onCheckedChange={(c) => update({ showGlow: c })} />
        </div>
        <GlowColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}
