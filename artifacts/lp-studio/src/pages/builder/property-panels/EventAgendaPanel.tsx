import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Link2, Link2Off, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BrandSwatches } from "@/components/BrandSwatches";
import { ImagePicker } from "@/components/ImagePicker";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { ApplyCtaToAllButton } from "./ApplyCtaToAllButton";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { LibraryPicker } from "@/components/LibraryPicker";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import type {
  EventAgendaBlockProps,
  EvaDay,
  EvaSession,
  EvaSectionId,
  EvaClamp,
  EvaPerson,
  EvaSponsor,
  EvaResource,
} from "@/blocks/BlockEventAgenda";
import { EVA_SECTION_ORDER } from "@/blocks/BlockEventAgenda";

/* ----------------------------------------------------------------------------
 * Property panel for the "event-agenda" full-page block. Collapsible sections
 * mirror the block: visibility toggles, navbar + hero (event lockup, meta),
 * palette, personal note, the day-by-day schedule (days array with nested
 * session editors incl. the per-account "why this matters" line + reserved
 * flag), and the close CTA (shared CTA suite).
 *
 * Agenda pages published from the Sales Console are assembled server-side
 * (routes/sales/events.ts) — this panel is for hand-tuning a published page
 * or authoring one from scratch in the builder.
 * -------------------------------------------------------------------------- */

interface Props {
  props: EventAgendaBlockProps;
  onChange: (props: EventAgendaBlockProps) => void;
  onApplyCtaToAll?: () => void;
}

const PALETTE_FB = {
  bgColor: "#F7F4EC",
  inkColor: "#1A1815",
  headlineColor: "#221E3F",
  accentColor: "#4B47E5",
  heroBgColor: "#100E24",
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

/** Headline alignment + scale + layout pickers, shared by the content sections
 *  so each one can be tuned without them all looking alike. */
function SectionStyleRow({
  align, onAlign, size, onSize, layout,
}: {
  align: "left" | "center" | undefined;
  onAlign: (v: "left" | "center") => void;
  size: "sm" | "md" | "lg" | "xl" | undefined;
  onSize: (v: "sm" | "md" | "lg" | "xl") => void;
  layout?: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label?: string };
}) {
  return (
    <div className="space-y-2 border rounded-md p-2.5">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Headline align">
          <Select value={align ?? "left"} onValueChange={(v) => onAlign(v as "left" | "center")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Headline size">
          <Select value={size ?? "lg"} onValueChange={(v) => onSize(v as "sm" | "md" | "lg" | "xl")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="md">Medium</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
              <SelectItem value="xl">Extra large</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {layout && (
        <Field label={layout.label ?? "Layout"}>
          <Select value={layout.value} onValueChange={layout.onChange}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {layout.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

const EMPTY_SESSION: EvaSession = { time: "", title: "New session" };
const EMPTY_DAY: EvaDay = { label: "New day", sessions: [] };

const API_BASE = "/api";

interface GlobalFormSummary {
  id: number;
  name: string;
}

export function EventAgendaPanel({ props, onChange, onApplyCtaToAll }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    readability: false,
    hero: true,
    palette: false,
    note: false,
    schedule: true,
    team: false,
    speakers: false,
    guest: false,
    sponsors: false,
    resources: false,
    order: false,
    rsvp: false,
    close: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof EventAgendaBlockProps>(key: K, value: EventAgendaBlockProps[K]) =>
    onChange({ ...props, [key]: value });

  // Global forms for the RSVP "linked form" picker (mirrors ChatCapturePanel).
  /** Sales Reps library picker for the account team (same library the
   *  dso-meet-team block uses — one directory, not a second copy). */
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [globalForms, setGlobalForms] = useState<GlobalFormSummary[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/lp/forms`).then((r) => r.json()).then((data: GlobalFormSummary[]) => setGlobalForms(data)).catch(() => {});
  }, []);
  const linkedForm = globalForms.find((f) => f.id === props.rsvpFormId);

  const ctaSuite: CtaSuiteFields = props;
  const setCta = (next: CtaSuiteFields) => onChange({ ...props, ...next });

  const setDay = (i: number, patch: Partial<EvaDay>) =>
    set("days", props.days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setSession = (dayIdx: number, i: number, patch: Partial<EvaSession>) =>
    setDay(dayIdx, {
      sessions: props.days[dayIdx].sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });

  /* ── list helpers for the four content sections ── */
  type ListKey = "team" | "speakers" | "sponsors" | "resources";
  const list = <K extends ListKey>(key: K): NonNullable<EventAgendaBlockProps[K]> =>
    (props[key] ?? []) as NonNullable<EventAgendaBlockProps[K]>;
  const setList = <K extends ListKey>(key: K, next: NonNullable<EventAgendaBlockProps[K]>) =>
    set(key, next as EventAgendaBlockProps[K]);
  const patchItem = <K extends ListKey>(
    key: K,
    i: number,
    patch: Partial<NonNullable<EventAgendaBlockProps[K]>[number]>,
  ) =>
    setList(key, list(key).map((item, j) => (j === i ? { ...item, ...patch } : item)) as NonNullable<EventAgendaBlockProps[K]>);
  const removeItem = (key: ListKey, i: number) =>
    setList(key, list(key).filter((_, j) => j !== i) as never);
  const moveListItem = (key: ListKey, i: number, dir: -1 | 1) =>
    setList(key, moveItem(list(key) as unknown[], i, dir) as never);

  /**
   * Section order shown in the panel: the author's saved order first, then any
   * section they haven't placed yet — mirrors the block's own resolution so the
   * list always matches what renders.
   */
  const orderedSections: EvaSectionId[] = (() => {
    const saved = (props.sectionOrder ?? []).filter((id) => EVA_SECTION_ORDER.includes(id));
    const seen = new Set(saved);
    return [...saved, ...EVA_SECTION_ORDER.filter((id) => !seen.has(id))];
  })();
  const SECTION_LABELS: Record<EvaSectionId, string> = {
    note: "Personal note",
    team: "Account team",
    speakers: "Keynote speakers",
    guest: "Special guest",
    schedule: "Schedule",
    sponsors: "Sponsors",
    resources: "Resources",
    rsvp: "RSVP",
  };
  const moveSection = (i: number, dir: -1 | 1) =>
    set("sectionOrder", moveItem(orderedSections, i, dir));

  return (
    <div className="space-y-3">
      {/* ── Sections ── */}
      <div>
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="pt-2.5 space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Hero</Label>
                <Switch checked={props.showHero !== false} onCheckedChange={(v) => set("showHero", v)} />
              </div>
              {props.showHero === false && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Hero and navbar are hidden — add your own hero block above this one and the page starts at the note/schedule.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Navbar</Label>
              <Switch checked={props.showNavbar !== false} onCheckedChange={(v) => set("showNavbar", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Personal note</Label>
              <Switch checked={props.showNote !== false} onCheckedChange={(v) => set("showNote", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Account team</Label>
              <Switch checked={props.showTeam !== false} onCheckedChange={(v) => set("showTeam", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Keynote speakers</Label>
              <Switch checked={props.showSpeakers !== false} onCheckedChange={(v) => set("showSpeakers", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Sponsors</Label>
              <Switch checked={props.showSponsors !== false} onCheckedChange={(v) => set("showSponsors", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Resources</Label>
              <Switch checked={props.showResources !== false} onCheckedChange={(v) => set("showResources", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">RSVP form</Label>
              <Switch checked={props.showRsvp === true} onCheckedChange={(v) => set("showRsvp", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Contact close</Label>
              <Switch checked={props.showClose !== false} onCheckedChange={(v) => set("showClose", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Add-to-calendar button</Label>
              <Switch checked={props.showAddToCalendar !== false} onCheckedChange={(v) => set("showAddToCalendar", v)} />
            </div>
          </div>
        )}
      </div>

      {/* ── Readability ──
          A 30-session agenda with full abstracts is a wall of text. These trim
          what a reader wades through without deleting anything: the clamps are
          CSS-only, so export, print and search engines still get the full copy,
          and the toggles are reversible. Clamping is suspended while you're in
          the builder so you can always see what you're editing. */}
      <div>
        <SectionHeader label="Readability" open={open.readability} onToggle={() => toggle("readability")} />
        {open.readability && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Session descriptions">
              <Select
                value={props.descriptionLines ?? "3"}
                onValueChange={(v) => set("descriptionLines", v as EvaClamp)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Trim to 2 lines</SelectItem>
                  <SelectItem value="3">Trim to 3 lines</SelectItem>
                  <SelectItem value="4">Trim to 4 lines</SelectItem>
                  <SelectItem value="full">Show in full</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Speaker bios">
              <Select
                value={props.bioLines ?? "3"}
                onValueChange={(v) => set("bioLines", v as EvaClamp)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Trim to 2 lines</SelectItem>
                  <SelectItem value="3">Trim to 3 lines</SelectItem>
                  <SelectItem value="4">Trim to 4 lines</SelectItem>
                  <SelectItem value="full">Show in full</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Trimming only affects what's shown — the full text still ships in the
              page for export, print and search. You'll see it in full while editing.
            </p>
            <div className="flex items-center justify-between">
              <Label className="text-xs">&ldquo;Why this matters&rdquo; callout</Label>
              <Switch checked={props.showWhyAttend !== false} onCheckedChange={(v) => set("showWhyAttend", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Session type &amp; track labels</Label>
              <Switch checked={props.showSessionMeta !== false} onCheckedChange={(v) => set("showSessionMeta", v)} />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              &ldquo;Reserved for you&rdquo; always stays — it's the personalization the
              page exists for.
            </p>
          </div>
        )}
      </div>

      {/* ── Hero ── */}
      <div>
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Event lockup (eyebrow)">
              <Input value={props.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Summit 2026 · Austin, TX · Mar 10–12" className="text-xs h-8" />
            </Field>
            <Field label="Headline">
              <Textarea value={props.headline} onChange={(e) => set("headline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.subheadline ?? ""} onChange={(e) => set("subheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <Field label="Account name">
              <Input value={props.accountName} onChange={(e) => set("accountName", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Event name">
                <Input value={props.eventName ?? ""} onChange={(e) => set("eventName", e.target.value)} className="text-xs h-8" />
              </Field>
              <Field label="Location">
                <Input value={props.eventLocation ?? ""} onChange={(e) => set("eventLocation", e.target.value)} className="text-xs h-8" />
              </Field>
            </div>
            <Field label="Dates label">
              <Input value={props.eventDates ?? ""} onChange={(e) => set("eventDates", e.target.value)} placeholder="Mar 10–12, 2026" className="text-xs h-8" />
            </Field>

            {/* ── hero secondary button ── */}
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Second hero button
              </div>
              <Field label="Action">
                <Select
                  value={props.heroSecondaryAction ?? "calendar"}
                  onValueChange={(v) => set("heroSecondaryAction", v as NonNullable<EventAgendaBlockProps["heroSecondaryAction"]>)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar">Add all to calendar (default)</SelectItem>
                    <SelectItem value="video">Play a video</SelectItem>
                    <SelectItem value="link">Link somewhere else</SelectItem>
                    <SelectItem value="none">No second button</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {(props.heroSecondaryAction ?? "calendar") !== "none" && (
                <Field label="Button label">
                  <Input
                    value={props.heroSecondaryLabel ?? ""}
                    onChange={(e) => set("heroSecondaryLabel", e.target.value || undefined)}
                    placeholder={
                      props.heroSecondaryAction === "video" ? "Watch the trailer"
                      : props.heroSecondaryAction === "link" ? "Learn more"
                      : "Add all to calendar"
                    }
                    className="text-xs h-8"
                  />
                </Field>
              )}
              {props.heroSecondaryAction === "video" && (
                <Field label="Video URL">
                  <Input
                    value={props.heroSecondaryVideoUrl ?? ""}
                    onChange={(e) => set("heroSecondaryVideoUrl", e.target.value)}
                    placeholder="YouTube, Vimeo or an .mp4"
                    className="text-xs h-8"
                  />
                </Field>
              )}
              {props.heroSecondaryAction === "link" && (
                <Field label="Link URL">
                  <Input
                    value={props.heroSecondaryUrl ?? ""}
                    onChange={(e) => set("heroSecondaryUrl", e.target.value)}
                    placeholder="https://…"
                    className="text-xs h-8"
                  />
                </Field>
              )}
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                The calendar button only appears when your agenda has real dates and
                times on it.
              </p>
            </div>

            {/* ── hero stat strip ──
                The numerals are computed from the agenda, so they can't be
                typed over — but each can be switched off and its label
                rewritten. Turn all three off and the location stands alone. */}
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Hero stats
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Counts come from the agenda itself. Switch them all off to show just
                the location. Clear the location or dates field to drop those too.
              </p>
              {([
                ["showStatSessions", "statSessionsLabel", "Session count", "sessions picked for you"],
                ["showStatDays", "statDaysLabel", "Day count", "days"],
                ["showStatReserved", "statReservedLabel", "Reserved count", "reserved just for you"],
              ] as const).map(([showKey, labelKey, title, placeholder]) => (
                <div key={showKey} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{title}</Label>
                    <Switch
                      checked={props[showKey] !== false}
                      onCheckedChange={(v) => set(showKey, v)}
                    />
                  </div>
                  {props[showKey] !== false && (
                    <Input
                      value={props[labelKey] ?? ""}
                      onChange={(e) => set(labelKey, e.target.value || undefined)}
                      placeholder={placeholder}
                      className="text-xs h-8"
                    />
                  )}
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Leave a label empty to keep the built-in wording, which follows the
                count (&ldquo;1 day&rdquo; vs &ldquo;3 days&rdquo;).
              </p>
            </div>
            <Field label="Account logo URL (navbar co-brand)">
              <Input value={props.accountLogoUrl ?? ""} onChange={(e) => set("accountLogoUrl", e.target.value)} placeholder="https://…/logo.svg" className="text-xs h-8" />
            </Field>
            <Field label="Logo size (header + footer)">
              <Select
                value={props.logoSize ?? "md"}
                onValueChange={(v) => set("logoSize", v as EventAgendaBlockProps["logoSize"])}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium (default)</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                  <SelectItem value="xl">Extra large</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hero image">
              <ImagePicker
                value={props.heroImageUrl ?? ""}
                onChange={(url) => set("heroImageUrl", url)}
                label="Hero image"
                placeholder="https://…/venue.jpg"
              />
            </Field>
            <Field label="Hero layout">
              <Select
                value={props.heroLayout ?? "__auto__"}
                onValueChange={(v) => set("heroLayout", v === "__auto__" ? undefined : (v as EventAgendaBlockProps["heroLayout"]))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Auto (split when an image is set)</SelectItem>
                  <SelectItem value="split">Split — image panel beside the copy</SelectItem>
                  <SelectItem value="image-overlay">Full-bleed image with overlay</SelectItem>
                  <SelectItem value="dark">Dark band (no image)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Image layouts need a hero image — without one they fall back to the dark band.
              </p>
            </Field>
          </div>
        )}
      </div>

      {/* ── Palette ── */}
      <div>
        <SectionHeader label="Palette" open={open.palette} onToggle={() => toggle("palette")} />
        {open.palette && (
          <div className="pt-2.5 space-y-2">
            <ColorRow label="Page" value={props.bgColor} fallback={PALETTE_FB.bgColor} onChange={(v) => set("bgColor", v)} />
            <ColorRow label="Headings" value={props.headlineColor} fallback={PALETTE_FB.headlineColor} onChange={(v) => set("headlineColor", v)} />
            <ColorRow label="Accent" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="Hero / close" value={props.heroBgColor} fallback={PALETTE_FB.heroBgColor} onChange={(v) => set("heroBgColor", v)} />
          </div>
        )}
      </div>

      {/* ── Personal note ── */}
      <div>
        <SectionHeader label="Personal note" open={open.note} onToggle={() => toggle("note")} />
        {open.note && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Kicker">
              <Input value={props.noteKicker ?? ""} onChange={(e) => set("noteKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Note">
              <Textarea value={props.personalNote ?? ""} onChange={(e) => set("personalNote", e.target.value)} rows={5} className="text-xs" />
            </Field>
            <Field label="Signature">
              <Input value={props.noteSignature ?? ""} onChange={(e) => set("noteSignature", e.target.value)} placeholder="— Your account team" className="text-xs h-8" />
            </Field>
            <Field label="Photo (optional — your team, last year's event)">
              <ImagePicker
                value={props.noteImageUrl ?? ""}
                onChange={(url) => set("noteImageUrl", url)}
                label="Note photo"
                placeholder="https://…/team.jpg"
              />
            </Field>
          </div>
        )}
      </div>

      {/* ── Schedule ── */}
      <div>
        <SectionHeader label="Schedule" open={open.schedule} onToggle={() => toggle("schedule")} />
        {open.schedule && (
          <div className="pt-2.5 space-y-3">
            <Field label="Kicker">
              <Input value={props.scheduleKicker ?? ""} onChange={(e) => set("scheduleKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.scheduleHeading ?? ""} onChange={(e) => set("scheduleHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Intro">
              <Textarea value={props.scheduleIntro ?? ""} onChange={(e) => set("scheduleIntro", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <Field label='"Why this matters" label'>
              <Input value={props.whyAttendLabel ?? ""} onChange={(e) => set("whyAttendLabel", e.target.value)} placeholder="Why this matters for you" className="text-xs h-8" />
            </Field>
            <Field label="Day navigation">
              <Select
                value={props.dayNav ?? "off"}
                onValueChange={(v) => set("dayNav", v as NonNullable<EventAgendaBlockProps["dayNav"]>)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">None (default)</SelectItem>
                  <SelectItem value="anchors">Sticky bar — jumps to a day</SelectItem>
                  <SelectItem value="tabs">Sticky tabs — one day at a time</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Only appears on a multi-day agenda. You&rsquo;ll still see every day here
              in the builder, and the exported HTML always contains all of them.
            </p>

            {props.days.map((day, dayIdx) => (
              <div key={dayIdx} className="space-y-2 border rounded-md p-2.5">
                <ArrayItemHeader
                  label="Day"
                  index={dayIdx}
                  total={props.days.length}
                  onMoveUp={() => set("days", moveItem(props.days, dayIdx, -1))}
                  onMoveDown={() => set("days", moveItem(props.days, dayIdx, 1))}
                  onRemove={() => set("days", props.days.filter((_, j) => j !== dayIdx))}
                />
                <Field label="Day label">
                  <Input value={day.label} onChange={(e) => setDay(dayIdx, { label: e.target.value })} placeholder="Tuesday, Mar 10" className="text-xs h-8" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Calendar date (.ics)">
                    <Input type="date" value={day.date ?? ""} onChange={(e) => setDay(dayIdx, { date: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Summary">
                    <Input value={day.summary ?? ""} onChange={(e) => setDay(dayIdx, { summary: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
                <Field label="Day banner image (optional)">
                  <ImagePicker
                    value={day.imageUrl ?? ""}
                    onChange={(url) => setDay(dayIdx, { imageUrl: url })}
                    label={`${day.label} banner`}
                    placeholder="https://…/day.jpg"
                  />
                </Field>

                {day.sessions.map((session, i) => (
                  <div key={i} className="space-y-2 border rounded-md p-2 bg-muted/30">
                    <ArrayItemHeader
                      label="Session"
                      index={i}
                      total={day.sessions.length}
                      onMoveUp={() => setDay(dayIdx, { sessions: moveItem(day.sessions, i, -1) })}
                      onMoveDown={() => setDay(dayIdx, { sessions: moveItem(day.sessions, i, 1) })}
                      onRemove={() => setDay(dayIdx, { sessions: day.sessions.filter((_, j) => j !== i) })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Time">
                        <Input value={session.time ?? ""} onChange={(e) => setSession(dayIdx, i, { time: e.target.value })} placeholder="9:00 AM – 10:00 AM" className="text-xs h-8" />
                      </Field>
                      <Field label="Room">
                        <Input value={session.room ?? ""} onChange={(e) => setSession(dayIdx, i, { room: e.target.value })} className="text-xs h-8" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Start (.ics)">
                        <Input type="time" value={session.startTime ?? ""} onChange={(e) => setSession(dayIdx, i, { startTime: e.target.value })} className="text-xs h-8" />
                      </Field>
                      <Field label="End (.ics)">
                        <Input type="time" value={session.endTime ?? ""} onChange={(e) => setSession(dayIdx, i, { endTime: e.target.value })} className="text-xs h-8" />
                      </Field>
                    </div>
                    <Field label="Title">
                      <Input value={session.title} onChange={(e) => setSession(dayIdx, i, { title: e.target.value })} className="text-xs h-8" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Type">
                        <Input value={session.sessionType ?? ""} onChange={(e) => setSession(dayIdx, i, { sessionType: e.target.value })} placeholder="Workshop" className="text-xs h-8" />
                      </Field>
                      <Field label="Track">
                        <Input value={session.track ?? ""} onChange={(e) => setSession(dayIdx, i, { track: e.target.value })} className="text-xs h-8" />
                      </Field>
                    </div>
                    <Field label="Description">
                      <Textarea value={session.description ?? ""} onChange={(e) => setSession(dayIdx, i, { description: e.target.value })} rows={2} className="text-xs" />
                    </Field>
                    <Field label="Why this matters (personalized)">
                      <Textarea value={session.whyAttend ?? ""} onChange={(e) => setSession(dayIdx, i, { whyAttend: e.target.value })} rows={2} className="text-xs" />
                    </Field>
                    <Field label="Speakers (Name · Title, one per line)">
                      <Textarea
                        value={(session.speakers ?? []).map((s) => (s.title ? `${s.name} · ${s.title}` : s.name)).join("\n")}
                        onChange={(e) =>
                          setSession(dayIdx, i, {
                            speakers: e.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .map((line) => {
                                const [name, ...rest] = line.split("·").map((p) => p.trim());
                                return { name, title: rest.join(" · ") || undefined };
                              }),
                          })
                        }
                        rows={2}
                        className="text-xs"
                      />
                    </Field>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Reserved for the account</Label>
                      <Switch checked={session.isReserved === true} onCheckedChange={(v) => setSession(dayIdx, i, { isReserved: v })} />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setDay(dayIdx, { sessions: [...day.sessions, { ...EMPTY_SESSION }] })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add session
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => set("days", [...props.days, { ...EMPTY_DAY }])}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add day
            </Button>
          </div>
        )}
      </div>

      {/* ── Section order ── */}
      <div>
        <SectionHeader label="Section order" open={open.order} onToggle={() => toggle("order")} />
        {open.order && (
          <div className="pt-2.5 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              Drag-free reordering of the page body. The hero and contact close always bookend the page.
            </p>
            {orderedSections.map((id, i) => (
              <div key={id} className="flex items-center gap-2 border rounded-md px-2.5 py-1.5">
                <span className="text-[11px] tabular-nums text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs flex-1">{SECTION_LABELS[id]}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => moveSection(i, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={i === orderedSections.length - 1}
                  onClick={() => moveSection(i, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {props.sectionOrder && props.sectionOrder.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => set("sectionOrder", undefined)}>
                Reset to default order
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Account team ── */}
      <div>
        <SectionHeader label="Account team" open={open.team} onToggle={() => toggle("team")} />
        {open.team && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Kicker">
              <Input value={props.teamKicker ?? ""} onChange={(e) => set("teamKicker", e.target.value)} placeholder="Your account team" className="text-xs h-8" />
            </Field>
            <Field label="Headline">
              <Input value={props.teamHeading ?? ""} onChange={(e) => set("teamHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.teamSubheadline ?? ""} onChange={(e) => set("teamSubheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <SectionStyleRow
              align={props.teamAlign ?? "center"}
              onAlign={(v) => set("teamAlign", v)}
              size={props.teamHeadingSize}
              onSize={(v) => set("teamHeadingSize", v)}
              layout={{
                value: props.teamLayout ?? "roster",
                onChange: (v) => set("teamLayout", v as NonNullable<EventAgendaBlockProps["teamLayout"]>),
                options: [
                  { value: "roster", label: "Roster — large portraits, contact underneath" },
                  { value: "compact", label: "Compact — portrait beside the copy" },
                ],
              }}
            />

            <SectionBackgroundControl
              backgroundStyle={props.teamBackgroundStyle}
              bgColor={props.teamBgColor}
              defaultBgColor="#F7F4EC"
              label="Section background"
              onChange={(patch) =>
                onChange({
                  ...props,
                  ...("backgroundStyle" in patch ? { teamBackgroundStyle: patch.backgroundStyle } : {}),
                  ...("bgColor" in patch ? { teamBgColor: patch.bgColor } : {}),
                })
              }
            />
            <Field label="Columns">
              <Select
                value={String(props.teamColumns ?? 3)}
                onValueChange={(v) => set("teamColumns", Number(v) as 2 | 3 | 4)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 across</SelectItem>
                  <SelectItem value="3">3 across (default)</SelectItem>
                  <SelectItem value="4">4 across</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Portrait shape">
              <Select
                value={props.teamPortraitShape ?? "circle"}
                onValueChange={(v) => set("teamPortraitShape", v as NonNullable<EventAgendaBlockProps["teamPortraitShape"]>)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="rounded">Rounded — follows the page corner radius</SelectItem>
                  <SelectItem value="square">Square — hard corners</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {list("team").map((person, i) => (
              <div key={i} className="space-y-2 border rounded-md p-2.5">
                <ArrayItemHeader
                  label="Person"
                  index={i}
                  total={list("team").length}
                  onMoveUp={() => moveListItem("team", i, -1)}
                  onMoveDown={() => moveListItem("team", i, 1)}
                  onRemove={() => removeItem("team", i)}
                />
                <Field label="Name">
                  <Input value={person.name} onChange={(e) => patchItem("team", i, { name: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Role">
                  <Input value={person.title ?? ""} onChange={(e) => patchItem("team", i, { title: e.target.value })} className="text-xs h-8" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Email">
                    <Input value={person.email ?? ""} onChange={(e) => patchItem("team", i, { email: e.target.value })} placeholder="name@company.com" className="text-xs h-8" />
                  </Field>
                  <Field label="Phone">
                    <Input value={person.phone ?? ""} onChange={(e) => patchItem("team", i, { phone: e.target.value })} placeholder="+1 (415) 555-0142" className="text-xs h-8" />
                  </Field>
                </div>
                {/* No bio field: the reader knows their own account team. Keynote
                    speakers keep theirs. */}
                <Field label="Headshot">
                  <ImagePicker
                    value={person.imageUrl ?? ""}
                    onChange={(url) => patchItem("team", i, { imageUrl: url })}
                    label={`${person.name || "Team member"} headshot`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Link label">
                    <Input value={person.linkLabel ?? ""} onChange={(e) => patchItem("team", i, { linkLabel: e.target.value })} placeholder="Book time" className="text-xs h-8" />
                  </Field>
                  <Field label="Link URL">
                    <Input value={person.linkUrl ?? ""} onChange={(e) => patchItem("team", i, { linkUrl: e.target.value })} placeholder="#contact" className="text-xs h-8" />
                  </Field>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setList("team", [...list("team"), { name: "New person" } as EvaPerson])}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add person
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setTeamPickerOpen(true)}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" /> Add from Sales Reps library
            </Button>
          </div>
        )}
      </div>

      {/* ── Keynote speakers ── */}
      <div>
        <SectionHeader label="Keynote speakers" open={open.speakers} onToggle={() => toggle("speakers")} />
        {open.speakers && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Kicker">
              <Input value={props.speakersKicker ?? ""} onChange={(e) => set("speakersKicker", e.target.value)} placeholder="Keynotes" className="text-xs h-8" />
            </Field>
            <Field label="Headline">
              <Input value={props.speakersHeading ?? ""} onChange={(e) => set("speakersHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.speakersSubheadline ?? ""} onChange={(e) => set("speakersSubheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <SectionStyleRow
              align={props.speakersAlign}
              onAlign={(v) => set("speakersAlign", v)}
              size={props.speakersHeadingSize ?? "xl"}
              onSize={(v) => set("speakersHeadingSize", v)}
              layout={{
                value: props.speakersLayout ?? "feature",
                onChange: (v) => set("speakersLayout", v as NonNullable<EventAgendaBlockProps["speakersLayout"]>),
                options: [
                  { value: "feature", label: "Feature rows — alternating, big bios" },
                  { value: "grid", label: "Grid — 3-up for long line-ups" },
                ],
              }}
            />

            <SectionBackgroundControl
              backgroundStyle={props.speakersBackgroundStyle}
              bgColor={props.speakersBgColor}
              defaultBgColor="#F7F4EC"
              label="Section background"
              onChange={(patch) =>
                onChange({
                  ...props,
                  ...("backgroundStyle" in patch ? { speakersBackgroundStyle: patch.backgroundStyle } : {}),
                  ...("bgColor" in patch ? { speakersBgColor: patch.bgColor } : {}),
                })
              }
            />
            <Field label="Portrait shape">
              <Select
                value={props.speakersPortraitShape ?? "rounded"}
                onValueChange={(v) => set("speakersPortraitShape", v as NonNullable<EventAgendaBlockProps["speakersPortraitShape"]>)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="rounded">Rounded — follows the page corner radius</SelectItem>
                  <SelectItem value="square">Square — hard corners</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {list("speakers").map((person, i) => (
              <div key={i} className="space-y-2 border rounded-md p-2.5">
                <ArrayItemHeader
                  label="Speaker"
                  index={i}
                  total={list("speakers").length}
                  onMoveUp={() => moveListItem("speakers", i, -1)}
                  onMoveDown={() => moveListItem("speakers", i, 1)}
                  onRemove={() => removeItem("speakers", i)}
                />
                <Field label="Name">
                  <Input value={person.name} onChange={(e) => patchItem("speakers", i, { name: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Title">
                  <Input value={person.title ?? ""} onChange={(e) => patchItem("speakers", i, { title: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Bio">
                  <Textarea value={person.bio ?? ""} onChange={(e) => patchItem("speakers", i, { bio: e.target.value })} rows={2} className="text-xs" />
                </Field>
                <Field label="Their session">
                  <Input value={person.sessionTitle ?? ""} onChange={(e) => patchItem("speakers", i, { sessionTitle: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Headshot">
                  <ImagePicker
                    value={person.imageUrl ?? ""}
                    onChange={(url) => patchItem("speakers", i, { imageUrl: url })}
                    label={`${person.name || "Speaker"} headshot`}
                  />
                </Field>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setList("speakers", [...list("speakers"), { name: "New speaker" } as EvaPerson])}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add speaker
            </Button>
          </div>
        )}
      </div>

      {/* ── Special guest ── */}
      <div>
        <SectionHeader label="Special guest" open={open.guest} onToggle={() => toggle("guest")} />
        {open.guest && (
          <div className="pt-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show section</Label>
              <Switch checked={props.showGuest !== false} onCheckedChange={(v) => set("showGuest", v)} />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              The musical act, comedian or surprise headliner. Leave the name empty
              and the section stays off your published page.
            </p>
            <Field label="Kicker">
              <Input value={props.guestKicker ?? ""} onChange={(e) => set("guestKicker", e.target.value)} placeholder="After hours" className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.guestHeading ?? ""} onChange={(e) => set("guestHeading", e.target.value)} placeholder="Your special guest" className="text-xs h-8" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.guestSubheadline ?? ""} onChange={(e) => set("guestSubheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <SectionStyleRow
              align={props.guestAlign ?? "left"}
              onAlign={(v) => set("guestAlign", v)}
              size={props.guestHeadingSize}
              onSize={(v) => set("guestHeadingSize", v)}
            />
            <SectionBackgroundControl
              backgroundStyle={props.guestBackgroundStyle}
              bgColor={props.guestBgColor}
              onChange={(patch) =>
                onChange({
                  ...props,
                  ...("backgroundStyle" in patch ? { guestBackgroundStyle: patch.backgroundStyle } : {}),
                  ...("bgColor" in patch ? { guestBgColor: patch.bgColor } : {}),
                })
              }
            />
            <Field label="Name (the act)">
              <Input value={props.guestName ?? ""} onChange={(e) => set("guestName", e.target.value)} placeholder="The Northern Sound" className="text-xs h-8" />
            </Field>
            <Field label="Billing line">
              <Input value={props.guestRole ?? ""} onChange={(e) => set("guestRole", e.target.value)} placeholder="Grammy-winning duo" className="text-xs h-8" />
            </Field>
            <Field label="When &amp; where">
              <Input value={props.guestMeta ?? ""} onChange={(e) => set("guestMeta", e.target.value)} placeholder="Wednesday, 8:00 PM · The Rooftop" className="text-xs h-8" />
            </Field>
            <Field label="Photo">
              <ImagePicker
                value={props.guestImageUrl ?? ""}
                onChange={(url) => set("guestImageUrl", url)}
              />
            </Field>
            <Field label="Bio">
              <Textarea value={props.guestBio ?? ""} onChange={(e) => set("guestBio", e.target.value)} rows={3} className="text-xs" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Link label">
                <Input value={props.guestLinkLabel ?? ""} onChange={(e) => set("guestLinkLabel", e.target.value)} placeholder="Listen" className="text-xs h-8" />
              </Field>
              <Field label="Link URL">
                <Input value={props.guestLinkUrl ?? ""} onChange={(e) => set("guestLinkUrl", e.target.value)} placeholder="https://…" className="text-xs h-8" />
              </Field>
            </div>
            <Field label="Video URL (plays in a lightbox instead)">
              <Input value={props.guestVideoUrl ?? ""} onChange={(e) => set("guestVideoUrl", e.target.value)} placeholder="YouTube, Vimeo or an .mp4" className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/* ── Sponsors ── */}
      <div>
        <SectionHeader label="Sponsors" open={open.sponsors} onToggle={() => toggle("sponsors")} />
        {open.sponsors && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Kicker">
              <Input value={props.sponsorsKicker ?? ""} onChange={(e) => set("sponsorsKicker", e.target.value)} placeholder="Partners" className="text-xs h-8" />
            </Field>
            <Field label="Headline">
              <Input value={props.sponsorsHeading ?? ""} onChange={(e) => set("sponsorsHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.sponsorsSubheadline ?? ""} onChange={(e) => set("sponsorsSubheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <SectionStyleRow
              align={props.sponsorsAlign ?? "center"}
              onAlign={(v) => set("sponsorsAlign", v)}
              size={props.sponsorsHeadingSize ?? "md"}
              onSize={(v) => set("sponsorsHeadingSize", v)}
              layout={{
                value: props.sponsorsLayout ?? "wall",
                onChange: (v) => set("sponsorsLayout", v as NonNullable<EventAgendaBlockProps["sponsorsLayout"]>),
                options: [
                  { value: "wall", label: "Wall — grouped by tier, no plates" },
                  { value: "plates", label: "Plates — bordered tiles" },
                ],
              }}
            />

            <SectionBackgroundControl
              backgroundStyle={props.sponsorsBackgroundStyle}
              bgColor={props.sponsorsBgColor}
              defaultBgColor="#F7F4EC"
              label="Section background"
              onChange={(patch) =>
                onChange({
                  ...props,
                  ...("backgroundStyle" in patch ? { sponsorsBackgroundStyle: patch.backgroundStyle } : {}),
                  ...("bgColor" in patch ? { sponsorsBgColor: patch.bgColor } : {}),
                })
              }
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Tinted band</Label>
              <Switch checked={props.sponsorsBand !== false} onCheckedChange={(v) => set("sponsorsBand", v)} />
            </div>
            {/* One size for ALL sponsor marks — sponsor logos come in at wildly
                different intrinsic sizes and per-sponsor sizing is the fiddly
                work this replaces. */}
            <Field label="Logo size (all sponsors)">
              <Select
                value={props.sponsorLogoSize ?? "md"}
                onValueChange={(v) => set("sponsorLogoSize", v as NonNullable<EventAgendaBlockProps["sponsorLogoSize"]>)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium (default)</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                  <SelectItem value="xl">Extra large</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Names under logos</Label>
              <Switch checked={props.showSponsorNames === true} onCheckedChange={(v) => set("showSponsorNames", v)} />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              A sponsor with no logo already shows its name as the mark, so it
              won&rsquo;t be printed twice.
            </p>
            {list("sponsors").map((sponsor, i) => (
              <div key={i} className="space-y-2 border rounded-md p-2.5">
                <ArrayItemHeader
                  label="Sponsor"
                  index={i}
                  total={list("sponsors").length}
                  onMoveUp={() => moveListItem("sponsors", i, -1)}
                  onMoveDown={() => moveListItem("sponsors", i, 1)}
                  onRemove={() => removeItem("sponsors", i)}
                />
                <Field label="Name">
                  <Input value={sponsor.name} onChange={(e) => patchItem("sponsors", i, { name: e.target.value })} className="text-xs h-8" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Tier">
                    <Input value={sponsor.tier ?? ""} onChange={(e) => patchItem("sponsors", i, { tier: e.target.value })} placeholder="Founding partner" className="text-xs h-8" />
                  </Field>
                  <Field label="Link">
                    <Input value={sponsor.url ?? ""} onChange={(e) => patchItem("sponsors", i, { url: e.target.value })} placeholder="https://…" className="text-xs h-8" />
                  </Field>
                </div>
                <Field label="Logo (falls back to the name)">
                  <ImagePicker
                    value={sponsor.logoUrl ?? ""}
                    onChange={(url) => patchItem("sponsors", i, { logoUrl: url })}
                    label={`${sponsor.name || "Sponsor"} logo`}
                    /* Browse opens straight onto the Logos library rather than
                       the whole photo library. */
                    libraryTag="logo"
                  />
                </Field>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setList("sponsors", [...list("sponsors"), { name: "New sponsor" } as EvaSponsor])}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add sponsor
            </Button>
          </div>
        )}
      </div>

      {/* ── Resources ── */}
      <div>
        <SectionHeader label="Resources" open={open.resources} onToggle={() => toggle("resources")} />
        {open.resources && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Kicker">
              <Input value={props.resourcesKicker ?? ""} onChange={(e) => set("resourcesKicker", e.target.value)} placeholder="Before you go" className="text-xs h-8" />
            </Field>
            <Field label="Headline">
              <Input value={props.resourcesHeading ?? ""} onChange={(e) => set("resourcesHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.resourcesSubheadline ?? ""} onChange={(e) => set("resourcesSubheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <SectionStyleRow
              align={props.resourcesAlign}
              onAlign={(v) => set("resourcesAlign", v)}
              size={props.resourcesHeadingSize ?? "md"}
              onSize={(v) => set("resourcesHeadingSize", v)}
              layout={{
                value: props.resourcesLayout ?? "index",
                onChange: (v) => set("resourcesLayout", v as NonNullable<EventAgendaBlockProps["resourcesLayout"]>),
                options: [
                  { value: "index", label: "Index — numbered contents list" },
                  { value: "cards", label: "Cards — 2-up grid" },
                ],
              }}
            />

            <SectionBackgroundControl
              backgroundStyle={props.resourcesBackgroundStyle}
              bgColor={props.resourcesBgColor}
              defaultBgColor="#F7F4EC"
              label="Section background"
              onChange={(patch) =>
                onChange({
                  ...props,
                  ...("backgroundStyle" in patch ? { resourcesBackgroundStyle: patch.backgroundStyle } : {}),
                  ...("bgColor" in patch ? { resourcesBgColor: patch.bgColor } : {}),
                })
              }
            />
            {list("resources").map((resource, i) => (
              <div key={i} className="space-y-2 border rounded-md p-2.5">
                <ArrayItemHeader
                  label="Resource"
                  index={i}
                  total={list("resources").length}
                  onMoveUp={() => moveListItem("resources", i, -1)}
                  onMoveDown={() => moveListItem("resources", i, 1)}
                  onRemove={() => removeItem("resources", i)}
                />
                <Field label="Title">
                  <Input value={resource.title} onChange={(e) => patchItem("resources", i, { title: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Description">
                  <Textarea value={resource.description ?? ""} onChange={(e) => patchItem("resources", i, { description: e.target.value })} rows={2} className="text-xs" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kind">
                    <Input value={resource.kind ?? ""} onChange={(e) => patchItem("resources", i, { kind: e.target.value })} placeholder="PDF" className="text-xs h-8" />
                  </Field>
                  <Field label="Link">
                    <Input value={resource.url ?? ""} onChange={(e) => patchItem("resources", i, { url: e.target.value })} placeholder="https://…" className="text-xs h-8" />
                  </Field>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setList("resources", [...list("resources"), { title: "New resource" } as EvaResource])}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add resource
            </Button>
          </div>
        )}
      </div>

      {/* ── RSVP ── */}
      <div>
        <SectionHeader label="RSVP" open={open.rsvp} onToggle={() => toggle("rsvp")} />
        {open.rsvp && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Form">
              <div className="flex items-center gap-2">
                <Select
                  value={props.rsvpFormId != null ? String(props.rsvpFormId) : "__builtin__"}
                  onValueChange={(v) => set("rsvpFormId", v === "__builtin__" ? undefined : parseInt(v, 10))}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Built-in RSVP (name + email)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__builtin__">
                      <span className="flex items-center gap-1.5"><Link2Off className="w-3.5 h-3.5" />Built-in RSVP (name + email)</span>
                    </SelectItem>
                    {globalForms.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        <span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" />{f.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <a href="/forms" target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Button size="sm" variant="outline" type="button" className="h-8 text-xs">Manage</Button>
                </a>
              </div>
            </Field>
            {linkedForm ? (
              <p className="text-[11px] text-green-600 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Linked to "{linkedForm.name}" — fields, notifications, and integrations managed on the form.
              </p>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                Built-in capture: submissions land in Leads with Source "Agenda RSVP". Enable the section under Sections.
              </div>
            )}
            <Field label="Kicker">
              <Input value={props.rsvpKicker ?? ""} onChange={(e) => set("rsvpKicker", e.target.value)} placeholder="RSVP" className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.rsvpHeading ?? ""} onChange={(e) => set("rsvpHeading", e.target.value)} placeholder="Confirm your spot" className="text-xs h-8" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.rsvpSubheadline ?? ""} onChange={(e) => set("rsvpSubheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Button text">
                <Input value={props.rsvpButtonText ?? ""} onChange={(e) => set("rsvpButtonText", e.target.value)} placeholder="Confirm my RSVP" className="text-xs h-8" />
              </Field>
              <Field label="Confirmation">
                <Input value={props.rsvpConfirmation ?? ""} onChange={(e) => set("rsvpConfirmation", e.target.value)} className="text-xs h-8" />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* ── Close ── */}
      <div>
        <SectionHeader label="Contact close" open={open.close} onToggle={() => toggle("close")} />
        {open.close && (
          <div className="pt-2.5 space-y-2.5">
            <Field label="Headline">
              <Input value={props.ctaHeadline ?? ""} onChange={(e) => set("ctaHeadline", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Subheadline">
              <Textarea value={props.ctaSubheadline ?? ""} onChange={(e) => set("ctaSubheadline", e.target.value)} rows={2} className="text-xs" />
            </Field>
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Primary CTA (navbar + close)
              </div>
              <Field label="CTA text">
                <Input value={props.ctaText ?? ""} onChange={(e) => set("ctaText", e.target.value)} placeholder="Get in touch" className="text-xs h-8" />
              </Field>
              <CtaActionConfigSection value={ctaSuite} onChange={setCta} />
              <ApplyCtaToAllButton onApplyCtaToAll={onApplyCtaToAll} disabled={!props.ctaText && !props.ctaUrl} />
            </div>
            <Field label="Background image (optional, heavily dimmed)">
              <ImagePicker
                value={props.closeImageUrl ?? ""}
                onChange={(url) => set("closeImageUrl", url)}
                label="Close background"
                placeholder="https://…/venue-night.jpg"
              />
            </Field>
            <Field label="Footer note">
              <Input value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/*
        The account team comes from the SAME Sales Reps library the
        dso-meet-team block uses, so a rep is maintained in one place. The
        library's shape is close but not identical to EvaPerson — `role` is our
        `title`, `photo` is our `imageUrl`, and `chilipiperUrl` is a booking
        link, so it becomes `linkUrl` with a sensible default label.
      */}
      <LibraryPicker
        open={teamPickerOpen}
        onClose={() => setTeamPickerOpen(false)}
        type="team_member"
        title="Sales Reps Library"
        onSelect={(items) => {
          const added = items.map((c) => {
            const booking = String(c.chilipiperUrl ?? c.calendlyUrl ?? "").trim();
            const person: EvaPerson = { name: String(c.name ?? "").trim() || "New person" };
            const title = String(c.role ?? "").trim();
            const email = String(c.email ?? "").trim();
            const phone = String(c.phone ?? "").trim();
            const photo = String(c.photo ?? "").trim();
            if (title) person.title = title;
            if (email) person.email = email;
            if (phone) person.phone = phone;
            if (photo) person.imageUrl = photo;
            if (booking) {
              person.linkUrl = booking;
              person.linkLabel = "Book time";
            }
            return person;
          });
          setList("team", [...list("team"), ...added]);
        }}
        renderPreview={(item) => {
          const c = item.content as { role?: string; email?: string };
          return (
            <div className="text-xs text-muted-foreground">
              {c.role && <span className="font-medium text-foreground/70">{c.role}</span>}
              {c.role && c.email && <span className="mx-1">·</span>}
              {c.email && <span>{c.email}</span>}
            </div>
          );
        }}
      />
    </div>
  );
}
