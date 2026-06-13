import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, TrendingUp } from "lucide-react";
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
import { CtaButton } from "@/components/CtaButton";
import type { CtaModalConfig, HeroCtaConfig } from "@/lib/block-types";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { formatStatValue, parseStatValue } from "./BlockStatCounterBand";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/* ----------------------------------------------------------------------------
 * Value & Renewal Review — type "value-renewal-review"
 *
 * ABM expansion-and-renewal microsite. A confident executive readout a CSM/rep
 * sends before a renewal or QBR to recap value delivered and open the expansion
 * conversation: a personalized hero with headline result, a "value delivered"
 * count-up stat band on a dark aurora chapter (the renewal justification in
 * numbers), a usage & adoption story with milestone momentum + a browser-framed
 * product-UI proof slot, wins/proof quotes, an expansion roadmap framed as
 * theirs (not a hard upsell), a renewal terms recap with a low-friction renewal
 * CTA, and a team & next-steps close.
 *
 * Executive-readout register, data-led but warm: cream canvas with paper grain,
 * white ink-hairline cards with warm shadow, gold/sage tints for an established-
 * relationship feel, indigo for actions, coral spark reserved for up-trend
 * marks, mono numbered section markers, slow aurora on the dark "year in
 * numbers" chapter, count-up on realized metrics. All figures are editorial
 * strings, never live math. Single h1 (hero). NO_REVEAL — owns its own motion.
 *
 * CTAs (hero primary + renewal + close) use the shared CtaModalConfig +
 * HeroCtaConfig mixin + the CtaButton suite, so a future "copy CTA config to
 * all" can target them uniformly.
 * -------------------------------------------------------------------------- */

export interface VrrMetric {
  /** Display value with affixes, e.g. "32%", "$1.4M", "11 hrs/wk" — animatable. */
  value: string;
  /** Short label under the numeral (2–6 words). */
  label: string;
  /** Optional small-print context, e.g. "vs. last term". */
  source?: string;
}

export interface VrrMilestone {
  /** Milestone title, e.g. "Rolled out to all regions" (one short clause). */
  title: string;
  /** Optional timeframe, e.g. "Q2" or "March". */
  when?: string;
  /** Optional one-line detail. */
  detail?: string;
}

export interface VrrWin {
  /** The headline outcome / quote (one or two sentences). */
  quote: string;
  /** Attribution, e.g. "VP Operations, your team". */
  attribution?: string;
}

export interface VrrExpansionItem {
  /** Option title, e.g. "Advanced analytics" or "10 more seats". */
  title: string;
  /** One-sentence description framed as their next step. */
  detail: string;
  /** Optional small tag, e.g. "Most-requested" or "Next quarter". */
  tag?: string;
}

export interface VrrTermRow {
  /** Term label, e.g. "Plan" or "Seats". */
  label: string;
  /** Term value, e.g. "Enterprise" or "150 included". */
  value: string;
}

export interface ValueRenewalReviewBlockProps extends CtaModalConfig, HeroCtaConfig {
  /* ── palette overrides (all optional; brand-derived defaults) ─────────── */
  /** Page surface. Defaults to the brand page background (or warm cream). */
  bgColor?: string;
  /** Body text override — only honored when it meets AA on the surface. */
  inkColor?: string;
  /** Display-heading ink. Defaults to brand heading-on-light / deep indigo. */
  headlineColor?: string;
  /** Accent — markers, links, actions. Defaults to the brand accent / indigo. */
  accentColor?: string;
  /** Established-relationship tint — section bands, chrome. Defaults to gold. */
  tintColor?: string;
  /** Spark — up-trend marks. Defaults to coral. */
  sparkColor?: string;
  /** "Year in numbers" dark surface. Defaults to a deep-indigo mix of brand primary. */
  darkColor?: string;

  /* ── 1. hero ──────────────────────────────────────────────────────────── */
  /** Eyebrow, personalization-token friendly: "Value review for {{company_name}}". */
  eyebrow: string;
  /** Account name shown in the lockup / hero copy, e.g. "Acme". */
  accountName: string;
  /** Your company name, used in copy + the year-with line. */
  yourName: string;
  /** The hero headline — the page's only h1 (e.g. "Acme: your year with Your Co"). */
  headline: string;
  /** The headline result line under the h1 (one sentence, ≤ 30 words). */
  subheadline?: string;
  /** Optional account logo URL shown in the hero. */
  accountLogoUrl?: string;
  accountLogoAlt?: string;
  /** Show your (tenant brand) logo in the hero. Default true (hidden if none). */
  showLogo?: boolean;
  logoUrl?: string;
  logoAlt?: string;
  /** Optional meta line, e.g. "Annual review · 2026". */
  metaLine?: string;
  /** Hero CTA label lives in `ctaText`; secondary in `ctaSecondaryText`/`ctaSecondaryUrl`. */

  /* ── 2. value delivered ───────────────────────────────────────────────── */
  showValue?: boolean;
  valueKicker?: string;
  valueHeading: string;
  valueIntro?: string;
  /** 3–4 oversized count-up metrics; graceful with fewer. */
  metrics: VrrMetric[];
  /** Count-up duration in ms. Default 1400. */
  countUpMs?: number;

  /* ── 3. usage & adoption story ────────────────────────────────────────── */
  showUsage?: boolean;
  usageKicker?: string;
  usageHeading: string;
  usageIntro?: string;
  /** Milestones hit this term — momentum, in order. */
  milestones: VrrMilestone[];
  /** Browser-framed product-UI proof image. */
  productImageUrl?: string;
  productImageAlt?: string;
  /** Faux browser address-bar label, e.g. "app.yourco.com". */
  productUrlLabel?: string;

  /* ── 4. wins / proof ──────────────────────────────────────────────────── */
  showWins?: boolean;
  winsKicker?: string;
  winsHeading: string;
  /** 1–2 quotes / outcomes. */
  wins: VrrWin[];

  /* ── 5. what's next / expansion ───────────────────────────────────────── */
  showExpansion?: boolean;
  expansionKicker?: string;
  expansionHeading: string;
  expansionIntro?: string;
  /** Modules/seats/use-cases framed as their roadmap. */
  expansionItems: VrrExpansionItem[];

  /* ── 6. the renewal ───────────────────────────────────────────────────── */
  showRenewal?: boolean;
  renewalKicker?: string;
  renewalHeading: string;
  renewalIntro?: string;
  /** Terms recap rows, e.g. plan / seats / term / price. */
  termRows: VrrTermRow[];
  /** Renewal CTA label lives in `ctaText` (shared); this is the small assurance line. */
  renewalNote?: string;

  /* ── 7. your team & next steps ────────────────────────────────────────── */
  showClose?: boolean;
  closeKicker?: string;
  closeHeading: string;
  closeIntro?: string;
  /** Tiny footer line under the close CTAs. */
  footerNote?: string;
}

export const VALUE_RENEWAL_REVIEW_DEFAULT_PROPS: ValueRenewalReviewBlockProps = {
  /* hero CTA suite (HeroCtaConfig) */
  ctaText: "Book your renewal conversation",
  ctaUrl: "#close",
  ctaAction: "url",
  ctaSecondaryText: "See what's next",
  ctaSecondaryUrl: "#expansion",

  eyebrow: "Value review for {{company_name}}",
  accountName: "Acme",
  yourName: "Your Co",
  headline: "Acme: your year with Your Co.",
  subheadline:
    "A year in, the numbers are clear: faster work, fewer errors, and a team that's all-in. Here's what we delivered together — and where we go next.",
  showLogo: true,
  metaLine: "Annual review · 2026",

  showValue: true,
  valueKicker: "Value delivered",
  valueHeading: "What this term was worth.",
  valueIntro:
    "The results your team realized over the last twelve months, measured against the baseline we set together.",
  metrics: [
    { value: "32%", label: "Lower cost per order", source: "vs. last term" },
    { value: "$1.4M", label: "Realized return this term", source: "Net of platform cost" },
    { value: "4.1x", label: "Faster exception resolution", source: "Across your workflows" },
    { value: "94%", label: "Team active monthly", source: "Up from 61% at start" },
  ],
  countUpMs: 1400,

  showUsage: true,
  usageKicker: "Usage & adoption",
  usageHeading: "Momentum built over the year.",
  usageIntro:
    "Adoption didn't spike and fade — it compounded. Here are the milestones your team hit, in order.",
  milestones: [
    { title: "Rolled out to all regions", when: "Q1", detail: "From one pilot team to the full org in under a quarter." },
    { title: "Automated the top three workflows", when: "Q2", detail: "The manual rework that used to fill mornings, gone." },
    { title: "Hit 90% monthly active", when: "Q3", detail: "Daily use became the default, not the exception." },
    { title: "Launched executive reporting", when: "Q4", detail: "Leadership now sees the numbers without asking." },
  ],
  productUrlLabel: "app.yourco.com",

  showWins: true,
  winsKicker: "In their words",
  winsHeading: "What your team is saying.",
  wins: [
    {
      quote:
        "We expected a tool. We got a step-change in how the team works — and the rollout never fought us.",
      attribution: "VP Operations, your team",
    },
    {
      quote:
        "The escalations that used to disappear now have an owner and a clock. That alone paid for the year.",
      attribution: "Director of Support, your team",
    },
  ],

  showExpansion: true,
  expansionKicker: "What's next",
  expansionHeading: "Your roadmap for the year ahead.",
  expansionIntro:
    "Not an upsell — the next steps that build on what's already working. Pick what fits; we'll pace it with you.",
  expansionItems: [
    {
      title: "Advanced analytics",
      detail: "Turn the data you're already capturing into the forecasting your leadership keeps asking for.",
      tag: "Most-requested",
    },
    {
      title: "Twenty more seats",
      detail: "Extend to the two teams on the waitlist, at the same flat rate — no per-seat penalty.",
      tag: "Ready now",
    },
    {
      title: "A second use case",
      detail: "Apply the same playbook to procurement, where the manual load looks a lot like where you started.",
      tag: "Next quarter",
    },
  ],

  showRenewal: true,
  renewalKicker: "The renewal",
  renewalHeading: "Keep it going — same terms, no surprises.",
  renewalIntro:
    "Here's the renewal at a glance. Nothing changes unless you want it to, and expansion can fold in whenever you're ready.",
  termRows: [
    { label: "Plan", value: "Enterprise" },
    { label: "Seats", value: "150 included" },
    { label: "Term", value: "12 months" },
    { label: "Renewal price", value: "No increase" },
  ],
  renewalNote: "One click to confirm, or bring questions to the call — whichever you prefer.",

  showClose: true,
  closeKicker: "Next steps",
  closeHeading: "Let's talk through the year ahead.",
  closeIntro:
    "Book a time and we'll walk the renewal and the roadmap together. Bring whoever owns the relationship on your side.",
  footerNote: "Prepared for your team. Figures reflect your account data as of this review.",
};

interface Props {
  props: ValueRenewalReviewBlockProps;
  /** Tenant brand config — drives default palette, fonts, and the hero logo. */
  brand?: BrandConfig;
  /** Optional CTA click handler (analytics / builder preview) for url-mode CTAs. */
  onCtaClick?: () => void;
  /** Builder inline-edit hook. When present, key copy is click-to-edit. */
  onFieldChange?: (updated: ValueRenewalReviewBlockProps) => void;
  pageId?: number;
  variantId?: number;
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
    fontSize: "clamp(2.5rem, 5.5vw, 3.75rem)",
    letterSpacing: "-0.035em",
    lineHeight: 1.05,
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

export function BlockValueRenewalReview({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  const reduced = useReducedMotion() ?? false;

  /* — palette (brand-absorbed, contrast-guarded) — */
  const bg =
    props.bgColor && isValidHex(props.bgColor)
      ? props.bgColor
      : brand?.pageBackground && isValidHex(brand.pageBackground)
        ? brand.pageBackground
        : "#F6F2E9";
  const ink = resolveSectionInk({ textColor: props.inkColor }, { base: bg });
  const surfaceIsDark = relativeLuminance(isValidHex(bg) ? bg : "#ffffff") < 0.4;

  const cardBg =
    brand?.cardBackground && isValidHex(brand.cardBackground)
      ? brand.cardBackground
      : surfaceIsDark
        ? mixHex("#FFFFFF", bg, 0.08)
        : "#FFFFFF";
  const cardInk = resolveSectionInk({ textColor: props.inkColor }, { base: cardBg });

  const headline = pickContrastingColor(
    props.headlineColor,
    bg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#1B1840", ink.text],
    4.5,
  );
  const headlineOnCard = pickContrastingColor(
    props.headlineColor,
    cardBg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#1B1840", cardInk.text],
    4.5,
  );

  const accentRaw =
    props.accentColor && isValidHex(props.accentColor)
      ? props.accentColor
      : brand?.accentColor && isValidHex(brand.accentColor)
        ? brand.accentColor
        : "#4B47E5";
  const accentText = pickContrastingColor(accentRaw, bg, [brand?.primaryColor, headline], 4.5);
  const accentChrome = ensureAccentRegisters(accentRaw, { base: bg }, 1.6);
  const accentOnCard = pickContrastingColor(accentRaw, cardBg, [brand?.primaryColor, headlineOnCard], 4.5);

  // Established-relationship gold tint — section bands + chrome.
  const tintRaw =
    props.tintColor && isValidHex(props.tintColor) ? props.tintColor : "#C8923D";
  const tintText = pickContrastingColor(tintRaw, bg, [accentText, headline], 4.5);
  const tintChrome = ensureAccentRegisters(tintRaw, { base: bg }, 1.6);

  // Coral spark — up-trend marks only. Never a flood.
  const sparkRaw =
    props.sparkColor && isValidHex(props.sparkColor) ? props.sparkColor : "#E26B4F";
  const sparkText = pickContrastingColor(sparkRaw, bg, [accentText], 4.5);
  const sparkChrome = ensureAccentRegisters(sparkRaw, { base: bg }, 1.8);

  // Deep-indigo dark surface for the "year in numbers" chapter.
  const primaryHex =
    brand?.primaryColor && isValidHex(brand.primaryColor) ? brand.primaryColor : "#1B1840";
  const dark =
    props.darkColor && isValidHex(props.darkColor)
      ? props.darkColor
      : mixHex(primaryHex, "#12102E", 0.4);
  const darkInk = resolveSectionInk({}, { base: dark });
  const accentOnDark = pickContrastingColor(accentRaw, dark, [darkInk.text], 4.5);
  const tintOnDark = pickContrastingColor(tintRaw, dark, [accentOnDark, darkInk.text], 4.5);
  const sparkOnDark = pickContrastingColor(sparkRaw, dark, [accentOnDark, darkInk.text], 4.5);
  const headlineOnDark = pickContrastingColor(
    brand?.headingOnDarkColor,
    dark,
    [accentOnDark, darkInk.text],
    4.5,
  );

  // Warm gold-leaning tinted chapter band (expansion) — a whisper of tint.
  const bandBg = mixHex(tintChrome, bg, surfaceIsDark ? 0.12 : 0.07);
  const bandInk = resolveSectionInk({ textColor: props.inkColor }, { base: bandBg });
  const bandHeadline = pickContrastingColor(
    props.headlineColor,
    bandBg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#1B1840", bandInk.text],
    4.5,
  );

  // CTA pair colors on the dark close strip.
  const ctaBg = pickContrastingColor(
    brand?.ctaBackground,
    dark,
    [accentRaw, brand?.primaryColor, "#FFFFFF"],
    3.0,
  );
  const ctaText = pickContrastingColor(brand?.ctaText, ctaBg, [contrastTextColor(ctaBg)], 4.5);

  // Hero / renewal CTA pair colors (on the light page surface).
  const heroCtaBg = pickContrastingColor(
    brand?.ctaBackground,
    bg,
    [accentRaw, brand?.primaryColor, "#1B1840"],
    3.0,
  );
  const heroCtaText = pickContrastingColor(brand?.ctaText, heroCtaBg, [contrastTextColor(heroCtaBg)], 4.5);

  const set = onFieldChange
    ? <K extends keyof ValueRenewalReviewBlockProps>(key: K, value: ValueRenewalReviewBlockProps[K]) =>
        onFieldChange({ ...props, [key]: value })
    : undefined;
  const edit = (key: keyof ValueRenewalReviewBlockProps) =>
    set ? (v: string) => set(key, v as never) : undefined;

  /* — section numbering follows the visible order — */
  const showValue = props.showValue !== false && props.metrics.length > 0;
  const showUsage =
    props.showUsage !== false && (props.milestones.length > 0 || !!props.productImageUrl || !!onFieldChange);
  const showWins = props.showWins !== false && props.wins.length > 0;
  const showExpansion = props.showExpansion !== false && props.expansionItems.length > 0;
  const showRenewal = props.showRenewal !== false && props.termRows.length > 0;
  const showClose = props.showClose !== false;
  let sectionNo = 0;
  const nextNo = () => String(++sectionNo).padStart(2, "0");

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
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const kickerClass = "text-[11px] font-bold uppercase tracking-[0.22em]";
  const focusable =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

  /* — array field updaters (builder) — */
  const setMetric = set
    ? (i: number, patch: Partial<VrrMetric>) =>
        set("metrics", props.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    : undefined;
  const setMilestone = set
    ? (i: number, patch: Partial<VrrMilestone>) =>
        set("milestones", props.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    : undefined;
  const setWin = set
    ? (i: number, patch: Partial<VrrWin>) =>
        set("wins", props.wins.map((w, j) => (j === i ? { ...w, ...patch } : w)))
    : undefined;
  const setExpansion = set
    ? (i: number, patch: Partial<VrrExpansionItem>) =>
        set("expansionItems", props.expansionItems.map((e, j) => (j === i ? { ...e, ...patch } : e)))
    : undefined;
  const setTermRow = set
    ? (i: number, patch: Partial<VrrTermRow>) =>
        set("termRows", props.termRows.map((t, j) => (j === i ? { ...t, ...patch } : t)))
    : undefined;

  const hasLogo = props.showLogo !== false && !!brand && brandHasLogo(brand, props.logoUrl);
  const isEditor = !!onFieldChange;

  /* — shared section header (mono numbered marker + rule + kicker + h2) — */
  const SectionHead = ({
    no,
    kicker,
    kickerKey,
    heading,
    headingKey,
    tones,
  }: {
    no: string;
    kicker?: string;
    kickerKey: keyof ValueRenewalReviewBlockProps;
    heading: string;
    headingKey: keyof ValueRenewalReviewBlockProps;
    tones: { muted: string; rule: string; kicker: string; heading: string };
  }) => (
    <motion.div {...fadeUp()} className="mb-8 sm:mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color: tones.muted, fontFamily: NUMBERS }}
        >
          {no}
        </span>
        <span className="h-px flex-none w-6 self-center" style={{ background: tones.rule }} />
        <span className={kickerClass} style={{ color: tones.kicker }}>
          <InlineText as="span" value={kicker ?? ""} onUpdate={edit(kickerKey)} />
        </span>
      </div>
      <h2
        className="text-2xl sm:text-3xl lg:text-4xl tracking-tight"
        style={{ color: tones.heading, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
      >
        <InlineText as="span" value={heading} onUpdate={edit(headingKey)} multiline />
      </h2>
    </motion.div>
  );

  const lightTones = {
    muted: ink.muted,
    rule: tintChrome,
    kicker: tintText,
    heading: headline,
  };
  const bandTones = {
    muted: bandInk.muted,
    rule: tintChrome,
    kicker: pickContrastingColor(tintRaw, bandBg, [bandHeadline, bandInk.text], 4.5),
    heading: bandHeadline,
  };

  return (
    <div className="vrr-root" style={{ background: bg, color: ink.text, fontFamily: BODY }}>
      <style>{`
        .vrr-root { position: relative; }
        .vrr-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.5;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        }
        .vrr-root > * { position: relative; }
        .vrr-card {
          transition: transform 0.3s cubic-bezier(.16,1,.3,1),
                      box-shadow 0.3s cubic-bezier(.16,1,.3,1);
        }
        .vrr-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 40px -26px rgba(27, 24, 64, 0.4);
        }
        .vrr-aurora { will-change: transform; }
        .vrr-aurora-1 { animation: vrr-drift-1 30s ease-in-out infinite alternate; }
        .vrr-aurora-2 { animation: vrr-drift-2 36s ease-in-out infinite alternate; }
        @keyframes vrr-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(5%, 7%, 0) scale(1.08); }
        }
        @keyframes vrr-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.05); }
          to   { transform: translate3d(-6%, -5%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vrr-aurora { animation: none !important; }
          .vrr-card, .vrr-card:hover { transition: none; transform: none; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* ── 1. Hero ──────────────────────────────────────────────────── */}
        <header className="pt-12 sm:pt-16 lg:pt-20 pb-10 sm:pb-14">
          <motion.div {...fadeUp()}>
            <div className="flex items-center justify-between gap-4 mb-6">
              <span className={kickerClass} style={{ color: tintText }}>
                <InlineText as="span" value={props.eyebrow} onUpdate={edit("eyebrow")} />
              </span>
              {hasLogo && brand && (
                <BrandLogo
                  brand={brand}
                  url={props.logoUrl}
                  alt={props.logoAlt || brand.brandName || props.yourName || "Logo"}
                  tone={surfaceIsDark ? "onDark" : "onLight"}
                  autoContrast
                  className="h-6 w-auto shrink-0"
                />
              )}
            </div>
            {(props.accountLogoUrl || isEditor) && (
              <div className="mb-6">
                <InlineImage
                  src={props.accountLogoUrl ?? ""}
                  alt={props.accountLogoAlt || props.accountName || "Account logo"}
                  wrapperClassName="inline-block"
                  className="h-8 sm:h-9 w-auto object-contain"
                  onUpdate={edit("accountLogoUrl")}
                  onAltUpdate={edit("accountLogoAlt")}
                />
              </div>
            )}
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
            {(props.subheadline || isEditor) && (
              <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: ink.muted }}>
                <InlineText
                  as="span"
                  value={props.subheadline ?? ""}
                  onUpdate={edit("subheadline")}
                  multiline
                />
              </p>
            )}
            {(props.metaLine || isEditor) && (
              <div
                className="mt-8 pt-4 text-[11px] uppercase tracking-[0.16em]"
                style={{ borderTop: `1px solid ${ink.hairline}`, color: ink.muted }}
              >
                <InlineText as="span" value={props.metaLine ?? ""} onUpdate={edit("metaLine")} />
              </div>
            )}
            {/* Hero CTA suite */}
            <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <CtaButton
                ctaAction={props.ctaAction || "url"}
                ctaUrl={props.ctaUrl}
                chilipiperUrl={props.chilipiperUrl}
                videoUrl={props.videoUrl}
                {...pickCtaModalConfig(props)}
                onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
                brand={brand}
                pageId={pageId}
                variantId={variantId}
                source="value-renewal-hero-primary"
                className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-opacity hover:opacity-90 ${focusable}`}
                style={{ background: heroCtaBg, color: heroCtaText }}
              >
                <InlineText as="span" value={props.ctaText} onUpdate={edit("ctaText")} />
                <ArrowRight className="w-4 h-4" aria-hidden />
              </CtaButton>
              {(props.ctaSecondaryText || isEditor) && (
                <a
                  href={props.ctaSecondaryUrl || "#"}
                  className={`inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-colors hover:opacity-90 ${focusable}`}
                  style={{ border: `1px solid ${ink.hairline}`, color: ink.text }}
                >
                  <InlineText
                    as="span"
                    value={props.ctaSecondaryText ?? ""}
                    onUpdate={edit("ctaSecondaryText")}
                  />
                </a>
              )}
            </div>
          </motion.div>
        </header>
      </div>

      {/* ── 2. Value delivered — dark "year in numbers" aurora chapter ───── */}
      {showValue && (
        <section
          className="relative overflow-hidden"
          style={{ background: dark }}
          aria-label={props.valueKicker || "Value delivered"}
        >
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span
                className="vrr-aurora vrr-aurora-1 absolute rounded-full"
                style={{
                  width: "40rem",
                  height: "40rem",
                  top: "-16rem",
                  right: "-12rem",
                  background: `radial-gradient(closest-side, ${mixHex(tintRaw, dark, 0.3)} 0%, transparent 72%)`,
                  filter: "blur(24px)",
                  opacity: 0.5,
                }}
              />
              <span
                className="vrr-aurora vrr-aurora-2 absolute rounded-full"
                style={{
                  width: "34rem",
                  height: "34rem",
                  bottom: "-14rem",
                  left: "-10rem",
                  background: `radial-gradient(closest-side, ${mixHex(accentRaw, dark, 0.45)} 0%, transparent 72%)`,
                  filter: "blur(28px)",
                  opacity: 0.45,
                }}
              />
            </div>
          )}
          <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 py-14 sm:py-20">
            <motion.div {...fadeUp()} className="mb-8 sm:mb-10">
              <div className="flex items-baseline gap-3 mb-3">
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: darkInk.muted, fontFamily: NUMBERS }}
                >
                  {nextNo()}
                </span>
                <span className="h-px flex-none w-6 self-center" style={{ background: tintOnDark }} />
                <span className={kickerClass} style={{ color: tintOnDark }}>
                  <InlineText as="span" value={props.valueKicker ?? ""} onUpdate={edit("valueKicker")} />
                </span>
              </div>
              <h2
                className="text-2xl sm:text-3xl lg:text-4xl tracking-tight"
                style={{ color: headlineOnDark, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
              >
                <InlineText as="span" value={props.valueHeading} onUpdate={edit("valueHeading")} multiline />
              </h2>
              {(props.valueIntro || isEditor) && (
                <p className="mt-4 text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: darkInk.muted }}>
                  <InlineText as="span" value={props.valueIntro ?? ""} onUpdate={edit("valueIntro")} multiline />
                </p>
              )}
            </motion.div>
            <div className={`grid grid-cols-1 ${metricCols} gap-5`}>
              {metrics.map((m, i) => (
                <motion.div
                  key={i}
                  {...fadeUp(i * 0.06)}
                  className="rounded-2xl p-6 sm:p-7"
                  style={{ background: mixHex(darkInk.text, dark, 0.05), border: `1px solid ${darkInk.hairline}` }}
                >
                  <span
                    aria-hidden
                    className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: sparkOnDark }}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                  <CountUpValue
                    value={m.value}
                    color={headlineOnDark}
                    reduced={reduced}
                    durationMs={props.countUpMs ?? 1400}
                    delay={i * 0.1}
                    onUpdate={setMetric ? (v) => setMetric(i, { value: v }) : undefined}
                  />
                  <p className="mt-3 text-sm font-semibold" style={{ color: darkInk.text }}>
                    <InlineText
                      as="span"
                      value={m.label}
                      onUpdate={setMetric ? (v) => setMetric(i, { label: v }) : undefined}
                    />
                  </p>
                  {(m.source || isEditor) && (
                    <p className="mt-1 text-xs" style={{ color: darkInk.muted }}>
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
          </div>
        </section>
      )}

      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* ── 3. Usage & adoption story ────────────────────────────────── */}
        {showUsage && (
          <section
            className="py-10 sm:py-14"
            aria-label={props.usageKicker || "Usage & adoption"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.usageKicker}
              kickerKey="usageKicker"
              heading={props.usageHeading}
              headingKey="usageHeading"
              tones={lightTones}
            />
            {(props.usageIntro || isEditor) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: ink.muted }}
              >
                <InlineText as="span" value={props.usageIntro ?? ""} onUpdate={edit("usageIntro")} multiline />
              </motion.p>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
              {/* milestones */}
              {props.milestones.length > 0 && (
                <ol className="relative">
                  <span
                    aria-hidden
                    className="absolute left-[11px] top-2 bottom-2 w-px"
                    style={{ background: ink.hairline }}
                  />
                  {props.milestones.map((m, i) => (
                    <motion.li
                      key={i}
                      {...fadeUp(i * 0.05)}
                      className="relative grid grid-cols-[24px_1fr] gap-x-4 pb-7 last:pb-0"
                    >
                      <span
                        className="relative z-[1] mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-full"
                        style={{ background: tintChrome, color: contrastTextColor(isValidHex(tintChrome) ? tintChrome : "#000000") }}
                        aria-hidden
                      >
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h3
                            className="text-base font-bold tracking-tight"
                            style={{ color: headline, fontFamily: DISPLAY }}
                          >
                            <InlineText
                              as="span"
                              value={m.title}
                              onUpdate={setMilestone ? (v) => setMilestone(i, { title: v }) : undefined}
                            />
                          </h3>
                          {(m.when || isEditor) && (
                            <span className="text-xs tabular-nums" style={{ color: tintText, fontFamily: NUMBERS }}>
                              <InlineText
                                as="span"
                                value={m.when ?? ""}
                                onUpdate={setMilestone ? (v) => setMilestone(i, { when: v }) : undefined}
                              />
                            </span>
                          )}
                        </div>
                        {(m.detail || isEditor) && (
                          <p className="mt-1 text-sm leading-relaxed" style={{ color: ink.muted }}>
                            <InlineText
                              as="span"
                              value={m.detail ?? ""}
                              onUpdate={setMilestone ? (v) => setMilestone(i, { detail: v }) : undefined}
                              multiline
                            />
                          </p>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </ol>
              )}

              {/* browser-framed product UI proof */}
              {(props.productImageUrl || isEditor) && (
                <motion.div {...fadeUp(0.08)}>
                  <div
                    className="overflow-hidden rounded-2xl"
                    style={{
                      border: `1px solid ${ink.hairline}`,
                      boxShadow: "0 24px 60px -34px rgba(27, 24, 64, 0.45)",
                      background: cardBg,
                    }}
                  >
                    <div
                      className="flex items-center gap-2 px-4 py-2.5"
                      style={{ borderBottom: `1px solid ${cardInk.hairline}` }}
                    >
                      <span className="flex gap-1.5" aria-hidden>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cardInk.hairline }} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cardInk.hairline }} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cardInk.hairline }} />
                      </span>
                      <span
                        className="ml-2 flex-1 truncate rounded-md px-3 py-1 text-[11px]"
                        style={{ background: mixHex(cardInk.text, cardBg, 0.04), color: cardInk.muted, fontFamily: NUMBERS }}
                      >
                        <InlineText
                          as="span"
                          value={props.productUrlLabel ?? ""}
                          onUpdate={edit("productUrlLabel")}
                        />
                      </span>
                    </div>
                    <InlineImage
                      src={props.productImageUrl ?? ""}
                      alt={props.productImageAlt || "Product screenshot"}
                      wrapperClassName="block"
                      className="w-full h-full object-cover aspect-[16/10]"
                      onUpdate={edit("productImageUrl")}
                      onAltUpdate={edit("productImageAlt")}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── 4. Wins / proof — tinted chapter ─────────────────────────────── */}
      {showWins && (
        <section
          className="relative py-14 sm:py-20"
          style={{ background: bandBg, borderTop: `1px solid ${ink.hairline}`, borderBottom: `1px solid ${ink.hairline}` }}
          aria-label={props.winsKicker || "Wins"}
        >
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
            <SectionHead
              no={nextNo()}
              kicker={props.winsKicker}
              kickerKey="winsKicker"
              heading={props.winsHeading}
              headingKey="winsHeading"
              tones={bandTones}
            />
            <div className={`grid grid-cols-1 ${props.wins.length >= 2 ? "md:grid-cols-2" : ""} gap-5`}>
              {props.wins.map((w, i) => (
                <motion.figure
                  key={i}
                  {...fadeUp(i * 0.06)}
                  className="vrr-card rounded-2xl p-6 sm:p-8 flex flex-col"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardInk.hairline}`,
                    boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                  }}
                >
                  <span
                    aria-hidden
                    className="mb-4 block text-3xl leading-none"
                    style={{ color: tintChrome, fontFamily: DISPLAY }}
                  >
                    &ldquo;
                  </span>
                  <blockquote
                    className="text-lg sm:text-xl font-medium tracking-tight leading-snug flex-1"
                    style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                  >
                    <InlineText
                      as="span"
                      value={w.quote}
                      onUpdate={setWin ? (v) => setWin(i, { quote: v }) : undefined}
                      multiline
                    />
                  </blockquote>
                  {(w.attribution || isEditor) && (
                    <figcaption className="mt-4 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: cardInk.muted }}>
                      <InlineText
                        as="span"
                        value={w.attribution ?? ""}
                        onUpdate={setWin ? (v) => setWin(i, { attribution: v }) : undefined}
                      />
                    </figcaption>
                  )}
                </motion.figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* ── 5. What's next / expansion ───────────────────────────────── */}
        {showExpansion && (
          <section
            id="expansion"
            className="py-10 sm:py-14"
            style={{ borderTop: showWins ? "none" : `1px solid ${ink.hairline}` }}
            aria-label={props.expansionKicker || "What's next"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.expansionKicker}
              kickerKey="expansionKicker"
              heading={props.expansionHeading}
              headingKey="expansionHeading"
              tones={lightTones}
            />
            {(props.expansionIntro || isEditor) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: ink.muted }}
              >
                <InlineText as="span" value={props.expansionIntro ?? ""} onUpdate={edit("expansionIntro")} multiline />
              </motion.p>
            )}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${
                props.expansionItems.length >= 3 ? "lg:grid-cols-3" : ""
              }`}
            >
              {props.expansionItems.map((e, i) => (
                <motion.div
                  key={i}
                  {...fadeUp(i * 0.06)}
                  className="vrr-card rounded-2xl p-6 flex flex-col"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardInk.hairline}`,
                    boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                  }}
                >
                  {(e.tag || isEditor) && (
                    <span
                      className="mb-3 inline-flex self-start items-center text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
                      style={{ color: tintText, border: `1px solid ${tintChrome}` }}
                    >
                      <InlineText
                        as="span"
                        value={e.tag ?? ""}
                        onUpdate={setExpansion ? (v) => setExpansion(i, { tag: v }) : undefined}
                      />
                    </span>
                  )}
                  <h3
                    className="text-base font-bold tracking-tight"
                    style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                  >
                    <InlineText
                      as="span"
                      value={e.title}
                      onUpdate={setExpansion ? (v) => setExpansion(i, { title: v }) : undefined}
                    />
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed flex-1" style={{ color: cardInk.text }}>
                    <InlineText
                      as="span"
                      value={e.detail}
                      onUpdate={setExpansion ? (v) => setExpansion(i, { detail: v }) : undefined}
                      multiline
                    />
                  </p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── 6. The renewal ───────────────────────────────────────────── */}
        {showRenewal && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.renewalKicker || "The renewal"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.renewalKicker}
              kickerKey="renewalKicker"
              heading={props.renewalHeading}
              headingKey="renewalHeading"
              tones={lightTones}
            />
            {(props.renewalIntro || isEditor) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: ink.muted }}
              >
                <InlineText as="span" value={props.renewalIntro ?? ""} onUpdate={edit("renewalIntro")} multiline />
              </motion.p>
            )}
            <motion.div
              {...fadeUp(0.06)}
              className="rounded-2xl p-6 sm:p-8"
              style={{
                background: cardBg,
                border: `1px solid ${cardInk.hairline}`,
                boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
              }}
            >
              <dl>
                {props.termRows.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-4 py-3"
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${cardInk.hairline}` }}
                  >
                    <dt className="text-sm" style={{ color: cardInk.muted }}>
                      <InlineText
                        as="span"
                        value={t.label}
                        onUpdate={setTermRow ? (v) => setTermRow(i, { label: v }) : undefined}
                      />
                    </dt>
                    <dd
                      className="text-sm sm:text-base font-semibold tabular-nums text-right"
                      style={{ color: headlineOnCard, fontFamily: NUMBERS, fontVariantNumeric: "tabular-nums" }}
                    >
                      <InlineText
                        as="span"
                        value={t.value}
                        onUpdate={setTermRow ? (v) => setTermRow(i, { value: v }) : undefined}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
              <div
                className="mt-6 pt-6 flex flex-col sm:flex-row sm:items-center gap-4"
                style={{ borderTop: `2px solid ${cardInk.text}` }}
              >
                <CtaButton
                  ctaAction={props.ctaAction || "url"}
                  ctaUrl={props.ctaUrl}
                  chilipiperUrl={props.chilipiperUrl}
                  videoUrl={props.videoUrl}
                  {...pickCtaModalConfig(props)}
                  onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
                  brand={brand}
                  pageId={pageId}
                  variantId={variantId}
                  source="value-renewal-renew-primary"
                  className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-opacity hover:opacity-90 ${focusable}`}
                  style={{ background: heroCtaBg, color: heroCtaText }}
                >
                  {props.ctaText}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </CtaButton>
                {(props.renewalNote || isEditor) && (
                  <p className="text-xs leading-relaxed" style={{ color: cardInk.muted }}>
                    <InlineText as="span" value={props.renewalNote ?? ""} onUpdate={edit("renewalNote")} multiline />
                  </p>
                )}
              </div>
            </motion.div>
          </section>
        )}
      </div>

      {/* ── 7. Your team & next steps — dark scheduling strip ────────────── */}
      {showClose && (
        <section
          id="close"
          className="relative overflow-hidden mt-4"
          style={{ background: dark }}
          aria-label={props.closeKicker || "Next steps"}
        >
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span
                className="vrr-aurora vrr-aurora-2 absolute rounded-full"
                style={{
                  width: "32rem",
                  height: "32rem",
                  top: "-12rem",
                  left: "50%",
                  marginLeft: "-16rem",
                  background: `radial-gradient(closest-side, ${mixHex(tintRaw, dark, 0.3)} 0%, transparent 72%)`,
                  filter: "blur(24px)",
                  opacity: 0.4,
                }}
              />
            </div>
          )}
          <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 py-14 sm:py-20">
            <motion.div {...fadeUp()}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: darkInk.muted, fontFamily: NUMBERS }}
                >
                  {nextNo()}
                </span>
                <span className="h-px w-6" style={{ background: tintOnDark }} />
                <span className={kickerClass} style={{ color: tintOnDark }}>
                  <InlineText as="span" value={props.closeKicker ?? ""} onUpdate={edit("closeKicker")} />
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl tracking-tight max-w-3xl"
                style={{ color: headlineOnDark, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
              >
                <InlineText as="span" value={props.closeHeading} onUpdate={edit("closeHeading")} multiline />
              </h2>
              {(props.closeIntro || isEditor) && (
                <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: darkInk.muted }}>
                  <InlineText as="span" value={props.closeIntro ?? ""} onUpdate={edit("closeIntro")} multiline />
                </p>
              )}
              <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <CtaButton
                  ctaAction={props.ctaAction || "url"}
                  ctaUrl={props.ctaUrl}
                  chilipiperUrl={props.chilipiperUrl}
                  videoUrl={props.videoUrl}
                  {...pickCtaModalConfig(props)}
                  onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
                  brand={brand}
                  pageId={pageId}
                  variantId={variantId}
                  modalTheme="dark"
                  source="value-renewal-close-primary"
                  className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-opacity hover:opacity-90 ${focusable}`}
                  style={{ background: ctaBg, color: ctaText }}
                >
                  {props.ctaText}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </CtaButton>
                {props.ctaSecondaryText && (
                  <a
                    href={props.ctaSecondaryUrl || "#"}
                    className={`inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-colors hover:opacity-90 ${focusable}`}
                    style={{ border: `1px solid ${darkInk.hairline}`, color: darkInk.text }}
                  >
                    {props.ctaSecondaryText}
                  </a>
                )}
              </div>
              {(props.footerNote || isEditor) && (
                <p className="mt-6 text-[11px] leading-relaxed" style={{ color: darkInk.muted }}>
                  <InlineText as="span" value={props.footerNote ?? ""} onUpdate={edit("footerNote")} multiline />
                </p>
              )}
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
}

export default BlockValueRenewalReview;
