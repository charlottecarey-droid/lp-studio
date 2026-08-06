import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import type {
  EventPageAgendaSectionBlockProps,
  EventPageDetailsSectionBlockProps,
  EventPageAgendaDay,
  EventPageDetail,
  EventPageTheme,
} from "@/lib/block-types";

/**
 * Panels for the standalone Event Page sections (event-page-agenda /
 * event-page-details). The theme editor mirrors EventPagePanel's "Theme &
 * Style" section (same keys, same defaults) so values can be copied verbatim
 * from an Event Page block and the sections match it — minus the nav/hero
 * keys these sections never render.
 */

const THEME_DEFAULTS = {
  bg: "#0c0f12",
  cardBg: "#141619",
  fg: "#eeeae3",
  headingColor: "#eeeae3",
  primary: "#b59a6e",
  muted: "#7a8088",
  border: "#262a2f",
  displayFontFamily: "EB Garamond",
  bodyFontFamily: "Inter",
};

function ColorRow({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string) => void }) {
  const v = (value && value.trim()) || fallback;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs flex-1">{label}</Label>
        <Input type="color" value={v} onChange={e => onChange(e.target.value)} className="h-7 w-10 p-0.5 cursor-pointer" />
        <Input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={fallback} className="text-xs h-7 w-24 font-mono" />
      </div>
      <BrandSwatches className="justify-start" current={value} onPick={onChange} />
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

function ThemeSection({
  theme,
  setTheme,
  showCardBg,
}: {
  theme: EventPageTheme;
  setTheme: (patch: Partial<EventPageTheme>) => void;
  showCardBg: boolean;
}) {
  return (
    <div className="space-y-3 pt-3 pb-4">
      <Field label="Heading Font">
        <FontSelect
          value={theme.displayFontFamily}
          onChange={(v) => setTheme({ displayFontFamily: v ?? THEME_DEFAULTS.displayFontFamily })}
          inheritLabel={`Default (${THEME_DEFAULTS.displayFontFamily})`}
        />
      </Field>
      <Field label="Body Font">
        <FontSelect
          value={theme.bodyFontFamily}
          onChange={(v) => setTheme({ bodyFontFamily: v ?? THEME_DEFAULTS.bodyFontFamily })}
          inheritLabel={`Default (${THEME_DEFAULTS.bodyFontFamily})`}
        />
      </Field>
      <ColorRow label="Background" value={theme.bg} fallback={THEME_DEFAULTS.bg} onChange={v => setTheme({ bg: v })} />
      {showCardBg && (
        <ColorRow label="Card / Panel BG" value={theme.cardBg} fallback={THEME_DEFAULTS.cardBg} onChange={v => setTheme({ cardBg: v })} />
      )}
      <ColorRow label="Body Text" value={theme.fg} fallback={THEME_DEFAULTS.fg} onChange={v => setTheme({ fg: v })} />
      <ColorRow label="Heading Text" value={theme.headingColor} fallback={THEME_DEFAULTS.headingColor} onChange={v => setTheme({ headingColor: v })} />
      <ColorRow label="Accent / Primary" value={theme.primary} fallback={THEME_DEFAULTS.primary} onChange={v => setTheme({ primary: v })} />
      <ColorRow label="Muted Text" value={theme.muted} fallback={THEME_DEFAULTS.muted} onChange={v => setTheme({ muted: v })} />
      <ColorRow label="Border" value={theme.border} fallback={THEME_DEFAULTS.border} onChange={v => setTheme({ border: v })} />
      <p className="text-[11px] text-muted-foreground">
        Same theme keys as the Event Page block — copy its values here and this section matches that page exactly.
      </p>
    </div>
  );
}

// ── Agenda section panel ─────────────────────────────────────────────────────

export function EventPageAgendaSectionPanel({
  props: p,
  onChange,
}: {
  props: EventPageAgendaSectionBlockProps;
  onChange: (props: EventPageAgendaSectionBlockProps) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ content: true, days: true, theme: false });
  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<EventPageAgendaSectionBlockProps>) => onChange({ ...p, ...patch });
  const theme: EventPageTheme = p.theme ?? {};
  const setTheme = (patch: Partial<EventPageTheme>) => set({ theme: { ...theme, ...patch } });

  const updateDay = (i: number, patch: Partial<EventPageAgendaDay>) =>
    set({ days: p.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const addDay = () => set({ days: [...p.days, { day: `Day ${p.days.length + 1}`, title: "", description: "", highlight: "" }] });
  const removeDay = (i: number) => set({ days: p.days.filter((_, idx) => idx !== i) });

  const updateValueProp = (i: number, value: string) =>
    set({ valueProps: p.valueProps.map((v, idx) => (idx === i ? value : v)) });
  const addValueProp = () => set({ valueProps: [...p.valueProps, ""] });
  const removeValueProp = (i: number) => set({ valueProps: p.valueProps.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-0 p-4">
      <SectionHeader label="Heading" open={open.content} onToggle={() => toggle("content")} />
      {open.content && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow"><Input value={p.eyebrow} onChange={e => set({ eyebrow: e.target.value })} className="text-sm" /></Field>
          <Field label="Headline"><Input value={p.headline} onChange={e => set({ headline: e.target.value })} className="text-sm" /></Field>
          <Field label="Subtitle"><Textarea value={p.subtitle} onChange={e => set({ subtitle: e.target.value })} rows={2} className="text-xs resize-none" /></Field>
          <Field label="Value Props" hint="Uppercase pills under the heading. Remove all to hide the row.">
            <div className="space-y-2">
              {p.valueProps.map((vp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={vp} onChange={e => updateValueProp(i, e.target.value)} className="h-7 text-xs" />
                  <button type="button" onClick={() => removeValueProp(i)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addValueProp}>
                <Plus className="w-3 h-3 mr-1" /> Add value prop
              </Button>
            </div>
          </Field>
        </div>
      )}

      <SectionHeader label="Days / Rows" open={open.days} onToggle={() => toggle("days")} />
      {open.days && (
        <div className="space-y-3 pt-3 pb-4">
          {p.days.map((day, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={day.day} onChange={e => updateDay(i, { day: e.target.value })} className="h-7 text-xs flex-1" placeholder="Day One" />
                <button type="button" onClick={() => removeDay(i)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
              <Input value={day.title} onChange={e => updateDay(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Title" />
              <Textarea value={day.description} onChange={e => updateDay(i, { description: e.target.value })} rows={2} className="text-xs resize-none" placeholder="Description" />
              <Textarea value={day.highlight} onChange={e => updateDay(i, { highlight: e.target.value })} rows={2} className="text-xs resize-none" placeholder="Highlight paragraph (optional)" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addDay}>
            <Plus className="w-3 h-3 mr-1" /> Add row
          </Button>
        </div>
      )}

      <SectionHeader label="Theme & Style" open={open.theme} onToggle={() => toggle("theme")} />
      {open.theme && <ThemeSection theme={theme} setTheme={setTheme} showCardBg={false} />}
    </div>
  );
}

// ── Details section panel ────────────────────────────────────────────────────

export function EventPageDetailsSectionPanel({
  props: p,
  onChange,
}: {
  props: EventPageDetailsSectionBlockProps;
  onChange: (props: EventPageDetailsSectionBlockProps) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ content: true, cells: true, theme: false });
  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<EventPageDetailsSectionBlockProps>) => onChange({ ...p, ...patch });
  const theme: EventPageTheme = p.theme ?? {};
  const setTheme = (patch: Partial<EventPageTheme>) => set({ theme: { ...theme, ...patch } });

  const updateDetail = (i: number, patch: Partial<EventPageDetail>) =>
    set({ details: p.details.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const addDetail = () => set({ details: [...p.details, { label: "", value: "", sub: "" }] });
  const removeDetail = (i: number) => set({ details: p.details.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-0 p-4">
      <SectionHeader label="Heading" open={open.content} onToggle={() => toggle("content")} />
      {open.content && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow"><Input value={p.eyebrow} onChange={e => set({ eyebrow: e.target.value })} className="text-sm" /></Field>
          <Field label="Headline"><Input value={p.headline} onChange={e => set({ headline: e.target.value })} className="text-sm" /></Field>
          <Field label="Subtitle"><Textarea value={p.subtitle} onChange={e => set({ subtitle: e.target.value })} rows={2} className="text-xs resize-none" /></Field>
        </div>
      )}

      <SectionHeader label="Detail Cells" open={open.cells} onToggle={() => toggle("cells")} />
      {open.cells && (
        <div className="space-y-3 pt-3 pb-4">
          {p.details.map((detail, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={detail.label} onChange={e => updateDetail(i, { label: e.target.value })} className="h-7 text-xs flex-1" placeholder="Label (e.g. When)" />
                <button type="button" onClick={() => removeDetail(i)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
              <Input value={detail.value} onChange={e => updateDetail(i, { value: e.target.value })} className="h-7 text-xs" placeholder="Value (e.g. Salt Lake City, UT)" />
              <Input value={detail.sub} onChange={e => updateDetail(i, { sub: e.target.value })} className="h-7 text-xs" placeholder="Sub-line (e.g. The Grand America Hotel)" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addDetail}>
            <Plus className="w-3 h-3 mr-1" /> Add cell
          </Button>
          <p className="text-[11px] text-muted-foreground">Cells lay out three across on desktop and stack on phones.</p>
        </div>
      )}

      <SectionHeader label="Theme & Style" open={open.theme} onToggle={() => toggle("theme")} />
      {open.theme && <ThemeSection theme={theme} setTheme={setTheme} showCardBg={true} />}
    </div>
  );
}
