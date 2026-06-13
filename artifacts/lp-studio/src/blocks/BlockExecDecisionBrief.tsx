import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  relativeLuminance,
} from "@/lib/brand-config";
import { ensureAccentRegisters, mixHex, resolveSectionInk } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { formatStatValue, parseStatValue } from "./BlockStatCounterBand";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/* ----------------------------------------------------------------------------
 * Exec Decision Brief — type "exec-decision-brief"
 *
 * MEDDIC/MEDDPICC-aligned single-page brief a sales champion forwards to their
 * economic buyer. Data-dense boardroom register: crisp light surface, hairline-
 * ruled tables, oversized tabular numerals, navy-leaning neutrals with the
 * brand accent used sparingly. Sections: masthead → identified pain (cost-if-
 * unresolved table) → metrics proof band (count-up, reduced-motion static) →
 * decision-criteria checklist table (optional alternatives column) → economic
 * case (investment vs. return, payback in display type) → decision process
 * timeline → champion tools strip (copy-paste takeaways + CTA pair).
 *
 * All "math" (totals, payback) is editorial copy — props strings, never live
 * arithmetic. Tables collapse to stacked cards on mobile. Single h1 in the
 * masthead. Belongs in NO_REVEAL (full-page monograph; owns its own motion).
 * -------------------------------------------------------------------------- */

export interface ExecPainRow {
  /** The pain statement (one crisp sentence, 8–16 words). */
  pain: string;
  /** Who owns / feels the pain — small uppercase label (optional, 2–4 words). */
  owner?: string;
  /** Cost if unresolved — a figure, e.g. "$310K / yr" or "11 hrs / wk". */
  cost: string;
}

export interface ExecMetric {
  /** Display value with affixes, e.g. "32%", "$1.4M", "90 days" — animatable. */
  value: string;
  /** Short label under the numeral (2–6 words). */
  label: string;
  /** Optional source attribution in small print, e.g. "2025 customer cohort". */
  source?: string;
}

export interface ExecCriterionRow {
  /** Decision criterion name, e.g. "Security & compliance" (1–4 words). */
  criterion: string;
  /** The buyer's requirement in detail (one sentence). */
  requirement: string;
  /** How the vendor meets it (one sentence). */
  delivery: string;
  /** Optional: how the status quo / alternatives stack up (one short clause). */
  alternative?: string;
}

export interface ExecLineItem {
  label: string;
  /** Display figure, e.g. "$120,000 / yr" — rendered tabular, right-aligned. */
  value: string;
}

export interface ExecProcessStep {
  /** Step name, e.g. "Evaluation" (1–3 words). */
  label: string;
  /** Optional dates/timeframe, e.g. "Weeks 1–2" — omit for date-free briefs. */
  timeframe?: string;
  /** What happens in this step (one sentence). */
  description: string;
}

export interface ExecDecisionBriefBlockProps {
  /* ── palette overrides (all optional; brand-derived defaults) ─────────── */
  /** Page surface. Defaults to the brand page background (or a crisp off-white). */
  bgColor?: string;
  /** Body text override — only honored when it meets AA on the surface. */
  inkColor?: string;
  /** Display-heading ink. Defaults to brand heading-on-light / a deep navy. */
  headlineColor?: string;
  /** Accent — kickers, checks, payback. Defaults to the brand accent. */
  accentColor?: string;
  /** Champion-strip dark surface. Defaults to a near-black mix of brand primary. */
  darkColor?: string;

  /* ── 1. masthead ──────────────────────────────────────────────────────── */
  /** Eyebrow, personalization-token friendly: "Prepared for {{company_name}}". */
  preparedForLabel: string;
  /** Decisive, quantified-outcome headline (6–12 words). The page's only h1. */
  headline: string;
  /** One-line thesis under the headline (one sentence, ≤ 28 words). */
  thesis: string;
  /** Optional meta row entries — date and preparer. Empty hides each. */
  metaDate?: string;
  metaPreparer?: string;
  /** Show the brand logo in the masthead. Default true (hidden when no logo). */
  showLogo?: boolean;
  /** Logo override URL; falls back to the tenant brand logo. */
  logoUrl?: string;
  logoAlt?: string;
  /** Masthead image, framed beside the headline (a crisp boardroom/clinical
   *  photo). Empty = the masthead runs full-width as before. */
  mastheadImageUrl?: string;
  mastheadImageAlt?: string;
  mastheadImageFocal?: string;

  /* ── 2. identified pain ───────────────────────────────────────────────── */
  showPain?: boolean;
  painKicker?: string;
  painHeading: string;
  /** Column header over the pain statements, e.g. "Pain". */
  painHeader?: string;
  /** Column header over the cost figures, e.g. "Cost if unresolved". */
  painCostHeader?: string;
  /** 2–3 rows render best. */
  painRows: ExecPainRow[];

  /* ── 3. metrics proof band ────────────────────────────────────────────── */
  showMetrics?: boolean;
  metricsKicker?: string;
  metricsHeading: string;
  /** 3–4 oversized count-up metrics; graceful with fewer. */
  metrics: ExecMetric[];
  /** Count-up duration in ms. Default 1400. */
  countUpMs?: number;

  /* ── 4. decision criteria (the centerpiece) ───────────────────────────── */
  showCriteria?: boolean;
  criteriaKicker?: string;
  criteriaHeading: string;
  criteriaIntro?: string;
  criterionHeader?: string;
  requirementHeader?: string;
  deliveryHeader?: string;
  /** Header for the optional alternatives column. */
  alternativesHeader?: string;
  /** Show the third "alternatives" column. Default false. */
  showAlternatives?: boolean;
  /** 4–6 rows render best. */
  criteriaRows: ExecCriterionRow[];

  /* ── 5. economic case ─────────────────────────────────────────────────── */
  showEconomics?: boolean;
  economicsKicker?: string;
  economicsHeading: string;
  investmentLabel?: string;
  investmentItems: ExecLineItem[];
  investmentTotalLabel?: string;
  /** Computed-LOOKING total — an editorial string, never live math. */
  investmentTotal: string;
  returnLabel?: string;
  returnItems: ExecLineItem[];
  returnTotalLabel?: string;
  returnTotal: string;
  /** Payback line in display type, e.g. label "Payback" + value "4.6 months". */
  paybackLabel?: string;
  paybackValue: string;
  /** Small-print assumptions note under the panel. */
  economicsFootnote?: string;

  /* ── 6. decision process ──────────────────────────────────────────────── */
  showProcess?: boolean;
  processKicker?: string;
  processHeading: string;
  /** 3–4 steps render best (evaluation → pilot → rollout). */
  processSteps: ExecProcessStep[];
  /** Supporting image beside the process timeline (a framed team/working-session
   *  photo). Empty = the timeline renders full-width as before. */
  processImageUrl?: string;
  processImageAlt?: string;
  processImageFocal?: string;

  /* ── 7. champion tools strip ──────────────────────────────────────────── */
  showChampion?: boolean;
  championKicker?: string;
  championHeading: string;
  championIntro?: string;
  /** Small label over the takeaways card, e.g. "Key takeaways — written to forward". */
  takeawaysLabel?: string;
  /** The 3 key takeaways, written to paste straight into an email. */
  takeaways: string[];
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  /** Tiny footer line under the CTAs, e.g. confidentiality note. */
  footerNote?: string;
}

export const EXEC_DECISION_BRIEF_DEFAULT_PROPS: ExecDecisionBriefBlockProps = {
  preparedForLabel: "Prepared for {{company_name}}",
  headline: "Cut order-processing cost 32% within 90 days of go-live.",
  thesis:
    "Manual order operations are now the single largest controllable cost in fulfillment. This brief lays out the pain, the proof, the criteria, and the math behind fixing it this quarter.",
  metaDate: "Decision brief · Q3",
  metaPreparer: "Prepared by your account team",
  showLogo: true,
  mastheadImageUrl:
    "https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?q=80&w=1100&h=1200&fit=crop",
  mastheadImageAlt: "An executive team reviewing a decision brief",

  showPain: true,
  painKicker: "Identified pain",
  painHeading: "Three costs the status quo books every month.",
  painHeader: "Pain",
  painCostHeader: "Cost if unresolved",
  painRows: [
    {
      pain: "Order exceptions are re-keyed by hand across three systems, so every error is touched twice.",
      owner: "Operations",
      cost: "$310K / yr",
    },
    {
      pain: "SLA penalties accrue because escalations sit in shared inboxes with no owner or clock.",
      owner: "Customer success",
      cost: "$96K / yr",
    },
    {
      pain: "Month-end close needs four analyst-days of reconciliation before finance will sign off.",
      owner: "Finance",
      cost: "48 days / yr",
    },
  ],

  showMetrics: true,
  metricsKicker: "Metrics",
  metricsHeading: "What customers measure after switching.",
  metrics: [
    { value: "32%", label: "Lower cost per order", source: "Median, first 90 days" },
    { value: "4.1x", label: "Faster exception resolution", source: "Across active deployments" },
    { value: "99.95%", label: "Platform uptime", source: "Trailing 12 months" },
  ],

  showCriteria: true,
  criteriaKicker: "Decision criteria",
  criteriaHeading: "Your requirements, mapped line by line.",
  criteriaIntro:
    "The evaluation committee set the bar. Each criterion below is the committee's own language, with how we meet it on the record.",
  criterionHeader: "Criterion",
  requirementHeader: "What you required",
  deliveryHeader: "How we deliver",
  alternativesHeader: "Status quo / alternatives",
  showAlternatives: false,
  criteriaRows: [
    {
      criterion: "Time to value",
      requirement: "First measurable savings inside one quarter, not a year-long program.",
      delivery: "Guided 6-week implementation; first workflows live by week 3.",
      alternative: "12–18 month internal build before any savings land.",
    },
    {
      criterion: "Security & compliance",
      requirement: "SOC 2 Type II, SSO, and full audit trails before procurement sign-off.",
      delivery: "SOC 2 Type II report on file; SSO/SCIM and immutable audit logs are standard.",
      alternative: "Point tools pass partially; spreadsheets fail audit outright.",
    },
    {
      criterion: "Integration coverage",
      requirement: "Native connections to the ERP and CRM already in production.",
      delivery: "Certified connectors for your stack, plus an open API for the long tail.",
      alternative: "Custom middleware adds a second system to maintain.",
    },
    {
      criterion: "Total cost of ownership",
      requirement: "Predictable pricing with no per-seat penalty as adoption grows.",
      delivery: "Flat platform fee; unlimited seats so rollout never fights the meter.",
      alternative: "Per-seat licenses tax exactly the adoption you want.",
    },
    {
      criterion: "Support model",
      requirement: "A named team with response SLAs, not a ticket queue.",
      delivery: "Named CSM plus 1-hour P1 response, in the contract.",
      alternative: "Community forums and best-effort email.",
    },
  ],

  showEconomics: true,
  economicsKicker: "Economic case",
  economicsHeading: "The math, in one panel.",
  investmentLabel: "Investment",
  investmentItems: [
    { label: "Platform (annual)", value: "$120,000" },
    { label: "Implementation (one-time)", value: "$18,000" },
    { label: "Training & enablement", value: "Included" },
  ],
  investmentTotalLabel: "Year-one investment",
  investmentTotal: "$138,000",
  returnLabel: "Return",
  returnItems: [
    { label: "Ops hours reclaimed", value: "$210,000" },
    { label: "Error & penalty reduction", value: "$96,000" },
    { label: "Faster order-to-cash", value: "$54,000" },
  ],
  returnTotalLabel: "Year-one return",
  returnTotal: "$360,000",
  paybackLabel: "Payback",
  paybackValue: "4.6 months",
  economicsFootnote:
    "Assumes current order volume and fully-loaded labor rates supplied by your team; figures are refined during evaluation.",

  showProcess: true,
  processKicker: "Decision process",
  processHeading: "What happens next.",
  processSteps: [
    {
      label: "Evaluation",
      timeframe: "Weeks 1–2",
      description: "Working session with the committee; success criteria and data access agreed.",
    },
    {
      label: "Security review",
      timeframe: "Weeks 3–4",
      description: "SOC 2 package, DPA, and architecture review with IT and procurement.",
    },
    {
      label: "Pilot",
      timeframe: "Weeks 5–10",
      description: "Two live workflows in one region, measured against the agreed baseline.",
    },
    {
      label: "Rollout decision",
      timeframe: "Week 12",
      description: "Executive review of pilot results; contract and rollout plan on the table.",
    },
  ],
  processImageUrl:
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1100&h=900&fit=crop",
  processImageAlt: "A working session mapping the evaluation timeline",

  showChampion: true,
  championKicker: "Share this brief",
  championHeading: "Forwarding this to your executive team?",
  championIntro: "Three lines that carry the whole case — paste them straight into the email.",
  takeawaysLabel: "Key takeaways — written to forward",
  takeaways: [
    "The status quo costs ~$400K a year in rework, penalties, and reconciliation.",
    "Every criterion the committee set is met, with evidence on the record.",
    "Year-one return of $360K against $138K invested — payback in under five months.",
  ],
  primaryCtaText: "Book the executive review",
  primaryCtaUrl: "#",
  secondaryCtaText: "Download as PDF",
  secondaryCtaUrl: "#",
  footerNote: "Prepared for internal evaluation. Figures refined jointly during the pilot.",
};

interface Props {
  props: ExecDecisionBriefBlockProps;
  /** Tenant brand config — drives default palette, fonts, and masthead logo. */
  brand?: BrandConfig;
  /** Builder inline-edit hook. When present, key copy is click-to-edit. */
  onFieldChange?: (updated: ExecDecisionBriefBlockProps) => void;
}

/* ── count-up numeral (reduced-motion + builder-safe) ────────────────────── */

function CountUpValue({
  value,
  color,
  reduced,
  durationMs,
  delay,
  onUpdate,
}: {
  value: string;
  color: string;
  reduced: boolean;
  durationMs: number;
  delay: number;
  onUpdate?: (v: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const parsed = parseStatValue(value);
  const animatable = parsed.num !== null && !reduced && !onUpdate;
  const [display, setDisplay] = useState(() =>
    animatable ? formatStatValue(parsed, 0) : value,
  );

  useEffect(() => {
    if (!animatable) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, parsed.num as number, {
      duration: durationMs / 1000,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(formatStatValue(parsed, latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView, value, durationMs, delay]);

  const style: React.CSSProperties = {
    fontFamily: NUMBERS,
    fontSize: "clamp(2.75rem, 6vw, 4.25rem)",
    letterSpacing: "-0.035em",
    lineHeight: 1,
    color,
    fontVariantNumeric: "tabular-nums",
  };

  if (onUpdate) {
    return (
      <span ref={ref} className="block font-bold tabular-nums" style={style}>
        <InlineText as="span" value={value} onUpdate={onUpdate} />
      </span>
    );
  }
  return (
    <span ref={ref} className="block font-bold tabular-nums" style={style}>
      {display}
    </span>
  );
}

/* ── block ───────────────────────────────────────────────────────────────── */

export function BlockExecDecisionBrief({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;

  /* — palette (brand-absorbed, contrast-guarded; no raw hardcoded text inks) — */
  const bg =
    props.bgColor && isValidHex(props.bgColor)
      ? props.bgColor
      : brand?.pageBackground && isValidHex(brand.pageBackground)
        ? brand.pageBackground
        : "#FBFBF9";
  const ink = resolveSectionInk({ textColor: props.inkColor }, { base: bg });
  const surfaceIsDark = relativeLuminance(isValidHex(bg) ? bg : "#ffffff") < 0.4;

  // Display-heading ink: deep navy-leaning by default, brand heading token first.
  const headline = pickContrastingColor(
    props.headlineColor,
    bg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#13243B", ink.text],
    4.5,
  );
  const accentRaw =
    props.accentColor && isValidHex(props.accentColor)
      ? props.accentColor
      : brand?.accentColor && isValidHex(brand.accentColor)
        ? brand.accentColor
        : "#2456D6";
  // Text-sized accent (kickers, checks, payback) needs AA; thin chrome only
  // needs to register.
  const accentText = pickContrastingColor(accentRaw, bg, [brand?.primaryColor, headline], 4.5);
  const accentChrome = ensureAccentRegisters(accentRaw, { base: bg }, 1.6);

  // Champion-strip dark surface: explicit prop, else a near-black mix of the
  // brand primary so the strip leans navy with the tenant's hue.
  const primaryHex =
    brand?.primaryColor && isValidHex(brand.primaryColor) ? brand.primaryColor : "#16263F";
  const dark =
    props.darkColor && isValidHex(props.darkColor)
      ? props.darkColor
      : mixHex(primaryHex, "#0A1018", 0.3);
  const darkInk = resolveSectionInk({}, { base: dark });
  const accentOnDark = pickContrastingColor(accentRaw, dark, [darkInk.text], 4.5);
  const headlineOnDark = pickContrastingColor(
    brand?.headingOnDarkColor,
    dark,
    [accentOnDark, darkInk.text],
    4.5,
  );

  // Warm-tinted band behind the metrics proof so the page reads as distinct
  // chapters rather than one flat surface. A whisper of accent over the page.
  const bandBg = mixHex(accentChrome, bg, surfaceIsDark ? 0.1 : 0.06);
  const bandInk = resolveSectionInk({ textColor: props.inkColor }, { base: bandBg });
  const bandAccent = pickContrastingColor(accentRaw, bandBg, [headline, bandInk.text], 4.5);

  // CTA pair on the dark strip.
  const ctaBg = pickContrastingColor(
    brand?.ctaBackground,
    dark,
    [accentRaw, brand?.primaryColor, "#FFFFFF"],
    3.0,
  );
  const ctaText = pickContrastingColor(brand?.ctaText, ctaBg, [contrastTextColor(ctaBg)], 4.5);

  const set = onFieldChange
    ? <K extends keyof ExecDecisionBriefBlockProps>(key: K, value: ExecDecisionBriefBlockProps[K]) =>
        onFieldChange({ ...props, [key]: value })
    : undefined;
  const edit = (key: keyof ExecDecisionBriefBlockProps) =>
    set ? (v: string) => set(key, v as never) : undefined;

  /* — section numbering follows the visible order — */
  const showPain = props.showPain !== false;
  const showMetrics = props.showMetrics !== false && props.metrics.length > 0;
  const showCriteria = props.showCriteria !== false;
  const showEconomics = props.showEconomics !== false;
  const showProcess = props.showProcess !== false;
  const showChampion = props.showChampion !== false;
  let sectionNo = 0;
  const nextNo = () => String(++sectionNo).padStart(2, "0");

  const showAlt = props.showAlternatives === true;
  const metrics = props.metrics.slice(0, 4);
  const metricCols =
    metrics.length >= 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : metrics.length === 3
        ? "sm:grid-cols-3"
        : metrics.length === 2
          ? "sm:grid-cols-2"
          : "sm:grid-cols-1";

  const fadeUp = (delay = 0) => ({
    initial: reduced ? false : ({ opacity: 0, y: 16 } as const),
    whileInView: reduced ? undefined : ({ opacity: 1, y: 0 } as const),
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const kickerStyle: React.CSSProperties = { color: accentText };
  const kickerClass = "text-[11px] font-bold uppercase tracking-[0.22em]";
  const focusable =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

  const SectionHead = ({
    no,
    kicker,
    kickerKey,
    heading,
    headingKey,
  }: {
    no: string;
    kicker?: string;
    kickerKey: keyof ExecDecisionBriefBlockProps;
    heading: string;
    headingKey: keyof ExecDecisionBriefBlockProps;
  }) => (
    <motion.div {...fadeUp()} className="mb-8 sm:mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color: ink.muted, fontFamily: NUMBERS }}
        >
          {no}
        </span>
        <span className="h-px flex-none w-6 self-center" style={{ background: accentChrome }} />
        <span className={kickerClass} style={kickerStyle}>
          <InlineText as="span" value={kicker ?? ""} onUpdate={edit(kickerKey)} />
        </span>
      </div>
      <h2
        className="text-2xl sm:text-3xl lg:text-4xl tracking-tight"
        style={{ color: headline, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
      >
        <InlineText as="span" value={heading} onUpdate={edit(headingKey)} multiline />
      </h2>
    </motion.div>
  );

  /* — array field updaters (builder) — */
  const setPainRow = set
    ? (i: number, patch: Partial<ExecPainRow>) =>
        set(
          "painRows",
          props.painRows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
        )
    : undefined;
  const setMetric = set
    ? (i: number, patch: Partial<ExecMetric>) =>
        set(
          "metrics",
          props.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)),
        )
    : undefined;
  const setCriterion = set
    ? (i: number, patch: Partial<ExecCriterionRow>) =>
        set(
          "criteriaRows",
          props.criteriaRows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
        )
    : undefined;
  const setInvestItem = set
    ? (i: number, patch: Partial<ExecLineItem>) =>
        set(
          "investmentItems",
          props.investmentItems.map((r, j) => (j === i ? { ...r, ...patch } : r)),
        )
    : undefined;
  const setReturnItem = set
    ? (i: number, patch: Partial<ExecLineItem>) =>
        set(
          "returnItems",
          props.returnItems.map((r, j) => (j === i ? { ...r, ...patch } : r)),
        )
    : undefined;
  const setStep = set
    ? (i: number, patch: Partial<ExecProcessStep>) =>
        set(
          "processSteps",
          props.processSteps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
        )
    : undefined;
  const setTakeaway = set
    ? (i: number, v: string) =>
        set(
          "takeaways",
          props.takeaways.map((t, j) => (j === i ? v : t)),
        )
    : undefined;

  const hasLogo = props.showLogo !== false && !!brand && brandHasLogo(brand, props.logoUrl);

  const hasMastheadImage = !!props.mastheadImageUrl || !!onFieldChange;
  const hasProcessImage = !!props.processImageUrl || !!onFieldChange;

  /** Shared framed-image shell — rounded, hairline ring, soft boardroom shadow,
   *  graceful empty state via InlineImage's placeholder in builder. */
  const FramedImage = ({
    urlKey,
    altKey,
    focalKey,
    src,
    alt,
    focal,
    aspect,
    eager,
  }: {
    urlKey: keyof ExecDecisionBriefBlockProps;
    altKey: keyof ExecDecisionBriefBlockProps;
    focalKey: keyof ExecDecisionBriefBlockProps;
    src?: string;
    alt?: string;
    focal?: string;
    aspect: string;
    eager?: boolean;
  }) => (
    <div
      className="relative overflow-hidden rounded-2xl w-full"
      style={{
        border: `1px solid ${ink.hairline}`,
        boxShadow: "0 24px 56px -30px rgba(19, 36, 59, 0.45)",
        background: bandBg,
        aspectRatio: aspect,
      }}
    >
      <InlineImage
        src={src ?? ""}
        alt={alt ?? ""}
        className="absolute inset-0 h-full w-full object-cover"
        wrapperClassName="absolute inset-0"
        loading={eager ? "eager" : "lazy"}
        onUpdate={edit(urlKey)}
        onAltUpdate={edit(altKey)}
        focalPoint={focal}
        onFocalUpdate={edit(focalKey)}
      />
    </div>
  );

  /* — economic line-item column (shared markup for investment / return) — */
  const EconColumn = ({
    label,
    labelKey,
    items,
    setItem,
    totalLabel,
    totalLabelKey,
    total,
    totalKey,
    theme,
  }: {
    label?: string;
    labelKey: keyof ExecDecisionBriefBlockProps;
    items: ExecLineItem[];
    setItem?: (i: number, patch: Partial<ExecLineItem>) => void;
    totalLabel?: string;
    totalLabelKey: keyof ExecDecisionBriefBlockProps;
    total: string;
    totalKey: keyof ExecDecisionBriefBlockProps;
    /** Surface-resolved tones so the column reads on light or dark panels. */
    theme: { text: string; muted: string; hairline: string; label: string; total: string };
  }) => (
    <div>
      <div
        className={`${kickerClass} pb-3 mb-1`}
        style={{ color: theme.label, borderBottom: `1px solid ${theme.hairline}` }}
      >
        <InlineText as="span" value={label ?? ""} onUpdate={edit(labelKey)} />
      </div>
      <dl>
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4 py-2.5"
            style={{ borderBottom: `1px solid ${theme.hairline}` }}
          >
            <dt className="text-sm" style={{ color: theme.muted }}>
              <InlineText
                as="span"
                value={item.label}
                onUpdate={setItem ? (v) => setItem(i, { label: v }) : undefined}
              />
            </dt>
            <dd
              className="text-sm font-semibold tabular-nums text-right"
              style={{ color: theme.text, fontFamily: NUMBERS, fontVariantNumeric: "tabular-nums" }}
            >
              <InlineText
                as="span"
                value={item.value}
                onUpdate={setItem ? (v) => setItem(i, { value: v }) : undefined}
              />
            </dd>
          </div>
        ))}
        <div
          className="flex items-baseline justify-between gap-4 pt-3 mt-1"
          style={{ borderTop: `2px solid ${theme.text}` }}
        >
          <dt className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: theme.text }}>
            <InlineText as="span" value={totalLabel ?? ""} onUpdate={edit(totalLabelKey)} />
          </dt>
          <dd
            className="text-xl sm:text-2xl font-bold tabular-nums text-right"
            style={{ color: theme.total, fontFamily: NUMBERS, fontVariantNumeric: "tabular-nums" }}
          >
            <InlineText as="span" value={total} onUpdate={edit(totalKey)} />
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <div className="edb-root" style={{ background: bg, color: ink.text, fontFamily: BODY }}>
      <style>{`
        .edb-root { position: relative; }
        .edb-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.5;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        }
        .edb-root > * { position: relative; }
        .edb-card {
          transition: transform 0.3s cubic-bezier(.16,1,.3,1),
                      box-shadow 0.3s cubic-bezier(.16,1,.3,1);
        }
        .edb-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 40px -26px rgba(19, 36, 59, 0.4);
        }
        .edb-aurora { will-change: transform; }
        .edb-aurora-1 { animation: edb-drift-1 30s ease-in-out infinite alternate; }
        .edb-aurora-2 { animation: edb-drift-2 36s ease-in-out infinite alternate; }
        @keyframes edb-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(5%, 7%, 0) scale(1.08); }
        }
        @keyframes edb-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.05); }
          to   { transform: translate3d(-6%, -5%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .edb-aurora { animation: none !important; }
          .edb-card, .edb-card:hover { transition: none; transform: none; }
        }
      `}</style>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* ── 1. Masthead ──────────────────────────────────────────────── */}
        <header className="pt-12 sm:pt-16 lg:pt-20 pb-10 sm:pb-14">
          <motion.div
            {...fadeUp()}
            className={
              hasMastheadImage
                ? "grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center"
                : undefined
            }
          >
            <div className={hasMastheadImage ? "lg:col-span-7" : undefined}>
            <div className="flex items-center justify-between gap-4 mb-8 sm:mb-10">
              <span className={kickerClass} style={kickerStyle}>
                <InlineText
                  as="span"
                  value={props.preparedForLabel}
                  onUpdate={edit("preparedForLabel")}
                />
              </span>
              {hasLogo && brand && (
                <BrandLogo
                  brand={brand}
                  url={props.logoUrl}
                  alt={props.logoAlt || brand.brandName || "Logo"}
                  tone={surfaceIsDark ? "onDark" : "onLight"}
                  autoContrast
                  className="h-6 w-auto shrink-0"
                />
              )}
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl leading-[1.04] tracking-tight max-w-4xl"
              style={{
                color: headline,
                fontFamily: DISPLAY,
                fontWeight: "var(--brand-heading-weight, 700)" as never,
              }}
            >
              <InlineText as="span" value={props.headline} onUpdate={edit("headline")} multiline />
            </h1>
            <p
              className="mt-6 text-base sm:text-lg leading-relaxed max-w-2xl"
              style={{ color: ink.muted }}
            >
              <InlineText as="span" value={props.thesis} onUpdate={edit("thesis")} multiline />
            </p>
            {(props.metaDate || props.metaPreparer || onFieldChange) && (
              <div
                className="mt-8 pt-4 flex flex-wrap items-center gap-x-8 gap-y-1 text-[11px] uppercase tracking-[0.16em]"
                style={{ borderTop: `1px solid ${ink.hairline}`, color: ink.muted }}
              >
                {(props.metaDate || onFieldChange) && (
                  <InlineText as="span" value={props.metaDate ?? ""} onUpdate={edit("metaDate")} />
                )}
                {(props.metaPreparer || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.metaPreparer ?? ""}
                    onUpdate={edit("metaPreparer")}
                  />
                )}
              </div>
            )}
            </div>
            {hasMastheadImage && (
              <div className="lg:col-span-5">
                <FramedImage
                  urlKey="mastheadImageUrl"
                  altKey="mastheadImageAlt"
                  focalKey="mastheadImageFocal"
                  src={props.mastheadImageUrl}
                  alt={props.mastheadImageAlt}
                  focal={props.mastheadImageFocal}
                  aspect="4 / 5"
                  eager
                />
              </div>
            )}
          </motion.div>
        </header>

        {/* ── 2. Identified pain ───────────────────────────────────────── */}
        {showPain && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.painKicker || "Identified pain"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.painKicker}
              kickerKey="painKicker"
              heading={props.painHeading}
              headingKey="painHeading"
            />
            <motion.div {...fadeUp(0.05)}>
              {/* table header (md+) */}
              <div
                className="hidden md:grid md:grid-cols-[1fr_12rem] gap-6 pb-2 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: ink.muted }}
              >
                <span>
                  <InlineText as="span" value={props.painHeader ?? ""} onUpdate={edit("painHeader")} />
                </span>
                <span className="text-right">
                  <InlineText
                    as="span"
                    value={props.painCostHeader ?? ""}
                    onUpdate={edit("painCostHeader")}
                  />
                </span>
              </div>
              {props.painRows.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-[1fr_12rem] gap-2 md:gap-6 py-5"
                  style={{ borderTop: `1px solid ${ink.hairline}` }}
                >
                  <div>
                    {(row.owner || onFieldChange) && (
                      <div
                        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
                        style={{ color: accentText }}
                      >
                        <InlineText
                          as="span"
                          value={row.owner ?? ""}
                          onUpdate={setPainRow ? (v) => setPainRow(i, { owner: v }) : undefined}
                        />
                      </div>
                    )}
                    <p className="text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: ink.text }}>
                      <InlineText
                        as="span"
                        value={row.pain}
                        onUpdate={setPainRow ? (v) => setPainRow(i, { pain: v }) : undefined}
                        multiline
                      />
                    </p>
                  </div>
                  <div className="md:text-right">
                    <span
                      className="md:hidden block text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5"
                      style={{ color: ink.muted }}
                    >
                      {props.painCostHeader}
                    </span>
                    <span
                      className="text-xl sm:text-2xl font-bold tabular-nums"
                      style={{
                        color: headline,
                        fontFamily: NUMBERS,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <InlineText
                        as="span"
                        value={row.cost}
                        onUpdate={setPainRow ? (v) => setPainRow(i, { cost: v }) : undefined}
                      />
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${ink.hairline}` }} />
            </motion.div>
          </section>
        )}

        {/* ── 3. Metrics proof band — full-bleed tinted chapter ────────── */}
        {showMetrics && (
          <section
            className="relative py-12 sm:py-16 -mx-5 sm:-mx-8 lg:-mx-10 px-5 sm:px-8 lg:px-10"
            style={{
              background: bandBg,
              borderTop: `1px solid ${ink.hairline}`,
              borderBottom: `1px solid ${ink.hairline}`,
            }}
            aria-label={props.metricsKicker || "Metrics"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.metricsKicker}
              kickerKey="metricsKicker"
              heading={props.metricsHeading}
              headingKey="metricsHeading"
            />
            <div className={`grid grid-cols-1 ${metricCols} gap-5`}>
              {metrics.map((m, i) => (
                <motion.div
                  key={i}
                  {...fadeUp(i * 0.06)}
                  className="edb-card rounded-2xl p-6 sm:p-7"
                  style={{
                    background: bg,
                    border: `1px solid ${ink.hairline}`,
                    boxShadow: "0 12px 32px -26px rgba(19, 36, 59, 0.3)",
                  }}
                >
                  <span
                    aria-hidden
                    className="mb-4 block h-[3px] w-9 rounded-full"
                    style={{ background: bandAccent }}
                  />
                  <CountUpValue
                    value={m.value}
                    color={headline}
                    reduced={reduced}
                    durationMs={props.countUpMs ?? 1400}
                    delay={i * 0.1}
                    onUpdate={setMetric ? (v) => setMetric(i, { value: v }) : undefined}
                  />
                  <p className="mt-3 text-sm font-semibold" style={{ color: ink.text }}>
                    <InlineText
                      as="span"
                      value={m.label}
                      onUpdate={setMetric ? (v) => setMetric(i, { label: v }) : undefined}
                    />
                  </p>
                  {(m.source || onFieldChange) && (
                    <p className="mt-1 text-xs" style={{ color: ink.muted }}>
                      <InlineText
                        as="span"
                        value={m.source ?? ""}
                        onUpdate={setMetric ? (v) => setMetric(i, { source: v }) : undefined}
                      />
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── 4. Decision criteria ─────────────────────────────────────── */}
        {showCriteria && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.criteriaKicker || "Decision criteria"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.criteriaKicker}
              kickerKey="criteriaKicker"
              heading={props.criteriaHeading}
              headingKey="criteriaHeading"
            />
            {(props.criteriaIntro || onFieldChange) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: ink.muted }}
              >
                <InlineText
                  as="span"
                  value={props.criteriaIntro ?? ""}
                  onUpdate={edit("criteriaIntro")}
                  multiline
                />
              </motion.p>
            )}
            <motion.div {...fadeUp(0.08)}>
              {/* header row (md+) */}
              <div
                className={`hidden md:grid gap-6 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${
                  showAlt
                    ? "md:grid-cols-[9rem_1fr_1fr_1fr_2.25rem]"
                    : "md:grid-cols-[11rem_1fr_1fr_2.25rem]"
                }`}
                style={{ color: ink.muted }}
              >
                <span>
                  <InlineText as="span" value={props.criterionHeader ?? ""} onUpdate={edit("criterionHeader")} />
                </span>
                <span>
                  <InlineText as="span" value={props.requirementHeader ?? ""} onUpdate={edit("requirementHeader")} />
                </span>
                <span>
                  <InlineText as="span" value={props.deliveryHeader ?? ""} onUpdate={edit("deliveryHeader")} />
                </span>
                {showAlt && (
                  <span>
                    <InlineText as="span" value={props.alternativesHeader ?? ""} onUpdate={edit("alternativesHeader")} />
                  </span>
                )}
                <span aria-hidden />
              </div>
              {props.criteriaRows.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-1 gap-2 md:gap-6 py-5 ${
                    showAlt
                      ? "md:grid-cols-[9rem_1fr_1fr_1fr_2.25rem]"
                      : "md:grid-cols-[11rem_1fr_1fr_2.25rem]"
                  }`}
                  style={{ borderTop: `1px solid ${ink.hairline}` }}
                >
                  <div
                    className="text-sm font-bold tracking-tight"
                    style={{ color: headline, fontFamily: DISPLAY }}
                  >
                    <InlineText
                      as="span"
                      value={row.criterion}
                      onUpdate={setCriterion ? (v) => setCriterion(i, { criterion: v }) : undefined}
                    />
                  </div>
                  <div>
                    <span
                      className="md:hidden block text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5"
                      style={{ color: ink.muted }}
                    >
                      {props.requirementHeader}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: ink.muted }}>
                      <InlineText
                        as="span"
                        value={row.requirement}
                        onUpdate={setCriterion ? (v) => setCriterion(i, { requirement: v }) : undefined}
                        multiline
                      />
                    </p>
                  </div>
                  <div>
                    <span
                      className="md:hidden block text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5 mt-1"
                      style={{ color: ink.muted }}
                    >
                      {props.deliveryHeader}
                    </span>
                    <p className="text-sm leading-relaxed font-medium" style={{ color: ink.text }}>
                      <InlineText
                        as="span"
                        value={row.delivery}
                        onUpdate={setCriterion ? (v) => setCriterion(i, { delivery: v }) : undefined}
                        multiline
                      />
                    </p>
                  </div>
                  {showAlt && (
                    <div>
                      <span
                        className="md:hidden block text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5 mt-1"
                        style={{ color: ink.muted }}
                      >
                        {props.alternativesHeader}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: ink.muted }}>
                        <InlineText
                          as="span"
                          value={row.alternative ?? ""}
                          onUpdate={
                            setCriterion ? (v) => setCriterion(i, { alternative: v }) : undefined
                          }
                          multiline
                        />
                      </p>
                    </div>
                  )}
                  <div className="hidden md:flex items-start justify-end pt-0.5">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full"
                      style={{
                        border: `1.5px solid ${accentText}`,
                        color: accentText,
                      }}
                      aria-label="Criterion met"
                      role="img"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${ink.hairline}` }} />
            </motion.div>
          </section>
        )}

        {/* ── 5. Economic case ─────────────────────────────────────────── */}
        {showEconomics && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.economicsKicker || "Economic case"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.economicsKicker}
              kickerKey="economicsKicker"
              heading={props.economicsHeading}
              headingKey="economicsHeading"
            />
            <motion.div
              {...fadeUp(0.05)}
              className="relative overflow-hidden rounded-2xl p-6 sm:p-10"
              style={{ background: dark }}
            >
              {!reduced && (
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                  <span
                    className="edb-aurora edb-aurora-1 absolute rounded-full"
                    style={{
                      width: "32rem",
                      height: "32rem",
                      top: "-14rem",
                      right: "-10rem",
                      background: `radial-gradient(closest-side, ${mixHex(accentRaw, dark, 0.3)} 0%, transparent 72%)`,
                      filter: "blur(20px)",
                      opacity: 0.5,
                    }}
                  />
                  <span
                    className="edb-aurora edb-aurora-2 absolute rounded-full"
                    style={{
                      width: "28rem",
                      height: "28rem",
                      bottom: "-12rem",
                      left: "-8rem",
                      background: `radial-gradient(closest-side, ${mixHex(primaryHex, dark, 0.5)} 0%, transparent 72%)`,
                      filter: "blur(24px)",
                      opacity: 0.45,
                    }}
                  />
                </div>
              )}
              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
                <EconColumn
                  label={props.investmentLabel}
                  labelKey="investmentLabel"
                  items={props.investmentItems}
                  setItem={setInvestItem}
                  totalLabel={props.investmentTotalLabel}
                  totalLabelKey="investmentTotalLabel"
                  total={props.investmentTotal}
                  totalKey="investmentTotal"
                  theme={{
                    text: darkInk.text,
                    muted: darkInk.muted,
                    hairline: darkInk.hairline,
                    label: accentOnDark,
                    total: headlineOnDark,
                  }}
                />
                <EconColumn
                  label={props.returnLabel}
                  labelKey="returnLabel"
                  items={props.returnItems}
                  setItem={setReturnItem}
                  totalLabel={props.returnTotalLabel}
                  totalLabelKey="returnTotalLabel"
                  total={props.returnTotal}
                  totalKey="returnTotal"
                  theme={{
                    text: darkInk.text,
                    muted: darkInk.muted,
                    hairline: darkInk.hairline,
                    label: accentOnDark,
                    total: accentOnDark,
                  }}
                />
              </div>
              <div
                className="relative mt-10 pt-8 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-5"
                style={{ borderTop: `1px solid ${darkInk.hairline}` }}
              >
                <span className={kickerClass} style={{ color: accentOnDark }}>
                  <InlineText as="span" value={props.paybackLabel ?? ""} onUpdate={edit("paybackLabel")} />
                </span>
                <span
                  className="font-bold tabular-nums tracking-tight"
                  style={{
                    color: headlineOnDark,
                    fontFamily: NUMBERS,
                    fontSize: "clamp(2rem, 5vw, 3.25rem)",
                    lineHeight: 1.05,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <InlineText as="span" value={props.paybackValue} onUpdate={edit("paybackValue")} />
                </span>
              </div>
            </motion.div>
            {(props.economicsFootnote || onFieldChange) && (
              <p className="mt-4 text-xs leading-relaxed max-w-2xl" style={{ color: ink.muted }}>
                <InlineText
                  as="span"
                  value={props.economicsFootnote ?? ""}
                  onUpdate={edit("economicsFootnote")}
                  multiline
                />
              </p>
            )}
          </section>
        )}

        {/* ── 6. Decision process ──────────────────────────────────────── */}
        {showProcess && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.processKicker || "Decision process"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.processKicker}
              kickerKey="processKicker"
              heading={props.processHeading}
              headingKey="processHeading"
            />
            <div
              className={
                hasProcessImage
                  ? "grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center"
                  : undefined
              }
            >
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8 ${
                hasProcessImage
                  ? "lg:col-span-7 lg:grid-cols-2"
                  : props.processSteps.length >= 4
                    ? "lg:grid-cols-4"
                    : "lg:grid-cols-3"
              }`}
            >
              {props.processSteps.map((step, i) => (
                <motion.div
                  key={i}
                  {...fadeUp(i * 0.06)}
                  className="pt-4"
                  style={{ borderTop: `2px solid ${i === 0 ? accentChrome : ink.hairline}` }}
                >
                  <div
                    className="text-[11px] font-semibold tabular-nums mb-3"
                    style={{ color: ink.muted, fontFamily: NUMBERS }}
                  >
                    {String(i + 1).padStart(2, "0")}
                    {(step.timeframe || onFieldChange) && (
                      <>
                        {" — "}
                        <InlineText
                          as="span"
                          value={step.timeframe ?? ""}
                          onUpdate={setStep ? (v) => setStep(i, { timeframe: v }) : undefined}
                        />
                      </>
                    )}
                  </div>
                  <h3
                    className="text-base font-bold tracking-tight mb-2"
                    style={{ color: headline, fontFamily: DISPLAY }}
                  >
                    <InlineText
                      as="span"
                      value={step.label}
                      onUpdate={setStep ? (v) => setStep(i, { label: v }) : undefined}
                    />
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: ink.muted }}>
                    <InlineText
                      as="span"
                      value={step.description}
                      onUpdate={setStep ? (v) => setStep(i, { description: v }) : undefined}
                      multiline
                    />
                  </p>
                </motion.div>
              ))}
            </div>
            {hasProcessImage && (
              <motion.div {...fadeUp(0.08)} className="lg:col-span-5">
                <FramedImage
                  urlKey="processImageUrl"
                  altKey="processImageAlt"
                  focalKey="processImageFocal"
                  src={props.processImageUrl}
                  alt={props.processImageAlt}
                  focal={props.processImageFocal}
                  aspect="4 / 3"
                />
              </motion.div>
            )}
            </div>
          </section>
        )}
      </div>

      {/* ── 7. Champion tools strip ──────────────────────────────────────── */}
      {showChampion && (
        <section
          className="mt-4"
          style={{ background: dark }}
          aria-label={props.championKicker || "Share this brief"}
        >
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 py-12 sm:py-16">
            <motion.div {...fadeUp()}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: darkInk.muted, fontFamily: NUMBERS }}
                >
                  {nextNo()}
                </span>
                <span className="h-px w-6" style={{ background: accentOnDark }} />
                <span className={kickerClass} style={{ color: accentOnDark }}>
                  <InlineText as="span" value={props.championKicker ?? ""} onUpdate={edit("championKicker")} />
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5">
                  <h2
                    className="text-2xl sm:text-3xl tracking-tight mb-4"
                    style={{
                      color: darkInk.text,
                      fontFamily: DISPLAY,
                      fontWeight: "var(--brand-heading-weight, 700)" as never,
                    }}
                  >
                    <InlineText as="span" value={props.championHeading} onUpdate={edit("championHeading")} multiline />
                  </h2>
                  {(props.championIntro || onFieldChange) && (
                    <p className="text-sm leading-relaxed mb-8" style={{ color: darkInk.muted }}>
                      <InlineText
                        as="span"
                        value={props.championIntro ?? ""}
                        onUpdate={edit("championIntro")}
                        multiline
                      />
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <a
                      href={props.primaryCtaUrl}
                      className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold tracking-wide transition-opacity hover:opacity-90 ${focusable}`}
                      style={{ background: ctaBg, color: ctaText }}
                    >
                      {props.primaryCtaText}
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </a>
                    {props.secondaryCtaText && (
                      <a
                        href={props.secondaryCtaUrl || "#"}
                        className={`inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold tracking-wide transition-colors hover:opacity-90 ${focusable}`}
                        style={{
                          border: `1px solid ${darkInk.hairline}`,
                          color: darkInk.text,
                        }}
                      >
                        {props.secondaryCtaText}
                      </a>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-7">
                  <div
                    className="p-6 sm:p-8"
                    style={{
                      border: `1px solid ${darkInk.hairline}`,
                      background: mixHex(darkInk.text, dark, 0.04),
                    }}
                  >
                    <div
                      className="text-[10px] font-bold uppercase tracking-[0.2em] mb-5"
                      style={{ color: darkInk.muted }}
                    >
                      <InlineText
                        as="span"
                        value={props.takeawaysLabel ?? ""}
                        onUpdate={edit("takeawaysLabel")}
                      />
                    </div>
                    <ul className="space-y-4">
                      {props.takeaways.map((t, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span
                            className="mt-[3px] inline-flex w-5 h-5 flex-none items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                            style={{
                              border: `1px solid ${accentOnDark}`,
                              color: accentOnDark,
                              fontFamily: NUMBERS,
                            }}
                            aria-hidden
                          >
                            {i + 1}
                          </span>
                          <p className="text-sm leading-relaxed" style={{ color: darkInk.text }}>
                            <InlineText
                              as="span"
                              value={t}
                              onUpdate={setTakeaway ? (v) => setTakeaway(i, v) : undefined}
                              multiline
                            />
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(props.footerNote || onFieldChange) && (
                    <p className="mt-4 text-[11px] leading-relaxed" style={{ color: darkInk.muted }}>
                      <InlineText
                        as="span"
                        value={props.footerNote ?? ""}
                        onUpdate={edit("footerNote")}
                        multiline
                      />
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
}

export default BlockExecDecisionBrief;
