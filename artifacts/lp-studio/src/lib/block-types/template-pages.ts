// ───────────────────────────────────────────────────────────────────────────
// Template-page blocks — premium, self-contained, full-page blocks that render
// an entire landing page from a single props object (the same pattern as
// content-series and business-case).
//
// Two families, each sharing ONE common prop interface across THREE visual
// designs (mirrors BusinessCaseCommonProps, which is shared by the split /
// centered / premium variants):
//
//   EVENT      (EventPageCommonProps)      → event-noir | event-luminous | event-split
//   CASE STUDY (CaseStudyCommonProps)      → case-metrics | case-editorial | case-modular
//
// Every design implements ALL canonical sections; each section has a `show*`
// toggle (default ON when absent) so the user can hide sections from the
// property panel. Style tokens (colors / fonts / spacing / sizes) are optional
// and fall back: prop ?? brand ?? hardcoded editorial default — so the blocks
// stay fully customizable and are ready for AI per-brand customization later.
// ───────────────────────────────────────────────────────────────────────────

// ── Shared style tokens ─────────────────────────────────────────────────────

export type SectionSpacing = "compact" | "normal" | "spacious";
export type ContentWidth = "narrow" | "standard" | "wide";
export type CornerRadius = "sharp" | "soft" | "rounded";
export type HeadingScale = "compact" | "balanced" | "display";

/** Customizable look-and-feel tokens shared by every template-page block.
 *  All optional — render components apply a fallback hierarchy of
 *  `prop ?? brand ?? hardcoded editorial default`. */
export interface TemplatePageStyle {
  // Palette
  bgColor?: string;
  inkColor?: string;
  mutedColor?: string;
  accentColor?: string;
  accentInkColor?: string;
  darkColor?: string;
  /** Headline color on light surfaces. Falls back to inkColor. */
  headlineColor?: string;
  /** Headline color on dark surfaces. Falls back to bgColor. */
  headlineOnDarkColor?: string;
  cardBgColor?: string;
  borderColor?: string;

  // Typography
  displayFontFamily?: string;
  bodyFontFamily?: string;

  // Spacing & sizing (mapped to concrete values by the resolve* helpers below)
  sectionSpacing?: SectionSpacing;
  contentWidth?: ContentWidth;
  cornerRadius?: CornerRadius;
  headingScale?: HeadingScale;
}

/** Vertical padding (px) applied to each section's top & bottom. */
export function resolveSectionSpacingPx(s?: SectionSpacing): number {
  switch (s) {
    case "compact": return 64;
    case "spacious": return 140;
    case "normal":
    default: return 96;
  }
}

/** Max content width (px) for the centered reading column. */
export function resolveContentMaxWidthPx(w?: ContentWidth): number {
  switch (w) {
    case "narrow": return 880;
    case "wide": return 1320;
    case "standard":
    default: return 1120;
  }
}

/** Card / button corner radius (px). */
export function resolveRadiusPx(r?: CornerRadius): number {
  switch (r) {
    case "sharp": return 0;
    case "rounded": return 28;
    case "soft":
    default: return 14;
  }
}

/** Multiplier applied to display headline sizes. */
export function resolveHeadingScale(h?: HeadingScale): number {
  switch (h) {
    case "compact": return 0.9;
    case "display": return 1.15;
    case "balanced":
    default: return 1;
  }
}

// ── EVENT family — sub-item types ───────────────────────────────────────────

export interface EventNavLink {
  label: string;
  href: string;
}

export interface EventStat {
  value: string;
  label: string;
}

export interface EventAgendaSession {
  time: string;
  title: string;
  description?: string;
  speaker?: string;
}

export interface EventAgendaDay {
  dayLabel: string;
  date?: string;
  sessions: EventAgendaSession[];
}

export interface EventSpeaker {
  name: string;
  role?: string;
  company?: string;
  photoUrl?: string;
  bio?: string;
}

export interface EventSponsor {
  name: string;
  logoUrl?: string;
  /** Optional grouping label, e.g. "Platinum", "Community". */
  tier?: string;
}

export interface EventTicketTier {
  name: string;
  price: string;
  /** e.g. "per seat", "early bird". */
  period?: string;
  description?: string;
  features: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Highlights this tier as the recommended option. */
  featured?: boolean;
}

export interface EventFaqItem {
  question: string;
  answer: string;
}

export interface EventGalleryImage {
  url: string;
  caption?: string;
}

export type EventFormFieldType = "text" | "email" | "tel" | "textarea" | "select";

export interface EventFormField {
  /** Stable key the lead is stored under. */
  id: string;
  label: string;
  type: EventFormFieldType;
  placeholder?: string;
  required?: boolean;
  /** Options for `type: "select"`. */
  options?: string[];
}

// ── EVENT family — common props ─────────────────────────────────────────────

export interface EventPageCommonProps extends TemplatePageStyle {
  // Brand / meta
  brandName: string;
  logoUrl?: string;
  logoAlt?: string;

  // Section visibility — all default to true when absent.
  showNav?: boolean;
  showHero?: boolean;
  showCountdown?: boolean;
  showAbout?: boolean;
  showAgenda?: boolean;
  showSpeakers?: boolean;
  showVenue?: boolean;
  showGallery?: boolean;
  showSponsors?: boolean;
  showTickets?: boolean;
  showFaq?: boolean;
  showForm?: boolean;
  showFooter?: boolean;

  // Nav
  navLinks?: EventNavLink[];
  navCtaLabel?: string;
  navCtaUrl?: string;

  // Hero
  heroEyebrow?: string;
  eventName: string;
  heroTagline?: string;
  eventDate?: string;
  eventLocation?: string;
  heroCtaLabel?: string;
  heroCtaUrl?: string;
  heroSecondaryCtaLabel?: string;
  heroSecondaryCtaUrl?: string;
  heroImageUrl?: string;
  /** 0–100 overlay darkness over a full-bleed hero image. */
  heroOverlayOpacity?: number;

  // Hero registration card (used by the Split Conference hero only).
  /** Show/hide the floating registration card. Visible when absent. */
  showHeroCard?: boolean;
  /** Card label, e.g. "Early Bird". Falls back to ticketTiers[0].name. */
  heroCardLabel?: string;
  /** Card price, e.g. "$399". Falls back to ticketTiers[0].price. */
  heroCardPrice?: string;
  /** Card period / sub-text, e.g. "until Feb 1". Falls back to ticketTiers[0].period. */
  heroCardPeriod?: string;
  /** Card feature bullets. Falls back to ticketTiers[0].features. */
  heroCardFeatures?: string[];
  /** Card button label. Falls back to ticketTiers[0].ctaLabel, then heroCtaLabel. */
  heroCardCtaLabel?: string;
  /** Card button URL. Falls back to ticketTiers[0].ctaUrl, then heroCtaUrl. */
  heroCardCtaUrl?: string;

  // Countdown
  countdownHeading?: string;
  /** ISO datetime the countdown ticks toward. */
  countdownTargetDate?: string;

  // About
  aboutEyebrow?: string;
  aboutHeading?: string;
  aboutBody?: string;
  aboutStats?: EventStat[];

  // Agenda
  agendaEyebrow?: string;
  agendaHeading?: string;
  agendaDays?: EventAgendaDay[];

  // Speakers
  speakersEyebrow?: string;
  speakersHeading?: string;
  speakers?: EventSpeaker[];

  // Venue
  venueEyebrow?: string;
  venueHeading?: string;
  venueName?: string;
  venueAddress?: string;
  venueDescription?: string;
  venueImageUrl?: string;

  // Gallery
  galleryHeading?: string;
  galleryImages?: EventGalleryImage[];

  // Sponsors / partners
  sponsorsHeading?: string;
  sponsors?: EventSponsor[];

  // Tickets / registration tiers
  ticketsEyebrow?: string;
  ticketsHeading?: string;
  ticketTiers?: EventTicketTier[];

  // FAQ
  faqHeading?: string;
  faqItems?: EventFaqItem[];

  // RSVP / registration form
  formEyebrow?: string;
  formHeading?: string;
  formSubheading?: string;
  formFields?: EventFormField[];
  formSubmitLabel?: string;
  formSuccessMessage?: string;
  /** Where leads POST. Defaults to /api/lp/leads. */
  formSubmitUrl?: string;

  // Footer
  footerTagline?: string;
  footerLinks?: EventNavLink[];
  footerNote?: string;
}

export interface EventNoirBlockProps extends EventPageCommonProps {}
export interface EventLuminousBlockProps extends EventPageCommonProps {}
export interface EventSplitBlockProps extends EventPageCommonProps {}

// ── CASE STUDY family — sub-item types ──────────────────────────────────────

export interface CaseNavLink {
  label: string;
  href: string;
}

export interface CaseStat {
  value: string;
  label: string;
  caption?: string;
}

export interface CaseProfileRow {
  label: string;
  value: string;
}

export interface CaseApproachCard {
  title: string;
  body: string;
  /** Lucide-style icon key the design may map to a glyph. */
  icon?: string;
}

/** Repeatable long-form deep-dive section ("add sections" capability). */
export interface CaseModule {
  heading: string;
  body: string;
  imageUrl?: string;
}

export interface CaseTakeaway {
  text: string;
}

export interface CaseGalleryImage {
  url: string;
  caption?: string;
}

// ── CASE STUDY family — common props ────────────────────────────────────────

export interface CaseStudyCommonProps extends TemplatePageStyle {
  // Brand / meta
  brandName: string;
  logoUrl?: string;
  logoAlt?: string;

  // Section visibility — all default to true when absent.
  showNav?: boolean;
  showHero?: boolean;
  showMetrics?: boolean;
  showAtAGlance?: boolean;
  showChallenge?: boolean;
  showApproach?: boolean;
  showResults?: boolean;
  showQuote?: boolean;
  showGallery?: boolean;
  showModules?: boolean;
  showTakeaways?: boolean;
  showCta?: boolean;
  showFooter?: boolean;

  // Nav
  navLinks?: CaseNavLink[];
  navCtaLabel?: string;
  navCtaUrl?: string;

  // Hero
  heroEyebrow?: string;
  /** The featured customer / subject. */
  clientName?: string;
  heroHeadline: string;
  heroSummary?: string;
  heroImageUrl?: string;
  heroCtaLabel?: string;
  heroCtaUrl?: string;

  // Metrics band
  metricsHeading?: string;
  metrics?: CaseStat[];

  // At a glance (profile table)
  atAGlanceHeading?: string;
  profile?: CaseProfileRow[];

  // Challenge
  challengeEyebrow?: string;
  challengeHeading?: string;
  challengeBody?: string;
  challengeImageUrl?: string;

  // Approach
  approachEyebrow?: string;
  approachHeading?: string;
  approachBody?: string;
  approachCards?: CaseApproachCard[];

  // Results
  resultsEyebrow?: string;
  resultsHeading?: string;
  resultsBody?: string;
  resultStats?: CaseStat[];

  // Pull quote
  quoteText?: string;
  quoteAuthor?: string;
  quoteRole?: string;
  quotePortraitUrl?: string;

  // Gallery
  galleryHeading?: string;
  galleryImages?: CaseGalleryImage[];

  // Repeatable deep-dive modules
  modulesHeading?: string;
  modules?: CaseModule[];

  // Key takeaways
  takeawaysHeading?: string;
  takeaways?: CaseTakeaway[];

  // Closing CTA
  ctaHeading?: string;
  ctaBody?: string;
  ctaLabel?: string;
  ctaUrl?: string;

  // Footer
  footerTagline?: string;
  footerLinks?: CaseNavLink[];
  footerNote?: string;
}

export interface CaseMetricsBlockProps extends CaseStudyCommonProps {}
export interface CaseEditorialBlockProps extends CaseStudyCommonProps {}
export interface CaseModularBlockProps extends CaseStudyCommonProps {}
