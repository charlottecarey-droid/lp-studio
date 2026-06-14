import type { ReactNode } from "react";
import type {
  ChallengerCostStat,
  ChallengerInsightBlockProps,
  ChallengerLogo,
  ChallengerPlanStep,
  ChallengerStakeholder,
  ChallengerTestimonial,
} from "@/blocks/BlockChallengerInsight";
import { CHALLENGER_INSIGHT_DEFAULT_PROPS } from "@/blocks/BlockChallengerInsight";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ImagePicker } from "@/components/ImagePicker";
import { ColorField } from "./BlockSettingsPanel";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

interface Props {
  props: ChallengerInsightBlockProps;
  onChange: (next: ChallengerInsightBlockProps) => void;
}

const D = CHALLENGER_INSIGHT_DEFAULT_PROPS;

/** Collapsible panel section (native <details> — keyboard accessible). */
function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 pt-2">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ChallengerInsightPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ChallengerInsightBlockProps>) =>
    onChange({ ...props, ...patch });

  // Lists edit against the resolved value so touching a default materializes it.
  const costStats = props.costStats ?? D.costStats ?? [];
  const stakeholders = props.stakeholders ?? D.stakeholders ?? [];
  const paragraphs = props.betterWayParagraphs ?? D.betterWayParagraphs ?? [];
  const testimonials = props.testimonials ?? D.testimonials ?? [];
  const logos = props.logos ?? D.logos ?? [];
  const planSteps = props.planSteps ?? D.planSteps ?? [];
  const beliefSupport = props.beliefSupport ?? D.beliefSupport ?? [];
  const realitySupport = props.realitySupport ?? D.realitySupport ?? [];

  const listOps = <T,>(list: T[], key: keyof ChallengerInsightBlockProps) => ({
    set: (i: number, patch: Partial<T>) =>
      update({ [key]: list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }),
    remove: (i: number) => update({ [key]: list.filter((_, idx) => idx !== i) }),
    add: (item: T) => update({ [key]: [...list, item] }),
  });

  const navLinks = props.navLinks ?? D.navLinks ?? [];
  const navOps = listOps<{ label: string; href: string }>(navLinks, "navLinks");

  const stats = listOps<ChallengerCostStat>(costStats, "costStats");
  const cards = listOps<ChallengerStakeholder>(stakeholders, "stakeholders");
  const quotes = listOps<ChallengerTestimonial>(testimonials, "testimonials");
  const logoOps = listOps<ChallengerLogo>(logos, "logos");
  const steps = listOps<ChallengerPlanStep>(planSteps, "planSteps");

  const setLine = (
    list: string[],
    key: "beliefSupport" | "realitySupport" | "betterWayParagraphs",
    i: number,
    v: string,
  ) => update({ [key]: list.map((line, idx) => (idx === i ? v : line)) });

  return (
    <div className="space-y-5">
      <BlockRefreshButton
        blockType="challenger-insight"
        fields={["kicker", "headline", "subheadline", "beliefStatement", "realityStatement"]}
        values={{
          kicker: props.kicker ?? D.kicker ?? "",
          headline: props.headline ?? D.headline ?? "",
          subheadline: props.subheadline ?? D.subheadline ?? "",
          beliefStatement: props.beliefStatement ?? D.beliefStatement ?? "",
          realityStatement: props.realityStatement ?? D.realityStatement ?? "",
        }}
        onApply={(u) => onChange({ ...props, ...u })}
      />

      <Section title="Navbar & hero" defaultOpen>
        <SectionToggle
          label="Show top navbar"
          checked={props.showNavbar !== false}
          onChange={(v) => update({ showNavbar: v })}
        />
        <Field label="Hero layout">
          <select
            value={props.heroLayout ?? "split"}
            onChange={(e) => update({ heroLayout: e.target.value as never })}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="split">Split — image beside headline</option>
            <option value="dark">Dark band (no image)</option>
          </select>
        </Field>
        {props.showNavbar !== false && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Navbar CTA label">
                <Input
                  value={props.navCtaText ?? D.navCtaText ?? ""}
                  onChange={(e) => update({ navCtaText: e.target.value })}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="Navbar CTA URL / anchor">
                <Input
                  value={props.navCtaUrl ?? D.navCtaUrl ?? ""}
                  onChange={(e) => update({ navCtaUrl: e.target.value || undefined })}
                  className="h-8 text-xs"
                  placeholder="#contact"
                />
              </Field>
            </div>
            <Field label="Logo override (defaults to brand logo)">
              <ImagePicker
                value={props.logoUrl ?? ""}
                onChange={(src) => update({ logoUrl: src || undefined })}
                label="Logo"
                aiHint="Brand logo"
              />
            </Field>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Anchor links (0–4) — ids: #evidence, #better-way, #contact
            </div>
            <div className="space-y-1.5">
              {navLinks.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={l.label}
                    onChange={(e) => navOps.set(i, { label: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Label"
                    aria-label="Nav link label"
                  />
                  <Input
                    value={l.href}
                    onChange={(e) => navOps.set(i, { href: e.target.value })}
                    className="h-7 w-28 text-xs"
                    placeholder="#evidence"
                    aria-label="Nav link href"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => navOps.remove(i)}
                    title="Remove link"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {navLinks.length < 4 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => navOps.add({ label: "New link", href: "#evidence" })}
              >
                <Plus className="mr-1 h-3 w-3" /> Add anchor link
              </Button>
            )}
          </>
        )}
      </Section>

      <Section title="1 · Insight hero" defaultOpen>
        <Field label="Kicker">
          <Input
            value={props.kicker ?? D.kicker ?? ""}
            onChange={(e) => update({ kicker: e.target.value })}
            className="h-8 text-xs"
            placeholder="An uncomfortable truth about…"
          />
        </Field>
        <Field label="Headline">
          <AiTextField
            value={props.headline ?? D.headline ?? ""}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() =>
              suggestCopy("challenger-insight", "headline", props.headline ?? D.headline ?? "", {
                subheadline: props.subheadline ?? D.subheadline ?? "",
              })
            }
            fieldLabel="Headline"
          />
        </Field>
        <Field label="Highlighted phrase (must appear in the headline)">
          <Input
            value={props.highlightPhrase ?? D.highlightPhrase ?? ""}
            onChange={(e) => update({ highlightPhrase: e.target.value })}
            className="h-8 text-xs"
            placeholder="Leave blank for no highlighter mark"
          />
        </Field>
        <Field label="Subheadline (the commercial insight, one line)">
          <AiTextField
            value={props.subheadline ?? D.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            rows={3}
            className="text-xs"
            onSuggest={() =>
              suggestCopy(
                "challenger-insight",
                "subheadline",
                props.subheadline ?? D.subheadline ?? "",
                { headline: props.headline ?? D.headline ?? "" },
              )
            }
            fieldLabel="Subheadline"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="CTA label">
            <Input
              value={props.heroCtaText ?? D.heroCtaText ?? ""}
              onChange={(e) => update({ heroCtaText: e.target.value })}
              className="h-8 text-xs"
              placeholder="Leave blank to hide"
            />
          </Field>
          <Field label="CTA URL / anchor">
            <Input
              value={props.heroCtaUrl ?? D.heroCtaUrl ?? ""}
              onChange={(e) => update({ heroCtaUrl: e.target.value || undefined })}
              className="h-8 text-xs"
              placeholder="#evidence"
            />
          </Field>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Hero image (optional — framed beside the headline)
        </div>
        <ImagePicker
          value={props.heroImageUrl ?? ""}
          onChange={(src) => update({ heroImageUrl: src || undefined })}
          label="Hero image"
          aiHint="Confident operator or team reviewing live data"
        />
        <Input
          value={props.heroImageAlt ?? ""}
          onChange={(e) => update({ heroImageAlt: e.target.value || undefined })}
          placeholder="Hero image alt text (optional)"
          className="h-8 text-xs"
        />
      </Section>

      <Section title="2 · The reframe">
        <SectionToggle
          label="Show section"
          checked={props.showReframe !== false}
          onChange={(v) => update({ showReframe: v })}
        />
        <Field label="Eyebrow">
          <Input
            value={props.reframeEyebrow ?? D.reframeEyebrow ?? ""}
            onChange={(e) => update({ reframeEyebrow: e.target.value })}
            className="h-8 text-xs"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Belief label">
            <Input
              value={props.beliefLabel ?? D.beliefLabel ?? ""}
              onChange={(e) => update({ beliefLabel: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Data label">
            <Input
              value={props.realityLabel ?? D.realityLabel ?? ""}
              onChange={(e) => update({ realityLabel: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
        <Field label="What everyone believes">
          <AiTextField
            value={props.beliefStatement ?? D.beliefStatement ?? ""}
            onChange={(v) => update({ beliefStatement: v })}
            rows={2}
            className="text-xs"
            onSuggest={() =>
              suggestCopy(
                "challenger-insight",
                "beliefStatement",
                props.beliefStatement ?? D.beliefStatement ?? "",
                { realityStatement: props.realityStatement ?? D.realityStatement ?? "" },
              )
            }
            fieldLabel="Belief statement"
          />
        </Field>
        {beliefSupport.map((line, i) => (
          <Field key={i} label={`Belief support line ${i + 1}`}>
            <Input
              value={line}
              onChange={(e) => setLine(beliefSupport, "beliefSupport", i, e.target.value)}
              className="h-8 text-xs"
            />
          </Field>
        ))}
        <Field label="What the data shows (gets the accent treatment)">
          <AiTextField
            value={props.realityStatement ?? D.realityStatement ?? ""}
            onChange={(v) => update({ realityStatement: v })}
            rows={2}
            className="text-xs"
            onSuggest={() =>
              suggestCopy(
                "challenger-insight",
                "realityStatement",
                props.realityStatement ?? D.realityStatement ?? "",
                { beliefStatement: props.beliefStatement ?? D.beliefStatement ?? "" },
              )
            }
            fieldLabel="Data statement"
          />
        </Field>
        {realitySupport.map((line, i) => (
          <Field key={i} label={`Data support line ${i + 1}`}>
            <Input
              value={line}
              onChange={(e) => setLine(realitySupport, "realitySupport", i, e.target.value)}
              className="h-8 text-xs"
            />
          </Field>
        ))}
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence image (optional — wide framed strip)
        </div>
        <ImagePicker
          value={props.reframeImageUrl ?? ""}
          onChange={(src) => update({ reframeImageUrl: src || undefined })}
          label="Evidence image"
          aiHint="Dashboard, chart, or data being reviewed"
        />
        <Input
          value={props.reframeImageAlt ?? ""}
          onChange={(e) => update({ reframeImageAlt: e.target.value || undefined })}
          placeholder="Evidence image alt text (optional)"
          className="h-8 text-xs"
        />
      </Section>

      <Section title={`3 · Cost of status quo (${costStats.length})`}>
        <SectionToggle
          label="Show section"
          checked={props.showCost !== false}
          onChange={(v) => update({ showCost: v })}
        />
        <Field label="Eyebrow">
          <Input
            value={props.costEyebrow ?? D.costEyebrow ?? ""}
            onChange={(e) => update({ costEyebrow: e.target.value })}
            className="h-8 text-xs"
          />
        </Field>
        <Field label="Heading">
          <AiTextField
            value={props.costHeading ?? D.costHeading ?? ""}
            onChange={(v) => update({ costHeading: v })}
            rows={2}
            className="text-xs"
            onSuggest={() =>
              suggestCopy("challenger-insight", "costHeading", props.costHeading ?? D.costHeading ?? "", {
                headline: props.headline ?? D.headline ?? "",
              })
            }
            fieldLabel="Cost heading"
          />
        </Field>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Up to 3 loss-framed stats — use only real numbers from your brand
          context. Fewer stats narrow the grid gracefully; delete all to hide
          the band.
        </p>
        <div className="space-y-2">
          {costStats.map((stat, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  value={stat.value}
                  onChange={(e) => stats.set(i, { value: e.target.value })}
                  className="h-7 w-24 shrink-0 text-xs"
                  placeholder="$1.2M"
                  aria-label="Stat value"
                />
                <Input
                  value={stat.label}
                  onChange={(e) => stats.set(i, { label: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="Lost per year to…"
                  aria-label="Stat label"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => stats.remove(i)}
                  title="Remove stat"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {costStats.length < 3 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => stats.add({ value: "0%", label: "New loss stat" })}
          >
            <Plus className="mr-1 h-3 w-3" /> Add stat
          </Button>
        )}
        <Field label="Footnote / source line">
          <Input
            value={props.costFootnote ?? D.costFootnote ?? ""}
            onChange={(e) => update({ costFootnote: e.target.value })}
            className="h-8 text-xs"
            placeholder="Leave blank to hide"
          />
        </Field>
      </Section>

      <Section title={`4 · Stakeholders (${stakeholders.length})`}>
        <SectionToggle
          label="Show section"
          checked={props.showTailor !== false}
          onChange={(v) => update({ showTailor: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Eyebrow">
            <Input
              value={props.tailorEyebrow ?? D.tailorEyebrow ?? ""}
              onChange={(e) => update({ tailorEyebrow: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Heading">
            <Input
              value={props.tailorHeading ?? D.tailorHeading ?? ""}
              onChange={(e) => update({ tailorHeading: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
        <div className="space-y-2">
          {stakeholders.map((card, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  value={card.label}
                  onChange={(e) => cards.set(i, { label: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="For Operations"
                  aria-label="Audience label"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => cards.remove(i)}
                  title="Remove card"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={card.title}
                onChange={(e) => cards.set(i, { title: e.target.value })}
                className="h-7 text-xs"
                placeholder="Implication headline"
                aria-label="Card title"
              />
              <AiTextField
                value={card.body}
                onChange={(v) => cards.set(i, { body: v })}
                rows={2}
                className="text-xs"
                onSuggest={() =>
                  suggestCopy("challenger-insight", "stakeholderBody", card.body, {
                    label: card.label,
                    title: card.title,
                  })
                }
                fieldLabel="Implication line"
              />
            </div>
          ))}
        </div>
        {stakeholders.length < 3 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() =>
              cards.add({ label: "For You", title: "New implication", body: "What this means for this stakeholder." })
            }
          >
            <Plus className="mr-1 h-3 w-3" /> Add stakeholder
          </Button>
        )}
      </Section>

      <Section title="5 · The better way">
        <SectionToggle
          label="Show section"
          checked={props.showBetterWay !== false}
          onChange={(v) => update({ showBetterWay: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Eyebrow">
            <Input
              value={props.betterWayEyebrow ?? D.betterWayEyebrow ?? ""}
              onChange={(e) => update({ betterWayEyebrow: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Heading">
            <Input
              value={props.betterWayHeading ?? D.betterWayHeading ?? ""}
              onChange={(e) => update({ betterWayHeading: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
        {paragraphs.map((para, i) => (
          <Field key={i} label={`Paragraph ${i + 1}`}>
            <AiTextField
              value={para}
              onChange={(v) => setLine(paragraphs, "betterWayParagraphs", i, v)}
              rows={3}
              className="text-xs"
              onSuggest={() =>
                suggestCopy("challenger-insight", "betterWayParagraph", para, {
                  heading: props.betterWayHeading ?? D.betterWayHeading ?? "",
                })
              }
              fieldLabel={`Paragraph ${i + 1}`}
            />
          </Field>
        ))}
        {paragraphs.length < 3 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => update({ betterWayParagraphs: [...paragraphs, "New paragraph."] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Add paragraph
          </Button>
        )}
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Solution image (optional)
        </div>
        <ImagePicker
          value={props.betterWayImageUrl ?? ""}
          onChange={(src) => update({ betterWayImageUrl: src || undefined })}
          label="Solution image"
          aiHint="Product or team in action"
        />
        <Input
          value={props.betterWayImageAlt ?? ""}
          onChange={(e) => update({ betterWayImageAlt: e.target.value || undefined })}
          placeholder="Image alt text (optional)"
          className="h-8 text-xs"
        />
      </Section>

      <Section title={`6 · Proof (${testimonials.length})`}>
        <SectionToggle
          label="Show section"
          checked={props.showProof !== false}
          onChange={(v) => update({ showProof: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Eyebrow">
            <Input
              value={props.proofEyebrow ?? D.proofEyebrow ?? ""}
              onChange={(e) => update({ proofEyebrow: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Heading">
            <Input
              value={props.proofHeading ?? D.proofHeading ?? ""}
              onChange={(e) => update({ proofHeading: e.target.value })}
              className="h-8 text-xs"
              placeholder="Leave blank to hide"
            />
          </Field>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Use only real customer quotes. Up to 2; delete all to show just the
          logo row (or hide the section above).
        </p>
        <div className="space-y-2">
          {testimonials.map((t, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
              <AiTextField
                value={t.quote}
                onChange={(v) => quotes.set(i, { quote: v })}
                rows={3}
                className="text-xs"
                fieldLabel="Quote"
              />
              <div className="flex items-center gap-1.5">
                <Input
                  value={t.name}
                  onChange={(e) => quotes.set(i, { name: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="Name"
                  aria-label="Name"
                />
                <Input
                  value={t.title ?? ""}
                  onChange={(e) => quotes.set(i, { title: e.target.value || undefined })}
                  className="h-7 text-xs"
                  placeholder="Role, company"
                  aria-label="Role"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => quotes.remove(i)}
                  title="Remove testimonial"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {testimonials.length < 2 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => quotes.add({ quote: "New quote.", name: "Name", title: "" })}
          >
            <Plus className="mr-1 h-3 w-3" /> Add testimonial
          </Button>
        )}
        <Field label="Logo row label">
          <Input
            value={props.logosLabel ?? D.logosLabel ?? ""}
            onChange={(e) => update({ logosLabel: e.target.value })}
            className="h-8 text-xs"
            placeholder="Leave blank to hide"
          />
        </Field>
        <div className="space-y-1.5">
          {logos.map((logo, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={logo.name}
                onChange={(e) => logoOps.set(i, { name: e.target.value })}
                className="h-7 text-xs"
                placeholder="Company name"
                aria-label="Logo name"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => logoOps.remove(i)}
                title="Remove logo"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        {logos.length < 6 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => logoOps.add({ name: "Company" })}
          >
            <Plus className="mr-1 h-3 w-3" /> Add logo wordmark
          </Button>
        )}
      </Section>

      <Section title={`7 · Take control (${planSteps.length})`}>
        <SectionToggle
          label="Show section"
          checked={props.showPlan !== false}
          onChange={(v) => update({ showPlan: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Eyebrow">
            <Input
              value={props.planEyebrow ?? D.planEyebrow ?? ""}
              onChange={(e) => update({ planEyebrow: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Heading">
            <Input
              value={props.planHeading ?? D.planHeading ?? ""}
              onChange={(e) => update({ planHeading: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
        <div className="space-y-2">
          {planSteps.map((step, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  value={step.title}
                  onChange={(e) => steps.set(i, { title: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="Step title"
                  aria-label="Step title"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => steps.remove(i)}
                  title="Remove step"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={step.description}
                onChange={(e) => steps.set(i, { description: e.target.value })}
                className="h-7 text-xs"
                placeholder="One-line description"
                aria-label="Step description"
              />
            </div>
          ))}
        </div>
        {planSteps.length < 3 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => steps.add({ title: "New step", description: "What happens in this step." })}
          >
            <Plus className="mr-1 h-3 w-3" /> Add step
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="CTA label">
            <Input
              value={props.finalCtaText ?? D.finalCtaText ?? ""}
              onChange={(e) => update({ finalCtaText: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="CTA URL">
            <Input
              value={props.finalCtaUrl ?? D.finalCtaUrl ?? ""}
              onChange={(e) => update({ finalCtaUrl: e.target.value || undefined })}
              className="h-8 text-xs"
              placeholder="#contact"
            />
          </Field>
        </div>
        <Field label="Constructive-tension line">
          <Input
            value={props.tensionLine ?? D.tensionLine ?? ""}
            onChange={(e) => update({ tensionLine: e.target.value })}
            className="h-8 text-xs"
            placeholder="Leave blank to hide"
          />
        </Field>
      </Section>

      <Section title="Style">
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="Surface"
            value={props.bgColor ?? ""}
            onChange={(v) => update({ bgColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => update({ accentColor: v || undefined })}
          />
          <ColorField
            label="Text"
            value={props.textColor ?? ""}
            onChange={(v) => update({ textColor: v || undefined })}
          />
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          This brief is designed dark — by default the surface is near-black
          tinted with your brand primary, and the accent acts as a highlighter.
          Every text, mark, and CTA color is contrast-resolved at render time,
          so any override stays legible.
        </p>
      </Section>
    </div>
  );
}
