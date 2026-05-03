import type {
  EditorialCarouselBlockProps,
  EditorialCarouselSlide,
} from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { ColorField } from "./BlockSettingsPanel";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { FONT_CATALOG } from "@/lib/font-catalog";

// Group catalog fonts by category for the panel's font dropdowns. Display
// fonts come first since headline pickers usually want them.
const FONT_GROUPS: Array<{ label: string; fonts: typeof FONT_CATALOG }> = [
  { label: "Display", fonts: FONT_CATALOG.filter((f) => f.category === "display") },
  { label: "Serif", fonts: FONT_CATALOG.filter((f) => f.category === "serif") },
  { label: "Sans-serif", fonts: FONT_CATALOG.filter((f) => f.category === "sans") },
  { label: "Monospace", fonts: FONT_CATALOG.filter((f) => f.category === "mono") },
];

function FontSelect({
  value,
  onChange,
  inheritLabel,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  inheritLabel: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
    >
      <option value="">{inheritLabel}</option>
      {FONT_GROUPS.map((group) =>
        group.fonts.length === 0 ? null : (
          <optgroup key={group.label} label={group.label}>
            {group.fonts.map((f) => (
              <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.label || f.family}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}

interface Props {
  props: EditorialCarouselBlockProps;
  onChange: (props: EditorialCarouselBlockProps) => void;
}

const BLANK_SLIDE: EditorialCarouselSlide = {
  src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&h=675&fit=crop",
  alt: "",
  caption: "New slide",
};

export function EditorialCarouselPanel({ props, onChange }: Props) {
  const slides = props.slides ?? [];
  const mode = props.mode || "image";
  const isCaseStudy = mode === "case-study";
  const update = (patch: Partial<EditorialCarouselBlockProps>) => onChange({ ...props, ...patch });

  const updateSlide = (i: number, patch: Partial<EditorialCarouselSlide>) =>
    update({ slides: slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const moveSlide = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = slides.slice();
    const [m] = next.splice(i, 1);
    next.splice(j, 0, m);
    update({ slides: next });
  };
  const removeSlide = (i: number) => update({ slides: slides.filter((_, idx) => idx !== i) });
  const addSlide = () =>
    update({
      slides: [
        ...slides,
        isCaseStudy
          ? {
              ...BLANK_SLIDE,
              caption: undefined,
              headline: "New case study",
              subheadline: "Short supporting line about the result.",
              ctaText: "Read the story",
            }
          : { ...BLANK_SLIDE },
      ],
    });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Header (optional)</div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Leave blank for a clean carousel-only section.
        </p>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={(e) => update({ eyebrow: e.target.value })}
            placeholder="MOMENTS FROM THE SUMMIT"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Textarea
            value={props.headline ?? ""}
            onChange={(e) => update({ headline: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <Textarea
            value={props.subheadline ?? ""}
            onChange={(e) => update({ subheadline: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slide content</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Mode</Label>
          <Select
            value={mode}
            onValueChange={(v) => update({ mode: v as EditorialCarouselBlockProps["mode"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image" className="text-xs">Image carousel (caption only)</SelectItem>
              <SelectItem value="case-study" className="text-xs">Case study (headline + CTA)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            Image mode shows the small uppercase caption. Case-study mode adds
            a headline, subheadline, optional CTA chip and a clickable slide.
          </p>
        </div>
        {isCaseStudy && (
          <>
            <div>
              <Label className="text-[11px] text-muted-foreground">Layout</Label>
              <Select
                value={props.layout || "overlay-scrim"}
                onValueChange={(v) => update({ layout: v as EditorialCarouselBlockProps["layout"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overlay" className="text-xs">Full-bleed image, text overlay</SelectItem>
                  <SelectItem value="overlay-scrim" className="text-xs">Full-bleed image, text overlay + readability scrim</SelectItem>
                  <SelectItem value="split" className="text-xs">Split — image one side, text card on the other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[11px] text-muted-foreground">Headline size</Label>
                  <span className="text-[10px] text-muted-foreground">{(props.headlineSize ?? 2.25).toFixed(2)}rem</span>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={0.125}
                  value={[props.headlineSize ?? 2.25]}
                  onValueChange={([v]) => update({ headlineSize: v })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[11px] text-muted-foreground">Subheadline size</Label>
                  <span className="text-[10px] text-muted-foreground">{(props.subheadlineSize ?? 1).toFixed(2)}rem</span>
                </div>
                <Slider
                  min={0.625}
                  max={2}
                  step={0.0625}
                  value={[props.subheadlineSize ?? 1]}
                  onValueChange={([v]) => update({ subheadlineSize: v })}
                />
              </div>
            </div>
            {props.layout === "split" && (
              <div>
                <ColorField
                  label="Text card background"
                  value={props.cardBgColor ?? ""}
                  onChange={(v) => update({ cardBgColor: v || undefined })}
                />
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  Leave blank to derive from the section background.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Carousel behavior</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Aspect ratio</Label>
            <Select
              value={props.aspect ?? "16/9"}
              onValueChange={(v) => update({ aspect: v as EditorialCarouselBlockProps["aspect"] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="16/9" className="text-xs">16 : 9 (cinema)</SelectItem>
                <SelectItem value="3/2" className="text-xs">3 : 2 (photo)</SelectItem>
                <SelectItem value="4/3" className="text-xs">4 : 3</SelectItem>
                <SelectItem value="1/1" className="text-xs">1 : 1 (square)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-5">
            <Label className="text-[11px] text-muted-foreground">Rounded corners</Label>
            <Switch
              checked={!!props.rounded}
              onCheckedChange={(v) => update({ rounded: v })}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[11px] text-muted-foreground">Slide width (desktop)</Label>
            <span className="text-[10px] text-muted-foreground">{props.slideWidthPct ?? 60}%</span>
          </div>
          <Slider
            min={30}
            max={95}
            step={5}
            value={[props.slideWidthPct ?? 60]}
            onValueChange={([v]) => update({ slideWidthPct: v })}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Lower = more peek of neighbouring slides.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Auto-advance</Label>
          <Switch
            checked={props.autoplay !== false}
            onCheckedChange={(v) => update({ autoplay: v })}
          />
        </div>
        {props.autoplay !== false && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[11px] text-muted-foreground">Auto-advance interval</Label>
              <span className="text-[10px] text-muted-foreground">{((props.autoplayInterval ?? 5000) / 1000).toFixed(1)}s</span>
            </div>
            <Slider
              min={2000}
              max={10000}
              step={500}
              value={[props.autoplayInterval ?? 5000]}
              onValueChange={([v]) => update({ autoplayInterval: v })}
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Leave blank to inherit your brand colors (primary / accent / text / border).
        </p>
        <div className="grid grid-cols-2 gap-2">
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
          <ColorField
            label="Border"
            value={props.borderColor ?? ""}
            onChange={(v) => update({ borderColor: v || undefined })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fonts</div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Pick a font from the curated catalog. Selected Google Fonts are
          loaded automatically. Leave on "Inherit from brand" to follow the
          tenant's brand fonts.
        </p>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline font</Label>
          <FontSelect
            value={props.headlineFont}
            onChange={(v) => update({ headlineFont: v })}
            inheritLabel="Inherit from brand (display)"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Body font (eyebrow, copy, captions)</Label>
          <FontSelect
            value={props.bodyFont}
            onChange={(v) => update({ bodyFont: v })}
            inheritLabel="Inherit from brand (body)"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Slides ({slides.length})
          </div>
        </div>
        <div className="space-y-2">
          {slides.map((slide, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-muted-foreground flex-1">Slide {i + 1}</div>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveSlide(i, -1)} title="Move up">
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === slides.length - 1} onClick={() => moveSlide(i, 1)} title="Move down">
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeSlide(i)} title="Delete slide">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <ImagePicker
                value={slide.src}
                onChange={(v) => updateSlide(i, { src: v })}
                placeholder="Upload or paste image URL"
              />
              <Input
                value={slide.alt ?? ""}
                onChange={(e) => updateSlide(i, { alt: e.target.value })}
                placeholder="Alt text (accessibility)"
                className="h-8 text-xs"
              />
              {isCaseStudy ? (
                <>
                  <Input
                    value={slide.headline ?? ""}
                    onChange={(e) => updateSlide(i, { headline: e.target.value })}
                    placeholder="Headline"
                    className="h-8 text-xs"
                  />
                  <Textarea
                    value={slide.subheadline ?? ""}
                    onChange={(e) => updateSlide(i, { subheadline: e.target.value })}
                    placeholder="Subheadline"
                    rows={2}
                    className="text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={slide.ctaText ?? ""}
                      onChange={(e) => updateSlide(i, { ctaText: e.target.value })}
                      placeholder="CTA text (optional)"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={slide.linkUrl ?? ""}
                      onChange={(e) => updateSlide(i, { linkUrl: e.target.value })}
                      placeholder="Slide link URL"
                      className="h-8 text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    The whole slide becomes clickable when a link URL is set.
                  </p>
                </>
              ) : (
                <Input
                  value={slide.caption ?? ""}
                  onChange={(e) => updateSlide(i, { caption: e.target.value })}
                  placeholder="Caption (small uppercase)"
                  className="h-8 text-xs"
                />
              )}
            </div>
          ))}
          {slides.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-2">
              No slides yet — add one below.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addSlide}>
          <Plus className="w-3 h-3 mr-1.5" /> Add slide
        </Button>
      </div>
    </div>
  );
}
