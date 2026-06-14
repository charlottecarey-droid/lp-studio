import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
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
 * Deal Room — type "deal-room"
 *
 * ABM deal-acceleration microsite. A personalized page a champion shares
 * internally to move a deal forward: an account × vendor lockup hero, a mutual
 * action plan timeline with owners/dates and done/in-progress/upcoming states,
 * the per-account business case (investment vs. return + payback, count-up on a
 * dark aurora chapter), a stakeholder map, matched proof + a logo wall, linked
 * resource docs, objection-handling FAQ, and a clear scheduling close.
 *
 * The "shared workspace" register: cream canvas with paper grain, white cards
 * with ink-hairline + warm shadow, mono numbered section markers, indigo for
 * actions, coral spark reserved for "done"/"next-step" states, slow aurora on
 * the dark business-case chapter, count-up ROI. All figures are editorial
 * strings, never live math. Single h1 (hero). NO_REVEAL — owns its own motion.
 *
 * CTAs (hero primary + close) use the shared CtaModalConfig + HeroCtaConfig
 * mixin + the CtaButton suite, so a future "copy CTA config to all" can target
 * them uniformly.
 * -------------------------------------------------------------------------- */

export type DealRoomStepStatus = "done" | "in-progress" | "upcoming";

export interface DealRoomMapStep {
  /** Step title, e.g. "Security review" (1–4 words). */
  title: string;
  /** Who owns it — short label, e.g. "IT + procurement". */
  owner?: string;
  /** Target date / timeframe, e.g. "Week of Jun 9" or "Weeks 3–4". */
  date?: string;
  /** One-sentence description of what happens in this step. */
  detail?: string;
  /** Status drives the marker: coral spark on "done", filled on "in-progress". */
  status: DealRoomStepStatus;
}

export interface DealRoomLineItem {
  label: string;
  /** Display figure, e.g. "$120,000 / yr" — rendered tabular, right-aligned. */
  value: string;
}

export interface DealRoomStakeholder {
  /** Role label, e.g. "Economic buyer" (1–3 words). */
  role: string;
  /** Optional named person, e.g. "Dana Ruiz, VP Finance". */
  name?: string;
  /** What this role gets out of the deal (one sentence). */
  gets: string;
  /** Optional avatar image URL. */
  avatarUrl?: string;
}

export interface DealRoomCaseStudy {
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

export interface DealRoomLogo {
  /** Customer name (used as alt + wordmark fallback). */
  name: string;
  /** Optional logo image URL. */
  imageUrl?: string;
}

export interface DealRoomResource {
  /** Document title, e.g. "Security & compliance overview". */
  title: string;
  /** Short type label, e.g. "PDF · Security" or "Pricing". */
  type?: string;
  /** Link to the asset. */
  url: string;
}

export interface DealRoomFaq {
  question: string;
  answer: string;
}

export interface DealRoomBlockProps extends CtaModalConfig, HeroCtaConfig {
  /* ── palette overrides (all optional; brand-derived defaults) ─────────── */
  /** Page surface. Defaults to the brand page background (or warm cream). */
  bgColor?: string;
  /** Body text override — only honored when it meets AA on the surface. */
  inkColor?: string;
  /** Display-heading ink. Defaults to brand heading-on-light / deep indigo. */
  headlineColor?: string;
  /** Accent — markers, links, actions. Defaults to the brand accent / indigo. */
  accentColor?: string;
  /** Spark — done / next-step states. Defaults to coral. */
  sparkColor?: string;
  /** Business-case dark surface. Defaults to a deep-indigo mix of brand primary. */
  darkColor?: string;
  /** Dark/brand hero surface (the deal-room band). Defaults to a deep mix of the
   *  brand primary so the page opens on a distinct branded hero, never white. */
  heroBgColor?: string;
  /** Optional hero image, framed beside the headline (split layout). Empty =
   *  the hero runs as a dark headline band. */
  heroImageUrl?: string;
  heroImageAlt?: string;

  /* ── navbar + hero treatment (design-system chrome) ───────────────────── */
  /** Hero layout. "split" = dark brand panel beside the hero image;
   *  "image-overlay" = full-bleed image + brand scrim; "dark" = a dark headline
   *  band. Defaults to "split" when a hero image is set, else "dark". Never white. */
  heroLayout?: HeroLayout;
  /** Show the slim top navbar over the hero. Default true. */
  showNavbar?: boolean;
  /** 0–4 navbar anchor links (scroll to page sections). */
  navLinks?: MicrositeNavLink[];
  /** Navbar CTA label. Defaults to the hero CTA (ctaText). */
  navCtaText?: string;
  /** Navbar CTA href. Defaults to the hero CTA url. */
  navCtaUrl?: string;

  /* ── 1. personalized hero ─────────────────────────────────────────────── */
  /** Eyebrow, personalization-token friendly: "Deal room for {{company_name}}". */
  eyebrow: string;
  /** Account name shown in the lockup, e.g. "Acme". */
  accountName: string;
  /** Your company name shown after the × in the lockup. */
  yourName: string;
  /** Optional account logo URL (shown left of the ×). */
  accountLogoUrl?: string;
  accountLogoAlt?: string;
  /** Show your (tenant brand) logo right of the ×. Default true (hidden if none). */
  showYourLogo?: boolean;
  /** Your-logo override URL; falls back to the tenant brand logo. */
  yourLogoUrl?: string;
  yourLogoAlt?: string;
  /** The one-line deal thesis — the page's only h1 (6–14 words). */
  headline: string;
  /** Supporting line under the headline (one sentence, ≤ 28 words). */
  subheadline?: string;
  /** Hero CTA label (the primary) lives in `ctaText` (HeroCtaConfig). */
  /** Optional secondary CTA text/url live in `ctaSecondaryText` / `ctaSecondaryUrl`. */

  /* ── 2. mutual action plan ────────────────────────────────────────────── */
  showPlan?: boolean;
  planKicker?: string;
  planHeading: string;
  planIntro?: string;
  /** 4–6 steps render best; statuses drive the timeline markers. */
  planSteps: DealRoomMapStep[];

  /* ── 3. business case ─────────────────────────────────────────────────── */
  showCase?: boolean;
  caseKicker?: string;
  caseHeading: string;
  caseIntro?: string;
  investmentLabel?: string;
  investmentItems: DealRoomLineItem[];
  investmentTotalLabel?: string;
  /** Computed-LOOKING total — editorial string, never live math. */
  investmentTotal: string;
  returnLabel?: string;
  returnItems: DealRoomLineItem[];
  returnTotalLabel?: string;
  returnTotal: string;
  paybackLabel?: string;
  /** Payback figure, count-up animated, e.g. "4.6 months". */
  paybackValue: string;
  caseFootnote?: string;
  /** Count-up duration in ms. Default 1400. */
  countUpMs?: number;

  /* ── 4. stakeholder map ───────────────────────────────────────────────── */
  showStakeholders?: boolean;
  stakeholdersKicker?: string;
  stakeholdersHeading: string;
  stakeholdersIntro?: string;
  stakeholders: DealRoomStakeholder[];

  /* ── 5. proof for this buyer ──────────────────────────────────────────── */
  showProof?: boolean;
  proofKicker?: string;
  proofHeading: string;
  /** 1–2 case study cards. */
  caseStudies: DealRoomCaseStudy[];
  /** Small label over the logo wall, e.g. "In good company". Empty hides it. */
  logoWallLabel?: string;
  /** Hairline-framed logo wall. Empty hides the wall. */
  logos: DealRoomLogo[];

  /* ── 6. resources / docs ──────────────────────────────────────────────── */
  showResources?: boolean;
  resourcesKicker?: string;
  resourcesHeading: string;
  /** Linked docs — rendered as provided; never fabricated. */
  resources: DealRoomResource[];

  /* ── 7. objection handling / FAQ ──────────────────────────────────────── */
  showFaq?: boolean;
  faqKicker?: string;
  faqHeading: string;
  faqs: DealRoomFaq[];

  /* ── 8. close ─────────────────────────────────────────────────────────── */
  showClose?: boolean;
  closeKicker?: string;
  closeHeading: string;
  closeIntro?: string;
  /** Tiny footer line under the close CTA. */
  footerNote?: string;
}

export const DEAL_ROOM_DEFAULT_PROPS: DealRoomBlockProps = {
  /* hero CTA suite (HeroCtaConfig) */
  ctaText: "Book the next step",
  ctaUrl: "#close",
  ctaAction: "url",
  ctaSecondaryText: "Forward this deal room",
  ctaSecondaryUrl: "#",

  /* navbar + hero chrome */
  heroLayout: "split",
  showNavbar: true,
  heroImageUrl:
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1100&h=900&fit=crop",
  heroImageAlt: "The deal team aligning on the path to go-live",
  navLinks: [
    { label: "The plan", href: "#plan" },
    { label: "Business case", href: "#case" },
    { label: "Next step", href: "#close" },
  ],
  navCtaText: "Book the next step",
  navCtaUrl: "#close",

  eyebrow: "Deal room for {{company_name}}",
  accountName: "Acme",
  yourName: "Your Co",
  showYourLogo: true,
  headline: "The shared path from pilot to go-live — in one place.",
  subheadline:
    "Everything your team needs to decide together: the plan, the business case, the proof, and the people. Built for this deal, kept current as we go.",

  showPlan: true,
  planKicker: "Mutual action plan",
  planHeading: "The steps to go-live — owners and dates agreed.",
  planIntro:
    "A shared plan beats a sales pitch. Here's what we move through together, who owns each step, and when it lands.",
  planSteps: [
    {
      title: "Discovery & alignment",
      owner: "Both teams",
      date: "Done",
      detail: "Success criteria, scope, and data access agreed in a working session.",
      status: "done",
    },
    {
      title: "Security review",
      owner: "Your IT + procurement",
      date: "This week",
      detail: "SOC 2 package, DPA, and architecture review with your security team.",
      status: "in-progress",
    },
    {
      title: "Pilot",
      owner: "Both teams",
      date: "Weeks 3–8",
      detail: "Two live workflows in one team, measured against the baseline we set.",
      status: "upcoming",
    },
    {
      title: "Executive review",
      owner: "Your sponsor",
      date: "Week 9",
      detail: "Pilot results to the committee; contract and rollout plan on the table.",
      status: "upcoming",
    },
    {
      title: "Go-live",
      owner: "Both teams",
      date: "Week 12",
      detail: "Full rollout with a named team and response SLAs in the contract.",
      status: "upcoming",
    },
  ],

  showCase: true,
  caseKicker: "The business case",
  caseHeading: "What this is worth to your team.",
  caseIntro:
    "Built from the numbers you shared. Totals are estimates we refine together during the pilot — not a quote.",
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
    { label: "Hours reclaimed", value: "$210,000" },
    { label: "Error & penalty reduction", value: "$96,000" },
    { label: "Faster cycle time", value: "$54,000" },
  ],
  returnTotalLabel: "Year-one return",
  returnTotal: "$360,000",
  paybackLabel: "Payback",
  paybackValue: "4.6 months",
  caseFootnote:
    "Based on current volume and the loaded labor rates your team supplied. We refine these jointly during the pilot.",
  countUpMs: 1400,

  showStakeholders: true,
  stakeholdersKicker: "Who's involved",
  stakeholdersHeading: "What each person gets out of this.",
  stakeholdersIntro:
    "A deal moves when everyone sees their own win. Here's the value for each role at the table.",
  stakeholders: [
    {
      role: "Champion",
      gets: "A plan that runs itself and a partner who keeps the deal moving — not more work.",
    },
    {
      role: "Economic buyer",
      gets: "Payback inside five months and a return that clears the bar, with the math on the record.",
    },
    {
      role: "Technical lead",
      gets: "SOC 2, SSO/SCIM, native integrations, and an open API — reviewed before sign-off.",
    },
    {
      role: "End users",
      gets: "Hours back every week and an end to the rework, with a guided rollout that doesn't disrupt.",
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
  resourcesKicker: "Resources",
  resourcesHeading: "The docs your team will ask for.",
  resources: [
    { title: "Security & compliance overview", type: "PDF · Security", url: "#" },
    { title: "Pricing & packaging", type: "PDF · Pricing", url: "#" },
    { title: "Implementation plan", type: "PDF · Onboarding", url: "#" },
  ],

  showFaq: true,
  faqKicker: "Objection handling",
  faqHeading: "The questions your team will raise.",
  faqs: [
    {
      question: "How long until we see value?",
      answer:
        "First workflows go live in week three of the pilot, and most teams measure savings inside the first 90 days.",
    },
    {
      question: "What does this ask of our IT team?",
      answer:
        "A security review and SSO setup — that's it. Native connectors cover your stack, with an open API for the long tail.",
    },
    {
      question: "What happens if the pilot doesn't hit the bar?",
      answer:
        "We set the success criteria together up front. If the pilot misses them, you walk — no contract, no commitment.",
    },
    {
      question: "How is pricing structured as we grow?",
      answer:
        "A flat platform fee with unlimited seats, so rollout never fights the meter. No per-seat penalty for the adoption you want.",
    },
  ],

  showClose: true,
  closeKicker: "Next step",
  closeHeading: "Ready to move? Let's book it.",
  closeIntro:
    "Pick a time that works for your team and we'll walk the plan together. Bring whoever needs to be in the room.",
  footerNote: "Shared for internal review. Figures and dates refined jointly as we go.",
};

interface Props {
  props: DealRoomBlockProps;
  /** Tenant brand config — drives default palette, fonts, and the your-logo. */
  brand?: BrandConfig;
  /** Optional CTA click handler (analytics / builder preview) for url-mode CTAs. */
  onCtaClick?: () => void;
  /** Builder inline-edit hook. When present, key copy is click-to-edit. */
  onFieldChange?: (updated: DealRoomBlockProps) => void;
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
  fontSize,
  onUpdate,
}: {
  value: string;
  color: string;
  reduced: boolean;
  durationMs: number;
  delay: number;
  fontSize: string;
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
    fontSize,
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

export function BlockDealRoom({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
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

  // White card surface (a touch lighter than cream); falls back to white.
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

  // Coral spark — done / next-step / live states. Never a flood.
  const sparkRaw =
    props.sparkColor && isValidHex(props.sparkColor) ? props.sparkColor : "#E26B4F";
  const sparkText = pickContrastingColor(sparkRaw, bg, [accentText], 4.5);
  const sparkChrome = ensureAccentRegisters(sparkRaw, { base: bg }, 1.8);

  // Deep-indigo dark surface for the business-case chapter + close.
  const primaryHex =
    brand?.primaryColor && isValidHex(brand.primaryColor) ? brand.primaryColor : "#1B1840";
  const dark =
    props.darkColor && isValidHex(props.darkColor)
      ? props.darkColor
      : mixHex(primaryHex, "#12102E", 0.4);
  const darkInk = resolveSectionInk({}, { base: dark });
  const accentOnDark = pickContrastingColor(accentRaw, dark, [darkInk.text], 4.5);
  const sparkOnDark = pickContrastingColor(sparkRaw, dark, [accentOnDark, darkInk.text], 4.5);
  const headlineOnDark = pickContrastingColor(
    brand?.headingOnDarkColor,
    dark,
    [accentOnDark, darkInk.text],
    4.5,
  );

  /* — Dark/brand HERO surface (the deal-room band). Opens on a distinct branded
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

  // Tinted chapter band (stakeholders) — a whisper of accent over the page.
  const bandBg = mixHex(accentChrome, bg, surfaceIsDark ? 0.1 : 0.06);
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

  // Hero CTA pair colors (on the light page surface).
  const heroCtaBg = pickContrastingColor(
    brand?.ctaBackground,
    bg,
    [accentRaw, brand?.primaryColor, "#1B1840"],
    3.0,
  );
  const heroCtaText = pickContrastingColor(brand?.ctaText, heroCtaBg, [contrastTextColor(heroCtaBg)], 4.5);

  const set = onFieldChange
    ? <K extends keyof DealRoomBlockProps>(key: K, value: DealRoomBlockProps[K]) =>
        onFieldChange({ ...props, [key]: value })
    : undefined;
  const edit = (key: keyof DealRoomBlockProps) =>
    set ? (v: string) => set(key, v as never) : undefined;

  /* — section numbering follows the visible order — */
  const showPlan = props.showPlan !== false && props.planSteps.length > 0;
  const showCase = props.showCase !== false;
  const showStakeholders = props.showStakeholders !== false && props.stakeholders.length > 0;
  const showProof =
    props.showProof !== false && (props.caseStudies.length > 0 || props.logos.length > 0);
  const showResources = props.showResources !== false && props.resources.length > 0;
  const showFaq = props.showFaq !== false && props.faqs.length > 0;
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
  const setStep = set
    ? (i: number, patch: Partial<DealRoomMapStep>) =>
        set("planSteps", props.planSteps.map((s, j) => (j === i ? { ...s, ...patch } : s)))
    : undefined;
  const setInvestItem = set
    ? (i: number, patch: Partial<DealRoomLineItem>) =>
        set("investmentItems", props.investmentItems.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setReturnItem = set
    ? (i: number, patch: Partial<DealRoomLineItem>) =>
        set("returnItems", props.returnItems.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setStakeholder = set
    ? (i: number, patch: Partial<DealRoomStakeholder>) =>
        set("stakeholders", props.stakeholders.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setCaseStudy = set
    ? (i: number, patch: Partial<DealRoomCaseStudy>) =>
        set("caseStudies", props.caseStudies.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setResource = set
    ? (i: number, patch: Partial<DealRoomResource>) =>
        set("resources", props.resources.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;
  const setFaq = set
    ? (i: number, patch: Partial<DealRoomFaq>) =>
        set("faqs", props.faqs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    : undefined;

  const hasYourLogo =
    props.showYourLogo !== false && !!brand && brandHasLogo(brand, props.yourLogoUrl);
  const isEditor = !!onFieldChange;

  /* — navbar + hero layout (design-system chrome) — */
  const hasHeroImage = !!props.heroImageUrl || isEditor;
  const showNavbar = props.showNavbar !== false;
  const heroLayout = resolveHeroLayout(props.heroLayout, hasHeroImage, "split");
  const navLinks = props.navLinks ?? DEAL_ROOM_DEFAULT_PROPS.navLinks ?? [];
  const navCtaLabel = props.navCtaText ?? props.ctaText;
  const navCtaHref = props.navCtaUrl || props.ctaUrl || "#close";
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
    kickerKey: keyof DealRoomBlockProps;
    heading: string;
    headingKey: keyof DealRoomBlockProps;
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
    labelKey: keyof DealRoomBlockProps;
    items: DealRoomLineItem[];
    setItem?: (i: number, patch: Partial<DealRoomLineItem>) => void;
    totalLabel?: string;
    totalLabelKey: keyof DealRoomBlockProps;
    total: string;
    totalKey: keyof DealRoomBlockProps;
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

  /* — status presentation for the mutual-action-plan markers — */
  const statusMeta = (status: DealRoomStepStatus) => {
    if (status === "done")
      return { label: "Done", color: sparkText, dot: sparkChrome, filled: true };
    if (status === "in-progress")
      return { label: "In progress", color: accentText, dot: accentChrome, filled: true };
    return { label: "Upcoming", color: ink.muted, dot: ink.hairline, filled: false };
  };

  return (
    <div className="dr-root" style={{ background: bg, color: ink.text, fontFamily: BODY }}>
      <style>{`
        .dr-root { position: relative; }
        .dr-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.5;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        }
        .dr-root > * { position: relative; }
        .dr-card {
          transition: transform 0.3s cubic-bezier(.16,1,.3,1),
                      box-shadow 0.3s cubic-bezier(.16,1,.3,1);
        }
        .dr-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 40px -26px rgba(27, 24, 64, 0.4);
        }
        .dr-aurora { will-change: transform; }
        .dr-aurora-1 { animation: dr-drift-1 30s ease-in-out infinite alternate; }
        .dr-aurora-2 { animation: dr-drift-2 36s ease-in-out infinite alternate; }
        @keyframes dr-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(5%, 7%, 0) scale(1.08); }
        }
        @keyframes dr-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.05); }
          to   { transform: translate3d(-6%, -5%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dr-aurora { animation: none !important; }
          .dr-card, .dr-card:hover { transition: none; transform: none; }
        }
      `}</style>

      {/* ── 1. PERSONALIZED HERO — distinct dark/brand band with navbar ──── */}
      <header
        className="relative overflow-hidden"
        style={{ background: heroBg, color: heroInk.text }}
      >
        <DarkHeroBackdrop
          surface={heroBg}
          accent={accentRaw}
          primary={primaryHex}
          isStatic={reduced || isEditor}
          idPrefix="dr-hero"
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
                  source="deal-room-hero-primary"
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
            </div>

            {heroLayout === "split" && hasHeroImage && (
              <div className="lg:col-span-5">
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
                    alt={props.heroImageAlt || "The deal team aligning on the path to go-live"}
                    wrapperClassName="block"
                    className="w-full h-full object-cover aspect-[4/3] rounded-xl"
                    onUpdate={edit("heroImageUrl")}
                    onAltUpdate={edit("heroImageAlt")}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        <span aria-hidden className="block pt-12 sm:pt-16" />
        {/* ── 2. Mutual action plan ────────────────────────────────────── */}
        {showPlan && (
          <section
            id="plan"
            className="scroll-mt-8 py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.planKicker || "Mutual action plan"}
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
              {/* connecting line down the steps */}
              <span
                aria-hidden
                className="absolute left-[11px] top-2 bottom-2 w-px"
                style={{ background: ink.hairline }}
              />
              {props.planSteps.map((step, i) => {
                const meta = statusMeta(step.status);
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
                      {step.status === "done" ? (
                        <Check className="w-3 h-3" strokeWidth={3} />
                      ) : step.status === "in-progress" ? (
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
                            value={step.title}
                            onUpdate={setStep ? (v) => setStep(i, { title: v }) : undefined}
                          />
                        </h3>
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
                          style={{
                            color: meta.color,
                            border: `1px solid ${meta.color}`,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs" style={{ color: ink.muted }}>
                        {(step.owner || isEditor) && (
                          <span>
                            <InlineText
                              as="span"
                              value={step.owner ?? ""}
                              onUpdate={setStep ? (v) => setStep(i, { owner: v }) : undefined}
                            />
                          </span>
                        )}
                        {(step.date || isEditor) && (
                          <span className="tabular-nums" style={{ fontFamily: NUMBERS }}>
                            <InlineText
                              as="span"
                              value={step.date ?? ""}
                              onUpdate={setStep ? (v) => setStep(i, { date: v }) : undefined}
                            />
                          </span>
                        )}
                      </div>
                      {(step.detail || isEditor) && (
                        <p className="mt-2 text-sm leading-relaxed max-w-2xl" style={{ color: ink.text }}>
                          <InlineText
                            as="span"
                            value={step.detail ?? ""}
                            onUpdate={setStep ? (v) => setStep(i, { detail: v }) : undefined}
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

      {/* ── 3. Business case — dark deep-indigo aurora chapter ─────────── */}
      {showCase && (
        <section
          id="case"
          className="relative scroll-mt-8 overflow-hidden"
          style={{ background: dark }}
          aria-label={props.caseKicker || "The business case"}
        >
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span
                className="dr-aurora dr-aurora-1 absolute rounded-full"
                style={{
                  width: "40rem",
                  height: "40rem",
                  top: "-16rem",
                  right: "-12rem",
                  background: `radial-gradient(closest-side, ${mixHex(accentRaw, dark, 0.32)} 0%, transparent 72%)`,
                  filter: "blur(24px)",
                  opacity: 0.5,
                }}
              />
              <span
                className="dr-aurora dr-aurora-2 absolute rounded-full"
                style={{
                  width: "34rem",
                  height: "34rem",
                  bottom: "-14rem",
                  left: "-10rem",
                  background: `radial-gradient(closest-side, ${mixHex(primaryHex, dark, 0.5)} 0%, transparent 72%)`,
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
                <span className="h-px flex-none w-6 self-center" style={{ background: accentOnDark }} />
                <span className={kickerClass} style={{ color: accentOnDark }}>
                  <InlineText as="span" value={props.caseKicker ?? ""} onUpdate={edit("caseKicker")} />
                </span>
              </div>
              <h2
                className="text-2xl sm:text-3xl lg:text-4xl tracking-tight"
                style={{ color: headlineOnDark, fontFamily: DISPLAY, fontWeight: "var(--brand-heading-weight, 700)" as never }}
              >
                <InlineText as="span" value={props.caseHeading} onUpdate={edit("caseHeading")} multiline />
              </h2>
              {(props.caseIntro || isEditor) && (
                <p className="mt-4 text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: darkInk.muted }}>
                  <InlineText as="span" value={props.caseIntro ?? ""} onUpdate={edit("caseIntro")} multiline />
                </p>
              )}
            </motion.div>

            <motion.div {...fadeUp(0.05)} className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
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
            </motion.div>

            <motion.div
              {...fadeUp(0.1)}
              className="mt-10 pt-8 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-5"
              style={{ borderTop: `1px solid ${darkInk.hairline}` }}
            >
              <span className={`${kickerClass} self-center`} style={{ color: sparkOnDark }}>
                <InlineText as="span" value={props.paybackLabel ?? ""} onUpdate={edit("paybackLabel")} />
              </span>
              <CountUpValue
                value={props.paybackValue}
                color={headlineOnDark}
                reduced={reduced}
                durationMs={props.countUpMs ?? 1400}
                delay={0.15}
                fontSize="clamp(2rem, 5vw, 3.25rem)"
                onUpdate={edit("paybackValue")}
              />
            </motion.div>
            {(props.caseFootnote || isEditor) && (
              <p className="mt-4 text-xs leading-relaxed max-w-2xl" style={{ color: darkInk.muted }}>
                <InlineText as="span" value={props.caseFootnote ?? ""} onUpdate={edit("caseFootnote")} multiline />
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── 4. Stakeholder map — tinted chapter ──────────────────────────── */}
      {showStakeholders && (
        <section
          className="relative py-14 sm:py-20"
          style={{
            background: bandBg,
            borderBottom: `1px solid ${ink.hairline}`,
          }}
          aria-label={props.stakeholdersKicker || "Stakeholders"}
        >
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
            <SectionHead
              no={nextNo()}
              kicker={props.stakeholdersKicker}
              kickerKey="stakeholdersKicker"
              heading={props.stakeholdersHeading}
              headingKey="stakeholdersHeading"
              tones={bandTones}
            />
            {(props.stakeholdersIntro || isEditor) && (
              <motion.p
                {...fadeUp(0.04)}
                className="-mt-4 mb-8 text-sm sm:text-base leading-relaxed max-w-2xl"
                style={{ color: bandInk.muted }}
              >
                <InlineText
                  as="span"
                  value={props.stakeholdersIntro ?? ""}
                  onUpdate={edit("stakeholdersIntro")}
                  multiline
                />
              </motion.p>
            )}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${
                props.stakeholders.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
              }`}
            >
              {props.stakeholders.map((s, i) => (
                <motion.div
                  key={i}
                  {...fadeUp(i * 0.06)}
                  className="dr-card rounded-2xl p-6"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardInk.hairline}`,
                    boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                  }}
                >
                  {(s.avatarUrl || isEditor) && (
                    <span className="mb-4 block">
                      <InlineImage
                        src={s.avatarUrl ?? ""}
                        alt={s.name || s.role}
                        wrapperClassName="inline-block"
                        className="w-12 h-12 rounded-full object-cover"
                        style={{ border: `1px solid ${cardInk.hairline}` }}
                        onUpdate={
                          setStakeholder ? (v) => setStakeholder(i, { avatarUrl: v }) : undefined
                        }
                      />
                    </span>
                  )}
                  {!s.avatarUrl && (
                    <span
                      aria-hidden
                      className="mb-4 block h-[3px] w-9 rounded-full"
                      style={{ background: accentChrome }}
                    />
                  )}
                  <h3
                    className="text-base font-bold tracking-tight"
                    style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                  >
                    <InlineText
                      as="span"
                      value={s.role}
                      onUpdate={setStakeholder ? (v) => setStakeholder(i, { role: v }) : undefined}
                    />
                  </h3>
                  {(s.name || isEditor) && (
                    <p className="mt-0.5 text-xs" style={{ color: cardInk.muted }}>
                      <InlineText
                        as="span"
                        value={s.name ?? ""}
                        onUpdate={setStakeholder ? (v) => setStakeholder(i, { name: v }) : undefined}
                      />
                    </p>
                  )}
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: cardInk.text }}>
                    <InlineText
                      as="span"
                      value={s.gets}
                      onUpdate={setStakeholder ? (v) => setStakeholder(i, { gets: v }) : undefined}
                      multiline
                    />
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* ── 5. Proof for this buyer ──────────────────────────────────── */}
        {showProof && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: showStakeholders ? "none" : `1px solid ${ink.hairline}` }}
            aria-label={props.proofKicker || "Proof"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.proofKicker}
              kickerKey="proofKicker"
              heading={props.proofHeading}
              headingKey="proofHeading"
              tones={lightTones}
            />
            {props.caseStudies.length > 0 && (
              <div className={`grid grid-cols-1 ${props.caseStudies.length >= 2 ? "md:grid-cols-2" : ""} gap-5`}>
                {props.caseStudies.map((cs, i) => (
                  <motion.div
                    key={i}
                    {...fadeUp(i * 0.06)}
                    className="dr-card rounded-2xl p-6 sm:p-8 flex flex-col"
                    style={{
                      background: cardBg,
                      border: `1px solid ${cardInk.hairline}`,
                      boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                    }}
                  >
                    <div className="mb-5 h-7 flex items-center">
                      {cs.logoUrl || isEditor ? (
                        <InlineImage
                          src={cs.logoUrl ?? ""}
                          alt={cs.name || "Customer logo"}
                          wrapperClassName="inline-block"
                          className="h-7 w-auto object-contain"
                          onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { logoUrl: v }) : undefined}
                        />
                      ) : (
                        <span
                          className="text-sm font-bold tracking-wide"
                          style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                        >
                          {cs.name}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-lg sm:text-xl font-bold tracking-tight leading-snug"
                      style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                    >
                      <InlineText
                        as="span"
                        value={cs.result}
                        onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { result: v }) : undefined}
                        multiline
                      />
                    </p>
                    {(cs.quote || isEditor) && (
                      <blockquote
                        className="mt-4 text-sm leading-relaxed flex-1"
                        style={{ color: cardInk.text, borderLeft: `2px solid ${accentChrome}`, paddingLeft: "0.9rem" }}
                      >
                        <InlineText
                          as="span"
                          value={cs.quote ?? ""}
                          onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { quote: v }) : undefined}
                          multiline
                        />
                      </blockquote>
                    )}
                    {(cs.attribution || isEditor) && (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: cardInk.muted }}>
                        <InlineText
                          as="span"
                          value={cs.attribution ?? ""}
                          onUpdate={setCaseStudy ? (v) => setCaseStudy(i, { attribution: v }) : undefined}
                        />
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {props.logos.length > 0 && (
              <motion.div
                {...fadeUp(0.1)}
                className="mt-8 rounded-2xl px-6 py-7 sm:px-8"
                style={{ border: `1px solid ${ink.hairline}` }}
                aria-label={props.logoWallLabel || "Customer logos"}
              >
                {(props.logoWallLabel || isEditor) && (
                  <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: ink.muted }}>
                    <InlineText
                      as="span"
                      value={props.logoWallLabel ?? ""}
                      onUpdate={edit("logoWallLabel")}
                    />
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
                  {props.logos.map((logo, i) =>
                    logo.imageUrl ? (
                      <img
                        key={i}
                        src={logo.imageUrl}
                        alt={logo.name}
                        className="h-6 w-auto opacity-60"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        key={i}
                        className="text-sm font-semibold tracking-wide"
                        style={{ color: ink.muted, fontFamily: DISPLAY }}
                      >
                        {logo.name}
                      </span>
                    ),
                  )}
                </div>
              </motion.div>
            )}
          </section>
        )}

        {/* ── 6. Resources / docs ──────────────────────────────────────── */}
        {showResources && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.resourcesKicker || "Resources"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.resourcesKicker}
              kickerKey="resourcesKicker"
              heading={props.resourcesHeading}
              headingKey="resourcesHeading"
              tones={lightTones}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {props.resources.map((r, i) => (
                <motion.a
                  key={i}
                  {...fadeUp(i * 0.05)}
                  href={r.url || "#"}
                  className={`dr-card group flex items-center gap-4 rounded-2xl p-5 ${focusable}`}
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardInk.hairline}`,
                    boxShadow: "0 12px 32px -26px rgba(27, 24, 64, 0.3)",
                  }}
                >
                  <span
                    className="inline-flex w-10 h-10 flex-none items-center justify-center rounded-xl"
                    style={{ background: mixHex(accentChrome, cardBg, 0.12), color: accentText }}
                    aria-hidden
                  >
                    <FileText className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-sm font-bold tracking-tight truncate"
                      style={{ color: headlineOnCard, fontFamily: DISPLAY }}
                    >
                      <InlineText
                        as="span"
                        value={r.title}
                        onUpdate={setResource ? (v) => setResource(i, { title: v }) : undefined}
                      />
                    </span>
                    {(r.type || isEditor) && (
                      <span className="mt-0.5 block text-[11px] uppercase tracking-[0.14em]" style={{ color: cardInk.muted }}>
                        <InlineText
                          as="span"
                          value={r.type ?? ""}
                          onUpdate={setResource ? (v) => setResource(i, { type: v }) : undefined}
                        />
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="w-4 h-4 flex-none transition-transform group-hover:translate-x-0.5"
                    style={{ color: accentText }}
                    aria-hidden
                  />
                </motion.a>
              ))}
            </div>
          </section>
        )}

        {/* ── 7. Objection handling / FAQ ──────────────────────────────── */}
        {showFaq && (
          <section
            className="py-10 sm:py-14"
            style={{ borderTop: `1px solid ${ink.hairline}` }}
            aria-label={props.faqKicker || "FAQ"}
          >
            <SectionHead
              no={nextNo()}
              kicker={props.faqKicker}
              kickerKey="faqKicker"
              heading={props.faqHeading}
              headingKey="faqHeading"
              tones={lightTones}
            />
            <dl>
              {props.faqs.map((f, i) => (
                <motion.div
                  key={i}
                  {...fadeUp(i * 0.05)}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-2 md:gap-8 py-6"
                  style={{ borderTop: `1px solid ${ink.hairline}` }}
                >
                  <dt
                    className="text-base font-bold tracking-tight"
                    style={{ color: headline, fontFamily: DISPLAY }}
                  >
                    <InlineText
                      as="span"
                      value={f.question}
                      onUpdate={setFaq ? (v) => setFaq(i, { question: v }) : undefined}
                      multiline
                    />
                  </dt>
                  <dd className="text-sm leading-relaxed" style={{ color: ink.muted }}>
                    <InlineText
                      as="span"
                      value={f.answer}
                      onUpdate={setFaq ? (v) => setFaq(i, { answer: v }) : undefined}
                      multiline
                    />
                  </dd>
                </motion.div>
              ))}
              <div style={{ borderTop: `1px solid ${ink.hairline}` }} />
            </dl>
          </section>
        )}
      </div>

      {/* ── 8. Close — dark scheduling strip ─────────────────────────────── */}
      {showClose && (
        <section
          id="close"
          className="relative overflow-hidden mt-4"
          style={{ background: dark }}
          aria-label={props.closeKicker || "Next step"}
        >
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span
                className="dr-aurora dr-aurora-2 absolute rounded-full"
                style={{
                  width: "32rem",
                  height: "32rem",
                  top: "-12rem",
                  left: "50%",
                  marginLeft: "-16rem",
                  background: `radial-gradient(closest-side, ${mixHex(accentRaw, dark, 0.3)} 0%, transparent 72%)`,
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
                <span className="h-px w-6" style={{ background: sparkOnDark }} />
                <span className={kickerClass} style={{ color: sparkOnDark }}>
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
                  source="deal-room-close-primary"
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

export default BlockDealRoom;
