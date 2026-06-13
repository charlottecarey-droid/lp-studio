import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import type {
  OnboardingHubBlockProps,
  OnboardingPhase,
  OnboardingPhaseStatus,
  OnboardingContact,
  OnboardingChecklistItem,
  OnboardingResource,
  OnboardingResourceGroup,
  OnboardingResourceKind,
  OnboardingMetric,
} from "@/blocks/BlockOnboardingHub";

/* ----------------------------------------------------------------------------
 * Property panel for the "onboarding-hub" full-page ABM block. Collapsible
 * sections mirror the block: visibility toggles, palette, welcome hero (+ shared
 * CTA suite), onboarding plan, your team, getting-started checklist, resources &
 * training (grouped), success metrics, and support & next check-in (reuses the
 * same shared CTA suite as the hero).
 * -------------------------------------------------------------------------- */

interface Props {
  props: OnboardingHubBlockProps;
  onChange: (props: OnboardingHubBlockProps) => void;
}

const PALETTE_FB = {
  bgColor: "#F6F2E9",
  inkColor: "#1A1815",
  headlineColor: "#1B1840",
  accentColor: "#4B47E5",
  tintColor: "#6B9171",
  sparkColor: "#E26B4F",
  darkColor: "#1B1840",
};

const STATUS_OPTIONS: { value: OnboardingPhaseStatus; label: string }[] = [
  { value: "done", label: "Done (coral spark)" },
  { value: "in-progress", label: "In progress" },
  { value: "upcoming", label: "Upcoming" },
];

const KIND_OPTIONS: { value: OnboardingResourceKind; label: string }[] = [
  { value: "guide", label: "Guide" },
  { value: "video", label: "Video" },
  { value: "doc", label: "Doc" },
];

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

export function OnboardingHubPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    palette: false,
    hero: true,
    plan: false,
    team: false,
    checklist: false,
    resources: false,
    success: false,
    support: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof OnboardingHubBlockProps>(key: K, value: OnboardingHubBlockProps[K]) =>
    onChange({ ...props, [key]: value });

  /* — array helpers — */
  const setPhase = (i: number, patch: Partial<OnboardingPhase>) =>
    set("phases", props.phases.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addPhase = () =>
    set("phases", [
      ...props.phases,
      { title: "New phase", owner: "", timeframe: "", detail: "What happens here.", status: "upcoming" },
    ]);
  const removePhase = (i: number) => set("phases", props.phases.filter((_, j) => j !== i));
  const movePhase = (i: number, dir: -1 | 1) => set("phases", moveItem(props.phases, i, dir));

  const setContact = (i: number, patch: Partial<OnboardingContact>) =>
    set("contacts", props.contacts.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addContact = () =>
    set("contacts", [...props.contacts, { name: "New contact", role: "Role", blurb: "", email: "" }]);
  const removeContact = (i: number) => set("contacts", props.contacts.filter((_, j) => j !== i));
  const moveContact = (i: number, dir: -1 | 1) => set("contacts", moveItem(props.contacts, i, dir));

  const setCheck = (i: number, patch: Partial<OnboardingChecklistItem>) =>
    set("checklist", props.checklist.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addCheck = () =>
    set("checklist", [...props.checklist, { label: "New action", hint: "", done: false }]);
  const removeCheck = (i: number) => set("checklist", props.checklist.filter((_, j) => j !== i));
  const moveCheck = (i: number, dir: -1 | 1) => set("checklist", moveItem(props.checklist, i, dir));

  const setMetric = (i: number, patch: Partial<OnboardingMetric>) =>
    set("metrics", props.metrics.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addMetric = () =>
    set("metrics", [...props.metrics, { value: "0", label: "New metric", source: "" }]);
  const removeMetric = (i: number) => set("metrics", props.metrics.filter((_, j) => j !== i));
  const moveMetric = (i: number, dir: -1 | 1) => set("metrics", moveItem(props.metrics, i, dir));

  /* — resource group helpers — */
  const setGroup = (gi: number, patch: Partial<OnboardingResourceGroup>) =>
    set("resourceGroups", props.resourceGroups.map((g, j) => (j === gi ? { ...g, ...patch } : g)));
  const addGroup = () =>
    set("resourceGroups", [...props.resourceGroups, { heading: "New group", resources: [] }]);
  const removeGroup = (gi: number) =>
    set("resourceGroups", props.resourceGroups.filter((_, j) => j !== gi));
  const moveGroup = (gi: number, dir: -1 | 1) =>
    set("resourceGroups", moveItem(props.resourceGroups, gi, dir));
  const setResource = (gi: number, ri: number, patch: Partial<OnboardingResource>) =>
    setGroup(gi, {
      resources: props.resourceGroups[gi].resources.map((r, k) => (k === ri ? { ...r, ...patch } : r)),
    });
  const addResource = (gi: number) =>
    setGroup(gi, {
      resources: [...props.resourceGroups[gi].resources, { title: "New resource", meta: "", url: "#", kind: "doc" }],
    });
  const removeResource = (gi: number, ri: number) =>
    setGroup(gi, { resources: props.resourceGroups[gi].resources.filter((_, k) => k !== ri) });

  /* — shared CTA suite (hero primary + support share the same fields) — */
  const ctaSuite: CtaSuiteFields = props;
  const setCta = (next: CtaSuiteFields) => onChange({ ...props, ...next });

  const SECTION_TOGGLES: Array<{ key: keyof OnboardingHubBlockProps; label: string }> = [
    { key: "showPlan", label: "Onboarding plan" },
    { key: "showTeam", label: "Your team" },
    { key: "showChecklist", label: "Getting-started checklist" },
    { key: "showResources", label: "Resources & training" },
    { key: "showSuccess", label: "What success looks like" },
    { key: "showSupport", label: "Support & next check-in" },
  ];

  return (
    <div className="space-y-4">
      {/* Sections — show/hide */}
      <div className="space-y-2">
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground mb-2">
              Toggle which sections appear. The welcome hero is always shown.
            </p>
            {SECTION_TOGGLES.map(({ key, label }) => {
              const checked = (props[key] as boolean | undefined) !== false;
              return (
                <div key={key} className="flex items-center justify-between py-1">
                  <Label className="text-xs cursor-pointer">{label}</Label>
                  <Switch checked={checked} onCheckedChange={(v) => set(key, v as never)} />
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
            <ColorRow label="Body text" value={props.inkColor} fallback={PALETTE_FB.inkColor} onChange={(v) => set("inkColor", v)} />
            <ColorRow label="Headings" value={props.headlineColor} fallback={PALETTE_FB.headlineColor} onChange={(v) => set("headlineColor", v)} />
            <ColorRow label="Accent (actions)" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="Tint (sage bands / chrome)" value={props.tintColor} fallback={PALETTE_FB.tintColor} onChange={(v) => set("tintColor", v)} />
            <ColorRow label="Spark (completed steps)" value={props.sparkColor} fallback={PALETTE_FB.sparkColor} onChange={(v) => set("sparkColor", v)} />
            <ColorRow label="Dark sections (success + support)" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor", v)} />
            <p className="text-[11px] text-muted-foreground">
              Overrides are contrast-guarded — an unreadable text color falls back to a legible ink.
            </p>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Welcome hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Eyebrow (supports {{company_name}})">
              <Input value={props.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Account name">
              <Input value={props.accountName} onChange={(e) => set("accountName", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Headline / welcome line (the only h1)">
              <AiTextField
                value={props.headline}
                onChange={(v) => set("headline", v)}
                rows={2}
                className="text-xs"
                onSuggest={() => suggestCopy("onboarding-hub", "headline", props.headline, { accountName: props.accountName })}
                fieldLabel="Headline"
              />
            </Field>
            <Field label="Subheadline (one line)">
              <AiTextField
                value={props.subheadline ?? ""}
                onChange={(v) => set("subheadline", v)}
                rows={3}
                className="text-xs"
                onSuggest={() => suggestCopy("onboarding-hub", "subheadline", props.subheadline ?? "", { headline: props.headline })}
                fieldLabel="Subheadline"
              />
            </Field>
            <Field label="Hero image (warm team / portrait photo)">
              <ImagePicker value={props.heroImageUrl ?? ""} onChange={(v) => set("heroImageUrl", v || undefined)} aiHint="warm team or onboarding portrait photo" />
            </Field>
            <Field label="Hero image alt text">
              <Input value={props.heroImageAlt ?? ""} onChange={(e) => set("heroImageAlt", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs cursor-pointer">Show your logo</Label>
              <Switch checked={props.showLogo !== false} onCheckedChange={(v) => set("showLogo", v)} />
            </div>
            {props.showLogo !== false && (
              <>
                <Field label="Your logo override (defaults to brand logo)">
                  <ImagePicker value={props.logoUrl ?? ""} onChange={(v) => set("logoUrl", v || undefined)} aiHint="Brand logo" />
                </Field>
                <Field label="Your logo alt text">
                  <Input value={props.logoAlt ?? ""} onChange={(e) => set("logoAlt", e.target.value)} className="text-xs h-8" />
                </Field>
              </>
            )}

            {/* Shared CTA suite — hero primary + support use the same fields */}
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Primary CTA (hero + support)
              </div>
              <Field label="Primary CTA text">
                <Input value={props.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Book your kickoff call" className="text-xs h-8" />
              </Field>
              <CtaActionConfigSection value={ctaSuite} onChange={setCta} />
            </div>
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Secondary CTA (link)
              </div>
              <Field label="Secondary CTA text">
                <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => set("ctaSecondaryText", e.target.value)} placeholder="Jump to your checklist" className="text-xs h-8" />
              </Field>
              <Field label="Secondary CTA URL">
                <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => set("ctaSecondaryUrl", e.target.value)} placeholder="#checklist" className="text-xs h-8 font-mono" />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding plan */}
      <div className="space-y-2">
        <SectionHeader label="Onboarding plan" open={open.plan} onToggle={() => toggle("plan")} />
        {open.plan && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.planKicker ?? ""} onChange={(e) => set("planKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.planHeading} onChange={(e) => set("planHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.planIntro ?? ""} onChange={(e) => set("planIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Phases (4–5 best)</div>
              {props.phases.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Phase"
                    index={i}
                    total={props.phases.length}
                    onMoveUp={() => movePhase(i, -1)}
                    onMoveDown={() => movePhase(i, 1)}
                    onRemove={() => removePhase(i)}
                  />
                  <Field label="Title">
                    <Input value={s.title} onChange={(e) => setPhase(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Owner">
                      <Input value={s.owner ?? ""} onChange={(e) => setPhase(i, { owner: e.target.value })} className="text-xs h-8" />
                    </Field>
                    <Field label="Timeframe">
                      <Input value={s.timeframe ?? ""} onChange={(e) => setPhase(i, { timeframe: e.target.value })} className="text-xs h-8" />
                    </Field>
                  </div>
                  <Field label="Detail">
                    <Textarea value={s.detail ?? ""} onChange={(e) => setPhase(i, { detail: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Status">
                    <Select value={s.status} onValueChange={(v) => setPhase(i, { status: v as OnboardingPhaseStatus })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addPhase}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add phase
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Your team */}
      <div className="space-y-2">
        <SectionHeader label="Your team" open={open.team} onToggle={() => toggle("team")} />
        {open.team && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.teamKicker ?? ""} onChange={(e) => set("teamKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.teamHeading} onChange={(e) => set("teamHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.teamIntro ?? ""} onChange={(e) => set("teamIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Contacts (2–4 best)</div>
              {props.contacts.map((c, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Contact"
                    index={i}
                    total={props.contacts.length}
                    onMoveUp={() => moveContact(i, -1)}
                    onMoveDown={() => moveContact(i, 1)}
                    onRemove={() => removeContact(i)}
                  />
                  <Field label="Name">
                    <Input value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Role">
                    <Input value={c.role} onChange={(e) => setContact(i, { role: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Blurb (optional)">
                    <Textarea value={c.blurb ?? ""} onChange={(e) => setContact(i, { blurb: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Email (optional)">
                    <Input value={c.email ?? ""} onChange={(e) => setContact(i, { email: e.target.value })} className="text-xs h-8 font-mono" />
                  </Field>
                  <Field label="Avatar (warm grayscale portrait)">
                    <ImagePicker value={c.avatarUrl ?? ""} onChange={(v) => setContact(i, { avatarUrl: v || undefined })} aiHint="warm grayscale professional headshot" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addContact}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add contact
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Getting-started checklist */}
      <div className="space-y-2">
        <SectionHeader label="Getting-started checklist" open={open.checklist} onToggle={() => toggle("checklist")} />
        {open.checklist && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.checklistKicker ?? ""} onChange={(e) => set("checklistKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.checklistHeading} onChange={(e) => set("checklistHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.checklistIntro ?? ""} onChange={(e) => set("checklistIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              {props.checklist.map((item, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Action"
                    index={i}
                    total={props.checklist.length}
                    onMoveUp={() => moveCheck(i, -1)}
                    onMoveDown={() => moveCheck(i, 1)}
                    onRemove={() => removeCheck(i)}
                  />
                  <Field label="Action">
                    <Input value={item.label} onChange={(e) => setCheck(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Hint (optional)">
                    <Textarea value={item.hint ?? ""} onChange={(e) => setCheck(i, { hint: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <div className="flex items-center justify-between py-1">
                    <Label className="text-xs cursor-pointer">Completed (coral spark)</Label>
                    <Switch checked={!!item.done} onCheckedChange={(v) => setCheck(i, { done: v })} />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addCheck}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add action
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Resources & training */}
      <div className="space-y-2">
        <SectionHeader label="Resources & training" open={open.resources} onToggle={() => toggle("resources")} />
        {open.resources && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.resourcesKicker ?? ""} onChange={(e) => set("resourcesKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.resourcesHeading} onChange={(e) => set("resourcesHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Only real assets — these render exactly as provided, nothing is fabricated.
            </p>
            <div className="space-y-3 pt-1">
              {props.resourceGroups.map((group, gi) => (
                <div key={gi} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Group"
                    index={gi}
                    total={props.resourceGroups.length}
                    onMoveUp={() => moveGroup(gi, -1)}
                    onMoveDown={() => moveGroup(gi, 1)}
                    onRemove={() => removeGroup(gi)}
                  />
                  <Field label="Group heading">
                    <Input value={group.heading} onChange={(e) => setGroup(gi, { heading: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <div className="space-y-2 pl-2 border-l border-border">
                    {group.resources.map((r, ri) => (
                      <div key={ri} className="space-y-2 p-2 border border-border rounded">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Resource {ri + 1}</div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeResource(gi, ri)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Field label="Title">
                          <Input value={r.title} onChange={(e) => setResource(gi, ri, { title: e.target.value })} className="text-xs h-8" />
                        </Field>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Meta (e.g. 5 min read)">
                            <Input value={r.meta ?? ""} onChange={(e) => setResource(gi, ri, { meta: e.target.value })} className="text-xs h-8" />
                          </Field>
                          <Field label="Kind">
                            <Select value={r.kind ?? "doc"} onValueChange={(v) => setResource(gi, ri, { kind: v as OnboardingResourceKind })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {KIND_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        <Field label="Link URL">
                          <Input value={r.url} onChange={(e) => setResource(gi, ri, { url: e.target.value })} className="text-xs h-8 font-mono" />
                        </Field>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => addResource(gi)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add resource
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addGroup}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add group
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* What success looks like */}
      <div className="space-y-2">
        <SectionHeader label="What success looks like" open={open.success} onToggle={() => toggle("success")} />
        {open.success && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.successKicker ?? ""} onChange={(e) => set("successKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.successHeading} onChange={(e) => set("successHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.successIntro ?? ""} onChange={(e) => set("successIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Numeric values count up on scroll. Keep them honest — no invented stats.
            </p>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Metrics (3–4 best)</div>
              {props.metrics.map((m, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Metric"
                    index={i}
                    total={props.metrics.length}
                    onMoveUp={() => moveMetric(i, -1)}
                    onMoveDown={() => moveMetric(i, 1)}
                    onRemove={() => removeMetric(i)}
                  />
                  <Field label='Value (e.g. "30 days", "90%")'>
                    <Input value={m.value} onChange={(e) => setMetric(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Label">
                    <Input value={m.label} onChange={(e) => setMetric(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Context (optional)">
                    <Input value={m.source ?? ""} onChange={(e) => setMetric(i, { source: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addMetric}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add metric
              </Button>
            </div>
            <Field label="Count-up duration (ms)">
              <Input
                type="number"
                value={props.countUpMs ?? 1400}
                onChange={(e) => set("countUpMs", Number(e.target.value) || 1400)}
                className="text-xs h-8"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Support & next check-in */}
      <div className="space-y-2">
        <SectionHeader label="Support & next check-in" open={open.support} onToggle={() => toggle("support")} />
        {open.support && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.supportKicker ?? ""} onChange={(e) => set("supportKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.supportHeading} onChange={(e) => set("supportHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.supportIntro ?? ""} onChange={(e) => set("supportIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              The support CTA repeats the hero's primary CTA — edit it under Welcome hero → Primary CTA.
            </p>
            <Field label="Footer note (optional)">
              <Textarea value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs min-h-14" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingHubPanel;
