import type { BentoMosaicHeroBlockProps } from "@/blocks/BlockBentoMosaicHero";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import type { CtaSuiteFields, CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";

/** BlockBentoMosaicHero renders all five actions for both CTAs (incl. video). */
const BENTO_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

interface Props {
  props: BentoMosaicHeroBlockProps;
  onChange: (props: BentoMosaicHeroBlockProps) => void;
  /** CTA source indicator + inherit/override controls (Phase 2). */
  ctaSource?: CtaSourceProps;
}

const ACCENT_ICON_OPTIONS = [
  "Sparkles",
  "Zap",
  "Shield",
  "Rocket",
  "Gauge",
  "Globe",
  "Heart",
  "Star",
  "Layers",
  "BarChart3",
  "CheckCircle2",
];

export function BentoMosaicHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<BentoMosaicHeroBlockProps>) =>
    onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      {/* ── Content ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Content
        </div>
        <BlockRefreshButton
          blockType="bento-mosaic-hero"
          fields={["eyebrow", "headline", "subheadline", "ctaText"]}
          values={{
            eyebrow: props.eyebrow ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<BentoMosaicHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField
            type="input"
            value={props.eyebrow ?? ""}
            onChange={(v) => update({ eyebrow: v })}
            placeholder="Meet the new standard"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("bento-mosaic-hero", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Eyebrow"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline ?? ""}
            onChange={(v) => update({ headline: v })}
            placeholder="Everything your team ships, in one place"
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("bento-mosaic-hero", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField
            value={props.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            placeholder="Plan, build, and measure in a single workspace…"
            rows={3}
            className="text-xs"
            onSuggest={() => suggestCopy("bento-mosaic-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
      </div>

      {/* ── Mosaic tiles ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Mosaic tiles
        </div>

        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Image tile</div>
          <ImagePicker
            value={props.imageTileUrl ?? ""}
            onChange={(v) => update({ imageTileUrl: v || undefined })}
            placeholder="Upload or paste image URL"
          />
          <div>
            <Label className="text-[11px] text-muted-foreground">Alt text</Label>
            <Input
              value={props.imageTileAlt ?? ""}
              onChange={(e) => update({ imageTileAlt: e.target.value })}
              placeholder="Product preview"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Stat tile</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Value</Label>
              <Input
                value={props.statValue ?? ""}
                onChange={(e) => update({ statValue: e.target.value })}
                placeholder="4.9×"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Label</Label>
              <Input
                value={props.statLabel ?? ""}
                onChange={(e) => update({ statLabel: e.target.value })}
                placeholder="faster from idea to launch"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Accent tile</div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Icon</Label>
            <Select
              value={props.accentIcon ?? "Sparkles"}
              onValueChange={(v) => update({ accentIcon: v })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCENT_ICON_OPTIONS.map((name) => (
                  <SelectItem key={name} value={name} className="text-xs">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Phrase</Label>
            <Input
              value={props.accentPhrase ?? ""}
              onChange={(e) => update({ accentPhrase: e.target.value })}
              placeholder="Automations that clear your busywork"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Testimonial tile</div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Quote</Label>
            <AiTextField
              value={props.quoteText ?? ""}
              onChange={(v) => update({ quoteText: v })}
              placeholder="We replaced four tools in a week…"
              rows={2}
              className="text-xs"
              onSuggest={() => suggestCopy("bento-mosaic-hero", "quoteText", props.quoteText ?? "", { headline: props.headline ?? "" })}
              fieldLabel="Quote"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Name</Label>
              <Input
                value={props.quoteAuthor ?? ""}
                onChange={(e) => update({ quoteAuthor: e.target.value })}
                placeholder="Maya Chen"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Role</Label>
              <Input
                value={props.quoteRole ?? ""}
                onChange={(e) => update({ quoteRole: e.target.value })}
                placeholder="Head of Product, Arclight"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Call to action
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA text</Label>
          <AiTextField
            type="input"
            value={props.ctaText ?? ""}
            onChange={(v) => update({ ctaText: v })}
            placeholder="Get started"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("bento-mosaic-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="CTA text"
          />
        </div>
        {/* Shared primary CTA action suite. Single shared modal config rendered
            once below (hideModalConfig). */}
        <CtaActionConfigSection
          value={props as CtaSuiteFields}
          onChange={(v) => onChange({ ...props, ...v } as BentoMosaicHeroBlockProps)}
          allowedActions={BENTO_CTA_ACTIONS}
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

        {/* Secondary CTA — shared section (incl. Play video in modal). */}
        <CtaSecondaryConfigSection
          value={props as CtaSecondaryFields}
          onChange={(v) => onChange({ ...props, ...v } as BentoMosaicHeroBlockProps)}
          allowedActions={BENTO_CTA_ACTIONS}
          labelPlaceholder="See it in action"
        />

        {/* Shared modal config */}
        {(props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper" ||
          props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={
              (props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper")
                ? props.ctaAction
                : (props.ctaSecondaryAction as "modal-form" | "modal-chilipiper")
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      {/* ── Style ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Style
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Theme</Label>
          <Select
            value={props.theme ?? "dark"}
            onValueChange={(v) => update({ theme: v as BentoMosaicHeroBlockProps["theme"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dark" className="text-xs">Dark (glass tiles)</SelectItem>
              <SelectItem value="light" className="text-xs">Light (soft-shadow tiles)</SelectItem>
            </SelectContent>
          </Select>
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
