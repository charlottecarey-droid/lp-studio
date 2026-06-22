import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileText } from "lucide-react";
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
 * 1:1 Account Microsite — type "account-microsite"
 *
 * A premium, buyer-facing ABM page a rep generates for one target account. It
 * reads like a personalized strategy story (not a dashboard, not a generic
 * landing page): a co-brand hero with an "account brief" card (what we know
 * about you), why this matters now, the recommended approach, the use cases
 * that fit this account, the value by persona/role, proof for this buyer,
 * recommended resources, a mutual action plan, the account-team handoff, and a
 * stage/persona-aware close.
 *
 * Personalization is resolved behind the scenes via the page-variable system
 * ({{company_name}}, {{contact_first_name}}, {{industry}}, …) — the visitor
 * never sees controls or raw "Hi {{First Name}}" tokens. Everything is on-brand
 * per tenant (brand-absorbed, contrast-guarded palette) and editable in the
 * builder via InlineText/InlineImage. Single h1 (hero). NO_REVEAL — the block
 * owns its own scroll motion.
 * -------------------------------------------------------------------------- */

export type AccountMicrositeStepStatus = "done" | "in-progress" | "upcoming";

export interface AccountMicrositeBriefItem {
  /** Short label, e.g. "Industry" or "Locations". */
  label: string;
  /** Value — token-friendly, e.g. "{{industry}}" or "120 locations". */
  value: string;
}

export interface AccountMicrositeReason {
  /** A short "why now" headline (1–6 words). */
  title: string;
  /** One sentence of supporting context. */
  detail: string;
}

export interface AccountMicrositePhase {
  /** Phase title, e.g. "Align on outcomes". */
  title: string;
  /** One-sentence description of the phase. */
  detail?: string;
  /** Optional timeframe label, e.g. "Weeks 1–2". */
  timeframe?: string;
}

export interface AccountMicrositeUseCase {
  /** Use-case title, e.g. "Cut order-entry time". */
  title: string;
  /** One- or two-sentence description tailored to the account. */
  detail: string;
  /** Optional outcome figure — editorial string, never live math. */
  metric?: string;
}

export interface AccountMicrositePersonaValue {
  /** Role label, e.g. "Economic buyer" (1–3 words). */
  role: string;
  /** Optional named person, e.g. "Dana Ruiz, VP Finance". */
  name?: string;
  /** What this role gets out of it (one sentence). */
  gets: string;
}

export interface AccountMicrositeCaseStudy {
  /** Optional customer logo URL. */
  logoUrl?: string;
  /** Logo alt / customer name shown when no logo. */
  name: string;
  /** The headline result, e.g. "34% lower cost per order in 90 days". */
  result: string;
  /** A short quote (one or two sentences). */
  quote?: string;
  /** Quote attribution, e.g. "VP Operations, Northwind". */
  attribution?: string;
}

export interface AccountMicrositeLogo {
  /** Customer name (used as alt + wordmark fallback). */
  name: string;
  /** Optional logo image URL. */
  imageUrl?: string;
}

export interface AccountMicrositeResource {
  /** Document title, e.g. "Security & compliance overview". */
  title: string;
  /** Short type label, e.g. "PDF · Security" or "Pricing". */
  type?: string;
  /** Link to the asset. */
  url: string;
}

export interface AccountMicrositePlanStep {
  /** Step title, e.g. "Security review". */
  title: string;
  /** Who owns it — short label, e.g. "IT + procurement". */
  owner?: string;
  /** Target date / timeframe, e.g. "Week of Jun 9". */
  date?: string;
  /** One-sentence description of what happens in this step. */
  detail?: string;
  /** Status drives the timeline marker. */
  status: AccountMicrositeStepStatus;
}

export interface AccountMicrositeTeamMember {
  /** Name, e.g. "Dana Ruiz". */
  name: string;
  /** Role / title, e.g. "Your account executive". */
  role?: string;
  /** Optional one-line note ("Your day-to-day contact"). */
  note?: string;
  /** Optional avatar image URL. */
  avatarUrl?: string;
}

export interface AccountMicrositeBlockProps extends CtaModalConfig, HeroCtaConfig {
  /* ── palette overrides (all optional; brand-derived defaults) ─────────── */
  bgColor?: string;
  inkColor?: string;
  headlineColor?: string;
  accentColor?: string;
  /** Spark — done / next-step states. Defaults to coral. */
  sparkColor?: string;
  /** Dark surface for the close chapter. Deep mix of brand primary. */
  darkColor?: string;
  /** Dark/brand hero surface. Defaults to a deep mix of the brand primary. */
  heroBgColor?: string;
  /** Optional hero image, framed beside the headline (split layout). */
  heroImageUrl?: string;
  heroImageAlt?: string;

  /* ── navbar + hero treatment ──────────────────────────────────────────── */
  heroLayout?: HeroLayout;
  showNavbar?: boolean;
  navLinks?: MicrositeNavLink[];
  navCtaText?: string;
  navCtaUrl?: string;

  /* ── 1. personalized hero ─────────────────────────────────────────────── */
  /** Eyebrow, token-friendly: "Prepared for {{company_name}}". */
  eyebrow: string;
  /** Account name shown in the lockup, e.g. "Acme". */
  accountName: string;
  /** Your company name shown after the × in the lockup. */
  yourName: string;
  accountLogoUrl?: string;
  accountLogoAlt?: string;
  showYourLogo?: boolean;
  yourLogoUrl?: string;
  yourLogoAlt?: string;
  /** The one-line thesis — the page's only h1 (6–14 words). */
  headline: string;
  /** Supporting line under the headline (one sentence, ≤ 28 words). */
  subheadline?: string;

  /* ── 1b. account brief card ───────────────────────────────────────────── */
  showBrief?: boolean;
  briefHeading?: string;
  /** 2–5 label/value rows — "what we know about you". Token-friendly values. */
  briefItems: AccountMicrositeBriefItem[];

  /* ── 2. why this matters now ──────────────────────────────────────────── */
  showWhy?: boolean;
  whyKicker?: string;
  whyHeading: string;
  whyIntro?: string;
  reasons: AccountMicrositeReason[];

  /* ── 3. recommended approach ──────────────────────────────────────────── */
  showApproach?: boolean;
  approachKicker?: string;
  approachHeading: string;
  approachIntro?: string;
  phases: AccountMicrositePhase[];

  /* ── 4. relevant use cases ────────────────────────────────────────────── */
  showUseCases?: boolean;
  useCasesKicker?: string;
  useCasesHeading: string;
  useCasesIntro?: string;
  useCases: AccountMicrositeUseCase[];

  /* ── 5. value by persona ──────────────────────────────────────────────── */
  showPersona?: boolean;
  personaKicker?: string;
  personaHeading: string;
  personaIntro?: string;
  personaValues: AccountMicrositePersonaValue[];

  /* ── 6. proof for this buyer ──────────────────────────────────────────── */
  showProof?: boolean;
  proofKicker?: string;
  proofHeading: string;
  caseStudies: AccountMicrositeCaseStudy[];
  logoWallLabel?: string;
  logos: AccountMicrositeLogo[];

  /* ── 7. recommended resources ─────────────────────────────────────────── */
  showResources?: boolean;
  resourcesKicker?: string;
  resourcesHeading: string;
  resources: AccountMicrositeResource[];

  /* ── 8. mutual action plan ────────────────────────────────────────────── */
  showPlan?: boolean;
  planKicker?: string;
  planHeading: string;
  planIntro?: string;
  planSteps: AccountMicrositePlanStep[];

  /* ── 9. account-team handoff ──────────────────────────────────────────── */
  showTeam?: boolean;
  teamKicker?: string;
  teamHeading: string;
  teamIntro?: string;
  teamMembers: AccountMicrositeTeamMember[];

  /* ── 10. close ────────────────────────────────────────────────────────── */
  showClose?: boolean;
  closeKicker?: string;
  closeHeading: string;
  closeIntro?: string;
  footerNote?: string;
}

export const ACCOUNT_MICROSITE_DEFAULT_PROPS: AccountMicrositeBlockProps = {
  /* hero CTA suite (HeroCtaConfig) */
  ctaText: "Book a working session",
  ctaUrl: "#close",
  ctaAction: "url",
  ctaSecondaryText: "Forward to your team",
  ctaSecondaryUrl: "#",

  /* navbar + hero chrome */
  heroLayout: "split",
  showNavbar: true,
  heroImageUrl:
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1100&h=900&fit=crop",
  heroImageAlt: "Two teams aligning on a shared plan",
  navLinks: [
    { label: "Why now", href: "#why" },
    { label: "The approach", href: "#approach" },
    { label: "Next step", href: "#close" },
  ],
  navCtaText: "Book a working session",
  navCtaUrl: "#close",

  eyebrow: "Prepared for {{company_name}}",
  accountName: "Acme",
  yourName: "Your Co",
  showYourLogo: true,
  headline: "A plan built around where your team is headed.",
  subheadline:
    "We pulled together what we know about your goals, the approach we'd recommend, and the proof it works — so your team can decide together, fast.",

  showBrief: true,
  briefHeading: "What we know about you",
  briefItems: [
    { label: "Industry", value: "Operations & service" },
    { label: "Size", value: "Growing team" },
    { label: "Focus", value: "Reducing manual work" },
    { label: "Timeline", value: "This quarter" },
  ],

  showWhy: true,
  whyKicker: "Why this matters now",
  whyHeading: "The window to move is open.",
  whyIntro:
    "Three things make this the right quarter to act, based on what your team has shared and where the market is heading.",
  reasons: [
    {
      title: "Costs keep climbing",
      detail: "Every quarter of manual work compounds — the savings start the moment you switch.",
    },
    {
      title: "Your team is ready",
      detail: "You already have the process; this removes the friction without a disruptive rollout.",
    },
    {
      title: "A clear runway",
      detail: "Start small this quarter and scale on results, not on a leap of faith.",
    },
  ],

  showApproach: true,
  approachKicker: "Recommended approach",
  approachHeading: "How we'd get you there.",
  approachIntro:
    "A staged path that proves value early and scales on results — no big-bang rollout.",
  phases: [
    {
      title: "Align on outcomes",
      timeframe: "Weeks 1–2",
      detail: "Agree the success criteria and the one workflow we prove first.",
    },
    {
      title: "Run a focused pilot",
      timeframe: "Weeks 3–6",
      detail: "Go live with one team, measured against the baseline we set together.",
    },
    {
      title: "Review & expand",
      timeframe: "Weeks 7–8",
      detail: "Take the results to your sponsor and plan the rollout that fits.",
    },
  ],

  showUseCases: true,
  useCasesKicker: "Where it fits",
  useCasesHeading: "The use cases that match your team.",
  useCasesIntro:
    "The places we'd expect the biggest, fastest wins for an organization like yours.",
  useCases: [
    {
      title: "Faster order entry",
      detail: "Replace the manual steps that slow your team down every single day.",
      metric: "Hours back / week",
    },
    {
      title: "Fewer errors",
      detail: "Catch issues before they cost you, with checks built into the flow.",
      metric: "Lower rework",
    },
    {
      title: "Clear visibility",
      detail: "Everyone sees status in one place, so nothing slips between teams.",
      metric: "One source of truth",
    },
  ],

  showPersona: true,
  personaKicker: "Value for your team",
  personaHeading: "What each person gets out of this.",
  personaIntro:
    "A decision moves when everyone sees their own win. Here's the value by role.",
  personaValues: [
    {
      role: "Economic buyer",
      gets: "Payback inside the year and a return that clears the bar, with the math on the record.",
    },
    {
      role: "Technical lead",
      gets: "Security, SSO, and native integrations — reviewed before sign-off.",
    },
    {
      role: "End users",
      gets: "Hours back every week and an end to the rework, with a guided rollout.",
    },
  ],

  showProof: true,
  proofKicker: "Proof for this buyer",
  proofHeading: "Teams like yours, already there.",
  caseStudies: [
    {
      name: "Northwind",
      result: "34% lower cost per order within 90 days",
      quote:
        "We expected a six-month slog. We were measuring savings by week four, and the rollout never fought our team.",
      attribution: "VP Operations, Northwind",
    },
    {
      name: "Vertex Logistics",
      result: "4.1× faster exception resolution",
      quote:
        "Escalations used to disappear into shared inboxes. Now every one has an owner and a clock.",
      attribution: "Director of Support, Vertex Logistics",
    },
  ],
  logoWallLabel: "In good company",
  logos: [
    { name: "Acme Corp" },
    { name: "Northwind" },
    { name: "Globex" },
    { name: "Initech" },
    { name: "Vertex" },
  ],

  showResources: true,
  resourcesKicker: "Recommended resources",
  resourcesHeading: "The docs your team will ask for.",
  resources: [
    { title: "Security & compliance overview", type: "PDF · Security", url: "#" },
    { title: "Pricing & packaging", type: "PDF · Pricing", url: "#" },
    { title: "Implementation plan", type: "PDF · Onboarding", url: "#" },
  ],

  showPlan: true,
  planKicker: "Mutual action plan",
  planHeading: "The steps to a decision — owners and dates.",
  planIntro:
    "A shared plan beats a sales pitch. Here's what we move through together, who owns each step, and when it lands.",
  planSteps: [
    {
      title: "Discovery & alignment",
      owner: "Both teams",
      date: "Done",
      detail: "Success criteria and scope agreed in a working session.",
      status: "done",
    },
    {
      title: "Security review",
      owner: "Your IT",
      date: "This week",
      detail: "Security package and architecture review with your team.",
      status: "in-progress",
    },
    {
      title: "Pilot",
      owner: "Both teams",
      date: "Weeks 3–6",
      detail: "One live workflow, measured against the baseline we set.",
      status: "upcoming",
    },
    {
      title: "Executive review",
      owner: "Your sponsor",
      date: "Week 7",
      detail: "Pilot results to the committee; rollout plan on the table.",
      status: "upcoming",
    },
  ],

  showTeam: true,
  teamKicker: "Your team",
  teamHeading: "The people behind this — start to finish.",
  teamIntro:
    "You're not handed off to a queue. Here's who you'll work with and how to reach them.",
  teamMembers: [
    { name: "Your account executive", role: "Your main point of contact", note: "Owns the plan with you." },
    { name: "Solutions engineer", role: "Technical partner", note: "Handles the security review and setup." },
    { name: "Customer success", role: "Onboarding lead", note: "Gets your team live and measuring." },
  ],

  showClose: true,
  closeKicker: "Next step",
  closeHeading: "Ready to move? Let's book it.",
  closeIntro:
    "Pick a time that works for your team and we'll walk the plan together. Bring whoever needs to be in the room.",
  footerNote: "Prepared for your team's internal review. Details refined together as we go.",
};

interface Props {
  props: AccountMicrositeBlockProps;
  /** Tenant brand config — drives default palette, fonts, and the your-logo. */
  brand?: BrandConfig;
  /** Optional CTA click handler (analytics / builder preview) for url-mode CTAs. */
  onCtaClick?: () => void;
  /** Builder inline-edit hook. When present, key copy is click-to-edit. */
  onFieldChange?: (updated: AccountMicrositeBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

/* ── block ───────────────────────────────────────────────────────────────── */

export function BlockAccountMicrosite({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  pageId,
  variantId,
}: Props) {
  const reduced = useReducedMotion() ?? false;

  /* — palette (brand-absorbed, contrast-guarded) — */
  const bg =
    props.bgColor && isValidHex(props.bgColor)
      ? props.bgColor
      : brand?.pageBackground && isValidHex(brand.pageBackground)
        ? brand.pageBackground
        : "#F7F5F0";
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

  const sparkRaw =
    props.sparkColor && isValidHex(props.sparkColor) ? props.sparkColor : "#E26B4F";
  const sparkText = pickContrastingColor(sparkRaw, bg, [accentText], 4.5);
  const sparkChrome = ensureAccentRegisters(sparkRaw, { base: bg }, 1.8);

  const primaryHex =
    brand?.primaryColor && isValidHex(brand.primaryColor) ? brand.primaryColor : "#1B1840";
  const dark =
    props.darkColor && isValidHex(props.darkColor)
      ? props.darkColor
      : mixHex(primaryHex, "#12102E", 0.4);
  const darkInk = resolveSectionInk({}, { base: dark });
  const accentOnDark = pickContrastingColor(accentRaw, dark, [darkInk.text], 4.5);
  const headlineOnDark = pickContrastingColor(
    brand?.headingOnDarkColor,
    dark,
    [accentOnDark, darkInk.text],
    4.5,
  );

  /* — dark/brand HERO surface — */
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

  /* — tinted chapter band (persona value) — */
  const bandBg = mixHex(accentChrome, bg, surfaceIsDark ? 0.1 : 0.06);
  const bandInk = resolveSectionInk({ textColor: props.inkColor }, { base: bandBg });
  const bandHeadline = pickContrastingColor(
    props.headlineColor,
    bandBg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#1B1840", bandInk.text],
    4.5,
  );

  /* — CTA pair colors on the dark close strip — */
  const ctaBg = pickContrastingColor(
    brand?.ctaBackground,
    dark,
    [accentRaw, brand?.primaryColor, "#FFFFFF"],
    3.0,
  );
  const ctaTextColor = pickContrastingColor(brand?.ctaText, ctaBg, [contrastTextColor(ctaBg)], 4.5);

  const set = onFieldChange
    ? <K extends keyof AccountMicrositeBlockProps>(key: K, value: AccountMicrositeBlockProps[K]) =>
        onFieldChange({ ...props, [key]: value })
    : undefined;
  const edit = (key: keyof AccountMicrositeBlockProps) =>
    set ? (v: string) => set(key, v as never) : undefined;

  /* — visibility (after content checks) — */
  const showBrief = props.showBrief !== false && props.briefItems.length > 0;
  const showWhy = props.showWhy !== false && props.reasons.length > 0;
  const showApproach = props.showApproach !== false && props.phases.length > 0;
  const showUseCases = props.showUseCases !== false && props.useCases.length > 0;
  const showPersona = props.showPersona !== false && props.personaValues.length > 0;
  const showProof =
    props.showProof !== false && (props.caseStudies.length > 0 || props.logos.length > 0);
  const showResources = props.showResources !== false && props.resources.length > 0;
  const showPlan = props.showPlan !== false && props.planSteps.length > 0;
  const showTeam = props.showTeam !== false && props.teamMembers.length > 0;
  const showClose = props.showClose !== false;

  let sectionNo = 0;
  const nextNo = () => String(++sectionNo).padStart(2, "0");

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
  const setBriefItem = set
    ? (i: number, patch: Partial<AccountMicrositeBriefItem>) =>
        set("briefItems", props.briefItems.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setReason = set
    ? (i: number, patch: Partial<AccountMicrositeReason>) =>
        set("reasons", props.reasons.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setPhase = set
    ? (i: number, patch: Partial<AccountMicrositePhase>) =>
        set("phases", props.phases.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setUseCase = set
    ? (i: number, patch: Partial<AccountMicrositeUseCase>) =>
        set("useCases", props.useCases.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setPersona = set
    ? (i: number, patch: Partial<AccountMicrositePersonaValue>) =>
        set("personaValues", props.personaValues.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setCaseStudy = set
    ? (i: number, patch: Partial<AccountMicrositeCaseStudy>) =>
        set("caseStudies", props.caseStudies.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setResource = set
    ? (i: number, patch: Partial<AccountMicrositeResource>) =>
        set("resources", props.resources.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setStep = set
    ? (i: number, patch: Partial<AccountMicrositePlanStep>) =>
        set("planSteps", props.planSteps.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setMember = set
    ? (i: number, patch: Partial<AccountMicrositeTeamMember>) =>
        set("teamMembers", props.teamMembers.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;

  const hasYourLogo =
    props.showYourLogo !== false && !!brand && brandHasLogo(brand, props.yourLogoUrl);
  const isEditor = !!onFieldChange;

  /* — navbar + hero layout — */
  const hasHeroImage = !!props.heroImageUrl || isEditor;
  const showNavbar = props.showNavbar !== false;
  const heroLayout = resolveHeroLayout(props.heroLayout, hasHeroImage, "split");
  const navLinks = props.navLinks ?? ACCOUNT_MICROSITE_DEFAULT_PROPS.navLinks ?? [];
  const navCtaLabel = props.navCtaText ?? props.ctaText;
  const navCtaHref = props.navCtaUrl || props.ctaUrl || "#close";
  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href.length < 2) return;
    const target = typeof document !== "undefined" ? document.getElementById(href.slice(1)) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const hairline = mixHex(ink.text, bg, 0.12);
  const cardHairline = mixHex(cardInk.text, cardBg, 0.12);

  /* — shared section header (mono numbered marker + rule + kicker + h2) — */
  const SectionHead = ({
    no,
    kicker,
    kickerKey,
    heading,
    headingKey,
    intro,
    introKey,
    tones,
  }: {
    no: string;
    kicker?: string;
    kickerKey: keyof AccountMicrositeBlockProps;
    heading: string;
    headingKey: keyof AccountMicrositeBlockProps;
    intro?: string;
    introKey?: keyof AccountMicrositeBlockProps;
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
      {(intro || (isEditor && introKey)) && introKey && (
        <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: tones.muted }}>
          <InlineText as="span" value={intro ?? ""} onUpdate={edit(introKey)} multiline />
        </p>
      )}
    </motion.div>
  );

  const lightTones = {
    muted: ink.muted,
    rule: accentChrome,
    kicker: accentText,
    heading: headline,
  };
  const bandTones = {
    muted: bandInk.muted,
    rule: accentChrome,
    kicker: pickContrastingColor(accentRaw, bandBg, [bandHeadline, bandInk.text], 4.5),
    heading: bandHeadline,
  };

  const sectionPad = "py-16 sm:py-20 lg:py-24";
  const shell = "mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10";

  const cardStyle: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${cardHairline}`,
    borderRadius: 16,
  };

  return (
    <div className="am-root" style={{ background: bg, color: ink.text, fontFamily: BODY }}>
      <style>{`
        .am-root { position: relative; }
        .am-card {
          transition: transform 0.3s cubic-bezier(.16,1,.3,1),
                      box-shadow 0.3s cubic-bezier(.16,1,.3,1);
        }
        .am-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 40px -26px rgba(27, 24, 64, 0.4);
        }
        @media (prefers-reduced-motion: reduce) {
          .am-card, .am-card:hover { transition: none; transform: none; }
        }
      `}</style>

      {/* ── 1. PERSONALIZED HERO ─────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden"
        style={{ background: heroBg, color: heroInk.text }}
      >
        <DarkHeroBackdrop
          surface={heroBg}
          accent={accentRaw}
          primary={primaryHex}
          isStatic={reduced || isEditor}
          idPrefix="am-hero"
        >
          {heroLayout === "image-overlay" && props.heroImageUrl && (
            <>
              <img
                src={props.heroImageUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
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
            logoUrl={props.yourLogoUrl}
            logoAlt={props.yourLogoAlt}
            accountLogoUrl={props.accountLogoUrl}
            accountLogoAlt={props.accountLogoAlt || props.accountName}
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
          <motion.div
            {...fadeUp()}
            className={
              heroLayout === "split" && hasHeroImage
                ? "grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12"
                : undefined
            }
          >
            <div className={heroLayout === "split" && hasHeroImage ? "lg:col-span-7" : "max-w-3xl"}>
              <span className={kickerClass} style={{ color: heroAccent }}>
                <InlineText as="span" value={props.eyebrow} onUpdate={edit("eyebrow")} />
              </span>

              {/* Account × Your-Co lockup */}
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                {(props.accountLogoUrl || isEditor) && (
                  <span className="inline-flex items-center">
                    <InlineImage
                      src={props.accountLogoUrl ?? ""}
                      alt={props.accountLogoAlt || props.accountName || "Account logo"}
                      wrapperClassName="inline-block"
                      className="h-8 sm:h-9 w-auto object-contain"
                      onUpdate={edit("accountLogoUrl")}
                      onAltUpdate={edit("accountLogoAlt")}
                    />
                  </span>
                )}
                {!props.accountLogoUrl && !isEditor && (
                  <span
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ color: heroHeadline, fontFamily: DISPLAY }}
                  >
                    {props.accountName}
                  </span>
                )}
                <span
                  className="text-2xl sm:text-3xl font-light leading-none"
                  style={{ color: heroInk.muted }}
                  aria-hidden
                >
                  ×
                </span>
                {hasYourLogo && brand ? (
                  <BrandLogo
                    brand={brand}
                    url={props.yourLogoUrl}
                    alt={props.yourLogoAlt || brand.brandName || props.yourName || "Logo"}
                    tone="onDark"
                    autoContrast
                    className="h-8 sm:h-9 w-auto"
                  />
                ) : (
                  <span
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ color: heroHeadline, fontFamily: DISPLAY }}
                  >
                    <InlineText as="span" value={props.yourName} onUpdate={edit("yourName")} />
                  </span>
                )}
              </div>

              <h1
                className="mt-8 text-4xl leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl"
                style={{
                  color: heroHeadline,
                  fontFamily: DISPLAY,
                  fontWeight: "var(--brand-heading-weight, 700)" as never,
                }}
              >
                <InlineText as="span" value={props.headline} onUpdate={edit("headline")} multiline />
              </h1>
              {(props.subheadline || isEditor) && (
                <p className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: heroInk.muted }}>
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
                  source="account-microsite-hero-primary"
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
                    style={{ color: heroInk.text, border: `1px solid ${mixHex(heroInk.text, heroBg, 0.6)}` }}
                  >
                    <InlineText as="span" value={props.ctaSecondaryText ?? ""} onUpdate={edit("ctaSecondaryText")} />
                  </a>
                )}
              </div>
            </div>

            {heroLayout === "split" && hasHeroImage && (
              <div className="lg:col-span-5">
                <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${mixHex(heroInk.text, heroBg, 0.7)}` }}>
                  <InlineImage
                    src={props.heroImageUrl ?? ""}
                    alt={props.heroImageAlt || ""}
                    wrapperClassName="block"
                    className="h-full w-full object-cover"
                    onUpdate={edit("heroImageUrl")}
                    onAltUpdate={edit("heroImageAlt")}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </header>

      {/* ── 1b. ACCOUNT BRIEF CARD ───────────────────────────────────────── */}
      {showBrief && (
        <section className={shell} style={{ marginTop: "-2.5rem", position: "relative", zIndex: 10 }}>
          <motion.div {...fadeUp()} className="am-card p-6 sm:p-8" style={cardStyle}>
            <div className={`${kickerClass} mb-5`} style={{ color: accentText }}>
              <InlineText as="span" value={props.briefHeading ?? ""} onUpdate={edit("briefHeading")} />
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              {props.briefItems.map((item, i) => (
                <div key={i}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1.5" style={{ color: cardInk.muted }}>
                    <InlineText
                      as="span"
                      value={item.label}
                      onUpdate={setBriefItem ? (v) => setBriefItem(i, { label: v }) : undefined}
                    />
                  </dt>
                  <dd className="text-lg font-semibold tracking-tight" style={{ color: headlineOnCard, fontFamily: DISPLAY }}>
                    <InlineText
                      as="span"
                      value={item.value}
                      onUpdate={setBriefItem ? (v) => setBriefItem(i, { value: v }) : undefined}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </section>
      )}

      {/* ── 2. WHY THIS MATTERS NOW ──────────────────────────────────────── */}
      {showWhy && (
        <section id="why" className={`${shell} ${sectionPad}`}>
          <SectionHead
            no={nextNo()}
            kicker={props.whyKicker}
            kickerKey="whyKicker"
            heading={props.whyHeading}
            headingKey="whyHeading"
            intro={props.whyIntro}
            introKey="whyIntro"
            tones={lightTones}
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {props.reasons.map((r, i) => (
              <motion.div key={i} {...fadeUp(i * 0.06)} className="am-card p-6" style={cardStyle}>
                <div
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums"
                  style={{ background: mixHex(accentChrome, cardBg, 0.12), color: accentText, fontFamily: NUMBERS }}
                >
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold tracking-tight" style={{ color: headlineOnCard, fontFamily: DISPLAY }}>
                  <InlineText as="span" value={r.title} onUpdate={setReason ? (v) => setReason(i, { title: v }) : undefined} multiline />
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: cardInk.muted }}>
                  <InlineText as="span" value={r.detail} onUpdate={setReason ? (v) => setReason(i, { detail: v }) : undefined} multiline />
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. RECOMMENDED APPROACH ──────────────────────────────────────── */}
      {showApproach && (
        <section id="approach" className={`${shell} ${sectionPad}`} style={{ borderTop: `1px solid ${hairline}` }}>
          <SectionHead
            no={nextNo()}
            kicker={props.approachKicker}
            kickerKey="approachKicker"
            heading={props.approachHeading}
            headingKey="approachHeading"
            intro={props.approachIntro}
            introKey="approachIntro"
            tones={lightTones}
          />
          <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {props.phases.map((p, i) => (
              <motion.li key={i} {...fadeUp(i * 0.06)} className="am-card p-6" style={cardStyle}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold tabular-nums" style={{ color: accentText, fontFamily: NUMBERS }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {(p.timeframe || isEditor) && (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: cardInk.muted }}>
                      <InlineText as="span" value={p.timeframe ?? ""} onUpdate={setPhase ? (v) => setPhase(i, { timeframe: v }) : undefined} />
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight" style={{ color: headlineOnCard, fontFamily: DISPLAY }}>
                  <InlineText as="span" value={p.title} onUpdate={setPhase ? (v) => setPhase(i, { title: v }) : undefined} multiline />
                </h3>
                {(p.detail || isEditor) && (
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: cardInk.muted }}>
                    <InlineText as="span" value={p.detail ?? ""} onUpdate={setPhase ? (v) => setPhase(i, { detail: v }) : undefined} multiline />
                  </p>
                )}
              </motion.li>
            ))}
          </ol>
        </section>
      )}

      {/* ── 4. RELEVANT USE CASES ────────────────────────────────────────── */}
      {showUseCases && (
        <section className={`${shell} ${sectionPad}`} style={{ borderTop: `1px solid ${hairline}` }}>
          <SectionHead
            no={nextNo()}
            kicker={props.useCasesKicker}
            kickerKey="useCasesKicker"
            heading={props.useCasesHeading}
            headingKey="useCasesHeading"
            intro={props.useCasesIntro}
            introKey="useCasesIntro"
            tones={lightTones}
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {props.useCases.map((u, i) => (
              <motion.div key={i} {...fadeUp(i * 0.06)} className="am-card p-6" style={cardStyle}>
                <h3 className="text-lg font-semibold tracking-tight" style={{ color: headlineOnCard, fontFamily: DISPLAY }}>
                  <InlineText as="span" value={u.title} onUpdate={setUseCase ? (v) => setUseCase(i, { title: v }) : undefined} multiline />
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: cardInk.muted }}>
                  <InlineText as="span" value={u.detail} onUpdate={setUseCase ? (v) => setUseCase(i, { detail: v }) : undefined} multiline />
                </p>
                {(u.metric || isEditor) && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: mixHex(accentChrome, cardBg, 0.1), color: accentText }}>
                    <InlineText as="span" value={u.metric ?? ""} onUpdate={setUseCase ? (v) => setUseCase(i, { metric: v }) : undefined} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. VALUE BY PERSONA (tinted band) ────────────────────────────── */}
      {showPersona && (
        <section style={{ background: bandBg, color: bandInk.text }}>
          <div className={`${shell} ${sectionPad}`}>
            <SectionHead
              no={nextNo()}
              kicker={props.personaKicker}
              kickerKey="personaKicker"
              heading={props.personaHeading}
              headingKey="personaHeading"
              intro={props.personaIntro}
              introKey="personaIntro"
              tones={bandTones}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {props.personaValues.map((pv, i) => (
                <motion.div key={i} {...fadeUp(i * 0.06)} className="am-card p-6" style={cardStyle}>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accentText }}>
                    <InlineText as="span" value={pv.role} onUpdate={setPersona ? (v) => setPersona(i, { role: v }) : undefined} />
                  </div>
                  {(pv.name || isEditor) && (
                    <div className="mt-1 text-sm font-semibold" style={{ color: headlineOnCard }}>
                      <InlineText as="span" value={pv.name ?? ""} onUpdate={setPersona ? (v) => setPersona(i, { name: v }) : undefined} />
                    </div>
                  )}
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: cardInk.muted }}>
                    <InlineText as="span" value={pv.gets} onUpdate={setPersona ? (v) => setPersona(i, { gets: v }) : undefined} multiline />
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. PROOF FOR THIS BUYER ──────────────────────────────────────── */}
      {showProof && (
        <section className={`${shell} ${sectionPad}`} style={{ borderTop: `1px solid ${hairline}` }}>
          <SectionHead
            no={nextNo()}
            kicker={props.proofKicker}
            kickerKey="proofKicker"
            heading={props.proofHeading}
            headingKey="proofHeading"
            tones={lightTones}
          />
          {props.caseStudies.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {props.caseStudies.map((c, i) => (
                <motion.div key={i} {...fadeUp(i * 0.06)} className="am-card p-6 sm:p-8" style={cardStyle}>
                  {(c.logoUrl || isEditor) && (
                    <InlineImage
                      src={c.logoUrl ?? ""}
                      alt={c.name || "Customer logo"}
                      wrapperClassName="inline-block mb-4"
                      className="h-7 w-auto object-contain"
                      onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { logoUrl: v }) : undefined}
                    />
                  )}
                  <div className="text-xl font-semibold tracking-tight" style={{ color: headlineOnCard, fontFamily: DISPLAY }}>
                    <InlineText as="span" value={c.result} onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { result: v }) : undefined} multiline />
                  </div>
                  {(c.quote || isEditor) && (
                    <p className="mt-4 text-sm leading-relaxed" style={{ color: cardInk.muted }}>
                      <InlineText as="span" value={c.quote ?? ""} onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { quote: v }) : undefined} multiline />
                    </p>
                  )}
                  {(c.attribution || isEditor) && (
                    <div className="mt-3 text-xs font-semibold" style={{ color: accentText }}>
                      <InlineText as="span" value={c.attribution ?? ""} onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { attribution: v }) : undefined} />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
          {props.logos.length > 0 && (
            <motion.div {...fadeUp(0.1)} className="mt-10">
              {(props.logoWallLabel || isEditor) && (
                <div className={`${kickerClass} mb-4`} style={{ color: ink.muted }}>
                  <InlineText as="span" value={props.logoWallLabel ?? ""} onUpdate={edit("logoWallLabel")} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                {props.logos.map((l, i) =>
                  l.imageUrl ? (
                    <img key={i} src={l.imageUrl} alt={l.name} className="h-7 w-auto object-contain opacity-80" loading="lazy" />
                  ) : (
                    <span key={i} className="text-base font-semibold tracking-tight" style={{ color: mixHex(ink.text, bg, 0.4), fontFamily: DISPLAY }}>
                      {l.name}
                    </span>
                  ),
                )}
              </div>
            </motion.div>
          )}
        </section>
      )}

      {/* ── 7. RECOMMENDED RESOURCES ─────────────────────────────────────── */}
      {showResources && (
        <section className={`${shell} ${sectionPad}`} style={{ borderTop: `1px solid ${hairline}` }}>
          <SectionHead
            no={nextNo()}
            kicker={props.resourcesKicker}
            kickerKey="resourcesKicker"
            heading={props.resourcesHeading}
            headingKey="resourcesHeading"
            tones={lightTones}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.resources.map((r, i) => (
              <motion.a
                key={i}
                {...fadeUp(i * 0.05)}
                href={r.url || "#"}
                target={r.url && !r.url.startsWith("#") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`am-card flex items-start gap-3 p-5 ${focusable}`}
                style={cardStyle}
              >
                <span
                  className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg"
                  style={{ background: mixHex(accentChrome, cardBg, 0.12), color: accentText }}
                >
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-tight" style={{ color: headlineOnCard }}>
                    <InlineText as="span" value={r.title} onUpdate={setResource ? (v) => setResource(i, { title: v }) : undefined} />
                  </span>
                  {(r.type || isEditor) && (
                    <span className="mt-0.5 block text-xs" style={{ color: cardInk.muted }}>
                      <InlineText as="span" value={r.type ?? ""} onUpdate={setResource ? (v) => setResource(i, { type: v }) : undefined} />
                    </span>
                  )}
                </span>
              </motion.a>
            ))}
          </div>
        </section>
      )}

      {/* ── 8. MUTUAL ACTION PLAN ────────────────────────────────────────── */}
      {showPlan && (
        <section id="plan" className={`${shell} ${sectionPad}`} style={{ borderTop: `1px solid ${hairline}` }}>
          <SectionHead
            no={nextNo()}
            kicker={props.planKicker}
            kickerKey="planKicker"
            heading={props.planHeading}
            headingKey="planHeading"
            intro={props.planIntro}
            introKey="planIntro"
            tones={lightTones}
          />
          <ol className="relative">
            {props.planSteps.map((s, i) => {
              const isDone = s.status === "done";
              const isActive = s.status === "in-progress";
              const markerBg = isDone ? sparkChrome : isActive ? accentChrome : cardBg;
              const markerInk = isDone
                ? pickContrastingColor(undefined, sparkChrome, ["#FFFFFF", "#000000"], 4.5)
                : isActive
                  ? pickContrastingColor(undefined, accentChrome, ["#FFFFFF", "#000000"], 4.5)
                  : ink.muted;
              const isLast = i === props.planSteps.length - 1;
              return (
                <motion.li key={i} {...fadeUp(i * 0.05)} className="relative flex gap-5 pb-8 last:pb-0">
                  {!isLast && (
                    <span aria-hidden className="absolute left-[17px] top-9 bottom-0 w-px" style={{ background: hairline }} />
                  )}
                  <span
                    className="relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold tabular-nums"
                    style={{ background: markerBg, color: markerInk, border: isDone || isActive ? "none" : `1px solid ${hairline}` }}
                  >
                    {isDone ? <Check className="h-4 w-4" aria-hidden /> : String(i + 1)}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-base font-semibold tracking-tight" style={{ color: headline, fontFamily: DISPLAY }}>
                        <InlineText as="span" value={s.title} onUpdate={setStep ? (v) => setStep(i, { title: v }) : undefined} />
                      </h3>
                      {(s.date || isEditor) && (
                        <span className="text-xs font-semibold" style={{ color: isDone ? sparkText : accentText }}>
                          <InlineText as="span" value={s.date ?? ""} onUpdate={setStep ? (v) => setStep(i, { date: v }) : undefined} />
                        </span>
                      )}
                    </div>
                    {(s.owner || isEditor) && (
                      <div className="mt-0.5 text-xs uppercase tracking-[0.12em]" style={{ color: ink.muted }}>
                        <InlineText as="span" value={s.owner ?? ""} onUpdate={setStep ? (v) => setStep(i, { owner: v }) : undefined} />
                      </div>
                    )}
                    {(s.detail || isEditor) && (
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: ink.muted }}>
                        <InlineText as="span" value={s.detail ?? ""} onUpdate={setStep ? (v) => setStep(i, { detail: v }) : undefined} multiline />
                      </p>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ── 9. ACCOUNT-TEAM HANDOFF (tinted band) ────────────────────────── */}
      {showTeam && (
        <section style={{ background: bandBg, color: bandInk.text }}>
          <div className={`${shell} ${sectionPad}`}>
            <SectionHead
              no={nextNo()}
              kicker={props.teamKicker}
              kickerKey="teamKicker"
              heading={props.teamHeading}
              headingKey="teamHeading"
              intro={props.teamIntro}
              introKey="teamIntro"
              tones={bandTones}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {props.teamMembers.map((m, i) => (
                <motion.div key={i} {...fadeUp(i * 0.06)} className="am-card flex items-start gap-4 p-6" style={cardStyle}>
                  <span className="h-12 w-12 flex-none overflow-hidden rounded-full" style={{ background: mixHex(accentChrome, cardBg, 0.12) }}>
                    {(m.avatarUrl || isEditor) && (
                      <InlineImage
                        src={m.avatarUrl ?? ""}
                        alt={m.name || "Team member"}
                        wrapperClassName="block h-12 w-12"
                        className="h-12 w-12 object-cover"
                        onUpdate={setMember ? (v) => setMember(i, { avatarUrl: v }) : undefined}
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tracking-tight" style={{ color: headlineOnCard, fontFamily: DISPLAY }}>
                      <InlineText as="span" value={m.name} onUpdate={setMember ? (v) => setMember(i, { name: v }) : undefined} />
                    </div>
                    {(m.role || isEditor) && (
                      <div className="text-xs font-semibold" style={{ color: accentText }}>
                        <InlineText as="span" value={m.role ?? ""} onUpdate={setMember ? (v) => setMember(i, { role: v }) : undefined} />
                      </div>
                    )}
                    {(m.note || isEditor) && (
                      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: cardInk.muted }}>
                        <InlineText as="span" value={m.note ?? ""} onUpdate={setMember ? (v) => setMember(i, { note: v }) : undefined} multiline />
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 10. CLOSE (dark) ─────────────────────────────────────────────── */}
      {showClose && (
        <section id="close" className="relative overflow-hidden" style={{ background: dark, color: darkInk.text }}>
          <DarkHeroBackdrop
            surface={dark}
            accent={accentRaw}
            primary={primaryHex}
            isStatic={reduced || isEditor}
            idPrefix="am-close"
          />
          <div className={`relative z-10 ${shell} ${sectionPad} text-center`}>
            <motion.div {...fadeUp()} className="mx-auto max-w-2xl">
              <span className={kickerClass} style={{ color: accentOnDark }}>
                <InlineText as="span" value={props.closeKicker ?? ""} onUpdate={edit("closeKicker")} />
              </span>
              <h2
                className="mt-4 text-3xl tracking-tight sm:text-4xl lg:text-5xl"
                style={{ color: headlineOnDark, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
              >
                <InlineText as="span" value={props.closeHeading} onUpdate={edit("closeHeading")} multiline />
              </h2>
              {(props.closeIntro || isEditor) && (
                <p className="mt-5 text-base leading-relaxed sm:text-lg" style={{ color: darkInk.muted }}>
                  <InlineText as="span" value={props.closeIntro ?? ""} onUpdate={edit("closeIntro")} multiline />
                </p>
              )}
              <div className="mt-9 flex justify-center">
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
                  source="account-microsite-close"
                  className={`inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold tracking-wide rounded-xl transition-opacity hover:opacity-90 ${focusable}`}
                  style={{ background: ctaBg, color: ctaTextColor }}
                >
                  <InlineText as="span" value={props.ctaText} onUpdate={edit("ctaText")} />
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </CtaButton>
              </div>
              {(props.footerNote || isEditor) && (
                <p className="mt-8 text-xs" style={{ color: mixHex(darkInk.text, dark, 0.5) }}>
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
