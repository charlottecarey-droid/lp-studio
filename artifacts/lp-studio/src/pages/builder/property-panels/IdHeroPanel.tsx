import type { IdHeroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ImagePicker } from "@/components/ImagePicker";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { readPrimarySuite, writePrimarySuite, readSecondary, writeSecondary, type PrimaryKeyMap, type SecondaryKeyMap } from "@/lib/cta/ctaKeyMap";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";

/** This block stores its CTAs under cta1* / cta2* names; map them to the canonical
 *  shape the shared sections operate on. Action values already match IdCtaAction. */
const ID_HERO_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;
const ID_HERO_PRIMARY_MAP: PrimaryKeyMap = {
  action: "cta1Action",
  url: "cta1Url",
  chilipiper: "cta1ChilipiperUrl",
  video: "cta1VideoUrl",
};
const ID_HERO_SECONDARY_MAP: SecondaryKeyMap = {
  text: "cta2Text",
  action: "cta2Action",
  url: "cta2Url",
  chilipiper: "cta2ChilipiperUrl",
  video: "cta2VideoUrl",
};

interface Props {
  props: IdHeroBlockProps;
  onChange: (props: IdHeroBlockProps) => void;
  /** CTA source indicator + inherit/override controls (Phase 2). */
  ctaSource?: CtaSourceProps;
}

export function IdHeroPanel({ props, onChange, ctaSource }: Props) {
  const u = (patch: Partial<IdHeroBlockProps>) => onChange({ ...props, ...patch });
  const cta1Action = props.cta1Action ?? "url";
  const cta2Action = props.cta2Action ?? "url";
  const anyModal =
    cta1Action === "modal-form" || cta1Action === "modal-chilipiper" ||
    cta2Action === "modal-form" || cta2Action === "modal-chilipiper";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 1</Label>
          <Input value={props.line1 ?? ""} onChange={(e) => u({ line1: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 2</Label>
          <Input value={props.line2 ?? ""} onChange={(e) => u({ line2: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 3 (use &lt;em&gt;…&lt;/em&gt; for accent)</Label>
          <Input value={props.line3 ?? ""} onChange={(e) => u({ line3: e.target.value })} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Lead paragraph</Label>
          <Textarea value={props.lead ?? ""} onChange={(e) => u({ lead: e.target.value })} rows={3} className="text-xs" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTAs</div>
        <div className="border rounded-md p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Primary CTA</div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Button text</Label>
            <Input value={props.cta1Text ?? ""} onChange={(e) => u({ cta1Text: e.target.value })} className="h-8 text-xs" />
          </div>
          {/* Shared primary action suite (mapped to cta1* keys); single shared modal block below. */}
          <CtaActionConfigSection
            value={readPrimarySuite(props, ID_HERO_PRIMARY_MAP)}
            onChange={(v) => onChange(writePrimarySuite(props, v, ID_HERO_PRIMARY_MAP) as IdHeroBlockProps)}
            allowedActions={ID_HERO_CTA_ACTIONS}
            hideModalConfig
            {...ctaSource}
          />
        </div>
        {/* Shared secondary section, mapped to this block's cta2* keys. */}
        <CtaSecondaryConfigSection
          value={readSecondary(props, ID_HERO_SECONDARY_MAP)}
          onChange={(v) => onChange(writeSecondary(props, v, ID_HERO_SECONDARY_MAP) as IdHeroBlockProps)}
          allowedActions={ID_HERO_CTA_ACTIONS}
        />
        {anyModal && (
          <CtaButtonModalConfigSection
            ctaAction={
              (cta1Action === "modal-chilipiper" || cta2Action === "modal-chilipiper")
                ? "modal-chilipiper"
                : "modal-form"
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Content alignment</Label>
          <Select
            value={props.align ?? "center"}
            onValueChange={(v) => u({ align: v as "center" | "left" })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center" className="text-xs">Center</SelectItem>
              <SelectItem value="left" className="text-xs">Left</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Headline size</Label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {Math.round((props.headlineScale ?? 1) * 100)}%
            </span>
          </div>
          <Slider
            min={0.5}
            max={1.5}
            step={0.05}
            value={[props.headlineScale ?? 1]}
            onValueChange={(v) => u({ headlineScale: v[0] })}
          />
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            Shrink the headline if a long word gets clipped on the right.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edge fades</div>
        <p className="text-[10px] text-muted-foreground leading-snug -mt-1">
          Optional soft gradient overlays that let the hero blend into the block above or below. Set the color to match the neighboring section.
        </p>

        {/* Top fade */}
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={!!props.fadeTop}
            onChange={(e) => u({ fadeTop: e.target.checked || undefined })}
          />
          <span className="font-medium">Top fade</span>
        </label>
        {props.fadeTop && (
          <div className="pl-5 space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground w-12 shrink-0">Color</Label>
              <input
                type="color"
                value={(props.fadeTopColor || "#000000").slice(0, 7)}
                onChange={(e) => u({ fadeTopColor: e.target.value })}
                className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={props.fadeTopColor ?? ""}
                onChange={(e) => u({ fadeTopColor: e.target.value })}
                placeholder="#000000 or transparent"
                className="h-7 text-[11px] font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Height</Label>
                <span className="text-[11px] font-mono text-muted-foreground">{props.fadeTopHeight ?? 160}px</span>
              </div>
              <Slider min={20} max={500} step={10} value={[props.fadeTopHeight ?? 160]} onValueChange={(v) => u({ fadeTopHeight: v[0] })} />
            </div>
          </div>
        )}

        {/* Bottom fade */}
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={!!props.fadeBottom}
            onChange={(e) => u({ fadeBottom: e.target.checked || undefined })}
          />
          <span className="font-medium">Bottom fade</span>
        </label>
        {props.fadeBottom && (
          <div className="pl-5 space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground w-12 shrink-0">Color</Label>
              <input
                type="color"
                value={(props.fadeBottomColor || "#000000").slice(0, 7)}
                onChange={(e) => u({ fadeBottomColor: e.target.value })}
                className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={props.fadeBottomColor ?? ""}
                onChange={(e) => u({ fadeBottomColor: e.target.value })}
                placeholder="#000000 or transparent"
                className="h-7 text-[11px] font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Height</Label>
                <span className="text-[11px] font-mono text-muted-foreground">{props.fadeBottomHeight ?? 200}px</span>
              </div>
              <Slider min={20} max={500} step={10} value={[props.fadeBottomHeight ?? 200]} onValueChange={(v) => u({ fadeBottomHeight: v[0] })} />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background image</div>
        <ImagePicker value={props.bgImage ?? ""} onChange={(v) => u({ bgImage: v || undefined })} placeholder="Upload or paste a URL" />
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Image brightness</Label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {Math.round((props.bgBrightness ?? 0.88) * 100)}%
            </span>
          </div>
          <Slider
            min={0.3}
            max={1.5}
            step={0.02}
            value={[props.bgBrightness ?? 0.88]}
            onValueChange={(v) => u({ bgBrightness: v[0] })}
          />
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            Lighten or darken the hero background. 100% = original photo. Lower mutes the image so the headline pops; higher reveals more of the photo.
          </p>
        </div>
      </div>
    </div>
  );
}
