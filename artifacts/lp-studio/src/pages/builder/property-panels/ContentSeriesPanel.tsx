import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import { suggestCopy } from "@/lib/copy-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ContentSeriesBlockProps,
  ContentSeriesTheme,
  ContentSeriesEpisode,
  ContentSeriesHost,
  ContentSeriesCta,
  ContentSeriesNavLink,
} from "@/lib/block-types";
import type { FormStep, FormField, FormFieldType } from "@/lib/block-types";

const THEME_DEFAULTS: Required<ContentSeriesTheme> = {
  bg: "#0c0f12",
  cardBg: "#141619",
  fg: "#eeeae3",
  headingColor: "#eeeae3",
  primary: "#b59a6e",
  muted: "#7a8088",
  border: "#262a2f",
  navBg: "#0c0f12",
  navBgOpacity: 0.6,
  navText: "#eeeae3",
  displayFontFamily: "EB Garamond",
  bodyFontFamily: "Inter",
};

function ColorRow({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string) => void }) {
  const v = (value && value.trim()) || fallback;
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs flex-1">{label}</Label>
      <Input type="color" value={v} onChange={e => onChange(e.target.value)} className="h-7 w-10 p-0.5 cursor-pointer" />
      <Input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={fallback} className="text-xs h-7 w-24 font-mono" />
      <BrandSwatches className="basis-full justify-end" current={value} onPick={onChange} />
    </div>
  );
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

interface Props {
  props: ContentSeriesBlockProps;
  onChange: (props: ContentSeriesBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function ContentSeriesPanel({ props: p, onChange, brandVoiceSet }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    theme: false,
    hero: true,
    episodes: false,
    hosts: false,
    about: false,
    form: false,
    cta: false,
    nav: false,
  });

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<ContentSeriesBlockProps>) => onChange({ ...p, ...patch });

  const theme: ContentSeriesTheme = p.theme ?? {};
  const setTheme = (patch: Partial<ContentSeriesTheme>) => set({ theme: { ...theme, ...patch } });
  const resetTheme = () => set({ theme: { ...THEME_DEFAULTS } });

  const updateEpisode = (i: number, patch: Partial<ContentSeriesEpisode>) => {
    const next = p.episodes.map((ep, idx) => idx === i ? { ...ep, ...patch } : ep);
    set({ episodes: next });
  };
  const addEpisode = () => set({
    episodes: [...p.episodes, { title: "New Episode", guestName: "", description: "", publishDate: new Date().toISOString().split("T")[0], ctaUrl: "#", isFeatured: false }],
  });
  const removeEpisode = (i: number) => set({ episodes: p.episodes.filter((_, idx) => idx !== i) });

  const hosts = p.hosts ?? [];
  const updateHost = (i: number, patch: Partial<ContentSeriesHost>) => {
    const next = hosts.map((h, idx) => idx === i ? { ...h, ...patch } : h);
    set({ hosts: next });
  };
  const addHost = () => set({ hosts: [...hosts, { name: "New Host", title: "Host", bio: "" }] });
  const removeHost = (i: number) => set({ hosts: hosts.filter((_, idx) => idx !== i) });

  const ctas = p.ctas ?? [];
  const updateCta = (i: number, patch: Partial<ContentSeriesCta>) => {
    const next = ctas.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    set({ ctas: next });
  };
  const addCta = () => set({ ctas: [...ctas, { label: "New CTA", url: "#", variant: "outline" }] });
  const removeCta = (i: number) => set({ ctas: ctas.filter((_, idx) => idx !== i) });

  const navLinks = p.navLinks ?? [];
  const updateNavLink = (i: number, patch: Partial<ContentSeriesNavLink>) => {
    const next = navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    set({ navLinks: next });
  };
  const addNavLink = () => set({ navLinks: [...navLinks, { label: "Section", href: "#section" }] });
  const removeNavLink = (i: number) => set({ navLinks: navLinks.filter((_, idx) => idx !== i) });

  const topics = p.aboutTopics ?? [];
  const updateTopic = (i: number, value: string) => {
    const next = topics.map((t, idx) => idx === i ? value : t);
    set({ aboutTopics: next });
  };
  const addTopic = () => set({ aboutTopics: [...topics, ""] });
  const removeTopic = (i: number) => set({ aboutTopics: topics.filter((_, idx) => idx !== i) });

  const formSteps = p.formSteps ?? [];
  const updateFormStep = (si: number, patch: Partial<FormStep>) =>
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, ...patch } : s) });
  const addFormStep = () =>
    set({ formSteps: [...formSteps, { title: "New Step", fields: [] }] });
  const removeFormStep = (si: number) =>
    set({ formSteps: formSteps.filter((_, idx) => idx !== si) });

  const updateFormField = (si: number, fi: number, patch: Partial<FormField>) => {
    const steps = formSteps.map((s, idx) =>
      idx === si ? { ...s, fields: s.fields.map((f, fidx) => fidx === fi ? { ...f, ...patch } : f) } : s
    );
    set({ formSteps: steps });
  };
  const addFormField = (si: number) => {
    const newField: FormField = { id: `field_${Date.now()}`, type: "text", label: "New Field", placeholder: "", required: false };
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, fields: [...s.fields, newField] } : s) });
  };
  const removeFormField = (si: number, fi: number) => {
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, fields: s.fields.filter((_, fidx) => fidx !== fi) } : s) });
  };

  return (
    <div className="space-y-0 p-4">

      {/* ── Series Type ──────────────────────────────────────────────────── */}
      <div className="pb-3 space-y-2">
        <Field label="Series Type" hint="Changes default labels and icons">
          <Select value={p.seriesType} onValueChange={(v) => set({ seriesType: v as ContentSeriesBlockProps["seriesType"] })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="podcast">Podcast</SelectItem>
              <SelectItem value="webinar">Webinar</SelectItem>
              <SelectItem value="series">Video Series</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Series Title">
          <AiTextField type="input" value={p.seriesTitle} onChange={v => set({ seriesTitle: v })} fieldLabel="Series Title" brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy("content-series", "seriesTitle", p.seriesTitle, {})} />
        </Field>
        <Field label="Subtitle">
          <AiTextField type="textarea" value={p.seriesSubtitle ?? ""} onChange={v => set({ seriesSubtitle: v })} rows={2} fieldLabel="Subtitle" brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy("content-series", "seriesSubtitle", p.seriesSubtitle ?? "", {})} />
        </Field>
        <Field label="Logo URL" hint="Leave blank for text + icon in nav">
          <ImagePicker value={p.logoUrl ?? ""} onChange={v => set({ logoUrl: v || undefined })} />
        </Field>
      </div>

      {/* ── Theme & Style ────────────────────────────────────────────────── */}
      <SectionHeader label="Theme & Style" open={open.theme} onToggle={() => toggle("theme")} />
      {open.theme && (
        <div className="space-y-3 pt-3 pb-4">
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fonts</Label>
            <Field label="Heading Font" hint="Used for headlines and display text">
              <FontSelect
                value={theme.displayFontFamily}
                onChange={(v) => setTheme({ displayFontFamily: v ?? THEME_DEFAULTS.displayFontFamily })}
                inheritLabel={`Default (${THEME_DEFAULTS.displayFontFamily})`}
              />
            </Field>
            <Field label="Body Font" hint="Used for paragraphs, nav, buttons, form fields">
              <FontSelect
                value={theme.bodyFontFamily}
                onChange={(v) => setTheme({ bodyFontFamily: v ?? THEME_DEFAULTS.bodyFontFamily })}
                inheritLabel={`Default (${THEME_DEFAULTS.bodyFontFamily})`}
              />
            </Field>
          </div>
          <div className="space-y-2 pt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Page Colors</Label>
            <ColorRow label="Background" value={theme.bg} fallback={THEME_DEFAULTS.bg} onChange={v => setTheme({ bg: v })} />
            <ColorRow label="Card / Panel BG" value={theme.cardBg} fallback={THEME_DEFAULTS.cardBg} onChange={v => setTheme({ cardBg: v })} />
            <ColorRow label="Body Text" value={theme.fg} fallback={THEME_DEFAULTS.fg} onChange={v => setTheme({ fg: v })} />
            <ColorRow label="Heading Text" value={theme.headingColor} fallback={THEME_DEFAULTS.headingColor} onChange={v => setTheme({ headingColor: v })} />
            <ColorRow label="Accent / Primary" value={theme.primary} fallback={THEME_DEFAULTS.primary} onChange={v => setTheme({ primary: v })} />
            <ColorRow label="Muted Text" value={theme.muted} fallback={THEME_DEFAULTS.muted} onChange={v => setTheme({ muted: v })} />
            <ColorRow label="Border" value={theme.border} fallback={THEME_DEFAULTS.border} onChange={v => setTheme({ border: v })} />
          </div>
          <div className="space-y-2 pt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nav Bar</Label>
            <ColorRow label="Nav Background" value={theme.navBg} fallback={THEME_DEFAULTS.navBg} onChange={v => setTheme({ navBg: v })} />
            <Field label={`Nav BG Opacity (${Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)}%)`} hint="Lower = more see-through nav">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)}
                onChange={e => setTheme({ navBgOpacity: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </Field>
            <ColorRow label="Nav Text" value={theme.navText} fallback={THEME_DEFAULTS.navText} onChange={v => setTheme({ navText: v })} />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full mt-2" onClick={resetTheme}>
            Reset to defaults
          </Button>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <SectionHeader label="Hero & Nav" open={open.hero} onToggle={() => toggle("hero")} />
      {open.hero && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Hero Layout" hint="Controls how the hero image is displayed">
            <Select value={p.heroLayout ?? "half-bleed"} onValueChange={(v) => set({ heroLayout: v as ContentSeriesBlockProps["heroLayout"] })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full-bleed">Full Bleed (immersive bg)</SelectItem>
                <SelectItem value="half-bleed">Half Bleed (split layout)</SelectItem>
                <SelectItem value="text-only">Text Only (no image)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hero Eyebrow" hint="Small label above the title">
            <AiTextField type="input" value={p.heroEyebrow ?? ""} onChange={v => set({ heroEyebrow: v })} fieldLabel="Hero Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "heroEyebrow", p.heroEyebrow ?? "", {})} />
          </Field>
          <Field label="Hero Image">
            <ImagePicker value={p.heroImageUrl ?? ""} onChange={v => set({ heroImageUrl: v || undefined })} />
          </Field>
          <Field label="Featured Episode Title">
            <AiTextField type="input" value={p.heroEpisodeTitle} onChange={v => set({ heroEpisodeTitle: v })} fieldLabel="Episode Title" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "heroEpisodeTitle", p.heroEpisodeTitle, {})} />
          </Field>
          <Field label="Episode Description">
            <AiTextField type="textarea" value={p.heroEpisodeDescription ?? ""} onChange={v => set({ heroEpisodeDescription: v })} rows={3} fieldLabel="Episode Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "heroEpisodeDescription", p.heroEpisodeDescription ?? "", {})} />
          </Field>
          <Field label="Guest Name">
            <Input value={p.heroGuestName ?? ""} onChange={e => set({ heroGuestName: e.target.value })} className="text-xs h-7" placeholder="Dr. Sarah Chen" />
          </Field>
          <Field label="Guest Title">
            <Input value={p.heroGuestTitle ?? ""} onChange={e => set({ heroGuestTitle: e.target.value })} className="text-xs h-7" placeholder="CEO & Founder" />
          </Field>
          <Field label="CTA Text">
            <Input value={p.heroCtaText ?? ""} onChange={e => set({ heroCtaText: e.target.value })} className="text-xs h-7" placeholder="Listen Now" />
          </Field>
          <Field label="CTA URL">
            <Input value={p.heroCtaUrl ?? ""} onChange={e => set({ heroCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="https://…" />
          </Field>
        </div>
      )}

      {/* ── Nav Links ────────────────────────────────────────────────────── */}
      <SectionHeader label="Nav Links" open={open.nav} onToggle={() => toggle("nav")} />
      {open.nav && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Nav CTA Text">
            <Input value={p.navCtaText ?? ""} onChange={e => set({ navCtaText: e.target.value })} className="text-xs h-7" placeholder="Listen Now" />
          </Field>
          <Field label="Nav CTA URL">
            <Input value={p.navCtaUrl ?? ""} onChange={e => set({ navCtaUrl: e.target.value })} className="text-xs h-7 font-mono" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Links</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addNavLink}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {navLinks.map((link, i) => (
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

      {/* ── Episodes ─────────────────────────────────────────────────────── */}
      <SectionHeader label="Episodes" open={open.episodes} onToggle={() => toggle("episodes")} />
      {open.episodes && (
        <div className="space-y-3 pt-3 pb-4">
          {p.episodes.map((ep, i) => (
            <div key={i} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{ep.title || `Episode ${i + 1}`}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeEpisode(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Input value={ep.title} onChange={e => updateEpisode(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Episode title" />
              <Input value={ep.guestName ?? ""} onChange={e => updateEpisode(i, { guestName: e.target.value })} className="h-7 text-xs" placeholder="Guest name" />
              <Input value={ep.guestTitle ?? ""} onChange={e => updateEpisode(i, { guestTitle: e.target.value })} className="h-7 text-xs" placeholder="Guest title" />
              <Input value={ep.guestCompany ?? ""} onChange={e => updateEpisode(i, { guestCompany: e.target.value })} className="h-7 text-xs" placeholder="Guest company" />
              <Textarea value={ep.description} onChange={e => updateEpisode(i, { description: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Episode description" />
              <Input type="date" value={ep.publishDate} onChange={e => updateEpisode(i, { publishDate: e.target.value })} className="h-7 text-xs" />
              <Input value={ep.ctaUrl} onChange={e => updateEpisode(i, { ctaUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="CTA URL" />
              <Input value={ep.ctaText ?? ""} onChange={e => updateEpisode(i, { ctaText: e.target.value })} className="h-7 text-xs" placeholder="CTA text (e.g. Listen)" />
              <ImagePicker value={ep.thumbnailUrl ?? ""} onChange={v => updateEpisode(i, { thumbnailUrl: v || undefined })} />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={!!ep.isFeatured} onChange={e => updateEpisode(i, { isFeatured: e.target.checked })} className="w-3 h-3" />
                Featured
              </label>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addEpisode}>
            <Plus className="w-3 h-3 mr-1" /> Add Episode
          </Button>
        </div>
      )}

      {/* ── Hosts ────────────────────────────────────────────────────────── */}
      <SectionHeader label="Hosts & Guests" open={open.hosts} onToggle={() => toggle("hosts")} />
      {open.hosts && (
        <div className="space-y-3 pt-3 pb-4">
          {hosts.map((host, i) => (
            <div key={i} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{host.name || `Host ${i + 1}`}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeHost(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Input value={host.name} onChange={e => updateHost(i, { name: e.target.value })} className="h-7 text-xs" placeholder="Name" />
              <Input value={host.title} onChange={e => updateHost(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Title" />
              <Input value={host.company ?? ""} onChange={e => updateHost(i, { company: e.target.value })} className="h-7 text-xs" placeholder="Company" />
              <Textarea value={host.bio ?? ""} onChange={e => updateHost(i, { bio: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Bio" />
              <ImagePicker value={host.photoUrl ?? ""} onChange={v => updateHost(i, { photoUrl: v || undefined })} />
              <Input value={host.linkedinUrl ?? ""} onChange={e => updateHost(i, { linkedinUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="LinkedIn URL" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addHost}>
            <Plus className="w-3 h-3 mr-1" /> Add Host
          </Button>
        </div>
      )}

      {/* ── About ────────────────────────────────────────────────────────── */}
      <SectionHeader label="About Section" open={open.about} onToggle={() => toggle("about")} />
      {open.about && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Headline">
            <AiTextField type="input" value={p.aboutHeadline ?? ""} onChange={v => set({ aboutHeadline: v })} fieldLabel="About Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutHeadline", p.aboutHeadline ?? "", {})} />
          </Field>
          <Field label="Description">
            <AiTextField type="textarea" value={p.aboutDescription ?? ""} onChange={v => set({ aboutDescription: v })} rows={4} fieldLabel="About Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutDescription", p.aboutDescription ?? "", {})} />
          </Field>
          <Field label="Audience" hint="Who this series is for">
            <AiTextField type="input" value={p.aboutAudience ?? ""} onChange={v => set({ aboutAudience: v })} fieldLabel="Audience" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutAudience", p.aboutAudience ?? "", {})} />
          </Field>
          <div className="space-y-2">
            <Label className="text-xs">Topics</Label>
            {topics.map((topic, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input value={topic} onChange={e => updateTopic(i, e.target.value)} className="h-7 text-xs flex-1" placeholder={`Topic ${i + 1}`} />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeTopic(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addTopic}>
              <Plus className="w-3 h-3 mr-1" /> Add Topic
            </Button>
          </div>
        </div>
      )}

      {/* ── Guest Application Form ───────────────────────────────────────── */}
      <SectionHeader label="Guest Application Form" open={open.form} onToggle={() => toggle("form")} />
      {open.form && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.formEyebrow ?? ""} onChange={v => set({ formEyebrow: v })} fieldLabel="Form Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formEyebrow", p.formEyebrow ?? "", {})} />
          </Field>
          <Field label="Headline">
            <AiTextField type="input" value={p.formHeadline ?? ""} onChange={v => set({ formHeadline: v })} fieldLabel="Form Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formHeadline", p.formHeadline ?? "", {})} />
          </Field>
          <Field label="Subtitle">
            <AiTextField type="textarea" value={p.formSubheadline ?? ""} onChange={v => set({ formSubheadline: v })} rows={2} fieldLabel="Form Subtitle" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formSubheadline", p.formSubheadline ?? "", {})} />
          </Field>
          <Field label="Submit URL" hint="Where form data is sent. Leave blank for default lead system.">
            <Input value={p.formSubmitUrl ?? ""} onChange={e => set({ formSubmitUrl: e.target.value || undefined })} className="text-xs h-7 font-mono" placeholder="https://… (leave blank for default)" />
          </Field>
          <Field label="Success Message" hint="Shown after successful submission">
            <AiTextField type="input" value={p.formSuccessMessage ?? ""} onChange={v => set({ formSuccessMessage: v })} fieldLabel="Success Message" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formSuccessMessage", p.formSuccessMessage ?? "", {})} />
          </Field>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Form Steps</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addFormStep}>
                <Plus className="w-3 h-3 mr-1" /> Step
              </Button>
            </div>
            {formSteps.map((fStep, si) => (
              <div key={si} className="border border-border rounded p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <Input value={fStep.title} onChange={e => updateFormStep(si, { title: e.target.value })} placeholder="Step title" className="text-xs h-7 flex-1" />
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeFormStep(si)} disabled={formSteps.length <= 1}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1.5 pl-2">
                  {fStep.fields.map((field, fi) => (
                    <div key={fi} className="border border-border/50 rounded p-1.5 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Input value={field.label} onChange={e => updateFormField(si, fi, { label: e.target.value })} placeholder="Label" className="text-xs h-6 flex-1" />
                        <select
                          value={field.type}
                          onChange={e => updateFormField(si, fi, { type: e.target.value as FormFieldType })}
                          className="text-xs h-6 border border-border rounded px-1 bg-background"
                        >
                          {(["text", "email", "phone", "textarea", "select", "hidden"] as FormFieldType[]).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => removeFormField(si, fi)}>
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                      <Input value={field.placeholder ?? ""} onChange={e => updateFormField(si, fi, { placeholder: e.target.value })} placeholder="Placeholder" className="text-xs h-6" />
                      {field.type === "select" && (
                        <Textarea
                          value={(field.options ?? []).join("\n")}
                          onChange={e => updateFormField(si, fi, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                          placeholder="One option per line"
                          className="text-xs min-h-[3rem]"
                          rows={2}
                        />
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={field.required} onChange={e => updateFormField(si, fi, { required: e.target.checked })} className="w-3 h-3" />
                        Required
                      </label>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs w-full border border-dashed border-border" onClick={() => addFormField(si)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Field
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA Section ──────────────────────────────────────────────────── */}
      <SectionHeader label="CTA Section" open={open.cta} onToggle={() => toggle("cta")} />
      {open.cta && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Headline">
            <AiTextField type="input" value={p.ctaSectionHeadline ?? ""} onChange={v => set({ ctaSectionHeadline: v })} fieldLabel="CTA Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "ctaSectionHeadline", p.ctaSectionHeadline ?? "", {})} />
          </Field>
          <Field label="Subheadline">
            <AiTextField type="textarea" value={p.ctaSectionSubheadline ?? ""} onChange={v => set({ ctaSectionSubheadline: v })} rows={2} fieldLabel="CTA Subheadline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "ctaSectionSubheadline", p.ctaSectionSubheadline ?? "", {})} />
          </Field>
          <Field label="RSS Feed URL" hint="Optional RSS feed link">
            <Input value={p.rssFeedUrl ?? ""} onChange={e => set({ rssFeedUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="https://…" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">CTA Buttons</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addCta}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {ctas.map((cta, i) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{cta.label || `CTA ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeCta(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={cta.label} onChange={e => updateCta(i, { label: e.target.value })} className="h-7 text-xs" placeholder="Label" />
                <Input value={cta.url} onChange={e => updateCta(i, { url: e.target.value })} className="h-7 text-xs font-mono" placeholder="URL" />
                <Select value={cta.variant ?? "primary"} onValueChange={v => updateCta(i, { variant: v as "primary" | "outline" })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary (solid)</SelectItem>
                    <SelectItem value="outline">Outline (ghost)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
