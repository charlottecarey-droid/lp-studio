import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { suggestCopy } from "@/lib/copy-api";
import type {
  SpatialTourBlockProps,
  SpatialTourNavLink,
  SpatialTourMarqueeItem,
  SpatialTourStation,
  SpatialTourCalloutPoint,
  SpatialTourWay,
  SpatialTourDate,
} from "@/lib/block-types";

interface Props {
  props: SpatialTourBlockProps;
  onChange: (props: SpatialTourBlockProps) => void;
  brandVoiceSet?: boolean;
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border hover:text-foreground transition-colors"
    >
      {label}
      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SpatialTourPanel({ props: p, onChange, brandVoiceSet }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    nav: true,
    hero: true,
    marquee: false,
    manifesto: false,
    tour: false,
    callout: false,
    ways: false,
    calendar: false,
    footer: false,
  });

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<SpatialTourBlockProps>) => onChange({ ...p, ...patch });

  // Nav links
  const updateNavLink = (i: number, patch: Partial<SpatialTourNavLink>) =>
    set({ navLinks: p.navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const addNavLink = () => set({ navLinks: [...p.navLinks, { label: "Section", href: "#section" }] });
  const removeNavLink = (i: number) => set({ navLinks: p.navLinks.filter((_, idx) => idx !== i) });

  // Marquee
  const updateMarquee = (i: number, patch: Partial<SpatialTourMarqueeItem>) =>
    set({ marqueeItems: p.marqueeItems.map((m, idx) => idx === i ? { ...m, ...patch } : m) });
  const addMarquee = () => set({ marqueeItems: [...p.marqueeItems, { value: "", label: "" }] });
  const removeMarquee = (i: number) => set({ marqueeItems: p.marqueeItems.filter((_, idx) => idx !== i) });

  // Stations
  const updateStation = (i: number, patch: Partial<SpatialTourStation>) =>
    set({ tourStations: p.tourStations.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  const addStation = () => set({
    tourStations: [...p.tourStations, {
      number: String(p.tourStations.length + 1).padStart(2, "0"),
      label: "New station",
      imageUrl: "",
      headline: "",
      body: "",
      insetDuration: "0:00",
      insetDetail: "",
    }],
  });
  const removeStation = (i: number) =>
    set({ tourStations: p.tourStations.filter((_, idx) => idx !== i) });

  // Callout points
  const updateCallout = (i: number, patch: Partial<SpatialTourCalloutPoint>) =>
    set({ calloutPoints: p.calloutPoints.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addCallout = () => set({ calloutPoints: [...p.calloutPoints, { title: "", body: "" }] });
  const removeCallout = (i: number) =>
    set({ calloutPoints: p.calloutPoints.filter((_, idx) => idx !== i) });

  // Four ways
  const updateWay = (i: number, patch: Partial<SpatialTourWay>) =>
    set({ ways: p.ways.map((w, idx) => idx === i ? { ...w, ...patch } : w) });
  const addWay = () => set({
    ways: [...p.ways, {
      number: String(p.ways.length + 1).padStart(2, "0"),
      label: "Way",
      eyebrow: "",
      body: "",
      ctaText: "",
      imageUrl: "",
    }],
  });
  const removeWay = (i: number) => set({ ways: p.ways.filter((_, idx) => idx !== i) });

  // Calendar dates
  const updateDate = (i: number, patch: Partial<SpatialTourDate>) =>
    set({ calendarDates: p.calendarDates.map((d, idx) => idx === i ? { ...d, ...patch } : d) });
  const addDate = () =>
    set({ calendarDates: [...p.calendarDates, { date: "", city: "", event: "", status: "Open" }] });
  const removeDate = (i: number) =>
    set({ calendarDates: p.calendarDates.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-0 p-4">
      <BlockRefreshButton
        blockType="spatial-tour"
        fields={["heroEyebrow", "heroHeadlineLine1", "heroHeadlineLine2", "heroHeadlineEmphasis", "heroHeadlineLine3", "heroBody", "heroPrimaryCta", "heroSecondaryCta"]}
        values={{
          heroEyebrow: p.heroEyebrow ?? "",
          heroHeadlineLine1: p.heroHeadlineLine1 ?? "",
          heroHeadlineLine2: p.heroHeadlineLine2 ?? "",
          heroHeadlineEmphasis: p.heroHeadlineEmphasis ?? "",
          heroHeadlineLine3: p.heroHeadlineLine3 ?? "",
          heroBody: p.heroBody ?? "",
          heroPrimaryCta: p.heroPrimaryCta ?? "",
          heroSecondaryCta: p.heroSecondaryCta ?? "",
        }}
        onApply={(u) => set(u as Partial<SpatialTourBlockProps>)}
      />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <SectionHeader label="Navigation" open={open.nav} onToggle={() => toggle("nav")} />
      {open.nav && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Brand label" hint="Shown next to the wordmark in the nav">
            <AiTextField type="input" value={p.navBrand} onChange={v => set({ navBrand: v })} fieldLabel="Nav Brand" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "navBrand", p.navBrand, {})} />
          </Field>
          <Field label="CTA Button Text">
            <AiTextField type="input" value={p.navCtaText} onChange={v => set({ navCtaText: v })} fieldLabel="Nav CTA Text" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="CTA URL">
            <Input value={p.navCtaUrl} onChange={e => set({ navCtaUrl: e.target.value })} className="text-xs h-8" placeholder="#rsvp" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Nav Links</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addNavLink}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {p.navLinks.map((link, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={link.label} onChange={e => updateNavLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-7 flex-1" />
                <Input value={link.href} onChange={e => updateNavLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeNavLink(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
      {open.hero && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Hero Image" hint="Background photo behind the headline. Also used as the video poster + reduced-motion fallback.">
            <ImagePicker value={p.heroImageUrl} onChange={v => set({ heroImageUrl: v })} />
          </Field>
          <Field label="Hero Video" hint="Optional looping mp4/webm. When set, replaces the static hero with a Ken-Burns video stage + vignette + REC indicator. Leave blank to use the static hero.">
            <VideoPicker value={p.heroVideoUrl ?? ""} onChange={v => set({ heroVideoUrl: v })} />
          </Field>
          <Field
            label={`Image Brightness — ${Math.round(((p.heroMediaBrightness ?? 0.8)) * 100)}%`}
            hint="Lighten or darken the hero photo/video. 100% = original. Lower values mute the image so white headline type pops; higher values reveal more of the underlying photo."
          >
            <Slider
              min={30}
              max={150}
              step={1}
              value={[Math.round(((p.heroMediaBrightness ?? 0.8)) * 100)]}
              onValueChange={(v) => set({ heroMediaBrightness: (v[0] ?? 80) / 100 })}
            />
          </Field>
          <Field label="Eyebrow" hint="Small uppercase text above the headline">
            <AiTextField type="input" value={p.heroEyebrow} onChange={v => set({ heroEyebrow: v })} fieldLabel="Hero Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "heroEyebrow", p.heroEyebrow, {})} />
          </Field>
          <Field label="Headline — Line 1">
            <AiTextField type="input" value={p.heroHeadlineLine1} onChange={v => set({ heroHeadlineLine1: v })} fieldLabel="Headline Line 1" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "heroHeadlineLine1", p.heroHeadlineLine1, {})} />
          </Field>
          <Field label="Headline — Line 2">
            <AiTextField type="input" value={p.heroHeadlineLine2} onChange={v => set({ heroHeadlineLine2: v })} fieldLabel="Headline Line 2" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "heroHeadlineLine2", p.heroHeadlineLine2, {})} />
          </Field>
          <Field label="Headline — Italic Emphasis" hint="Rendered in italic mint accent">
            <AiTextField type="input" value={p.heroHeadlineEmphasis} onChange={v => set({ heroHeadlineEmphasis: v })} fieldLabel="Headline Emphasis" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "heroHeadlineEmphasis", p.heroHeadlineEmphasis, {})} />
          </Field>
          <div className="flex items-center justify-between gap-2 py-1">
            <div className="space-y-0.5">
              <Label className="text-xs">Italic emphasis</Label>
              <p className="text-[11px] text-muted-foreground">Applies to all section headlines.</p>
            </div>
            <Switch
              checked={p.headlineEmphasisItalic ?? true}
              onCheckedChange={(v) => set({ headlineEmphasisItalic: v })}
            />
          </div>
          <Field label="Headline — Line 3">
            <AiTextField type="input" value={p.heroHeadlineLine3} onChange={v => set({ heroHeadlineLine3: v })} fieldLabel="Headline Line 3" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "heroHeadlineLine3", p.heroHeadlineLine3, {})} />
          </Field>
          <Field label="Body Copy">
            <AiTextField type="textarea" value={p.heroBody} onChange={v => set({ heroBody: v })} rows={3} fieldLabel="Hero Body" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "heroBody", p.heroBody, {})} />
          </Field>
          <Field label="Primary CTA Text">
            <AiTextField type="input" value={p.heroPrimaryCta} onChange={v => set({ heroPrimaryCta: v })} fieldLabel="Primary CTA" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Secondary CTA Text">
            <AiTextField type="input" value={p.heroSecondaryCta} onChange={v => set({ heroSecondaryCta: v })} fieldLabel="Secondary CTA" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Vision Pro Chip Text" hint="Pill in top-right corner of hero">
            <AiTextField type="input" value={p.heroVisionChipText} onChange={v => set({ heroVisionChipText: v })} fieldLabel="Vision Chip" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Scroll Label" hint="Tiny text above the scroll line at bottom of hero">
            <AiTextField type="input" value={p.heroScrollLabel} onChange={v => set({ heroScrollLabel: v })} fieldLabel="Scroll Label" brandVoiceSet={brandVoiceSet} />
          </Field>
        </div>
      )}

      {/* ── Marquee ─────────────────────────────────────────────────────────── */}
      <SectionHeader label="Marquee Stats" open={open.marquee} onToggle={() => toggle("marquee")} />
      {open.marquee && (
        <div className="space-y-3 pt-3 pb-4">
          {p.marqueeItems.map((item, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <Input value={item.value} onChange={e => updateMarquee(i, { value: e.target.value })} placeholder="6–8 min" className="h-7 text-xs flex-1" />
              <Input value={item.label} onChange={e => updateMarquee(i, { label: e.target.value })} placeholder="spatial experience" className="h-7 text-xs flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeMarquee(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addMarquee}>
            <Plus className="w-3 h-3 mr-1" /> Add Stat
          </Button>
        </div>
      )}

      {/* ── Manifesto ───────────────────────────────────────────────────────── */}
      <SectionHeader label="Manifesto Section" open={open.manifesto} onToggle={() => toggle("manifesto")} />
      {open.manifesto && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.manifestoEyebrow} onChange={v => set({ manifestoEyebrow: v })} fieldLabel="Manifesto Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "manifestoEyebrow", p.manifestoEyebrow, {})} />
          </Field>
          <Field label="Headline — Line 1">
            <AiTextField type="input" value={p.manifestoHeadlineLine1} onChange={v => set({ manifestoHeadlineLine1: v })} fieldLabel="Manifesto Line 1" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Italic Emphasis">
            <AiTextField type="input" value={p.manifestoHeadlineEmphasis} onChange={v => set({ manifestoHeadlineEmphasis: v })} fieldLabel="Manifesto Emphasis" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Body Paragraph 1">
            <AiTextField type="textarea" value={p.manifestoBody1} onChange={v => set({ manifestoBody1: v })} rows={3} fieldLabel="Manifesto Body 1" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "manifestoBody1", p.manifestoBody1, {})} />
          </Field>
          <Field label="Body Paragraph 2">
            <AiTextField type="textarea" value={p.manifestoBody2} onChange={v => set({ manifestoBody2: v })} rows={2} fieldLabel="Manifesto Body 2" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "manifestoBody2", p.manifestoBody2, {})} />
          </Field>
          <Field label="Image" hint="Photo on the right side of the manifesto">
            <ImagePicker value={p.manifestoImageUrl} onChange={v => set({ manifestoImageUrl: v })} />
          </Field>
          <Field label="Image Caption">
            <AiTextField type="input" value={p.manifestoCaption} onChange={v => set({ manifestoCaption: v })} fieldLabel="Image Caption" brandVoiceSet={brandVoiceSet} />
          </Field>
        </div>
      )}

      {/* ── Tour Stations ───────────────────────────────────────────────────── */}
      <SectionHeader label="Tour Intro & Stations" open={open.tour} onToggle={() => toggle("tour")} />
      {open.tour && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Intro Eyebrow">
            <AiTextField type="input" value={p.tourEyebrow} onChange={v => set({ tourEyebrow: v })} fieldLabel="Tour Eyebrow" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Intro Headline — Line 1">
            <AiTextField type="input" value={p.tourHeadlineLine1} onChange={v => set({ tourHeadlineLine1: v })} fieldLabel="Tour Line 1" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Intro Headline — Italic Emphasis">
            <AiTextField type="input" value={p.tourHeadlineEmphasis} onChange={v => set({ tourHeadlineEmphasis: v })} fieldLabel="Tour Emphasis" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Intro Headline — Line 3">
            <AiTextField type="input" value={p.tourHeadlineLine3} onChange={v => set({ tourHeadlineLine3: v })} fieldLabel="Tour Line 3" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Intro Body">
            <AiTextField type="textarea" value={p.tourBody} onChange={v => set({ tourBody: v })} rows={3} fieldLabel="Tour Body" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "tourBody", p.tourBody, {})} />
          </Field>

          <div className="space-y-3 pt-2">
            <Label className="text-xs">Stations</Label>
            {p.tourStations.map((station, i) => (
              <div key={i} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {station.number ? `${station.number} · ` : `${i + 1} · `}{station.label || "Station"}
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeStation(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={station.number} onChange={e => updateStation(i, { number: e.target.value })} className="h-7 text-xs" placeholder="01" />
                  <Input value={station.label} onChange={e => updateStation(i, { label: e.target.value })} className="h-7 text-xs" placeholder="Scan intake" />
                </div>
                <ImagePicker value={station.imageUrl} onChange={v => updateStation(i, { imageUrl: v })} />
                <Input value={station.objectPosition ?? ""} onChange={e => updateStation(i, { objectPosition: e.target.value })} className="h-7 text-xs" placeholder="Image focus (e.g. center 40%)" />
                <Input value={station.headline} onChange={e => updateStation(i, { headline: e.target.value })} className="h-7 text-xs" placeholder="Station headline" />
                <AiTextField type="textarea" value={station.body} onChange={v => updateStation(i, { body: v })} rows={3} fieldLabel={`Station ${i + 1} Body`} brandVoiceSet={brandVoiceSet}
                  onSuggest={() => suggestCopy("spatial-tour", "stationBody", station.body, {})} />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={station.insetDuration} onChange={e => updateStation(i, { insetDuration: e.target.value })} className="h-7 text-xs" placeholder="0:48" />
                  <Input value={station.insetDetail} onChange={e => updateStation(i, { insetDetail: e.target.value })} className="h-7 text-xs" placeholder="Inset detail" />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addStation}>
              <Plus className="w-3 h-3 mr-1" /> Add Station
            </Button>
          </div>
        </div>
      )}

      {/* ── Spatial Callout ─────────────────────────────────────────────────── */}
      <SectionHeader label="Spatial Callout" open={open.callout} onToggle={() => toggle("callout")} />
      {open.callout && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.calloutEyebrow} onChange={v => set({ calloutEyebrow: v })} fieldLabel="Callout Eyebrow" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Line 1">
            <AiTextField type="input" value={p.calloutHeadlineLine1} onChange={v => set({ calloutHeadlineLine1: v })} fieldLabel="Callout Line 1" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Line 2">
            <AiTextField type="input" value={p.calloutHeadlineLine2} onChange={v => set({ calloutHeadlineLine2: v })} fieldLabel="Callout Line 2" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Italic Emphasis">
            <AiTextField type="input" value={p.calloutHeadlineEmphasis} onChange={v => set({ calloutHeadlineEmphasis: v })} fieldLabel="Callout Emphasis" brandVoiceSet={brandVoiceSet} />
          </Field>
          <div className="space-y-3 pt-2">
            <Label className="text-xs">Callout Points</Label>
            {p.calloutPoints.map((point, i) => (
              <div key={i} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Point {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeCallout(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={point.title} onChange={e => updateCallout(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Point title" />
                <AiTextField type="textarea" value={point.body} onChange={v => updateCallout(i, { body: v })} rows={2} fieldLabel={`Point ${i + 1} Body`} brandVoiceSet={brandVoiceSet} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addCallout}>
              <Plus className="w-3 h-3 mr-1" /> Add Point
            </Button>
          </div>
        </div>
      )}

      {/* ── Four Ways ───────────────────────────────────────────────────────── */}
      <SectionHeader label="Four Ways To Experience" open={open.ways} onToggle={() => toggle("ways")} />
      {open.ways && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.waysEyebrow} onChange={v => set({ waysEyebrow: v })} fieldLabel="Ways Eyebrow" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Line 1">
            <AiTextField type="input" value={p.waysHeadlineLine1} onChange={v => set({ waysHeadlineLine1: v })} fieldLabel="Ways Line 1" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Italic Emphasis">
            <AiTextField type="input" value={p.waysHeadlineEmphasis} onChange={v => set({ waysHeadlineEmphasis: v })} fieldLabel="Ways Emphasis" brandVoiceSet={brandVoiceSet} />
          </Field>
          <div className="space-y-3 pt-2">
            <Label className="text-xs">Ways</Label>
            {p.ways.map((way, i) => (
              <div key={i} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {way.number ? `${way.number} · ` : `${i + 1} · `}{way.label || "Way"}
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeWay(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={way.number} onChange={e => updateWay(i, { number: e.target.value })} className="h-7 text-xs" placeholder="01" />
                  <Input value={way.label} onChange={e => updateWay(i, { label: e.target.value })} className="h-7 text-xs" placeholder="Way label" />
                </div>
                <ImagePicker value={way.imageUrl} onChange={v => updateWay(i, { imageUrl: v })} />
                <Input value={way.objectPosition ?? ""} onChange={e => updateWay(i, { objectPosition: e.target.value })} className="h-7 text-xs" placeholder="Image focus (e.g. center 40%)" />
                <Input value={way.eyebrow} onChange={e => updateWay(i, { eyebrow: e.target.value })} className="h-7 text-xs" placeholder="Eyebrow" />
                <AiTextField type="textarea" value={way.body} onChange={v => updateWay(i, { body: v })} rows={3} fieldLabel={`Way ${i + 1} Body`} brandVoiceSet={brandVoiceSet} />
                <Input value={way.ctaText} onChange={e => updateWay(i, { ctaText: e.target.value })} className="h-7 text-xs" placeholder="CTA text" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addWay}>
              <Plus className="w-3 h-3 mr-1" /> Add Way
            </Button>
          </div>
        </div>
      )}

      {/* ── Calendar / RSVP ─────────────────────────────────────────────────── */}
      <SectionHeader label="Calendar & RSVP" open={open.calendar} onToggle={() => toggle("calendar")} />
      {open.calendar && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.calendarEyebrow} onChange={v => set({ calendarEyebrow: v })} fieldLabel="Calendar Eyebrow" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Line 1">
            <AiTextField type="input" value={p.calendarHeadlineLine1} onChange={v => set({ calendarHeadlineLine1: v })} fieldLabel="Calendar Line 1" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Headline — Italic Emphasis">
            <AiTextField type="input" value={p.calendarHeadlineEmphasis} onChange={v => set({ calendarHeadlineEmphasis: v })} fieldLabel="Calendar Emphasis" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Body Copy">
            <AiTextField type="textarea" value={p.calendarBody} onChange={v => set({ calendarBody: v })} rows={3} fieldLabel="Calendar Body" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("spatial-tour", "calendarBody", p.calendarBody, {})} />
          </Field>
          <Field label="Primary CTA Text">
            <AiTextField type="input" value={p.calendarPrimaryCta} onChange={v => set({ calendarPrimaryCta: v })} fieldLabel="Primary CTA" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Secondary CTA Text">
            <AiTextField type="input" value={p.calendarSecondaryCta} onChange={v => set({ calendarSecondaryCta: v })} fieldLabel="Secondary CTA" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="URL Display Text" hint="Small text under CTAs (e.g. dandyspatial.com)">
            <AiTextField type="input" value={p.calendarUrlText} onChange={v => set({ calendarUrlText: v })} fieldLabel="URL Text" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Right Panel Title">
            <AiTextField type="input" value={p.calendarPanelTitle} onChange={v => set({ calendarPanelTitle: v })} fieldLabel="Panel Title" brandVoiceSet={brandVoiceSet} />
          </Field>
          <Field label="Right Panel Eyebrow">
            <AiTextField type="input" value={p.calendarPanelEyebrow} onChange={v => set({ calendarPanelEyebrow: v })} fieldLabel="Panel Eyebrow" brandVoiceSet={brandVoiceSet} />
          </Field>

          <div className="space-y-3 pt-2">
            <Label className="text-xs">Tour Dates</Label>
            {p.calendarDates.map((d, i) => (
              <div key={i} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{d.date || `Date ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeDate(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={d.date} onChange={e => updateDate(i, { date: e.target.value })} className="h-7 text-xs" placeholder="Mar 12 · 2027" />
                <Input value={d.city} onChange={e => updateDate(i, { city: e.target.value })} className="h-7 text-xs" placeholder="New York, NY" />
                <Input value={d.event} onChange={e => updateDate(i, { event: e.target.value })} className="h-7 text-xs" placeholder="Event / context" />
                <select
                  value={d.status}
                  onChange={e => updateDate(i, { status: e.target.value })}
                  className="w-full h-7 text-xs border border-border rounded px-2 bg-background"
                >
                  <option value="Open">Open</option>
                  <option value="Filling fast">Filling fast</option>
                  <option value="Limited">Limited</option>
                  <option value="Always open">Always open</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addDate}>
              <Plus className="w-3 h-3 mr-1" /> Add Date
            </Button>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <SectionHeader label="Footer" open={open.footer} onToggle={() => toggle("footer")} />
      {open.footer && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Brand">
            <Input value={p.footerBrand} onChange={e => set({ footerBrand: e.target.value })} className="h-7 text-xs" />
          </Field>
          <Field label="Eyebrow">
            <Input value={p.footerEyebrow} onChange={e => set({ footerEyebrow: e.target.value })} className="h-7 text-xs" />
          </Field>
          <Field label="Footer Info" hint="Small grey text on the right">
            <Input value={p.footerInfo} onChange={e => set({ footerInfo: e.target.value })} className="h-7 text-xs" />
          </Field>
        </div>
      )}
    </div>
  );
}
