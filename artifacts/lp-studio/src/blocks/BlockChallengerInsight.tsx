import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PropsWithChildren } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, Quote } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  DEFAULT_BRAND,
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
  relativeLuminance,
} from "@/lib/brand-config";
import { mixHex, resolveSectionInk } from "@/lib/section-ink";
import {
  BRAND_BODY_STACK,
  BRAND_DISPLAY_STACK,
  BRAND_NUMBERS_STACK,
} from "@/lib/brand-fonts";

/* ----------------------------------------------------------------------------
 * Challenger Insight Brief — type "challenger-insight"
 *
 * A full-page Challenger-Sale (Teach → Tailor → Take Control) brief with a
 * bold dark-provocateur personality: layered near-black surfaces tinted with
 * the brand primary, huge confrontational display type, and the brand accent
 * used like a highlighter (marks + underlines on key phrases).
 *
 * Page rhythm:
 *   1. Insight hero (Teach) — provocative reframe headline with a
 *      highlighter-marked phrase, kicker, one-line commercial insight,
 *      restrained anchor-scroll CTA.
 *   2. The reframe — "What everyone believes" vs "What the data shows".
 *   3. Cost of status quo — up to 3 oversized count-up loss stats on a
 *      deeper vignetted band.
 *   4. Tailor — stakeholder implication cards (glass-on-dark).
 *   5. The better way — the pivot to the solution narrative (+ optional
 *      image in a glass frame). First brand-positive moment.
 *   6. Proof — 1–2 testimonials (initials fallback) + low-opacity logo row.
 *   7. Take control — 3-step plan, strong primary CTA, constructive-tension
 *      line.
 *
 * Every color is brand-derived and contrast-resolved at runtime (surfaces are
 * near-black by default but the ink/CTA/accent math survives any override).
 * Reduced motion: entrances become opacity-only and the count-up stats render
 * their final values immediately. Builder mode renders static (no observers).
 *
 * Props interface + defaults are exported from this file (registration
 * manifest) — the wiring agent re-homes them when registering.
 * -------------------------------------------------------------------------- */

export interface ChallengerCostStat {
  /** Display value with optional affixes, e.g. "$1.2M", "19 hrs", "6 wks". */
  value: string;
  /** Loss framing, e.g. "Lost per year to issues caught a month late". */
  label: string;
}

export interface ChallengerStakeholder {
  /** Audience label, e.g. "For Operations". */
  label: string;
  /** Short implication headline (3–8 words). */
  title: string;
  /** Tailored implication line (1–2 sentences). */
  body: string;
}

export interface ChallengerTestimonial {
  quote: string;
  name: string;
  title?: string;
}

export interface ChallengerLogo {
  name: string;
  imageUrl?: string;
}

export interface ChallengerPlanStep {
  title: string;
  description: string;
}

export interface ChallengerInsightBlockProps {
  /* ── 1. Insight hero (Teach) ── */
  /** Kicker above the headline, e.g. "An uncomfortable truth about ops reporting". */
  kicker?: string;
  headline: string;
  /** Exact phrase inside `headline` that gets the accent highlighter mark. */
  highlightPhrase?: string;
  /** One line that lands the commercial insight. */
  subheadline?: string;
  heroCtaText?: string;
  /** Anchor-style href; "#evidence" scrolls to the reframe section. */
  heroCtaUrl?: string;

  /* ── 2. The reframe ── */
  showReframe?: boolean;
  reframeEyebrow?: string;
  beliefLabel?: string;
  beliefStatement?: string;
  /** 1–2 supporting lines under the belief statement. */
  beliefSupport?: string[];
  realityLabel?: string;
  realityStatement?: string;
  /** 1–2 supporting lines under the data statement. */
  realitySupport?: string[];

  /* ── 3. Cost of status quo ── */
  showCost?: boolean;
  costEyebrow?: string;
  costHeading?: string;
  /** Up to 3 loss-framed stats. Fewer entries narrow the grid gracefully. */
  costStats?: ChallengerCostStat[];
  /** Small sourcing/qualifier line under the stats. Empty hides it. */
  costFootnote?: string;

  /* ── 4. Tailor ── */
  showTailor?: boolean;
  tailorEyebrow?: string;
  tailorHeading?: string;
  stakeholders?: ChallengerStakeholder[];

  /* ── 5. The better way ── */
  showBetterWay?: boolean;
  betterWayEyebrow?: string;
  betterWayHeading?: string;
  /** 2–3 short narrative paragraphs. */
  betterWayParagraphs?: string[];
  /** Optional solution image shown in a glass frame beside the narrative. */
  betterWayImageUrl?: string;
  betterWayImageAlt?: string;

  /* ── 6. Proof ── */
  showProof?: boolean;
  proofEyebrow?: string;
  proofHeading?: string;
  /** 0–2 testimonials. Empty list hides the cards (logos may still show). */
  testimonials?: ChallengerTestimonial[];
  logosLabel?: string;
  /** Low-opacity logo row. Name-only entries render as wordmarks. */
  logos?: ChallengerLogo[];

  /* ── 7. Take control ── */
  showPlan?: boolean;
  planEyebrow?: string;
  planHeading?: string;
  planSteps?: ChallengerPlanStep[];
  finalCtaText?: string;
  finalCtaUrl?: string;
  /** Constructive-tension closer, e.g. "Doing nothing is also a decision." */
  tensionLine?: string;

  /* ── Style overrides ── */
  /** Section surface override (hex). Default: near-black tinted with brand primary. */
  bgColor?: string;
  /** Accent override (hex). Default: brand accent, contrast-stepped per surface. */
  accentColor?: string;
  /** Text override (hex) — only honored when it stays legible on the surface. */
  textColor?: string;
}

export const CHALLENGER_INSIGHT_DEFAULT_PROPS: ChallengerInsightBlockProps = {
  kicker: "An uncomfortable truth about operations reporting",
  headline: "The way you track operations is costing you the quarter.",
  highlightPhrase: "costing you the quarter",
  subheadline:
    "Problems don't surface in the monthly review until they've already compounded. The teams that hit plan catch them in week one — everyone else finds out at the QBR.",
  heroCtaText: "See the evidence",
  heroCtaUrl: "#evidence",

  reframeEyebrow: "The reframe",
  beliefLabel: "What everyone believes",
  beliefStatement: "“Our monthly ops review keeps us on top of problems.”",
  beliefSupport: [
    "The review feels rigorous because every line item gets discussed.",
    "But a review is a rear-view mirror — it reports the damage, it doesn't prevent it.",
  ],
  realityLabel: "What the data shows",
  realityStatement:
    "Most operational losses are visible in the data weeks before anyone talks about them.",
  realitySupport: [
    "The signal exists on day one. The meeting happens on day thirty.",
    "The gap in between is where margin quietly leaves the business.",
  ],

  costEyebrow: "The cost of the status quo",
  costHeading: "While the report is being formatted, the loss is compounding.",
  costStats: [
    { value: "$1.2M", label: "Lost per year to issues caught a month late" },
    { value: "19 hrs", label: "Per manager, per month, assembling reports by hand" },
    { value: "6 wks", label: "Average lag between a margin leak and an intervention" },
  ],
  costFootnote: "Illustrative figures — replace with your own numbers.",

  tailorEyebrow: "Tailored to your team",
  tailorHeading: "What this means for you",
  stakeholders: [
    {
      label: "For Operations",
      title: "You're managing by anecdote",
      body: "By the time the dashboard is assembled, the floor has moved on. You deserve a live view of throughput — not a memorial to last month's.",
    },
    {
      label: "For Finance",
      title: "Your forecast is built on stale inputs",
      body: "Every aging data point widens the band on your forecast. Tightening the loop is the cheapest accuracy you will ever buy.",
    },
    {
      label: "For the Team",
      title: "Your best people are doing data entry",
      body: "Your sharpest operators spend their best hours copying numbers between systems. That's not a staffing problem — it's a tooling decision.",
    },
  ],

  betterWayEyebrow: "The better way",
  betterWayHeading: "Close the loop weekly, not quarterly.",
  betterWayParagraphs: [
    "The shift isn't a bigger dashboard or a longer meeting. It's moving the conversation from “what happened last month” to “what is happening right now” — and giving every owner the same live number.",
    "Teams that close the loop weekly don't work harder; they intervene earlier. A leak caught in week one is a line item. The same leak caught at the QBR is a narrative.",
    "That's the commercial insight: speed-to-signal, not depth-of-report, is what separates the operators who hit plan from the ones who explain why they didn't.",
  ],

  proofEyebrow: "Proof",
  proofHeading: "Teams who made the shift",
  testimonials: [
    {
      quote:
        "We found the first leak in eleven days. It had been sitting in the monthly deck for two quarters — labeled “variance.”",
      name: "Jordan Avery",
      title: "VP Operations, Meridian Freight",
    },
  ],
  logosLabel: "Trusted by operators at",
  logos: [
    { name: "Acme Corp" },
    { name: "Northwind" },
    { name: "Globex" },
    { name: "Vertex" },
  ],

  planEyebrow: "Take control",
  planHeading: "Here's what happens next",
  planSteps: [
    {
      title: "A 45-minute working session",
      description: "We map where decisions lag the data in your operation — no deck, no pitch.",
    },
    {
      title: "Your exposure, quantified",
      description: "You leave with a one-page estimate of what the reporting gap costs you today.",
    },
    {
      title: "A 30-day proof",
      description: "We instrument one workflow end-to-end and let the numbers argue for themselves.",
    },
  ],
  finalCtaText: "Book the working session",
  finalCtaUrl: "#contact",
  tensionLine: "Doing nothing is also a decision.",
};

interface Props {
  props: ChallengerInsightBlockProps;
  /** Tenant brand config — drives every surface, accent, and CTA color. */
  brand?: BrandConfig;
  /** Builder mode: render static divs (no observers / scroll animation). */
  isBuilder?: boolean;
  onCtaClick?: () => void;
}

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/** Base near-black the brand primary gets folded into. */
const NEAR_BLACK = "#08080B";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Count-up helpers (loss stats) ────────────────────────────────────────── */

interface ParsedStat {
  prefix: string;
  num: number | null;
  suffix: string;
  decimals: number;
  grouped: boolean;
}

function parseStat(raw: string): ParsedStat {
  const match = (raw ?? "").match(/^([^0-9]*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);
  if (!match) return { prefix: "", num: null, suffix: raw ?? "", decimals: 0, grouped: false };
  const numStr = match[2].replace(/,/g, "");
  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) {
    return { prefix: "", num: null, suffix: raw, decimals: 0, grouped: false };
  }
  const dot = numStr.indexOf(".");
  return {
    prefix: match[1],
    num,
    suffix: match[3],
    decimals: dot === -1 ? 0 : numStr.length - dot - 1,
    grouped: match[2].includes(","),
  };
}

function formatStat(parsed: ParsedStat, current: number): string {
  if (parsed.num === null) return parsed.suffix;
  let core: string;
  if (parsed.decimals > 0) {
    core = current.toFixed(parsed.decimals);
  } else {
    const rounded = Math.round(current);
    core = parsed.grouped ? rounded.toLocaleString("en-US") : String(rounded);
  }
  return `${parsed.prefix}${core}${parsed.suffix}`;
}

function CountUpValue({
  value,
  color,
  isStatic,
}: {
  value: string;
  color: string;
  isStatic: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const parsed = parseStat(value);
  const animatable = parsed.num !== null && !isStatic;
  const [display, setDisplay] = useState(() => (animatable ? formatStat(parsed, 0) : value));

  useEffect(() => {
    if (!animatable) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, parsed.num as number, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(formatStat(parsed, latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView, value]);

  return (
    <span
      ref={ref}
      className="block font-bold tabular-nums"
      style={{
        fontFamily: NUMBERS,
        fontSize: "clamp(3.25rem, 7vw, 5.5rem)",
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {display}
    </span>
  );
}

/* ── Scroll-reveal wrapper (static in builder, opacity-only when reduced) ─── */

const Reveal: React.FC<
  PropsWithChildren<{
    delay?: number;
    className?: string;
    isStatic?: boolean;
    reduced?: boolean;
  }>
> = ({ children, delay = 0, className, isStatic, reduced }) => {
  if (isStatic) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/** Render a headline with the highlighter mark around `phrase`, when found. */
function renderMarked(
  headline: string,
  phrase: string | undefined,
  markStyle: CSSProperties,
) {
  if (!phrase || !headline.includes(phrase)) return <>{headline}</>;
  const idx = headline.indexOf(phrase);
  return (
    <>
      {headline.slice(0, idx)}
      <mark className="chi-mark" style={markStyle}>
        {phrase}
      </mark>
      {headline.slice(idx + phrase.length)}
    </>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Slow-drifting aurora orbs for dark sections. Animation is paused under
 *  prefers-reduced-motion via the .chi-aurora CSS guard in the root style. */
const ChiAurora: React.FC<{ a: string; b: string; isStatic?: boolean }> = ({ a, b, isStatic }) => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <span
      className={`chi-aurora ${isStatic ? "" : "chi-aurora-1"} absolute rounded-full`}
      style={{
        width: "46rem",
        height: "46rem",
        top: "-20rem",
        left: "-14rem",
        background: `radial-gradient(closest-side, ${a} 0%, transparent 70%)`,
        filter: "blur(20px)",
        opacity: 0.55,
      }}
    />
    <span
      className={`chi-aurora ${isStatic ? "" : "chi-aurora-2"} absolute rounded-full`}
      style={{
        width: "40rem",
        height: "40rem",
        bottom: "-18rem",
        right: "-12rem",
        background: `radial-gradient(closest-side, ${b} 0%, transparent 70%)`,
        filter: "blur(26px)",
        opacity: 0.45,
      }}
    />
  </div>
);

export function BlockChallengerInsight({ props, brand, isBuilder, onCtaClick }: Props) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  /** Static rendering: builder (no observers) — reveals stay opacity-only
   *  under reduced motion, counters render final values immediately. */
  const isStatic = !!isBuilder;
  const countStatic = isStatic || prefersReducedMotion;
  const b = brand ?? DEFAULT_BRAND;

  /* ── Surfaces: layered near-black tinted with the brand primary ────────── */
  const primary = isValidHex(b.primaryColor) ? b.primaryColor : DEFAULT_BRAND.primaryColor;
  const rawAccent =
    props.accentColor && isValidHex(props.accentColor)
      ? props.accentColor
      : isValidHex(b.accentColor)
        ? b.accentColor
        : DEFAULT_BRAND.accentColor;

  const surface =
    props.bgColor && isValidHex(props.bgColor)
      ? props.bgColor
      : mixHex(primary, NEAR_BLACK, 0.16);
  /** Deeper band for the agitation + finale sections. */
  const surfaceDeep = mixHex("#000000", surface, 0.4);
  const isDark = relativeLuminance(surface) < 0.4;

  /* ── Inks: AA-guaranteed text tones per surface ─────────────────────────── */
  const ink = resolveSectionInk({ textColor: props.textColor }, { base: surface });
  const inkDeep = resolveSectionInk({ textColor: props.textColor }, { base: surfaceDeep });

  /* ── Accent treatments, contrast-stepped per use ────────────────────────── */
  // Large display accents (3.0 = AA large text); lift toward white on dark.
  const accentLift = mixHex("#FFFFFF", rawAccent, isDark ? 0.45 : 0);
  const accentDisplay = pickContrastingColor(rawAccent, surface, [accentLift, ink.text], 3.0);
  const accentDisplayDeep = pickContrastingColor(
    rawAccent,
    surfaceDeep,
    [accentLift, inkDeep.text],
    3.0,
  );
  // Small labels / kickers (full AA 4.5).
  const accentLabel = pickContrastingColor(rawAccent, surface, [accentLift, ink.muted], 4.5);
  const accentLabelDeep = pickContrastingColor(
    rawAccent,
    surfaceDeep,
    [accentLift, inkDeep.muted],
    4.5,
  );
  // Highlighter mark: the accent as a paint swatch behind display type. It
  // only needs to *register* against the surface (1.8); the text painted on
  // top is then resolved against the swatch itself.
  const markBg = pickContrastingColor(rawAccent, surface, [accentLift, ink.text], 1.8);
  const markText = pickContrastingColor(contrastTextColor(markBg), markBg, [], 4.5);
  // Underline highlighter for the "data side" statement.
  const underlineCss = `linear-gradient(${accentDisplay}, ${accentDisplay})`;

  /* ── CTAs: runtime-resolved against the exact surface they sit on ───────── */
  const heroCta = pickCtaButtonColors(b, surface);
  const finalCta = pickCtaButtonColors(b, surfaceDeep);

  /* ── Glass + hairline chrome (flips with surface darkness) ──────────────── */
  const glassBg = isDark ? "rgba(255,255,255,0.045)" : "rgba(10,10,14,0.045)";
  const glassBgHover = isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,14,0.08)";
  const glassBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(10,10,14,0.12)";

  /* ── Resolved content ───────────────────────────────────────────────────── */
  const D = CHALLENGER_INSIGHT_DEFAULT_PROPS;
  const kicker = props.kicker ?? D.kicker;
  const headline = props.headline || (D.headline as string);
  const highlightPhrase = props.highlightPhrase ?? D.highlightPhrase;
  const subheadline = props.subheadline ?? D.subheadline;
  const heroCtaText = props.heroCtaText ?? D.heroCtaText;
  const heroCtaUrl = props.heroCtaUrl || D.heroCtaUrl || "#evidence";

  const costStats = (props.costStats ?? D.costStats ?? []).slice(0, 3);
  const stakeholders = (props.stakeholders ?? D.stakeholders ?? []).slice(0, 3);
  const paragraphs = (props.betterWayParagraphs ?? D.betterWayParagraphs ?? []).slice(0, 3);
  const testimonials = (props.testimonials ?? D.testimonials ?? []).slice(0, 2);
  const logos = (props.logos ?? D.logos ?? []).slice(0, 6);
  const planSteps = (props.planSteps ?? D.planSteps ?? []).slice(0, 3);

  const showReframe = props.showReframe !== false;
  const showCost = props.showCost !== false && costStats.length > 0;
  const showTailor = props.showTailor !== false && stakeholders.length > 0;
  const showBetterWay = props.showBetterWay !== false;
  const showProof = props.showProof !== false && (testimonials.length > 0 || logos.length > 0);
  const showPlan = props.showPlan !== false;

  /* ── Anchor-scroll handler (honors reduced motion) ──────────────────────── */
  const handleAnchor = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href.length < 2) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const eyebrow = (text: string | undefined, index: string, deep = false) =>
    text ? (
      <div
        className="flex items-center gap-3 mb-6 text-[11px] font-semibold uppercase tracking-[0.3em]"
        style={{ color: deep ? accentLabelDeep : accentLabel, fontFamily: BODY }}
      >
        <span className="tabular-nums">{index}</span>
        <span aria-hidden className="h-px w-8" style={{ background: deep ? accentLabelDeep : accentLabel }} />
        <span>{text}</span>
      </div>
    ) : null;

  return (
    <div
      className="chi-root antialiased"
      style={
        {
          background: surface,
          color: ink.text,
          fontFamily: BODY,
          "--chi-focus": accentLabel,
        } as CSSProperties
      }
    >
      <style>{`
        .chi-root a:focus-visible, .chi-root button:focus-visible {
          outline: 2px solid var(--chi-focus);
          outline-offset: 3px;
        }
        .chi-mark {
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
          padding: 0.02em 0.14em;
          margin: 0 -0.02em;
        }
        .chi-underline {
          background-repeat: no-repeat;
          background-size: 100% 0.14em;
          background-position: 0 94%;
          padding-bottom: 0.06em;
        }
        .chi-aurora { will-change: transform; }
        .chi-aurora-1 { animation: chi-drift-1 28s ease-in-out infinite alternate; }
        .chi-aurora-2 { animation: chi-drift-2 34s ease-in-out infinite alternate; }
        @keyframes chi-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(6%, 8%, 0) scale(1.1); }
        }
        @keyframes chi-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.06); }
          to   { transform: translate3d(-7%, -6%, 0) scale(1); }
        }
        .chi-card {
          transition: transform 0.3s cubic-bezier(.16,1,.3,1),
                      background 0.3s ease, box-shadow 0.3s ease;
        }
        .chi-card:hover { transform: translateY(-1px); }
        .chi-bar { transform-origin: left center; }
        @media (prefers-reduced-motion: reduce) {
          .chi-aurora { animation: none !important; }
          .chi-card, .chi-card:hover { transition: none; transform: none; }
        }
      `}</style>

      {/* ── 1. INSIGHT HERO (Teach) ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Faint top accent glow + corner vignette — keeps the surface layered, not flat. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(80% 55% at 18% -10%, ${mixHex(rawAccent, surface, 0.14)} 0%, transparent 60%), radial-gradient(120% 80% at 50% 120%, rgba(0,0,0,0.5) 0%, transparent 55%)`,
          }}
        />
        <ChiAurora
          isStatic={countStatic}
          a={mixHex(rawAccent, surface, 0.28)}
          b={mixHex(primary, surface, 0.4)}
        />
        <div className="relative mx-auto flex min-h-[88vh] w-full max-w-6xl flex-col justify-center px-6 py-24 md:py-32 lg:px-10">
          <Reveal isStatic={isStatic} reduced={prefersReducedMotion}>
            {kicker && (
              <p
                className="mb-8 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: accentLabel, fontFamily: BODY }}
              >
                <span aria-hidden className="h-px w-10" style={{ background: accentLabel }} />
                {kicker}
              </p>
            )}
            <h1
              className="max-w-5xl font-bold"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(2.5rem, 6.6vw, 5.25rem)",
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
                color: ink.text,
              }}
            >
              {renderMarked(headline, highlightPhrase, {
                background: markBg,
                color: markText,
              })}
            </h1>
            {subheadline && (
              <p
                className="mt-8 max-w-2xl text-lg leading-relaxed md:text-xl"
                style={{ color: ink.muted, fontFamily: BODY }}
              >
                {subheadline}
              </p>
            )}
            {heroCtaText && (
              <div className="mt-12">
                <a
                  href={heroCtaUrl}
                  onClick={(e) => handleAnchor(e, heroCtaUrl)}
                  className="group inline-flex min-h-[48px] items-center gap-2.5 border px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] transition-colors"
                  style={{
                    borderColor: glassBorder,
                    color: ink.text,
                    background: "transparent",
                    fontFamily: BODY,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = glassBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {heroCtaText}
                  <ArrowDown
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5"
                    aria-hidden
                  />
                </a>
              </div>
            )}
          </Reveal>
        </div>
        <div aria-hidden className="h-px w-full" style={{ background: ink.hairline }} />
      </section>

      {/* ── 2. THE REFRAME ──────────────────────────────────────────────── */}
      {showReframe && (
        <section id="evidence" className="relative scroll-mt-8">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28 lg:px-10">
            <Reveal isStatic={isStatic} reduced={prefersReducedMotion}>
              {eyebrow(props.reframeEyebrow ?? D.reframeEyebrow, "01")}
            </Reveal>
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-10 lg:gap-16">
              {/* Belief column — deliberately muted. */}
              <Reveal isStatic={isStatic} reduced={prefersReducedMotion}>
                <p
                  className="mb-5 text-[11px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: ink.muted, fontFamily: BODY }}
                >
                  {props.beliefLabel ?? D.beliefLabel}
                </p>
                <h2
                  className="font-bold"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(1.6rem, 3.2vw, 2.5rem)",
                    lineHeight: 1.16,
                    letterSpacing: "-0.015em",
                    color: ink.muted,
                  }}
                >
                  {props.beliefStatement ?? D.beliefStatement}
                </h2>
                <div className="mt-7 space-y-4 border-l pl-5" style={{ borderColor: ink.hairline }}>
                  {(props.beliefSupport ?? D.beliefSupport ?? []).slice(0, 2).map((line, i) => (
                    <p key={i} className="text-base leading-relaxed" style={{ color: ink.muted }}>
                      {line}
                    </p>
                  ))}
                </div>
              </Reveal>
              {/* Data column — the accent treatment lives here. */}
              <Reveal isStatic={isStatic} reduced={prefersReducedMotion} delay={0.12}>
                <p
                  className="mb-5 text-[11px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: accentLabel, fontFamily: BODY }}
                >
                  {props.realityLabel ?? D.realityLabel}
                </p>
                <h2
                  className="font-bold"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(1.6rem, 3.2vw, 2.5rem)",
                    lineHeight: 1.16,
                    letterSpacing: "-0.015em",
                    color: ink.text,
                  }}
                >
                  <span className="chi-underline" style={{ backgroundImage: underlineCss }}>
                    {props.realityStatement ?? D.realityStatement}
                  </span>
                </h2>
                <div
                  className="mt-7 space-y-4 border-l-2 pl-5"
                  style={{ borderColor: accentDisplay }}
                >
                  {(props.realitySupport ?? D.realitySupport ?? []).slice(0, 2).map((line, i) => (
                    <p key={i} className="text-base leading-relaxed" style={{ color: ink.text }}>
                      {line}
                    </p>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. COST OF STATUS QUO — agitation band ──────────────────────── */}
      {showCost && (
        <section className="relative overflow-hidden" style={{ background: surfaceDeep }}>
          {/* Vignette — edges fall away into black. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(110% 95% at 50% 40%, transparent 42%, rgba(0,0,0,0.5) 100%)",
            }}
          />
          <ChiAurora
            isStatic={countStatic}
            a={mixHex(rawAccent, surfaceDeep, 0.22)}
            b={mixHex(primary, surfaceDeep, 0.32)}
          />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:py-28 lg:px-10">
            <Reveal isStatic={isStatic} reduced={prefersReducedMotion}>
              {eyebrow(props.costEyebrow ?? D.costEyebrow, "02", true)}
              <h2
                className="max-w-3xl font-bold"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(1.9rem, 4vw, 3.25rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: inkDeep.text,
                }}
              >
                {props.costHeading ?? D.costHeading}
              </h2>
            </Reveal>
            <div
              className={`mt-14 grid grid-cols-1 gap-y-12 gap-x-10 ${
                costStats.length >= 3
                  ? "sm:grid-cols-3"
                  : costStats.length === 2
                    ? "sm:grid-cols-2"
                    : ""
              }`}
            >
              {costStats.map((stat, i) => (
                <Reveal
                  key={i}
                  isStatic={isStatic}
                  reduced={prefersReducedMotion}
                  delay={i * 0.1}
                >
                  <span
                    aria-hidden
                    className="mb-6 block h-[3px] w-10"
                    style={{ background: accentDisplayDeep }}
                  />
                  <CountUpValue
                    value={stat.value}
                    color={accentDisplayDeep}
                    isStatic={countStatic}
                  />
                  {(() => {
                    // Teaching data-viz: a proportional bar that sizes each loss
                    // against the largest in the set, so the magnitudes read at a
                    // glance. Bars only appear when ≥2 stats parse to a number.
                    const nums = costStats.map((s) => parseStat(s.value).num);
                    const valid = nums.filter((n): n is number => n !== null);
                    const max = valid.length ? Math.max(...valid) : 0;
                    const n = parseStat(stat.value).num;
                    if (valid.length < 2 || n === null || max <= 0) return null;
                    const pct = Math.max(8, Math.round((n / max) * 100));
                    return (
                      <div
                        className="mt-5 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: inkDeep.hairline }}
                        aria-hidden
                      >
                        <motion.span
                          className="chi-bar block h-full rounded-full"
                          style={{ width: `${pct}%`, background: accentDisplayDeep }}
                          initial={countStatic ? false : { scaleX: 0 }}
                          whileInView={countStatic ? undefined : { scaleX: 1 }}
                          viewport={{ once: true, margin: "-60px" }}
                          transition={{ duration: 1.1, delay: i * 0.1 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    );
                  })()}
                  <p
                    className="mt-4 max-w-[26ch] text-sm font-medium leading-snug tracking-wide sm:text-base"
                    style={{ color: inkDeep.muted, fontFamily: BODY }}
                  >
                    {stat.label}
                  </p>
                </Reveal>
              ))}
            </div>
            {(props.costFootnote ?? D.costFootnote) && (
              <p
                className="mt-12 border-t pt-5 text-xs leading-relaxed"
                style={{ color: inkDeep.muted, borderColor: inkDeep.hairline, fontFamily: BODY }}
              >
                {props.costFootnote ?? D.costFootnote}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── 4. TAILOR — stakeholder implications ────────────────────────── */}
      {showTailor && (
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28 lg:px-10">
            <Reveal isStatic={isStatic} reduced={prefersReducedMotion}>
              {eyebrow(props.tailorEyebrow ?? D.tailorEyebrow, "03")}
              <h2
                className="max-w-2xl font-bold"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(1.9rem, 4vw, 3.25rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: ink.text,
                }}
              >
                {props.tailorHeading ?? D.tailorHeading}
              </h2>
            </Reveal>
            <div
              className={`mt-12 grid grid-cols-1 gap-5 ${
                stakeholders.length >= 3
                  ? "md:grid-cols-3"
                  : stakeholders.length === 2
                    ? "md:grid-cols-2"
                    : ""
              }`}
            >
              {stakeholders.map((card, i) => (
                <Reveal
                  key={i}
                  isStatic={isStatic}
                  reduced={prefersReducedMotion}
                  delay={i * 0.1}
                  className="h-full"
                >
                  <div
                    className="chi-card group flex h-full flex-col rounded-xl border p-7 backdrop-blur-md"
                    style={{ background: glassBg, borderColor: glassBorder }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = glassBgHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = glassBg)}
                  >
                    <p
                      className="mb-4 text-[11px] font-semibold uppercase tracking-[0.26em]"
                      style={{ color: accentLabel, fontFamily: BODY }}
                    >
                      {card.label}
                    </p>
                    <h3
                      className="mb-3 text-xl font-bold leading-snug"
                      style={{ fontFamily: DISPLAY, letterSpacing: "-0.01em", color: ink.text }}
                    >
                      {card.title}
                    </h3>
                    <p className="text-sm leading-relaxed sm:text-base" style={{ color: ink.muted }}>
                      {card.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 5. THE BETTER WAY — the pivot ───────────────────────────────── */}
      {showBetterWay && (
        <section className="relative">
          <div aria-hidden className="h-px w-full" style={{ background: ink.hairline }} />
          <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28 lg:px-10">
            <div
              className={`grid grid-cols-1 gap-12 ${
                props.betterWayImageUrl ? "lg:grid-cols-12 lg:gap-16" : ""
              }`}
            >
              <Reveal
                isStatic={isStatic}
                reduced={prefersReducedMotion}
                className={props.betterWayImageUrl ? "lg:col-span-7" : "max-w-3xl"}
              >
                {eyebrow(props.betterWayEyebrow ?? D.betterWayEyebrow, "04")}
                <h2
                  className="font-bold"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(1.9rem, 4vw, 3.25rem)",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: ink.text,
                  }}
                >
                  <span className="chi-underline" style={{ backgroundImage: underlineCss }}>
                    {props.betterWayHeading ?? D.betterWayHeading}
                  </span>
                </h2>
                <div className="mt-8 space-y-5">
                  {paragraphs.map((para, i) => (
                    <p
                      key={i}
                      className="text-base leading-relaxed md:text-lg"
                      style={{ color: i === 0 ? ink.text : ink.muted }}
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </Reveal>
              {props.betterWayImageUrl && (
                <Reveal
                  isStatic={isStatic}
                  reduced={prefersReducedMotion}
                  delay={0.12}
                  className="lg:col-span-5"
                >
                  <div
                    className="overflow-hidden rounded-2xl border p-2 backdrop-blur-md"
                    style={{
                      background: glassBg,
                      borderColor: glassBorder,
                      boxShadow: `0 32px 64px -28px rgba(0,0,0,0.6), 0 0 48px -16px ${mixHex(rawAccent, surface, 0.35)}`,
                    }}
                  >
                    <img
                      src={props.betterWayImageUrl}
                      alt={props.betterWayImageAlt || ""}
                      className="h-auto w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  </div>
                </Reveal>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. PROOF ────────────────────────────────────────────────────── */}
      {showProof && (
        <section>
          <div aria-hidden className="h-px w-full" style={{ background: ink.hairline }} />
          <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28 lg:px-10">
            <Reveal isStatic={isStatic} reduced={prefersReducedMotion}>
              {eyebrow(props.proofEyebrow ?? D.proofEyebrow, "05")}
              {(props.proofHeading ?? D.proofHeading) && (
                <h2
                  className="max-w-2xl font-bold"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(1.7rem, 3.4vw, 2.75rem)",
                    lineHeight: 1.12,
                    letterSpacing: "-0.02em",
                    color: ink.text,
                  }}
                >
                  {props.proofHeading ?? D.proofHeading}
                </h2>
              )}
            </Reveal>
            {testimonials.length > 0 && (
              <div
                className={`mt-12 grid grid-cols-1 gap-5 ${
                  testimonials.length === 2 ? "md:grid-cols-2" : ""
                }`}
              >
                {testimonials.map((t, i) => (
                  <Reveal
                    key={i}
                    isStatic={isStatic}
                    reduced={prefersReducedMotion}
                    delay={i * 0.1}
                    className="h-full"
                  >
                    <figure
                      className="chi-card flex h-full flex-col rounded-xl border p-8 backdrop-blur-md"
                      style={{ background: glassBg, borderColor: glassBorder }}
                    >
                      <Quote aria-hidden className="mb-5 h-7 w-7" style={{ color: accentDisplay }} />
                      <blockquote
                        className="text-lg leading-relaxed md:text-xl"
                        style={{ fontFamily: DISPLAY, color: ink.text }}
                      >
                        &ldquo;{t.quote}&rdquo;
                      </blockquote>
                      <figcaption className="mt-7 flex items-center gap-3.5">
                        <span
                          aria-hidden
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                          style={{
                            background: mixHex(rawAccent, surface, 0.22),
                            color: accentLabel,
                            border: `1px solid ${glassBorder}`,
                            fontFamily: BODY,
                          }}
                        >
                          {initialsOf(t.name)}
                        </span>
                        <span>
                          <span
                            className="block text-sm font-semibold"
                            style={{ color: ink.text, fontFamily: BODY }}
                          >
                            {t.name}
                          </span>
                          {t.title && (
                            <span className="block text-xs" style={{ color: ink.muted }}>
                              {t.title}
                            </span>
                          )}
                        </span>
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            )}
            {logos.length > 0 && (
              <Reveal
                isStatic={isStatic}
                reduced={prefersReducedMotion}
                delay={0.15}
                className="mt-14"
              >
                {(props.logosLabel ?? D.logosLabel) && (
                  <p
                    className="mb-6 text-[11px] font-semibold uppercase tracking-[0.26em]"
                    style={{ color: ink.muted, fontFamily: BODY }}
                  >
                    {props.logosLabel ?? D.logosLabel}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
                  {logos.map((logo, i) =>
                    logo.imageUrl ? (
                      <img
                        key={i}
                        src={logo.imageUrl}
                        alt={logo.name}
                        className={`h-6 w-auto opacity-40 grayscale ${isDark ? "brightness-0 invert" : ""}`}
                        loading="lazy"
                      />
                    ) : (
                      <span
                        key={i}
                        className="text-sm font-semibold tracking-wide"
                        style={{ color: ink.text, opacity: 0.42, fontFamily: DISPLAY }}
                      >
                        {logo.name}
                      </span>
                    ),
                  )}
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ── 7. TAKE CONTROL — assertive finale ──────────────────────────── */}
      {showPlan && (
        <section className="relative overflow-hidden" style={{ background: surfaceDeep }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(70% 60% at 50% 115%, ${mixHex(rawAccent, surfaceDeep, 0.16)} 0%, transparent 60%)`,
            }}
          />
          <ChiAurora
            isStatic={countStatic}
            a={mixHex(rawAccent, surfaceDeep, 0.2)}
            b={mixHex(primary, surfaceDeep, 0.3)}
          />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:py-28 lg:px-10">
            <Reveal isStatic={isStatic} reduced={prefersReducedMotion}>
              {eyebrow(props.planEyebrow ?? D.planEyebrow, "06", true)}
              <h2
                className="max-w-2xl font-bold"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(2rem, 4.4vw, 3.5rem)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.02em",
                  color: inkDeep.text,
                }}
              >
                {props.planHeading ?? D.planHeading}
              </h2>
            </Reveal>
            {planSteps.length > 0 && (
              <ol
                className={`mt-12 grid list-none grid-cols-1 gap-10 p-0 ${
                  planSteps.length >= 3
                    ? "md:grid-cols-3"
                    : planSteps.length === 2
                      ? "md:grid-cols-2"
                      : ""
                }`}
              >
                {planSteps.map((step, i) => (
                  <Reveal
                    key={i}
                    isStatic={isStatic}
                    reduced={prefersReducedMotion}
                    delay={i * 0.1}
                  >
                    <li className="border-t pt-6" style={{ borderColor: inkDeep.hairline }}>
                      <span
                        className="block text-sm font-bold tabular-nums"
                        style={{ color: accentLabelDeep, fontFamily: NUMBERS }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3
                        className="mt-3 text-lg font-bold leading-snug"
                        style={{ fontFamily: DISPLAY, color: inkDeep.text }}
                      >
                        {step.title}
                      </h3>
                      <p
                        className="mt-2.5 text-sm leading-relaxed sm:text-base"
                        style={{ color: inkDeep.muted }}
                      >
                        {step.description}
                      </p>
                    </li>
                  </Reveal>
                ))}
              </ol>
            )}
            <Reveal
              isStatic={isStatic}
              reduced={prefersReducedMotion}
              delay={0.2}
              className="mt-16 flex flex-col items-start gap-6"
            >
              <a
                href={props.finalCtaUrl || D.finalCtaUrl || "#"}
                onClick={(e) => {
                  const href = props.finalCtaUrl || D.finalCtaUrl || "#";
                  if (href.startsWith("#") && href.length > 1) {
                    handleAnchor(e, href);
                    return;
                  }
                  if (onCtaClick && (!href || href === "#")) {
                    e.preventDefault();
                    onCtaClick();
                  }
                }}
                className="group inline-flex min-h-[52px] items-center gap-2.5 px-9 py-4 text-sm font-bold uppercase tracking-[0.14em] transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: finalCta.bg,
                  color: finalCta.text,
                  fontFamily: BODY,
                  boxShadow: `0 0 32px ${mixHex(finalCta.bg, surfaceDeep, 0.4)}`,
                }}
              >
                {props.finalCtaText ?? D.finalCtaText}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </a>
              {(props.tensionLine ?? D.tensionLine) && (
                <p
                  className="text-sm italic"
                  style={{ color: inkDeep.muted, fontFamily: DISPLAY }}
                >
                  {props.tensionLine ?? D.tensionLine}
                </p>
              )}
            </Reveal>
          </div>
        </section>
      )}
    </div>
  );
}

export default BlockChallengerInsight;
