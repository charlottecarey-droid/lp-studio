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
  DealRoomBlockProps,
  DealRoomMapStep,
  DealRoomLineItem,
  DealRoomStakeholder,
  DealRoomCaseStudy,
  DealRoomLogo,
  DealRoomResource,
  DealRoomFaq,
  DealRoomStepStatus,
} from "@/blocks/BlockDealRoom";

/* ----------------------------------------------------------------------------
 * Property panel for the "deal-room" full-page ABM block. Collapsible sections
 * mirror the block: visibility toggles, palette, hero (+ shared CTA suite),
 * mutual action plan, business case, stakeholder map, proof, resources, FAQ,
 * and the close (reuses the same shared CTA suite as the hero).
 * -------------------------------------------------------------------------- */

interface Props {
  props: DealRoomBlockProps;
  onChange: (props: DealRoomBlockProps) => void;
  /** Sales/microsite-scoped: copy this block's CTA to every other CTA on the
   *  page. Wired by BuilderEditor only on microsites; undefined elsewhere. */
  onApplyCtaToAll?: () => void;
}

const PALETTE_FB = {
  bgColor: "#F6F2E9",
  inkColor: "#1A1815",
  headlineColor: "#1B1840",
  accentColor: "#4B47E5",
  sparkColor: "#E26B4F",
  darkColor: "#1B1840",
};

const STATUS_OPTIONS: { value: DealRoomStepStatus; label: string }[] = [
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

export function DealRoomPanel({ props, onChange, onApplyCtaToAll }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    chrome: true,
    palette: false,
    hero: true,
    plan: false,
    case: false,
    stakeholders: false,
    proof: false,
    resources: false,
    faq: false,
    close: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof DealRoomBlockProps>(key: K, value: DealRoomBlockProps[K]) =>
    onChange({ ...props, [key]: value });

  /* — navbar anchor links — */
  const navLinks = props.navLinks ?? [];
  const setNavLink = (i: number, patch: Partial<{ label: string; href: string }>) =>
    set("navLinks", navLinks.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addNavLink = () => set("navLinks", [...navLinks, { label: "New link", href: "#plan" }]);
  const removeNavLink = (i: number) => set("navLinks", navLinks.filter((_, j) => j !== i));
  const moveNavLink = (i: number, dir: -1 | 1) => set("navLinks", moveItem(navLinks, i, dir));

  /* — array helpers — */
  const setStep = (i: number, patch: Partial<DealRoomMapStep>) =>
    set("planSteps", props.planSteps.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addStep = () =>
    set("planSteps", [
      ...props.planSteps,
      { title: "New step", owner: "", date: "", detail: "What happens here.", status: "upcoming" },
    ]);
  const removeStep = (i: number) => set("planSteps", props.planSteps.filter((_, j) => j !== i));
  const moveStep = (i: number, dir: -1 | 1) => set("planSteps", moveItem(props.planSteps, i, dir));

  const setInvest = (i: number, patch: Partial<DealRoomLineItem>) =>
    set("investmentItems", props.investmentItems.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addInvest = () =>
    set("investmentItems", [...props.investmentItems, { label: "New line item", value: "$0" }]);
  const removeInvest = (i: number) =>
    set("investmentItems", props.investmentItems.filter((_, j) => j !== i));
  const moveInvest = (i: number, dir: -1 | 1) =>
    set("investmentItems", moveItem(props.investmentItems, i, dir));

  const setReturn = (i: number, patch: Partial<DealRoomLineItem>) =>
    set("returnItems", props.returnItems.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addReturn = () =>
    set("returnItems", [...props.returnItems, { label: "New line item", value: "$0" }]);
  const removeReturn = (i: number) => set("returnItems", props.returnItems.filter((_, j) => j !== i));
  const moveReturn = (i: number, dir: -1 | 1) =>
    set("returnItems", moveItem(props.returnItems, i, dir));

  const setStakeholder = (i: number, patch: Partial<DealRoomStakeholder>) =>
    set("stakeholders", props.stakeholders.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addStakeholder = () =>
    set("stakeholders", [...props.stakeholders, { role: "New role", name: "", gets: "What they get." }]);
  const removeStakeholder = (i: number) =>
    set("stakeholders", props.stakeholders.filter((_, j) => j !== i));
  const moveStakeholder = (i: number, dir: -1 | 1) =>
    set("stakeholders", moveItem(props.stakeholders, i, dir));

  const setCaseStudy = (i: number, patch: Partial<DealRoomCaseStudy>) =>
    set("caseStudies", props.caseStudies.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addCaseStudy = () =>
    set("caseStudies", [
      ...props.caseStudies,
      { name: "Customer", result: "The headline result.", quote: "", attribution: "" },
    ]);
  const removeCaseStudy = (i: number) =>
    set("caseStudies", props.caseStudies.filter((_, j) => j !== i));
  const moveCaseStudy = (i: number, dir: -1 | 1) =>
    set("caseStudies", moveItem(props.caseStudies, i, dir));

  const setLogo = (i: number, patch: Partial<DealRoomLogo>) =>
    set("logos", props.logos.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addLogo = () => set("logos", [...props.logos, { name: "New logo" }]);
  const removeLogo = (i: number) => set("logos", props.logos.filter((_, j) => j !== i));

  const setResource = (i: number, patch: Partial<DealRoomResource>) =>
    set("resources", props.resources.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addResource = () =>
    set("resources", [...props.resources, { title: "New document", type: "PDF", url: "#" }]);
  const removeResource = (i: number) => set("resources", props.resources.filter((_, j) => j !== i));
  const moveResource = (i: number, dir: -1 | 1) =>
    set("resources", moveItem(props.resources, i, dir));

  const setFaq = (i: number, patch: Partial<DealRoomFaq>) =>
    set("faqs", props.faqs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addFaq = () =>
    set("faqs", [...props.faqs, { question: "New question?", answer: "The answer." }]);
  const removeFaq = (i: number) => set("faqs", props.faqs.filter((_, j) => j !== i));
  const moveFaq = (i: number, dir: -1 | 1) => set("faqs", moveItem(props.faqs, i, dir));

  /* — shared CTA suite (hero primary + close share the same fields) — */
  const ctaSuite: CtaSuiteFields = props;
  const setCta = (next: CtaSuiteFields) => onChange({ ...props, ...next });

  const SECTION_TOGGLES: Array<{ key: keyof DealRoomBlockProps; label: string }> = [
    { key: "showPlan", label: "Mutual action plan" },
    { key: "showCase", label: "Business case" },
    { key: "showStakeholders", label: "Stakeholder map" },
    { key: "showProof", label: "Proof for this buyer" },
    { key: "showResources", label: "Resources / docs" },
    { key: "showFaq", label: "Objection handling / FAQ" },
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
              <ImagePicker value={props.heroImageUrl ?? ""} onChange={(v) => set("heroImageUrl", v || undefined)} aiHint="The deal team / product aligning on the path to go-live" />
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
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Anchor links (0–4) — ids: #plan, #case, #close</div>
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
            <ColorRow label="Dark sections (business case + close)" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor", v)} />
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
            <Field label="Headline / deal thesis (the only h1)">
              <AiTextField
                value={props.headline}
                onChange={(v) => set("headline", v)}
                rows={2}
                className="text-xs"
                onSuggest={() => suggestCopy("deal-room", "headline", props.headline, { accountName: props.accountName, yourName: props.yourName })}
                fieldLabel="Headline"
              />
            </Field>
            <Field label="Subheadline (one line)">
              <AiTextField
                value={props.subheadline ?? ""}
                onChange={(v) => set("subheadline", v)}
                rows={3}
                className="text-xs"
                onSuggest={() => suggestCopy("deal-room", "subheadline", props.subheadline ?? "", { headline: props.headline })}
                fieldLabel="Subheadline"
              />
            </Field>

            {/* Shared CTA suite — hero primary + close use the same fields */}
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Primary CTA (hero + close)
              </div>
              <Field label="Primary CTA text">
                <Input value={props.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Book the next step" className="text-xs h-8" />
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
                <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => set("ctaSecondaryText", e.target.value)} placeholder="Forward this deal room" className="text-xs h-8" />
              </Field>
              <Field label="Secondary CTA URL">
                <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => set("ctaSecondaryUrl", e.target.value)} placeholder="#" className="text-xs h-8 font-mono" />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Mutual action plan */}
      <div className="space-y-2">
        <SectionHeader label="Mutual action plan" open={open.plan} onToggle={() => toggle("plan")} />
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
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Steps (4–6 best)</div>
              {props.planSteps.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Step"
                    index={i}
                    total={props.planSteps.length}
                    onMoveUp={() => moveStep(i, -1)}
                    onMoveDown={() => moveStep(i, 1)}
                    onRemove={() => removeStep(i)}
                  />
                  <Field label="Title">
                    <Input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Owner">
                      <Input value={s.owner ?? ""} onChange={(e) => setStep(i, { owner: e.target.value })} className="text-xs h-8" />
                    </Field>
                    <Field label="Target date">
                      <Input value={s.date ?? ""} onChange={(e) => setStep(i, { date: e.target.value })} className="text-xs h-8" />
                    </Field>
                  </div>
                  <Field label="Detail">
                    <Textarea value={s.detail ?? ""} onChange={(e) => setStep(i, { detail: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Status">
                    <Select value={s.status} onValueChange={(v) => setStep(i, { status: v as DealRoomStepStatus })}>
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

      {/* Business case */}
      <div className="space-y-2">
        <SectionHeader label="Business case" open={open.case} onToggle={() => toggle("case")} />
        {open.case && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.caseKicker ?? ""} onChange={(e) => set("caseKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.caseHeading} onChange={(e) => set("caseHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.caseIntro ?? ""} onChange={(e) => set("caseIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Totals and payback are display copy, not live math — keep them consistent with the line items.
            </p>

            <Field label="Investment column label">
              <Input value={props.investmentLabel ?? ""} onChange={(e) => set("investmentLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Investment line items</div>
              {props.investmentItems.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Item"
                    index={i}
                    total={props.investmentItems.length}
                    onMoveUp={() => moveInvest(i, -1)}
                    onMoveDown={() => moveInvest(i, 1)}
                    onRemove={() => removeInvest(i)}
                  />
                  <Field label="Label">
                    <Input value={r.label} onChange={(e) => setInvest(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Value">
                    <Input value={r.value} onChange={(e) => setInvest(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addInvest}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add line item
              </Button>
            </div>
            <Field label="Investment total label">
              <Input value={props.investmentTotalLabel ?? ""} onChange={(e) => set("investmentTotalLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Investment total (display value)">
              <Input value={props.investmentTotal} onChange={(e) => set("investmentTotal", e.target.value)} className="text-xs h-8" />
            </Field>

            <Field label="Return column label">
              <Input value={props.returnLabel ?? ""} onChange={(e) => set("returnLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Return line items</div>
              {props.returnItems.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Item"
                    index={i}
                    total={props.returnItems.length}
                    onMoveUp={() => moveReturn(i, -1)}
                    onMoveDown={() => moveReturn(i, 1)}
                    onRemove={() => removeReturn(i)}
                  />
                  <Field label="Label">
                    <Input value={r.label} onChange={(e) => setReturn(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Value">
                    <Input value={r.value} onChange={(e) => setReturn(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addReturn}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add line item
              </Button>
            </div>
            <Field label="Return total label">
              <Input value={props.returnTotalLabel ?? ""} onChange={(e) => set("returnTotalLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Return total (display value)">
              <Input value={props.returnTotal} onChange={(e) => set("returnTotal", e.target.value)} className="text-xs h-8" />
            </Field>

            <Field label="Payback label">
              <Input value={props.paybackLabel ?? ""} onChange={(e) => set("paybackLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label='Payback value (counts up, e.g. "4.6 months")'>
              <Input value={props.paybackValue} onChange={(e) => set("paybackValue", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Assumptions footnote (optional)">
              <Textarea value={props.caseFootnote ?? ""} onChange={(e) => set("caseFootnote", e.target.value)} className="text-xs min-h-14" />
            </Field>
          </div>
        )}
      </div>

      {/* Stakeholder map */}
      <div className="space-y-2">
        <SectionHeader label="Stakeholder map" open={open.stakeholders} onToggle={() => toggle("stakeholders")} />
        {open.stakeholders && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.stakeholdersKicker ?? ""} onChange={(e) => set("stakeholdersKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.stakeholdersHeading} onChange={(e) => set("stakeholdersHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.stakeholdersIntro ?? ""} onChange={(e) => set("stakeholdersIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Roles (3–4 best)</div>
              {props.stakeholders.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Role"
                    index={i}
                    total={props.stakeholders.length}
                    onMoveUp={() => moveStakeholder(i, -1)}
                    onMoveDown={() => moveStakeholder(i, 1)}
                    onRemove={() => removeStakeholder(i)}
                  />
                  <Field label="Role">
                    <Input value={s.role} onChange={(e) => setStakeholder(i, { role: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Name (optional)">
                    <Input value={s.name ?? ""} onChange={(e) => setStakeholder(i, { name: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="What they get">
                    <Textarea value={s.gets} onChange={(e) => setStakeholder(i, { gets: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Avatar (optional)">
                    <ImagePicker value={s.avatarUrl ?? ""} onChange={(v) => setStakeholder(i, { avatarUrl: v || undefined })} aiHint="professional headshot avatar" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStakeholder}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add role
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
            <Field label="Kicker">
              <Input value={props.proofKicker ?? ""} onChange={(e) => set("proofKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.proofHeading} onChange={(e) => set("proofHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Case studies (1–2 best)</div>
              {props.caseStudies.map((c, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Case study"
                    index={i}
                    total={props.caseStudies.length}
                    onMoveUp={() => moveCaseStudy(i, -1)}
                    onMoveDown={() => moveCaseStudy(i, 1)}
                    onRemove={() => removeCaseStudy(i)}
                  />
                  <Field label="Customer name">
                    <Input value={c.name} onChange={(e) => setCaseStudy(i, { name: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Logo (optional)">
                    <ImagePicker value={c.logoUrl ?? ""} onChange={(v) => setCaseStudy(i, { logoUrl: v || undefined })} aiHint="customer logo" />
                  </Field>
                  <Field label="Result (headline)">
                    <Textarea value={c.result} onChange={(e) => setCaseStudy(i, { result: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Quote (optional)">
                    <Textarea value={c.quote ?? ""} onChange={(e) => setCaseStudy(i, { quote: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Attribution (optional)">
                    <Input value={c.attribution ?? ""} onChange={(e) => setCaseStudy(i, { attribution: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addCaseStudy}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add case study
              </Button>
            </div>
            <Field label="Logo wall label (optional)">
              <Input value={props.logoWallLabel ?? ""} onChange={(e) => set("logoWallLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Logo wall</div>
              {props.logos.map((logo, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1 grid grid-cols-2 gap-1">
                    <Input value={logo.name} onChange={(e) => setLogo(i, { name: e.target.value })} className="text-xs h-7" placeholder="Name" />
                    <Input value={logo.imageUrl ?? ""} onChange={(e) => setLogo(i, { imageUrl: e.target.value || undefined })} className="text-xs h-7" placeholder="Image URL (optional)" />
                  </div>
                  <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0" onClick={() => removeLogo(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={addLogo}>
                <Plus className="w-3.5 h-3.5" /> Add logo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Resources */}
      <div className="space-y-2">
        <SectionHeader label="Resources / docs" open={open.resources} onToggle={() => toggle("resources")} />
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
            <div className="space-y-2 pt-1">
              {props.resources.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Doc"
                    index={i}
                    total={props.resources.length}
                    onMoveUp={() => moveResource(i, -1)}
                    onMoveDown={() => moveResource(i, 1)}
                    onRemove={() => removeResource(i)}
                  />
                  <Field label="Title">
                    <Input value={r.title} onChange={(e) => setResource(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Type (e.g. PDF · Security)">
                    <Input value={r.type ?? ""} onChange={(e) => setResource(i, { type: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Link URL">
                    <Input value={r.url} onChange={(e) => setResource(i, { url: e.target.value })} className="text-xs h-8 font-mono" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addResource}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add document
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="space-y-2">
        <SectionHeader label="Objection handling / FAQ" open={open.faq} onToggle={() => toggle("faq")} />
        {open.faq && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.faqKicker ?? ""} onChange={(e) => set("faqKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.faqHeading} onChange={(e) => set("faqHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <div className="space-y-2 pt-1">
              {props.faqs.map((f, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Q"
                    index={i}
                    total={props.faqs.length}
                    onMoveUp={() => moveFaq(i, -1)}
                    onMoveDown={() => moveFaq(i, 1)}
                    onRemove={() => removeFaq(i)}
                  />
                  <Field label="Question">
                    <Textarea value={f.question} onChange={(e) => setFaq(i, { question: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Answer">
                    <Textarea value={f.answer} onChange={(e) => setFaq(i, { answer: e.target.value })} className="text-xs min-h-16" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addFaq}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add question
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
            <Field label="Kicker">
              <Input value={props.closeKicker ?? ""} onChange={(e) => set("closeKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.closeHeading} onChange={(e) => set("closeHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.closeIntro ?? ""} onChange={(e) => set("closeIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              The close repeats the hero's primary CTA — edit it under Hero → Primary CTA.
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

export default DealRoomPanel;
