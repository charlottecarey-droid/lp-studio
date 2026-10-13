/**
 * Shared property-panel pieces for the abm-* account-page family: the
 * background dropdown + ink overrides every block carries, and the full CTA
 * suite (action dropdown with all five modes, per-action destination, modal
 * config, secondary CTA, button colours) every CTA-bearing block carries.
 */
import type { AbmStyleProps } from "@/lib/abm-theme";
import type { AbmCtaProps } from "@/blocks/abm/AbmCta";
import type { CtaSuiteFields, CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { ColorField } from "../BlockSettingsPanel";
import { SectionBackgroundControl } from "../SectionBackgroundControl";
import { CtaActionConfigSection } from "../CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "../CtaSecondaryConfigSection";
import { CtaButtonModalConfigSection } from "../CtaButtonModalConfigSection";
import { Field, PanelSection } from "../glow/GlowPanelKit";

export const ABM_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

export function AbmStyleFields({ value, onChange, defaultBg = "#FFFFFF" }: { value: AbmStyleProps; onChange: (patch: Partial<AbmStyleProps>) => void; defaultBg?: string }) {
  return (
    <div className="space-y-3">
      <SectionBackgroundControl
        backgroundStyle={value.backgroundStyle}
        bgColor={value.bgColor}
        defaultBgColor={defaultBg}
        onChange={(patch) => onChange(patch)}
      />
      <div className="grid grid-cols-3 gap-2">
        <ColorField label="Headline" value={value.headingColor ?? ""} onChange={(v) => onChange({ headingColor: v || undefined })} />
        <ColorField label="Text" value={value.textColor ?? ""} onChange={(v) => onChange({ textColor: v || undefined })} />
        <ColorField label="Accent" value={value.accentColor ?? ""} onChange={(v) => onChange({ accentColor: v || undefined })} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Blank = brand palette. Inks are contrast-checked against whatever background you pick, so an unreadable override is never applied.
      </p>
    </div>
  );
}

export function AbmCtaFields<T extends AbmCtaProps>({
  value,
  onChange,
  ctaSource,
  primaryPlaceholder = "Request a demo",
  secondaryPlaceholder = "Learn more",
  showColors = true,
}: {
  value: T;
  onChange: (next: T) => void;
  ctaSource?: CtaSourceProps;
  primaryPlaceholder?: string;
  secondaryPlaceholder?: string;
  showColors?: boolean;
}) {
  const update = (patch: Partial<T>) => onChange({ ...value, ...patch });
  const modalOpen =
    value.ctaAction === "modal-form" || value.ctaAction === "modal-chilipiper" ||
    value.ctaSecondaryAction === "modal-form" || value.ctaSecondaryAction === "modal-chilipiper";
  return (
    <div className="space-y-3">
      <Field label="Primary CTA text">
        <Input value={value.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value } as Partial<T>)} className="h-8 text-xs" placeholder={primaryPlaceholder} />
      </Field>
      <CtaActionConfigSection
        value={value as CtaSuiteFields}
        onChange={(v) => onChange({ ...value, ...v })}
        allowedActions={ABM_CTA_ACTIONS}
        hideModalConfig
        {...ctaSource}
      />
      {showColors && (
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Button color" value={value.ctaButtonColor ?? ""} onChange={(v) => update({ ctaButtonColor: v || undefined } as Partial<T>)} />
          <ColorField label="Button text" value={value.ctaButtonTextColor ?? ""} onChange={(v) => update({ ctaButtonTextColor: v || undefined } as Partial<T>)} />
        </div>
      )}
      <CtaSecondaryConfigSection
        value={value as CtaSecondaryFields}
        onChange={(v) => onChange({ ...value, ...v })}
        allowedActions={ABM_CTA_ACTIONS}
        labelPlaceholder={secondaryPlaceholder}
      />
      {modalOpen && (
        <CtaButtonModalConfigSection
          ctaAction={
            value.ctaAction === "modal-form" || value.ctaAction === "modal-chilipiper"
              ? value.ctaAction
              : (value.ctaSecondaryAction as "modal-form" | "modal-chilipiper")
          }
          value={value}
          onChange={(next) => onChange({ ...value, ...next })}
        />
      )}
    </div>
  );
}

/** Convenience wrapper: the style fields in their own collapsible section. */
export function AbmStyleSection({ value, onChange, defaultBg }: { value: AbmStyleProps; onChange: (patch: Partial<AbmStyleProps>) => void; defaultBg?: string }) {
  return (
    <PanelSection title="Background & colors">
      <AbmStyleFields value={value} onChange={onChange} defaultBg={defaultBg} />
    </PanelSection>
  );
}
