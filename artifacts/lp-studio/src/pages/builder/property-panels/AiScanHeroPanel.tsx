import type { AiScanHeroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import type { CtaSuiteFields, CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";

/** Full standard action suite for the AI-scan hero CTAs. */
const AI_SCAN_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

interface Props {
  props: AiScanHeroBlockProps;
  onChange: (props: AiScanHeroBlockProps) => void;
  /** CTA source indicator + inherit/override controls. */
  ctaSource?: CtaSourceProps;
}

export function AiScanHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<AiScanHeroBlockProps>) =>
    onChange({ ...props, ...patch });

  const showModalConfig =
    props.ctaAction === "modal-form" ||
    props.ctaAction === "modal-chilipiper" ||
    props.ctaSecondaryAction === "modal-form" ||
    props.ctaSecondaryAction === "modal-chilipiper";

  const modalConfigAction: "modal-form" | "modal-chilipiper" =
    props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
      ? props.ctaAction
      : props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper"
        ? props.ctaSecondaryAction
        : "modal-form";

  const headlineScale = props.headlineScale ?? 1;

  return (
    <div className="space-y-5">
      {/* ── Content ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField
            type="input"
            value={props.eyebrow ?? ""}
            onChange={(v) => update({ eyebrow: v })}
            placeholder="AI Scan Review"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("ai-scan-hero", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Eyebrow"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("ai-scan-hero", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Body</Label>
          <AiTextField
            value={props.body ?? ""}
            onChange={(v) => update({ body: v })}
            rows={3}
            className="text-xs"
            placeholder="Leave blank to hide"
            onSuggest={() => suggestCopy("ai-scan-hero", "body", props.body ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Body"
          />
        </div>
      </div>

      {/* ── Media ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image (fallback when no video)</Label>
          <ImagePicker
            value={props.imageUrl ?? ""}
            onChange={(v) => update({ imageUrl: v })}
            placeholder="Upload or paste image URL"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image alt text</Label>
          <Input
            value={props.imageAlt ?? ""}
            onChange={(e) => update({ imageAlt: e.target.value })}
            placeholder="Describe the image for accessibility"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <VideoPicker
            label="Video"
            value={props.backgroundVideoUrl ?? ""}
            onChange={(v) => update({ backgroundVideoUrl: v || undefined })}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Plays silently on a loop. Leave empty to show the image instead.</p>
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>

        {/* Primary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Primary CTA</div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Text</Label>
            <AiTextField
              type="input"
              value={props.ctaText ?? ""}
              onChange={(v) => update({ ctaText: v })}
              placeholder="Get started"
              className="h-8 text-xs"
              onSuggest={() => suggestCopy("ai-scan-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })}
              fieldLabel="CTA text"
            />
          </div>
          <CtaActionConfigSection
            value={props as CtaSuiteFields}
            onChange={(v) => onChange({ ...props, ...v } as AiScanHeroBlockProps)}
            allowedActions={AI_SCAN_CTA_ACTIONS}
            hideModalConfig
            {...ctaSource}
          />
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="Button color"
              value={props.ctaButtonColor ?? ""}
              onChange={(v) => update({ ctaButtonColor: v || undefined })}
            />
            <ColorField
              label="Button text"
              value={props.ctaButtonTextColor ?? ""}
              onChange={(v) => update({ ctaButtonTextColor: v || undefined })}
            />
          </div>
        </div>

        {/* Secondary CTA — shared section (label + action + destination). */}
        <CtaSecondaryConfigSection
          value={props as CtaSecondaryFields}
          onChange={(v) => onChange({ ...props, ...v } as AiScanHeroBlockProps)}
          allowedActions={AI_SCAN_CTA_ACTIONS}
          labelPlaceholder="Leave blank to hide"
        />

        {showModalConfig && (
          <CtaButtonModalConfigSection
            ctaAction={modalConfigAction}
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      {/* ── Style ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline size ({headlineScale.toFixed(2)}×)</Label>
          <input
            type="range"
            min={0.7}
            max={1.6}
            step={0.05}
            value={headlineScale}
            onChange={(e) => update({ headlineScale: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="Background"
            value={props.bgColor ?? ""}
            onChange={(v) => update({ bgColor: v || undefined })}
          />
          <ColorField
            label="Text"
            value={props.textColor ?? ""}
            onChange={(v) => update({ textColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => update({ accentColor: v || undefined })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline font</Label>
          <FontSelect
            value={props.headlineFont}
            onChange={(v) => update({ headlineFont: v })}
            inheritLabel="Inherit from brand (display)"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Body font</Label>
          <FontSelect
            value={props.bodyFont}
            onChange={(v) => update({ bodyFont: v })}
            inheritLabel="Inherit from brand (body)"
          />
        </div>
      </div>
    </div>
  );
}
