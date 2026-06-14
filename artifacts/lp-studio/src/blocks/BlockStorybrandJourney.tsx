import React, { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowDown,
  Check,
  Download,
  Quote,
  X as XIcon,
} from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import {
  resolveSectionInk,
  ensureAccentRegisters,
  mixHex,
} from "@/lib/section-ink";
import { IconOrImage } from "@/lib/icon-value";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";
import {
  DarkHeroBackdrop,
  MicrositeNavbar,
  resolveHeroLayout,
  type HeroLayout,
  type MicrositeNavLink,
} from "./microsite-chrome";

/* ----------------------------------------------------------------------------
 * StoryBrand Journey — type "storybrand-journey"
 *
 * A full-page landing template that walks Donald Miller's SB7 BrandScript as
 * sections, with a WARM EDITORIAL LIGHT personality (cream surfaces, big
 * serif-feeling display type, generous whitespace, soft accent tints) —
 * deliberately distinct from the dark business-case monographs:
 *
 *   1. HERO ("A Character")      — what the CUSTOMER wants, direct CTA +
 *                                  transitional CTA (free asset), optional image.
 *   2. PROBLEM (three levels)    — External / Internal / Philosophical triptych
 *                                  on a subtle warm-tinted band.
 *   3. STAKES ("avoid failure")  — short emphatic deep-tint strip, 2–3 costs.
 *   4. GUIDE (empathy+authority) — large empathy quote, then logos / stat chips /
 *                                  testimonials (REAL quotes only — graceful
 *                                  empty state when none are provided).
 *   5. PLAN (3 steps)            — numbered path with a connecting line,
 *                                  optional post-purchase second row.
 *   6. SUCCESS                   — from → to transformation list + imagery,
 *                                  warm gradient lift.
 *   7. FINALE                    — repeated direct + transitional CTA + recap.
 *
 * All colors are brand-derived with per-prop overrides; every text run is
 * inline-editable in the builder via InlineText/InlineImage; scroll reveals
 * are disabled in the builder and under prefers-reduced-motion. h1 lives only
 * in the hero — every other section heads with h2.
 * -------------------------------------------------------------------------- */

const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;
/** The warm-editorial serif stack used when displayFontMode = "serif"
 *  (the template default — it IS the personality). "brand" swaps in the
 *  tenant display font for brands whose type system must win. */
const SERIF_STACK =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const hexOr = (v: string | undefined | null, fallback: string): string =>
  v && HEX_RE.test(v.trim()) ? v.trim() : fallback;

export interface StorybrandProblemCard {
  /** Lucide icon name (e.g. "ClipboardList") or an image URL. */
  icon?: string;
  /** Small uppercase level label, e.g. "External". */
  label: string;
  title: string;
  body: string;
}

export interface StorybrandStatChip {
  value: string;
  label: string;
}

export interface StorybrandLogo {
  url: string;
  alt?: string;
}

export interface StorybrandTestimonial {
  quote: string;
  name: string;
  title?: string;
  avatarUrl?: string;
}

export interface StorybrandPlanStep {
  title: string;
  body: string;
}

export interface StorybrandSuccessItem {
  /** The "before" state, e.g. "Scattered email threads". */
  from: string;
  /** The "after" state, e.g. "One shared launch plan". */
  to: string;
}

export interface StorybrandJourneyBlockProps {
  /* ── palette & type ─────────────────────────────────────────────────── */
  /** Page surface. Defaults to warm cream — the template's identity — rather
   *  than the (usually white) brand page background. */
  bgColor?: string;
  /** Body text override (validated for AA; ignored when unreadable). */
  textColor?: string;
  /** Display headline override on light surfaces. */
  headlineColor?: string;
  /** Accent for CTAs, kickers, icon chips. Defaults to the brand accent. */
  accentColor?: string;
  /** Text on the accent-filled primary CTA. */
  accentInkColor?: string;
  /** Deep emphatic surface used by Stakes + Finale. Brand-primary-derived. */
  deepColor?: string;
  /** "serif" (default — warm editorial) or "brand" (tenant display font). */
  displayFontMode?: "serif" | "brand";

  /* ── navbar + hero treatment (design-system chrome) ───────────────────── */
  /** Hero layout. "split" frames the hero image beside the headline on a deep
   *  brand band; "image-overlay" full-bleeds the image with a scrim; "dark"
   *  runs the headline on a deep band. Defaults to "split" (or "dark" when no
   *  hero image). The hero opens on a deep brand surface — never plain white. */
  heroLayout?: HeroLayout;
  /** Show the slim top navbar over the hero. Default true. */
  showNavbar?: boolean;
  /** 0–4 navbar anchor links (scroll to page sections). */
  navLinks?: MicrositeNavLink[];
  /** Navbar CTA label. Defaults to the hero primary CTA. */
  navCtaText?: string;
  /** Navbar CTA href. Defaults to the hero primary CTA url. */
  navCtaUrl?: string;
  /** Tenant-logo override URL for the navbar lockup; falls back to brand logo. */
  logoUrl?: string;
  logoAlt?: string;

  /* ── 1. hero ────────────────────────────────────────────────────────── */
  kicker?: string;
  heroHeadline?: string;
  heroSubhead?: string;
  heroPrimaryCtaText?: string;
  heroPrimaryCtaUrl?: string;
  heroTransitionalCtaText?: string;
  heroTransitionalCtaUrl?: string;
  /** Tiny caption under the CTA row describing the free asset,
   *  e.g. "Free PDF — 9 pages, no email required." */
  heroTransitionalAssetLabel?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** CSS object-position focal point, e.g. "50% 30%". */
  heroImageFocal?: string;

  /* ── 2. problem (three levels) ──────────────────────────────────────── */
  showProblem?: boolean;
  problemKicker?: string;
  problemHeading?: string;
  problemIntro?: string;
  problemCards?: StorybrandProblemCard[];
  /** Optional framed image beside the problem intro (warm, human — the friction
   *  the customer feels). Empty = the intro renders full-width as before. */
  problemImageUrl?: string;
  problemImageAlt?: string;
  problemImageFocal?: string;

  /* ── 3. stakes ──────────────────────────────────────────────────────── */
  showStakes?: boolean;
  stakesKicker?: string;
  stakesHeading?: string;
  stakesItems?: string[];
  stakesFootnote?: string;

  /* ── 4. guide ───────────────────────────────────────────────────────── */
  showGuide?: boolean;
  guideKicker?: string;
  /** Large quote-like empathy statement ("We get it…"). */
  guideEmpathy?: string;
  guideAuthorityHeading?: string;
  /** Customer logos (tenant-supplied assets — never AI-filled). */
  guideLogos?: StorybrandLogo[];
  guideStats?: StorybrandStatChip[];
  /** REAL quotes only. Empty array = graceful empty state (empathy + creds
   *  render without invented quotes). */
  guideTestimonials?: StorybrandTestimonial[];
  /** Optional portrait of the guide (warm, human) shown beside the empathy
   *  statement as framed proof. Empty = empathy renders full-width as before. */
  guideImageUrl?: string;
  guideImageAlt?: string;
  guideImageFocal?: string;

  /* ── 5. plan ────────────────────────────────────────────────────────── */
  showPlan?: boolean;
  planKicker?: string;
  planHeading?: string;
  planSubhead?: string;
  planSteps?: StorybrandPlanStep[];
  /** Toggle the post-purchase second row ("after you buy" steps). */
  showPostPurchase?: boolean;
  postPurchaseLabel?: string;
  postPurchaseSteps?: StorybrandPlanStep[];

  /* ── 6. success ─────────────────────────────────────────────────────── */
  showSuccess?: boolean;
  successKicker?: string;
  successHeading?: string;
  successBody?: string;
  successItems?: StorybrandSuccessItem[];
  successImageUrl?: string;
  successImageAlt?: string;
  successImageFocal?: string;

  /* ── 7. finale ──────────────────────────────────────────────────────── */
  showFinale?: boolean;
  finaleKicker?: string;
  finaleHeading?: string;
  /** One-line recap of the promise. */
  finaleRecap?: string;
  finalePrimaryCtaText?: string;
  finalePrimaryCtaUrl?: string;
  finaleTransitionalCtaText?: string;
  finaleTransitionalCtaUrl?: string;
  finaleTransitionalAssetLabel?: string;
}

/** Neutral B2B defaults — a coherent fictional client-onboarding story for a
 *  generic services/SaaS narrative. Testimonials and logos default EMPTY on
 *  purpose: quotes must be real, logos are tenant assets. */
export const STORYBRAND_JOURNEY_DEFAULT_PROPS: StorybrandJourneyBlockProps = {
  displayFontMode: "serif",

  heroLayout: "split",
  showNavbar: true,
  navLinks: [
    { label: "The problem", href: "#problem" },
    { label: "The plan", href: "#plan" },
    { label: "Get started", href: "#finale" },
  ],
  navCtaText: "Book a 20-minute call",
  navCtaUrl: "#finale",

  kicker: "For teams that run on client work",
  heroHeadline: "Every client launch, smooth from day one.",
  heroSubhead:
    "One simple system for onboarding new clients — so every project starts on time, every time.",
  heroPrimaryCtaText: "Book a 20-minute call",
  heroPrimaryCtaUrl: "#",
  heroTransitionalCtaText: "Get the onboarding checklist",
  heroTransitionalCtaUrl: "#",
  heroTransitionalAssetLabel: "Free guide · 9 pages · no email required",
  heroImageUrl:
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1100&h=1300&fit=crop",
  heroImageAlt: "A small team working together around a sunlit table",

  showProblem: true,
  problemKicker: "Sound familiar?",
  problemHeading: "Starting a new client shouldn't feel like starting over.",
  problemIntro:
    "You won the work. Then the first two weeks disappear into chasing details that should already be in one place.",
  problemCards: [
    {
      icon: "ClipboardList",
      label: "The external problem",
      title: "Onboarding lives in ten places",
      body: "Kickoff details are scattered across email threads, spreadsheets, and someone's memory.",
    },
    {
      icon: "HeartCrack",
      label: "The internal problem",
      title: "You look less buttoned-up than you are",
      body: "Every dropped handoff chips away at the confidence your team worked so hard to earn.",
    },
    {
      icon: "Scale",
      label: "The philosophical problem",
      title: "The first week should match the pitch",
      body: "Teams that do great work shouldn't lose trust in the gap between contract and kickoff.",
    },
  ],
  problemImageUrl:
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1100&h=900&fit=crop",
  problemImageAlt: "A team mid-scramble surrounded by scattered notes",

  showStakes: true,
  stakesKicker: "The cost of waiting",
  stakesHeading: "What another messy quarter costs you",
  stakesItems: [
    "Hours of senior time spent chasing status instead of serving clients",
    "Revenue that slips every time a project starts two weeks late",
    "Referrals that never happen because the first impression wobbled",
  ],
  stakesFootnote: "None of it shows up on an invoice. All of it shows up in the year.",

  showGuide: true,
  guideKicker: "Your guide",
  guideEmpathy:
    "We've sat in the Monday meeting where nobody could say when the project actually starts. You shouldn't need heroics to begin work you've already won.",
  guideAuthorityHeading: "Why teams trust us",
  guideLogos: [],
  guideImageUrl:
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=900&h=1100&fit=crop",
  guideImageAlt: "A friendly advisor smiling in a sunlit office",
  guideStats: [
    { value: "9 yrs", label: "Helping services teams launch" },
    { value: "400+", label: "Onboarding playbooks installed" },
    { value: "98%", label: "Of customers stay year over year" },
  ],
  guideTestimonials: [],

  showPlan: true,
  planKicker: "The plan",
  planHeading: "Three steps to a calmer quarter",
  planSubhead: "No rip-and-replace. We start with how your team already works.",
  planSteps: [
    {
      title: "Map your onboarding",
      body: "We chart how a client moves from signed to started today — every step, owner, and gap.",
    },
    {
      title: "Install your playbook",
      body: "Your steps, owners, and timelines live in one shared system your whole team can see.",
    },
    {
      title: "Launch with confidence",
      body: "Every new client follows the same smooth path — automatically, without the chase.",
    },
  ],
  showPostPurchase: false,
  postPurchaseLabel: "And after you're up and running",
  postPurchaseSteps: [
    {
      title: "Quarterly tune-ups",
      body: "We review the data together and tighten the playbook where launches still drag.",
    },
    {
      title: "A team that runs it",
      body: "Training and templates so the system outlives any single hire.",
    },
  ],

  showSuccess: true,
  successKicker: "Where this goes",
  successHeading: "Imagine the next kickoff",
  successBody:
    "The week a contract is signed, everyone — your team and theirs — already knows what happens next.",
  successItems: [
    { from: "Scattered email threads", to: "One shared launch plan" },
    { from: "“When do we start?”", to: "A date everyone trusts" },
    { from: "Heroic catch-up weeks", to: "Calm, on-time delivery" },
  ],
  successImageUrl:
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1200&h=900&fit=crop",
  successImageAlt: "Two colleagues reviewing a plan and smiling",

  showFinale: true,
  finaleKicker: "The next step",
  finaleHeading: "Be the team clients brag about.",
  finaleRecap:
    "One simple system for onboarding — fewer fires, faster starts, happier clients.",
  finalePrimaryCtaText: "Book a 20-minute call",
  finalePrimaryCtaUrl: "#",
  finaleTransitionalCtaText: "Get the onboarding checklist",
  finaleTransitionalCtaUrl: "#",
  finaleTransitionalAssetLabel: "Free guide · 9 pages · no email required",
};

interface Props {
  props: StorybrandJourneyBlockProps;
  /** Tenant brand config — colors absorb from it via props.X ?? brand.Y ?? fallback. */
  brand?: BrandConfig;
  /** True inside the LP Studio builder: scroll reveals are skipped so live
   *  editing stays snappy (no IntersectionObserver churn per keystroke). */
  isBuilder?: boolean;
  /** Inline-editing sink — when present, every text/image becomes editable. */
  onFieldChange?: (updated: StorybrandJourneyBlockProps) => void;
}

/** Scroll-reveal wrapper. Plain <div> in the builder and under
 *  prefers-reduced-motion; otherwise a once-only fade/lift. */
const Reveal: React.FC<
  React.PropsWithChildren<{ delay?: number; className?: string; disabled?: boolean }>
> = ({ children, delay = 0, className, disabled }) => {
  if (disabled) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ── Count-up numeral for guide stat chips. Parses a leading number with an
 *  optional prefix/suffix (e.g. "98%", "400+", "9 yrs") and animates it into
 *  view. Static under reduced motion / builder, where it renders final text. */
function parseSbjStat(raw: string): { prefix: string; num: number | null; suffix: string; decimals: number } {
  const m = (raw ?? "").match(/^([^0-9]*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);
  if (!m) return { prefix: "", num: null, suffix: raw ?? "", decimals: 0 };
  const numStr = m[2].replace(/,/g, "");
  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) return { prefix: "", num: null, suffix: raw ?? "", decimals: 0 };
  const dot = numStr.indexOf(".");
  return { prefix: m[1], num, suffix: m[3], decimals: dot === -1 ? 0 : numStr.length - dot - 1 };
}

const CountUpStat: React.FC<{ value: string; still: boolean }> = ({ value, still }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const parsed = parseSbjStat(value);
  const animatable = parsed.num !== null && !still;
  const [display, setDisplay] = useState(() =>
    animatable ? `${parsed.prefix}${(0).toFixed(parsed.decimals)}${parsed.suffix}` : value,
  );
  useEffect(() => {
    if (!animatable) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, parsed.num as number, {
      duration: 1.3,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) =>
        setDisplay(`${parsed.prefix}${latest.toFixed(parsed.decimals)}${parsed.suffix}`),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView, value]);
  return <span ref={ref}>{display}</span>;
};

/** Slow-drifting aurora orbs for the deep sections. Pauses under reduced
 *  motion (handled by the .sbj-aurora CSS guard in the root style block). */
const SbjAurora: React.FC<{ a: string; b: string }> = ({ a, b }) => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <span
      className="sbj-aurora sbj-aurora-1 absolute rounded-full"
      style={{
        width: "44rem",
        height: "44rem",
        top: "-18rem",
        left: "-12rem",
        background: `radial-gradient(closest-side, ${a} 0%, transparent 72%)`,
        filter: "blur(18px)",
        opacity: 0.5,
      }}
    />
    <span
      className="sbj-aurora sbj-aurora-2 absolute rounded-full"
      style={{
        width: "38rem",
        height: "38rem",
        bottom: "-16rem",
        right: "-10rem",
        background: `radial-gradient(closest-side, ${b} 0%, transparent 72%)`,
        filter: "blur(22px)",
        opacity: 0.42,
      }}
    />
  </div>
);

const D = STORYBRAND_JOURNEY_DEFAULT_PROPS;

export function BlockStorybrandJourney({ props, brand, isBuilder, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const still = !!isBuilder || reduced;

  /* ── palette: per-block prop > tenant brand > warm-editorial fallback ── */
  // Cream is the template's identity, so it does NOT absorb the (usually
  // white) brand page background — only an explicit bgColor prop changes it.
  const bg = hexOr(props.bgColor, "#FAF6EF");
  const ink = resolveSectionInk({ textColor: props.textColor }, { base: bg });
  const primary = hexOr(brand?.primaryColor, "#3B2A1F");
  const accentRaw = hexOr(props.accentColor, hexOr(brand?.accentColor, "#B4552D"));
  // Tint-grade accent (icon chips, washes) — deepened only if it vanishes.
  const accent = ensureAccentRegisters(accentRaw, { base: bg }, 1.6);
  // Text-grade accent (kickers, links) — must read at AA on the cream page.
  const kickerInk = pickContrastingColor(accentRaw, bg, [primary, ink.text], 4.5);
  const headline = pickContrastingColor(
    props.headlineColor ?? brand?.headingOnLightColor,
    bg,
    [primary, ink.text],
    4.5,
  );

  // Primary CTA pill on the light page: brand CTA color when it contrasts,
  // else accent, else primary, else black/white.
  const ctaBg = pickContrastingColor(
    props.accentColor ?? brand?.ctaBackground,
    bg,
    [brand?.accentColor, brand?.primaryColor, "#B4552D"],
    3.0,
  );
  const ctaInk = pickContrastingColor(props.accentInkColor ?? brand?.ctaText, ctaBg, [], 4.5);

  // Deep emphatic surface (Stakes + Finale). Brand primary when it is already
  // deep enough; light primaries are sunk toward a warm near-black so the
  // strip stays "deep tint", never a pastel.
  const deep = hexOr(
    props.deepColor,
    relativeLuminance(primary) < 0.18 ? primary : mixHex(primary, "#221511", 0.3),
  );
  const deepInk = resolveSectionInk({}, { base: deep });
  const headlineOnDeep = pickContrastingColor(brand?.headingOnDarkColor, deep, [deepInk.text], 4.5);
  const accentOnDeep = pickContrastingColor(accentRaw, deep, [bg, deepInk.text], 4.5);
  const ctaBgDeep = pickContrastingColor(
    props.accentColor ?? brand?.ctaBackground,
    deep,
    [brand?.accentColor, bg],
    3.0,
  );
  const ctaInkDeep = pickContrastingColor(props.accentInkColor ?? brand?.ctaText, ctaBgDeep, [], 4.5);

  // Warm-tinted band behind the problem triptych (a whisper of accent).
  const problemBg = mixHex(accent, bg, 0.07);
  const problemInk = resolveSectionInk({ textColor: props.textColor }, { base: problemBg });
  // Success gradient lift end-stop; ink resolved at its deepest point.
  const successEnd = mixHex(accent, bg, 0.14);
  const successInk = resolveSectionInk({ textColor: props.textColor }, { base: successEnd });

  const display =
    (props.displayFontMode ?? D.displayFontMode) === "brand" ? BRAND_DISPLAY_STACK : SERIF_STACK;

  /* ── editing plumbing ─────────────────────────────────────────────────── */
  const field = (key: keyof StorybrandJourneyBlockProps) =>
    onFieldChange
      ? (v: string) =>
          onFieldChange({ ...props, [key]: v } as StorybrandJourneyBlockProps)
      : undefined;

  const problemCards = props.problemCards ?? D.problemCards!;
  const stakesItems = props.stakesItems ?? D.stakesItems!;
  const guideLogos = props.guideLogos ?? [];
  const guideStats = props.guideStats ?? D.guideStats!;
  const guideTestimonials = props.guideTestimonials ?? [];
  const planSteps = props.planSteps ?? D.planSteps!;
  const postPurchaseSteps = props.postPurchaseSteps ?? D.postPurchaseSteps!;
  const successItems = props.successItems ?? D.successItems!;

  const patchList =
    <T,>(key: keyof StorybrandJourneyBlockProps, list: T[]) =>
    (i: number, patch: Partial<T>) =>
      onFieldChange?.({
        ...props,
        [key]: list.map((item, idx) => (idx === i ? { ...item, ...patch } : item)),
      } as StorybrandJourneyBlockProps);
  const patchProblem = patchList("problemCards", problemCards);
  const patchStat = patchList("guideStats", guideStats);
  const patchTestimonial = patchList("guideTestimonials", guideTestimonials);
  const patchPlan = patchList("planSteps", planSteps);
  const patchPost = patchList("postPurchaseSteps", postPurchaseSteps);
  const patchSuccess = patchList("successItems", successItems);
  const setStakesItem = onFieldChange
    ? (i: number, v: string) =>
        onFieldChange({
          ...props,
          stakesItems: stakesItems.map((s, idx) => (idx === i ? v : s)),
        })
    : undefined;

  /* ── shared sub-renders ───────────────────────────────────────────────── */
  const kickerEl = (
    value: string | undefined,
    onUpdate: ((v: string) => void) | undefined,
    color: string,
    no?: string,
  ) =>
    (value || onUpdate) && (
      <p
        className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] mb-5"
        style={{ color, fontFamily: BODY }}
      >
        {no && (
          <span aria-hidden className="tabular-nums" style={{ fontFamily: NUMBERS, opacity: 0.85 }}>
            {no}
          </span>
        )}
        <span aria-hidden className="inline-block w-8 h-px" style={{ background: color }} />
        <InlineText as="span" value={value ?? ""} onUpdate={onUpdate} />
      </p>
    );

  const ctaRow = (
    cfg: {
      primaryText?: string;
      primaryUrl?: string;
      ghostText?: string;
      ghostUrl?: string;
      assetLabel?: string;
      onPrimaryText?: (v: string) => void;
      onGhostText?: (v: string) => void;
      onAssetLabel?: (v: string) => void;
    },
    surface: "light" | "deep",
    align: "start" | "center" = "start",
  ) => {
    const pillBg = surface === "deep" ? ctaBgDeep : ctaBg;
    const pillInk = surface === "deep" ? ctaInkDeep : ctaInk;
    const ghostInk = surface === "deep" ? deepInk.text : ink.text;
    const ghostBorder = surface === "deep" ? deepInk.hairline : ink.hairline;
    const captionInk = surface === "deep" ? deepInk.muted : ink.muted;
    return (
      <div className={cn("flex flex-col gap-3", align === "center" && "items-center")}>
        <div
          className={cn(
            "flex flex-col sm:flex-row flex-wrap gap-3",
            align === "center" ? "items-center justify-center" : "items-start",
          )}
        >
          {(cfg.primaryText || cfg.onPrimaryText) && (
            <a
              href={cfg.primaryUrl || "#"}
              className="sbj-cta group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: pillBg, color: pillInk, fontFamily: BODY }}
            >
              <InlineText as="span" value={cfg.primaryText ?? ""} onUpdate={cfg.onPrimaryText} />
              <ArrowRight
                aria-hidden
                className={cn(
                  "w-4 h-4 shrink-0",
                  !still && "transition-transform duration-300 group-hover:translate-x-1",
                )}
              />
            </a>
          )}
          {(cfg.ghostText || cfg.onGhostText) && (
            <a
              href={cfg.ghostUrl || "#"}
              className="sbj-cta inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-sm font-semibold transition-colors duration-300 hover:opacity-80"
              style={{
                borderColor: ghostBorder,
                color: ghostInk,
                fontFamily: BODY,
              }}
            >
              <Download aria-hidden className="w-4 h-4 shrink-0" />
              <InlineText as="span" value={cfg.ghostText ?? ""} onUpdate={cfg.onGhostText} />
            </a>
          )}
        </div>
        {(cfg.assetLabel || cfg.onAssetLabel) && (
          <p
            className={cn("text-xs", align === "center" && "text-center")}
            style={{ color: captionInk, fontFamily: BODY }}
          >
            <InlineText as="span" value={cfg.assetLabel ?? ""} onUpdate={cfg.onAssetLabel} />
          </p>
        )}
      </div>
    );
  };

  const hasHeroImage = !!props.heroImageUrl || !!onFieldChange;

  /* ── navbar + hero chrome (design-system) ─────────────────────────────── */
  const showNavbar = props.showNavbar !== false;
  const heroLayout = resolveHeroLayout(props.heroLayout, hasHeroImage, "split");
  const navLinks = props.navLinks ?? D.navLinks ?? [];
  const navCtaText = props.navCtaText ?? props.heroPrimaryCtaText ?? D.heroPrimaryCtaText;
  const navCtaUrl = props.navCtaUrl || props.heroPrimaryCtaUrl || D.heroPrimaryCtaUrl || "#finale";
  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href.length < 2) return;
    const target = typeof document !== "undefined" ? document.getElementById(href.slice(1)) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <div
      className="sbj-root antialiased"
      style={
        {
          background: bg,
          color: ink.text,
          fontFamily: BODY,
          "--sbj-focus-light": kickerInk,
          "--sbj-focus-deep": accentOnDeep,
        } as React.CSSProperties
      }
    >
      {/* Focus-visible rings: accent-derived per surface, never invisible.
          Paper grain on cream, aurora drift on deep sections, card hover lift —
          all reduced-motion guarded. */}
      <style>{`
        .sbj-root a:focus-visible,
        .sbj-root button:focus-visible {
          outline: 2px solid var(--sbj-focus-light);
          outline-offset: 3px;
        }
        .sbj-deep a:focus-visible,
        .sbj-deep button:focus-visible {
          outline-color: var(--sbj-focus-deep);
        }
        .sbj-root::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.5;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E");
        }
        .sbj-root > section { position: relative; z-index: 1; }
        .sbj-card {
          transition: transform 0.3s cubic-bezier(.16,1,.3,1),
                      box-shadow 0.3s cubic-bezier(.16,1,.3,1),
                      filter 0.3s ease;
        }
        .sbj-card:hover {
          transform: translateY(-1px);
          filter: brightness(1.02);
          box-shadow: 0 22px 48px -26px rgba(60, 42, 24, 0.4);
        }
        .sbj-aurora { will-change: transform; }
        .sbj-aurora-1 { animation: sbj-drift-1 26s ease-in-out infinite alternate; }
        .sbj-aurora-2 { animation: sbj-drift-2 32s ease-in-out infinite alternate; }
        @keyframes sbj-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(5%, 7%, 0) scale(1.08); }
        }
        @keyframes sbj-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.05); }
          to   { transform: translate3d(-6%, -5%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sbj-root .sbj-cta,
          .sbj-root .sbj-cta:hover,
          .sbj-root .sbj-card,
          .sbj-root .sbj-card:hover {
            transition: none;
            transform: none;
          }
          .sbj-aurora { animation: none !important; }
        }
      `}</style>

      {/* ── 1. HERO — "A Character" on a deep brand band, with navbar ────── */}
      <section
        className="sbj-deep relative overflow-hidden"
        style={{ background: deep, color: deepInk.text }}
      >
        <DarkHeroBackdrop
          surface={deep}
          accent={accentRaw}
          primary={primary}
          isStatic={still}
          idPrefix="sbj-hero"
        >
          {heroLayout === "image-overlay" && props.heroImageUrl && (
            <>
              <img
                src={props.heroImageUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
                loading="eager"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `linear-gradient(105deg, ${deep} 38%, ${mixHex(deep, "#000000", 0.7)}cc 100%)`,
                }}
              />
            </>
          )}
        </DarkHeroBackdrop>

        {showNavbar && (
          <MicrositeNavbar
            brand={brand}
            logoUrl={props.logoUrl}
            logoAlt={props.logoAlt}
            links={navLinks}
            ctaText={navCtaText}
            ctaUrl={navCtaUrl}
            ctaBg={ctaBgDeep}
            ctaText_color={ctaInkDeep}
            heroSurface={deep}
            isDark
            ink={deepInk.text}
            inkMuted={deepInk.muted}
            accent={accentOnDeep}
            onAnchor={handleAnchor}
          />
        )}

        <div
          className={cn(
            "relative z-10 max-w-6xl mx-auto grid grid-cols-1 items-center gap-12 px-6 pb-20 pt-10 md:pb-28 md:pt-14 lg:gap-16 lg:px-12",
            heroLayout === "split" && hasHeroImage ? "lg:grid-cols-12" : "lg:grid-cols-1",
          )}
        >
          <div
            className={cn(
              heroLayout === "split" && hasHeroImage ? "lg:col-span-7" : "max-w-3xl",
            )}
          >
            {kickerEl(props.kicker ?? D.kicker, field("kicker"), accentOnDeep)}
            <h1
              className="text-[2.6rem] leading-[1.06] md:text-6xl xl:text-[4.25rem] font-medium tracking-tight mb-6"
              style={{ fontFamily: display, color: headlineOnDeep }}
            >
              <InlineText
                as="span"
                value={props.heroHeadline ?? D.heroHeadline!}
                onUpdate={field("heroHeadline")}
                multiline
              />
            </h1>
            <p
              className="text-lg md:text-xl leading-relaxed max-w-xl mb-10"
              style={{ color: deepInk.muted, fontFamily: BODY }}
            >
              <InlineText
                as="span"
                value={props.heroSubhead ?? D.heroSubhead!}
                onUpdate={field("heroSubhead")}
                multiline
              />
            </p>
            {ctaRow(
              {
                primaryText: props.heroPrimaryCtaText ?? D.heroPrimaryCtaText,
                primaryUrl: props.heroPrimaryCtaUrl ?? D.heroPrimaryCtaUrl,
                ghostText: props.heroTransitionalCtaText ?? D.heroTransitionalCtaText,
                ghostUrl: props.heroTransitionalCtaUrl ?? D.heroTransitionalCtaUrl,
                assetLabel: props.heroTransitionalAssetLabel ?? D.heroTransitionalAssetLabel,
                onPrimaryText: field("heroPrimaryCtaText"),
                onGhostText: field("heroTransitionalCtaText"),
                onAssetLabel: field("heroTransitionalAssetLabel"),
              },
              "deep",
              "start",
            )}
          </div>

          {heroLayout === "split" && hasHeroImage && (
            <Reveal disabled={still} className="lg:col-span-5">
              <div
                className="relative overflow-hidden rounded-3xl border aspect-[4/5] max-h-[560px] w-full backdrop-blur-md"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  boxShadow: `0 36px 72px -30px rgba(0,0,0,0.7), 0 0 56px -16px ${mixHex(accentRaw, deep, 0.4)}`,
                  background: "rgba(255,255,255,0.045)",
                }}
              >
                <InlineImage
                  src={props.heroImageUrl ?? ""}
                  alt={props.heroImageAlt ?? ""}
                  className="absolute inset-0 w-full h-full object-cover"
                  wrapperClassName="absolute inset-0"
                  loading="eager"
                  onUpdate={field("heroImageUrl")}
                  onAltUpdate={field("heroImageAlt")}
                  focalPoint={props.heroImageFocal}
                  onFocalUpdate={field("heroImageFocal")}
                />
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── 2. PROBLEM — three levels on a warm-tinted band ──────────────── */}
      {props.showProblem !== false && (
        <section id="problem" className="scroll-mt-8 px-6 lg:px-12 py-20 md:py-28" style={{ background: problemBg }}>
          <div className="max-w-6xl mx-auto">
            {(() => {
              const hasProblemImage = !!props.problemImageUrl || !!onFieldChange;
              const introBlock = (
                <>
                  {kickerEl(props.problemKicker ?? D.problemKicker, field("problemKicker"), kickerInk, "01")}
                  <h2
                    className="text-3xl md:text-[2.6rem] leading-[1.12] font-medium tracking-tight mb-5"
                    style={{ fontFamily: display, color: headline }}
                  >
                    <InlineText
                      as="span"
                      value={props.problemHeading ?? D.problemHeading!}
                      onUpdate={field("problemHeading")}
                      multiline
                    />
                  </h2>
                  {(props.problemIntro || onFieldChange) && (
                    <p
                      className="text-base md:text-lg leading-relaxed"
                      style={{ color: problemInk.muted, fontFamily: BODY }}
                    >
                      <InlineText
                        as="span"
                        value={props.problemIntro ?? ""}
                        onUpdate={field("problemIntro")}
                        multiline
                      />
                    </p>
                  )}
                </>
              );
              return hasProblemImage ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center mb-14">
                  <Reveal disabled={still} className="lg:col-span-7">
                    {introBlock}
                  </Reveal>
                  <Reveal disabled={still} delay={0.1} className="lg:col-span-5">
                    <div
                      className="relative overflow-hidden rounded-3xl border aspect-[4/3] w-full"
                      style={{
                        borderColor: ink.hairline,
                        boxShadow: "0 24px 60px -28px rgba(60, 42, 24, 0.35)",
                        background: mixHex(accent, bg, 0.1),
                      }}
                    >
                      <InlineImage
                        src={props.problemImageUrl ?? ""}
                        alt={props.problemImageAlt ?? ""}
                        className="absolute inset-0 w-full h-full object-cover"
                        wrapperClassName="absolute inset-0"
                        loading="lazy"
                        onUpdate={field("problemImageUrl")}
                        onAltUpdate={field("problemImageAlt")}
                        focalPoint={props.problemImageFocal}
                        onFocalUpdate={field("problemImageFocal")}
                      />
                    </div>
                  </Reveal>
                </div>
              ) : (
                <Reveal disabled={still} className="max-w-2xl mb-14">
                  {introBlock}
                </Reveal>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7">
              {problemCards.map((card, i) => (
                <Reveal key={i} disabled={still} delay={Math.min(i * 0.1, 0.3)}>
                  <article
                    className="sbj-card h-full rounded-2xl border bg-white p-7 md:p-8"
                    style={{
                      borderColor: ink.hairline,
                      boxShadow: "0 14px 36px -24px rgba(60, 42, 24, 0.28)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="block mb-5 text-xs font-semibold tabular-nums"
                      style={{ color: kickerInk, fontFamily: NUMBERS }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                      style={{
                        background: `color-mix(in srgb, ${accent} 13%, transparent)`,
                        color: kickerInk,
                      }}
                      aria-hidden="true"
                    >
                      <IconOrImage value={card.icon} fallback={Quote} className="w-5 h-5" />
                    </div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.24em] mb-3"
                      style={{ color: kickerInk, fontFamily: BODY }}
                    >
                      <InlineText
                        as="span"
                        value={card.label}
                        onUpdate={onFieldChange ? (v) => patchProblem(i, { label: v }) : undefined}
                      />
                    </p>
                    <h3
                      className="text-xl md:text-[1.35rem] leading-snug font-medium mb-3"
                      style={{ fontFamily: display, color: headline }}
                    >
                      <InlineText
                        as="span"
                        value={card.title}
                        onUpdate={onFieldChange ? (v) => patchProblem(i, { title: v }) : undefined}
                        multiline
                      />
                    </h3>
                    <p
                      className="text-sm md:text-[0.95rem] leading-relaxed"
                      style={{ color: problemInk.muted, fontFamily: BODY }}
                    >
                      <InlineText
                        as="span"
                        value={card.body}
                        onUpdate={onFieldChange ? (v) => patchProblem(i, { body: v }) : undefined}
                        multiline
                      />
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. STAKES — the cost of doing nothing, deep-tint strip ───────── */}
      {props.showStakes !== false && (
        <section
          className="sbj-deep relative overflow-hidden px-6 lg:px-12 py-16 md:py-20"
          style={{ background: deep }}
        >
          {!still && (
            <SbjAurora
              a={`color-mix(in srgb, ${accentOnDeep} 30%, transparent)`}
              b={`color-mix(in srgb, ${bg} 22%, transparent)`}
            />
          )}
          <div className="relative max-w-6xl mx-auto">
            <Reveal disabled={still}>
              <div className="md:flex md:items-end md:justify-between md:gap-12 mb-10">
                <div className="max-w-xl">
                  {kickerEl(
                    props.stakesKicker ?? D.stakesKicker,
                    field("stakesKicker"),
                    accentOnDeep,
                    "02",
                  )}
                  <h2
                    className="text-3xl md:text-4xl leading-[1.12] font-medium tracking-tight"
                    style={{ fontFamily: display, color: headlineOnDeep }}
                  >
                    <InlineText
                      as="span"
                      value={props.stakesHeading ?? D.stakesHeading!}
                      onUpdate={field("stakesHeading")}
                      multiline
                    />
                  </h2>
                </div>
                {(props.stakesFootnote || onFieldChange) && (
                  <p
                    className="mt-5 md:mt-0 max-w-xs text-sm italic leading-relaxed"
                    style={{ color: deepInk.muted, fontFamily: display }}
                  >
                    <InlineText
                      as="span"
                      value={props.stakesFootnote ?? ""}
                      onUpdate={field("stakesFootnote")}
                      multiline
                    />
                  </p>
                )}
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7 list-none m-0 p-0">
                {stakesItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 border-t pt-5"
                    style={{ borderColor: deepInk.hairline }}
                  >
                    <XIcon
                      aria-hidden
                      className="w-4 h-4 mt-1 shrink-0"
                      style={{ color: accentOnDeep }}
                    />
                    <p
                      className="text-base leading-relaxed"
                      style={{ color: deepInk.muted, fontFamily: BODY }}
                    >
                      <InlineText
                        as="span"
                        value={item}
                        onUpdate={setStakesItem ? (v) => setStakesItem(i, v) : undefined}
                        multiline
                      />
                    </p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 4. GUIDE — empathy then authority ────────────────────────────── */}
      {props.showGuide !== false && (
        <section className="px-6 lg:px-12 py-20 md:py-28">
          <div className="max-w-6xl mx-auto">
            {(() => {
              const hasGuideImage = !!props.guideImageUrl || !!onFieldChange;
              const empathyBlock = (
                <>
                  {kickerEl(props.guideKicker ?? D.guideKicker, field("guideKicker"), kickerInk, "03")}
                  <blockquote className="relative m-0">
                    <Quote
                      aria-hidden
                      className="absolute -top-4 -left-2 w-10 h-10 md:w-12 md:h-12"
                      style={{ color: `color-mix(in srgb, ${accent} 30%, transparent)` }}
                    />
                    <p
                      className="relative text-2xl md:text-[2.1rem] leading-[1.3] font-medium italic pl-8 md:pl-10"
                      style={{ fontFamily: display, color: headline }}
                    >
                      <InlineText
                        as="span"
                        value={props.guideEmpathy ?? D.guideEmpathy!}
                        onUpdate={field("guideEmpathy")}
                        multiline
                      />
                    </p>
                  </blockquote>
                </>
              );
              return hasGuideImage ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center mb-14 md:mb-16">
                  <Reveal disabled={still} className="lg:col-span-7">
                    {empathyBlock}
                  </Reveal>
                  <Reveal disabled={still} delay={0.1} className="lg:col-span-5">
                    <div
                      className="relative overflow-hidden rounded-3xl border aspect-[4/5] max-h-[460px] w-full"
                      style={{
                        borderColor: ink.hairline,
                        boxShadow: "0 24px 60px -28px rgba(60, 42, 24, 0.35)",
                        background: mixHex(accent, bg, 0.1),
                      }}
                    >
                      <InlineImage
                        src={props.guideImageUrl ?? ""}
                        alt={props.guideImageAlt ?? ""}
                        className="absolute inset-0 w-full h-full object-cover saturate-[0.92]"
                        wrapperClassName="absolute inset-0"
                        loading="lazy"
                        onUpdate={field("guideImageUrl")}
                        onAltUpdate={field("guideImageAlt")}
                        focalPoint={props.guideImageFocal}
                        onFocalUpdate={field("guideImageFocal")}
                      />
                    </div>
                  </Reveal>
                </div>
              ) : (
                <Reveal disabled={still} className="max-w-3xl mb-14 md:mb-16">
                  {empathyBlock}
                </Reveal>
              );
            })()}

            <Reveal disabled={still} delay={0.08}>
              <div className="border-t pt-10" style={{ borderColor: ink.hairline }}>
                {(props.guideAuthorityHeading || onFieldChange) && (
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.28em] mb-8"
                    style={{ color: ink.muted, fontFamily: BODY }}
                  >
                    <InlineText
                      as="span"
                      value={props.guideAuthorityHeading ?? ""}
                      onUpdate={field("guideAuthorityHeading")}
                    />
                  </p>
                )}

                {guideLogos.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-x-8 gap-y-4 mb-10 rounded-2xl border bg-white/60 px-6 py-4"
                    style={{ borderColor: ink.hairline }}
                  >
                    {guideLogos.map((logo, i) =>
                      logo.url ? (
                        <img
                          key={i}
                          src={logo.url}
                          alt={logo.alt ?? ""}
                          className="h-7 w-auto max-w-[140px] object-contain opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                          loading="lazy"
                        />
                      ) : null,
                    )}
                  </div>
                )}

                {guideStats.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-10">
                    {guideStats.map((s, i) => (
                      <div
                        key={i}
                        className="inline-flex items-baseline gap-2.5 rounded-full border bg-white px-5 py-2.5"
                        style={{ borderColor: ink.hairline }}
                      >
                        <span
                          className="text-lg font-semibold tabular-nums leading-none"
                          style={{ fontFamily: NUMBERS, color: kickerInk }}
                        >
                          {onFieldChange ? (
                            <InlineText
                              as="span"
                              value={s.value}
                              onUpdate={(v) => patchStat(i, { value: v })}
                            />
                          ) : (
                            <CountUpStat value={s.value} still={still} />
                          )}
                        </span>
                        <span
                          className="text-xs leading-none"
                          style={{ color: ink.muted, fontFamily: BODY }}
                        >
                          <InlineText
                            as="span"
                            value={s.label}
                            onUpdate={onFieldChange ? (v) => patchStat(i, { label: v }) : undefined}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* REAL quotes only — when none are provided the section ends
                    gracefully on the credibility row above. */}
                {guideTestimonials.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-7">
                    {guideTestimonials.slice(0, 2).map((t, i) => (
                      <figure
                        key={i}
                        className="sbj-card m-0 rounded-2xl border bg-white p-7 md:p-8"
                        style={{
                          borderColor: ink.hairline,
                          boxShadow: "0 14px 36px -24px rgba(60, 42, 24, 0.28)",
                        }}
                      >
                        <blockquote
                          className="m-0 text-lg leading-relaxed italic mb-6"
                          style={{ fontFamily: display, color: headline }}
                        >
                          &ldquo;
                          <InlineText
                            as="span"
                            value={t.quote}
                            onUpdate={
                              onFieldChange ? (v) => patchTestimonial(i, { quote: v }) : undefined
                            }
                            multiline
                          />
                          &rdquo;
                        </blockquote>
                        <figcaption className="flex items-center gap-3">
                          {t.avatarUrl ? (
                            <img
                              src={t.avatarUrl}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold"
                              style={{
                                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                                color: kickerInk,
                                fontFamily: BODY,
                              }}
                            >
                              {initialsOf(t.name)}
                            </span>
                          )}
                          <span className="flex flex-col">
                            <span
                              className="text-sm font-semibold"
                              style={{ color: ink.text, fontFamily: BODY }}
                            >
                              <InlineText
                                as="span"
                                value={t.name}
                                onUpdate={
                                  onFieldChange ? (v) => patchTestimonial(i, { name: v }) : undefined
                                }
                              />
                            </span>
                            {(t.title || onFieldChange) && (
                              <span
                                className="text-xs"
                                style={{ color: ink.muted, fontFamily: BODY }}
                              >
                                <InlineText
                                  as="span"
                                  value={t.title ?? ""}
                                  onUpdate={
                                    onFieldChange
                                      ? (v) => patchTestimonial(i, { title: v })
                                      : undefined
                                  }
                                />
                              </span>
                            )}
                          </span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 5. PLAN — three numbered steps with a connecting line ────────── */}
      {props.showPlan !== false && (
        <section
          id="plan"
          className="scroll-mt-8 px-6 lg:px-12 py-20 md:py-28"
          style={{ background: problemBg, borderTop: `1px solid ${ink.hairline}` }}
        >
          <div className="max-w-6xl mx-auto">
            <Reveal disabled={still} className="max-w-2xl mb-14">
              {kickerEl(props.planKicker ?? D.planKicker, field("planKicker"), kickerInk, "04")}
              <h2
                className="text-3xl md:text-[2.6rem] leading-[1.12] font-medium tracking-tight mb-4"
                style={{ fontFamily: display, color: headline }}
              >
                <InlineText
                  as="span"
                  value={props.planHeading ?? D.planHeading!}
                  onUpdate={field("planHeading")}
                  multiline
                />
              </h2>
              {(props.planSubhead || onFieldChange) && (
                <p
                  className="text-base md:text-lg leading-relaxed"
                  style={{ color: ink.muted, fontFamily: BODY }}
                >
                  <InlineText
                    as="span"
                    value={props.planSubhead ?? ""}
                    onUpdate={field("planSubhead")}
                    multiline
                  />
                </p>
              )}
            </Reveal>

            <div className="relative">
              {/* Connecting line behind the numbered medallions (md+). */}
              <span
                aria-hidden
                className="hidden md:block absolute top-7 left-[12%] right-[12%] h-px"
                style={{ background: ink.hairline }}
              />
              <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-7 list-none m-0 p-0">
                {planSteps.map((step, i) => (
                  <li key={i} className="relative">
                    <Reveal disabled={still} delay={Math.min(i * 0.1, 0.3)}>
                      <div className="md:text-center md:px-4 flex md:block items-start gap-5">
                        <span
                          className="relative z-10 inline-flex w-14 h-14 shrink-0 rounded-full border-2 items-center justify-center text-xl font-medium md:mx-auto md:mb-5 tabular-nums"
                          style={{
                            borderColor: accent,
                            color: kickerInk,
                            background: bg,
                            fontFamily: display,
                          }}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <h3
                            className="text-xl leading-snug font-medium mb-2.5"
                            style={{ fontFamily: display, color: headline }}
                          >
                            <InlineText
                              as="span"
                              value={step.title}
                              onUpdate={
                                onFieldChange ? (v) => patchPlan(i, { title: v }) : undefined
                              }
                            />
                          </h3>
                          <p
                            className="text-sm md:text-[0.95rem] leading-relaxed"
                            style={{ color: ink.muted, fontFamily: BODY }}
                          >
                            <InlineText
                              as="span"
                              value={step.body}
                              onUpdate={
                                onFieldChange ? (v) => patchPlan(i, { body: v }) : undefined
                              }
                              multiline
                            />
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>

            {/* Optional post-purchase second row. */}
            {props.showPostPurchase === true && postPurchaseSteps.length > 0 && (
              <Reveal disabled={still} delay={0.1}>
                <div
                  className="mt-14 rounded-2xl border p-7 md:p-9"
                  style={{
                    borderColor: ink.hairline,
                    background: `color-mix(in srgb, ${accent} 6%, transparent)`,
                  }}
                >
                  <p
                    className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] mb-6"
                    style={{ color: kickerInk, fontFamily: BODY }}
                  >
                    <ArrowDown aria-hidden className="w-3.5 h-3.5" />
                    <InlineText
                      as="span"
                      value={props.postPurchaseLabel ?? D.postPurchaseLabel!}
                      onUpdate={field("postPurchaseLabel")}
                    />
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                    {postPurchaseSteps.map((step, i) => (
                      <div key={i}>
                        <h3
                          className="text-lg leading-snug font-medium mb-2"
                          style={{ fontFamily: display, color: headline }}
                        >
                          <InlineText
                            as="span"
                            value={step.title}
                            onUpdate={onFieldChange ? (v) => patchPost(i, { title: v }) : undefined}
                          />
                        </h3>
                        <p
                          className="text-sm leading-relaxed"
                          style={{ color: ink.muted, fontFamily: BODY }}
                        >
                          <InlineText
                            as="span"
                            value={step.body}
                            onUpdate={onFieldChange ? (v) => patchPost(i, { body: v }) : undefined}
                            multiline
                          />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ── 6. SUCCESS — the transformation, warm gradient lift ──────────── */}
      {props.showSuccess !== false && (
        <section
          className="px-6 lg:px-12 py-20 md:py-28"
          style={{ background: `linear-gradient(180deg, ${bg} 0%, ${successEnd} 100%)` }}
        >
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal disabled={still}>
              {kickerEl(props.successKicker ?? D.successKicker, field("successKicker"), kickerInk, "05")}
              <h2
                className="text-3xl md:text-[2.6rem] leading-[1.12] font-medium tracking-tight mb-5"
                style={{ fontFamily: display, color: headline }}
              >
                <InlineText
                  as="span"
                  value={props.successHeading ?? D.successHeading!}
                  onUpdate={field("successHeading")}
                  multiline
                />
              </h2>
              {(props.successBody || onFieldChange) && (
                <p
                  className="text-base md:text-lg leading-relaxed mb-9 max-w-lg"
                  style={{ color: successInk.muted, fontFamily: BODY }}
                >
                  <InlineText
                    as="span"
                    value={props.successBody ?? ""}
                    onUpdate={field("successBody")}
                    multiline
                  />
                </p>
              )}
              <ul className="space-y-4 list-none m-0 p-0">
                {successItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-4"
                    style={{ borderColor: ink.hairline }}
                  >
                    <span
                      className="text-sm md:text-base"
                      style={{ color: successInk.muted, fontFamily: BODY }}
                    >
                      <InlineText
                        as="span"
                        value={item.from}
                        onUpdate={
                          onFieldChange ? (v) => patchSuccess(i, { from: v }) : undefined
                        }
                      />
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="w-4 h-4 shrink-0"
                      style={{ color: kickerInk }}
                    />
                    <span
                      className="text-sm md:text-base font-semibold"
                      style={{ color: headline, fontFamily: BODY }}
                    >
                      <InlineText
                        as="span"
                        value={item.to}
                        onUpdate={onFieldChange ? (v) => patchSuccess(i, { to: v }) : undefined}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal disabled={still} delay={0.08}>
              {props.successImageUrl || onFieldChange ? (
                <div
                  className="relative overflow-hidden rounded-3xl border aspect-[4/3] w-full"
                  style={{
                    borderColor: ink.hairline,
                    boxShadow: "0 24px 60px -28px rgba(60, 42, 24, 0.35)",
                    background: mixHex(accent, bg, 0.12),
                  }}
                >
                  <InlineImage
                    src={props.successImageUrl ?? ""}
                    alt={props.successImageAlt ?? ""}
                    className="absolute inset-0 w-full h-full object-cover"
                    wrapperClassName="absolute inset-0"
                    loading="lazy"
                    onUpdate={field("successImageUrl")}
                    onAltUpdate={field("successImageAlt")}
                    focalPoint={props.successImageFocal}
                    onFocalUpdate={field("successImageFocal")}
                  />
                </div>
              ) : (
                /* No image: a quiet decorative sunrise panel keeps the split
                   balanced without inventing a photo. */
                <div
                  aria-hidden
                  className="rounded-3xl border aspect-[4/3] w-full"
                  style={{
                    borderColor: ink.hairline,
                    background: `radial-gradient(80% 90% at 50% 110%, color-mix(in srgb, ${accent} 30%, transparent) 0%, transparent 70%), ${mixHex(accent, bg, 0.1)}`,
                  }}
                />
              )}
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 7. FINALE — repeat the direct + transitional ask ─────────────── */}
      {props.showFinale !== false && (
        <section
          id="finale"
          className="sbj-deep relative scroll-mt-8 overflow-hidden px-6 lg:px-12 py-24 md:py-32"
          style={{ background: deep }}
        >
          {!still && (
            <SbjAurora
              a={`color-mix(in srgb, ${accentOnDeep} 26%, transparent)`}
              b={`color-mix(in srgb, ${bg} 20%, transparent)`}
            />
          )}
          <div className="relative max-w-3xl mx-auto flex flex-col items-center text-center">
            {kickerEl(props.finaleKicker ?? D.finaleKicker, field("finaleKicker"), accentOnDeep, "06")}
            <h2
              className="text-4xl md:text-5xl leading-[1.08] font-medium tracking-tight mb-5"
              style={{ fontFamily: display, color: headlineOnDeep }}
            >
              <InlineText
                as="span"
                value={props.finaleHeading ?? D.finaleHeading!}
                onUpdate={field("finaleHeading")}
                multiline
              />
            </h2>
            {(props.finaleRecap || onFieldChange) && (
              <p
                className="text-lg leading-relaxed mb-10 max-w-xl"
                style={{ color: deepInk.muted, fontFamily: BODY }}
              >
                <InlineText
                  as="span"
                  value={props.finaleRecap ?? ""}
                  onUpdate={field("finaleRecap")}
                  multiline
                />
              </p>
            )}
            {ctaRow(
              {
                primaryText:
                  props.finalePrimaryCtaText ?? props.heroPrimaryCtaText ?? D.finalePrimaryCtaText,
                primaryUrl:
                  props.finalePrimaryCtaUrl ?? props.heroPrimaryCtaUrl ?? D.finalePrimaryCtaUrl,
                ghostText:
                  props.finaleTransitionalCtaText ??
                  props.heroTransitionalCtaText ??
                  D.finaleTransitionalCtaText,
                ghostUrl:
                  props.finaleTransitionalCtaUrl ??
                  props.heroTransitionalCtaUrl ??
                  D.finaleTransitionalCtaUrl,
                assetLabel:
                  props.finaleTransitionalAssetLabel ?? props.heroTransitionalAssetLabel,
                onPrimaryText: field("finalePrimaryCtaText"),
                onGhostText: field("finaleTransitionalCtaText"),
                onAssetLabel: field("finaleTransitionalAssetLabel"),
              },
              "deep",
              "center",
            )}
            <div className="mt-16 flex items-center gap-3" aria-hidden>
              <span className="w-10 h-px" style={{ background: deepInk.hairline }} />
              <Check className="w-4 h-4" style={{ color: accentOnDeep }} />
              <span className="w-10 h-px" style={{ background: deepInk.hairline }} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default BlockStorybrandJourney;
