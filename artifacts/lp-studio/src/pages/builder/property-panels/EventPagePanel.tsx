import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { ImagePicker } from "@/components/ImagePicker";
import { suggestCopy } from "@/lib/copy-api";
import type { EventPageBlockProps, EventPageAgendaDay, EventPagePhoto, EventPageDetail, EventPageNavLink } from "@/lib/block-types";
import type { FormStep, FormField, FormFieldType } from "@/lib/block-types";

interface Props {
  props: EventPageBlockProps;
  onChange: (props: EventPageBlockProps) => void;
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

export function EventPagePanel({ props: p, onChange, brandVoiceSet }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    hero: true,
    agenda: false,
    photos: false,
    details: false,
    rsvp: false,
    footer: false,
  });

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<EventPageBlockProps>) => onChange({ ...p, ...patch });

  const updateDay = (i: number, patch: Partial<EventPageAgendaDay>) => {
    const next = p.agendaDays.map((d, idx) => idx === i ? { ...d, ...patch } : d);
    set({ agendaDays: next });
  };
  const addDay = () => set({ agendaDays: [...p.agendaDays, { day: `Day ${p.agendaDays.length + 1}`, title: "", description: "", highlight: "" }] });
  const removeDay = (i: number) => set({ agendaDays: p.agendaDays.filter((_, idx) => idx !== i) });

  const updatePhoto = (i: number, patch: Partial<EventPagePhoto>) => {
    const next = p.photos.map((ph, idx) => idx === i ? { ...ph, ...patch } : ph);
    set({ photos: next });
  };
  const addPhoto = () => set({ photos: [...p.photos, { src: "", alt: "", caption: "" }] });
  const removePhoto = (i: number) => set({ photos: p.photos.filter((_, idx) => idx !== i) });

  const updateDetail = (i: number, patch: Partial<EventPageDetail>) => {
    const next = p.details.map((d, idx) => idx === i ? { ...d, ...patch } : d);
    set({ details: next });
  };
  const addDetail = () => set({ details: [...p.details, { label: "", value: "", sub: "" }] });
  const removeDetail = (i: number) => set({ details: p.details.filter((_, idx) => idx !== i) });

  const updateValueProp = (i: number, value: string) => {
    const next = p.agendaValueProps.map((v, idx) => idx === i ? value : v);
    set({ agendaValueProps: next });
  };
  const addValueProp = () => set({ agendaValueProps: [...p.agendaValueProps, ""] });
  const removeValueProp = (i: number) => set({ agendaValueProps: p.agendaValueProps.filter((_, idx) => idx !== i) });

  const updateNavLink = (i: number, patch: Partial<EventPageNavLink>) => {
    const next = p.navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    set({ navLinks: next });
  };
  const addNavLink = () => set({ navLinks: [...p.navLinks, { label: "Section", href: "#section" }] });
  const removeNavLink = (i: number) => set({ navLinks: p.navLinks.filter((_, idx) => idx !== i) });

  const updateFormStep = (si: number, patch: Partial<FormStep>) =>
    set({ formSteps: p.formSteps.map((s, idx) => idx === si ? { ...s, ...patch } : s) });
  const addFormStep = () =>
    set({ formSteps: [...p.formSteps, { title: "New Step", fields: [] }] });
  const removeFormStep = (si: number) =>
    set({ formSteps: p.formSteps.filter((_, idx) => idx !== si) });

  const updateFormField = (si: number, fi: number, patch: Partial<FormField>) => {
    const steps = p.formSteps.map((s, idx) =>
      idx === si ? { ...s, fields: s.fields.map((f, fidx) => fidx === fi ? { ...f, ...patch } : f) } : s
    );
    set({ formSteps: steps });
  };
  const addFormField = (si: number) => {
    const newField: FormField = { id: `field_${Date.now()}`, type: "text", label: "New Field", placeholder: "", required: false };
    set({ formSteps: p.formSteps.map((s, idx) => idx === si ? { ...s, fields: [...s.fields, newField] } : s) });
  };
  const removeFormField = (si: number, fi: number) => {
    set({ formSteps: p.formSteps.map((s, idx) => idx === si ? { ...s, fields: s.fields.filter((_, fidx) => fidx !== fi) } : s) });
  };

  return (
    <div className="space-y-0 p-4">

      {/* ── Hero / Nav ──────────────────────────────────────────────────────── */}
      <SectionHeader label="Hero & Nav" open={open.hero} onToggle={() => toggle("hero")} />
      {open.hero && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Event Name">
            <AiTextField type="input" value={p.eventName} onChange={v => set({ eventName: v })} fieldLabel="Event Name" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "eventName", p.eventName, {})} />
          </Field>
          <Field label="Event Subtitle" hint="Shown below the title (e.g. 'Executive Lab Experience')">
            <AiTextField type="input" value={p.eventSubtitle} onChange={v => set({ eventSubtitle: v })} fieldLabel="Event Subtitle" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "eventSubtitle", p.eventSubtitle, {})} />
          </Field>
          <Field label="Logo URL" hint="Leave blank to show event name text in nav">
            <ImagePicker value={p.logoUrl ?? ""} onChange={v => set({ logoUrl: v || undefined })} />
          </Field>
          <Field label="Nav CTA Text" hint="Button text in the sticky nav bar">
            <AiTextField type="input" value={p.navCtaText} onChange={v => set({ navCtaText: v })} fieldLabel="Nav CTA Text" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "navCtaText", p.navCtaText, {})} />
          </Field>
          <Field label="Nav CTA URL" hint="Where the nav button links (e.g. #rsvp)">
            <AiTextField type="input" value={p.navCtaUrl} onChange={v => set({ navCtaUrl: v })} fieldLabel="Nav CTA URL" brandVoiceSet={brandVoiceSet} />
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
          <Field label="Hero Eyebrow" hint="Small uppercase label at top (e.g. 'You're Invited')">
            <AiTextField type="input" value={p.heroEyebrow} onChange={v => set({ heroEyebrow: v })} fieldLabel="Hero Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "heroEyebrow", p.heroEyebrow, {})} />
          </Field>
          <Field label="Hero Image">
            <ImagePicker value={p.heroImageUrl} onChange={v => set({ heroImageUrl: v })} />
          </Field>
          <Field label="Hero Tagline">
            <AiTextField type="textarea" value={p.heroTagline} onChange={v => set({ heroTagline: v })} rows={3} fieldLabel="Hero Tagline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "heroTagline", p.heroTagline, {})} />
          </Field>
          <Field label="Location / Availability" hint="Shown in small uppercase below tagline">
            <AiTextField type="input" value={p.heroLocation} onChange={v => set({ heroLocation: v })} fieldLabel="Hero Location" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "heroLocation", p.heroLocation, {})} />
          </Field>
          <Field label="CTA Button Text">
            <AiTextField type="input" value={p.heroCtaText} onChange={v => set({ heroCtaText: v })} fieldLabel="CTA Text" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "heroCtaText", p.heroCtaText, {})} />
          </Field>
        </div>
      )}

      {/* ── Agenda ──────────────────────────────────────────────────────────── */}
      <SectionHeader label="Agenda Section" open={open.agenda} onToggle={() => toggle("agenda")} />
      {open.agenda && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.agendaEyebrow} onChange={v => set({ agendaEyebrow: v })} fieldLabel="Agenda Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "agendaEyebrow", p.agendaEyebrow, {})} />
          </Field>
          <Field label="Headline">
            <AiTextField type="input" value={p.agendaHeadline} onChange={v => set({ agendaHeadline: v })} fieldLabel="Agenda Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "agendaHeadline", p.agendaHeadline, {})} />
          </Field>
          <Field label="Subtitle">
            <AiTextField type="textarea" value={p.agendaSubtitle} onChange={v => set({ agendaSubtitle: v })} rows={2} fieldLabel="Agenda Subtitle" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "agendaSubtitle", p.agendaSubtitle, {})} />
          </Field>

          <div className="space-y-2">
            <Label className="text-xs">Value Props</Label>
            {p.agendaValueProps.map((vp, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input value={vp} onChange={e => updateValueProp(i, e.target.value)} className="h-7 text-xs flex-1" placeholder={`Value prop ${i + 1}`} />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeValueProp(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addValueProp}>
              <Plus className="w-3 h-3 mr-1" /> Add Value Prop
            </Button>
          </div>

          <div className="space-y-3">
            <Label className="text-xs">Agenda Days</Label>
            {p.agendaDays.map((day, i) => (
              <div key={i} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{day.day || `Day ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeDay(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={day.day} onChange={e => updateDay(i, { day: e.target.value })} className="h-7 text-xs" placeholder="Day One" />
                <Input value={day.title} onChange={e => updateDay(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Day title (e.g. Arrival)" />
                <Textarea value={day.description} onChange={e => updateDay(i, { description: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Main description…" />
                <Textarea value={day.highlight} onChange={e => updateDay(i, { highlight: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Highlight / secondary paragraph…" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addDay}>
              <Plus className="w-3 h-3 mr-1" /> Add Day
            </Button>
          </div>
        </div>
      )}

      {/* ── Photos ──────────────────────────────────────────────────────────── */}
      <SectionHeader label="Photo Gallery" open={open.photos} onToggle={() => toggle("photos")} />
      {open.photos && (
        <div className="space-y-3 pt-3 pb-4">
          {p.photos.map((photo, i) => (
            <div key={i} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Photo {i + 1}{photo.caption ? ` — ${photo.caption}` : ""}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removePhoto(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <ImagePicker value={photo.src} onChange={v => updatePhoto(i, { src: v })} />
              <Input value={photo.caption} onChange={e => updatePhoto(i, { caption: e.target.value })} className="h-7 text-xs" placeholder="Caption (e.g. The Grand America Hotel)" />
              <Input value={photo.alt} onChange={e => updatePhoto(i, { alt: e.target.value })} className="h-7 text-xs" placeholder="Alt text (for accessibility)" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addPhoto}>
            <Plus className="w-3 h-3 mr-1" /> Add Photo
          </Button>
        </div>
      )}

      {/* ── Details ─────────────────────────────────────────────────────────── */}
      <SectionHeader label="Details Panel" open={open.details} onToggle={() => toggle("details")} />
      {open.details && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.detailsEyebrow} onChange={v => set({ detailsEyebrow: v })} fieldLabel="Details Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "detailsEyebrow", p.detailsEyebrow, {})} />
          </Field>
          <Field label="Headline">
            <AiTextField type="input" value={p.detailsHeadline} onChange={v => set({ detailsHeadline: v })} fieldLabel="Details Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "detailsHeadline", p.detailsHeadline, {})} />
          </Field>
          <Field label="Subtitle">
            <AiTextField type="textarea" value={p.detailsSubtitle} onChange={v => set({ detailsSubtitle: v })} rows={2} fieldLabel="Details Subtitle" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "detailsSubtitle", p.detailsSubtitle, {})} />
          </Field>
          <div className="space-y-2">
            <Label className="text-xs">Detail Cards</Label>
            {p.details.map((detail, i) => (
              <div key={i} className="border border-border rounded-md p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{detail.label || `Card ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeDetail(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={detail.label} onChange={e => updateDetail(i, { label: e.target.value })} className="h-7 text-xs" placeholder="Label (e.g. When)" />
                <Input value={detail.value} onChange={e => updateDetail(i, { value: e.target.value })} className="h-7 text-xs" placeholder="Value (e.g. Rolling dates, 2026)" />
                <Input value={detail.sub} onChange={e => updateDetail(i, { sub: e.target.value })} className="h-7 text-xs" placeholder="Sub-label (e.g. Tuesday through Thursday)" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addDetail}>
              <Plus className="w-3 h-3 mr-1" /> Add Detail Card
            </Button>
          </div>
        </div>
      )}

      {/* ── RSVP / Form ─────────────────────────────────────────────────────── */}
      <SectionHeader label="RSVP Form" open={open.rsvp} onToggle={() => toggle("rsvp")} />
      {open.rsvp && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.rsvpEyebrow} onChange={v => set({ rsvpEyebrow: v })} fieldLabel="RSVP Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "rsvpEyebrow", p.rsvpEyebrow, {})} />
          </Field>
          <Field label="Headline">
            <AiTextField type="input" value={p.rsvpHeadline} onChange={v => set({ rsvpHeadline: v })} fieldLabel="RSVP Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "rsvpHeadline", p.rsvpHeadline, {})} />
          </Field>
          <Field label="Subtitle">
            <AiTextField type="textarea" value={p.rsvpSubtitle} onChange={v => set({ rsvpSubtitle: v })} rows={3} fieldLabel="RSVP Subtitle" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "rsvpSubtitle", p.rsvpSubtitle, {})} />
          </Field>
          <Field label="Submit URL" hint="Where form data is sent. Leave blank to use the built-in Dandy lead system.">
            <Input value={p.formSubmitUrl ?? ""} onChange={e => set({ formSubmitUrl: e.target.value || undefined })} className="text-xs h-7 font-mono" placeholder="https://…  (leave blank for default)" />
          </Field>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Form Steps</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addFormStep}>
                <Plus className="w-3 h-3 mr-1" /> Step
              </Button>
            </div>
            {p.formSteps.map((fStep, si) => (
              <div key={si} className="border border-border rounded p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <Input value={fStep.title} onChange={e => updateFormStep(si, { title: e.target.value })} placeholder="Step title" className="text-xs h-7 flex-1" />
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeFormStep(si)} disabled={p.formSteps.length <= 1}>
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
                          {(["text", "email", "phone", "textarea", "select"] as FormFieldType[]).map(t => (
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

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <SectionHeader label="Footer" open={open.footer} onToggle={() => toggle("footer")} />
      {open.footer && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Footer Text">
            <AiTextField type="input" value={p.footerText} onChange={v => set({ footerText: v })} fieldLabel="Footer Text" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("event-page", "footerText", p.footerText, {})} />
          </Field>
        </div>
      )}
    </div>
  );
}
