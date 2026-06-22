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
import { ApplyCtaToAllButton } from "./ApplyCtaToAllButton";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import type {
  AccountMicrositeBlockProps,
  AccountMicrositeBriefItem,
  AccountMicrositeReason,
  AccountMicrositePhase,
  AccountMicrositeUseCase,
  AccountMicrositePersonaValue,
  AccountMicrositeCaseStudy,
  AccountMicrositeLogo,
  AccountMicrositeResource,
  AccountMicrositePlanStep,
  AccountMicrositeTeamMember,
  AccountMicrositeStepStatus,
} from "@/blocks/BlockAccountMicrosite";

/* ----------------------------------------------------------------------------
 * Property panel for the "account-microsite" full-page ABM block. Collapsible
 * sections mirror the block: visibility toggles, navbar/hero (+ shared CTA
 * suite), palette, account brief, why-now, recommended approach, use cases,
 * value by persona, proof, resources, mutual action plan, account team, and the
 * close (reuses the same shared CTA suite as the hero).
 * -------------------------------------------------------------------------- */

interface Props {
  props: AccountMicrositeBlockProps;
  onChange: (props: AccountMicrositeBlockProps) => void;
  /** Sales/microsite-scoped: copy this block's CTA to every other CTA on the
   *  page. Wired by BuilderEditor only on microsites; undefined elsewhere. */
  onApplyCtaToAll?: () => void;
}

const PALETTE_FB = {
  bgColor: "#F7F5F0",
  inkColor: "#1A1815",
  headlineColor: "#1B1840",
  accentColor: "#4B47E5",
  sparkColor: "#E26B4F",
  darkColor: "#1B1840",
};

const STATUS_OPTIONS: { value: AccountMicrositeStepStatus; label: string }[] = [
  { value: "done", label: "Done (coral spark)" },
  { value: "in-progress", label: "In progress" },
  { value: "upcoming", label: "Upcoming" },
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

export function AccountMicrositePanel({ props, onChange, onApplyCtaToAll }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    chrome: true,
    palette: false,
    hero: true,
    brief: false,
    why: false,
    approach: false,
    useCases: false,
    persona: false,
    proof: false,
    resources: false,
    plan: false,
    team: false,
    close: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof AccountMicrositeBlockProps>(key: K, value: AccountMicrositeBlockProps[K]) =>
    onChange({ ...props, [key]: value });

  /* — navbar anchor links — */
  const navLinks = props.navLinks ?? [];
  const setNavLink = (i: number, patch: Partial<{ label: string; href: string }>) =>
    set("navLinks", navLinks.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addNavLink = () => set("navLinks", [...navLinks, { label: "New link", href: "#why" }]);
  const removeNavLink = (i: number) => set("navLinks", navLinks.filter((_, j) => j !== i));
  const moveNavLink = (i: number, dir: -1 | 1) => set("navLinks", moveItem(navLinks, i, dir));

  /* — array helpers — */
  const setBriefItem = (i: number, patch: Partial<AccountMicrositeBriefItem>) =>
    set("briefItems", props.briefItems.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addBriefItem = () => set("briefItems", [...props.briefItems, { label: "New", value: "" }]);
  const removeBriefItem = (i: number) => set("briefItems", props.briefItems.filter((_, j) => j !== i));
  const moveBriefItem = (i: number, dir: -1 | 1) => set("briefItems", moveItem(props.briefItems, i, dir));

  const setReason = (i: number, patch: Partial<AccountMicrositeReason>) =>
    set("reasons", props.reasons.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addReason = () => set("reasons", [...props.reasons, { title: "New reason", detail: "Why this matters." }]);
  const removeReason = (i: number) => set("reasons", props.reasons.filter((_, j) => j !== i));
  const moveReason = (i: number, dir: -1 | 1) => set("reasons", moveItem(props.reasons, i, dir));

  const setPhase = (i: number, patch: Partial<AccountMicrositePhase>) =>
    set("phases", props.phases.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addPhase = () => set("phases", [...props.phases, { title: "New phase", timeframe: "", detail: "What happens here." }]);
  const removePhase = (i: number) => set("phases", props.phases.filter((_, j) => j !== i));
  const movePhase = (i: number, dir: -1 | 1) => set("phases", moveItem(props.phases, i, dir));

  const setUseCase = (i: number, patch: Partial<AccountMicrositeUseCase>) =>
    set("useCases", props.useCases.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addUseCase = () => set("useCases", [...props.useCases, { title: "New use case", detail: "How it helps.", metric: "" }]);
  const removeUseCase = (i: number) => set("useCases", props.useCases.filter((_, j) => j !== i));
  const moveUseCase = (i: number, dir: -1 | 1) => set("useCases", moveItem(props.useCases, i, dir));

  const setPersona = (i: number, patch: Partial<AccountMicrositePersonaValue>) =>
    set("personaValues", props.personaValues.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addPersona = () => set("personaValues", [...props.personaValues, { role: "New role", name: "", gets: "What they get." }]);
  const removePersona = (i: number) => set("personaValues", props.personaValues.filter((_, j) => j !== i));
  const movePersona = (i: number, dir: -1 | 1) => set("personaValues", moveItem(props.personaValues, i, dir));

  const setCaseStudy = (i: number, patch: Partial<AccountMicrositeCaseStudy>) =>
    set("caseStudies", props.caseStudies.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addCaseStudy = () =>
    set("caseStudies", [...props.caseStudies, { name: "Customer", result: "The headline result.", quote: "", attribution: "" }]);
  const removeCaseStudy = (i: number) => set("caseStudies", props.caseStudies.filter((_, j) => j !== i));
  const moveCaseStudy = (i: number, dir: -1 | 1) => set("caseStudies", moveItem(props.caseStudies, i, dir));

  const setLogo = (i: number, patch: Partial<AccountMicrositeLogo>) =>
    set("logos", props.logos.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addLogo = () => set("logos", [...props.logos, { name: "New logo" }]);
  const removeLogo = (i: number) => set("logos", props.logos.filter((_, j) => j !== i));

  const setResource = (i: number, patch: Partial<AccountMicrositeResource>) =>
    set("resources", props.resources.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addResource = () => set("resources", [...props.resources, { title: "New document", type: "PDF", url: "#" }]);
  const removeResource = (i: number) => set("resources", props.resources.filter((_, j) => j !== i));
  const moveResource = (i: number, dir: -1 | 1) => set("resources", moveItem(props.resources, i, dir));

  const setStep = (i: number, patch: Partial<AccountMicrositePlanStep>) =>
    set("planSteps", props.planSteps.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addStep = () =>
    set("planSteps", [...props.planSteps, { title: "New step", owner: "", date: "", detail: "What happens here.", status: "upcoming" }]);
  const removeStep = (i: number) => set("planSteps", props.planSteps.filter((_, j) => j !== i));
  const moveStep = (i: number, dir: -1 | 1) => set("planSteps", moveItem(props.planSteps, i, dir));

  const setMember = (i: number, patch: Partial<AccountMicrositeTeamMember>) =>
    set("teamMembers", props.teamMembers.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addMember = () => set("teamMembers", [...props.teamMembers, { name: "New person", role: "", note: "" }]);
  const removeMember = (i: number) => set("teamMembers", props.teamMembers.filter((_, j) => j !== i));
  const moveMember = (i: number, dir: -1 | 1) => set("teamMembers", moveItem(props.teamMembers, i, dir));

  /* — shared CTA suite (hero primary + close share the same fields) — */
  const ctaSuite: CtaSuiteFields = props;
  const setCta = (next: CtaSuiteFields) => onChange({ ...props, ...next });

  const SECTION_TOGGLES: Array<{ key: keyof AccountMicrositeBlockProps; label: string }> = [
    { key: "showBrief", label: "Account brief card" },
    { key: "showWhy", label: "Why this matters now" },
    { key: "showApproach", label: "Recommended approach" },
    { key: "showUseCases", label: "Relevant use cases" },
    { key: "showPersona", label: "Value by persona" },
    { key: "showProof", label: "Proof for this buyer" },
    { key: "showResources", label: "Recommended resources" },
    { key: "showPlan", label: "Mutual action plan" },
    { key: "showTeam", label: "Account team" },
    { key: "showClose", label: "Close (scheduling CTA)" },
  ];

  return (
    <div className="space-y-4">
      {/* Sections — show/hide */}
      <div className="space-y-2">
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground mb-2">
              Toggle which sections appear. The hero is always shown.
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

      {/* Navbar & hero */}
      <div className="space-y-2">
        <SectionHeader label="Navbar & hero" open={open.chrome} onToggle={() => toggle("chrome")} />
        {open.chrome && (
          <div className="space-y-3 pt-1">
            <Field label="Hero layout (never plain white)">
              <select
                value={props.heroLayout ?? "split"}
                onChange={(e) => set("heroLayout", e.target.value as never)}
                className="w-full text-xs h-8 rounded-md border border-border bg-background px-2"
              >
                <option value="split">Split — dark panel + image</option>
                <option value="image-overlay">Image with brand scrim</option>
                <option value="dark">Dark band (no image)</option>
              </select>
            </Field>
            <Field label="Hero image (beside the headline, optional)">
              <ImagePicker value={props.heroImageUrl ?? ""} onChange={(v) => set("heroImageUrl", v || undefined)} aiHint="Two teams aligning on a shared plan" />
            </Field>
            <Field label="Hero image alt text">
              <Input value={props.heroImageAlt ?? ""} onChange={(e) => set("heroImageAlt", e.target.value)} className="text-xs h-8" />
            </Field>
            <ColorRow label="Hero background" value={props.heroBgColor} fallback="#1B1840" onChange={(v) => set("heroBgColor", v)} />
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs cursor-pointer">Show top navbar</Label>
              <Switch checked={props.showNavbar !== false} onCheckedChange={(v) => set("showNavbar", v)} />
            </div>
            {props.showNavbar !== false && (
              <>
                <Field label="Navbar CTA text (defaults to hero CTA)">
                  <Input value={props.navCtaText ?? ""} onChange={(e) => set("navCtaText", e.target.value)} placeholder={props.ctaText} className="text-xs h-8" />
                </Field>
                <Field label="Navbar CTA URL / anchor">
                  <Input value={props.navCtaUrl ?? ""} onChange={(e) => set("navCtaUrl", e.target.value)} placeholder="#close" className="text-xs h-8" />
                </Field>
                <p className="text-[11px] text-muted-foreground">The account + your logos also form the navbar lockup.</p>
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Anchor links (0–4) — ids: #why, #approach, #plan, #close</div>
                  {navLinks.map((l, i) => (
                    <div key={i} className="space-y-2 p-2 border border-border rounded">
                      <ArrayItemHeader label="Link" index={i} total={navLinks.length} onMoveUp={() => moveNavLink(i, -1)} onMoveDown={() => moveNavLink(i, 1)} onRemove={() => removeNavLink(i)} />
                      <Field label="Label"><Input value={l.label} onChange={(e) => setNavLink(i, { label: e.target.value })} className="text-xs h-8" /></Field>
                      <Field label="Anchor / URL"><Input value={l.href} onChange={(e) => setNavLink(i, { href: e.target.value })} className="text-xs h-8" /></Field>
                    </div>
                  ))}
                  {navLinks.length < 4 && (
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={addNavLink}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add anchor link
                    </Button>
                  )}
                </div>
              </>
            )}
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
            <ColorRow label="Accent (markers / actions)" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="Spark (done / next-step)" value={props.sparkColor} fallback={PALETTE_FB.sparkColor} onChange={(v) => set("sparkColor", v)} />
            <ColorRow label="Dark sections (close)" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor", v)} />
            <p className="text-[11px] text-muted-foreground">
              Overrides are contrast-guarded — an unreadable text color falls back to a legible ink.
            </p>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Eyebrow (supports {{company_name}})">
              <Input value={props.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Account name">
                <Input value={props.accountName} onChange={(e) => set("accountName", e.target.value)} className="text-xs h-8" />
              </Field>
              <Field label="Your company name">
                <Input value={props.yourName} onChange={(e) => set("yourName", e.target.value)} className="text-xs h-8" />
              </Field>
            </div>
            <Field label="Account logo (optional — left of the ×)">
              <ImagePicker value={props.accountLogoUrl ?? ""} onChange={(v) => set("accountLogoUrl", v || undefined)} aiHint="account / customer logo" />
            </Field>
            <Field label="Account logo alt text">
              <Input value={props.accountLogoAlt ?? ""} onChange={(e) => set("accountLogoAlt", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs cursor-pointer">Show your logo (right of ×)</Label>
              <Switch checked={props.showYourLogo !== false} onCheckedChange={(v) => set("showYourLogo", v)} />
            </div>
            {props.showYourLogo !== false && (
              <>
                <Field label="Your logo override (defaults to brand logo)">
                  <ImagePicker value={props.yourLogoUrl ?? ""} onChange={(v) => set("yourLogoUrl", v || undefined)} aiHint="Brand logo" />
                </Field>
                <Field label="Your logo alt text">
                  <Input value={props.yourLogoAlt ?? ""} onChange={(e) => set("yourLogoAlt", e.target.value)} className="text-xs h-8" />
                </Field>
              </>
            )}
            <Field label="Headline / thesis (the only h1)">
              <AiTextField
                value={props.headline}
                onChange={(v) => set("headline", v)}
                rows={2}
                className="text-xs"
                onSuggest={() => suggestCopy("account-microsite", "headline", props.headline, { accountName: props.accountName, yourName: props.yourName })}
                fieldLabel="Headline"
              />
            </Field>
            <Field label="Subheadline (one line)">
              <AiTextField
                value={props.subheadline ?? ""}
                onChange={(v) => set("subheadline", v)}
                rows={3}
                className="text-xs"
                onSuggest={() => suggestCopy("account-microsite", "subheadline", props.subheadline ?? "", { headline: props.headline })}
                fieldLabel="Subheadline"
              />
            </Field>

            {/* Shared CTA suite — hero primary + close use the same fields */}
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Primary CTA (hero + close)
              </div>
              <Field label="Primary CTA text">
                <Input value={props.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Book a working session" className="text-xs h-8" />
              </Field>
              <CtaActionConfigSection value={ctaSuite} onChange={setCta} />
              <ApplyCtaToAllButton
                onApplyCtaToAll={onApplyCtaToAll}
                disabled={!props.ctaText && !props.ctaUrl}
              />
            </div>
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Secondary CTA (link)
              </div>
              <Field label="Secondary CTA text">
                <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => set("ctaSecondaryText", e.target.value)} placeholder="Forward to your team" className="text-xs h-8" />
              </Field>
              <Field label="Secondary CTA URL">
                <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => set("ctaSecondaryUrl", e.target.value)} placeholder="#" className="text-xs h-8 font-mono" />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Account brief */}
      <div className="space-y-2">
        <SectionHeader label="Account brief" open={open.brief} onToggle={() => toggle("brief")} />
        {open.brief && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.briefHeading ?? ""} onChange={(e) => set("briefHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Brief rows (2–5) — values support {"{{company_name}}"}</div>
              {props.briefItems.map((it, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Row" index={i} total={props.briefItems.length} onMoveUp={() => moveBriefItem(i, -1)} onMoveDown={() => moveBriefItem(i, 1)} onRemove={() => removeBriefItem(i)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Label"><Input value={it.label} onChange={(e) => setBriefItem(i, { label: e.target.value })} className="text-xs h-8" /></Field>
                    <Field label="Value"><Input value={it.value} onChange={(e) => setBriefItem(i, { value: e.target.value })} className="text-xs h-8" /></Field>
                  </div>
                </div>
              ))}
              {props.briefItems.length < 5 && (
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={addBriefItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add row
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Why now */}
      <div className="space-y-2">
        <SectionHeader label="Why this matters now" open={open.why} onToggle={() => toggle("why")} />
        {open.why && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.whyKicker ?? ""} onChange={(e) => set("whyKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.whyHeading} onChange={(e) => set("whyHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <Field label="Intro (optional)"><Textarea value={props.whyIntro ?? ""} onChange={(e) => set("whyIntro", e.target.value)} className="text-xs min-h-14" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Reasons (3 best)</div>
              {props.reasons.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Reason" index={i} total={props.reasons.length} onMoveUp={() => moveReason(i, -1)} onMoveDown={() => moveReason(i, 1)} onRemove={() => removeReason(i)} />
                  <Field label="Title"><Input value={r.title} onChange={(e) => setReason(i, { title: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="Detail"><Textarea value={r.detail} onChange={(e) => setReason(i, { detail: e.target.value })} className="text-xs min-h-14" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addReason}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add reason
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Recommended approach */}
      <div className="space-y-2">
        <SectionHeader label="Recommended approach" open={open.approach} onToggle={() => toggle("approach")} />
        {open.approach && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.approachKicker ?? ""} onChange={(e) => set("approachKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.approachHeading} onChange={(e) => set("approachHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <Field label="Intro (optional)"><Textarea value={props.approachIntro ?? ""} onChange={(e) => set("approachIntro", e.target.value)} className="text-xs min-h-14" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Phases (3 best)</div>
              {props.phases.map((p, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Phase" index={i} total={props.phases.length} onMoveUp={() => movePhase(i, -1)} onMoveDown={() => movePhase(i, 1)} onRemove={() => removePhase(i)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Title"><Input value={p.title} onChange={(e) => setPhase(i, { title: e.target.value })} className="text-xs h-8" /></Field>
                    <Field label="Timeframe"><Input value={p.timeframe ?? ""} onChange={(e) => setPhase(i, { timeframe: e.target.value })} className="text-xs h-8" /></Field>
                  </div>
                  <Field label="Detail"><Textarea value={p.detail ?? ""} onChange={(e) => setPhase(i, { detail: e.target.value })} className="text-xs min-h-14" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addPhase}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add phase
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Use cases */}
      <div className="space-y-2">
        <SectionHeader label="Relevant use cases" open={open.useCases} onToggle={() => toggle("useCases")} />
        {open.useCases && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.useCasesKicker ?? ""} onChange={(e) => set("useCasesKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.useCasesHeading} onChange={(e) => set("useCasesHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <Field label="Intro (optional)"><Textarea value={props.useCasesIntro ?? ""} onChange={(e) => set("useCasesIntro", e.target.value)} className="text-xs min-h-14" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Use cases (2–4 best)</div>
              {props.useCases.map((u, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Use case" index={i} total={props.useCases.length} onMoveUp={() => moveUseCase(i, -1)} onMoveDown={() => moveUseCase(i, 1)} onRemove={() => removeUseCase(i)} />
                  <Field label="Title"><Input value={u.title} onChange={(e) => setUseCase(i, { title: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="Detail"><Textarea value={u.detail} onChange={(e) => setUseCase(i, { detail: e.target.value })} className="text-xs min-h-14" /></Field>
                  <Field label="Metric (optional)"><Input value={u.metric ?? ""} onChange={(e) => setUseCase(i, { metric: e.target.value })} className="text-xs h-8" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addUseCase}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add use case
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Value by persona */}
      <div className="space-y-2">
        <SectionHeader label="Value by persona" open={open.persona} onToggle={() => toggle("persona")} />
        {open.persona && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.personaKicker ?? ""} onChange={(e) => set("personaKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.personaHeading} onChange={(e) => set("personaHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <Field label="Intro (optional)"><Textarea value={props.personaIntro ?? ""} onChange={(e) => set("personaIntro", e.target.value)} className="text-xs min-h-14" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Personas (3 best)</div>
              {props.personaValues.map((pv, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Persona" index={i} total={props.personaValues.length} onMoveUp={() => movePersona(i, -1)} onMoveDown={() => movePersona(i, 1)} onRemove={() => removePersona(i)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Role"><Input value={pv.role} onChange={(e) => setPersona(i, { role: e.target.value })} className="text-xs h-8" /></Field>
                    <Field label="Name (optional)"><Input value={pv.name ?? ""} onChange={(e) => setPersona(i, { name: e.target.value })} className="text-xs h-8" /></Field>
                  </div>
                  <Field label="What they get"><Textarea value={pv.gets} onChange={(e) => setPersona(i, { gets: e.target.value })} className="text-xs min-h-14" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addPersona}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add persona
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Proof */}
      <div className="space-y-2">
        <SectionHeader label="Proof for this buyer" open={open.proof} onToggle={() => toggle("proof")} />
        {open.proof && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.proofKicker ?? ""} onChange={(e) => set("proofKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.proofHeading} onChange={(e) => set("proofHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Case studies</div>
              {props.caseStudies.map((c, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Case study" index={i} total={props.caseStudies.length} onMoveUp={() => moveCaseStudy(i, -1)} onMoveDown={() => moveCaseStudy(i, 1)} onRemove={() => removeCaseStudy(i)} />
                  <Field label="Customer logo (optional)"><ImagePicker value={c.logoUrl ?? ""} onChange={(v) => setCaseStudy(i, { logoUrl: v || undefined })} aiHint="customer logo" /></Field>
                  <Field label="Customer name"><Input value={c.name} onChange={(e) => setCaseStudy(i, { name: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="Result"><Textarea value={c.result} onChange={(e) => setCaseStudy(i, { result: e.target.value })} className="text-xs min-h-14" /></Field>
                  <Field label="Quote (optional)"><Textarea value={c.quote ?? ""} onChange={(e) => setCaseStudy(i, { quote: e.target.value })} className="text-xs min-h-14" /></Field>
                  <Field label="Attribution (optional)"><Input value={c.attribution ?? ""} onChange={(e) => setCaseStudy(i, { attribution: e.target.value })} className="text-xs h-8" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addCaseStudy}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add case study
              </Button>
            </div>
            <Field label="Logo wall label (optional)"><Input value={props.logoWallLabel ?? ""} onChange={(e) => set("logoWallLabel", e.target.value)} className="text-xs h-8" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Logo wall</div>
              {props.logos.map((l, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Logo" index={i} total={props.logos.length} onMoveUp={() => set("logos", moveItem(props.logos, i, -1))} onMoveDown={() => set("logos", moveItem(props.logos, i, 1))} onRemove={() => removeLogo(i)} />
                  <Field label="Name (fallback text)"><Input value={l.name} onChange={(e) => setLogo(i, { name: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="Logo image (optional)"><ImagePicker value={l.imageUrl ?? ""} onChange={(v) => setLogo(i, { imageUrl: v || undefined })} aiHint="customer logo" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addLogo}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add logo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Recommended resources */}
      <div className="space-y-2">
        <SectionHeader label="Recommended resources" open={open.resources} onToggle={() => toggle("resources")} />
        {open.resources && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.resourcesKicker ?? ""} onChange={(e) => set("resourcesKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.resourcesHeading} onChange={(e) => set("resourcesHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <div className="space-y-2 pt-1">
              {props.resources.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Resource" index={i} total={props.resources.length} onMoveUp={() => moveResource(i, -1)} onMoveDown={() => moveResource(i, 1)} onRemove={() => removeResource(i)} />
                  <Field label="Title"><Input value={r.title} onChange={(e) => setResource(i, { title: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="Type (optional)"><Input value={r.type ?? ""} onChange={(e) => setResource(i, { type: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="URL"><Input value={r.url} onChange={(e) => setResource(i, { url: e.target.value })} className="text-xs h-8 font-mono" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addResource}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add resource
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mutual action plan */}
      <div className="space-y-2">
        <SectionHeader label="Mutual action plan" open={open.plan} onToggle={() => toggle("plan")} />
        {open.plan && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.planKicker ?? ""} onChange={(e) => set("planKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.planHeading} onChange={(e) => set("planHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <Field label="Intro (optional)"><Textarea value={props.planIntro ?? ""} onChange={(e) => set("planIntro", e.target.value)} className="text-xs min-h-14" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Steps (4–6 best)</div>
              {props.planSteps.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Step" index={i} total={props.planSteps.length} onMoveUp={() => moveStep(i, -1)} onMoveDown={() => moveStep(i, 1)} onRemove={() => removeStep(i)} />
                  <Field label="Title"><Input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} className="text-xs h-8" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Owner"><Input value={s.owner ?? ""} onChange={(e) => setStep(i, { owner: e.target.value })} className="text-xs h-8" /></Field>
                    <Field label="Target date"><Input value={s.date ?? ""} onChange={(e) => setStep(i, { date: e.target.value })} className="text-xs h-8" /></Field>
                  </div>
                  <Field label="Detail"><Textarea value={s.detail ?? ""} onChange={(e) => setStep(i, { detail: e.target.value })} className="text-xs min-h-14" /></Field>
                  <Field label="Status">
                    <Select value={s.status} onValueChange={(v) => setStep(i, { status: v as AccountMicrositeStepStatus })}>
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
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add step
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Account team */}
      <div className="space-y-2">
        <SectionHeader label="Account team" open={open.team} onToggle={() => toggle("team")} />
        {open.team && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.teamKicker ?? ""} onChange={(e) => set("teamKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.teamHeading} onChange={(e) => set("teamHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <Field label="Intro (optional)"><Textarea value={props.teamIntro ?? ""} onChange={(e) => set("teamIntro", e.target.value)} className="text-xs min-h-14" /></Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Members (3 best)</div>
              {props.teamMembers.map((m, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader label="Member" index={i} total={props.teamMembers.length} onMoveUp={() => moveMember(i, -1)} onMoveDown={() => moveMember(i, 1)} onRemove={() => removeMember(i)} />
                  <Field label="Avatar (optional)"><ImagePicker value={m.avatarUrl ?? ""} onChange={(v) => setMember(i, { avatarUrl: v || undefined })} aiHint="professional headshot" /></Field>
                  <Field label="Name"><Input value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="Role (optional)"><Input value={m.role ?? ""} onChange={(e) => setMember(i, { role: e.target.value })} className="text-xs h-8" /></Field>
                  <Field label="Note (optional)"><Textarea value={m.note ?? ""} onChange={(e) => setMember(i, { note: e.target.value })} className="text-xs min-h-14" /></Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addMember}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add member
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Close */}
      <div className="space-y-2">
        <SectionHeader label="Close" open={open.close} onToggle={() => toggle("close")} />
        {open.close && (
          <div className="space-y-3">
            <Field label="Kicker"><Input value={props.closeKicker ?? ""} onChange={(e) => set("closeKicker", e.target.value)} className="text-xs h-8" /></Field>
            <Field label="Heading"><Textarea value={props.closeHeading} onChange={(e) => set("closeHeading", e.target.value)} className="text-xs min-h-16" /></Field>
            <Field label="Intro (optional)"><Textarea value={props.closeIntro ?? ""} onChange={(e) => set("closeIntro", e.target.value)} className="text-xs min-h-14" /></Field>
            <Field label="Footer note (optional)"><Textarea value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs min-h-14" /></Field>
            <p className="text-[11px] text-muted-foreground">The close reuses the hero's primary CTA.</p>
          </div>
        )}
      </div>
    </div>
  );
}
