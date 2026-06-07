import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import type {
  EventPageCommonProps,
  EventNavLink,
  EventStat,
  EventAgendaDay,
  EventAgendaSession,
  EventSpeaker,
  EventSponsor,
  EventTicketTier,
  EventFaqItem,
  EventGalleryImage,
  EventFormField,
  EventFormFieldType,
} from "@/lib/block-types";

interface Props {
  props: EventPageCommonProps;
  onChange: (next: EventPageCommonProps) => void;
}

const PALETTE_FB = {
  bgColor: "#faf8f4",
  inkColor: "#1a1a1a",
  mutedColor: "#6b6b6b",
  accentColor: "#c8a04e",
  accentInkColor: "#1a1a1a",
  darkColor: "#111111",
  headlineColor: "#1a1a1a",
  headlineOnDarkColor: "#faf8f4",
  cardBgColor: "#ffffff",
  borderColor: "#e2ded6",
};

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const safe = (value && value.trim()) || fallback;
  const colorInputValue = /^#[0-9a-fA-F]{6}$/.test(safe) ? safe : "#000000";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className="text-xs w-24 shrink-0 truncate">{label}</Label>
        <Input
          type="color"
          value={colorInputValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 p-0.5 cursor-pointer shrink-0"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="text-xs h-7 flex-1 min-w-0 font-mono"
        />
      </div>
      <BrandSwatches className="justify-start" current={value} onPick={onChange} />
    </div>
  );
}

function ArrayItemHeader({
  label,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  label: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label} {index + 1}
      </div>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={onMoveUp}>
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1} onClick={onMoveDown}>
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function NativeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TemplateEventPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    palette: false,
    typography: false,
    layout: false,
    brand: false,
    hero: true,
    countdown: false,
    about: false,
    agenda: false,
    speakers: false,
    venue: false,
    gallery: false,
    sponsors: false,
    tickets: false,
    faq: false,
    form: false,
    footer: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof EventPageCommonProps>(key: K, value: EventPageCommonProps[K]) =>
    onChange({ ...props, [key]: value });

  // ── Nav links ──────────────────────────────────────────────────────────
  const navLinks = props.navLinks ?? [];
  const setNavLink = (i: number, patch: Partial<EventNavLink>) => {
    const next = [...navLinks];
    next[i] = { ...next[i], ...patch };
    set("navLinks", next);
  };
  const addNavLink = () => set("navLinks", [...navLinks, { label: "Link", href: "#" }]);
  const removeNavLink = (i: number) => set("navLinks", navLinks.filter((_, j) => j !== i));
  const moveNavLink = (i: number, dir: -1 | 1) => set("navLinks", moveItem(navLinks, i, dir));

  // ── About stats ────────────────────────────────────────────────────────
  const aboutStats = props.aboutStats ?? [];
  const setAboutStat = (i: number, patch: Partial<EventStat>) => {
    const next = [...aboutStats];
    next[i] = { ...next[i], ...patch };
    set("aboutStats", next);
  };
  const addAboutStat = () => set("aboutStats", [...aboutStats, { value: "0", label: "New stat" }]);
  const removeAboutStat = (i: number) => set("aboutStats", aboutStats.filter((_, j) => j !== i));
  const moveAboutStat = (i: number, dir: -1 | 1) => set("aboutStats", moveItem(aboutStats, i, dir));

  // ── Agenda days & sessions ─────────────────────────────────────────────
  const agendaDays = props.agendaDays ?? [];
  const setAgendaDay = (i: number, patch: Partial<EventAgendaDay>) => {
    const next = [...agendaDays];
    next[i] = { ...next[i], ...patch };
    set("agendaDays", next);
  };
  const addAgendaDay = () =>
    set("agendaDays", [...agendaDays, { dayLabel: "Day", date: "", sessions: [] }]);
  const removeAgendaDay = (i: number) => set("agendaDays", agendaDays.filter((_, j) => j !== i));
  const moveAgendaDay = (i: number, dir: -1 | 1) => set("agendaDays", moveItem(agendaDays, i, dir));

  const setSession = (dayIdx: number, sIdx: number, patch: Partial<EventAgendaSession>) => {
    const sessions = [...(agendaDays[dayIdx]?.sessions ?? [])];
    sessions[sIdx] = { ...sessions[sIdx], ...patch };
    setAgendaDay(dayIdx, { sessions });
  };
  const addSession = (dayIdx: number) => {
    const sessions = [...(agendaDays[dayIdx]?.sessions ?? []), { time: "9:00 AM", title: "New session", description: "", speaker: "" }];
    setAgendaDay(dayIdx, { sessions });
  };
  const removeSession = (dayIdx: number, sIdx: number) => {
    const sessions = (agendaDays[dayIdx]?.sessions ?? []).filter((_, j) => j !== sIdx);
    setAgendaDay(dayIdx, { sessions });
  };
  const moveSession = (dayIdx: number, sIdx: number, dir: -1 | 1) => {
    const sessions = moveItem(agendaDays[dayIdx]?.sessions ?? [], sIdx, dir);
    setAgendaDay(dayIdx, { sessions });
  };

  // ── Speakers ───────────────────────────────────────────────────────────
  const speakers = props.speakers ?? [];
  const setSpeaker = (i: number, patch: Partial<EventSpeaker>) => {
    const next = [...speakers];
    next[i] = { ...next[i], ...patch };
    set("speakers", next);
  };
  const addSpeaker = () =>
    set("speakers", [...speakers, { name: "New speaker", role: "", company: "", photoUrl: "", bio: "" }]);
  const removeSpeaker = (i: number) => set("speakers", speakers.filter((_, j) => j !== i));
  const moveSpeaker = (i: number, dir: -1 | 1) => set("speakers", moveItem(speakers, i, dir));

  // ── Gallery ────────────────────────────────────────────────────────────
  const galleryImages = props.galleryImages ?? [];
  const setGalleryImage = (i: number, patch: Partial<EventGalleryImage>) => {
    const next = [...galleryImages];
    next[i] = { ...next[i], ...patch };
    set("galleryImages", next);
  };
  const addGalleryImage = () => set("galleryImages", [...galleryImages, { url: "", caption: "" }]);
  const removeGalleryImage = (i: number) => set("galleryImages", galleryImages.filter((_, j) => j !== i));
  const moveGalleryImage = (i: number, dir: -1 | 1) => set("galleryImages", moveItem(galleryImages, i, dir));

  // ── Sponsors ───────────────────────────────────────────────────────────
  const sponsors = props.sponsors ?? [];
  const setSponsor = (i: number, patch: Partial<EventSponsor>) => {
    const next = [...sponsors];
    next[i] = { ...next[i], ...patch };
    set("sponsors", next);
  };
  const addSponsor = () => set("sponsors", [...sponsors, { name: "New sponsor", logoUrl: "", tier: "" }]);
  const removeSponsor = (i: number) => set("sponsors", sponsors.filter((_, j) => j !== i));
  const moveSponsor = (i: number, dir: -1 | 1) => set("sponsors", moveItem(sponsors, i, dir));

  // ── Ticket tiers ───────────────────────────────────────────────────────
  const ticketTiers = props.ticketTiers ?? [];
  const setTier = (i: number, patch: Partial<EventTicketTier>) => {
    const next = [...ticketTiers];
    next[i] = { ...next[i], ...patch };
    set("ticketTiers", next);
  };
  const addTier = () =>
    set("ticketTiers", [
      ...ticketTiers,
      { name: "New tier", price: "$0", period: "", description: "", features: [], ctaLabel: "Register", ctaUrl: "#", featured: false },
    ]);
  const removeTier = (i: number) => set("ticketTiers", ticketTiers.filter((_, j) => j !== i));
  const moveTier = (i: number, dir: -1 | 1) => set("ticketTiers", moveItem(ticketTiers, i, dir));

  // ── FAQ ────────────────────────────────────────────────────────────────
  const faqItems = props.faqItems ?? [];
  const setFaq = (i: number, patch: Partial<EventFaqItem>) => {
    const next = [...faqItems];
    next[i] = { ...next[i], ...patch };
    set("faqItems", next);
  };
  const addFaq = () => set("faqItems", [...faqItems, { question: "New question?", answer: "Answer." }]);
  const removeFaq = (i: number) => set("faqItems", faqItems.filter((_, j) => j !== i));
  const moveFaq = (i: number, dir: -1 | 1) => set("faqItems", moveItem(faqItems, i, dir));

  // ── Form fields ────────────────────────────────────────────────────────
  const formFields = props.formFields ?? [];
  const setFormField = (i: number, patch: Partial<EventFormField>) => {
    const next = [...formFields];
    next[i] = { ...next[i], ...patch };
    set("formFields", next);
  };
  const addFormField = () =>
    set("formFields", [
      ...formFields,
      { id: `field_${formFields.length + 1}`, label: "New field", type: "text" as EventFormFieldType, placeholder: "", required: false, options: [] },
    ]);
  const removeFormField = (i: number) => set("formFields", formFields.filter((_, j) => j !== i));
  const moveFormField = (i: number, dir: -1 | 1) => set("formFields", moveItem(formFields, i, dir));

  // ── Footer links ───────────────────────────────────────────────────────
  const footerLinks = props.footerLinks ?? [];
  const setFooterLink = (i: number, patch: Partial<EventNavLink>) => {
    const next = [...footerLinks];
    next[i] = { ...next[i], ...patch };
    set("footerLinks", next);
  };
  const addFooterLink = () => set("footerLinks", [...footerLinks, { label: "Link", href: "#" }]);
  const removeFooterLink = (i: number) => set("footerLinks", footerLinks.filter((_, j) => j !== i));
  const moveFooterLink = (i: number, dir: -1 | 1) => set("footerLinks", moveItem(footerLinks, i, dir));

  const SECTION_TOGGLES: Array<{ key: keyof EventPageCommonProps; label: string }> = [
    { key: "showNav", label: "Navigation" },
    { key: "showHero", label: "Hero" },
    { key: "showCountdown", label: "Countdown" },
    { key: "showAbout", label: "About" },
    { key: "showAgenda", label: "Agenda" },
    { key: "showSpeakers", label: "Speakers" },
    { key: "showVenue", label: "Venue" },
    { key: "showGallery", label: "Gallery" },
    { key: "showSponsors", label: "Sponsors" },
    { key: "showTickets", label: "Tickets" },
    { key: "showFaq", label: "FAQ" },
    { key: "showForm", label: "Registration form" },
    { key: "showFooter", label: "Footer" },
  ];

  return (
    <div className="space-y-4">
      {/* Sections — show/hide */}
      <div className="space-y-2">
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground mb-2">
              Toggle which sections appear on the page.
            </p>
            {SECTION_TOGGLES.map(({ key, label }) => {
              const value = props[key];
              const checked = value !== false;
              return (
                <div key={key} className="flex items-center justify-between py-1">
                  <Label className="text-xs cursor-pointer">{label}</Label>
                  <Switch
                    checked={checked}
                    onCheckedChange={(v) => set(key, v as EventPageCommonProps[typeof key])}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Palette */}
      <div className="space-y-2">
        <SectionHeader label="Palette" open={open.palette} onToggle={() => toggle("palette")} />
        {open.palette && (
          <div className="space-y-2">
            <ColorRow label="Background" value={props.bgColor} fallback={PALETTE_FB.bgColor} onChange={(v) => set("bgColor", v)} />
            <ColorRow label="Text" value={props.inkColor} fallback={PALETTE_FB.inkColor} onChange={(v) => set("inkColor", v)} />
            <ColorRow label="Muted text" value={props.mutedColor} fallback={PALETTE_FB.mutedColor} onChange={(v) => set("mutedColor", v)} />
            <ColorRow label="Accent" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="On accent" value={props.accentInkColor} fallback={PALETTE_FB.accentInkColor} onChange={(v) => set("accentInkColor", v)} />
            <ColorRow label="Dark surface" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor", v)} />
            <ColorRow
              label="Headline"
              value={props.headlineColor}
              fallback={props.inkColor || PALETTE_FB.headlineColor}
              onChange={(v) => set("headlineColor", v)}
            />
            <ColorRow
              label="Headline on dark"
              value={props.headlineOnDarkColor}
              fallback={props.bgColor || PALETTE_FB.headlineOnDarkColor}
              onChange={(v) => set("headlineOnDarkColor", v)}
            />
            <ColorRow label="Card background" value={props.cardBgColor} fallback={PALETTE_FB.cardBgColor} onChange={(v) => set("cardBgColor", v)} />
            <ColorRow label="Border" value={props.borderColor} fallback={PALETTE_FB.borderColor} onChange={(v) => set("borderColor", v)} />
          </div>
        )}
      </div>

      {/* Typography */}
      <div className="space-y-2">
        <SectionHeader label="Typography" open={open.typography} onToggle={() => toggle("typography")} />
        {open.typography && (
          <div className="space-y-3">
            <Field label="Display font family">
              <Input
                value={props.displayFontFamily ?? ""}
                onChange={(e) => set("displayFontFamily", e.target.value)}
                placeholder="Playfair Display"
                className="text-xs h-8"
              />
            </Field>
            <Field label="Body font family">
              <Input
                value={props.bodyFontFamily ?? ""}
                onChange={(e) => set("bodyFontFamily", e.target.value)}
                placeholder="Inter"
                className="text-xs h-8"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Layout & sizing */}
      <div className="space-y-2">
        <SectionHeader label="Layout & sizing" open={open.layout} onToggle={() => toggle("layout")} />
        {open.layout && (
          <div className="space-y-3">
            <Field label="Section spacing">
              <NativeSelect
                value={props.sectionSpacing ?? "normal"}
                onChange={(v) => set("sectionSpacing", v as EventPageCommonProps["sectionSpacing"])}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "normal", label: "Normal" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
            </Field>
            <Field label="Content width">
              <NativeSelect
                value={props.contentWidth ?? "standard"}
                onChange={(v) => set("contentWidth", v as EventPageCommonProps["contentWidth"])}
                options={[
                  { value: "narrow", label: "Narrow" },
                  { value: "standard", label: "Standard" },
                  { value: "wide", label: "Wide" },
                ]}
              />
            </Field>
            <Field label="Corner radius">
              <NativeSelect
                value={props.cornerRadius ?? "soft"}
                onChange={(v) => set("cornerRadius", v as EventPageCommonProps["cornerRadius"])}
                options={[
                  { value: "sharp", label: "Sharp" },
                  { value: "soft", label: "Soft" },
                  { value: "rounded", label: "Rounded" },
                ]}
              />
            </Field>
            <Field label="Heading scale">
              <NativeSelect
                value={props.headingScale ?? "balanced"}
                onChange={(v) => set("headingScale", v as EventPageCommonProps["headingScale"])}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "balanced", label: "Balanced" },
                  { value: "display", label: "Display" },
                ]}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Brand & nav */}
      <div className="space-y-2">
        <SectionHeader label="Brand & nav" open={open.brand} onToggle={() => toggle("brand")} />
        {open.brand && (
          <div className="space-y-3">
            <Field label="Brand name">
              <Input value={props.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="Acme" className="text-xs h-8" />
            </Field>
            <Field label="Logo">
              <ImagePicker value={props.logoUrl ?? ""} onChange={(v) => set("logoUrl", v)} aiHint="Brand logo" />
            </Field>
            <Field label="Logo alt text">
              <Input value={props.logoAlt ?? ""} onChange={(e) => set("logoAlt", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Nav CTA label">
              <Input value={props.navCtaLabel ?? ""} onChange={(e) => set("navCtaLabel", e.target.value)} placeholder="Register" className="text-xs h-8" />
            </Field>
            <Field label="Nav CTA URL">
              <Input value={props.navCtaUrl ?? ""} onChange={(e) => set("navCtaUrl", e.target.value)} placeholder="#register" className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Nav links</Label>
              {navLinks.map((link, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Link"
                    index={i}
                    total={navLinks.length}
                    onMoveUp={() => moveNavLink(i, -1)}
                    onMoveDown={() => moveNavLink(i, 1)}
                    onRemove={() => removeNavLink(i)}
                  />
                  <Input value={link.label} onChange={(e) => setNavLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Input value={link.href} onChange={(e) => setNavLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addNavLink}>
                <Plus className="h-3.5 w-3.5" /> Add nav link
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.heroEyebrow ?? ""} onChange={(e) => set("heroEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Event name">
              <Textarea value={props.eventName} onChange={(e) => set("eventName", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Tagline">
              <Textarea value={props.heroTagline ?? ""} onChange={(e) => set("heroTagline", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Event date">
              <Input value={props.eventDate ?? ""} onChange={(e) => set("eventDate", e.target.value)} placeholder="June 12–14, 2025" className="text-xs h-8" />
            </Field>
            <Field label="Event location">
              <Input value={props.eventLocation ?? ""} onChange={(e) => set("eventLocation", e.target.value)} placeholder="Austin, TX" className="text-xs h-8" />
            </Field>
            <Field label="Primary CTA label">
              <Input value={props.heroCtaLabel ?? ""} onChange={(e) => set("heroCtaLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Primary CTA URL">
              <Input value={props.heroCtaUrl ?? ""} onChange={(e) => set("heroCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA label">
              <Input value={props.heroSecondaryCtaLabel ?? ""} onChange={(e) => set("heroSecondaryCtaLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA URL">
              <Input value={props.heroSecondaryCtaUrl ?? ""} onChange={(e) => set("heroSecondaryCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Hero image">
              <ImagePicker value={props.heroImageUrl ?? ""} onChange={(v) => set("heroImageUrl", v)} aiHint="Event hero background image" />
            </Field>
            <Field label="Hero overlay opacity (0–100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={props.heroOverlayOpacity ?? ""}
                onChange={(e) => set("heroOverlayOpacity", e.target.value === "" ? undefined : Number(e.target.value))}
                className="text-xs h-8"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="space-y-2">
        <SectionHeader label="Countdown" open={open.countdown} onToggle={() => toggle("countdown")} />
        {open.countdown && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.countdownHeading ?? ""} onChange={(e) => set("countdownHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Target date & time">
              <Input
                type="datetime-local"
                value={props.countdownTargetDate ?? ""}
                onChange={(e) => set("countdownTargetDate", e.target.value)}
                className="text-xs h-8"
              />
            </Field>
          </div>
        )}
      </div>

      {/* About */}
      <div className="space-y-2">
        <SectionHeader label="About" open={open.about} onToggle={() => toggle("about")} />
        {open.about && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.aboutEyebrow ?? ""} onChange={(e) => set("aboutEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.aboutHeading ?? ""} onChange={(e) => set("aboutHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Body">
              <Textarea value={props.aboutBody ?? ""} onChange={(e) => set("aboutBody", e.target.value)} className="text-xs min-h-24" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Stats</Label>
              {aboutStats.map((stat, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Stat"
                    index={i}
                    total={aboutStats.length}
                    onMoveUp={() => moveAboutStat(i, -1)}
                    onMoveDown={() => moveAboutStat(i, 1)}
                    onRemove={() => removeAboutStat(i)}
                  />
                  <Input value={stat.value} onChange={(e) => setAboutStat(i, { value: e.target.value })} placeholder="Value" className="text-xs h-8" />
                  <Input value={stat.label} onChange={(e) => setAboutStat(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addAboutStat}>
                <Plus className="h-3.5 w-3.5" /> Add stat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Agenda */}
      <div className="space-y-2">
        <SectionHeader label="Agenda" open={open.agenda} onToggle={() => toggle("agenda")} />
        {open.agenda && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.agendaEyebrow ?? ""} onChange={(e) => set("agendaEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.agendaHeading ?? ""} onChange={(e) => set("agendaHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Days</Label>
              {agendaDays.map((day, dayIdx) => {
                const sessions = day.sessions ?? [];
                return (
                  <div key={dayIdx} className="space-y-2 rounded-md border border-border p-2">
                    <ArrayItemHeader
                      label="Day"
                      index={dayIdx}
                      total={agendaDays.length}
                      onMoveUp={() => moveAgendaDay(dayIdx, -1)}
                      onMoveDown={() => moveAgendaDay(dayIdx, 1)}
                      onRemove={() => removeAgendaDay(dayIdx)}
                    />
                    <Input value={day.dayLabel} onChange={(e) => setAgendaDay(dayIdx, { dayLabel: e.target.value })} placeholder="Day label" className="text-xs h-8" />
                    <Input value={day.date ?? ""} onChange={(e) => setAgendaDay(dayIdx, { date: e.target.value })} placeholder="Date" className="text-xs h-8" />
                    <div className="space-y-2 pl-2 border-l border-border">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Sessions</Label>
                      {sessions.map((session, sIdx) => (
                        <div key={sIdx} className="space-y-2 rounded-md border border-border p-2">
                          <ArrayItemHeader
                            label="Session"
                            index={sIdx}
                            total={sessions.length}
                            onMoveUp={() => moveSession(dayIdx, sIdx, -1)}
                            onMoveDown={() => moveSession(dayIdx, sIdx, 1)}
                            onRemove={() => removeSession(dayIdx, sIdx)}
                          />
                          <Input value={session.time} onChange={(e) => setSession(dayIdx, sIdx, { time: e.target.value })} placeholder="Time" className="text-xs h-8" />
                          <Input value={session.title} onChange={(e) => setSession(dayIdx, sIdx, { title: e.target.value })} placeholder="Title" className="text-xs h-8" />
                          <Textarea value={session.description ?? ""} onChange={(e) => setSession(dayIdx, sIdx, { description: e.target.value })} placeholder="Description" className="text-xs min-h-16" />
                          <Input value={session.speaker ?? ""} onChange={(e) => setSession(dayIdx, sIdx, { speaker: e.target.value })} placeholder="Speaker" className="text-xs h-8" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={() => addSession(dayIdx)}>
                        <Plus className="h-3.5 w-3.5" /> Add session
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addAgendaDay}>
                <Plus className="h-3.5 w-3.5" /> Add day
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Speakers */}
      <div className="space-y-2">
        <SectionHeader label="Speakers" open={open.speakers} onToggle={() => toggle("speakers")} />
        {open.speakers && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.speakersEyebrow ?? ""} onChange={(e) => set("speakersEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.speakersHeading ?? ""} onChange={(e) => set("speakersHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Speakers</Label>
              {speakers.map((speaker, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Speaker"
                    index={i}
                    total={speakers.length}
                    onMoveUp={() => moveSpeaker(i, -1)}
                    onMoveDown={() => moveSpeaker(i, 1)}
                    onRemove={() => removeSpeaker(i)}
                  />
                  <Input value={speaker.name} onChange={(e) => setSpeaker(i, { name: e.target.value })} placeholder="Name" className="text-xs h-8" />
                  <Input value={speaker.role ?? ""} onChange={(e) => setSpeaker(i, { role: e.target.value })} placeholder="Role" className="text-xs h-8" />
                  <Input value={speaker.company ?? ""} onChange={(e) => setSpeaker(i, { company: e.target.value })} placeholder="Company" className="text-xs h-8" />
                  <ImagePicker value={speaker.photoUrl ?? ""} onChange={(v) => setSpeaker(i, { photoUrl: v })} aiHint="Speaker headshot portrait" />
                  <Textarea value={speaker.bio ?? ""} onChange={(e) => setSpeaker(i, { bio: e.target.value })} placeholder="Bio" className="text-xs min-h-16" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addSpeaker}>
                <Plus className="h-3.5 w-3.5" /> Add speaker
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Venue */}
      <div className="space-y-2">
        <SectionHeader label="Venue" open={open.venue} onToggle={() => toggle("venue")} />
        {open.venue && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.venueEyebrow ?? ""} onChange={(e) => set("venueEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.venueHeading ?? ""} onChange={(e) => set("venueHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Venue name">
              <Input value={props.venueName ?? ""} onChange={(e) => set("venueName", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Address">
              <Input value={props.venueAddress ?? ""} onChange={(e) => set("venueAddress", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Description">
              <Textarea value={props.venueDescription ?? ""} onChange={(e) => set("venueDescription", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <Field label="Venue image">
              <ImagePicker value={props.venueImageUrl ?? ""} onChange={(v) => set("venueImageUrl", v)} aiHint="Event venue photo" />
            </Field>
          </div>
        )}
      </div>

      {/* Gallery */}
      <div className="space-y-2">
        <SectionHeader label="Gallery" open={open.gallery} onToggle={() => toggle("gallery")} />
        {open.gallery && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.galleryHeading ?? ""} onChange={(e) => set("galleryHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Images</Label>
              {galleryImages.map((img, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Image"
                    index={i}
                    total={galleryImages.length}
                    onMoveUp={() => moveGalleryImage(i, -1)}
                    onMoveDown={() => moveGalleryImage(i, 1)}
                    onRemove={() => removeGalleryImage(i)}
                  />
                  <ImagePicker value={img.url} onChange={(v) => setGalleryImage(i, { url: v })} aiHint="Event gallery photo" />
                  <Input value={img.caption ?? ""} onChange={(e) => setGalleryImage(i, { caption: e.target.value })} placeholder="Caption" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addGalleryImage}>
                <Plus className="h-3.5 w-3.5" /> Add image
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sponsors */}
      <div className="space-y-2">
        <SectionHeader label="Sponsors" open={open.sponsors} onToggle={() => toggle("sponsors")} />
        {open.sponsors && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.sponsorsHeading ?? ""} onChange={(e) => set("sponsorsHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Sponsors</Label>
              {sponsors.map((sponsor, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Sponsor"
                    index={i}
                    total={sponsors.length}
                    onMoveUp={() => moveSponsor(i, -1)}
                    onMoveDown={() => moveSponsor(i, 1)}
                    onRemove={() => removeSponsor(i)}
                  />
                  <Input value={sponsor.name} onChange={(e) => setSponsor(i, { name: e.target.value })} placeholder="Name" className="text-xs h-8" />
                  <ImagePicker value={sponsor.logoUrl ?? ""} onChange={(v) => setSponsor(i, { logoUrl: v })} aiHint="Sponsor logo" />
                  <Input value={sponsor.tier ?? ""} onChange={(e) => setSponsor(i, { tier: e.target.value })} placeholder="Tier (e.g. Platinum)" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addSponsor}>
                <Plus className="h-3.5 w-3.5" /> Add sponsor
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tickets */}
      <div className="space-y-2">
        <SectionHeader label="Tickets" open={open.tickets} onToggle={() => toggle("tickets")} />
        {open.tickets && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.ticketsEyebrow ?? ""} onChange={(e) => set("ticketsEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.ticketsHeading ?? ""} onChange={(e) => set("ticketsHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Tiers</Label>
              {ticketTiers.map((tier, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Tier"
                    index={i}
                    total={ticketTiers.length}
                    onMoveUp={() => moveTier(i, -1)}
                    onMoveDown={() => moveTier(i, 1)}
                    onRemove={() => removeTier(i)}
                  />
                  <Input value={tier.name} onChange={(e) => setTier(i, { name: e.target.value })} placeholder="Name" className="text-xs h-8" />
                  <Input value={tier.price} onChange={(e) => setTier(i, { price: e.target.value })} placeholder="$0" className="text-xs h-8" />
                  <Input value={tier.period ?? ""} onChange={(e) => setTier(i, { period: e.target.value })} placeholder="per seat" className="text-xs h-8" />
                  <Textarea value={tier.description ?? ""} onChange={(e) => setTier(i, { description: e.target.value })} placeholder="Description" className="text-xs min-h-16" />
                  <Field label="Features (one per line)">
                    <Textarea
                      value={(tier.features ?? []).join("\n")}
                      onChange={(e) => setTier(i, { features: e.target.value.split("\n").map((s) => s.trimStart()).filter((s) => s.length > 0) })}
                      placeholder={"Feature one\nFeature two"}
                      className="text-xs min-h-20"
                    />
                  </Field>
                  <Input value={tier.ctaLabel ?? ""} onChange={(e) => setTier(i, { ctaLabel: e.target.value })} placeholder="CTA label" className="text-xs h-8" />
                  <Input value={tier.ctaUrl ?? ""} onChange={(e) => setTier(i, { ctaUrl: e.target.value })} placeholder="CTA URL" className="text-xs h-8" />
                  <div className="flex items-center justify-between py-1">
                    <Label className="text-xs cursor-pointer">Featured</Label>
                    <Switch checked={tier.featured ?? false} onCheckedChange={(v) => setTier(i, { featured: v })} />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addTier}>
                <Plus className="h-3.5 w-3.5" /> Add tier
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="space-y-2">
        <SectionHeader label="FAQ" open={open.faq} onToggle={() => toggle("faq")} />
        {open.faq && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.faqHeading ?? ""} onChange={(e) => set("faqHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Items</Label>
              {faqItems.map((item, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Item"
                    index={i}
                    total={faqItems.length}
                    onMoveUp={() => moveFaq(i, -1)}
                    onMoveDown={() => moveFaq(i, 1)}
                    onRemove={() => removeFaq(i)}
                  />
                  <Input value={item.question} onChange={(e) => setFaq(i, { question: e.target.value })} placeholder="Question" className="text-xs h-8" />
                  <Textarea value={item.answer} onChange={(e) => setFaq(i, { answer: e.target.value })} placeholder="Answer" className="text-xs min-h-16" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addFaq}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Registration form */}
      <div className="space-y-2">
        <SectionHeader label="Registration form" open={open.form} onToggle={() => toggle("form")} />
        {open.form && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.formEyebrow ?? ""} onChange={(e) => set("formEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.formHeading ?? ""} onChange={(e) => set("formHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Subheading">
              <Textarea value={props.formSubheading ?? ""} onChange={(e) => set("formSubheading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Submit button label">
              <Input value={props.formSubmitLabel ?? ""} onChange={(e) => set("formSubmitLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Success message">
              <Textarea value={props.formSuccessMessage ?? ""} onChange={(e) => set("formSuccessMessage", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Submit URL">
              <Input value={props.formSubmitUrl ?? ""} onChange={(e) => set("formSubmitUrl", e.target.value)} placeholder="/api/lp/leads" className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Fields</Label>
              {formFields.map((field, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Field"
                    index={i}
                    total={formFields.length}
                    onMoveUp={() => moveFormField(i, -1)}
                    onMoveDown={() => moveFormField(i, 1)}
                    onRemove={() => removeFormField(i)}
                  />
                  <Input value={field.id} onChange={(e) => setFormField(i, { id: e.target.value })} placeholder="Field id" className="text-xs h-8" />
                  <Input value={field.label} onChange={(e) => setFormField(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Field label="Type">
                    <NativeSelect
                      value={field.type}
                      onChange={(v) => setFormField(i, { type: v as EventFormFieldType })}
                      options={[
                        { value: "text", label: "Text" },
                        { value: "email", label: "Email" },
                        { value: "tel", label: "Phone" },
                        { value: "textarea", label: "Text area" },
                        { value: "select", label: "Select" },
                      ]}
                    />
                  </Field>
                  <Input value={field.placeholder ?? ""} onChange={(e) => setFormField(i, { placeholder: e.target.value })} placeholder="Placeholder" className="text-xs h-8" />
                  <div className="flex items-center justify-between py-1">
                    <Label className="text-xs cursor-pointer">Required</Label>
                    <Switch checked={field.required ?? false} onCheckedChange={(v) => setFormField(i, { required: v })} />
                  </div>
                  {field.type === "select" && (
                    <Field label="Options (one per line)">
                      <Textarea
                        value={(field.options ?? []).join("\n")}
                        onChange={(e) => setFormField(i, { options: e.target.value.split("\n").map((s) => s.trimStart()).filter((s) => s.length > 0) })}
                        placeholder={"Option one\nOption two"}
                        className="text-xs min-h-20"
                      />
                    </Field>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addFormField}>
                <Plus className="h-3.5 w-3.5" /> Add field
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-2">
        <SectionHeader label="Footer" open={open.footer} onToggle={() => toggle("footer")} />
        {open.footer && (
          <div className="space-y-3">
            <Field label="Tagline">
              <Textarea value={props.footerTagline ?? ""} onChange={(e) => set("footerTagline", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Note">
              <Input value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Footer links</Label>
              {footerLinks.map((link, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Link"
                    index={i}
                    total={footerLinks.length}
                    onMoveUp={() => moveFooterLink(i, -1)}
                    onMoveDown={() => moveFooterLink(i, 1)}
                    onRemove={() => removeFooterLink(i)}
                  />
                  <Input value={link.label} onChange={(e) => setFooterLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Input value={link.href} onChange={(e) => setFooterLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addFooterLink}>
                <Plus className="h-3.5 w-3.5" /> Add footer link
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
