import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BrandSwatches } from "@/components/BrandSwatches";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { ApplyCtaToAllButton } from "./ApplyCtaToAllButton";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import type {
  EventAgendaBlockProps,
  EvaDay,
  EvaSession,
} from "@/blocks/BlockEventAgenda";

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

const EMPTY_SESSION: EvaSession = { time: "", title: "New session" };
const EMPTY_DAY: EvaDay = { label: "New day", sessions: [] };

export function EventAgendaPanel({ props, onChange, onApplyCtaToAll }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    hero: true,
    palette: false,
    note: false,
    schedule: true,
    close: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof EventAgendaBlockProps>(key: K, value: EventAgendaBlockProps[K]) =>
    onChange({ ...props, [key]: value });

  const ctaSuite: CtaSuiteFields = props;
  const setCta = (next: CtaSuiteFields) => onChange({ ...props, ...next });

  const setDay = (i: number, patch: Partial<EvaDay>) =>
    set("days", props.days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setSession = (dayIdx: number, i: number, patch: Partial<EvaSession>) =>
    setDay(dayIdx, {
      sessions: props.days[dayIdx].sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });

  return (
    <div className="space-y-3">
      {/* ── Sections ── */}
      <div>
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="pt-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Navbar</Label>
              <Switch checked={props.showNavbar !== false} onCheckedChange={(v) => set("showNavbar", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Personal note</Label>
              <Switch checked={props.showNote !== false} onCheckedChange={(v) => set("showNote", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Contact close</Label>
              <Switch checked={props.showClose !== false} onCheckedChange={(v) => set("showClose", v)} />
            </div>
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
            <Field label="Account logo URL (navbar co-brand)">
              <Input value={props.accountLogoUrl ?? ""} onChange={(e) => set("accountLogoUrl", e.target.value)} placeholder="https://…/logo.svg" className="text-xs h-8" />
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
                <Field label="Summary">
                  <Input value={day.summary ?? ""} onChange={(e) => setDay(dayIdx, { summary: e.target.value })} className="text-xs h-8" />
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
            <Field label="Footer note">
              <Input value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
