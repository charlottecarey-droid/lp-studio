import type { KineticTypeHeroBlockProps } from "@/blocks/BlockKineticTypeHero";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/** BlockKineticTypeHero renders all five actions for both CTAs (incl. video). */
const KINETIC_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

interface Props {
  props: KineticTypeHeroBlockProps;
  onChange: (props: KineticTypeHeroBlockProps) => void;
  /** CTA source indicator + inherit/override controls (Phase 2). */
  ctaSource?: CtaSourceProps;
}

export function KineticTypeHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<KineticTypeHeroBlockProps>) =>
    onChange({ ...props, ...patch });

  // ── Marquee phrase editor ──
  const phrases = props.marqueePhrases ?? [];
  const updatePhrase = (i: number, value: string) =>
    update({ marqueePhrases: phrases.map((p, idx) => (idx === i ? value : p)) });
  const addPhrase = () => update({ marqueePhrases: [...phrases, "New phrase"] });
  const removePhrase = (i: number) =>
    update({ marqueePhrases: phrases.filter((_, idx) => idx !== i) });

  const wordCount = (props.headline ?? "").split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* ── Content ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Content
        </div>
        <BlockRefreshButton
          blockType="kinetic-type-hero"
          fields={["kicker", "headline", "subheadline", "ctaText"]}
          values={{
            kicker: props.kicker ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<KineticTypeHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Kicker (overline)</Label>
          <AiTextField
            type="input"
            value={props.kicker ?? ""}
            onChange={(v) => update({ kicker: v })}
            placeholder="A new era of work"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("kinetic-type-hero", "kicker", props.kicker ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Kicker"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline ?? ""}
            onChange={(v) => update({ headline: v })}
            placeholder="Make something people remember"
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("kinetic-type-hero", "headline", props.headline ?? "", { kicker: props.kicker ?? "", subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Accent word index (0–{Math.max(0, wordCount - 1)}, blank = last)
            </Label>
            <Input
              type="number"
              min={-1}
              max={Math.max(0, wordCount - 1)}
              value={props.accentWordIndex ?? ""}
              onChange={(e) =>
                update({
                  accentWordIndex:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="last"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Accent style</Label>
            <Select
              value={props.accentStyle ?? "italic"}
              onValueChange={(v) => update({ accentStyle: v as KineticTypeHeroBlockProps["accentStyle"] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="italic" className="text-xs">Italic</SelectItem>
                <SelectItem value="underline" className="text-xs">Underline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField
            value={props.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            placeholder="The design-grade platform for teams who care how it feels…"
            rows={3}
            className="text-xs"
            onSuggest={() => suggestCopy("kinetic-type-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
      </div>

      {/* ── Marquee strip ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Marquee strip
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show marquee</Label>
          <Switch
            checked={props.showMarquee !== false}
            onCheckedChange={(checked) => update({ showMarquee: checked })}
          />
        </div>
        {props.showMarquee !== false && (
          <>
            {phrases.map((phrase, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={phrase}
                  onChange={(e) => updatePhrase(i, e.target.value)}
                  className="text-xs h-7 flex-1"
                  placeholder="Short phrase"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0"
                  onClick={() => removePhrase(i)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addPhrase}>
              <Plus className="w-3.5 h-3.5" /> Add phrase
            </Button>
          </>
        )}
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
            placeholder="Start building"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("kinetic-type-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="CTA text"
          />
        </div>
        {/* Shared primary CTA action suite; single shared modal config below. */}
        <CtaActionConfigSection
          value={props as CtaSuiteFields}
          onChange={(v) => onChange({ ...props, ...v } as KineticTypeHeroBlockProps)}
          allowedActions={KINETIC_CTA_ACTIONS}
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
          onChange={(v) => onChange({ ...props, ...v } as KineticTypeHeroBlockProps)}
          allowedActions={KINETIC_CTA_ACTIONS}
          labelPlaceholder="Talk to us"
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
            value={props.theme ?? "light"}
            onValueChange={(v) => update({ theme: v as KineticTypeHeroBlockProps["theme"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light" className="text-xs">Light</SelectItem>
              <SelectItem value="dark" className="text-xs">Dark</SelectItem>
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
