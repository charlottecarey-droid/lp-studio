import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileText, PlayCircle, BookOpen, Mail } from "lucide-react";
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
import {
  DarkHeroBackdrop,
  MicrositeNavbar,
  resolveDarkHeroSurface,
  resolveHeroLayout,
  type HeroLayout,
  type MicrositeNavLink,
} from "./microsite-chrome";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/* ----------------------------------------------------------------------------
 * Onboarding Hub — type "onboarding-hub"
 *
 * ABM new-customer onboarding microsite. A warm, organized "start here" page a
 * CSM hands a new account at kickoff to cut time-to-value and churn risk in the
 * first 90 days: a welcome hero with a warm team/portrait image + kickoff CTA, a
 * phased onboarding plan timeline (kickoff → setup → first value → full rollout)
 * with owners and status, named team contacts with grayscale portrait avatars +
 * how to reach them, a getting-started checklist of concrete first actions, a
 * grouped resources & training library (links rendered as provided, never
 * fabricated), a "what success looks like" count-up metric band, and a support &
 * next-check-in close.
 *
 * Reassuring register: cream canvas with paper grain, white ink-hairline cards
 * with warm shadow, sage/sand tints for a calmer supportive feel, indigo for
 * actions, coral spark reserved for completed steps, mono numbered section
 * markers, a slow-aurora dark "success" chapter, count-up on outcome metrics.
 * Gentle fade-ups, all reduced-motion safe. Single h1 (hero). NO_REVEAL — owns
 * its own motion.
 *
 * CTAs (hero kickoff + close book-review) use the shared CtaModalConfig +
 * HeroCtaConfig mixin + the CtaButton suite, so a future "copy CTA config to
 * all" can target them uniformly.
 * -------------------------------------------------------------------------- */

export type OnboardingPhaseStatus = "done" | "in-progress" | "upcoming";

export interface OnboardingPhase {
  /** Phase title, e.g. "Kickoff" (1–3 words). */
  title: string;
  /** Who owns / leads this phase — short label, e.g. "You + your CSM". */
  owner?: string;
  /** Timeframe, e.g. "Week 1" or "Weeks 2–3". */
  timeframe?: string;
  /** One-sentence description of what happens in this phase. */
  detail?: string;
  /** Status drives the marker: coral spark on "done", filled on "in-progress". */
  status: OnboardingPhaseStatus;
}

export interface OnboardingContact {
  /** Person's name, e.g. "Dana Ruiz". */
  name: string;
  /** Role label, e.g. "Customer Success Manager" (1–4 words). */
  role: string;
  /** One short line on what they help with. */
  blurb?: string;
  /** Warm grayscale portrait avatar URL. */
  avatarUrl?: string;
  /** Optional email — rendered as a mailto link when present. */
  email?: string;
}

export interface OnboardingChecklistItem {
  /** The action, e.g. "Invite your team" (one short clause). */
  label: string;
  /** Optional one-line hint under the action. */
  hint?: string;
  /** Show as already completed (coral spark check). Default false. */
  done?: boolean;
}

export type OnboardingResourceKind = "guide" | "video" | "doc";

export interface OnboardingResource {
  /** Document / video title. */
  title: string;
  /** Short type label, e.g. "5 min read" or "Video · 4 min". */
  meta?: string;
  /** Link to the asset. */
  url: string;
  /** Drives the icon. Defaults to "doc". */
  kind?: OnboardingResourceKind;
}

export interface OnboardingResourceGroup {
  /** Group heading, e.g. "Set up" or "Train your team". */
  heading: string;
  resources: OnboardingResource[];
}

export interface OnboardingMetric {
  /** Display value with affixes, e.g. "30 days", "3x", "95%" — animatable. */
  value: string;
  /** Short label under the numeral (2–6 words). */
  label: string;
  /** Optional small-print context. */
  source?: string;
}

export interface OnboardingHubBlockProps extends CtaModalConfig, HeroCtaConfig {
  /* ── palette overrides (all optional; brand-derived defaults) ─────────── */
  /** Page surface. Defaults to the brand page background (or warm cream). */
  bgColor?: string;
  /** Body text override — only honored when it meets AA on the surface. */
  inkColor?: string;
  /** Display-heading ink. Defaults to brand heading-on-light / deep indigo. */
  headlineColor?: string;
  /** Accent — markers, links, actions. Defaults to the brand accent / indigo. */
  accentColor?: string;
  /** Calmer tint — section bands, phase chrome. Defaults to sage. */
  tintColor?: string;
  /** Spark — completed steps. Defaults to coral. */
  sparkColor?: string;
  /** Success-chapter dark surface. Defaults to a deep-indigo mix of brand primary. */
  darkColor?: string;
  /** Dark/brand hero surface (the welcome band). Defaults to a deep mix of the
   *  brand primary so the page opens on a distinct branded hero, never white. */
  heroBgColor?: string;

  /* ── navbar + hero treatment (design-system chrome) ───────────────────── */
  /** Hero layout. "split" = dark brand panel beside the hero image;
   *  "image-overlay" = full-bleed image with a brand scrim; "dark" = a dark
   *  headline band. Defaults to "split" (or "dark" when no image). Never white. */
  heroLayout?: HeroLayout;
  /** Show the slim top navbar over the hero. Default true. */
  showNavbar?: boolean;
  /** 0–4 navbar anchor links (scroll to page sections). */
  navLinks?: MicrositeNavLink[];
  /** Navbar CTA label. Defaults to the hero CTA (ctaText). */
  navCtaText?: string;
  /** Navbar CTA href. Defaults to the hero CTA url. */
  navCtaUrl?: string;

  /* ── 1. welcome hero ──────────────────────────────────────────────────── */
  /** Eyebrow, personalization-token friendly: "Welcome to {{company_name}}". */
  eyebrow: string;
  /** Account name shown in the welcome line, e.g. "Acme". */
  accountName: string;
  /** The warm welcome headline — the page's only h1 (6–14 words). */
  headline: string;
  /** Supporting line under the headline (one sentence, ≤ 30 words). */
  subheadline?: string;
  /** Warm team/portrait image shown beside the welcome copy. */
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** Show your (tenant brand) logo in the hero. Default true (hidden if none). */
  showLogo?: boolean;
  logoUrl?: string;
  logoAlt?: string;
  /** Hero CTA label lives in `ctaText`; secondary in `ctaSecondaryText`/`ctaSecondaryUrl`. */

  /* ── 2. onboarding plan ───────────────────────────────────────────────── */
  showPlan?: boolean;
  planKicker?: string;
  planHeading: string;
  planIntro?: string;
  /** 4–5 phases render best; statuses drive the timeline markers. */
  phases: OnboardingPhase[];

  /* ── 3. your team ─────────────────────────────────────────────────────── */
  showTeam?: boolean;
  teamKicker?: string;
  teamHeading: string;
  teamIntro?: string;
  contacts: OnboardingContact[];

  /* ── 4. getting-started checklist ─────────────────────────────────────── */
  showChecklist?: boolean;
  checklistKicker?: string;
  checklistHeading: string;
  checklistIntro?: string;
  checklist: OnboardingChecklistItem[];

  /* ── 5. resources & training ──────────────────────────────────────────── */
  showResources?: boolean;
  resourcesKicker?: string;
  resourcesHeading: string;
  /** Grouped guides/videos/docs — rendered as provided; never fabricated. */
  resourceGroups: OnboardingResourceGroup[];

  /* ── 6. what success looks like ───────────────────────────────────────── */
  showSuccess?: boolean;
  successKicker?: string;
  successHeading: string;
  successIntro?: string;
  /** 3–4 oversized count-up metrics; graceful with fewer. */
  metrics: OnboardingMetric[];
  /** Count-up duration in ms. Default 1400. */
  countUpMs?: number;

  /* ── 7. support & next check-in ───────────────────────────────────────── */
  showSupport?: boolean;
  supportKicker?: string;
  supportHeading: string;
  supportIntro?: string;
  /** Tiny footer line under the support CTAs. */
  footerNote?: string;
}

export const ONBOARDING_HUB_DEFAULT_PROPS: OnboardingHubBlockProps = {
  /* hero CTA suite (HeroCtaConfig) */
  ctaText: "Book your kickoff call",
  ctaUrl: "#support",
  ctaAction: "url",
  ctaSecondaryText: "Jump to your checklist",
  ctaSecondaryUrl: "#checklist",

  /* navbar + hero chrome */
  heroLayout: "split",
  showNavbar: true,
  navLinks: [
    { label: "Your plan", href: "#plan" },
    { label: "Checklist", href: "#checklist" },
    { label: "Support", href: "#support" },
  ],
  navCtaText: "Book your kickoff call",
  navCtaUrl: "#support",

  eyebrow: "Welcome to {{company_name}}",
  accountName: "Acme",
  headline: "Welcome, Acme. Here's your path to your first win.",
  subheadline:
    "Everything you need to get started, in one place: your plan, your team, your first actions, and the outcomes we're aiming for together. We'll move at your pace.",
  showLogo: true,

  showPlan: true,
  planKicker: "Your onboarding plan",
  planHeading: "Four phases, from kickoff to full rollout.",
  planIntro:
    "A clear plan beats a pile of to-dos. Here's what we move through together, who leads each phase, and roughly when it lands.",
  phases: [
    {
      title: "Kickoff",
      owner: "You + your CSM",
      timeframe: "Week 1",
      detail: "We meet your team, confirm goals, and agree what a first win looks like.",
      status: "done",
    },
    {
      title: "Setup",
      owner: "You + implementation",
      timeframe: "Weeks 1–2",
      detail: "Connect your tools, invite your team, and configure the basics together.",
      status: "in-progress",
    },
    {
      title: "First value",
      owner: "Both teams",
      timeframe: "Weeks 2–4",
      detail: "Run your first real workflow and see the first measurable result.",
      status: "upcoming",
    },
    {
      title: "Full rollout",
      owner: "Both teams",
      timeframe: "Weeks 4–8",
      detail: "Roll out to the wider team with a named contact and a regular check-in.",
      status: "upcoming",
    },
  ],

  showTeam: true,
  teamKicker: "Your team",
  teamHeading: "The people in your corner.",
  teamIntro:
    "You're not doing this alone. Here's who to reach, and what each of us is here to help with.",
  contacts: [
    {
      name: "Dana Ruiz",
      role: "Customer Success Manager",
      blurb: "Your main point of contact — goals, check-ins, and anything that's blocking you.",
      email: "dana@example.com",
    },
    {
      name: "Marcus Lee",
      role: "Implementation Specialist",
      blurb: "Hands-on setup, integrations, and getting your data flowing cleanly.",
      email: "marcus@example.com",
    },
    {
      name: "Priya Shah",
      role: "Support Lead",
      blurb: "Quick answers when you need them, with a one-hour response on anything urgent.",
      email: "support@example.com",
    },
  ],

  showChecklist: true,
  checklistKicker: "Getting started",
  checklistHeading: "Your first few actions.",
  checklistIntro:
    "Knock these out in your first week and you'll be set up for that first win. None of them take long.",
  checklist: [
    { label: "Complete your kickoff call", hint: "30 minutes with your CSM to confirm goals.", done: true },
    { label: "Invite your team", hint: "Add the people who'll use this day to day." },
    { label: "Connect your first integration", hint: "Link the tool you'll use most so data flows in." },
    { label: "Set up your first workflow", hint: "Start with one real use case, not all of them." },
    { label: "Review your success metrics", hint: "Agree what we'll measure so progress is clear." },
  ],

  showResources: true,
  resourcesKicker: "Resources & training",
  resourcesHeading: "Everything you'll want to reference.",
  resourceGroups: [
    {
      heading: "Set up",
      resources: [
        { title: "Quick-start guide", meta: "5 min read", url: "#", kind: "guide" },
        { title: "Connecting your integrations", meta: "Doc", url: "#", kind: "doc" },
        { title: "Setup walkthrough", meta: "Video · 6 min", url: "#", kind: "video" },
      ],
    },
    {
      heading: "Train your team",
      resources: [
        { title: "Admin basics", meta: "Video · 8 min", url: "#", kind: "video" },
        { title: "Inviting and managing users", meta: "Doc", url: "#", kind: "doc" },
        { title: "Best-practice playbook", meta: "10 min read", url: "#", kind: "guide" },
      ],
    },
  ],

  showSuccess: true,
  successKicker: "What success looks like",
  successHeading: "The outcomes we're aiming for together.",
  successIntro:
    "These are the markers we'll watch over your first 90 days, so we both know it's working — and where to help.",
  metrics: [
    { value: "30 days", label: "To your first measurable win", source: "Typical for teams your size" },
    { value: "90%", label: "Of your team active in month one", source: "Our onboarding benchmark" },
    { value: "3x", label: "Faster than setting up alone", source: "Vs. self-serve, on average" },
  ],
  countUpMs: 1400,

  showSupport: true,
  supportKicker: "Support & next check-in",
  supportHeading: "We're here whenever you need us.",
  supportIntro:
    "Stuck on something or ready to go deeper? Book your next review and we'll walk it through together. Bring whoever's working alongside you.",
  footerNote: "Your onboarding plan stays current here — we'll keep it updated as we go.",
};

interface Props {
  props: OnboardingHubBlockProps;
  /** Tenant brand config — drives default palette, fonts, and the hero logo. */
  brand?: BrandConfig;
  /** Optional CTA click handler (analytics / builder preview) for url-mode CTAs. */
  onCtaClick?: () => void;
  /** Builder inline-edit hook. When present, key copy is click-to-edit. */
  onFieldChange?: (updated: OnboardingHubBlockProps) => void;
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

export function BlockOnboardingHub({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
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

  // Calmer sage tint — section bands + phase chrome.
  const tintRaw =
    props.tintColor && isValidHex(props.tintColor) ? props.tintColor : "#6B9171";
  const tintChrome = ensureAccentRegisters(tintRaw, { base: bg }, 1.5);

  // Coral spark — completed steps only. Never a flood.
  const sparkRaw =
    props.sparkColor && isValidHex(props.sparkColor) ? props.sparkColor : "#E26B4F";
  const sparkText = pickContrastingColor(sparkRaw, bg, [accentText], 4.5);
  const sparkChrome = ensureAccentRegisters(sparkRaw, { base: bg }, 1.8);
  const sparkOnCard = pickContrastingColor(sparkRaw, cardBg, [accentOnCard], 4.5);

  // Deep-indigo dark surface for the "success" chapter.
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

  /* — Dark/brand HERO surface (the welcome band). Opens on a distinct branded
   *   hero rather than a plain white document; all hero chrome AA-resolved. — */
  const heroBg = resolveDarkHeroSurface(brand, props.heroBgColor, isValidHex, "#12102E", "#1B1840");
  const heroInk = resolveSectionInk({}, { base: heroBg });
  const heroAccent = pickContrastingColor(accentRaw, heroBg, [heroInk.text], 4.5);
  const heroHeadline = pickContrastingColor(
    brand?.headingOnDarkColor,
    heroBg,
    [heroAccent, heroInk.text],
    4.5,
  );
  const navCtaBg = pickContrastingColor(
    brand?.ctaBackground,
    heroBg,
    [accentRaw, brand?.primaryColor, "#FFFFFF"],
    3.0,
  );
  const navCtaTextColor = pickContrastingColor(brand?.ctaText, navCtaBg, [contrastTextColor(navCtaBg)], 4.5);

  // Warm sand-leaning tinted chapter band (team) — a whisper of tint over the page.
  const bandBg = mixHex(tintChrome, bg, surfaceIsDark ? 0.12 : 0.07);
  const bandInk = resolveSectionInk({ textColor: props.inkColor }, { base: bandBg });
  const bandHeadline = pickContrastingColor(
    props.headlineColor,
    bandBg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#1B1840", bandInk.text],
    4.5,
  );

  // CTA pair colors on the dark support strip.
  const ctaBg = pickContrastingColor(
    brand?.ctaBackground,
    dark,
    [accentRaw, brand?.primaryColor, "#FFFFFF"],
    3.0,
  );
  const ctaText = pickContrastingColor(brand?.ctaText, ctaBg, [contrastTextColor(ctaBg)], 4.5);

  // Hero CTA pair colors (on the light page surface).
  const heroCtaBg = pickContrastingColor(
    brand?.ctaBackground,
    bg,
    [accentRaw, brand?.primaryColor, "#1B1840"],
    3.0,
  );
  const heroCtaText = pickContrastingColor(brand?.ctaText, heroCtaBg, [contrastTextColor(heroCtaBg)], 4.5);

  const set = onFieldChange
    ? <K extends keyof OnboardingHubBlockProps>(key: K, value: OnboardingHubBlockProps[K]) =>
        onFieldChange({ ...props, [key]: value })
    : undefined;
  const edit = (key: keyof OnboardingHubBlockProps) =>
    set ? (v: string) => set(key, v as never) : undefined;

  /* — section numbering follows the visible order — */
  const showPlan = props.showPlan !== false && props.phases.length > 0;
  const showTeam = props.showTeam !== false && props.contacts.length > 0;
  const showChecklist = props.showChecklist !== false && props.checklist.length > 0;
  const showResources = props.showResources !== false && props.resourceGroups.length > 0;
  const showSuccess = props.showSuccess !== false && props.metrics.length > 0;
  const showSupport = props.showSupport !== false;
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
  const setPhase = set
    ? (i: number, patch: Partial<OnboardingPhase>) =>
        set("phases", props.phases.map((s, j) => (j === i ? { ...s, ...patch } : s)))
    : undefined;
  const setContact = set
    ? (i: number, patch: Partial<OnboardingContact>) =>
        set("contacts", props.contacts.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setCheck = set
    ? (i: number, patch: Partial<OnboardingChecklistItem>) =>
        set("checklist", props.checklist.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setMetric = set
    ? (i: number, patch: Partial<OnboardingMetric>) =>
        set("metrics", props.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    : undefined;
  const setGroupResource = set
    ? (gi: number, ri: number, patch: Partial<OnboardingResource>) =>
        set(
          "resourceGroups",
          props.resourceGroups.map((g, j) =>
            j === gi
              ? { ...g, resources: g.resources.map((r, k) => (k === ri ? { ...r, ...patch } : r)) }
              : g,
          ),
        )
    : undefined;
  const setGroupHeading = set
    ? (gi: number, heading: string) =>
        set("resourceGroups", props.resourceGroups.map((g, j) => (j === gi ? { ...g, heading } : g)))
    : undefined;

  const hasLogo = props.showLogo !== false && !!brand && brandHasLogo(brand, props.logoUrl);
  const isEditor = !!onFieldChange;

  /* — navbar + hero layout (design-system chrome) — */
  const hasHeroImage = !!props.heroImageUrl || isEditor;
  const showNavbar = props.showNavbar !== false;
  const heroLayout = resolveHeroLayout(props.heroLayout, hasHeroImage, "split");
  const navLinks = props.navLinks ?? ONBOARDING_HUB_DEFAULT_PROPS.navLinks ?? [];
  const navCtaLabel = props.navCtaText ?? props.ctaText;
  const navCtaHref = props.navCtaUrl || props.ctaUrl || "#support";
  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href.length < 2) return;
    const target = typeof document !== "undefined" ? document.getElementById(href.slice(1)) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

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
    kickerKey: keyof OnboardingHubBlockProps;
    heading: string;
    headingKey: keyof OnboardingHubBlockProps;
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
    kicker: accentText,
    heading: headline,
  };
  const bandTones = {
    muted: bandInk.muted,
    rule: tintChrome,
    kicker: pickContrastingColor(accentRaw, bandBg, [bandHeadline, bandInk.text], 4.5),
    heading: bandHeadline,
  };

  /* — status presentation for the onboarding-plan markers — */
  const statusMeta = (status: OnboardingPhaseStatus) => {
    if (status === "done")
      return { label: "Done", color: sparkText, dot: sparkChrome, filled: true };
    if (status === "in-progress")
      return { label: "In progress", color: accentText, dot: accentChrome, filled: true };
    return { label: "Upcoming", color: ink.muted, dot: ink.hairline, filled: false };
  };

  const ResourceIcon = ({ kind }: { kind?: OnboardingResourceKind }) => {
    if (kind === "video") return <PlayCircle className="w-5 h-5" />;
    if (kind === "guide") return <BookOpen className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="oh-root" style={{ background: bg, color: ink.text, fontFamily: BODY }}>
      <style>{`
        .oh-root { position: relative; }
        .oh-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.5;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        }
        .oh-root > * { position: relative; }
        .oh-card {
          transition: transform 0.3s cubic-bezier(.16,1,.3,1),
                      box-shadow 0.3s cubic-bezier(.16,1,.3,1);
        }
        .oh-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 40px -26px rgba(27, 24, 64, 0.4);
        }
        .oh-aurora { will-change: transform; }
        .oh-aurora-1 { animation: oh-drift-1 30s ease-in-out infinite alternate; }
        .oh-aurora-2 { animation: oh-drift-2 36s ease-in-out infinite alternate; }
        @keyframes oh-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(5%, 7%, 0) scale(1.08); }
        }
        @keyframes oh-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.05); }
          to   { transform: translate3d(-6%, -5%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .oh-aurora { animation: none !important; }
          .oh-card, .oh-card:hover { transition: none; transform: none; }
        }
      `}</style>

      {/* ── 1. WELCOME HERO — distinct dark/brand band with navbar ────────── */}
      <header
        className="relative overflow-hidden"
        style={{ background: heroBg, color: heroInk.text }}
      >
        <DarkHeroBackdrop
          surface={heroBg}
          accent={accentRaw}
          primary={primaryHex}
          isStatic={reduced || isEditor}
          idPrefix="oh-hero"
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
                  background: `linear-gradient(105deg, ${heroBg} 38%, ${mixHex(heroBg, "#000000", 0.7)}cc 100%)`,
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
            ctaText={navCtaLabel}
            ctaUrl={navCtaHref}
            ctaBg={navCtaBg}
            ctaText_color={navCtaTextColor}
            heroSurface={heroBg}
            isDark
            ink={heroInk.text}
            inkMuted={heroInk.muted}
            accent={heroAccent}
            onAnchor={handleAnchor}
            onCtaClick={onCtaClick}
          />
        )}

        <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:px-10">
          <div
            className={
              heroLayout === "split" && hasHeroImage
                ? "grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12"
                : undefined
            }
          >
            <motion.div
              {...fadeUp()}
              className={heroLayout === "split" && hasHeroImage ? "lg:col-span-7" : "max-w-3xl"}
            >
              <span className={kickerClass} style={{ color: heroAccent }}>
                <InlineText as="span" value={props.eyebrow} onUpdate={edit("eyebrow")} />
              </span>
              <h1
                className="mt-6 text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
                style={{
                  color: heroHeadline,
                  fontFamily: DISPLAY,
                  fontWeight: "var(--brand-heading-weight, 700)" as never,
                }}
              >
                <InlineText as="span" value={props.headline} onUpdate={edit("headline")} multiline />
              </h1>
              {(props.subheadline || isEditor) && (
                <p className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: heroInk.muted }}>
                  <InlineText
                    as="span"
                    value={props.subheadline ?? ""}
                    onUpdate={edit("subheadline")}
                    multiline
                  />
                </p>
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
                  source="onboarding-hub-hero-primary"
                  className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-opacity hover:opacity-90 ${focusable}`}
                  style={{ background: navCtaBg, color: navCtaTextColor }}
                >
                  <InlineText as="span" value={props.ctaText} onUpdate={edit("ctaText")} />
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </CtaButton>
                {(props.ctaSecondaryText || isEditor) && (
                  <a
                    href={props.ctaSecondaryUrl || "#"}
                    onClick={(e) => handleAnchor(e, props.ctaSecondaryUrl || "#")}
                    className={`inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-colors hover:opacity-90 ${focusable}`}
                    style={{ border: `1px solid ${heroInk.hairline}`, color: heroInk.text }}
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

            {heroLayout === "split" && hasHeroImage && (
              <motion.div {...fadeUp(0.1)} className="lg:col-span-5">
                <div
                  className="overflow-hidden rounded-2xl border p-2 backdrop-blur-md"
                  style={{
                    background: "rgba(255,255,255,0.045)",
                    borderColor: "rgba(255,255,255,0.12)",
                    boxShadow: `0 36px 72px -30px rgba(0,0,0,0.7), 0 0 56px -16px ${mixHex(accentRaw, heroBg, 0.4)}`,
                  }}
                >
                  <InlineImage
                    src={props.heroImageUrl ?? ""}
                    alt={props.heroImageAlt || "Your onboarding team"}
                    wrapperClassName="block"
                    className="w-full h-full object-cover aspect-[4/3] rounded-xl"
                    onUpdate={edit("heroImageUrl")}
                    onAltUpdate={edit("heroImageAlt")}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        <span aria-hidden className="block pt-12 sm:pt-16" />

        {/* ── 2. Onboarding plan ───────────────────────────────────────── */}
        {showPlan && (
          <section
            id="plan"
            className="scroll-mt-8 py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.planKicker || "Your onboarding plan"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.planKicker}
              kickerKey="planKicker"
              heading={props.planHeading}
              headingKey="planHeading"
              tones={lightTones}
            />
            {(props.planIntro || isEditor) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: ink.muted }}
              >
                <InlineText as="span" value={props.planIntro ?? ""} onUpdate={edit("planIntro")} multiline />
              </motion.p>
            )}
            <ol className="relative">
              <span
                aria-hidden
                className="absolute left-[11px] top-2 bottom-2 w-px"
                style={{ background: ink.hairline }}
              />
              {props.phases.map((phase, i) => {
                const meta = statusMeta(phase.status);
                return (
                  <motion.li
                    key={i}
                    {...fadeUp(i * 0.05)}
                    className="relative grid grid-cols-[24px_1fr] gap-x-4 pb-8 last:pb-0"
                  >
                    <span
                      className="relative z-[1] mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-full"
                      style={{
                        background: meta.filled ? meta.dot : bg,
                        border: `2px solid ${meta.dot}`,
                        color: meta.filled ? contrastTextColor(isValidHex(meta.dot) ? meta.dot : "#000000") : ink.muted,
                      }}
                      aria-hidden
                    >
                      {phase.status === "done" ? (
                        <Check className="w-3 h-3" strokeWidth={3} />
                      ) : phase.status === "in-progress" ? (
                        <span className="w-2 h-2 rounded-full" style={{ background: "currentColor" }} />
                      ) : (
                        <span className="text-[9px] font-bold tabular-nums" style={{ fontFamily: NUMBERS, color: ink.muted }}>
                          {String(i + 1)}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3
                          className="text-base sm:text-lg font-bold tracking-tight"
                          style={{ color: headline, fontFamily: DISPLAY }}
                        >
                          <InlineText
                            as="span"
                            value={phase.title}
                            onUpdate={setPhase ? (v) => setPhase(i, { title: v }) : undefined}
                          />
                        </h3>
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
                          style={{ color: meta.color, border: `1px solid ${meta.color}` }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs" style={{ color: ink.muted }}>
                        {(phase.owner || isEditor) && (
                          <span>
                            <InlineText
                              as="span"
                              value={phase.owner ?? ""}
                              onUpdate={setPhase ? (v) => setPhase(i, { owner: v }) : undefined}
                            />
                          </span>
                        )}
                        {(phase.timeframe || isEditor) && (
                          <span className="tabular-nums" style={{ fontFamily: NUMBERS }}>
                            <InlineText
                              as="span"
                              value={phase.timeframe ?? ""}
                              onUpdate={setPhase ? (v) => setPhase(i, { timeframe: v }) : undefined}
                            />
                          </span>
                        )}
                      </div>
                      {(phase.detail || isEditor) && (
                        <p className="mt-2 text-sm leading-relaxed max-w-2xl" style={{ color: ink.text }}>
                          <InlineText
                            as="span"
                            value={phase.detail ?? ""}
                            onUpdate={setPhase ? (v) => setPhase(i, { detail: v }) : undefined}
                            multiline
                          />
                        </p>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </section>
        )}
      </div>

      {/* ── 3. Your team — warm tinted chapter ───────────────────────────── */}
      {showTeam && (
        <section
          className="relative py-14 sm:py-20"
          style={{ background: bandBg, borderTop: `1px solid ${ink.hairline}`, borderBottom: `1px solid ${ink.hairline}` }}
          aria-label={props.teamKicker || "Your team"}
        >
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
            <SectionHead
              no={nextNo()}
              kicker={props.teamKicker}
              kickerKey="teamKicker"
              heading={props.teamHeading}
              headingKey="teamHeading"
              tones={bandTones}
            />
            {(props.teamIntro || isEditor) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: bandInk.muted }}
              >
                <InlineText as="span" value={props.teamIntro ?? ""} onUpdate={edit("teamIntro")} multiline />
              </motion.p>
            )}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${
                props.contacts.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
              }`}
            >
              {props.contacts.map((c, i) => (
                <motion.div
                  key={i}
                  {...fadeUp(i * 0.06)}
                  className="oh-card rounded-2xl p-6"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardInk.hairline}`,
                    boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                  }}
                >
                  {(c.avatarUrl || isEditor) ? (
                    <span className="mb-4 block">
                      <InlineImage
                        src={c.avatarUrl ?? ""}
                        alt={c.name || c.role}
                        wrapperClassName="inline-block"
                        className="w-14 h-14 rounded-full object-cover grayscale"
                        style={{ border: `1px solid ${cardInk.hairline}` }}
                        onUpdate={setContact ? (v) => setContact(i, { avatarUrl: v }) : undefined}
                      />
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="mb-4 inline-flex w-14 h-14 items-center justify-center rounded-full text-lg font-bold"
                      style={{ background: mixHex(tintChrome, cardBg, 0.16), color: accentOnCard, fontFamily: DISPLAY }}
                    >
                      {(c.name || c.role || "?").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <h3
                    className="text-base font-bold tracking-tight"
                    style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                  >
                    <InlineText
                      as="span"
                      value={c.name}
                      onUpdate={setContact ? (v) => setContact(i, { name: v }) : undefined}
                    />
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: accentOnCard }}>
                    <InlineText
                      as="span"
                      value={c.role}
                      onUpdate={setContact ? (v) => setContact(i, { role: v }) : undefined}
                    />
                  </p>
                  {(c.blurb || isEditor) && (
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: cardInk.text }}>
                      <InlineText
                        as="span"
                        value={c.blurb ?? ""}
                        onUpdate={setContact ? (v) => setContact(i, { blurb: v }) : undefined}
                        multiline
                      />
                    </p>
                  )}
                  {(c.email || isEditor) && (
                    <a
                      href={c.email ? `mailto:${c.email}` : "#"}
                      className={`mt-4 inline-flex items-center gap-1.5 text-xs font-semibold ${focusable}`}
                      style={{ color: accentOnCard }}
                    >
                      <Mail className="w-3.5 h-3.5" aria-hidden />
                      <InlineText
                        as="span"
                        value={c.email ?? ""}
                        onUpdate={setContact ? (v) => setContact(i, { email: v }) : undefined}
                      />
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* ── 4. Getting-started checklist ─────────────────────────────── */}
        {showChecklist && (
          <section
            id="checklist"
            className="py-10 sm:py-14"
            style={{ borderTop: showTeam ? "none" : `1px solid ${ink.hairline}` }}
            aria-label={props.checklistKicker || "Getting started"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.checklistKicker}
              kickerKey="checklistKicker"
              heading={props.checklistHeading}
              headingKey="checklistHeading"
              tones={lightTones}
            />
            {(props.checklistIntro || isEditor) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: ink.muted }}
              >
                <InlineText as="span" value={props.checklistIntro ?? ""} onUpdate={edit("checklistIntro")} multiline />
              </motion.p>
            )}
            <ul className="space-y-3">
              {props.checklist.map((item, i) => (
                <motion.li
                  key={i}
                  {...fadeUp(i * 0.04)}
                  className="oh-card flex items-start gap-4 rounded-2xl p-5"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardInk.hairline}`,
                    boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                  }}
                >
                  <span
                    className="mt-0.5 inline-flex w-6 h-6 flex-none items-center justify-center rounded-full"
                    style={{
                      background: item.done ? sparkChrome : "transparent",
                      border: `2px solid ${item.done ? sparkChrome : cardInk.hairline}`,
                      color: item.done ? contrastTextColor(isValidHex(sparkChrome) ? sparkChrome : "#000000") : "transparent",
                    }}
                    aria-hidden
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-sm sm:text-base font-semibold tracking-tight"
                      style={{ color: item.done ? cardInk.muted : headlineOnCard, fontFamily: DISPLAY }}
                    >
                      <InlineText
                        as="span"
                        value={item.label}
                        onUpdate={setCheck ? (v) => setCheck(i, { label: v }) : undefined}
                      />
                    </p>
                    {(item.hint || isEditor) && (
                      <p className="mt-0.5 text-sm leading-relaxed" style={{ color: cardInk.muted }}>
                        <InlineText
                          as="span"
                          value={item.hint ?? ""}
                          onUpdate={setCheck ? (v) => setCheck(i, { hint: v }) : undefined}
                          multiline
                        />
                      </p>
                    )}
                  </div>
                  {item.done && (
                    <span
                      className="ml-auto self-center text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: sparkOnCard }}
                    >
                      Done
                    </span>
                  )}
                </motion.li>
              ))}
            </ul>
          </section>
        )}

        {/* ── 5. Resources & training ──────────────────────────────────── */}
        {showResources && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.resourcesKicker || "Resources & training"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.resourcesKicker}
              kickerKey="resourcesKicker"
              heading={props.resourcesHeading}
              headingKey="resourcesHeading"
              tones={lightTones}
            />
            <div className="space-y-10">
              {props.resourceGroups.map((group, gi) => (
                <div key={gi}>
                  <motion.h3
                    {...fadeUp(0.04)}
                    className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: ink.muted }}
                  >
                    <InlineText
                      as="span"
                      value={group.heading}
                      onUpdate={setGroupHeading ? (v) => setGroupHeading(gi, v) : undefined}
                    />
                  </motion.h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.resources.map((r, ri) => (
                      <motion.a
                        key={ri}
                        {...fadeUp(ri * 0.05)}
                        href={r.url || "#"}
                        className={`oh-card group flex items-center gap-4 rounded-2xl p-5 ${focusable}`}
                        style={{
                          background: cardBg,
                          border: `1px solid ${cardInk.hairline}`,
                          boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                        }}
                      >
                        <span
                          className="inline-flex w-10 h-10 flex-none items-center justify-center rounded-xl"
                          style={{ background: mixHex(tintChrome, cardBg, 0.14), color: accentOnCard }}
                          aria-hidden
                        >
                          <ResourceIcon kind={r.kind} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-sm font-bold tracking-tight"
                            style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                          >
                            <InlineText
                              as="span"
                              value={r.title}
                              onUpdate={setGroupResource ? (v) => setGroupResource(gi, ri, { title: v }) : undefined}
                            />
                          </span>
                          {(r.meta || isEditor) && (
                            <span className="mt-0.5 block text-[11px] uppercase tracking-[0.12em]" style={{ color: cardInk.muted }}>
                              <InlineText
                                as="span"
                                value={r.meta ?? ""}
                                onUpdate={setGroupResource ? (v) => setGroupResource(gi, ri, { meta: v }) : undefined}
                              />
                            </span>
                          )}
                        </span>
                        <ArrowRight
                          className="w-4 h-4 flex-none transition-transform group-hover:translate-x-0.5"
                          style={{ color: accentOnCard }}
                          aria-hidden
                        />
                      </motion.a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── 6. What success looks like — dark aurora chapter ─────────────── */}
      {showSuccess && (
        <section
          className="relative overflow-hidden"
          style={{ background: dark }}
          aria-label={props.successKicker || "What success looks like"}
        >
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span
                className="oh-aurora oh-aurora-1 absolute rounded-full"
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
                className="oh-aurora oh-aurora-2 absolute rounded-full"
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
                  <InlineText as="span" value={props.successKicker ?? ""} onUpdate={edit("successKicker")} />
                </span>
              </div>
              <h2
                className="text-2xl sm:text-3xl lg:text-4xl tracking-tight"
                style={{ color: headlineOnDark, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
              >
                <InlineText as="span" value={props.successHeading} onUpdate={edit("successHeading")} multiline />
              </h2>
              {(props.successIntro || isEditor) && (
                <p className="mt-4 text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: darkInk.muted }}>
                  <InlineText as="span" value={props.successIntro ?? ""} onUpdate={edit("successIntro")} multiline />
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
                    className="mb-4 block h-[3px] w-9 rounded-full"
                    style={{ background: sparkOnDark }}
                  />
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

      {/* ── 7. Support & next check-in — dark scheduling strip ───────────── */}
      {showSupport && (
        <section
          id="support"
          className="relative overflow-hidden mt-4"
          style={{ background: dark }}
          aria-label={props.supportKicker || "Support & next check-in"}
        >
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span
                className="oh-aurora oh-aurora-2 absolute rounded-full"
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
                  <InlineText as="span" value={props.supportKicker ?? ""} onUpdate={edit("supportKicker")} />
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl tracking-tight max-w-3xl"
                style={{ color: headlineOnDark, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
              >
                <InlineText as="span" value={props.supportHeading} onUpdate={edit("supportHeading")} multiline />
              </h2>
              {(props.supportIntro || isEditor) && (
                <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: darkInk.muted }}>
                  <InlineText as="span" value={props.supportIntro ?? ""} onUpdate={edit("supportIntro")} multiline />
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
                  source="onboarding-hub-support-primary"
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

export default BlockOnboardingHub;
