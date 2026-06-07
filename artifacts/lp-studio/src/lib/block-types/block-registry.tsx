import type React from "react";
import type { BlockCategory, BlockSettings, CtaMode } from "./common";
import type { BackgroundStyle } from "../bg-styles";
import type {
  HeroBlockProps,
  TrustBarBlockProps,
  PasSectionBlockProps,
  ComparisonBlockProps,
  StatCalloutBlockProps,
  BenefitsGridBlockProps,
  TestimonialBlockProps,
  HowItWorksBlockProps,
  ProductGridBlockProps,
  PhotoStripBlockProps,
  BottomCtaBlockProps,
  VideoSectionBlockProps,
  CaseStudiesBlockProps,
  ResourcesBlockProps,
  RichTextBlockProps,
  CustomHtmlBlockProps,
  GridImageBlockProps,
  GridHeadlineSubBlockProps,
  GridParagraphBulletsBlockProps,
  GridHeadlineParagraphBlockProps,
  GridIconFeatureBlockProps,
  GridStatBlockProps,
  GridQuoteBlockProps,
  GridCtaTileBlockProps,
  GridLogoBlockProps,
  GridVideoBlockProps,
  CustomSchemaBlockProps,
  SpacerBlockProps,
  FormBlockProps,
  ZigzagFeaturesBlockProps,
  ProductShowcaseBlockProps,
  FooterBlockProps,
  FullBleedHeroBlockProps,
  ParallaxImageHeroBlockProps,
  RoiCalculatorBlockProps,
  DandyVersusBlockProps,
  DandyColumnsV2BlockProps,
  DandyColumnsV3BlockProps,
  DandyVerticalTabsBlockProps,
  DandySwitchbackBlockProps,
  DandySiteHeaderBlockProps,
  DandySiteFooterBlockProps,
  DandyVideoTestimonialsBlockProps,
  DandySideImageV6BlockProps,
  DandyHeroV7S3BlockProps,
  DandyFormRightAltBlockProps,
  DandyConversionPanel1BlockProps,
  DandyCtaBlockProps,
  ScrollAssemblyBlockProps,
  HorizontalShowcaseBlockProps,
  StickyStackBlockProps,
  MagazineHeroBlockProps,
  CinematicVideoHeroBlockProps,
  AuroraGradientHeroBlockProps,
  EditorialSplitHeroBlockProps,
  ParallaxLayersHeroBlockProps,
  SpotlightGlowHeroBlockProps,
  BoldStatementBlockProps,
  IdHeroBlockProps,
  IdMarqueeBlockProps,
  IdIntroBlockProps,
  IdCinemaPillarsBlockProps,
  IdParallaxShowcaseBlockProps,
  IdSystemFlowBlockProps,
  IdFormBlockProps,
  IdStatsBlockProps,
  IdInvitationBlockProps,
  IdGridBlockProps,
  IdSpotlightBlockProps,
  IdReservationPassBlockProps,
  BentoShowcaseBlockProps,
  GradientPricingBlockProps,
  EditorialCarouselBlockProps,
  MenuSectionBlockProps,
  HoursLocationBlockProps,
  BeforeAfterGalleryBlockProps,
  CtaCenteredMinimalBlockProps,
  CenteredLogoNavBlockProps,
  MegaMenuNavBlockProps,
  MinimalNavBlockProps,
  TransparentOverlayNavBlockProps,
  CtaSplitImageBlockProps,
  CtaStatBackedBlockProps,
  CtaGradientBannerBlockProps,
  CaseStudyCardGridBlockProps,
  CaseStudyLogoResultsRowBlockProps,
  CaseStudyMetricTriptychBlockProps,
  CaseStudySpotlightFeatureBlockProps,
  GalleryCarouselSpotlightBlockProps,
  GalleryFilmstripBlockProps,
  GalleryMasonryBlockProps,
  GallerySplitFeatureBlockProps,
  MediaFeatureReelBlockProps,
  MediaLoopingShowcaseBlockProps,
  MediaThumbnailGridBlockProps,
  MediaVideoSplitBlockProps,
  SpeakerGridBlockProps,
  BenefitsAlternatingRowsBlockProps,
  HowItWorksAlternatingBlockProps,
  HowItWorksNumberedBentoBlockProps,
  HowItWorksVerticalTimelineBlockProps,
  HowItWorksHorizontalStepperBlockProps,
  BenefitsBentoBlockProps,
  FeaturesBentoShowcaseBlockProps,
  FeaturesSpotlightCardsBlockProps,
  FeaturesTabbedCategoriesBlockProps,
  FeaturesComparisonChecklistBlockProps,
  BenefitsIconGridBlockProps,
  BenefitsStatLedBlockProps,
  QuoteCarouselBlockProps,
  QuoteLibraryBlockProps,
  QuoteWithImageBlockProps,
  SingleQuoteBlockProps,
  TestimonialGridBlockProps,
  ContentSeriesBlockProps,
  BlogSeriesBlockProps,
  StorefrontBlockProps,
  LogoWallBlockProps,
  LogoMarqueeBlockProps,
  RatingBadgesBlockProps,
  AvatarSocialProofBlockProps,
} from "./generic-blocks";
import type {
  SectionBlockProps,
  ColumnsBlockProps,
  GridBlockProps,
  StackBlockProps,
} from "./container-blocks";
import type {
  DsoInsightsDashboardBlockProps,
  DsoLabTourBlockProps,
  DsoStatBarBlockProps,
  DsoSuccessStoriesBlockProps,
  DsoChallengesBlockProps,
  DsoPilotStepsBlockProps,
  DsoFinalCtaBlockProps,
  DsoComparisonBlockProps,
  DsoHeartlandHeroBlockProps,
  DandyProductHeroBlockProps,
  DsoProblemBlockProps,
  DsoAiFeatureBlockProps,
  DsoStatShowcaseBlockProps,
  DsoScrollStoryBlockProps,
  DsoScrollStoryHeroBlockProps,
  DsoNetworkMapBlockProps,
  DsoCaseFlowBlockProps,
  DsoLiveFeedBlockProps,
  DsoParticleMeshBlockProps,
  DsoFlowCanvasBlockProps,
  DsoBentoOutcomesBlockProps,
  DsoCtaCaptureBlockProps,
  DsoMeetTeamBlockProps,
  DsoParadigmShiftBlockProps,
  DsoPartnershipPerksBlockProps,
  DsoProductsGridBlockProps,
  DsoPromoCardsBlockProps,
  DsoActivationStepsBlockProps,
  DsoPromisesBlockProps,
  DsoTestimonialsBlockProps,
  DsoPracticeNavBlockProps,
  DsoPracticeHeroBlockProps,
  DsoStatRowBlockProps,
  DsoFaqBlockProps,
  DsoSplitFeatureBlockProps,
  DsoSoftwareShowcaseBlockProps,
  DsoInsightsVideoBlockProps,
  DsoCaseStudyBlockProps,
  OnePagerHeroBlockProps,
  EventPageBlockProps,
  ProductLaunchBlockProps,
  StoryHubBlockProps,
  EventLandingHeroBlockProps,
  SpatialTourBlockProps,
  BusinessCaseSplitBlockProps,
  BusinessCaseCenteredBlockProps,
  BusinessCasePremiumBlockProps,
} from "./dso-blocks";
import type {
  NavHeaderBlockProps,
  CtaButtonBlockProps,
  PopupBlockProps,
  StickyBarBlockProps,
  StickyHeaderBlockProps,
} from "./utility-blocks";
import type {
  EventNoirBlockProps,
  EventLuminousBlockProps,
  EventSplitBlockProps,
  CaseMetricsBlockProps,
  CaseEditorialBlockProps,
  CaseModularBlockProps,
} from "./template-pages";
import { eventPageDefaults, caseStudyDefaults } from "./template-page-defaults";
import type { BlockType, PageBlock } from "./block-variant";
import { type BlockRoleTag, getDefaultBlockTags } from "@workspace/lp-template-engine";

export interface BlockDefinition {
  type: BlockType;
  label: string;
  category: BlockCategory;
  defaultProps: () => any;
  thumbnail: () => React.ReactElement;
  /**
   * Semantic role tags (controlled vocabulary from
   * @workspace/lp-template-engine) describing what structural role this block
   * fills — hero, footer, cta, social-proof, … Code defaults are attached
   * automatically (see end of this file) from the shared DEFAULT_BLOCK_TAGS
   * map; superadmins can override them per-industry via the Block Catalog.
   * Advisory metadata only — does not affect rendering.
   */
  tags?: BlockRoleTag[];
  /**
   * Slot-constraint hint: when `false`, this block is excluded from the
   * Insert dialog whenever the user is targeting a nested container slot
   * (e.g. dropping into a Section/Columns/Grid/Stack). Defaults to `true`.
   * Used today for chrome blocks (nav-header, sticky-bar, footer, popups,
   * dandy-site-header/footer) which are page-level singletons that should
   * never be placed inside a content container.
   */
  allowedAsChild?: boolean;
}

/**
 * Block types disallowed inside container slots regardless of registry
 * authoring (kept here so `BlockDefinition.allowedAsChild` overrides remain
 * optional for new block authors).
 */
export const CHROME_BLOCK_TYPES = new Set<BlockType>([
  "nav-header",
  "sticky-header",
  "sticky-bar",
  "popup",
  "footer",
  "dandy-site-header",
  "dandy-site-footer",
  "centered-logo-nav",
  "mega-menu-nav",
  "minimal-nav",
  "transparent-overlay-nav",
]);

/** Returns true when `type` is allowed to be inserted as a nested child of
 *  any container. Combines explicit `allowedAsChild === false` from the
 *  registry with the CHROME_BLOCK_TYPES blacklist. */
export function isAllowedAsChild(def: BlockDefinition): boolean {
  if (def.allowedAsChild === false) return false;
  if (CHROME_BLOCK_TYPES.has(def.type)) return false;
  return true;
}

export const BLOCK_REGISTRY: BlockDefinition[] = [
  {
    type: "hero",
    label: "Hero",
    category: "Layout",
    defaultProps: (): HeroBlockProps => ({
      headline: "The Dental Lab Your Patients Will Thank You For",
      subheadline: "Dandy's digital-first lab delivers crowns, bridges, and implants in 5 days — with a fit rate your old lab never came close to.",
      ctaText: "Get Started Free",
      ctaUrl: "#",
      heroType: "static-image",
      layout: "centered",
      backgroundStyle: "white",
      showSocialProof: true,
      socialProofText: "Trusted by 12,000+ dental practices across the US",
      imageUrl: "",
      mediaUrl: "",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="20" y="14" width="80" height="8" rx="2" fill="#C7E738" opacity="0.9" />
        <rect x="30" y="26" width="60" height="4" rx="1" fill="white" opacity="0.5" />
        <rect x="35" y="34" width="50" height="4" rx="1" fill="white" opacity="0.3" />
        <rect x="42" y="44" width="36" height="10" rx="5" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "trust-bar",
    label: "Trust Bar",
    category: "Social Proof",
    defaultProps: (): TrustBarBlockProps => ({
      items: [
        { value: "12,000+", label: "Dental Practices" },
        { value: "48 hrs", label: "Avg. Turnaround" },
        { value: "99.2%", label: "Perfect Fit Rate" },
        { value: "#1", label: "Rated Digital Lab" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        {([0,1,2,3] as const).map(i => (
          <g key={i} transform={`translate(${8 + i * 28}, 20)`}>
            <rect width="22" height="7" rx="1" fill="#003A30" opacity="0.8" />
            <rect width="18" height="5" rx="1" fill="#94a3b8" opacity="0.5" y="11" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "logo-wall",
    label: "Logo Wall",
    category: "Social Proof",
    defaultProps: (): LogoWallBlockProps => ({
      eyebrow: "Trusted by teams at",
      grayscale: true,
      logos: [
        { name: "Northwind" },
        { name: "Lumina" },
        { name: "Vertex" },
        { name: "Cobalt" },
        { name: "Mirador" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#ffffff" rx="4" />
        <rect x="20" y="16" width="80" height="3" rx="1.5" fill="#cbd5e1" />
        {([0, 1, 2].map(i => (
          <g key={i} transform={`translate(${14 + i * 34}, 32)`}>
            <rect width="10" height="10" rx="2" fill="#94a3b8" opacity="0.5" />
            <rect x="14" y="2" width="18" height="6" rx="1.5" fill="#94a3b8" opacity="0.5" />
          </g>
        )))}
        {([0, 1].map(i => (
          <g key={`b${i}`} transform={`translate(${31 + i * 34}, 50)`}>
            <rect width="10" height="10" rx="2" fill="#94a3b8" opacity="0.5" />
            <rect x="14" y="2" width="18" height="6" rx="1.5" fill="#94a3b8" opacity="0.5" />
          </g>
        )))}
      </svg>
    ),
  },
  {
    type: "logo-marquee",
    label: "Logo Marquee",
    category: "Social Proof",
    defaultProps: (): LogoMarqueeBlockProps => ({
      eyebrow: "Powering teams everywhere",
      grayscale: true,
      twoRows: true,
      speed: "medium",
      logos: [
        { name: "Northwind" },
        { name: "Lumina" },
        { name: "Vertex" },
        { name: "Cobalt" },
        { name: "Mirador" },
        { name: "Solstice" },
        { name: "Equinox" },
        { name: "Zenith" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#ffffff" rx="4" />
        {([0, 1, 2, 3].map(i => (
          <g key={i} transform={`translate(${6 + i * 30}, 22)`}>
            <rect width="9" height="9" rx="2" fill="#94a3b8" opacity="0.5" />
            <rect x="12" y="2" width="14" height="5" rx="1.5" fill="#94a3b8" opacity="0.5" />
          </g>
        )))}
        {([0, 1, 2, 3].map(i => (
          <g key={`b${i}`} transform={`translate(${18 + i * 30}, 42)`}>
            <rect width="9" height="9" rx="2" fill="#94a3b8" opacity="0.5" />
            <rect x="12" y="2" width="14" height="5" rx="1.5" fill="#94a3b8" opacity="0.5" />
          </g>
        )))}
        <rect width="16" height="70" fill="url(#lmqL)" />
        <rect x="104" width="16" height="70" fill="url(#lmqR)" />
        <defs>
          <linearGradient id="lmqL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <linearGradient id="lmqR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" /></linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    type: "rating-badges",
    label: "Rating Badges",
    category: "Social Proof",
    defaultProps: (): RatingBadgesBlockProps => ({
      eyebrow: "Rated excellent across the web",
      ratingMax: 5,
      badges: [
        { platform: "ReviewHub", rating: 4.9, reviewCount: "1,240 reviews", award: "Top Rated" },
        { platform: "SoftRank", rating: 4.8, reviewCount: "860 reviews", award: "Leader", featured: true },
        { platform: "TrustScore", rating: 4.9, reviewCount: "2,100 reviews", award: "Excellent" },
        { platform: "PeerVoice", rating: 4.7, reviewCount: "540 reviews", award: "High Performer" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        {([0, 1, 2].map(i => (
          <g key={i} transform={`translate(${8 + i * 36}, 14)`}>
            <rect width="30" height="42" rx="4" fill={i === 1 ? "#0f172a" : "#ffffff"} stroke={i === 1 ? "#6366f1" : "#e2e8f0"} />
            <rect x="6" y="8" width="18" height="4" rx="1" fill={i === 1 ? "#fff" : "#475569"} opacity="0.7" />
            {([0, 1, 2, 3, 4].map(s => (
              <circle key={s} cx={7 + s * 4} cy="20" r="1.6" fill="#f59e0b" />
            )))}
            <rect x="6" y="28" width="18" height="8" rx="2" fill="#6366f1" opacity={i === 1 ? 1 : 0.2} />
          </g>
        )))}
      </svg>
    ),
  },
  {
    type: "avatar-social-proof",
    label: "Avatar Social Proof",
    category: "Social Proof",
    defaultProps: (): AvatarSocialProofBlockProps => ({
      headline: "Join 12,000+ teams who switched",
      extraCountLabel: "+2k",
      rating: 4.9,
      ratingMax: 5,
      reviewSummary: "average from 2,400+ reviews",
      testimonialQuote: "Switching was the best decision we made this year — onboarding took an afternoon.",
      testimonialAuthor: "Dr. Jane Smith, Bright Dental",
      avatars: [
        { initials: "AR" },
        { initials: "MK" },
        { initials: "JL" },
        { initials: "TS" },
        { initials: "DP" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#ffffff" rx="4" />
        {(["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"].map((c, i) => (
          <circle key={i} cx={42 + i * 9} cy="20" r="6" fill={c} stroke="#fff" strokeWidth="1.5" />
        )))}
        <circle cx="78" cy="20" r="6" fill="#6366f1" stroke="#fff" strokeWidth="1.5" />
        {([0, 1, 2, 3, 4].map(s => (
          <circle key={s} cx={48 + s * 6} cy="38" r="2" fill="#f59e0b" />
        )))}
        <rect x="30" y="46" width="60" height="5" rx="2" fill="#0f172a" opacity="0.8" />
        <rect x="40" y="56" width="40" height="3" rx="1.5" fill="#94a3b8" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "pas-section",
    label: "PAS Section",
    category: "Content",
    defaultProps: (): PasSectionBlockProps => ({
      headline: "Your lab is costing you more than money.",
      body: "Every remake is a missed appointment slot. Every three-week turnaround is a patient who calls to ask 'is it ready yet?' — and considers switching practices.",
      bullets: [
        "Remakes eating into your margins with no explanation",
        "No visibility — you call, they say 'still in production'",
        "Inconsistent fits that lead to chair-side adjustments",
        "3–4 week waits that frustrate your best patients",
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="10" width="70" height="7" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="10" y="22" width="100" height="4" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="10" y="29" width="90" height="4" rx="1" fill="#94a3b8" opacity="0.4" />
        {([0,1,2,3] as const).map(i => (
          <g key={i} transform={`translate(10, ${40 + i * 8})`}>
            <circle cx="3" cy="3" r="2" fill="#C7E738" />
            <rect x="8" y="1" width="60" height="4" rx="1" fill="#94a3b8" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "comparison",
    label: "Comparison",
    category: "Content",
    defaultProps: (): ComparisonBlockProps => ({
      headline: "A paradigm shift for your practice.",
      ctaText: "Get Started Free",
      ctaUrl: "#",
      oldWayLabel: "Traditional Lab",
      oldWayBullets: [
        "Remake-prone analog workflows",
        "Annoying calls saying your scan is bad",
        "2–3 week waits for zirconia crowns",
        "Multiple labs, none specializing",
      ],
      newWayLabel: "Dandy",
      newWayBullets: [
        "Scan for everything with fewer remakes",
        "Get scans reviewed with patient in chair",
        "5-day zirconia crowns",
        "One lab for everything",
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="50" height="54" rx="3" fill="#fee2e2" opacity="0.7" />
        <rect x="62" y="8" width="50" height="54" rx="3" fill="#dcfce7" opacity="0.7" />
        <rect x="14" y="16" width="38" height="4" rx="1" fill="#ef4444" opacity="0.6" />
        <rect x="68" y="16" width="38" height="4" rx="1" fill="#003A30" opacity="0.7" />
        {([0,1,2] as const).map(i => (
          <g key={i}>
            <rect x="14" y={26 + i * 10} width="32" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
            <rect x="68" y={26 + i * 10} width="32" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "stat-callout",
    label: "Stat Callout",
    category: "Social Proof",
    defaultProps: (): StatCalloutBlockProps => ({
      stat: "89%",
      description: "Average reduction in remakes when partnering with Dandy",
      footnote: "Based on statistics from real dentists who switched from traditional labs.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <text x="60" y="36" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#C7E738" fontFamily="sans-serif">89%</text>
        <rect x="25" y="44" width="70" height="4" rx="1" fill="white" opacity="0.4" />
        <rect x="35" y="52" width="50" height="3" rx="1" fill="white" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "benefits-grid",
    label: "Benefits Grid",
    category: "Grid Pieces",
    defaultProps: (): BenefitsGridBlockProps => ({
      headline: "Why 12,000+ dentists switched to Dandy",
      columns: 3,
      items: [
        { icon: "Zap", title: "5-Day Crowns", description: "Same-day scans shipped overnight. Your patients stop waiting — and stop cancelling." },
        { icon: "ScanLine", title: "No More Impressions", description: "Digital scans sent directly from your iTero or 3Shape. No putty, no remakes, no mess." },
        { icon: "RefreshCcw", title: "Free Remakes", description: "If a case doesn't fit, we remake it for free. No questions, no arguments." },
        { icon: "HeadphonesIcon", title: "Dedicated Lab Tech", description: "A real person answers your calls. Your cases, your preferences, remembered every time." },
        { icon: "BarChart2", title: "Real-Time Case Tracking", description: "Know exactly where every case is — from scan to delivery — on your phone or desktop." },
        { icon: "DollarSign", title: "Transparent Pricing", description: "Flat per-unit pricing. No surprises, no hidden fees, no annual contracts." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="8" width="70" height="6" rx="2" fill="#003A30" opacity="0.7" />
        {([0,1,2,3,4,5] as const).map(i => (
          <g key={i} transform={`translate(${10 + (i % 3) * 36}, ${22 + Math.floor(i / 3) * 22})`}>
            <rect width="30" height="18" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <rect x="4" y="4" width="8" height="6" rx="1" fill="#C7E738" opacity="0.7" />
            <rect x="4" y="12" width="18" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "testimonial",
    label: "Testimonial",
    category: "Social Proof",
    defaultProps: (): TestimonialBlockProps => ({
      quote: "Switching to Dandy was the single best business decision I made last year. My remakes dropped from 11% to under 1%, and my patients actually compliment how fast their restorations arrive.",
      author: "Dr. Sarah Chen",
      role: "General Dentist",
      practiceName: "Bright Smile Family Dentistry, Austin TX",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f0fdf4" rx="4" />
        <text x="14" y="24" fontSize="28" fill="#003A30" opacity="0.5" fontFamily="serif">"</text>
        <rect x="22" y="14" width="86" height="4" rx="1" fill="#003A30" opacity="0.4" />
        <rect x="22" y="22" width="78" height="4" rx="1" fill="#003A30" opacity="0.3" />
        <rect x="22" y="30" width="60" height="4" rx="1" fill="#003A30" opacity="0.2" />
        <circle cx="20" cy="52" r="8" fill="#94a3b8" opacity="0.4" />
        <rect x="32" y="48" width="40" height="4" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="32" y="56" width="30" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
      </svg>
    ),
  },
  {
    type: "how-it-works",
    label: "How It Works",
    category: "Content",
    defaultProps: (): HowItWorksBlockProps => ({
      headline: "Simple to start. Even simpler to stay.",
      steps: [
        { number: "01", title: "Scan & Send", description: "Take an intraoral scan with your existing scanner. Send it to Dandy in seconds." },
        { number: "02", title: "We Manufacture", description: "Your case enters Dandy's digital lab immediately. A dedicated tech reviews every scan." },
        { number: "03", title: "Delivered to Your Door", description: "Your restoration arrives in 5 business days — tracked the whole way." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="8" width="70" height="6" rx="2" fill="#003A30" opacity="0.7" />
        {([0,1,2] as const).map(i => (
          <g key={i} transform={`translate(${10 + i * 36}, 22)`}>
            <circle cx="12" cy="12" r="12" fill="#003A30" opacity="0.15" />
            <text x="12" y="16" textAnchor="middle" fontSize="8" fill="#003A30" opacity="0.7" fontFamily="sans-serif" fontWeight="bold">0{i + 1}</text>
            <rect x="0" y="28" width="24" height="4" rx="1" fill="#003A30" opacity="0.5" />
            <rect x="0" y="36" width="20" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "product-grid",
    label: "Product Grid",
    category: "Grid Pieces",
    defaultProps: (): ProductGridBlockProps => ({
      headline: "The better way to do lab work.",
      subheadline: "Perfect fit. Fast turnarounds. One connected system.",
      items: [
        { image: "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?q=80&w=600&h=400&fit=crop", title: "Dentures", description: "2-appointment dentures using Dandy's streamlined digital workflow." },
        { image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&h=400&fit=crop", title: "Posterior Crowns", description: "AI-perfected posterior crowns in 5 days." },
        { image: "https://images.unsplash.com/photo-1516914943479-89db7d9ae7f3?q=80&w=600&h=400&fit=crop", title: "Anterior Crowns", description: "Premium anterior crowns for stunning aesthetics." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="30" y="8" width="60" height="5" rx="1" fill="#003A30" opacity="0.6" />
        {([0,1,2] as const).map(i => (
          <g key={i} transform={`translate(${8 + i * 36}, 18)`}>
            <rect width="28" height="20" rx="2" fill="#e2e8f0" />
            <rect width="28" height="8" rx="1" fill="#94a3b8" opacity="0.5" y="24" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "photo-strip",
    label: "Photo Strip",
    category: "Layout",
    defaultProps: (): PhotoStripBlockProps => ({
      images: [
        { src: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&fit=crop", alt: "Dental restoration" },
        { src: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=600&fit=crop", alt: "Dental lab work" },
        { src: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=600&fit=crop", alt: "Digital dental scan" },
        { src: "https://images.unsplash.com/photo-1516914943479-89db7d9ae7f3?q=80&w=600&fit=crop", alt: "Dental care" },
        { src: "https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=600&fit=crop", alt: "Smile transformation" },
      ],
      grayscale: false,
      revealColorOnHover: false,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#1e293b" rx="4" />
        {([0,1,2,3,4] as const).map(i => (
          <rect key={i} x={4 + i * 23} y="8" width="20" height="54" rx="2" fill="#334155" />
        ))}
      </svg>
    ),
  },
  {
    type: "bottom-cta",
    label: "Bottom CTA",
    category: "CTA",
    defaultProps: (): BottomCtaBlockProps => ({
      headline: "Ready to upgrade your lab — with zero risk?",
      subheadline: "No contracts. No setup fees. Free shipping both ways.",
      ctaText: "Get Started Free",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="20" y="12" width="80" height="8" rx="2" fill="white" opacity="0.7" />
        <rect x="30" y="24" width="60" height="4" rx="1" fill="white" opacity="0.3" />
        <rect x="38" y="36" width="44" height="14" rx="7" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "video-section",
    label: "Video Section",
    category: "Content",
    defaultProps: (): VideoSectionBlockProps => ({
      layout: "full-width",
      headline: "",
      subheadline: "",
      ctaText: "",
      ctaUrl: "",
      videoUrl: "",
      aspectRatio: "16/9",
      backgroundStyle: "white",
      videoAutoplay: false,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f1f5f9" rx="4" />
        <rect x="15" y="10" width="90" height="50" rx="3" fill="#e2e8f0" />
        <polygon points="52,28 52,42 66,35" fill="#003A30" />
        <rect x="30" y="62" width="60" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "case-studies",
    label: "Case Studies",
    category: "Social Proof",
    defaultProps: (): CaseStudiesBlockProps => ({
      headline: "Customer Stories",
      subheadline: "",
      items: [
        { image: "", logoUrl: "", title: "How Acme unified operations across 10+ locations", categories: "SOFTWARE & TECHNOLOGY / ENTERPRISE", url: "#" },
        { image: "", logoUrl: "", title: "Beacon saves 100+ hours a month on compliance", categories: "PUBLIC SECTOR / MID-SIZE", url: "#" },
        { image: "", logoUrl: "", title: "From 2 months to 2 days: cutting audit timelines in half", categories: "HEALTHCARE & BIOTECH / ENTERPRISE", url: "#" },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="5" y="5" width="48" height="60" rx="3" fill="#e2e8f0" />
        <rect x="10" y="48" width="30" height="4" rx="1" fill="white" />
        <rect x="10" y="54" width="20" height="3" rx="1" fill="white" opacity="0.6" />
        <rect x="57" y="5" width="28" height="28" rx="3" fill="#e2e8f0" />
        <rect x="60" y="18" width="16" height="3" rx="1" fill="white" />
        <rect x="89" y="5" width="28" height="28" rx="3" fill="#e2e8f0" />
        <rect x="92" y="18" width="16" height="3" rx="1" fill="white" />
        <rect x="57" y="37" width="28" height="28" rx="3" fill="#e2e8f0" />
        <rect x="89" y="37" width="28" height="28" rx="3" fill="#e2e8f0" />
      </svg>
    ),
  },
  {
    type: "resources",
    label: "Resources",
    category: "Content",
    defaultProps: (): ResourcesBlockProps => ({
      headline: "Resources",
      subheadline: "Insights, guides, and articles to help you grow.",
      columns: 3,
      items: [
        { image: "", title: "Getting Started Guide", description: "Everything you need to know to hit the ground running.", category: "Guide", url: "#" },
        { image: "", title: "Best Practices for Growth", description: "Proven strategies from industry leaders.", category: "Article", url: "#" },
        { image: "", title: "2025 Industry Report", description: "Key trends and benchmarks for the year ahead.", category: "Report", url: "#" },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="5" y="5" width="33" height="22" rx="2" fill="#e2e8f0" />
        <rect x="5" y="30" width="28" height="3" rx="1" fill="#334155" />
        <rect x="5" y="35" width="33" height="2" rx="1" fill="#94a3b8" />
        <rect x="43" y="5" width="33" height="22" rx="2" fill="#e2e8f0" />
        <rect x="43" y="30" width="28" height="3" rx="1" fill="#334155" />
        <rect x="43" y="35" width="33" height="2" rx="1" fill="#94a3b8" />
        <rect x="82" y="5" width="33" height="22" rx="2" fill="#e2e8f0" />
        <rect x="82" y="30" width="28" height="3" rx="1" fill="#334155" />
        <rect x="82" y="35" width="33" height="2" rx="1" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    type: "rich-text",
    label: "Rich Text",
    category: "Content",
    defaultProps: (): RichTextBlockProps => ({
      html: "<p>Start writing your content here. Use the toolbar to format text with <strong>headings</strong>, <em>emphasis</em>, lists, and more.</p>",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="104" height="6" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="20" width="90" height="3" rx="1" fill="#94a3b8" opacity="0.6" />
        <rect x="8" y="27" width="100" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="8" y="34" width="80" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
        <circle cx="12" cy="45" r="2" fill="#C7E738" />
        <rect x="18" y="43" width="60" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
        <circle cx="12" cy="53" r="2" fill="#C7E738" />
        <rect x="18" y="51" width="50" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
      </svg>
    ),
  },
  {
    type: "spacer",
    label: "Spacer",
    category: "Layout",
    defaultProps: (): SpacerBlockProps => ({ height: 64, backgroundColor: "transparent" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <line x1="10" y1="20" x2="110" y2="20" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="10" y1="50" x2="110" y2="50" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="60" y="38" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">Spacer</text>
        <path d="M60 24 L60 28 M57 26 L60 23 L63 26" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
        <path d="M60 46 L60 42 M57 44 L60 47 L63 44" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "custom-html",
    label: "Custom HTML",
    category: "Content",
    defaultProps: (): CustomHtmlBlockProps => ({
      html: "",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#1e1e2e" rx="4" />
        <text x="8" y="22" fontSize="9" fontFamily="monospace" fill="#89b4fa">&lt;div</text>
        <text x="36" y="22" fontSize="9" fontFamily="monospace" fill="#a6e3a1"> class=</text>
        <text x="74" y="22" fontSize="9" fontFamily="monospace" fill="#f38ba8">"block"</text>
        <text x="104" y="22" fontSize="9" fontFamily="monospace" fill="#89b4fa">&gt;</text>
        <rect x="14" y="27" width="60" height="3" rx="1" fill="#cdd6f4" opacity="0.4" />
        <rect x="14" y="34" width="80" height="3" rx="1" fill="#cdd6f4" opacity="0.3" />
        <text x="8" y="48" fontSize="9" fontFamily="monospace" fill="#89b4fa">&lt;/div&gt;</text>
      </svg>
    ),
  },
  {
    type: "zigzag-features",
    label: "Zigzag Features",
    category: "Content",
    defaultProps: (): ZigzagFeaturesBlockProps => ({
      rows: [
        {
          tag: "SPEED",
          headline: "5-Day Turnarounds, Every Time",
          body: "Dandy's digital-first lab ships crowns, bridges, and implants in just 5 business days — tracked end-to-end so you always know where your case is.",
          ctaText: "Learn more",
          ctaUrl: "#",
          imageUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&h=600&fit=crop",
        },
        {
          tag: "ACCURACY",
          headline: "Perfect Fit, Guaranteed",
          body: "AI-powered scan analysis catches issues before manufacturing. If a case doesn't fit, we remake it free — no questions asked.",
          ctaText: "Learn more",
          ctaUrl: "#",
          imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=800&h=600&fit=crop",
        },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="6" y="8" width="48" height="22" rx="2" fill="#e2e8f0" />
        <rect x="62" y="8" width="52" height="5" rx="1" fill="#C7E738" opacity="0.7" />
        <rect x="62" y="17" width="48" height="3" rx="1" fill="#003A30" opacity="0.6" />
        <rect x="62" y="24" width="44" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="62" y="40" width="48" height="22" rx="2" fill="#e2e8f0" />
        <rect x="6" y="40" width="52" height="5" rx="1" fill="#C7E738" opacity="0.7" />
        <rect x="6" y="49" width="48" height="3" rx="1" fill="#003A30" opacity="0.6" />
        <rect x="6" y="56" width="44" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "product-showcase",
    label: "Product Showcase",
    category: "Content",
    defaultProps: (): ProductShowcaseBlockProps => ({
      headline: "Everything Your Practice Needs",
      subheadline: "One lab for all your restorations — delivered faster and with better fit.",
      columns: 3,
      cards: [
        { name: "Crowns & Bridges", description: "Zirconia, PFM, and full-cast options with 5-day turnaround.", badge: "FROM $69/UNIT" },
        { name: "Implant Restorations", description: "Custom abutments and crowns for all major implant systems.", badge: "FROM $149/UNIT" },
        { name: "Dentures", description: "Complete and partial dentures using a streamlined 2-appointment workflow.", badge: "FROM $299/UNIT" },
        { name: "Aligners", description: "Clear aligner therapy powered by Dandy's digital workflow.", badge: "FROM $99/CASE" },
        { name: "Night Guards", description: "Hard and soft night guards with same-week turnaround.", badge: "FROM $49/UNIT" },
        { name: "Veneers", description: "Premium feldspathic and pressed porcelain veneers.", badge: "FROM $99/UNIT" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="20" y="6" width="80" height="5" rx="1" fill="#003A30" opacity="0.7" />
        <rect x="25" y="14" width="70" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
        {([0,1,2] as const).map(i => (
          <g key={i} transform={`translate(${5 + i * 38}, 22)`}>
            <rect width="33" height="38" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <rect x="4" y="4" width="25" height="3" rx="1" fill="#003A30" opacity="0.7" />
            <rect x="4" y="10" width="22" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
            <rect x="4" y="14" width="22" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
            <rect x="4" y="22" width="25" height="8" rx="2" fill="#C7E738" opacity="0.6" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "nav-header",
    label: "Nav Header",
    category: "Layout",
    defaultProps: (): NavHeaderBlockProps => ({
      logoText: "Dandy",
      logoUrl: "",
      navLinks: [
        { label: "Products", url: "#" },
        { label: "How It Works", url: "#" },
        { label: "Pricing", url: "#" },
        { label: "Resources", url: "#" },
      ],
      phone: "1-800-DANDY-LAB",
      cta1: { label: "Log In", url: "#" },
      cta2: { label: "Get Started Free", url: "#" },
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect width="120" height="20" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x="6" y="7" width="18" height="6" rx="1" fill="#003A30" opacity="0.8" />
        {([0,1,2,3] as const).map(i => (
          <rect key={i} x={34 + i * 14} y="9" width="10" height="3" rx="1" fill="#94a3b8" opacity="0.6" />
        ))}
        <rect x="80" y="6" width="16" height="8" rx="4" fill="#e2e8f0" />
        <rect x="99" y="6" width="16" height="8" rx="4" fill="#003A30" opacity="0.8" />
        <rect x="8" y="28" width="60" height="5" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="8" y="37" width="90" height="3" rx="1" fill="#94a3b8" opacity="0.3" />
        <rect x="8" y="44" width="80" height="3" rx="1" fill="#94a3b8" opacity="0.25" />
      </svg>
    ),
  },
  {
    type: "cta-button",
    label: "CTA Button",
    category: "CTA",
    defaultProps: (): CtaButtonBlockProps => ({
      label: "Get Started Free",
      url: "#",
      style: "primary",
      size: "medium",
      alignment: "center",
      bgColor: "#C7E738",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="25" y="25" width="70" height="20" rx="10" fill="#C7E738" />
        <rect x="35" y="31" width="50" height="8" rx="2" fill="#003A30" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "footer",
    label: "Footer",
    category: "Layout",
    defaultProps: (): FooterBlockProps => ({
      backgroundColor: "#003A30",
      accentColor: "#C7E738",
      copyrightText: `© ${new Date().getFullYear()} Dandy. All rights reserved.`,
      showSocialLinks: false,
      facebookUrl: "",
      instagramUrl: "",
      linkedinUrl: "",
      columns: [
        {
          title: "Dandy",
          links: [
            { label: "Home", url: "https://www.meetdandy.com/" },
            { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
            { label: "Get in touch", url: "https://www.meetdandy.com/get-in-touch/" },
            { label: "Dandy Reviews", url: "https://www.meetdandy.com/reviews/" },
            { label: "Careers", url: "https://www.meetdandy.com/careers/" },
            // Compliance/legal links — match meetdandy.com's own footer
            // ordering. The OneTrust "Do Not Sell or Share My Personal
            // Information" trigger is appended automatically by BlockFooter
            // immediately after any link labelled "Privacy Requests" (case-
            // insensitive), so it lands as the final item in this column
            // without needing a separate entry here. See BlockFooter.tsx.
            { label: "Privacy Policy", url: "https://www.meetdandy.com/privacy/" },
            { label: "Terms of Use", url: "https://www.meetdandy.com/terms-of-use/" },
            { label: "Privacy Requests", url: "https://www.meetdandy.com/privacy-requests/" },
          ],
        },
        {
          title: "Products & Technology",
          links: [
            { label: "Lab Services", url: "https://www.meetdandy.com/lab-services/" },
            { label: "Posterior Crown and Bridge", url: "https://www.meetdandy.com/posterior-crown-and-bridge/" },
            { label: "Digital Dentures", url: "https://www.meetdandy.com/digital-dentures/" },
            { label: "Implant Solutions", url: "https://www.meetdandy.com/implant-solutions/" },
            { label: "Clear Aligners", url: "https://www.meetdandy.com/clear-aligners/" },
          ],
        },
        {
          title: "Practices",
          links: [
            { label: "Private Practice", url: "https://www.meetdandy.com/solutions/private-practice/" },
            { label: "Group Practice", url: "https://www.meetdandy.com/solutions/group-practice/" },
            { label: "DSO", url: "https://www.meetdandy.com/solutions/dso/" },
            { label: "Login", url: "https://app.meetdandy.com/" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Learning Center", url: "https://www.meetdandy.com/learning-center/" },
            { label: "Articles", url: "https://www.meetdandy.com/articles/" },
            { label: "Webinars", url: "https://www.meetdandy.com/webinars/" },
            { label: "Newsroom", url: "https://www.meetdandy.com/newsroom/" },
          ],
        },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="8" y="10" width="20" height="5" rx="1" fill="white" opacity="0.7" />
        {([0,1,2,3] as const).map(i => (
          <g key={i} transform={`translate(${8 + i * 28}, 22)`}>
            <rect width="16" height="3" rx="1" fill="#C7E738" opacity="0.8" />
            <rect width="22" height="2" rx="1" fill="white" opacity="0.3" y="6" />
            <rect width="18" height="2" rx="1" fill="white" opacity="0.3" y="11" />
            <rect width="20" height="2" rx="1" fill="white" opacity="0.3" y="16" />
          </g>
        ))}
        <rect x="8" y="58" width="50" height="2" rx="1" fill="white" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "full-bleed-hero",
    label: "Full Bleed Hero",
    category: "Layout",
    defaultProps: (): FullBleedHeroBlockProps => ({
      headline: "The dental lab your practice has been waiting for",
      subheadline: "Dandy's digital-first lab delivers crowns, bridges, and implants in 5 days — with the fit rate, turnaround, and AI scan review your old lab never came close to.",
      ctaText: "Get started",
      ctaUrl: "#",
      ctaAction: "modal-form",
      modalHeadline: "See Dandy in action",
      modalSubheadline: "Enter your work email and we'll book a 20-minute walkthrough with your practice.",
      modalSubmitText: "Request a demo",
      modalSuccessMessage: "Thanks — a Dandy specialist will reach out shortly.",
      modalShowFirstName: true,
      modalShowLastName: true,
      modalShowPhone: false,
      modalShowCompany: true,
      secondaryCtaText: "See how it works",
      secondaryCtaUrl: "#",
      backgroundType: "video",
      backgroundVideoUrl: "/videos/dandy-broll.mp4",
      backgroundImageUrl: "",
      videoAutoplay: true,
      overlayColor: "#001A14",
      overlayOpacity: 55,
      minHeight: "full",
      contentAlignment: "center",
      logoImageUrl: "",
      logoUrl: "#",
      navLinks: [
        { label: "Products", url: "#" },
        { label: "How It Works", url: "#" },
        { label: "Pricing", url: "#" },
      ],
      headerCtaText: "Get started",
      headerCtaUrl: "#",
      headerScrolledBg: "#003A30",
      showSocialProof: true,
      socialProofText: "Trusted by 12,000+ dental practices across the US",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="fbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#003A30" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#001a16" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width="120" height="70" fill="url(#fbg)" rx="4" />
        <rect width="120" height="12" fill="rgba(0,0,0,0)" rx="0" />
        <rect x="6" y="4" width="14" height="4" rx="1" fill="white" opacity="0.8" />
        <rect x="38" y="5" width="8" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="50" y="5" width="8" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="62" y="5" width="8" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="90" y="3" width="24" height="7" rx="3.5" fill="#C7E738" />
        <rect x="8" y="22" width="72" height="8" rx="2" fill="white" opacity="0.95" />
        <rect x="8" y="34" width="60" height="6" rx="1.5" fill="white" opacity="0.55" />
        <rect x="8" y="44" width="28" height="10" rx="5" fill="#C7E738" />
        <rect x="40" y="44" width="28" height="10" rx="5" fill="rgba(255,255,255,0.15)" />
      </svg>
    ),
  },
  {
    type: "parallax-image-hero",
    label: "Parallax Image Hero",
    category: "Layout",
    defaultProps: (): ParallaxImageHeroBlockProps => ({
      imageUrl: "",
      eyebrow: "● NOW AVAILABLE",
      referenceLabel: "01",
      headline: "Build something remarkable.",
      headlineAccentWord: "remarkable",
      ctaText: "",
      ctaUrl: "",
      ctaStyle: "link",
      brandMark: "",
      brandMarkLogoUrl: "",
      overlayOpacity: 35,
      overlayColor: "#000000",
      parallaxStrength: 0.35,
      minHeight: "full",
      textColor: "#FFFFFF",
      edgeFade: "none",
      edgeFadeColor: "#0a0a0a",
      edgeFadeSize: 25,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="pxh" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#3a3a3a" />
          </linearGradient>
        </defs>
        <rect width="120" height="70" fill="url(#pxh)" rx="4" />
        <circle cx="6" cy="6" r="1" fill="#C7E738" />
        <rect x="10" y="5" width="40" height="2" rx="1" fill="white" opacity="0.85" />
        <rect x="100" y="5" width="14" height="2" rx="1" fill="white" opacity="0.6" />
        <rect x="6" y="30" width="60" height="6" rx="1" fill="white" opacity="0.95" />
        <rect x="6" y="40" width="14" height="6" rx="1" fill="#C7E738" opacity="0.95" />
        <rect x="22" y="40" width="34" height="6" rx="1" fill="white" opacity="0.95" />
        <rect x="6" y="60" width="22" height="3" rx="1" fill="white" opacity="0.85" />
        <rect x="6" y="64" width="22" height="0.6" fill="white" opacity="0.7" />
        <rect x="98" y="61" width="16" height="4" rx="1" fill="white" opacity="0.95" />
      </svg>
    ),
  },
  {
    type: "form",
    label: "Lead Capture Form",
    category: "Lead Capture",
    defaultProps: (): FormBlockProps => ({
      headline: "Get in Touch",
      subheadline: "Fill out the form below and we'll get back to you shortly.",
      multiStep: false,
      steps: [
        {
          title: "Your Information",
          fields: [
            { id: "field-name", type: "text", label: "Full Name", placeholder: "Jane Smith", required: true },
            { id: "field-email", type: "email", label: "Email Address", placeholder: "jane@example.com", required: true },
            { id: "field-phone", type: "phone", label: "Phone Number", placeholder: "(555) 000-0000", required: false },
            { id: "field-message", type: "textarea", label: "Message", placeholder: "How can we help?", required: false },
          ],
        },
      ],
      submitButtonText: "Submit",
      successMessage: "Thank you! We'll be in touch soon.",
      redirectUrl: "",
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="8" width="60" height="6" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="10" y="18" width="100" height="7" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="28" width="100" height="7" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="38" width="100" height="12" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="54" width="36" height="10" rx="5" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "popup",
    label: "Popup",
    category: "Engagement",
    defaultProps: (): PopupBlockProps => ({
      headline: "Special Offer Inside",
      body: "Get 20% off your first order when you sign up today.",
      ctaText: "Claim Offer",
      ctaUrl: "#",
      ctaColor: "#C7E738",
      imageUrl: "",
      trigger: "time-delay",
      triggerValue: 5,
      showOnce: true,
      overlayOpacity: 50,
      position: "center",
      backgroundStyle: "white",
      ctaType: "url",
      chilipiperUrl: "",
      chilipiperCaptureName: false,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="20" y="10" width="80" height="50" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="30" y="18" width="60" height="6" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="30" y="28" width="60" height="4" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="30" y="35" width="60" height="4" rx="1" fill="#94a3b8" opacity="0.3" />
        <rect x="40" y="45" width="40" height="8" rx="4" fill="#C7E738" />
        <rect x="15" y="5" width="4" height="60" fill="#000000" opacity="0.2" />
        <rect x="15" y="5" width="90" height="4" fill="#000000" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "sticky-bar",
    label: "Sticky Bar",
    category: "Engagement",
    defaultProps: (): StickyBarBlockProps => ({
      text: "Limited time: Get 20% off your first purchase",
      ctaText: "Shop Now",
      ctaUrl: "#",
      ctaColor: "#C7E738",
      position: "top",
      backgroundStyle: "dark",
      showAfterScroll: 0,
      dismissible: true,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="15" width="100" height="10" rx="2" fill="#003A30" />
        <rect x="15" y="19" width="60" height="3" rx="1" fill="white" opacity="0.7" />
        <rect x="80" y="17" width="25" height="6" rx="3" fill="#C7E738" />
        <circle cx="110" cy="20" r="2" fill="white" opacity="0.7" />
        <rect x="10" y="32" width="100" height="25" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="20" y="40" width="60" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="20" y="47" width="50" height="3" rx="1" fill="#94a3b8" opacity="0.3" />
      </svg>
    ),
  },
  {
    type: "sticky-header",
    label: "Sticky Hero Header",
    category: "Layout",
    defaultProps: (): StickyHeaderBlockProps => ({
      logoUrl: "",
      logoAlt: "Dandy",
      companyName: "",
      navLinks: [
        { label: "Platform", href: "#platform" },
        { label: "Solutions", href: "#solutions" },
        { label: "Results", href: "#results" },
        { label: "Pricing", href: "#pricing" },
      ],
      primaryCtaText: "Get Started",
      primaryCtaUrl: "#",
      theme: "dark",
      position: "fixed",
      scrollThreshold: 40,
      // This starter is the Inside-Dandy cinematic sticky header (dark
      // glass + citron CTA), so default its CTA modal to the matching dark
      // shell. Templates that drop a Sticky Hero Header onto a light page
      // can override modalTheme back to "light".
      modalTheme: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="sh-hero" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(192,30%,8%)" />
            <stop offset="100%" stopColor="hsl(152,30%,14%)" />
          </linearGradient>
        </defs>
        <rect width="120" height="70" fill="url(#sh-hero)" rx="4" />
        <rect width="120" height="14" fill="rgba(8,22,20,0.7)" />
        <rect x="8" y="5" width="14" height="4" rx="1" fill="white" opacity="0.9" />
        {[0,1,2,3].map(i => (
          <rect key={i} x={36 + i*12} y="6" width="8" height="2" rx="1" fill="white" opacity="0.5" />
        ))}
        <rect x="92" y="4" width="22" height="6" rx="3" fill="hsl(72,55%,48%)" />
        <rect x="20" y="26" width="80" height="5" rx="1" fill="white" opacity="0.85" />
        <rect x="30" y="36" width="60" height="3" rx="1" fill="white" opacity="0.45" />
        <rect x="42" y="48" width="16" height="5" rx="2.5" fill="hsl(72,55%,48%)" />
        <rect x="62" y="48" width="16" height="5" rx="2.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
      </svg>
    ),
  },
  {
    type: "roi-calculator",
    label: "ROI Calculator",
    category: "Interactive",
    defaultProps: (): RoiCalculatorBlockProps => ({
      headline: "Calculate Your Hidden Cost of Inaction",
      subheadline: "Estimate the cost of remakes and lost chair time across your practice.",
      backgroundStyle: "white",
      resultsPanelLabel: "Your Results",
      disclaimer: "Calculations based on per-practice estimates. Actual results may vary.",
      ctaEnabled: true,
      ctaText: "Book a Demo",
      ctaUrl: "#",
      ctaAction: "url",
      chilipiperUrl: "",
      inputFields: [
        { id: "practices", label: "Number of Practices", defaultValue: 1, min: 1, max: 2000, step: 1, inputType: "number" },
        { id: "restoCases", label: "Fixed Resto Cases / Month", defaultValue: 250, min: 1, max: 9999, step: 1, inputType: "number" },
        { id: "avgCaseValue", label: "Average Case Value", defaultValue: 1500, min: 100, max: 10000, step: 50, prefix: "$", inputType: "number" },
        { id: "currentRemakeRate", label: "Current Remake Rate (%)", defaultValue: 5, min: 0.5, max: 20, step: 0.5, suffix: "%", inputType: "slider" },
        { id: "improvedRemakeRate", label: "Improved Remake Rate (%)", defaultValue: 2, min: 0, max: 20, step: 0.5, suffix: "%", inputType: "slider" },
        { id: "prodPerHour", label: "Avg Production / Hour", defaultValue: 500, min: 50, max: 5000, step: 50, prefix: "$", inputType: "number" },
        { id: "dentureCases", label: "Denture Cases / Month", defaultValue: 150, min: 0, max: 9999, step: 1, inputType: "number" },
        { id: "apptsSaved", label: "Appointments Saved per Case", defaultValue: 1.5, min: 0.5, max: 5, step: 0.5, inputType: "slider" },
        { id: "avgMinPerAppt", label: "Avg Minutes / Appointment", defaultValue: 30, min: 5, max: 120, step: 5, inputType: "number" },
        { id: "workingDays", label: "Working Days / Month", defaultValue: 20, min: 1, max: 31, step: 1, inputType: "number" },
      ],
      outputFields: [
        { id: "remakesAvoided", label: "Remakes Avoided / Month", formula: "restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)", format: "number", decimals: 1 },
        { id: "recoveredProdYear", label: "Recovered Production / Year", formula: "(restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)) * avgCaseValue * 12", format: "currency", decimals: 0 },
        { id: "dentureChairHrs", label: "Chair Hours Freed / Month", formula: "dentureCases * apptsSaved * avgMinPerAppt / 60", format: "number", decimals: 1 },
        { id: "dentureProdYear", label: "Denture Production Gain / Year", formula: "dentureCases * apptsSaved * avgMinPerAppt / 60 * prodPerHour * 12", format: "currency", decimals: 0 },
        { id: "totalAnnualUpside", label: "Total Annual Upside", formula: "((restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)) * avgCaseValue * 12 + dentureCases * apptsSaved * avgMinPerAppt / 60 * prodPerHour * 12) * practices", format: "currency", decimals: 0, highlight: true },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="65" height="5" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="8" y="17" width="60" height="4" rx="1.5" fill="#e2e8f0" />
        <rect x="8" y="17" width="36" height="4" rx="1.5" fill="#003A30" opacity="0.5" />
        <rect x="8" y="25" width="60" height="4" rx="1.5" fill="#e2e8f0" />
        <rect x="8" y="25" width="50" height="4" rx="1.5" fill="#003A30" opacity="0.4" />
        <rect x="8" y="33" width="60" height="4" rx="1.5" fill="#e2e8f0" />
        <rect x="8" y="33" width="20" height="4" rx="1.5" fill="#003A30" opacity="0.4" />
        <rect x="78" y="8" width="34" height="54" rx="4" fill="#003A30" />
        <rect x="82" y="14" width="26" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="82" y="21" width="26" height="5" rx="1.5" fill="white" opacity="0.15" />
        <rect x="82" y="30" width="26" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="82" y="37" width="26" height="5" rx="1.5" fill="white" opacity="0.15" />
        <rect x="82" y="48" width="26" height="7" rx="3.5" fill="#C7E738" />
        <rect x="8" y="52" width="48" height="6" rx="3" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "dso-insights-dashboard" as const,
    label: "DSO Insights Dashboard",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoInsightsDashboardBlockProps => ({
      eyebrow: "Dandy Hub & Insights",
      headline: "One dashboard for every location.",
      subheadline: "Dandy Insights gives {{company_name}} leaders actionable data — not just reports. Know where to intervene before problems scale, manage by exception, and maintain control as complexity increases.",
      practiceLabel: "practices",
      backgroundStyle: "muted",
      dashboardVariant: "light",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f0faf4" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="16" width="80" height="3" rx="1.5" fill="#94a3b8" opacity="0.5" />
        <rect x="8" y="24" width="104" height="38" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="26" width="20" height="6" rx="1.5" fill="#003A30" opacity="0.1" />
        <rect x="32" y="26" width="20" height="6" rx="1.5" fill="transparent" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="54" y="26" width="20" height="6" rx="1.5" fill="transparent" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="12" y="38" width="10" height="3" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="12" y="43" width="8" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="36" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="38" y="38" width="10" height="3" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="38" y="43" width="8" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="62" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="64" y="38" width="10" height="3" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="64" y="43" width="8" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="88" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="90" y="38" width="10" height="3" rx="1" fill="#C7E738" opacity="0.8" />
        <rect x="10" y="52" width="100" height="8" rx="2" fill="#e2e8f0" opacity="0.5" />
        <rect x="10" y="52" width="40" height="8" rx="2" fill="#C7E738" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "dso-lab-tour" as const,
    label: "DSO Lab Tour",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoLabTourBlockProps => ({
      eyebrow: "Built in the USA",
      headline: "See vertical integration in action.",
      body: "Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery. U.S.-based facilities, AI quality control, and expert technicians deliver a 96% first-time right rate at enterprise scale.",
      quote: "Dandy is a true partner, not just a vendor. They value education, technology, and people — that's what makes the difference.",
      quoteAttribution: "DSO Clinical Operations Officer",
      imageUrl: "https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=1400&fit=crop",
      imageAlt: "Lab manufacturing floor",
      imageEyebrow: "Lab Tour",
      imageCaption: "Inside our U.S. manufacturing facility",
      videoUrl: "",
      ctaText: "Request a Lab Tour",
      ctaUrl: "#",
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="52" height="38" rx="3" fill="#e2e8f0" />
        <rect x="8" y="8" width="52" height="38" rx="3" fill="#003A30" opacity="0.15" />
        <circle cx="34" cy="27" r="8" fill="white" opacity="0.6" />
        <polygon points="32,24 38,27 32,30" fill="#003A30" opacity="0.7" />
        <rect x="68" y="8" width="44" height="5" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="68" y="17" width="44" height="3" rx="1.5" fill="#94a3b8" opacity="0.5" />
        <rect x="68" y="22" width="36" height="3" rx="1.5" fill="#94a3b8" opacity="0.3" />
        <rect x="68" y="31" width="44" height="8" rx="2" fill="#f0faf4" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="71" y="34" width="30" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="68" y="44" width="30" height="6" rx="3" fill="#003A30" />
        <rect x="8" y="52" width="52" height="4" rx="2" fill="#94a3b8" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "dso-stat-bar" as const,
    label: "DSO Stats Bar",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoStatBarBlockProps => ({
      stats: [
        { value: "30%", label: "Avg case acceptance lift" },
        { value: "96%", label: "First-time right rate" },
        { value: "50%", label: "Denture appointments saved" },
        { value: "$0", label: "CAPEX to get started" },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#fff" rx="4" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={10 + i*28} y="20" width="22" height="6" rx="2" fill="#003A30" opacity="0.8" />
            <rect x={10 + i*28} y="30" width="18" height="3" rx="1.5" fill="#94a3b8" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-success-stories" as const,
    label: "DSO Success Stories",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoSuccessStoriesBlockProps => ({
      eyebrow: "Proven Results",
      headline: "DSOs that switched and never looked back.",
      backgroundStyle: "dandy-green",
      cases: [
        { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann, Founder", image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=800&h=480&fit=crop" },
        { name: "Smile Brands", stat: "2–3 min", label: "saved per crown appointment", quote: "The efficiency gains were immediate. Our doctors noticed the difference from the very first case.", author: "VP of Clinical Operations", image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=800&h=480&fit=crop" },
        { name: "Tend", stat: "40%", label: "faster lab turnaround", quote: "Speed matters when you're growing fast. Dandy keeps pace with our expansion without sacrificing quality.", author: "Head of Operations", image: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=800&h=480&fit=crop" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="8" y="8" width="32" height="4" rx="2" fill="white" opacity="0.7" />
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={8 + i*38} y="18" width="32" height="44" rx="3" fill="white" opacity="0.07" />
            <rect x={12 + i*38} y="22" width="14" height="6" rx="2" fill="#C7E738" opacity="0.7" />
            <rect x={12 + i*38} y="32" width="20" height="2" rx="1" fill="white" opacity="0.4" />
            <rect x={12 + i*38} y="37" width="20" height="2" rx="1" fill="white" opacity="0.3" />
            <rect x={12 + i*38} y="42" width="16" height="2" rx="1" fill="white" opacity="0.2" />
            <rect x={12 + i*38} y="53" width="12" height="2" rx="1" fill="#C7E738" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-challenges" as const,
    label: "DSO Challenges",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoChallengesBlockProps => ({
      eyebrow: "The Hidden Cost",
      headline: "At scale — even small inefficiencies compound fast.",
      backgroundStyle: "muted",
      layout: "4-col",
      challenges: [
        { title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers." },
        { title: "Fragmented Lab Relationships", desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
        { title: "Standards That Don't Survive Growth", desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
        { title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#faf9f7" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="16" width="36" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.4" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={8 + i*29} y="24" width="24" height="38" rx="3" fill="white"
              style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.07))" }} />
            <rect x={8 + i*29} y="24" width="24" height="2" rx="1" fill="#003A30" />
            <rect x={11 + i*29} y="30" width="8" height="4" rx="1.5" fill="#003A30" opacity="0.1" />
            <rect x={11 + i*29} y="38" width="16" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
            <rect x={11 + i*29} y="43" width="12" height="2" rx="1" fill="#94a3b8" opacity="0.3" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-pilot-steps" as const,
    label: "DSO Pilot Steps",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoPilotStepsBlockProps => ({
      eyebrow: "How It Works",
      headline: "Start small. Prove it out. Then scale.",
      subheadline: "Growth should be proven before it's scaled. Dandy helps validate impact with a small number of locations and then scale with confidence.",
      backgroundStyle: "muted",
      steps: [
        {
          title: "Launch a Pilot",
          subtitle: "Start with 5–10 offices",
          desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.",
          details: [
            "Premium hardware included for every operatory",
            "Dedicated field team manages change management",
            "Doctors trained and scanning within days",
          ],
        },
        {
          title: "Validate Impact",
          subtitle: "Measure results in 60–90 days",
          desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.",
          details: [
            "Live dashboard tracks pilot KPIs",
            "Compare pilot offices vs. control group",
            "Executive-ready reporting for leadership review",
          ],
        },
        {
          title: "Scale With Confidence",
          subtitle: "Roll out across the network",
          desc: "Expand across your entire network with the same standard, same playbook, and same results — predictable execution at enterprise scale.",
          details: [
            "Consistent onboarding across all locations",
            "One standard across every office and brand",
            "MSA ensures network-wide alignment at scale",
          ],
        },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#faf9f7" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <line x1="24" y1="20" x2="24" y2="62" stroke="#003A30" strokeWidth="1" opacity="0.2" />
        {[0,1,2].map(i => (
          <g key={i}>
            <circle cx="24" cy={22 + i*18} r="5" fill="#003A30" />
            <rect x="34" y={18 + i*18} width="30" height="3" rx="1.5" fill="#003A30" opacity="0.7" />
            <rect x="34" y={24 + i*18} width="50" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-final-cta" as const,
    label: "DSO Final CTA",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoFinalCtaBlockProps => ({
      eyebrow: "Next Steps",
      headline: "Prove ROI. Then scale.",
      subheadline: "Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift in real time.",
      primaryCtaText: "Get Pricing",
      primaryCtaUrl: "#",
      secondaryCtaText: "Calculate ROI",
      secondaryCtaUrl: "#",
      backgroundStyle: "dandy-green",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <circle cx="30" cy="15" r="30" fill="#C7E738" opacity="0.06" />
        <circle cx="90" cy="60" r="25" fill="#2a5240" opacity="0.5" />
        <rect x="35" y="12" width="50" height="5" rx="2.5" fill="white" opacity="0.8" />
        <rect x="25" y="22" width="70" height="3" rx="1.5" fill="white" opacity="0.4" />
        <rect x="30" y="28" width="60" height="2.5" rx="1.25" fill="white" opacity="0.3" />
        <rect x="28" y="38" width="28" height="10" rx="5" fill="#C7E738" />
        <rect x="64" y="38" width="28" height="10" rx="5" fill="transparent" stroke="white" strokeWidth="1" opacity="0.3" />
      </svg>
    ),
  },
  {
    type: "dso-comparison" as const,
    label: "DSO Comparison",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoComparisonBlockProps => ({
      eyebrow: "The Dandy Difference",
      headline: "Built for DSO scale.\nDesigned for provider trust.",
      subheadline: "Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights.",
      companyName: "Your DSO",
      ctaText: "Request a Demo",
      ctaUrl: "#",
      rows: [],
      backgroundStyle: "muted",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#faf9f7" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="18" width="104" height="7" rx="2" fill="#003A30" />
        <rect x="10" y="19.5" width="30" height="4" rx="1" fill="white" opacity="0.3" />
        <rect x="46" y="19.5" width="20" height="4" rx="1" fill="#C7E738" opacity="0.7" />
        <rect x="72" y="19.5" width="20" height="4" rx="1" fill="white" opacity="0.2" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x="8" y={28 + i*9} width="104" height="8" rx="1" fill={i%2===0?"#fff":"#faf9f7"} stroke="#e2e8f0" strokeWidth="0.5" />
            <rect x="10" y={31 + i*9} width="25" height="2" rx="1" fill="#003A30" opacity="0.6" />
            <rect x="46" y={31 + i*9} width="20" height="2" rx="1" fill="#003A30" opacity="0.4" />
            <rect x="72" y={31 + i*9} width="20" height="2" rx="1" fill="#94a3b8" opacity="0.3" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dandy-product-hero" as const,
    label: "Dandy Product Hero (Crown & Bridge style)",
    category: "Hero" as BlockCategory,
    defaultProps: (): DandyProductHeroBlockProps => ({
      eyebrow: "Crown & Bridge",
      headline: "Crown & Bridge\nDelivered in 5 Days",
      subheadline: "Premium zirconia restorations with industry-leading turnaround. Backed by Dandy's 5-year warranty.",
      emailPlaceholder: "Email address",
      primaryCtaText: "Get Started",
      primaryCtaUrl: "#",
      primaryCtaMode: "link",
      imageUrl: "",
      imageAlt: "Dandy crown",
      imageBleed: true,
      imageAnchor: "top left",
      imageScale: 1.35,
      minHeight: 90,
      backgroundColor: "#003a30",
      accentColor: "#c7e738",
      textColor: "#ffffff",
      disclaimer: "By submitting, you agree to be contacted about Dandy products and services.",
      variant: "split",
      inputStyle: "rounded",
      buttonColor: "#c7e738",
      buttonHoverColor: "#b3d028",
      buttonTextColor: "#003a30",
      leftColumnFr: 1.05,
      rightColumnFr: 1,
      cardColor: "#e8e6df",
      cardTextColor: "#0a2b25",
      imageBackgroundColor: "#ffffff",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003a30" rx="4" />
        {/* eyebrow */}
        <rect x="8" y="14" width="22" height="2" rx="1" fill="#c7e738" />
        {/* headline lines */}
        <rect x="8" y="22" width="42" height="4" rx="1" fill="#ffffff" />
        <rect x="8" y="29" width="36" height="4" rx="1" fill="#ffffff" />
        {/* sub */}
        <rect x="8" y="38" width="48" height="2" rx="1" fill="#ffffff" opacity="0.6" />
        <rect x="8" y="42" width="40" height="2" rx="1" fill="#ffffff" opacity="0.6" />
        {/* email pill */}
        <rect x="8" y="50" width="56" height="9" rx="4.5" fill="#ffffff" />
        <rect x="42" y="52" width="20" height="5" rx="2.5" fill="#c7e738" />
        {/* crown image bleed */}
        <ellipse cx="100" cy="48" rx="22" ry="22" fill="#ffffff" opacity="0.95" />
        <ellipse cx="100" cy="48" rx="14" ry="14" fill="#e5e7eb" />
        <ellipse cx="100" cy="44" rx="8" ry="6" fill="#9ca3af" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "dso-heartland-hero" as const,
    label: "DSO Heartland Hero",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoHeartlandHeroBlockProps => ({
      headline: "Built for {company}.",
      companyName: "{company}",
      eyebrow: "The Dandy Difference",
      subheadline: "The lab partner built to match your DSO's scale — precision manufacturing, AI quality control, and network-wide visibility.",
      primaryCtaText: "Schedule a Conversation",
      primaryCtaUrl: "#",
      secondaryCtaText: "See the ROI",
      secondaryCtaUrl: "#calculator",
      backgroundImageUrl: "",
      stats: [
        { value: "30%", label: "Avg case acceptance lift" },
        { value: "96%", label: "First-time right rate" },
        { value: "4.2 days", label: "Avg turnaround" },
        { value: "$0", label: "CAPEX to start" },
      ],
      showScrollIndicator: true,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(192,30%,5%)" rx="4" />
        <rect x="20" y="10" width="80" height="6" rx="3" fill="white" opacity="0.8" />
        <rect x="35" y="10" width="50" height="6" rx="3" fill="hsl(72,55%,48%)" opacity="0.5" />
        <rect x="30" y="20" width="60" height="3" rx="1.5" fill="white" opacity="0.3" />
        <rect x="38" y="27" width="20" height="5" rx="2.5" fill="hsl(72,55%,48%)" />
        <rect x="62" y="27" width="20" height="5" rx="2.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
        <rect x="0" y="55" width="120" height="15" rx="0" fill="hsl(192,28%,4%)" />
        {[0, 1, 2, 3].map(i => (
          <g key={i}>
            <rect x={8 + i * 28} y="57" width="14" height="3" rx="1.5" fill="hsl(72,55%,48%)" opacity="0.8" />
            <rect x={6 + i * 28} y="62" width="18" height="2" rx="1" fill="white" opacity="0.2" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-ai-feature" as const,
    label: "DSO AI Feature (Scan Review)",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoAiFeatureBlockProps => ({
      eyebrow: "Waste Prevention",
      headline: "Remakes are a tax. AI eliminates them.",
      body: "AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.",
      bullets: [
        "AI reviews every scan for clinical accuracy",
        "Real-time feedback before case submission",
        "Eliminates remakes at the source",
      ],
      stats: [
        { value: "96%",  label: "First-Time Right" },
        { value: "<30s", label: "Scan Review" },
        { value: "100%", label: "AI-Screened" },
      ],
      imageUrl: "/dso-ai-scan.jpg",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(152,32%,7%)" rx="4" />
        <rect x="6" y="10" width="28" height="3" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="6" y="16" width="44" height="5" rx="2" fill="white" opacity="0.9" />
        <rect x="6" y="23" width="44" height="2" rx="1" fill="white" opacity="0.4" />
        {[0,1,2].map(i => (
          <g key={i}>
            <circle cx="11" cy={30 + i*7} r="3" fill="hsl(68,60%,52%)" opacity="0.25" />
            <rect x="17" cy={30 + i*7} width="28" height="2" rx="1" fill="white" opacity="0.4" y={29 + i*7} />
          </g>
        ))}
        <rect x="62" y="8" width="52" height="54" rx="6" fill="hsl(152,30%,12%)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <ellipse cx="88" cy="35" rx="18" ry="22" fill="hsl(152,40%,22%)" opacity="0.7" />
        <circle cx="88" cy="30" r="5" fill="hsl(290,70%,55%)" opacity="0.7" />
      </svg>
    ),
  },
  {
    type: "dso-problem" as const,
    label: "DSO Problem (4-panel grid)",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoProblemBlockProps => ({
      eyebrow: "The Problem",
      headline: "Lab consolidation shouldn't mean compromise.",
      body: "",
      panels: [
        { icon: "alert-triangle", title: "Fragmented Networks",  desc: "No centralized visibility or control across your lab relationships." },
        { icon: "bar-chart",      title: "Scattered Data",       desc: "Performance tracking impossible across disconnected systems." },
        { icon: "users",          title: "Provider Resistance",  desc: "Inconsistent quality erodes provider confidence and slows adoption." },
        { icon: "trending-down",  title: "Revenue Leakage",      desc: "Remakes, wasted chair time, and inefficiency drain profitability silently." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(0,0%,98%)" rx="4" />
        <rect x="30" y="8" width="60" height="4" rx="2" fill="hsl(192,30%,10%)" opacity="0.7" />
        <rect x="40" y="14" width="40" height="2" rx="1" fill="hsl(192,10%,55%)" opacity="0.5" />
        {[0, 1, 2, 3].map(i => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 8 + col * 57;
          const y = 22 + row * 23;
          return (
            <g key={i}>
              <rect x={x} y={y} width="52" height="19" rx="3" fill="white" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
              <rect x={x + 4} y={y + 4} width="6" height="6" rx="1.5" fill="hsl(72,55%,48%)" opacity="0.15" />
              <rect x={x + 4} y={y + 12} width="22" height="2" rx="1" fill="hsl(192,30%,10%)" opacity="0.5" />
              <rect x={x + 4} y={y + 15} width="38" height="1.5" rx="0.75" fill="hsl(192,10%,55%)" opacity="0.35" />
            </g>
          );
        })}
      </svg>
    ),
  },
  {
    type: "dso-stat-showcase" as const,
    label: "DSO Stat Showcase",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoStatShowcaseBlockProps => ({
      eyebrow: "By the Numbers",
      headline: "Results that compound at scale.",
      stats: [
        { value: "96%",     label: "First-time right rate",  description: "Industry-leading precision at enterprise scale" },
        { value: "12,000+", label: "Dental practices",       description: "Trust Dandy for their lab work" },
        { value: "4.2 days", label: "Average turnaround",   description: "Including AI review and quality control" },
        { value: "$0",      label: "CAPEX to start",         description: "All hardware included at no upfront cost" },
        { value: "30%",     label: "Case acceptance lift",   description: "On average across DSO partner networks" },
        { value: "100%",    label: "AI quality screened",    description: "Every scan reviewed before it leaves the chair" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(152,42%,12%)" rx="4" />
        <rect x="30" y="8" width="60" height="4" rx="2" fill="hsl(68,60%,52%)" opacity="0.7" />
        <rect x="35" y="16" width="50" height="3" rx="1.5" fill="white" opacity="0.35" />
        {[0,1,2,3,4,5].map(i => (
          <g key={i}>
            <rect x={8 + (i%3)*38} y={26 + Math.floor(i/3)*22} width="32" height="3" rx="1.5" fill="white" opacity="0.8" />
            <rect x={8 + (i%3)*38} y={31 + Math.floor(i/3)*22} width="16" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
            <rect x={8 + (i%3)*38} y={35 + Math.floor(i/3)*22} width="28" height="1.5" rx="0.75" fill="white" opacity="0.25" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-scroll-story" as const,
    label: "DSO Scroll Story",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoScrollStoryBlockProps => ({
      eyebrow: "The Dandy Advantage",
      chapters: [
        { headline: "One lab relationship across every location.", body: "Fragmented lab networks create inconsistency, data silos, and zero negotiating leverage. Dandy becomes your single lab partner — standardizing quality, pricing, and reporting across every practice in your network.", imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&h=700&fit=crop" },
        { headline: "AI that catches problems before they become remakes.", body: "Dandy's AI Scan Review validates every case in real time — before it ever leaves the chair. The result: a 96% first-time right rate and dramatically fewer costly remakes across your entire footprint.", imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=900&h=700&fit=crop" },
        { headline: "Executive visibility into every practice, instantly.", body: "The Dandy Insights dashboard gives DSO leadership a real-time view of remake rates, case volumes, and turnaround times — by location, by region, by brand. Manage by exception, not by spreadsheet.", imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=900&h=700&fit=crop" },
        { headline: "Prove ROI at 10 offices. Scale to 500.", body: "Dandy's Pilot Program validates impact at a small number of locations first — measuring same-store revenue lift, remake reduction, and chair time recovered — before you commit to a full rollout.", imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=900&h=700&fit=crop" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="46" height="54" rx="3" fill="#e2e8f0" />
        <rect x="8" y="8" width="46" height="54" rx="3" fill="#003A30" opacity="0.15" />
        <rect x="62" y="8" width="22" height="2.5" rx="1.25" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="62" y="14" width="50" height="4" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="62" y="22" width="44" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.4" />
        <rect x="62" y="27" width="44" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.3" />
        <rect x="62" y="32" width="36" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.2" />
        {[0,1,2,3].map(i => (
          <rect key={i} x={62 + i*11} y="43" width={i===0?14:8} height="2" rx="1" fill={i===0?"hsl(68,60%,52%)":"#e2e8f0"} />
        ))}
      </svg>
    ),
  },
  {
    type: "dso-scroll-story-hero" as const,
    label: "DSO Hero Story",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoScrollStoryHeroBlockProps => ({
      eyebrow: "The Dandy Advantage",
      chapters: [
        { headline: "One lab partner. Every location.", body: "Dandy becomes your single lab relationship — standardizing quality, pricing, and reporting across every practice in your network. One contract. Zero silos.", imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1400&h=1000&fit=crop" },
        { headline: "AI that catches problems before they happen.", body: "AI Scan Review validates every case in real time — before it leaves the chair. The result: a 96% first-time right rate and fewer costly remakes across your entire footprint.", imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=1400&h=1000&fit=crop" },
        { headline: "Executive visibility into every practice.", body: "Real-time dashboards give DSO leadership insight into remake rates, case volumes, and turnaround times — by location, region, and brand. Manage by exception, not by spreadsheet.", imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1400&h=1000&fit=crop" },
        { headline: "Prove ROI at 10 offices. Scale to 500.", body: "Our Pilot Program validates impact at a small number of locations first — measuring revenue lift, remake reduction, and chair time recovered — before you commit to a full rollout.", imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=1400&h=1000&fit=crop" },
      ],
      ctaText: "Request a Custom Demo",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="0" y="0" width="52" height="70" fill="#003A30" />
        <rect x="52" y="0" width="68" height="70" fill="#1a4a3a" />
        <rect x="8" y="12" width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.9" />
        <rect x="8" y="18" width="36" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.9" />
        <rect x="8" y="26" width="36" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.4" />
        <rect x="8" y="30" width="30" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.3" />
        {[0,1,2,3].map(i => (
          <rect key={i} x={8 + i*10} y="40" width={i===0?16:6} height="2" rx="1" fill={i===0?"hsl(68,60%,52%)":"rgba(255,255,255,0.2)"} />
        ))}
        <rect x="8" y="52" width="26" height="8" rx="2" fill="hsl(68,60%,52%)" />
        <rect x="58" y="10" width="54" height="50" rx="3" fill="#2d6b56" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "dso-network-map" as const,
    label: "DSO Network Map",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoNetworkMapBlockProps => ({
      eyebrow: "Dandy Network",
      headline: "One platform.\nEvery practice.",
      body: "Dandy connects your entire DSO into a single lab ecosystem — routing cases, surfacing insights, and standardizing outcomes across every location in real time.",
      ctaText: "See the Live Network",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        {/* Left text column */}
        <rect x="6" y="10" width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.9" />
        <rect x="6" y="16" width="38" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.8" />
        <rect x="6" y="24" width="34" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.35" />
        <rect x="6" y="28" width="28" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.25" />
        <rect x="6" y="36" width="32" height="8" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.8" />
        {/* Right SVG network */}
        {/* Center node */}
        <circle cx={84} cy={35} r={6} fill="#003A30" stroke="hsl(68,60%,52%)" strokeWidth="1.2" />
        <circle cx={84} cy={35} r={10} fill="none" stroke="hsl(68,60%,52%)" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Spokes */}
        {[0, 60, 120, 180, 240, 300].map((a, i) => {
          const rad = a * Math.PI / 180;
          const nx = 84 + Math.cos(rad) * 20;
          const ny = 35 + Math.sin(rad) * 18;
          return (
            <g key={i}>
              <line x1={84} y1={35} x2={nx} y2={ny} stroke="hsl(68,60%,52%)" strokeWidth="0.5" strokeOpacity="0.35" strokeDasharray="2 2" />
              <circle cx={nx} cy={ny} r={2.5} fill="#003A30" stroke="hsl(68,60%,52%)" strokeWidth="0.8" />
            </g>
          );
        })}
      </svg>
    ),
  },
  {
    type: "dso-case-flow" as const,
    label: "DSO Case Flow",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoCaseFlowBlockProps => ({
      eyebrow: "How Dandy Works",
      headline: "From scan to seat in under 4 days.",
      subheadline: "Every Dandy case follows the same precise, AI-validated workflow — regardless of which location submits it.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        {/* Eyebrow + headline */}
        <rect x="6" y="7" width="16" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.85" />
        <rect x="6" y="12" width="42" height="4.5" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.8" />
        {/* Pipeline row */}
        {[0, 1, 2, 3].map(i => {
          const x = 8 + i * 28;
          const cx = x + 7;
          return (
            <g key={i}>
              {/* Connector line between cards */}
              {i < 3 && (
                <line x1={x + 14} y1={30} x2={x + 28} y2={30} stroke="hsl(68,60%,52%)" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="2 1.5" />
              )}
              {/* Stage card */}
              <rect x={x} y="22" width="14" height="30" rx="2" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              {/* Top lime bar */}
              <rect x={x} y="22" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.7" />
              {/* Stage number */}
              <rect x={x + 2} y="25" width="4" height="1.5" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.7" />
              {/* Metric */}
              <rect x={x + 2} y="29" width="10" height="3" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
              {/* Body text lines */}
              <rect x={x + 2} y="34" width="9" height="1" rx="0.5" fill="rgba(255,255,255,0.2)" />
              <rect x={x + 2} y="36.5" width="7" height="1" rx="0.5" fill="rgba(255,255,255,0.15)" />
              <rect x={x + 2} y="39" width="8" height="1" rx="0.5" fill="rgba(255,255,255,0.12)" />
            </g>
          );
        })}
        {/* Travelling packet */}
        <circle cx="50" cy="30" r="1.5" fill="hsl(68,60%,52%)" opacity="0.9" />
      </svg>
    ),
  },
  {
    type: "dso-live-feed" as const,
    label: "DSO Live Feed",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoLiveFeedBlockProps => ({
      eyebrow: "Platform Intelligence",
      headline: "Dandy sees everything.\nYour team acts on what matters.",
      body: "Every metric from every location, streaming in real time. The Dandy dashboard transforms raw case data into executive-ready intelligence — automatically.",
      footerNote: "Live data from 127 DSO locations across 14 states",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        {/* Left text column */}
        <rect x="5" y="8" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.85" />
        <rect x="5" y="13" width="32" height="4" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="19" width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.2)" />
        <rect x="5" y="22" width="24" height="1.5" rx="0.5" fill="rgba(255,255,255,0.15)" />
        <rect x="5" y="25" width="26" height="1.5" rx="0.5" fill="rgba(255,255,255,0.15)" />
        {/* Live dot */}
        <circle cx="7" cy="34" r="2" fill="hsl(68,60%,52%)" opacity="0.9" />
        <rect x="11" y="32.5" width="12" height="1.5" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.7" />
        {/* Terminal panel */}
        <rect x="47" y="5" width="68" height="60" rx="3" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        {/* Terminal header */}
        <rect x="47" y="5" width="68" height="8" rx="3" fill="rgba(0,0,0,0.2)" />
        {[50, 54, 58].map((x, i) => (
          <circle key={i} cx={x} cy="9" r="1.5" fill={["#B45309", "#6B7280", "hsl(68,60%,52%)"][i]} opacity="0.7" />
        ))}
        {/* Metric rows */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <g key={i}>
            <line x1="47" y1={17 + i * 8} x2="115" y2={17 + i * 8} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <rect x="50" y={18.5 + i * 8} width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.25)" />
            <rect x="90" y={18.5 + i * 8} width="12" height="1.5" rx="0.5" fill={i % 2 === 0 ? "hsl(68,60%,52%)" : "hsl(48,100%,96%)"} opacity="0.7" />
            {/* Arrow indicator */}
            <rect x="105" y={18.5 + i * 8} width="4" height="1.5" rx="0.5" fill={i % 3 === 1 ? "hsl(4,80%,60%)" : "hsl(68,60%,52%)"} opacity="0.8" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-particle-mesh" as const,
    label: "DSO Particle Mesh",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoParticleMeshBlockProps => ({
      eyebrow: "AI-Driven Intelligence",
      headline: "Every case,\nconnected.",
      body: "Dandy's neural lab infrastructure routes, validates, and delivers with machine precision — connecting every practice, every provider, every outcome.",
      stat1Value: "500+", stat1Label: "Locations",
      stat2Value: "96%",  stat2Label: "First-Time Right",
      stat3Value: "< 4d", stat3Label: "Avg Turnaround",
      imageUrl: "https://meetdandy-lp.com/api/storage/objects/uploads/8fc1187a-7e5a-46b1-8314-f8edffef941a",
      imagePosition: "right",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        {/* Particle network illustration */}
        {([
          [22,14],[60,8],[98,20],[15,36],[45,30],[80,35],[100,52],[55,55],[30,58],[72,18],[40,48],[88,12],
        ] as [number,number][]).map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r={1.2} fill="hsl(68,60%,52%)" opacity="0.7" />
        ))}
        {/* Connections */}
        {[
          [22,14,60,8],[60,8,98,20],[22,14,45,30],[60,8,80,35],[98,20,80,35],
          [45,30,80,35],[45,30,55,55],[80,35,100,52],[55,55,100,52],[30,58,55,55],
          [15,36,45,30],[72,18,60,8],[88,12,98,20],
        ].map(([x1,y1,x2,y2],i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(68,60%,52%)" strokeWidth="0.5" strokeOpacity="0.3" />
        ))}
        {/* Text overlay */}
        <rect x="5" y="42" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="47" width="40" height="5" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="55" width="32" height="1.5" rx="0.5" fill="rgba(255,255,255,0.25)" />
        <rect x="5" y="58.5" width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.18)" />
        {/* Glow center */}
        <circle cx="60" cy="35" r="18" fill="none" stroke="hsl(68,60%,52%)" strokeOpacity="0.06" strokeWidth="12" />
      </svg>
    ),
  },
  {
    type: "dso-flow-canvas" as const,
    label: "DSO Flow Canvas",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoFlowCanvasBlockProps => ({
      eyebrow: "The Dandy Standard",
      quote: "We didn't just digitize the lab workflow.\nWe rebuilt it from the ground up.",
      attribution: "Dandy Engineering Team",
      stat: "99.2%",
      statLabel: "First-Time Fit Rate — Network-Wide",
      imageUrl: "https://meetdandy-lp.com/api/storage/objects/uploads/8fc1187a-7e5a-46b1-8314-f8edffef941a",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#000e09" rx="4" />
        {/* Aurora blobs */}
        <ellipse cx="30" cy="25" rx="38" ry="28" fill="rgba(0,58,36,0.5)" />
        <ellipse cx="90" cy="48" rx="34" ry="24" fill="rgba(30,90,22,0.45)" />
        <ellipse cx="60" cy="60" rx="28" ry="20" fill="rgba(70,120,10,0.35)" />
        <ellipse cx="88" cy="14" rx="26" ry="18" fill="rgba(8,70,38,0.4)" />
        {/* Centered stat text */}
        <rect x="38" y="18" width="44" height="14" rx="3" fill="rgba(0,14,9,0.45)" />
        <rect x="44" y="22" width="32" height="8" rx="2" fill="hsl(68,60%,52%)" opacity="0.85" />
        {/* Quote line */}
        <rect x="22" y="38" width="76" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
        <rect x="30" y="43" width="60" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.4" />
        {/* Attribution */}
        <rect x="45" y="51" width="30" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)" />
      </svg>
    ),
  },
  {
    type: "dso-bento-outcomes" as const,
    label: "DSO Bento Outcomes",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoBentoOutcomesBlockProps => ({
      eyebrow: "Why Dandy",
      headline: "Every metric that matters. All in one platform.",
      tiles: [],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="40" height="4" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="8" y="18" width="22" height="22" rx="3" fill="#003A30" />
        <rect x="11" y="24" width="12" height="4" rx="1.5" fill="#C7E738" opacity="0.9" />
        <rect x="11" y="30" width="16" height="2" rx="1" fill="white" opacity="0.5" />
        <rect x="33" y="18" width="38" height="22" rx="3" fill="#e2e8f0" />
        <rect x="75" y="18" width="37" height="22" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
        <rect x="78" y="26" width="18" height="3" rx="1.5" fill="#003A30" opacity="0.7" />
        <rect x="78" y="32" width="24" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="8" y="44" width="36" height="18" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
        <rect x="8" y="44" width="36" height="2" rx="0" fill="#C7E738" opacity="0.6" />
        <rect x="11" y="50" width="26" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="11" y="55" width="22" height="2" rx="1" fill="#94a3b8" opacity="0.3" />
        <rect x="48" y="44" width="22" height="18" rx="3" fill="#003A30" />
        <rect x="51" y="51" width="10" height="3" rx="1.5" fill="#C7E738" opacity="0.9" />
        <rect x="74" y="44" width="38" height="18" rx="3" fill="#e2e8f0" />
      </svg>
    ),
  },
  {
    type: "dso-meet-team" as const,
    label: "DSO Meet the Team",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoMeetTeamBlockProps => ({
      eyebrow: "Your Dedicated Team",
      headline: "The team behind your partnership.",
      subheadline: "Every practice gets a dedicated Dandy rep who knows your workflow, not a generic help desk.",
      ctaText: "Book a Meeting",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      members: [
        { name: "Asad Ahmed", role: "Enterprise AE", email: "asad.ahmed@meetdandy.com", chilipiperUrl: "https://meetdandy.chilipiper.com/book/me/asad-ahmed" },
        { name: "Dan MacAdam", role: "Strategic AE", email: "dan.macadam@meetdandy.com", chilipiperUrl: "https://meetdandy.chilipiper.com/book/me/dan-macadam" },
        { name: "Matt Gorski", role: "Large Enterprise AE", email: "matt.gorski@meetdandy.com", chilipiperUrl: "https://meetdandy.chilipiper.com/book/me/Matt-Gorski" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="6" width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="11" width="40" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="19" width="30" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={5 + i * 38} y="30" width="32" height="35" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <circle cx={21 + i * 38} cy="43" r="7" fill="rgba(255,255,255,0.12)" />
            <rect x={8 + i * 38} y="53" width="24" height="2" rx="1" fill="rgba(255,255,255,0.55)" />
            <rect x={10 + i * 38} y="57" width="18" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.6" />
            <rect x={8 + i * 38} y="60" width="26" height="3" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.25" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-paradigm-shift" as const,
    label: "DSO Paradigm Shift",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoParadigmShiftBlockProps => ({
      eyebrow: "The New Standard",
      headline: "From fragmented labs to one unified partner.",
      subheadline: "Dandy replaces the old model with a fully integrated lab platform — built for how modern practices operate.",
      oldWayLabel: "The Old Way",
      newWayLabel: "The Dandy Way",
      oldWayItems: [
        "Multiple disconnected lab vendors",
        "Inconsistent quality across locations",
        "Remake costs absorbed by the practice",
        "No visibility into case performance",
        "Expensive scanner CAPEX per operatory",
      ],
      newWayItems: [
        "One unified lab partner across all locations",
        "AI Scan Review catches issues before they happen",
        "96% first-time fit rate — guaranteed",
        "Real-time dashboard across every practice",
        "Premium scanners included at $0 CAPEX",
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        <rect x="5" y="6" width="16" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="36" height="4" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="20" width="52" height="44" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <rect x="65" y="20" width="52" height="44" rx="3" fill="rgba(194,229,58,0.08)" stroke="hsl(68,60%,52%)" strokeWidth="0.5" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <circle cx="12" cy={27 + i * 8} r="1.5" fill="rgba(255,100,100,0.7)" />
            <rect x="17" y={26 + i * 8} width="34" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)" />
            <circle cx="72" cy={27 + i * 8} r="1.5" fill="hsl(68,60%,52%)" opacity="0.9" />
            <rect x="77" y={26 + i * 8} width="34" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-partnership-perks" as const,
    label: "DSO Partnership Perks",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPartnershipPerksBlockProps => ({
      eyebrow: "Partnership Benefits",
      headline: "Perks that come with every Dandy partnership.",
      subheadline: "From day one, your practices get dedicated support, premium hardware, and exclusive incentives.",
      perks: [
        { icon: "gift", title: "$100 UberEats Gift Card", desc: "Book a lunch-and-learn for your team — we'll bring the food and walk you through going digital with Dandy." },
        { icon: "star", title: "Dedicated DSO Support", desc: "Your own account team that knows your group's workflow. Direct line, same-day response." },
        { icon: "shield", title: "Free CE Credits", desc: "Accredited courses on digital dentistry, scan technique, and restorative workflows." },
        { icon: "sparkles", title: "$1,500 Lab Credit", desc: "New practices get $1,500 toward their first cases — experience Dandy quality risk-free from day one." },
        { icon: "zap", title: "AI Scan Review", desc: "Real-time AI flags margin issues while your patient is still in the chair — fewer remakes, faster seats." },
        { icon: "users", title: "Live Clinical Collaboration", desc: "Chat directly with Dandy lab technicians in real time to dial in your preps." },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="6" width="22" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="11" width="44" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[[5,24],[44,24],[83,24],[5,47],[44,47],[83,47]].map(([x,y],i) => (
          <g key={i}>
            <rect x={x} y={y} width="34" height="20" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <circle cx={x+7} cy={y+7} r="4" fill="hsl(68,60%,52%)" opacity="0.3" />
            <rect x={x+14} y={y+4} width="16" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
            <rect x={x+3} y={y+14} width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.2)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-products-grid" as const,
    label: "DSO Products Grid",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoProductsGridBlockProps => ({
      eyebrow: "The Full Platform",
      headline: "One lab for everything your practice needs.",
      subheadline: "Perfect fit. Fast turnarounds. One connected system that simplifies your entire restorative workflow.",
      products: [
        { icon: "crown",       imageKey: "posterior-crowns", name: "Posterior Crowns",     detail: "AI-perfected, 5-day turnaround",        price: "From $99/unit" },
        { icon: "smile",       imageKey: "anterior-crowns",  name: "Anterior Crowns",      detail: "Stunning aesthetics, free 3D approvals", price: "Premium materials" },
        { icon: "stethoscope", imageKey: "dentures",         name: "Dentures",             detail: "2-appointment digital workflow",         price: "From $199/arch" },
        { icon: "target",      imageKey: "implants",         name: "Implant Restorations", detail: "FDA-approved, custom abutments",         price: "All systems supported" },
        { icon: "scan",        imageKey: "guided-surgery",   name: "Guided Surgery",       detail: "3D-printed surgical guides",             price: "$109/site" },
        { icon: "sparkles",    imageKey: "aligners",         name: "Clear Aligners",       detail: "Doctor-directed, 3D simulations",        price: "Flexible plans" },
        { icon: "moon",        imageKey: "guards",           name: "Night Guards & TMJ",   detail: "Digital heatmaps, 3D-printed",           price: "From $59 bundled" },
        { icon: "shield",      imageKey: "sleep",            name: "Sleep Appliances",     detail: "MAD devices for OSA patients",           price: "Medical billing support" },
      ],
      backgroundStyle: "muted",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f1f5f2" rx="4" />
        <rect x="5" y="5" width="18" height="1.5" rx="0.75" fill="#003A30" opacity="0.6" />
        <rect x="5" y="10" width="40" height="4" rx="2" fill="#003A30" opacity="0.85" />
        {[[5,20],[43,20],[81,20],[5,44],[43,44],[81,44]].map(([x,y],i) => (
          <g key={i}>
            <rect x={x} y={y} width="34" height="22" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
            <rect x={x} y={y} width="34" height="6" rx="3" fill="#003A30" opacity="0.08" />
            <rect x={x+3} y={y+9} width="20" height="2" rx="1" fill="#003A30" opacity="0.7" />
            <rect x={x+3} y={y+14} width="26" height="1.5" rx="0.75" fill="#94a3b8" opacity="0.5" />
            <rect x={x+3} y={y+18} width="12" height="1.5" rx="0.75" fill="#C7E738" opacity="0.9" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-promo-cards" as const,
    label: "DSO Promo Cards",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPromoCardsBlockProps => ({
      eyebrow: "Limited-Time Offers",
      headline: "Exclusive promotions for DSO partners.",
      subheadline: "Activate your practices and take advantage of offers available only through your group partnership.",
      cards: [
        { title: "$1,500 Lab Credit", desc: "Activate your practice and get $1,500 toward your first cases — experience our 96% fit rate with zero risk.", badge: "CREDIT", ctaText: "Claim my credit" },
        { title: "$1,000 Lab Credit", desc: "Sign up within 90 days and put $1,000 toward crowns, bridges, or dentures — on us.", badge: "CREDIT", ctaText: "Get started" },
        { title: "Free Scanner + Cart", desc: "Your practice gets a premium intraoral scanner and all-in-one operatory cart at zero cost — included with your DSO partnership.", badge: "FREE", ctaText: "Reserve yours" },
        { title: "Free Laptop + Cart", desc: "Full digital setup for your operatory — scanner, laptop, and cart delivered and installed at no charge.", badge: "FREE", ctaText: "Reserve yours" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        <rect x="5" y="5" width="20" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="42" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[[5,20],[63,20],[5,46],[63,46]].map(([x,y],i) => (
          <g key={i}>
            <rect x={x} y={y} width="54" height="22" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <rect x={x+3} y={y+3} width="14" height="5" rx="2.5" fill={i % 2 === 0 ? "hsl(68,60%,52%)" : "hsl(48,100%,96%)"} opacity="0.8" />
            <rect x={x+3} y={y+11} width="34" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
            <rect x={x+3} y={y+15} width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
            <rect x={x+3} y={y+19} width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-activation-steps" as const,
    label: "DSO Activation Steps",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoActivationStepsBlockProps => ({
      eyebrow: "Getting Started",
      headline: "Four steps to going live with Dandy.",
      subheadline: "Our onboarding team handles every detail — from scanner delivery to your first case.",
      steps: [
        { step: "1", title: "Schedule Your Kickoff", desc: "Meet your dedicated Dandy activation manager to align on rollout timeline, goals, and which practices go live first." },
        { step: "2", title: "Equipment Setup & Delivery", desc: "We ship and install your intraoral scanners — every operatory fully configured, calibrated, and ready to scan." },
        { step: "3", title: "Clinical Team Training", desc: "Hands-on training for doctors and staff covering scan technique, case submission, and workflow integration — at your pace." },
        { step: "4", title: "First Cases & Go Live", desc: "Submit your first cases and experience the Dandy difference — real-time tracking, guaranteed fit, and dedicated support from day one." },
      ],
      ctaText: "Book Your Activation Call",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="6" width="20" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="11" width="42" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[0,1,2].map(i => (
          <g key={i}>
            <line x1="18" y1={25 + i * 14} x2="18" y2={i < 2 ? 36 + i * 14 : 33 + i * 14} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <circle cx="18" cy={23 + i * 14} r="5" fill="hsl(68,60%,52%)" opacity="0.2" stroke="hsl(68,60%,52%)" strokeWidth="0.7" />
            <rect x="16.5" y={22 + i * 14} width="3" height="2" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.9" />
            <rect x="28" y={21 + i * 14} width="28" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.7" />
            <rect x="28" y={25 + i * 14} width="42" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
            <rect x="28" y={28.5 + i * 14} width="34" height="1.5" rx="0.75" fill="rgba(255,255,255,0.15)" />
          </g>
        ))}
        <rect x="5" y="63" width="42" height="5" rx="2.5" fill="hsl(68,60%,52%)" opacity="0.85" />
      </svg>
    ),
  },
  {
    type: "dso-promises" as const,
    label: "DSO Promises",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPromisesBlockProps => ({
      eyebrow: "Our Guarantees",
      headline: "Built on trust. Backed by guarantees.",
      subheadline: "We stand behind every case — because your reputation depends on it.",
      promises: [
        { icon: "ban",          title: "Zero Long-Term Contracts",    desc: "Simple, transparent pricing. No lock-ins, no hidden fees. Stay because you want to, not because you have to." },
        { icon: "rotate",       title: "Free No-Hassle Remakes",      desc: "If it doesn't fit, we'll make it right — no questions asked, no finger-pointing. Every single time." },
        { icon: "shieldCheck",  title: "10-Year Warranty",            desc: "Every crown, bridge, and restoration is backed by a 10-year warranty. Your patients are covered for years to come." },
        { icon: "trending-up",  title: "96% First-Time Fit Rate",     desc: "AI-powered scan review catches prep issues before a case ships — meaning fewer remakes and faster seating appointments." },
        { icon: "clock",        title: "Same-Day Case Acknowledgment", desc: "Every case is acknowledged the same day it's submitted, so you always know it's in queue and on track." },
        { icon: "heart",        title: "Dedicated Clinical Support",  desc: "Your personal Dandy success manager is on call for clinical questions, feedback, and anything your team needs." },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        <rect x="5" y="5" width="18" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="38" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[[5,19],[44,19],[83,19],[5,45],[44,45],[83,45]].map(([x,y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="34" height="22" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <circle cx={x+8} cy={y+9} r="5" fill="rgba(194,229,58,0.15)" stroke="hsl(68,60%,52%)" strokeWidth="0.5" />
            <rect x={x+16} y={y+5} width="14" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.7" />
            <rect x={x+3} y={y+16} width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.22)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-testimonials" as const,
    label: "DSO Testimonials",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoTestimonialsBlockProps => ({
      eyebrow: "What Our Partners Say",
      headline: "Practices that switched and never looked back.",
      subheadline: "Hear from DSO leaders across the country who've made Dandy their lab partner.",
      testimonials: [
        { quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann", location: "Founder, APEX Dental Partners" },
        { quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", author: "Clinical Director", location: "Open & Affordable Dental" },
        { quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", author: "Dr. Trey Mueller", location: "Chief Clinical Officer, Dental Care Alliance" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="5" width="20" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="44" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[5,42,79].map((x,i) => (
          <g key={i}>
            <rect x={x} y="20" width="34" height="44" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <rect x={x+3} y="25" width="4" height="3" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.7" />
            <rect x={x+3} y="31" width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
            <rect x={x+3} y="35" width="26" height="1.5" rx="0.75" fill="rgba(255,255,255,0.35)" />
            <rect x={x+3} y="39" width="22" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
            <line x1={x+3} y1="47" x2={x+31} y2="47" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <circle cx={x+8} cy="53" r="4" fill="rgba(255,255,255,0.12)" />
            <rect x={x+15} y="51" width="16" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
            <rect x={x+15} y="55" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-practice-nav" as const,
    label: "DSO Practice Nav",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPracticeNavBlockProps => ({
      dsoName: "",
      links: [
        { label: "How it works", anchor: "#steps" },
        { label: "Products", anchor: "#products" },
        { label: "Partnership perks", anchor: "#perks" },
        { label: "Meet your rep", anchor: "#team" },
      ],
      ctaText: "Book a Demo",
      ctaUrl: "",
      ctaMode: "chilipiper",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect width="120" height="18" fill="#003A30" />
        <rect x="6" y="6" width="16" height="5" rx="1" fill="white" opacity="0.7" />
        <rect x="28" y="7" width="10" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="41" y="7" width="12" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="56" y="7" width="14" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="73" y="7" width="12" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="96" y="5" width="18" height="8" rx="4" fill="#C7E738" />
        <rect x="8" y="26" width="60" height="5" rx="1" fill="#003A30" opacity="0.4" />
        <rect x="8" y="35" width="90" height="3" rx="1" fill="#94a3b8" opacity="0.3" />
        <rect x="8" y="42" width="70" height="3" rx="1" fill="#94a3b8" opacity="0.25" />
      </svg>
    ),
  },
  {
    type: "dso-practice-hero" as const,
    label: "DSO Practice Hero",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPracticeHeroBlockProps => ({
      eyebrow: "Heartland Dental × Dandy",
      headline: "Your practice. Elevated by Dandy.",
      subheadline: "As a Heartland partner, your practice gets dedicated support, premium scanners at no cost, and a lab that backs every case with a first-time fit guarantee.",
      primaryCtaText: "Start your first case",
      primaryCtaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      secondaryCtaText: "See how it works",
      secondaryCtaUrl: "#",
      trustLine: "Join 200+ practices in your network already using Dandy",
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <radialGradient id="pg-hero-glow" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="hsl(68,60%,52%)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <rect width="120" height="70" fill="url(#pg-hero-glow)" rx="4" />
        <rect x="30" y="10" width="60" height="5" rx="10" fill="rgba(199,231,56,0.2)" stroke="rgba(199,231,56,0.3)" strokeWidth="0.5" />
        <rect x="18" y="20" width="84" height="9" rx="3" fill="rgba(255,255,255,0.75)" />
        <rect x="25" y="32" width="70" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
        <rect x="30" y="37" width="60" height="2.5" rx="1.25" fill="rgba(255,255,255,0.2)" />
        <rect x="26" y="46" width="30" height="9" rx="4" fill="hsl(68,60%,52%)" />
        <rect x="62" y="46" width="30" height="9" rx="4" fill="transparent" stroke="rgba(255,255,255,0.25)" strokeWidth="0.75" />
        <rect x="35" y="60" width="50" height="1.5" rx="0.75" fill="rgba(255,255,255,0.15)" />
      </svg>
    ),
  },
  {
    type: "dso-stat-row" as const,
    label: "DSO Stat Row",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoStatRowBlockProps => ({
      eyebrow: "By the numbers",
      headline: "Results that speak for themselves.",
      items: [
        { value: "96%", label: "First-time fit rate", detail: "Industry average is 78%" },
        { value: "50%", label: "Fewer remakes", detail: "Compared to traditional labs" },
        { value: "2x", label: "Faster turnaround", detail: "Same-day delivery available" },
        { value: "12K+", label: "Active practices", detail: "Across DSO networks nationwide" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="8" width="18" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="13" width="36" height="3.5" rx="1.5" fill="rgba(255,255,255,0.65)" />
        {[5,33,61,89].map((x, i) => (
          <g key={i}>
            <rect x={x} y="25" width="26" height="38" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <rect x={x+3} y="30" width="18" height="8" rx="2" fill="hsl(68,60%,52%)" opacity="0.5" />
            <rect x={x+3} y="42" width="20" height="2" rx="1" fill="rgba(255,255,255,0.5)" />
            <rect x={x+3} y="47" width="16" height="1.5" rx="0.75" fill="rgba(255,255,255,0.2)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-faq" as const,
    label: "DSO FAQ",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoFaqBlockProps => ({
      eyebrow: "Common questions",
      headline: "Everything you're wondering about switching.",
      subheadline: "We know change feels risky. Here's what practices ask us most.",
      items: [
        { question: "Will switching labs disrupt my current workflow?", answer: "No. We design the transition around your schedule. An on-site Dandy trainer comes to your practice, walks your team through the scanner and workflow, and you're up and running in days — not weeks. Most practices see zero disruption to active cases." },
        { question: "What if my first case doesn't come back right?", answer: "We back every case with our first-time fit guarantee. If a crown or restoration doesn't seat on the first try, we remake it at no cost and send your dedicated rep to troubleshoot the scan. No runaround, no charge." },
        { question: "Does my DSO have a special pricing arrangement with Dandy?", answer: "Yes — your network has negotiated preferred pricing and an exclusive onboarding incentive for member practices. Your first $1,500 in cases is credited to your account, plus you get a $100 UberEats card for hosting a lunch-and-learn." },
        { question: "How does the Dandy scanner work, and is it hard to learn?", answer: "The Dandy scanner is an iTero-compatible intraoral scanner included at $0 CAPEX. Your team typically gets comfortable in one or two cases. Our AI Scan Review flags any issues while the patient is still in the chair — so you fix it before submitting, not after." },
        { question: "What products does Dandy offer?", answer: "Dandy covers the full restorative range — posterior and anterior crowns, veneers, implant restorations, dentures, sleep appliances, night guards, and clear aligners. All cases flow through one portal, one account team, one bill." },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="20" y="6" width="30" height="1.5" rx="0.75" fill="#003A30" opacity="0.4" />
        <rect x="10" y="11" width="60" height="4" rx="2" fill="#003A30" opacity="0.7" />
        {[0,1,2,3,4].map(i => (
          <g key={i}>
            <rect x="10" y={21 + i * 10} width="100" height="8" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="0.5" />
            <rect x="14" y={24 + i * 10} width="56" height="2" rx="1" fill="#374151" opacity="0.5" />
            <path d={`M 104 ${25 + i * 10} l -3 3 l -3 -3`} stroke="#003A30" strokeWidth="1" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-split-feature" as const,
    label: "DSO Split Feature",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoSplitFeatureBlockProps => ({
      eyebrow: "AI-powered quality control",
      headline: "Catch scan issues before the patient leaves the chair.",
      body: "AI Scan Review analyzes every impression in real time — flagging margin gaps, prep angles, and tissue interference while you still have the patient seated. It's like having a master ceramist review every scan instantly.",
      bullets: [
        "Margin errors caught before submission — not after",
        "Real-time feedback with visual callouts",
        "Fewer remakes means more productive chair time",
        "No extra software — built into the Dandy workflow",
      ],
      ctaText: "See AI Scan Review in action",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      imageUrl: "",
      imagePosition: "right",
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="5" y="10" width="52" height="50" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="0.5" />
        <rect x="9" y="16" width="14" height="1.5" rx="0.75" fill="#003A30" opacity="0.5" />
        <rect x="9" y="21" width="40" height="5" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="9" y="29" width="38" height="2" rx="1" fill="#6b7280" opacity="0.4" />
        <rect x="9" y="33" width="34" height="2" rx="1" fill="#6b7280" opacity="0.3" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <circle cx="12" cy={41 + i * 5} r="1.5" fill="#003A30" opacity="0.5" />
            <rect x="16" y={40 + i * 5} width="28" height="1.5" rx="0.75" fill="#374151" opacity="0.4" />
          </g>
        ))}
        <rect x="62" y="10" width="52" height="50" rx="8" fill="#003A3010" stroke="#003A3018" strokeWidth="0.5" />
        <circle cx="88" cy="35" r="14" fill="#003A30" opacity="0.12" />
        <path d="M80 35 C80 28 96 28 96 35" stroke="hsl(68,60%,52%)" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      </svg>
    ),
  },
  {
    type: "dso-software-showcase" as const,
    label: "DSO Software Showcase",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoSoftwareShowcaseBlockProps => ({
      eyebrow: "Chairside Software",
      headline: "The only chairside software\nbuilt for same-day dentistry.",
      body: "Dandy's AI-powered platform gives clinicians real-time scan review, prep guidance, and digital workflows — all in one seamless experience.",
      imageUrl: "https://meetdandy-lp.com/api/storage/objects/uploads/9900b5fa-e2f5-484b-bcd6-16ed56ddf5cb",
      features: [
        { icon: "zap",   label: "Real-time scan analysis" },
        { icon: "check", label: "AI-flagged margin errors" },
        { icon: "clock", label: "2–3 min saved per case" },
        { icon: "bar",   label: "Full-arch crown prep" },
      ],
      ctaText: "See it in action",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      ctaMode: "chilipiper",
      backgroundStyle: "dandy-green",
      layout: "centered",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="20" y="8" width="80" height="3" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.6" />
        <rect x="25" y="14" width="70" height="5" rx="2.5" fill="white" opacity="0.85" />
        <rect x="30" y="22" width="60" height="2.5" rx="1.25" fill="white" opacity="0.35" />
        <rect x="5" y="30" width="110" height="26" rx="4" fill="white" opacity="0.06" stroke="white" strokeWidth="0.5" strokeOpacity="0.12" />
        <rect x="7" y="32" width="106" height="5" rx="2" fill="white" opacity="0.07" />
        <rect x="9" y="33" width="8" height="3" rx="1.5" fill="#ff5f57" opacity="0.8" />
        <rect x="19" y="33" width="8" height="3" rx="1.5" fill="#febc2e" opacity="0.8" />
        <rect x="29" y="33" width="8" height="3" rx="1.5" fill="#28c840" opacity="0.8" />
        <rect x="7" y="38" width="106" height="16" rx="1" fill="white" opacity="0.05" />
        <rect x="9" y="40" width="102" height="12" rx="1" fill="#0d1f18" />
        <rect x="59" y="58" width="24" height="4" rx="2" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="35" y="64" width="20" height="2" rx="1" fill="white" opacity="0.2" />
        <rect x="58" y="64" width="20" height="2" rx="1" fill="white" opacity="0.2" />
        <rect x="81" y="64" width="20" height="2" rx="1" fill="white" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "dso-insights-video" as const,
    label: "Insights Video",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoInsightsVideoBlockProps => ({
      title: "See everything.",
      subtitle: "Before it becomes a problem.",
      description: "The only analytics platform purpose-built for modern dental groups.",
      callout1Label: "Remake Rates",
      callout1Desc: "Track quality by provider, not just practice",
      callout2Label: "Spend Tracking",
      callout2Desc: "Know where every dollar goes across all locations",
      callout3Label: "Scan Quality",
      callout3Desc: "Catch clinical issues before they become remakes",
      callout4Label: "Provider Performance",
      callout4Desc: "Coach with data, not instinct",
      quote: "It would be insane not to use it given the data available.",
      quoteAttribution: "Dr. Eller, Clinical Leader",
      ctaLabel: "Get a demo",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      ctaMode: "link" as CtaMode,
      ctaVariant: "primary" as const,
      backgroundStyle: "dark" as BackgroundStyle,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#1B5435" rx="4" />
        <rect x="10" y="15" width="40" height="6" rx="2" fill="hsl(48,100%,96%)" opacity="0.9" />
        <rect x="10" y="25" width="30" height="3" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
        <rect x="10" y="35" width="20" height="2" rx="1" fill="hsl(68,60%,52%)" />
        <rect x="60" y="15" width="50" height="40" rx="3" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <rect x="65" y="20" width="40" height="30" rx="2" fill="rgba(255,255,255,0.8)" />
      </svg>
    ),
  },
  {
    type: "dso-cta-capture" as const,
    label: "DSO CTA Capture",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoCtaCaptureBlockProps => ({
      eyebrow: "Get Started Today",
      headline: "See what Dandy can\ndo for your group.",
      body: "Join DSO leaders already running smarter, faster dental operations. Setup takes one call.",
      inputLabel: "Work email",
      inputPlaceholder: "yourname@dsogroup.com",
      ctaLabel: "Request a Demo",
      trust1: "1,200+ DSO locations",
      trust2: "No long-term contract",
      trust3: "Live in 30 days",
      imageUrl: "https://meetdandy-lp.com/api/storage/objects/uploads/8fc1187a-7e5a-46b1-8314-f8edffef941a",
      imagePosition: "right",
      chilipiperUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      successHeadline: "You're on the list!",
      successBody: "Check your inbox — we'll be in touch shortly to schedule your demo.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#050e08" rx="4" />
        {/* Image half */}
        <rect x="60" y="0" width="60" height="70" fill="#0a2018" />
        <rect x="60" y="0" width="60" height="70" fill="url(#ctaFade)" />
        <defs>
          <linearGradient id="ctaFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#050e08" />
            <stop offset="60%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* Eyebrow dot */}
        <circle cx="10" cy="16" r="2" fill="hsl(68,60%,52%)" />
        <rect x="15" y="14" width="22" height="3" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.8" />
        {/* Headline lines */}
        <rect x="10" y="23" width="44" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.9" />
        <rect x="10" y="31" width="36" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.7" />
        {/* Body */}
        <rect x="10" y="41" width="42" height="2" rx="1" fill="white" opacity="0.3" />
        <rect x="10" y="45" width="36" height="2" rx="1" fill="white" opacity="0.2" />
        {/* Pill input */}
        <rect x="10" y="53" width="46" height="10" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(199,231,56,0.3)" strokeWidth="0.7" />
        <rect x="36" y="55" width="18" height="6" rx="3" fill="hsl(68,60%,52%)" />
      </svg>
    ),
  },
  {
    type: "dso-case-study" as const,
    label: "DSO Case Study",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoCaseStudyBlockProps => ({
      eyebrow: "Customer Story",
      headline: "How [Customer] achieved measurable results",
      subheadline: "A short summary of the outcome — who the customer is, what changed, and the headline impact in one or two sentences.",
      backgroundStyle: "white" as BackgroundStyle,
      stats: [
        { value: "00%", label: "Key outcome metric" },
        { value: "0x", label: "Improvement vs. before" },
        { value: "$0", label: "Cost or time saved" },
        { value: "00", label: "Another result" },
      ],
      challenge: {
        heading: "The Challenge",
        body: "Describe the situation the customer faced before working with you — the problem, what was at stake, and why the status quo wasn't working.",
      },
      solution: {
        heading: "The Solution",
        body: "Explain what the customer did to solve the problem — the approach, the rollout, and how it fit their existing workflow.",
      },
      quote: "Add a short, specific customer quote that captures the impact in their own words.",
      results: [
        {
          value: "00%",
          label: "Primary result",
          description: "One sentence of context explaining how this result was measured.",
        },
        {
          value: "0x",
          label: "Secondary result",
          description: "One sentence of context explaining how this result was measured.",
        },
        {
          value: "$0",
          label: "Cost or time saved",
          description: "One sentence of context explaining how this result was measured.",
        },
        {
          value: "00",
          label: "Additional result",
          description: "One sentence of context explaining how this result was measured.",
        },
      ],
      whyItMatters: {
        heading: "Why It Matters",
        body: "Summarize the broader takeaway — why these results matter and what other organizations can learn from this story.",
      },
      sections: [],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#fff" rx="4" />
        {/* eyebrow */}
        <rect x="8" y="7" width="22" height="2.5" rx="1.25" fill="hsl(152,42%,12%)" opacity="0.4" />
        {/* headline */}
        <rect x="8" y="13" width="90" height="5" rx="2" fill="hsl(152,42%,12%)" opacity="0.85" />
        <rect x="8" y="21" width="70" height="3.5" rx="1.5" fill="hsl(152,8%,48%)" opacity="0.45" />
        {/* stat bar */}
        <rect x="8" y="28" width="104" height="0.75" rx="0.375" fill="rgba(0,58,48,0.10)" />
        {[0, 1, 2, 3].map(i => (
          <g key={i} transform={`translate(${8 + i * 26}, 30)`}>
            <rect width="7" height="4" rx="1.5" fill="hsl(152,42%,12%)" opacity="0.8" />
            <rect width="14" height="2" rx="1" fill="hsl(152,8%,48%)" opacity="0.35" y="6" />
          </g>
        ))}
        <rect x="8" y="40" width="104" height="0.75" rx="0.375" fill="rgba(0,58,48,0.10)" />
        {/* body sections */}
        <rect x="8" y="44" width="30" height="3" rx="1.5" fill="hsl(152,42%,12%)" opacity="0.6" />
        <rect x="8" y="50" width="104" height="2" rx="1" fill="hsl(152,8%,48%)" opacity="0.3" />
        <rect x="8" y="55" width="90" height="2" rx="1" fill="hsl(152,8%,48%)" opacity="0.2" />
        <rect x="8" y="60" width="50" height="2" rx="1" fill="hsl(152,8%,48%)" opacity="0.15" />
      </svg>
    ),
  },
  {
    type: "dandy-versus" as const,
    label: "Dandy: 2 Column Comparison",
    category: "Content" as BlockCategory,
    defaultProps: (): DandyVersusBlockProps => ({
      eyebrow: "WHY DANDY",
      headline: "2 column content boxes",
      leftLabel: "OLD WAY",
      leftTitle: "Traditional Lab",
      leftDesc: "Talk with Sales to determine the best plan for your practice based on your scanner preferences.",
      leftBullets: ["Remake prone analog workflows", "Annoying calls saying your scan is bad", "Cross your fingers the case looks right", "2+ week for zirconia crowns"],
      leftCtaText: "Go truly digital",
      leftCtaUrl: "#form",
      rightLabel: "NEW WAY",
      rightTitle: "Dandy",
      rightDesc: "Talk with Sales to determine the best plan for your practice based on your scanner preferences.",
      rightBullets: ["Scan for everything w/ less remakes", "Get scans reviewed with patient in chair", "No surprises with 3D design approval", "5-day zirconia crowns"],
      rightCtaText: "Go truly digital",
      rightCtaUrl: "#form",
      bgColor: "#003A30",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#003A30" rx="4"/>
        <rect x="6" y="16" width="50" height="52" rx="4" fill="white"/>
        <rect x="64" y="16" width="50" height="52" rx="4" fill="#006651"/>
        <rect x="12" y="22" width="20" height="3" rx="1" fill="#C7E738"/>
        <rect x="12" y="28" width="35" height="3" rx="1.5" fill="#003A30"/>
        {[0,1,2,3].map(i => <rect key={i} x="12" y={36+i*7} width="30" height="2" rx="1" fill="rgba(0,58,48,0.2)"/>)}
        <rect x="70" y="22" width="20" height="3" rx="1" fill="#C7E738"/>
        <rect x="70" y="28" width="35" height="3" rx="1.5" fill="white"/>
        {[0,1,2,3].map(i => <rect key={i} x="70" y={36+i*7} width="30" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>)}
      </svg>
    ),
  },
  {
    type: "dandy-columns-v2" as const,
    label: "Dandy: Columns Variant 2",
    category: "Content" as BlockCategory,
    defaultProps: (): DandyColumnsV2BlockProps => ({
      eyebrow: "GET STARTED",
      headline: "Columns Variant 2",
      subheadline: "Get a free intraoral scanner, access to premium dental lab services—backed by flexible plans tailored to your practice.",
      items: [
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/col-item-1.jpg", title: "Private Practices", description: "Simplify your workflows, grow your case volume, and elevate patient care—with greater control and predictability.", bullets: ["Free scanner, laptop, and cart for your practice"], ctaText: "GET STARTED", ctaUrl: "/get-started/" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/col-item-2.jpg", title: "Group Practices", description: "Standardize care across locations, improve operational efficiency, and support your team with scalable digital solutions.", bullets: ["Free scanner, laptop, and cart for each location"], ctaText: "GET STARTED", ctaUrl: "/get-started/" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/col-item-3.jpg", title: "DSOs", description: "Boost profitability, consolidate lab spend, and ensure consistent, high-quality care across every location.", bullets: ["Free scanner, laptop, and cart for each location"], ctaText: "GET STARTED", ctaUrl: "/get-started/" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="white" rx="4"/>
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={6+i*38} y="8" width="34" height="22" rx="3" fill="#E8F5F0"/>
            <rect x={6+i*38} y="34" width="24" height="3" rx="1.5" fill="#003A30"/>
            <rect x={6+i*38} y="40" width="30" height="2" rx="1" fill="rgba(0,58,48,0.2)"/>
            <rect x={6+i*38} y="44" width="28" height="2" rx="1" fill="rgba(0,58,48,0.15)"/>
            <rect x={6+i*38} y="52" width="22" height="6" rx="3" fill="#003A30" opacity="0.1"/>
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dandy-columns-v3" as const,
    label: "Dandy: Columns Variant 3",
    category: "Content" as BlockCategory,
    defaultProps: (): DandyColumnsV3BlockProps => ({
      eyebrow: "GETTING STARTED",
      headline: "Columns Variant 3",
      subheadline: "Get a free intraoral scanner, access to premium dental lab services—backed by flexible plans tailored to your practice.",
      items: [
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/col-type-1.svg", title: "Choose your plan", description: "Talk with Sales to determine the best plan for your practice based on your scanner preferences and lab spend commitment." },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/col-type-2.svg", title: "Schedule free training", description: "Empower your staff with CE-credited intraoral scanner training to master digital workflows for any case." },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/col-type-3.svg", title: "Place your first lab order", description: "Get high-quality restorations with industry-leading turnaround times from our state-of-the-art full-service digital dental lab." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={6+i*38} y="12" width="14" height="14" rx="3" fill="#E8F5F0"/>
            <rect x={6+i*38} y="30" width="20" height="3" rx="1.5" fill="#C7E738" opacity="0.7"/>
            <rect x={6+i*38} y="36" width="28" height="2" rx="1" fill="#003A30" opacity="0.7"/>
            <rect x={6+i*38} y="40" width="30" height="2" rx="1" fill="rgba(0,58,48,0.2)"/>
            <rect x={6+i*38} y="44" width="24" height="2" rx="1" fill="rgba(0,58,48,0.15)"/>
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dandy-vertical-tabs" as const,
    label: "Dandy: Vertical Tabs",
    category: "Content" as BlockCategory,
    defaultProps: (): DandyVerticalTabsBlockProps => ({
      headline: "Vertical Tabs",
      subheadline: "Seat better fitting crowns with the only 2-step computer vision + lab tech quality control process.",
      tabs: [
        { title: "Collect faster with 5 day delivery.", description: "Traditional labs slow you down. Get fast, reliable crowns made in the USA.", ctaText: "Learn more", ctaUrl: "/", imageUrl: "https://www.meetdandy.com/wp-content/uploads/2022/09/demo-image-00005-scaled.jpg" },
        { title: "Drop-in crowns — powered by AI.", description: "Deliver flawless seatings with AI prep analysis and computer vision QC that spots and fixes issues the human eye can't see.", ctaText: "Learn more", ctaUrl: "/", imageUrl: "https://www.meetdandy.com/wp-content/uploads/2022/09/demo-image-00005-scaled.jpg" },
        { title: "Save on premium zirconia at $99 per unit.", description: "Feel confident in the quality you're delivering to patients – without breaking the bank.", ctaText: "Learn more", ctaUrl: "/", imageUrl: "https://www.meetdandy.com/wp-content/uploads/2022/09/demo-image-00005-scaled.jpg" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="white" rx="4"/>
        <rect x="6" y="10" width="40" height="60" rx="2" fill="#F5F9F7"/>
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={i===0?8:10} y={16+i*18} width={i===0?3:1} height="12" rx="1" fill={i===0?"#C7E738":"rgba(0,58,48,0.15)"}/>
            <rect x={14} y={16+i*18} width="26" height="3" rx="1.5" fill={i===0?"#003A30":"rgba(0,58,48,0.3)"}/>
            {i===0 && <rect x={14} y={21} width="22" height="2" rx="1" fill="rgba(0,58,48,0.2)"/>}
          </g>
        ))}
        <rect x="52" y="10" width="62" height="60" rx="4" fill="#E8F5F0"/>
      </svg>
    ),
  },
  {
    type: "dandy-switchback" as const,
    label: "Dandy: Switchback",
    category: "Content" as BlockCategory,
    defaultProps: (): DandySwitchbackBlockProps => ({
      eyebrow: "WHY DANDY",
      headline: "Switchback",
      subheadline: "The first and only full-service dental lab to unite scanning technology, on-demand clinical expertise, and advanced manufacturing into one integrated system.",
      items: [
        { title: "Innovative lab products", description: "Get quality and precision on every order with Dandy's advanced digital manufacturing. Unlock 2-Appointment Dentures, 5-Day Crowns, straight-to-finish partials, and more.", ctaText: "Learn more", ctaUrl: "/labs/", imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/05/dandy-innovative-lab-products-2.jpg" },
        { title: "One-connected digital workflow", description: "No more fragmented systems. With Dandy, your entire digital workflow from scan to final delivery lives in one connected platform.", ctaText: "Learn more", ctaUrl: "/technology/", imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/05/dandy-digital-workflow-2.jpg" },
        { title: "Live clinical support", description: "Increase confidence on every case—chat with technicians, join video calls, and get scans reviewed in two minutes or less while the patient is still in the chair.", ctaText: "Learn more", ctaUrl: "/clinical-support/", imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/05/dandy-live-clinical-support-2.png" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        <rect x="6" y="8" width="50" height="64" rx="2" fill="#F5F9F7"/>
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={10} y={12+i*20} width="38" height="3" rx="1.5" fill={i===0?"#003A30":"rgba(0,58,48,0.3)"}/>
            {i===0 && <>
              <rect x={10} y={18} width="34" height="2" rx="1" fill="rgba(0,58,48,0.2)"/>
              <rect x={10} y={22} width="28" height="2" rx="1" fill="rgba(0,58,48,0.15)"/>
            </>}
            <rect x={10} y={i===0?28:14+i*20} width="120" height="0.5" fill="rgba(0,58,48,0.1)"/>
          </g>
        ))}
        <rect x="62" y="20" width="52" height="40" rx="4" fill="#E8F5F0"/>
      </svg>
    ),
  },
  {
    type: "dandy-site-header" as const,
    label: "Dandy: Site Header",
    category: "Layout" as BlockCategory,
    defaultProps: (): DandySiteHeaderBlockProps => ({
      logoUrl: "",
      phoneNumber: "(315)-859-0703",
      phoneLabel: "Sales: (315)-859-0703",
      primaryCtaText: "GET PRICING",
      primaryCtaUrl: "/get-pricing/",
      secondaryCtaText: "GET STARTED",
      secondaryCtaUrl: "/get-started/",
      navLinks: [
        { label: "Lab Services", url: "/labs/" },
        { label: "Solutions", url: "/solutions/" },
        { label: "Technology & Support", url: "/technology/" },
        { label: "Pricing", url: "/pricing/" },
        { label: "Learning", url: "/learning-center/" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#F5F9F7" rx="4"/>
        <rect width="120" height="24" fill="#003A30" rx="4"/>
        <rect y="16" width="120" height="8" fill="#003A30"/>
        <rect x="8" y="8" width="20" height="8" rx="2" fill="#C7E738" opacity="0.3"/>
        {[0,1,2,3].map(i => <rect key={i} x={36+i*16} y={10} width="12" height="4" rx="1" fill="rgba(255,255,255,0.4)"/>)}
        <rect x="90" y="8" width="22" height="8" rx="4" fill="#C7E738"/>
      </svg>
    ),
  },
  {
    type: "dandy-site-footer" as const,
    label: "Dandy: Site Footer",
    category: "Layout" as BlockCategory,
    defaultProps: (): DandySiteFooterBlockProps => ({
      logoUrl: "",
      disclaimer: "",
      copyrightText: "",
      linkGroups: [
        { heading: "Company", links: [{ label: "Home", url: "/" }, { label: "Pricing", url: "/pricing/" }, { label: "About", url: "/about/" }, { label: "Careers", url: "/careers/" }, { label: "Privacy Policy", url: "/privacy-policy/" }, { label: "Terms of Use", url: "/terms-of-use/" }] },
        { heading: "Product", links: [{ label: "Features", url: "/features/" }, { label: "Integrations", url: "/integrations/" }, { label: "Pricing", url: "/pricing/" }] },
        { heading: "Resources", links: [{ label: "Blog", url: "/blog/" }, { label: "Help Center", url: "/help/" }, { label: "Contact", url: "/contact/" }] },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        <rect x="6" y="8" width="22" height="8" rx="2" fill="#E8F5F0"/>
        <rect x="6" y="20" width="26" height="1.5" rx="0.75" fill="rgba(0,58,48,0.15)"/>
        <rect x="6" y="24" width="22" height="1.5" rx="0.75" fill="rgba(0,58,48,0.1)"/>
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={36+i*21} y="8" width="16" height="2.5" rx="1" fill="#003A30" opacity="0.5"/>
            {[0,1,2,3].map(j => <rect key={j} x={36+i*21} y={14+j*5} width="14" height="2" rx="1" fill="rgba(0,58,48,0.2)"/>)}
          </g>
        ))}
        <rect x="6" y="66" width="40" height="1" rx="0.5" fill="rgba(0,58,48,0.15)"/>
        {[0,1,2].map(i => <rect key={i} x={96+i*8} y="63" width="7" height="7" rx="3.5" fill="#E8F5F0"/>)}
      </svg>
    ),
  },
  {
    type: "dandy-video-testimonials" as const,
    label: "Dandy: Video Testimonials",
    category: "Social Proof" as BlockCategory,
    defaultProps: (): DandyVideoTestimonialsBlockProps => ({
      eyebrow: "OUR CUSTOMERS",
      headline: "Don't just take our word for it.",
      subheadline: "See why 6,000+ dentists choose Dandy.",
      items: [
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-michael-cabral.png", name: "Dr. Michael Cabral, DMD", practiceName: "Northeast Dental Partners", videoId: "hz0p4h4b4d", videoSrc: "/videos/dr-michael-cabral.mp4" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-raj-patel.png", name: "Dr. Raj Patel", practiceName: "Raj Patel DDS", videoId: "qmhzl4s9uu", videoSrc: "/videos/dr-raj-patel.mp4" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-brooke-sears.png", name: "Brooke Sears, RDA", practiceName: "Mars Hill Dental", videoId: "ubdyvhz8gr", videoSrc: "/videos/brooke-sears.mp4" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-alexandar-linares.png", name: "Dr. Alexander Linares", practiceName: "Linares Family Dental", videoId: "nzv4qhsjps", videoSrc: "/videos/dr-alexander-linares.mp4" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-daniel-bures.png", name: "Dr. Daniel Bures", practiceName: "Daniel Bures DDS", videoId: "qvibi5zelu", videoSrc: "/videos/dr-daniel-bures.mp4" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-jessica-krausz.png", name: "Dr. Jessica Krausz", practiceName: "Claire M. Giordano DDS", videoId: "lv3tsbzpmq", videoSrc: "/videos/dr-jessica-krausz.mp4" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-tiffanie-garrison.png", name: "Dr. Tiffanie Garrison-Jeter", practiceName: "Definition Dental Studio", videoId: "vaj3mi8u4a", videoSrc: "/videos/dr-tiffanie-garrison-jeter.mp4" },
        { imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/06/testimonial-doctor-johnimel-bianco-1.png", name: "Dr. Johnimel Bianco", practiceName: "All Care General Dentistry", videoId: "cytjwcmfdz", videoSrc: "/videos/dr-johnimel-bianco.mp4" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        <rect x="6" y="8" width="30" height="3" rx="1.5" fill="#003A30"/>
        <rect x="6" y="14" width="20" height="2" rx="1" fill="rgba(0,58,48,0.3)"/>
        {[0,1,2,3,4].map(i => (
          <g key={i}>
            <rect x={6+i*22} y="22" width="18" height="50" rx="4" fill="#003A30" opacity={i===0?0.8:0.5}/>
            <circle cx={15+i*22} cy="47" r="5" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1"/>
            <path d={`M${14+i*22} 44.5 L${18+i*22} 47 L${14+i*22} 49.5Z`} fill="white" opacity="0.8"/>
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dandy-side-image-v6" as const,
    label: "Dandy: Side Image Variation 6",
    category: "Content" as BlockCategory,
    defaultProps: (): DandySideImageV6BlockProps => ({
      eyebrow: "WHY DANDY",
      headline: "The complete digital dental platform.",
      subheadline: "Dandy combines best-in-class lab work, an intraoral scanner, and AI-powered software into one seamless experience.",
      bullets: [
        "Free intraoral scanner, laptop, and cart for your practice",
        "5-day zirconia crowns with AI-powered quality control",
        "Live clinical support while the patient is still in the chair",
        "One platform—scan, design, order, track—all in one place",
      ],
      ctaText: "Get a Free Demo",
      ctaUrl: "/get-started/",
      secondaryCtaText: "See How It Works",
      secondaryCtaUrl: "/technology/",
      imageUrl: "https://www.meetdandy.com/wp-content/uploads/2025/05/dandy-innovative-lab-products-2.jpg",
      badgeText: "6,000+ practices",
      imagePosition: "right",
      bgColor: "#FDFCFA",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        <rect x="6" y="10" width="52" height="60" rx="2" fill="white"/>
        <rect x="10" y="14" width="16" height="2" rx="1" fill="#C7E738"/>
        <rect x="10" y="20" width="40" height="3" rx="1.5" fill="#003A30"/>
        <rect x="10" y="26" width="36" height="2" rx="1" fill="rgba(0,58,48,0.25)"/>
        {[0,1,2,3].map(i=><g key={i}><circle cx="13" cy={35+i*7} r="2.5" fill="#C7E738"/><rect x="18" y={33.5+i*7} width="28" height="2" rx="1" fill="rgba(0,58,48,0.2)"/></g>)}
        <rect x="10" y="65" width="22" height="6" rx="3" fill="#C7E738"/>
        <rect x="66" y="10" width="48" height="60" rx="4" fill="#E8F5F0"/>
      </svg>
    ),
  },
  {
    type: "dandy-hero-v7-s3" as const,
    label: "Dandy: Hero 7 — Inline Form",
    category: "Hero" as BlockCategory,
    defaultProps: (): DandyHeroV7S3BlockProps => ({
      eyebrow: "FREE INTRAORAL SCANNER",
      headline: "The future of dentistry is digital.",
      subheadline: "Join 6,000+ practices that switched to Dandy. Get a free scanner, access to premium lab work, and live clinical support—all in one platform.",
      inputPlaceholder: "Enter your work email",
      ctaText: "Get a Free Demo",
      formDisclaimer: "No commitment required. We'll reach out within one business day.",
      bgColor: "#003A30",
      bgImageOpacity: 0.15,
      trustItems: [
        { value: "6,000+", label: "Dental Practices" },
        { value: "5-Day", label: "Zirconia Crowns" },
        { value: "2 Min", label: "Scan Review" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#003A30" rx="4"/>
        <rect x="20" y="10" width="20" height="2" rx="1" fill="#C7E738" opacity="0.7"/>
        <rect x="10" y="16" width="100" height="5" rx="2.5" fill="white" opacity="0.9"/>
        <rect x="20" y="25" width="80" height="3" rx="1.5" fill="white" opacity="0.4"/>
        <rect x="30" y="31" width="60" height="2" rx="1" fill="white" opacity="0.3"/>
        <rect x="8" y="40" width="76" height="10" rx="4" fill="white" opacity="0.15"/>
        <rect x="86" y="40" width="26" height="10" rx="4" fill="#C7E738"/>
        <rect x="8" y="55" width="104" height="1" rx="0.5" fill="white" opacity="0.1"/>
        <rect x="20" y="59" width="18" height="2" rx="1" fill="white" opacity="0.3"/>
        <rect x="47" y="59" width="18" height="2" rx="1" fill="white" opacity="0.3"/>
        <rect x="74" y="59" width="18" height="2" rx="1" fill="white" opacity="0.3"/>
      </svg>
    ),
  },
  {
    type: "dandy-form-right-alt" as const,
    label: "Dandy: Form — Right Align Alt",
    category: "Lead Capture" as BlockCategory,
    defaultProps: (): DandyFormRightAltBlockProps => ({
      eyebrow: "GET STARTED TODAY",
      headline: "Schedule a free demo with our team.",
      subheadline: "See how Dandy can transform your practice. We'll walk you through our full platform—no commitment required.",
      bullets: [
        "Get a free intraoral scanner for your practice",
        "Same-day scan review with a live technician",
        "Industry-leading 5-day zirconia crowns",
        "Dedicated onboarding and clinical support",
      ],
      trustNote: "🔒 Your information is safe with us. We never share your data.",
      formHeadline: "Request a Free Demo",
      formSubheadline: "Fill out the form and we'll be in touch within one business day.",
      submitText: "Get a Free Demo",
      formDisclaimer: "No commitment required.",
      successMessage: "Thanks! A Dandy rep will reach out within one business day.",
      bgColor: "#FDFCFA",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        <rect x="6" y="12" width="14" height="2" rx="1" fill="#C7E738" opacity="0.8"/>
        <rect x="6" y="18" width="48" height="4" rx="2" fill="#003A30"/>
        <rect x="6" y="26" width="44" height="2" rx="1" fill="rgba(0,58,48,0.25)"/>
        {[0,1,2,3].map(i=><g key={i}><circle cx="9" cy={35+i*7} r="2" fill="#C7E738"/><rect x="14" y={33.5+i*7} width="32" height="2" rx="1" fill="rgba(0,58,48,0.2)"/></g>)}
        <rect x="66" y="6" width="48" height="68" rx="6" fill="white" style={{filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.08))"}}/>
        <rect x="72" y="14" width="36" height="3" rx="1.5" fill="#003A30"/>
        {[0,1,2,3].map(i=><rect key={i} x="72" y={22+i*11} width="36" height="7" rx="3" fill="#F1F5F9"/>)}
        <rect x="72" y="68" width="36" height="0" rx="0" fill="#C7E738"/>
      </svg>
    ),
  },
  {
    type: "dandy-conversion-panel-1" as const,
    label: "Dandy: Conversion Panel 1",
    category: "CTA" as BlockCategory,
    defaultProps: (): DandyConversionPanel1BlockProps => ({
      eyebrow: "READY TO GO DIGITAL?",
      headline: "Join 6,000+ practices already on Dandy.",
      subheadline: "Get a free intraoral scanner, access to premium lab services, and live clinical support—all in one platform.",
      primaryCtaText: "Get a Free Demo",
      primaryCtaUrl: "/get-started/",
      secondaryCtaText: "Talk to Sales",
      secondaryCtaUrl: "/contact/",
      style: "teal",
      stats: [
        { value: "6,000+", label: "Dental Practices" },
        { value: "5-Day", label: "Zirconia Crowns" },
        { value: "$0", label: "Scanner Cost" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#003A30" rx="4"/>
        <rect x="30" y="10" width="20" height="2" rx="1" fill="#C7E738" opacity="0.7"/>
        <rect x="15" y="16" width="90" height="5" rx="2.5" fill="white" opacity="0.9"/>
        <rect x="25" y="25" width="70" height="2" rx="1" fill="white" opacity="0.4"/>
        <rect x="35" y="31" width="50" height="2" rx="1" fill="white" opacity="0.3"/>
        <rect x="28" y="40" width="30" height="9" rx="4" fill="#C7E738"/>
        <rect x="62" y="40" width="30" height="9" rx="4" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.6"/>
        <rect x="6" y="58" width="108" height="0.8" rx="0.4" fill="white" opacity="0.12"/>
        {[0,1,2].map(i=><g key={i}><rect x={15+i*34} y="63" width="20" height="3" rx="1.5" fill="white" opacity="0.7"/><rect x={18+i*34} y="69" width="14" height="2" rx="1" fill="white" opacity="0.3"/></g>)}
      </svg>
    ),
  },
  {
    type: "dandy-cta-block" as const,
    label: "Dandy: CTA Block",
    category: "CTA" as BlockCategory,
    defaultProps: (): DandyCtaBlockProps => ({
      eyebrow: "GET STARTED",
      headline: "Ready to transform your practice?",
      subheadline: "Schedule a free demo and see how Dandy's digital platform can help you deliver better outcomes—faster.",
      primaryCtaText: "Get a Free Demo",
      primaryCtaUrl: "/get-started/",
      secondaryCtaText: "Learn More",
      secondaryCtaUrl: "/technology/",
      alignment: "center",
      bgColor: "#FDFCFA",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        <rect x="43" y="12" width="34" height="2" rx="1" fill="#C7E738" opacity="0.8"/>
        <rect x="15" y="18" width="90" height="5" rx="2.5" fill="#003A30" opacity="0.85"/>
        <rect x="20" y="27" width="80" height="2" rx="1" fill="rgba(0,58,48,0.3)"/>
        <rect x="30" y="31" width="60" height="2" rx="1" fill="rgba(0,58,48,0.2)"/>
        <rect x="24" y="42" width="34" height="10" rx="5" fill="#C7E738"/>
        <rect x="62" y="42" width="34" height="10" rx="5" fill="none" stroke="#003A30" strokeWidth="1.5" strokeOpacity="0.4"/>
      </svg>
    ),
  },
  {
    type: "one-pager-hero" as const,
    label: "One-Pager Hero",
    category: "DSO" as BlockCategory,
    defaultProps: (): OnePagerHeroBlockProps => ({
      partnerName: "Partner Name",
      tagline: "Your custom partnership overview",
      subtitle: "Achieve quality, consistency, and control at scale.",
      sideImageUrl: "",
      phone: "",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect width="66" height="70" fill="#003A30" rx="4" />
        <rect x="2" rx="1" y="2" width="30" height="3" fill="rgba(255,255,255,0.6)" />
        <rect x="2" y="12" width="14" height="2" rx="1" fill="#C7E738" opacity="0.8" />
        <rect x="2" y="17" width="50" height="6" rx="2" fill="rgba(255,255,255,0.85)" />
        <rect x="2" y="26" width="42" height="2.5" rx="1" fill="rgba(255,255,255,0.35)" />
        <rect x="2" y="30" width="36" height="2.5" rx="1" fill="rgba(255,255,255,0.25)" />
        <rect x="68" width="52" height="70" fill="#006651" />
        <rect x="74" y="20" width="34" height="30" rx="3" fill="rgba(255,255,255,0.12)" />
      </svg>
    ),
  },
  {
    type: "event-page" as const,
    label: "Event Page",
    category: "Events" as BlockCategory,
    defaultProps: (): EventPageBlockProps => ({
      eventName: "Inside Dandy",
      eventSubtitle: "Executive Lab Experience",
      logoUrl: "",
      navLinks: [
        { label: "Agenda", href: "#agenda" },
        { label: "Details", href: "#details" },
        { label: "Photos", href: "#photos" },
      ],
      navCtaText: "Reserve Your Seat",
      navCtaUrl: "#rsvp",
      heroEyebrow: "You're Invited",
      heroImageUrl: "/event-assets/hero-provo.jpg",
      heroTagline: "Three days of five-star hospitality, private lab access, and the strategic conversations shaping the future of dentistry.",
      heroLocation: "SALT LAKE CITY, UT · SPOTS ARE LIMITED",
      heroCtaText: "REQUEST ACCESS",
      agendaEyebrow: "The Agenda",
      agendaHeadline: "Three Days, Full Access",
      agendaSubtitle: "A curated experience designed for executives scaling DSOs — combining strategic insight, operational depth, and world-class hospitality.",
      agendaValueProps: [
        "EXCLUSIVE 2026 PRODUCT ROADMAP ACCESS",
        "Private 1:1 DSO strategy sessions",
        "Automation infrastructure deep-dive",
        "Peer networking with PE-backed DSO leaders",
      ],
      agendaDays: [
        {
          day: "Day One",
          title: "Arrival",
          description: "Arrive in Salt Lake City and settle into five-star luxury at The Grand America Hotel, then enjoy an intimate, fine dining experience with fellow DSO leaders.",
          highlight: "After dinner, head to Delta Center for a thrilling professional hockey or basketball game from a private suite — complete with premium hospitality and elevated service. Build relationships with peers navigating the same growth, integration, and platform-scaling challenges you are.",
        },
        {
          day: "Day Two",
          title: "Lab Tour & Strategy",
          description: "Gain unprecedented access to our Lehi and Provo Labs, including our brand-new Provo facility. See firsthand the automation infrastructure that's driving measurable same-store growth, EBITDA improvement, and remake elimination across the platform.",
          highlight: "Receive exclusive insights into our 2026 product roadmap — shared with only our most strategic partners. Experience hands-on product demonstrations and get private 1:1 strategy sessions tailored to your DSO's growth targets and operational goals. Conclude the evening with unforgettable views at Van Ryder Rooftop Bar.",
        },
        {
          day: "Day Three",
          title: "Indulge Your Way",
          description: "Choose how you want to wrap up the trip — you've earned it.",
          highlight: "Unwind with a signature spa experience at the Grand America, enjoy an elevated après-ski escape in the Wasatch Mountains, or perfect your swing on one of Utah's premier golf courses.",
        },
      ],
      photos: [
        { src: "/event-assets/carousel-hotel.jpg", alt: "Five-star luxury at The Grand America Hotel", caption: "The Grand America Hotel" },
        { src: "/event-assets/carousel-dining.jpg", alt: "Intimate fine dining experience", caption: "Private Fine Dining" },
        { src: "/event-assets/carousel-hockey.jpg", alt: "Utah Mammoth hockey from a private suite", caption: "Private Suite at Delta Center" },
        { src: "/event-assets/carousel-lab-floor.jpg", alt: "Dandy lab floor with Versamill milling machines", caption: "Dandy Lab Floor" },
        { src: "/event-assets/carousel-lab-machine.png", alt: "Precision dental manufacturing at Dandy", caption: "Precision Manufacturing" },
        { src: "/event-assets/carousel-ai-scan.jpg", alt: "AI-powered dental scanning technology", caption: "AI Scanning Technology" },
        { src: "/event-assets/carousel-rooftop.jpg", alt: "Sweeping mountain views from Van Ryder Rooftop", caption: "Van Ryder Rooftop Bar" },
        { src: "/event-assets/carousel-spa.jpg", alt: "Signature spa experience", caption: "Spa & Wellness" },
      ],
      detailsEyebrow: "The Details",
      detailsHeadline: "What to Expect",
      detailsSubtitle: "Everything is taken care of. Focus on the conversations, insights, and relationships that will accelerate your platform's next phase of growth.",
      details: [
        { label: "When", value: "Rolling dates, 2026", sub: "Tuesday through Thursday" },
        { label: "Where", value: "Salt Lake City, UT", sub: "The Grand America Hotel" },
        { label: "Experience", value: "All-Inclusive", sub: "By invitation only" },
      ],
      rsvpEyebrow: "Limited Availability",
      rsvpHeadline: "Request a Tour",
      rsvpSubtitle: "This is an intimate, invitation-only experience reserved for executives at leading DSOs. Complete the form below to request access.",
      formSteps: [
        {
          title: "Your Information",
          fields: [
            { id: "firstName", type: "text" as const, label: "First Name", placeholder: "First name", required: true },
            { id: "lastName", type: "text" as const, label: "Last Name", placeholder: "Last name", required: true },
            { id: "email", type: "email" as const, label: "Email Address", placeholder: "you@company.com", required: true },
            { id: "phone", type: "phone" as const, label: "Phone Number", placeholder: "(555) 000-0000", required: true },
          ],
        },
        {
          title: "Your Preferences",
          fields: [
            { id: "company", type: "text" as const, label: "Company / DSO Name", placeholder: "Your organization", required: true },
            { id: "dietaryRestrictions", type: "text" as const, label: "Dietary Restrictions", placeholder: "None, vegetarian, gluten-free…", required: false },
            { id: "labCoatSize", type: "select" as const, label: "Lab Coat Size", placeholder: "Select your lab coat size", required: true, options: ["XS", "S", "M", "L", "XL", "XXL"] },
            { id: "successGoal", type: "textarea" as const, label: "What would make this lab tour successful for you?", placeholder: "Share your top goal…", required: false },
            { id: "activityChoice", type: "select" as const, label: "Day Three Activity", placeholder: "Select your activity of choice on Day Three", required: true, options: ["Ski Day", "Spa Day", "Golf Day", "None of the above"] },
          ],
        },
      ],
      footerText: "© 2026 Dandy · Inside Dandy: Executive Lab Experience",
      theme: {
        bg: "#0c0f12",
        cardBg: "#141619",
        fg: "#eeeae3",
        headingColor: "#eeeae3",
        primary: "#b59a6e",
        muted: "#7a8088",
        border: "#262a2f",
        navBg: "#0c0f12",
        navBgOpacity: 0.6,
        navText: "#eeeae3",
        displayFontFamily: "EB Garamond",
        bodyFontFamily: "Inter",
      },
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#0c0f12" rx="4"/>
        <rect x="0" y="0" width="120" height="32" fill="#141619" rx="4"/>
        <rect x="4" y="4" width="20" height="3" rx="1.5" fill="rgba(181,154,110,0.5)"/>
        <rect x="90" y="4" width="26" height="3" rx="1.5" fill="rgba(238,234,227,0.3)"/>
        <rect x="35" y="10" width="50" height="8" rx="2" fill="rgba(238,234,227,0.85)"/>
        <rect x="44" y="21" width="32" height="2" rx="1" fill="rgba(181,154,110,0.7)"/>
        <rect x="14" y="36" width="12" height="2" rx="1" fill="#b59a6e"/>
        <rect x="14" y="40" width="30" height="1.5" rx="0.75" fill="rgba(238,234,227,0.4)"/>
        <rect x="14" y="43" width="24" height="1.5" rx="0.75" fill="rgba(122,128,136,0.4)"/>
        <rect x="70" y="36" width="12" height="2" rx="1" fill="#b59a6e"/>
        <rect x="70" y="40" width="30" height="1.5" rx="0.75" fill="rgba(238,234,227,0.4)"/>
        <rect x="70" y="43" width="24" height="1.5" rx="0.75" fill="rgba(122,128,136,0.4)"/>
        <rect x="14" y="50" width="40" height="10" rx="2" fill="#141619"/>
        <rect x="58" y="50" width="48" height="10" rx="2" fill="#141619"/>
        <rect x="40" y="66" width="40" height="8" rx="1" fill="#b59a6e"/>
      </svg>
    ),
  },
  {
    type: "event-landing-hero" as const,
    label: "Dandy Events Page",
    category: "Events" as BlockCategory,
    defaultProps: (): EventLandingHeroBlockProps => ({
      backgroundImage:
        "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2400&auto=format&fit=crop",
      backgroundImageAlt: "City skyline at dusk",
      backgroundOverlay: 0.5,
      overlayColor: "#000000",
      headline: "Dandy After Hours: New York",
      dateText: "Wednesday June 10 & Thursday June 11, 2026",
      ctaText: "Save Your Spot",
      ctaUrl: "#rsvp",
      showScrollIndicator: true,
      scrollLabel: "SCROLL DOWN",
      scrollTargetId: "rsvp",
      align: "center",
      headlineMaxWidthCh: 18,
      headlineFontScale: 1,
      dateFontScale: 1,
      showDetailsSection: true,
      detailsBackgroundStyle: "light-gray",
      detailsAnchorId: "rsvp",
      whatToExpectHeading: "What to expect",
      whatToExpectBody:
        "Join us for an evening of conversation, cocktails, and connection with Dandy leadership and fellow practice owners. Hear how leading DSOs are scaling their lab spend with Dandy and what's next on the product roadmap.",
      eventDetailsHeading: "Event Details",
      eventDetailsBody:
        "Two nights of curated programming at one of New York's most iconic rooftop venues.",
      eventDetailsBullets: [
        "Wednesday June 10 — 6:00pm Welcome reception",
        "Thursday June 11 — 6:30pm Dinner & program",
        "Cocktail attire",
        "Manhattan venue (address shared after RSVP)",
      ],
      formHeading: "Save your spot",
      formSubheading: "Spots are limited — RSVP to confirm your seat.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="evlh-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a2540" />
            <stop offset="1" stopColor="#0a1124" />
          </linearGradient>
        </defs>
        <rect width="120" height="70" fill="url(#evlh-sky)" rx="4" />
        {/* skyline silhouette */}
        <g fill="#000" opacity="0.55">
          <rect x="0" y="38" width="14" height="32" />
          <rect x="14" y="30" width="10" height="40" />
          <rect x="24" y="34" width="8" height="36" />
          <rect x="32" y="22" width="12" height="48" />
          <rect x="44" y="32" width="9" height="38" />
          <rect x="53" y="26" width="11" height="44" />
          <rect x="64" y="34" width="8" height="36" />
          <rect x="72" y="20" width="14" height="50" />
          <rect x="86" y="30" width="10" height="40" />
          <rect x="96" y="34" width="9" height="36" />
          <rect x="105" y="28" width="15" height="42" />
        </g>
        {/* dark overlay */}
        <rect width="120" height="70" fill="#000" opacity="0.35" rx="4" />
        {/* headline */}
        <rect x="22" y="22" width="76" height="6" rx="1" fill="#fff" />
        <rect x="34" y="32" width="52" height="5" rx="1" fill="#fff" opacity="0.92" />
        {/* date */}
        <rect x="40" y="42" width="40" height="2.5" rx="1" fill="#fff" opacity="0.7" />
        {/* CTA pill */}
        <rect x="44" y="50" width="32" height="9" rx="4.5" fill="#003A30" />
        <rect x="50" y="53" width="20" height="3" rx="1" fill="#C7E738" />
        {/* scroll-down dot */}
        <circle cx="60" cy="65" r="1.2" fill="#fff" opacity="0.7" />
      </svg>
    ),
  },
  {
    type: "product-launch" as const,
    label: "Product Launch / Keynote",
    category: "Events" as BlockCategory,
    defaultProps: (): ProductLaunchBlockProps => ({
      colorScheme: "dark",
      productName: "Aura Max",
      navCtaText: "Buy",
      navCtaUrl: "#order",
      navChapters: [
        { id: "hero", label: "Vision" },
        { id: "design", label: "Design" },
        { id: "acoustics", label: "Acoustics" },
        { id: "specs", label: "Specs" },
        { id: "plans", label: "Buy" },
      ],
      heroEyebrow: "The New Era",
      heroTitle: "Aura Max.",
      heroTagline: "High-fidelity audio. Completely reimagined.",
      heroPrimaryCtaText: "Buy",
      heroPrimaryCtaUrl: "#plans",
      heroSecondaryCtaText: "Watch the film",
      heroSecondaryCtaUrl: "#",
      heroVideoUrl: "",
      heroPosterUrl: "",
      slabs: [
        {
          id: "design",
          eyebrow: "Feature 01",
          title: "An elegant composition.",
          body: "Crafted with an acoustically engineered mesh canopy and custom-designed memory foam ear cushions.",
          bullets: ["Aerospace-grade aluminum frame", "Memory-foam ear cushions", "Five color finishes"],
          accentColor: "#FF375F",
          imageUrl: "",
          reverse: false,
          kpis: [
            { value: "320 g", label: "Featherweight build" },
            { value: "5", label: "Color finishes" },
            { value: "IP54", label: "Sweat & dust rated" },
          ],
        },
        {
          id: "acoustics",
          eyebrow: "Feature 02",
          title: "Computational audio.",
          body: "Dual H2 chips deliver an industry-leading listening experience through breakthrough computational audio.",
          bullets: ["Dual H2 chips", "Personalized Spatial Audio", "Adaptive transparency"],
          accentColor: "#32D74B",
          imageUrl: "",
          reverse: true,
          kpis: [
            { value: "2×", label: "More noise cancellation" },
            { value: "48 kHz", label: "Lossless playback" },
            { value: "<20 ms", label: "End-to-end latency" },
          ],
        },
        {
          id: "battery",
          eyebrow: "Feature 03",
          title: "Power for days.",
          body: "Up to 30 hours of listening time with Active Noise Cancellation enabled. Charge via MagSafe.",
          bullets: ["30 hours playback", "Fast wireless charging", "USB-C for charging case"],
          accentColor: "#FF9F0A",
          imageUrl: "",
          reverse: false,
          kpis: [
            { value: "30 hr", label: "Playback time" },
            { value: "5 min", label: "Charge for 1 hr listen" },
            { value: "MagSafe", label: "Wireless charging" },
          ],
        },
      ],
      specsHeadline: "Compare the models.",
      specsColumns: ["Aura Light", "Aura Pro", "Aura Max"],
      featuredColumnIndex: 2,
      specsRows: [
        { label: "Driver", values: ["40mm", "50mm Custom", "50mm Pro-G"] },
        { label: "Noise Cancellation", values: ["Active", "Advanced", "Pro-level"] },
        { label: "Spatial Audio", values: ["No", "Personalized", "Personalized w/ Head Tracking"] },
        { label: "Battery Life", values: ["20 hours", "24 hours", "30 hours"] },
        { label: "Materials", values: ["Plastic", "Aluminum", "Stainless Steel"] },
        { label: "Weight", values: ["250g", "280g", "320g"] },
      ],
      plansHeadline: "Pick yours.",
      plans: [
        {
          name: "Aura Light",
          price: "$249",
          features: ["40mm Drivers", "Active Noise Cancellation", "20 hours battery"],
          ctaText: "Buy Aura Light",
          ctaUrl: "#",
          highlight: false,
        },
        {
          name: "Aura Pro",
          price: "$399",
          features: ["50mm Custom Drivers", "Advanced ANC", "Spatial Audio", "24 hours battery"],
          ctaText: "Buy Aura Pro",
          ctaUrl: "#",
          highlight: true,
        },
        {
          name: "Aura Max",
          price: "$549",
          features: ["50mm Pro-G Drivers", "Pro-level ANC", "Head Tracking", "30 hours battery", "Carrying Case"],
          ctaText: "Buy Aura Max",
          ctaUrl: "#",
          highlight: false,
        },
      ],
      ctaHeadline: "Aura Max.",
      ctaSubtitle: "Sound, perfected.",
      ctaButtonText: "Order Now",
      ctaButtonUrl: "#",
      footerText: "Copyright © 2026 Aura Inc. All rights reserved.",
      lightTheme: {},
      darkTheme: {},
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#000000" rx="4" />
        <rect x="0" y="0" width="120" height="10" fill="#151516" />
        <rect x="6" y="3.5" width="14" height="3" rx="1" fill="#FFFFFF" />
        <rect x="92" y="3.5" width="22" height="3" rx="1.5" fill="#0A84FF" />
        <rect x="30" y="22" width="60" height="10" rx="2" fill="#FFFFFF" />
        <rect x="40" y="36" width="40" height="3" rx="1.5" fill="#86868B" />
        <rect x="20" y="44" width="80" height="22" rx="4" fill="#151516" stroke="#333336" strokeWidth="0.5" />
        <circle cx="60" cy="55" r="6" fill="#0A84FF" opacity="0.3" />
        <rect x="50" y="70" width="20" height="4" rx="2" fill="#0A84FF" />
      </svg>
    ),
  },
  {
    type: "story-hub" as const,
    label: "Customer Story Hub",
    category: "Social Proof" as BlockCategory,
    defaultProps: (): StoryHubBlockProps => ({
      colorScheme: "dark",
      eyebrow: "Customer Stories — Volume 04",
      heroTitle: "Stories from",
      heroAccent: "the network.",
      subhead:
        "How modern dental practices are quietly rewriting what's possible — one case, one chair, one patient at a time.",
      featured: {
        tag: "Featured · Practice of the Year",
        title: "How a third-generation practice scanned its way into its busiest year ever.",
        doctor: "Dr. Eleanor Voss, DDS",
        practice: "Voss & Daughters Dental",
        location: "Charleston, SC",
        imageUrl:
          "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=2000&q=80",
        href: "#",
      },
      filters: ["All Stories", "Growth", "Workflow", "Patient Care", "Aesthetics"],
      stories: [
        {
          id: "s1",
          practice: "Northbrook Dental Studio",
          location: "Chicago, IL",
          headline: "From 14-day turnaround to 4 days — without changing a single technician.",
          tag: "Workflow",
          imageUrl:
            "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1200&q=80",
          href: "#",
        },
        {
          id: "s2",
          practice: "Marin Bay Implant Center",
          location: "Sausalito, CA",
          headline: "The full-arch case that finally felt routine.",
          tag: "Patient Care",
          imageUrl:
            "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80",
          href: "#",
        },
        {
          id: "s3",
          practice: "Pearl + Park",
          location: "Brooklyn, NY",
          headline: "A boutique practice quietly doubles veneer revenue.",
          tag: "Aesthetics",
          imageUrl:
            "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&q=80",
          href: "#",
        },
        {
          id: "s4",
          practice: "Hill Country Family Dental",
          location: "Austin, TX",
          headline: "Why their associate stopped looking at other labs.",
          tag: "Growth",
          imageUrl:
            "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=1200&q=80",
          href: "#",
        },
        {
          id: "s5",
          practice: "Cascade Restorative",
          location: "Portland, OR",
          headline: "How fewer remakes became a recruiting story.",
          tag: "Workflow",
          imageUrl:
            "https://images.unsplash.com/photo-1583912267550-d6c2ac3196c0?w=1200&q=80",
          href: "#",
        },
        {
          id: "s6",
          practice: "Lakeside Smile Co.",
          location: "Minneapolis, MN",
          headline: "Going digital, without losing a beloved craft feel.",
          tag: "Aesthetics",
          imageUrl:
            "https://images.unsplash.com/photo-1571772996211-2f02c9727629?w=1200&q=80",
          href: "#",
        },
      ],
      stats: [
        { number: "12,000+", label: "Practices in the Network" },
        { number: "4.2 days", label: "Average Crown Turnaround" },
        { number: "99.2%", label: "First-Fit Rate" },
        { number: "4.9 / 5", label: "Practice Satisfaction" },
      ],
      ctaHeadline: "There's a story waiting in your practice, too.",
      ctaPrimaryText: "Talk to our team",
      ctaPrimaryUrl: "#contact",
      ctaSecondaryText: "Read more stories →",
      ctaSecondaryUrl: "#stories",
      lightTheme: {},
      darkTheme: {},
    } as StoryHubBlockProps),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#0C0F12" rx="4" />
        {/* eyebrow + headline */}
        <rect x="42" y="10" width="36" height="2" rx="1" fill="#EAE4D6" opacity="0.5" />
        <rect x="30" y="16" width="60" height="4" rx="1" fill="#EAE4D6" />
        <rect x="44" y="22" width="32" height="4" rx="1" fill="#B59A6E" fontStyle="italic" />
        {/* featured hero */}
        <rect x="10" y="30" width="100" height="22" rx="1.5" fill="#1A1F25" />
        <rect x="14" y="44" width="40" height="2" rx="1" fill="#EAE4D6" opacity="0.8" />
        <rect x="14" y="48" width="28" height="1.5" rx="0.5" fill="#EAE4D6" opacity="0.5" />
        {/* filter pills */}
        <rect x="10" y="55" width="14" height="3" rx="1.5" fill="#B59A6E" />
        <rect x="26" y="55" width="12" height="3" rx="1.5" fill="none" stroke="#EAE4D6" strokeOpacity="0.15" strokeWidth="0.5" />
        <rect x="40" y="55" width="14" height="3" rx="1.5" fill="none" stroke="#EAE4D6" strokeOpacity="0.15" strokeWidth="0.5" />
        {/* story cards */}
        <rect x="10" y="61" width="30" height="14" rx="1" fill="#1A1F25" />
        <rect x="45" y="61" width="30" height="14" rx="1" fill="#1A1F25" />
        <rect x="80" y="61" width="30" height="14" rx="1" fill="#1A1F25" />
      </svg>
    ),
  },
  {
    type: "business-case-split" as const,
    label: "Business Case — Split Hero",
    category: "DSO Microsites" as BlockCategory,
    defaultProps: (): BusinessCaseSplitBlockProps => ({
      forCompanyLabel: "For {{company_name}}",
      logoUrl: "/dandy-logo-white.svg",
      logoAlt: "Dandy",
      heroImageUrl: "/dental-professional.png",
      heroEyebrow: "The Business Case",
      heroHeadline: "Building the business case for {{company_name}}'s next chapter.",
      heroSubhead: "The DSO landscape is shifting from fragmented vendor management to centralized, digital-first clinical operations. Here is how leading groups are capitalizing on the change.",
      heroPrimaryCtaText: "Schedule a working session",
      heroPrimaryCtaUrl: "#contact",
      heroSecondaryCtaText: "Read the 5-min summary",
      heroSecondaryCtaUrl: "#summary",
      situationEyebrow: "01",
      situationHeading: "The Situation",
      situationBody: "Scaling a DSO today requires more than just acquiring practices. It demands standardizing clinical quality across hundreds of chairs while managing capital expenditure. Fragmented labs, varying scanner ecosystems, and high remake rates are silently eroding gross margins and frustrating providers. The model must evolve.",
      situationStats: [
        { value: "$40k+", label: "Average scanner capex per office" },
        { value: "5-7%", label: "Industry average remake rate" },
        { value: "4+", label: "Distinct lab vendors managed per clinic" },
      ],
      signalEyebrow: "02",
      signalHeading: "Dandy adoption is accelerating",
      signalCards: [
        { icon: "trending-up", stat: "+312%", body: "YoY growth in digital removables cases across enterprise partners." },
        { icon: "users", stat: "1 in 3", body: "New doctors ask for Dandy by name during the recruitment process." },
        { stat: "", body: "Our associates were demanding better tech. Bringing Dandy in immediately improved our retention and accelerated our digital transition without the upfront capex.", attribution: "VP of Operations, Top 50 DSO" },
      ],
      costEyebrow: "03",
      costHeading: "The Cost of Inaction",
      costItems: [
        { stat: "7%", label: "Remake Rate", description: "The analog industry average, costing hours of unbillable chair time." },
        { stat: "120+", label: "Lost Hours / Year", description: "Per doctor, spent managing physical impressions and lab disputes." },
        { stat: "$40k", label: "Scanner Capex", description: "The upfront cost to digitize a single practice using traditional models." },
        { stat: "4-6", label: "Vendor Count", description: "Fragmented lab partners causing inconsistent quality and opaque data." },
      ],
      shiftEyebrow: "04",
      shiftHeading: "The Paradigm Shift",
      shiftRows: [],
      shiftOldBullets: [
        { title: "Analog Impressions", body: "Messy, uncomfortable for patients, prone to distortion and errors." },
        { title: "Fragmented Lab Network", body: "Managing multiple local labs with varying quality standards and systems." },
        { title: "Opaque Operations", body: "Zero visibility into remake rates, lab spend, or clinical performance at scale." },
        { title: "High Capital Expenditure", body: "Purchasing expensive scanners outright and managing hardware lifecycles." },
      ],
      shiftNewBullets: [
        { title: "100% Digital Workflow", body: "Best-in-class intraoral scanners provided, ensuring precise data capture." },
        { title: "Single Partner", body: "One standardized platform for all indications, from crowns to clear aligners." },
        { title: "Real-Time Data Visibility", body: "Enterprise dashboard tracking every metric across every practice and doctor." },
        { title: "Zero Capex Model", body: "Scanners and training included with lab partnership. Immediate ROI." },
      ],
      mathEyebrow: "05",
      mathHeading: "The Math",
      mathSubhead: "Based on {{practice_count}} offices",
      mathOfficeCount: "{{practice_count}}",
      mathVolumeLabel: "Est. Monthly Case Volume",
      mathVolumeValue: "~450",
      mathStats: [
        { label: "Gross Margin Uplift", value: "+12%", caption: "Estimated annual improvement" },
        { label: "Chair Hours Saved", value: "1,200+", caption: "Across the network annually" },
        { label: "Capex Avoided", value: "$850k", caption: "By utilizing Dandy's scanner model" },
        { label: "Payback Period", value: "Immediate", caption: "ROI realized in month one" },
      ],
      proofEyebrow: "06",
      proofHeading: "The Proof",
      proofFeatured: {
        quote: "Partnering with Dandy was the single highest ROI operational decision we made this year. We digitized 45 practices in 90 days with zero capex, and our doctors couldn't be happier with the clinical quality.",
        name: "Dr. Sarah Jenkins",
        title: "Chief Clinical Officer, Summit Smile Group (45 practices)",
      },
      proofSecondary: [
        { quote: "Our remake rate dropped from 6% to under 2% across the entire network in the first quarter.", name: "Michael Chang", title: "COO, Pacific Coast DSO (28 practices)" },
        { quote: "The enterprise dashboard finally gave us the visibility we needed to standardize care.", name: "Amanda Reyes", title: "VP Operations, Heartland Dental Partners" },
      ],
      planEyebrow: "07",
      planHeading: "The Plan",
      planSteps: [
        { num: "01", title: "Scope", timeframe: "Week 1", description: "Identify a 5-office pilot cohort. Baseline current metrics and align on success criteria." },
        { num: "02", title: "Onboard & Train", timeframe: "Week 2-4", description: "Scanners delivered. White-glove clinical training for doctors and staff." },
        { num: "03", title: "Measure", timeframe: "Month 2", description: "Track case acceptance, turnaround times, and remake rate improvements." },
        { num: "04", title: "Scale", timeframe: "Month 3+", description: "Roll out the Dandy operating system organization-wide." },
      ],
      finalCtaHeading: "Let's build the business case for {{company_name}}.",
      finalCtaSubhead: "Schedule a consultative working session to map out the financial and clinical impact of standardizing on Dandy.",
      finalCtaPrimaryText: "Schedule a working session",
      finalCtaPrimaryUrl: "#contact",
      finalCtaSecondaryText: "or download the one-pager",
      finalCtaSecondaryUrl: "#download",
      bgColor: "#f6f5ee",
      inkColor: "#0f2a1c",
      darkColor: "#0d1f15",
      accentColor: "#c8e84e",
      accentInkColor: "#0d1f15",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#f6f5ee" rx="4" />
        <rect x="0" y="0" width="66" height="34" fill="#0d1f15" />
        <rect x="66" y="0" width="54" height="34" fill="#1a3a26" />
        <rect x="6" y="4" width="14" height="2" rx="1" fill="#fff" />
        <rect x="6" y="14" width="48" height="3" rx="1" fill="#fff" />
        <rect x="6" y="19" width="40" height="3" rx="1" fill="#fff" />
        <rect x="6" y="28" width="22" height="3" rx="1" fill="#c8e84e" />
        <rect x="6" y="40" width="20" height="2" rx="1" fill="#0f2a1c" />
        <rect x="30" y="40" width="14" height="2" rx="1" fill="#0f2a1c" opacity="0.4" />
        <rect x="6" y="46" width="50" height="2" rx="1" fill="#0f2a1c" opacity="0.5" />
        <rect x="62" y="46" width="50" height="2" rx="1" fill="#0f2a1c" opacity="0.3" />
        <rect x="6" y="58" width="24" height="14" rx="1" fill="#fff" />
        <rect x="34" y="58" width="24" height="14" rx="1" fill="#fff" />
        <rect x="62" y="58" width="24" height="14" rx="1" fill="#0d1f15" />
        <rect x="90" y="58" width="24" height="14" rx="1" fill="#fff" />
      </svg>
    ),
  },
  {
    type: "business-case-centered" as const,
    label: "Business Case — Centered Hero",
    category: "DSO Microsites" as BlockCategory,
    defaultProps: (): BusinessCaseCenteredBlockProps => ({
      forCompanyLabel: "For {{company_name}}",
      logoUrl: "/dandy-logo-white.svg",
      logoAlt: "Dandy",
      heroEyebrow: "The Business Case",
      heroHeadline: "The case for {{company_name}} and Dandy, in plain numbers.",
      heroSubhead: "A comprehensive analysis of how transitioning to a fully digital lab partner impacts clinical outcomes, operational efficiency, and EBITDA at scale.",
      heroPrimaryCtaText: "Schedule a working session",
      heroPrimaryCtaUrl: "#contact",
      heroSecondaryCtaText: "Read the 5-min summary",
      heroSecondaryCtaUrl: "#summary",
      situationEyebrow: "",
      situationHeading: "The Situation",
      situationBody: "DSOs operating at scale are encountering a structural ceiling. Legacy workflows demand massive upfront CAPEX for intraoral scanners, while managing dozens of fragmented local labs creates inconsistent clinical quality and unpredictable costs.",
      situationBodyExtra: "Meanwhile, clinical recruitment and retention have never been more competitive. Doctors expect modern, digital-first workflows that reduce chair time and eliminate frustrating remakes.",
      situationStats: [
        { value: "$30k+", label: "Scanner CAPEX", description: "Average upfront cost per office just for hardware." },
        { value: "4-6", label: "Vendor Sprawl", description: "Average number of lab partners a typical DSO manages." },
        { value: "6-8%", label: "Remake Rate", description: "Industry average, resulting in unbillable chair time." },
      ],
      signalEyebrow: "THE SIGNAL",
      signalHeading: "Doctors are demanding a better standard of care.",
      signalCards: [
        { stat: "+312%", body: "Growth in Dandy removables YoY across our DSO partners." },
        { stat: "1 in 3", body: "New clinical hires ask for Dandy by name during recruitment." },
        { stat: "", body: "We realized we were losing top producers because our legacy lab workflows were frustrating them.", attribution: "VP of Clinical Ops" },
      ],
      costEyebrow: "",
      costHeading: "The Cost of Inaction",
      costSubhead: "Sticking with the status quo isn't neutral. It actively erodes margin and limits growth potential.",
      costItems: [
        { num: "01", stat: "7.2%", label: "Average Remake Rate", description: "Every remake costs an estimated $350 in unbillable chair time." },
        { num: "02", stat: "1,200", label: "Lost Chair Hours / Yr", description: "Based on an average 10-office DSO relying on analog impressions." },
        { num: "03", stat: "$35k", label: "Scanner CAPEX", description: "Upfront capital per office that could be deployed for growth." },
        { num: "04", stat: "12+", label: "Fragmented Vendors", description: "Creating inconsistent quality and opaque unit economics." },
      ],
      shiftEyebrow: "",
      shiftHeading: "The Paradigm Shift",
      shiftRows: [
        { category: "Turnaround Time", oldWay: "2-3 weeks, unpredictable", withDandy: "5-7 days, guaranteed" },
        { category: "First-Time-Right Rate", oldWay: "~92% industry average", withDandy: "99% digital precision" },
        { category: "Doctor Experience", oldWay: "Analog impressions, blind delivery", withDandy: "100% digital, full case visibility" },
        { category: "Data & Visibility", oldWay: "Zero central oversight", withDandy: "Real-time DSO analytics dashboard" },
        { category: "Partnership Model", oldWay: "Transactional vendor", withDandy: "Strategic growth partner (Zero CAPEX)" },
      ],
      shiftOldBullets: [],
      shiftNewBullets: [],
      mathEyebrow: "",
      mathHeading: "The Math",
      mathSubhead: "Based on our analysis for {{company_name}} across {{practice_count}} offices.",
      mathOfficeCount: "{{practice_count}}",
      mathVolumeLabel: "Est. Monthly Restorations",
      mathVolumeValue: "1,450",
      mathStats: [
        { label: "Incremental Cases / Mo", value: "+185" },
        { label: "Chair Hours Saved / Yr", value: "4,200" },
        { label: "Est. Gross Margin Uplift", value: "+14%" },
        { label: "Payback Period", value: "Immediate", caption: "(Zero CAPEX model)" },
      ],
      proofEyebrow: "",
      proofHeading: "Trusted by industry leaders",
      proofFeatured: {
        quote: "Dandy didn't just digitize our labs; they fundamentally changed our unit economics. We've eliminated scanner CAPEX entirely, reduced remakes to near-zero, and our doctors couldn't be happier. It's the most compelling ROI equation in dental right now.",
        name: "Dr. Sarah Jenkins",
        title: "Chief Clinical Officer, Summit Smile Group (42 offices)",
      },
      proofSecondary: [
        { quote: "Rolling out Dandy across 80 locations took less time than a single traditional hardware procurement cycle. The training is phenomenal.", name: "Marcus Thorne", title: "VP Operations, Heartland Dental Partners" },
        { quote: "The real-time data visibility into lab spend and remake rates across all our clinics has been a game-changer for our finance team.", name: "Elena Rostova", title: "CFO, Pacific Coast DSO" },
      ],
      planEyebrow: "",
      planHeading: "The Activation Plan",
      planSubhead: "A derisked, systematic approach to rolling out digital workflows.",
      planSteps: [
        { num: "01", title: "Scope Pilot", timeframe: "Week 1", description: "Select 5 representative offices to establish baseline metrics." },
        { num: "02", title: "Onboard & Train", timeframe: "Weeks 2-4", description: "Scanner delivery and in-person clinical training by Dandy experts." },
        { num: "03", title: "Measure Impact", timeframe: "Month 2", description: "Track case acceptance, turnaround times, and doctor satisfaction." },
        { num: "04", title: "Org-wide Rollout", timeframe: "Month 3+", description: "Phased deployment across all remaining practices." },
      ],
      finalCtaHeading: "Let's build the business case for {{company_name}}.",
      finalCtaSubhead: "Schedule a 45-minute working session with our enterprise team to run your specific numbers through our ROI model.",
      finalCtaPrimaryText: "Schedule a working session",
      finalCtaPrimaryUrl: "#contact",
      finalCtaSecondaryText: "or download the one-pager",
      finalCtaSecondaryUrl: "#download",
      bgColor: "#f6f5ee",
      inkColor: "#0d1f15",
      darkColor: "#0d1f15",
      accentColor: "#c8e84e",
      accentInkColor: "#0d1f15",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#f6f5ee" rx="4" />
        <rect x="0" y="0" width="120" height="34" fill="#0d1f15" />
        <rect x="6" y="4" width="14" height="2" rx="1" fill="#fff" />
        <rect x="100" y="4" width="14" height="2" rx="1" fill="#c8e84e" />
        <rect x="50" y="11" width="20" height="1.5" rx="0.5" fill="#c8e84e" />
        <rect x="22" y="16" width="76" height="4" rx="1" fill="#fff" />
        <rect x="32" y="22" width="56" height="3" rx="1" fill="#fff" opacity="0.7" />
        <rect x="46" y="28" width="28" height="3" rx="1" fill="#c8e84e" />
        <rect x="6" y="40" width="32" height="3" rx="1" fill="#0d1f15" />
        <rect x="6" y="46" width="42" height="2" rx="1" fill="#0d1f15" opacity="0.5" />
        <rect x="56" y="40" width="18" height="14" rx="1" fill="#fff" stroke="#0d1f15" strokeWidth="0.3" />
        <rect x="76" y="40" width="18" height="14" rx="1" fill="#fff" stroke="#0d1f15" strokeWidth="0.3" />
        <rect x="96" y="40" width="18" height="14" rx="1" fill="#fff" stroke="#0d1f15" strokeWidth="0.3" />
        <rect x="6" y="60" width="108" height="14" rx="1" fill="#0d1f15" />
        <rect x="14" y="65" width="20" height="2" rx="1" fill="#c8e84e" />
        <rect x="40" y="65" width="20" height="2" rx="1" fill="#c8e84e" />
        <rect x="66" y="65" width="20" height="2" rx="1" fill="#c8e84e" />
        <rect x="92" y="65" width="18" height="2" rx="1" fill="#c8e84e" />
      </svg>
    ),
  },
  {
    type: "business-case-premium" as const,
    label: "Business Case — Premium Editorial",
    category: "DSO Microsites" as BlockCategory,
    defaultProps: (): BusinessCasePremiumBlockProps => ({
      forCompanyLabel: "For {{company_name}}",
      forPillMode: "pill",
      forPillLogoUrl: "",
      forPillLogoAlt: "",
      forPillCtaText: "",
      forPillCtaUrl: "",
      tableAccentColor: "",
      logoUrl: "/dandy-logo-white.svg",
      logoAlt: "Dandy",
      kicker: "Field study · Confidential",
      heroEyebrow: "Organic demand from {{company_name}} practices",
      heroHeadline: "Why {{company_name}} doctors keep finding Dandy.",
      heroSubhead: "{{company_name}} practices have been reaching out. Here's what they're telling us — and what it signals for the network.",
      heroPrimaryCtaText: "Schedule a working session",
      heroPrimaryCtaUrl: "#contact",
      heroSecondaryCtaText: "",
      heroSecondaryCtaUrl: "",
      heroLayout: "split-image-right",
      heroImageUrl: "",
      heroImageFocus: "center",
      heroImageTone: "greyscale",
      heroImageZoom: "fill",
      heroImageCaption: "Field study · 8 active practices · 30+ inbound requests",
      situationImageUrl: "",
      proofImageUrl: "",
      volumeLabel: "Volume I",
      issueLabel: "2025 · No. 01",
      plateLabel: "Plate 01",
      situationEyebrow: "The signal",
      situationHeading: "Removables are a clinical opportunity.",
      situationBody: "30+ {{company_name}} doctors and regional managers have reached out asking to start using Dandy. 8 practices are already active, with monthly orders heavily skewed toward partials and full dentures.",
      situationBodyExtra: "Their reasons for finding us are consistent: they're solving real pain points with hard-to-ignore ROI.",
      situationStats: [
        { value: "30+", label: "Inbound requests", description: "Practices from every region asking to work with us." },
        { value: "8", label: "Active practices", description: "Already using Dandy while waiting for vendor approval." },
        { value: "$25K–$28K", label: "Monthly combined spend", description: "Combined spend from active {{company_name}} practices." },
        { value: "Removables", label: "Most requested orders", description: "Partials and dentures driving the most demand." },
      ],
      signalEyebrow: "The clinical case",
      signalHeading: "Solving the biggest challenges {{company_name}} practices are facing.",
      signalCards: [
        { stat: "01", body: "Impression quality — analog impressions introduce variability that propagates through the entire workflow." },
        { stat: "02", body: "Removables gap — practices run 5–6 appointment denture workflows. Dandy cuts that to 2–3." },
        { stat: "03", body: "In-house printing — SprintRay and PrimePrint are hard to standardize across locations." },
        { stat: "04", body: "Current labs are inconsistent — doctors report 'hit or miss' results without an accountable, vertically integrated partner." },
        { stat: "05", body: "Immediate dentures — in high-extraction markets, Dandy's workflow replaces multi-reline processes at lower cost." },
        { stat: "", body: "Doctors keep telling us the same thing — they need one accountable partner, not five vendors and a printer.", attribution: "Dandy enterprise team" },
      ],
      costEyebrow: "The operational layer",
      costHeading: "What regional leaders are telling us.",
      costSubhead: "Regionals and clinical leaders struggle with little to no real-time visibility into lab performance across locations. Dandy Hub changes that.",
      costItems: [
        { num: "01", stat: "0%", label: "Clinical oversight visibility", description: "Most groups have no shared view of scan quality, remakes, or case outcomes across locations." },
        { num: "02", stat: "Real-time", label: "Case data access", description: "Live metrics on scan quality, remake rates, and case outcomes in one dashboard." },
        { num: "03", stat: "AI", label: "Scan Review tool", description: "Monitor clinical quality without being on-site daily." },
        { num: "04", stat: "1 view", label: "Across every location", description: "Coach with data, not instinct — provider-level performance, not just practice averages." },
      ],
      shiftEyebrow: "See everything",
      shiftHeading: "See everything. Before it becomes a problem.",
      shiftRows: [
        { category: "Remake rates", oldWay: "Tracked by practice only, weeks late", withDandy: "Tracked by provider, in real time" },
        { category: "Provider performance", oldWay: "Coaching based on instinct", withDandy: "Coach with data, side-by-side comparisons" },
        { category: "Spend tracking", oldWay: "Reconciled monthly, by location", withDandy: "Live, every dollar, every location" },
        { category: "Scan quality", oldWay: "Caught at delivery (or never)", withDandy: "Flagged before the case ships" },
        { category: "Operational view", oldWay: "Phone calls and spreadsheets", withDandy: "Purpose-built analytics for modern groups" },
      ],
      shiftOldBullets: [],
      shiftNewBullets: [],
      mathEyebrow: "The math",
      mathHeading: "What this looks like at {{company_name}} scale.",
      mathSubhead: "Modeled across {{company_name}}'s network of {{practice_count}} offices using current active-practice metrics.",
      mathOfficeCount: "{{practice_count}}",
      mathVolumeLabel: "Active Practices Today",
      mathVolumeValue: "8",
      mathHeroEyebrow: "Inbound requests",
      mathHeroStat: "30+",
      mathHeroDescription: "Doctors and regional managers reaching out organically — before any formal vendor approval.",
      mathStats: [
        { value: "$25K–$28K", label: "Monthly combined spend" },
        { value: "Removables", label: "Most requested orders" },
        { value: "2–3", label: "Denture appointments", caption: "vs. 5–6 industry standard" },
        { value: "Zero", label: "CAPEX to start", caption: "Scanners included" },
      ],
      proofEyebrow: "Your clinical perspective",
      proofHeading: "What active {{company_name}} practices are telling us.",
      proofFeatured: {
        quote: "Removables were our biggest gap. We had three vendors and an in-house printer, and we still couldn't deliver consistent dentures. Dandy is the first partner that's actually accountable for the whole workflow.",
        name: "Active {{company_name}} practice",
        title: "Regional clinical lead",
      },
      proofSecondary: [
        { quote: "Cutting denture workflows from six appointments to two changes the economics of every removable case we accept.", name: "Practice owner", title: "{{company_name}} affiliate practice" },
        { quote: "Real-time scan quality flags mean we catch issues at the chair, not at delivery. That's the visibility our regionals have been asking for.", name: "Regional manager", title: "{{company_name}} operations" },
      ],
      planEyebrow: "Next step",
      planHeading: "A clinical evaluation, not a commitment.",
      planSubhead: "We have a lot of respect for what a formal clinical evaluation requires. We're not asking for a commitment — just your perspective.",
      planSteps: [
        { num: "01", title: "Clinical conversation", timeframe: "Week 1", description: "30-minute working session with your clinical and operations leaders." },
        { num: "02", title: "Side-by-side cases", timeframe: "Weeks 2–3", description: "Run a handful of representative cases through Dandy alongside your current workflow." },
        { num: "03", title: "Review findings", timeframe: "Week 4", description: "Compare turnaround, quality, and chair time on the same patient set." },
        { num: "04", title: "Decide together", timeframe: "Week 5+", description: "If the numbers support it, scope a pilot. If not, we walk away with mutual respect." },
      ],
      finalCtaEyebrow: "Your input can shape better outcomes",
      finalCtaHeading: "Your input can shape better outcomes.",
      finalCtaSubhead: "Thousands of practices rely on us. Purpose-built for multi-location DSOs. Fully integrated hardware, software, and lab.",
      finalCtaPrimaryText: "Schedule a working session",
      finalCtaPrimaryUrl: "#contact",
      finalCtaSecondaryText: "",
      finalCtaSecondaryUrl: "",
      footerLeftLabel: "Dandy × {{company_name}}",
      footerRightLabel: "Confidential · 2025",
      bgColor: "#f6f5ee",
      inkColor: "#0d1f15",
      darkColor: "#0d1f15",
      accentColor: "#c8e84e",
      accentInkColor: "#0d1f15",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#f6f5ee" rx="4" />
        <rect x="0" y="0" width="120" height="8" fill="#0d1f15" />
        <rect x="6" y="3" width="10" height="2" rx="0.5" fill="#fff" />
        <rect x="100" y="2.5" width="14" height="3" rx="1.5" fill="#c8e84e" />
        <rect x="6" y="16" width="50" height="3" rx="0.5" fill="#0d1f15" opacity="0.5" />
        <rect x="6" y="22" width="62" height="6" rx="1" fill="#0d1f15" />
        <rect x="6" y="30" width="56" height="4" rx="1" fill="#0d1f15" />
        <rect x="6" y="38" width="40" height="2.5" rx="0.5" fill="#0d1f15" opacity="0.45" />
        <rect x="14" y="44" width="18" height="3" rx="0.3" fill="#c8e84e" />
        <rect x="74" y="18" width="40" height="38" rx="1" fill="#15321f" stroke="#0d1f15" strokeWidth="0.3" />
        <rect x="76" y="52" width="10" height="1.5" fill="#c8e84e" opacity="0.85" />
        <rect x="6" y="60" width="108" height="14" rx="1" fill="#0d1f15" />
        <rect x="10" y="63" width="34" height="3" rx="0.5" fill="#fff" />
        <rect x="10" y="68" width="22" height="2" rx="0.5" fill="#fff" opacity="0.5" />
        <rect x="86" y="65" width="22" height="4" rx="0.5" fill="#c8e84e" />
      </svg>
    ),
  },
  {
    type: "spatial-tour" as const,
    label: "Spatial Lab Tour",
    category: "Events" as BlockCategory,
    defaultProps: (): SpatialTourBlockProps => ({
      navBrand: "Inside Dandy",
      navLinks: [
        { label: "The Experience", href: "#experience" },
        { label: "The Lab", href: "#lab" },
        { label: "Tour Calendar", href: "#calendar" },
      ],
      navCtaText: "Reserve your visit",
      navCtaUrl: "#rsvp",

      heroEyebrow: "First dental lab on Apple Vision Pro · Launching Dykema 2026",
      heroHeadlineLine1: "Step inside",
      heroHeadlineLine2: "the most advanced",
      headlineEmphasisItalic: true,
      heroHeadlineEmphasis: "dental lab",
      heroHeadlineLine3: "in the industry.",
      heroBody: "A 6–8 minute spatial experience on Apple Vision Pro. One real case, end to end — scan intake, AI design, robotic milling, QC, shipping. Show, don't tell.",
      heroPrimaryCta: "Reserve your visit",
      heroSecondaryCta: "Watch the trailer",
      heroImageUrl: "/event-assets/carousel-lab-machine.png",
      heroVideoUrl: "/videos/dandy-broll.mp4",
      heroTrailerUrl: "/videos/spatial-lab-tour-trailer.mp4",
      heroVisionChipText: "Apple Vision Pro · 6–8 min",
      heroScrollLabel: "The tour begins",

      marqueeItems: [
        { value: "6–8 min", label: "spatial experience" },
        { value: "01", label: "real case, start to finish" },
        { value: "5", label: "stations on the tour" },
        { value: "Q1 2027", label: "tour ends" },
      ],

      manifestoEyebrow: "Why we built this",
      manifestoHeadlineLine1: "Show,",
      manifestoHeadlineEmphasis: "don't tell.",
      manifestoBody1: "Most DSO leaders haven't seen what a fully vertically integrated, AI-driven, robotically manufactured dental lab actually looks like. Until now, no one had built one.",
      manifestoBody2: "So we stopped trying to describe it. We put you inside.",
      manifestoImageUrl: "/event-assets/carousel-lab-floor.jpg",
      manifestoCaption: "Manufacturing floor · NY",

      tourEyebrow: "The Tour · Five Stations",
      tourHeadlineLine1: "One case.",
      tourHeadlineEmphasis: "End to end.",
      tourHeadlineLine3: "Nothing simulated.",
      tourBody: "You'll move through five real stations on our manufacturing floor in 1:1 scale. Real machines. Real technicians. Real timestamps. The full case takes 6–8 minutes — about as long as a coffee.",
      tourStations: [
        {
          number: "01",
          label: "Scan intake",
          imageUrl: "/event-assets/carousel-ai-scan.jpg",
          objectPosition: "center 40%",
          headline: "From chairside to lab in seconds.",
          body: "You'll watch the case enter our system the moment the dentist saves it. No scanned-and-shipped delay. No paper Rx. The intraoral scan crosses the country in seconds, lands on a manufacturing engineer's queue, and starts moving.",
          insetDuration: "0:48",
          insetDetail: "Scan rendering live, in real space.",
        },
        {
          number: "02",
          label: "AI-assisted design",
          imageUrl: "/event-assets/carousel-ai-scan.jpg",
          objectPosition: "center",
          headline: "Millions of cases of pattern recognition.",
          body: "Step inside our design suite as our AI proposes a margin line, an occlusal profile, a contact pattern — drawn from millions of similar cases. A senior CAD designer reviews, refines, and approves. The AI does the predictable work; the human owns the decisions.",
          insetDuration: "1:24",
          insetDetail: "AI design overlay, side by side with the technician.",
        },
        {
          number: "03",
          label: "Robotic milling",
          imageUrl: "/event-assets/carousel-lab-machine.png",
          objectPosition: "center 55%",
          headline: "Manufacturing scale no traditional lab can match.",
          body: "Walk between rows of CNC mills cutting zirconia and lithium disilicate to within 10 microns of design intent. This is not bench work — this is a factory. Twenty-four hours a day, every restoration cut by the same robot, to the same tolerance, every time.",
          insetDuration: "2:06",
          insetDetail: "Stand inside the robotic milling cell — full scale.",
        },
        {
          number: "04",
          label: "QC & finishing",
          imageUrl: "/event-assets/carousel-lab-floor.jpg",
          objectPosition: "center 30%",
          headline: "Every restoration verified before it leaves.",
          body: "See the human hand return — finishing technicians inspect every unit, polish, glaze, and verify against the original prep. Each case is scanned a second time and compared against the design file. Fail any check, and the case goes back, not out the door.",
          insetDuration: "1:12",
          insetDetail: "Final QC station, with scanned-vs-designed comparison.",
        },
        {
          number: "05",
          label: "Shipping & delivery",
          imageUrl: "/event-assets/hero-provo.jpg",
          objectPosition: "center 35%",
          headline: "Back to your operatory on schedule.",
          body: "The case lands in a tray, the tray lands in a box, and the box leaves the building under a tracked SLA. Watch it move from the loading dock to the operatory — the loop closes the moment the dentist seats it. One workflow. One accountable team.",
          insetDuration: "0:54",
          insetDetail: "Track-and-trace, from dock to chair.",
        },
      ],

      calloutEyebrow: "Why spatial",
      calloutHeadlineLine1: "A video tells you",
      calloutHeadlineLine2: "what we built.",
      calloutHeadlineEmphasis: "This puts you in it.",
      calloutPoints: [
        { title: "Walk between machines", body: "A robotic milling cell is 9 feet long. You'll feel it." },
        { title: "Look around, not at.", body: "Designed in spatial — the lab surrounds you, not a screen." },
        { title: "Real time, real scale", body: "Every motion captured at 1:1. Nothing sped up or simulated." },
        { title: "Side-by-side with us", body: "Your account exec stands next to you in the experience." },
      ],

      waysEyebrow: "Four ways to step inside",
      waysHeadlineLine1: "Pick the way",
      waysHeadlineEmphasis: "that works for you.",
      ways: [
        {
          number: "01",
          label: "Dykema 2026",
          eyebrow: "July · Las Vegas",
          body: "Reserved 8-minute booth experience. We'll have a private room, a calendar, and your AirPods Pro waiting.",
          ctaText: "Book a slot",
          imageUrl: "/event-assets/carousel-hotel.jpg",
          objectPosition: "center 40%",
        },
        {
          number: "02",
          label: "On the road",
          eyebrow: "Through Q1 2027",
          body: "Sales onsite visits, DSO HQ tours. Our team brings the experience to your office or boardroom — same kit, same lab, just at your address.",
          ctaText: "Request a visit",
          imageUrl: "/event-assets/carousel-rooftop.jpg",
          objectPosition: "center 25%",
        },
        {
          number: "03",
          label: "Private virtual tour",
          eyebrow: "Anywhere, anytime",
          body: "Schedule a 1:1 walkthrough. We'll ship a Vision Pro to you for the day. Built for execs without a calendar window for travel.",
          ctaText: "Schedule remotely",
          imageUrl: "/event-assets/carousel-spa.jpg",
          objectPosition: "center 35%",
        },
        {
          number: "04",
          label: "In-lab visit",
          eyebrow: "By invitation",
          body: "For select accounts. Tour the actual New York facility — robotic milling, AI design, QC, ship dock — then experience the spatial tour where it was filmed.",
          ctaText: "Request invitation",
          imageUrl: "/event-assets/carousel-lab-floor.jpg",
          objectPosition: "center",
        },
      ],

      calendarEyebrow: "Reserve your visit",
      calendarHeadlineLine1: "Pick a city.",
      calendarHeadlineEmphasis: "Pick a date.",
      calendarBody: "Eight-minute slots, by appointment. Bring one decision-maker, or your whole leadership team — we have rooms for both.",
      calendarPrimaryCta: "Reserve at insidedandy.com",
      calendarSecondaryCta: "Talk to your account exec",
      calendarUrlText: "insidedandy.com/[your-id]",
      calendarPanelTitle: "Upcoming tour dates",
      calendarPanelEyebrow: "2026 — Q1 2027",
      calendarDates: [
        { date: "Jul 18", city: "Las Vegas", event: "Dykema 2026 · Booth 412", status: "Filling fast" },
        { date: "Aug 06", city: "Dallas", event: "On-the-road · DSO HQ Tour", status: "Open" },
        { date: "Sep 12", city: "New York", event: "In-lab · By invitation", status: "Limited" },
        { date: "Oct 03", city: "Chicago", event: "On-the-road · DSO HQ Tour", status: "Open" },
        { date: "Anytime", city: "Anywhere", event: "Private virtual tour", status: "Always open" },
      ],

      footerBrand: "Dandy",
      footerEyebrow: "Inside Dandy · 2026",
      footerInfo: "insidedandy.com · meetdandy.com · accounts@dandy.dental",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#003A30" rx="4"/>
        <rect x="0" y="0" width="120" height="10" fill="#00231D"/>
        <rect x="4" y="3" width="14" height="3" rx="1" fill="rgba(197,241,197,0.8)"/>
        <rect x="92" y="3" width="24" height="4" rx="2" fill="#158915"/>
        <ellipse cx="44" cy="40" rx="14" ry="9" fill="none" stroke="#C5F1C5" strokeWidth="0.8"/>
        <ellipse cx="76" cy="40" rx="14" ry="9" fill="none" stroke="#C5F1C5" strokeWidth="0.8"/>
        <path d="M 30 40 Q 30 28, 44 28 L 76 28 Q 90 28, 90 40 Q 90 52, 76 52 L 44 52 Q 30 52, 30 40 Z" fill="none" stroke="#C5F1C5" strokeWidth="0.8"/>
        <rect x="6" y="60" width="42" height="3" rx="1" fill="rgba(255,255,255,0.85)"/>
        <rect x="6" y="65" width="28" height="2" rx="1" fill="rgba(197,241,197,0.6)"/>
        <rect x="6" y="71" width="20" height="5" rx="2" fill="#158915"/>
        <rect x="60" y="60" width="56" height="16" rx="2" fill="rgba(197,241,197,0.08)" stroke="rgba(197,241,197,0.3)" strokeWidth="0.5"/>
      </svg>
    ),
  },
  {
    type: "horizontal-showcase" as const,
    label: "Horizontal Showcase",
    category: "Hero" as BlockCategory,
    defaultProps: (): HorizontalShowcaseBlockProps => ({
      eyebrow: "OUR WORK",
      headline: "Built for the way you work.",
      bgColor: "#0B0B0F",
      panelHeightVh: 90,
      panels: [
        { tag: "PRODUCT", title: "One canvas. Endless possibility.", body: "A flexible workspace that bends to whatever you're building.", imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80", alignment: "left", bgColor: "#0B0B0F", overlayColor: "rgba(0,0,0,0.6)", accentColor: "#C7E738", ctaText: "Explore", ctaUrl: "#" },
        { tag: "WORKFLOW", title: "Move from idea to live in minutes.", body: "Drag, edit, publish — no engineering bottleneck required.", imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1600&q=80", alignment: "right", bgColor: "#16161D", overlayColor: "rgba(0,0,0,0.55)", accentColor: "#C7E738", ctaText: "Try it", ctaUrl: "#" },
        { tag: "TEAM", title: "Designed with your whole team in mind.", body: "Roles, comments, drafts — collaboration built in from day one.", imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=80", alignment: "left", bgColor: "#1F1F2A", overlayColor: "rgba(0,0,0,0.55)", accentColor: "#C7E738", ctaText: "See how", ctaUrl: "#" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#0B0B0F" rx="4"/>
        <rect x="6"   y="14" width="36" height="52" rx="3" fill="#1F1F2A"/>
        <rect x="44"  y="14" width="36" height="52" rx="3" fill="#16161D"/>
        <rect x="82"  y="14" width="36" height="52" rx="3" fill="#1F1F2A"/>
        <rect x="10"  y="44" width="14" height="3"  rx="1" fill="#C7E738"/>
        <rect x="10"  y="50" width="22" height="2"  rx="1" fill="rgba(255,255,255,0.6)"/>
        <rect x="48"  y="44" width="14" height="3"  rx="1" fill="#C7E738"/>
        <rect x="48"  y="50" width="22" height="2"  rx="1" fill="rgba(255,255,255,0.6)"/>
        <rect x="86"  y="44" width="14" height="3"  rx="1" fill="#C7E738"/>
        <rect x="86"  y="50" width="22" height="2"  rx="1" fill="rgba(255,255,255,0.6)"/>
        <rect x="55"  y="70" width="10" height="2"  rx="1" fill="rgba(255,255,255,0.4)"/>
        <path d="M50 6 L8 6 M48 4 L50 6 L48 8 M70 6 L112 6 M110 4 L112 6 L110 8" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8"/>
      </svg>
    ),
  },
  {
    type: "sticky-stack" as const,
    label: "Sticky Stack",
    category: "Showcase" as BlockCategory,
    defaultProps: (): StickyStackBlockProps => ({
      eyebrow: "WHY US",
      headline: "Three reasons teams choose us.",
      bgColor: "#FAFAF7",
      cardScrollVh: 110,
      cards: [
        { tag: "FAST", title: "Built for speed, every step.", body: "From first draft to live page in under an hour. No more waiting on dev sprints to ship a landing page.", imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80", imageSide: "right", bgColor: "#003a30", textColor: "#fff", accentColor: "#C7E738" },
        { tag: "FLEXIBLE", title: "Mix, match, and brand it your way.", body: "A library of blocks that automatically adopt your colors, fonts, and voice — so every page looks unmistakably yours.", imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80", imageSide: "left", bgColor: "#1a1a1f", textColor: "#fff", accentColor: "#C7E738" },
        { tag: "MEASURABLE", title: "Know what's working — and double down.", body: "Every variation tracked. Every conversion attributed. Real data on the moves that move the needle.", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80", imageSide: "right", bgColor: "#0B0B0F", textColor: "#fff", accentColor: "#C7E738" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FAFAF7" rx="4"/>
        <rect x="14" y="10" width="92" height="44" rx="4" fill="#1a1a1f" opacity="0.5"/>
        <rect x="18" y="14" width="84" height="44" rx="4" fill="#1a1a1f" opacity="0.75"/>
        <rect x="22" y="18" width="76" height="44" rx="4" fill="#003a30"/>
        <rect x="26" y="38" width="14" height="3"  rx="1" fill="#C7E738"/>
        <rect x="26" y="44" width="38" height="3"  rx="1" fill="rgba(255,255,255,0.85)"/>
        <rect x="26" y="50" width="32" height="2"  rx="1" fill="rgba(255,255,255,0.5)"/>
        <rect x="74" y="22" width="20" height="36" rx="2" fill="rgba(199,231,56,0.4)"/>
      </svg>
    ),
  },
  {
    type: "scroll-assembly" as const,
    label: "Scroll Assembly",
    category: "Hero" as BlockCategory,
    defaultProps: (): ScrollAssemblyBlockProps => ({
      eyebrow: "BUILT FOR YOU",
      pieces: [
        { kind: "text-display",  content: "One",       from: "left",   color: "var(--brand-primary)" },
        { kind: "text-display",  content: "platform.", from: "right",  color: "var(--brand-accent)" },
        { kind: "text-headline", content: "Every piece, perfectly in place.", from: "bottom" },
        { kind: "text-body",     content: "Watch each promise click into position as you scroll. No fluff — just the parts that matter, assembled in front of you.", from: "fade" },
      ],
      ctaText: "See it in action",
      ctaUrl: "#",
      bgColor: "#0B0B0F",
      theme: "dark",
      scrollLengthVh: 100,
      decor: "all",
      grain: true,
      floatingImages: [
        "https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&q=80",
        "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80",
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80",
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
      ],
      marqueeTags: [
        "Custom themes", "AI copy", "A/B variants", "Sales console",
        "Lead enrichment", "Tenant-aware", "Fast publishing",
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#FDFCFA" rx="4"/>
        <rect x="6"  y="20" width="22" height="6"  rx="1" fill="#003A30" opacity="0.85"/>
        <rect x="32" y="20" width="34" height="6"  rx="1" fill="#C7E738"/>
        <rect x="68" y="20" width="20" height="6"  rx="1" fill="#003A30" opacity="0.4"/>
        <rect x="14" y="34" width="92" height="3"  rx="1" fill="rgba(0,58,48,0.5)"/>
        <rect x="14" y="40" width="80" height="2"  rx="1" fill="rgba(0,58,48,0.25)"/>
        <rect x="14" y="44" width="64" height="2"  rx="1" fill="rgba(0,58,48,0.18)"/>
        <rect x="40" y="56" width="40" height="10" rx="3" fill="#C7E738"/>
        <path d="M58 70 L58 76 M55 73 L58 76 L61 73" stroke="rgba(0,58,48,0.5)" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    type: "magazine-hero",
    label: "Magazine Hero",
    category: "Showcase",
    defaultProps: () => ({
      eyebrow: "ISSUE 04 / FEATURE",
      headline: "The quiet revolution in how teams ship work.",
      subheadline:
        "An editorial-style intro for product launches, brand stories, and long-form landing pages.",
      ctaText: "Read the story",
      ctaUrl: "#",
      bylineLabel: "By the editors",
      bylineValue: "12 min read",
      imageUrl:
        "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=900&h=1100&fit=crop",
      accentColor: "#FF6B35",
      bgColor: "#FAF7F2",
      textColor: "#0A0A0A",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAF7F2" rx="4" />
        <rect x="10" y="14" width="14" height="2" fill="#FF6B35" />
        <rect x="26" y="13" width="22" height="3" rx="0.5" fill="#0A0A0A" opacity="0.7" />
        <text x="10" y="34" fontSize="14" fontWeight="bold" fill="#0A0A0A" fontFamily="Georgia, serif">Editorial</text>
        <rect x="10" y="40" width="60" height="2.5" rx="1" fill="#0A0A0A" opacity="0.4" />
        <rect x="10" y="46" width="48" height="2.5" rx="1" fill="#0A0A0A" opacity="0.3" />
        <rect x="10" y="56" width="22" height="6" rx="3" fill="#0A0A0A" />
        <rect x="78" y="10" width="34" height="50" rx="2" fill="#FF6B35" opacity="0.55" transform="rotate(2 95 35)" />
        <circle cx="76" cy="14" r="6" fill="#FF6B35" opacity="0.3" />
      </svg>
    ),
  },
  {
    type: "cinematic-video-hero",
    label: "Cinematic Video Hero",
    category: "Showcase",
    defaultProps: () => ({
      showNav: true,
      logoText: "AURA",
      navLinks: [
        { label: "Work", href: "#" },
        { label: "Studio", href: "#" },
        { label: "Contact", href: "#" },
      ],
      navCtaText: "Get Started",
      navCtaUrl: "#",
      eyebrow: "Featured Film",
      headline: "Stories worth watching, told in motion.",
      subheadline:
        "A cinematic full-bleed hero with a looping background film, built for brands that lead with atmosphere.",
      ctaText: "Begin the Journey",
      ctaUrl: "#",
      ctaAction: "url",
      ctaStyle: "buttons",
      ctaSecondaryText: "Watch Film",
      ctaSecondaryAction: "video-modal",
      backgroundVideoUrl: "",
      backgroundImageUrl:
        "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1920&h=1080&fit=crop",
      overlayOpacity: 0.55,
      scrollCueLabel: "Discover",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0A0A0A" rx="4" />
        <rect width="120" height="70" fill="url(#cvg)" rx="4" opacity="0.5" />
        <defs><linearGradient id="cvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity="0.8"/></linearGradient></defs>
        <circle cx="60" cy="30" r="9" fill="#fff" opacity="0.85" />
        <path d="M57 26 L66 30 L57 34 Z" fill="#0A0A0A" />
        <rect x="20" y="48" width="60" height="4" rx="1" fill="#fff" opacity="0.9" />
        <rect x="20" y="56" width="40" height="2.5" rx="1" fill="#fff" opacity="0.5" />
        <rect x="86" y="48" width="14" height="6" rx="3" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "aurora-gradient-hero",
    label: "Aurora Gradient Hero",
    category: "Showcase",
    defaultProps: () => ({
      showNav: true,
      logoText: "Lumina",
      navLinks: [
        { label: "Product", href: "#" },
        { label: "Pricing", href: "#" },
        { label: "Docs", href: "#" },
      ],
      navSignInText: "Sign in",
      navSignInUrl: "#",
      navCtaText: "Start free",
      navCtaUrl: "#",
      badgeText: "Introducing Lumina AI",
      badgeLinkText: "Read announcement",
      badgeLinkUrl: "#",
      headline: "The intelligent canvas for modern teams",
      headlineGradientWord: "intelligent",
      subheadline:
        "Design, build, and ship faster with an aurora of tools that adapt to the way you work.",
      ctaText: "Get started free",
      ctaUrl: "#",
      ctaAction: "url",
      ctaStyle: "buttons",
      ctaSecondaryText: "Book a demo",
      ctaSecondaryAction: "url",
      ctaSecondaryUrl: "#",
      chips: [
        { icon: "Zap", title: "10x faster", subtitle: "Ship in days, not months" },
        { icon: "Shield", title: "Enterprise-ready", subtitle: "SOC 2 Type II" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0B0B14" rx="4" />
        <circle cx="34" cy="22" r="26" fill="#7C3AED" opacity="0.5" />
        <circle cx="86" cy="40" r="28" fill="#C7E738" opacity="0.35" />
        <rect x="34" y="26" width="52" height="5" rx="1" fill="#fff" opacity="0.92" />
        <rect x="34" y="36" width="40" height="3" rx="1" fill="#fff" opacity="0.5" />
        <rect x="34" y="46" width="20" height="6" rx="3" fill="#C7E738" />
        <rect x="58" y="46" width="20" height="6" rx="3" fill="#fff" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "editorial-split-hero",
    label: "Editorial Split Hero",
    category: "Showcase",
    defaultProps: () => ({
      showNav: true,
      logoText: "Maison",
      navLinks: [
        { label: "Collection", href: "#" },
        { label: "About", href: "#" },
        { label: "Journal", href: "#" },
      ],
      navCtaText: "Inquire",
      navCtaUrl: "#",
      eyebrow: "The New Standard",
      headline: "Craft that speaks softly and carries weight.",
      headlineAccentWord: "softly",
      subheadline:
        "An editorial split hero with a refined serif voice — made for premium, design-led brands.",
      ctaText: "Explore the collection",
      ctaUrl: "#",
      ctaAction: "url",
      ctaStyle: "buttons",
      imageUrl:
        "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=1000&h=1200&fit=crop",
      imageSide: "right",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F6F3EE" rx="4" />
        <rect x="10" y="14" width="14" height="2" fill="#B07B4F" />
        <text x="10" y="36" fontSize="13" fontWeight="bold" fill="#1A1A1A" fontFamily="Georgia, serif">Craft</text>
        <rect x="10" y="42" width="44" height="2.5" rx="1" fill="#1A1A1A" opacity="0.35" />
        <rect x="10" y="48" width="34" height="2.5" rx="1" fill="#1A1A1A" opacity="0.25" />
        <rect x="10" y="56" width="24" height="6" rx="1" fill="#1A1A1A" />
        <rect x="74" y="10" width="38" height="50" rx="2" fill="#B07B4F" opacity="0.55" />
      </svg>
    ),
  },
  {
    type: "parallax-layers-hero",
    label: "Parallax Layers Hero",
    category: "Showcase",
    defaultProps: () => ({
      showNav: true,
      logoText: "NEXUS",
      navLinks: [
        { label: "Platform", href: "#" },
        { label: "Solutions", href: "#" },
        { label: "Company", href: "#" },
      ],
      navCtaText: "Request access",
      navCtaUrl: "#",
      badgeText: "Now in public beta",
      headline: "Depth you can feel, performance you can trust.",
      subheadline:
        "A dark parallax hero with drifting layers — engineered for cinematic, high-impact landing pages.",
      ctaText: "Get started",
      ctaUrl: "#",
      ctaAction: "url",
      ctaStyle: "buttons",
      ctaSecondaryText: "See how it works",
      ctaSecondaryAction: "url",
      ctaSecondaryUrl: "#",
      shapeImage1Url: "",
      shapeImage2Url: "",
      shapeImage3Url: "",
      parallaxStrength: 0.5,
      showMarquee: true,
      marqueeLabel: "Trusted by teams at",
      marqueeLogos: ["Vertex", "Quanta", "Northwind", "Helios", "Apex"],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0A0E1A" rx="4" />
        <circle cx="24" cy="20" r="14" fill="#C7E738" opacity="0.4" />
        <rect x="88" y="34" width="22" height="22" rx="4" fill="#3B82F6" opacity="0.45" transform="rotate(12 99 45)" />
        <circle cx="98" cy="16" r="8" fill="#fff" opacity="0.18" />
        <rect x="16" y="34" width="54" height="5" rx="1" fill="#fff" opacity="0.92" />
        <rect x="16" y="44" width="38" height="3" rx="1" fill="#fff" opacity="0.5" />
        <rect x="16" y="54" width="20" height="6" rx="3" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "spotlight-glow-hero",
    label: "Spotlight Glow Hero",
    category: "Showcase",
    defaultProps: () => ({
      showNav: true,
      logoText: "Orbit",
      navLinks: [
        { label: "Features", href: "#" },
        { label: "Pricing", href: "#" },
        { label: "Changelog", href: "#" },
      ],
      navSignInText: "Sign in",
      navSignInUrl: "#",
      navCtaText: "Start building",
      navCtaUrl: "#",
      badgeText: "v2.0 is here",
      headline: "Build at the speed of thought",
      headlineGradientWord: "thought",
      subheadline:
        "A dark spotlight hero with a cursor-follow glow and a bento product preview — made for developer tools and SaaS.",
      ctaText: "Start for free",
      ctaUrl: "#",
      ctaAction: "url",
      ctaStyle: "buttons",
      ctaSecondaryText: "View docs",
      ctaSecondaryAction: "url",
      ctaSecondaryUrl: "#",
      showPreview: true,
      previewImageUrl:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=800&fit=crop",
      codeFileName: "config.ts",
      codeSnippet:
        "export const app = create({\n  name: 'orbit',\n  speed: 'instant',\n});",
      sidebarItems: [
        { icon: "Zap", label: "Instant deploys" },
        { icon: "Lock", label: "Secure by default" },
        { icon: "Activity", label: "Live analytics" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#08080C" rx="4" />
        <circle cx="40" cy="26" r="30" fill="#C7E738" opacity="0.18" />
        <rect x="14" y="22" width="46" height="5" rx="1" fill="#fff" opacity="0.92" />
        <rect x="14" y="32" width="32" height="3" rx="1" fill="#fff" opacity="0.5" />
        <rect x="14" y="42" width="18" height="6" rx="3" fill="#C7E738" />
        <rect x="74" y="14" width="36" height="42" rx="3" fill="#fff" opacity="0.06" stroke="#fff" strokeOpacity="0.15" />
        <rect x="80" y="20" width="24" height="12" rx="2" fill="#C7E738" opacity="0.3" />
        <rect x="80" y="36" width="24" height="2.5" rx="1" fill="#fff" opacity="0.3" />
        <rect x="80" y="42" width="18" height="2.5" rx="1" fill="#fff" opacity="0.3" />
      </svg>
    ),
  },
  {
    type: "id-hero" as const,
    label: "Inside Dandy · Hero",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdHeroBlockProps => ({
      eyebrow: "Inside Dandy · 2026",
      line1: "The first",
      line2: "and only",
      line3: "<em>AI</em> dental lab.",
      lead: "Scanning, design, manufacturing, data — running as one integrated system. The first lab actually doing it.",
      cta1Text: "Tour the lab",
      cta1Url: "#",
      cta2Text: "Watch the film",
      cta2Url: "#",
      bgImage: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1920&fit=crop",
      // The Inside Dandy hero lives on a dark cinematic page, so its CTA
      // modal opens with the matching dark shell (flush with the inner
      // form card) instead of the default white frame.
      modalTheme: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <circle cx="92" cy="32" r="22" fill="#C7E738" opacity="0.18" />
        <rect x="10" y="10" width="20" height="2" rx="1" fill="#C7E738" opacity="0.7" />
        <text x="10" y="32" fontSize="11" fontWeight="400" fill="#fff" fontFamily="Georgia, serif">The first</text>
        <text x="10" y="42" fontSize="11" fontWeight="400" fill="#fff" fontFamily="Georgia, serif">and only</text>
        <text x="10" y="52" fontSize="11" fontWeight="400" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">AI</text>
        <text x="20" y="52" fontSize="11" fontWeight="400" fill="#fff" fontFamily="Georgia, serif">dental lab.</text>
        <rect x="10" y="58" width="22" height="6" rx="3" fill="#C7E738" />
        <rect x="36" y="58" width="22" height="6" rx="3" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.6" />
      </svg>
    ),
  },
  {
    type: "id-marquee" as const,
    label: "Inside Dandy · Marquee",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdMarqueeBlockProps => ({
      items: [
        "<em>AI</em> Scan Review",
        "Generative restoration design",
        "Robotic manufacturing",
        "Network analytics",
        "End to end. <em>AI</em> throughout.",
      ],
      durationSec: 40,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <line x1="0" y1="20" x2="120" y2="20" stroke="#fff" strokeOpacity="0.1" strokeWidth="0.5" />
        <line x1="0" y1="50" x2="120" y2="50" stroke="#fff" strokeOpacity="0.1" strokeWidth="0.5" />
        <text x="6" y="40" fontSize="9" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">AI</text>
        <text x="22" y="40" fontSize="9" fill="#fff" fontFamily="Georgia, serif" opacity="0.5">Scan · Design · Make · Data</text>
        <text x="6" y="40" fontSize="9" fill="#C7E738" opacity="0.7">·</text>
      </svg>
    ),
  },
  {
    type: "id-intro" as const,
    label: "Inside Dandy · Intro",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdIntroBlockProps => ({
      eyebrow: "A new category",
      statement: "The dental lab has been unchanged for a century. We rebuilt it from the scan up — with <em>AI</em> in every step.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <rect x="8" y="10" width="22" height="2" rx="1" fill="#C7E738" opacity="0.7" />
        <text x="8" y="28" fontSize="8" fill="#fff" fontFamily="Georgia, serif">The dental lab has</text>
        <text x="8" y="38" fontSize="8" fill="#fff" fontFamily="Georgia, serif">been unchanged.</text>
        <text x="8" y="48" fontSize="8" fill="#fff" fontFamily="Georgia, serif">We rebuilt it with</text>
        <text x="8" y="58" fontSize="8" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">AI</text>
        <text x="20" y="58" fontSize="8" fill="#fff" fontFamily="Georgia, serif">in every step.</text>
      </svg>
    ),
  },
  {
    type: "id-cinema-pillars" as const,
    label: "Inside Dandy · Cinema Pillars",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdCinemaPillarsBlockProps => ({
      pillars: [
        { number: "<em>01</em>", label: "Pillar 01 / Scan", headline: "Every scan, <em>reviewed</em> by AI.", body: "Real-time scan review flags margin gaps, prep angles, and tissue interference while the patient is still in the chair.", art: "scan" },
        { number: "<em>02</em>", label: "Pillar 02 / Design", headline: "Generative design, <em>master-crafted</em> finish.", body: "AI proposes restorations within seconds, our master ceramists refine them. Speed plus craft.", art: "design" },
        { number: "<em>03</em>", label: "Pillar 03 / Make", headline: "<em>Robotic</em> precision at scale.", body: "Automated milling and printing lines run 24/7. Every restoration is dimensionally checked before it ships.", art: "rail" },
        { number: "<em>04</em>", label: "Pillar 04 / Data", headline: "Every case becomes <em>knowledge</em>.", body: "Network-wide analytics turn every case into training signal — making the next case better than the last.", art: "bars" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <circle cx="22" cy="35" r="14" fill="none" stroke="#C7E738" strokeOpacity="0.6" strokeWidth="0.6" strokeDasharray="2,2" />
        <circle cx="22" cy="35" r="6" fill="#C7E738" opacity="0.3" />
        <text x="42" y="20" fontSize="6" fill="#C7E738" opacity="0.6" fontFamily="Georgia, serif">01 / SCAN</text>
        <text x="42" y="34" fontSize="9" fill="#fff" fontFamily="Georgia, serif">Every scan,</text>
        <text x="42" y="44" fontSize="9" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">reviewed</text>
        <text x="78" y="44" fontSize="9" fill="#fff" fontFamily="Georgia, serif">by AI.</text>
        <line x1="6" y1="60" x2="114" y2="60" stroke="#fff" strokeOpacity="0.08" />
      </svg>
    ),
  },
  {
    type: "id-parallax-showcase" as const,
    label: "Inside Dandy · Parallax Showcase",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdParallaxShowcaseBlockProps => ({
      eyebrow: "Inside the lab",
      headline: "Where craft meets <em>code</em>.",
      blurb: "70,000 square feet in Provo. AI runs on every workstation. Master technicians refine every output. The result feels inevitable.",
      frames: [
        { imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1600&fit=crop", label: "01 / The lab floor", headline: "<em>Robotic</em> milling, master craft.", where: "Provo, UT" },
        { imageUrl: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=900&fit=crop", label: "02 / The crown", headline: "Every <em>margin</em> within microns.", where: "QA bench" },
        { imageUrl: "https://images.unsplash.com/photo-1629909615184-74f495363b67?q=80&w=1400&fit=crop", label: "03 / The team", headline: "Master ceramists, <em>AI co-pilots</em>.", where: "Design studio" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <rect x="10" y="14" width="60" height="34" rx="3" fill="#0A4A3E" />
        <rect x="62" y="28" width="36" height="28" rx="3" fill="#003A30" />
        <rect x="22" y="44" width="48" height="20" rx="3" fill="#0A4A3E" opacity="0.8" />
        <rect x="14" y="42" width="14" height="2" rx="1" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "id-system-flow" as const,
    label: "Inside Dandy · System Flow",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdSystemFlowBlockProps => ({
      eyebrow: "SECTION 01 · THE SYSTEM",
      headline: "One connected system. <em>Powered by AI.</em>",
      metricLabel: "STATIONS",
      metricValue: "5 · <em>end to end</em>",
      activeIndex: 2,
      stations: [
        { timestamp: "00:00", label: "Scan", tag: "CAPTURE", category: "CHAIRSIDE", title: "AI <em>Scan</em>", description: "Better inputs, fewer remakes." },
        { timestamp: "00:24", label: "Design", tag: "AI STUDIO", category: "STUDIO", title: "AI <em>Design</em>", description: "Clinical consistency, every case." },
        { timestamp: "02:46", label: "Mill", tag: "ROBOTICS", category: "FLOOR", title: "Precision <em>Robotics</em>", description: "Micron precision, at scale.", activeCaseId: "CASE № D-4472 · CROWN #19" },
        { timestamp: "03:54", label: "QC", tag: "VERIFY", category: "QC LINE", title: "AI <em>QC</em>", description: "Four checkpoints, end to end." },
        { timestamp: "04:22", label: "Data", tag: "NETWORK", category: "NETWORK", title: "<em>Data</em> & Intelligence", description: "Case-level visibility, one pane." },
      ],
      footerBadge: "ONE SYSTEM",
      footerBody: "Not five products bolted together — <em>one connected line</em>, scan to ship, with AI running through every step.",
      footerMetricLabel: "MEDIAN TAT",
      footerMetricValue: "3.2 days",
      ctaText: "Tour the system",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <line x1="14" y1="35" x2="106" y2="35" stroke="#C7E738" strokeOpacity="0.35" strokeDasharray="2 2" />
        {[18, 38, 60, 82, 102].map((x, i) => (
          <circle key={i} cx={x} cy="35" r="6" fill={i === 2 ? "#C7E738" : "none"} stroke="#C7E738" strokeOpacity={i === 2 ? 1 : 0.5} strokeWidth="1" />
        ))}
        <text x="14" y="14" fontSize="6" fill="#fff" fontFamily="monospace" opacity="0.7">SECTION 01</text>
        <text x="14" y="56" fontSize="6" fill="#C7E738" fontFamily="monospace" opacity="0.7">SCAN · DESIGN · MILL</text>
      </svg>
    ),
  },
  {
    type: "id-form" as const,
    label: "Inside Dandy · Form",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdFormBlockProps => ({
      eyebrow: "GET IN TOUCH",
      headline: "Let's see if Dandy <em>fits your lab</em>.",
      subheadline: "Tell us a little about your practice — a member of our team will reach out within one business day.",
      metaItems: [
        { label: "RESPONSE TIME", value: "Under <em>1 business day</em>" },
        { label: "LOCATIONS", value: "Provo · NYC · Remote" },
      ],
      fields: [
        { name: "first-name", label: "First name", type: "text", required: true, placeholder: "Jane" },
        { name: "last-name", label: "Last name", type: "text", required: true, placeholder: "Doe" },
        { name: "email", label: "Work email", type: "email", required: true, placeholder: "jane@practice.com", fullWidth: true },
        { name: "practice", label: "Practice or organization", type: "text", placeholder: "Smile Dental", fullWidth: true },
        { name: "role", label: "Role", type: "select", placeholder: "Select your role", options: [
          { label: "Dentist", value: "dentist" },
          { label: "Office Manager", value: "office-manager" },
          { label: "DSO Leader", value: "dso-leader" },
          { label: "Other", value: "other" },
        ] },
        { name: "monthly-cases", label: "Monthly cases", type: "select", placeholder: "Estimate", options: [
          { label: "Under 25", value: "<25" },
          { label: "25 – 100", value: "25-100" },
          { label: "100 – 500", value: "100-500" },
          { label: "500+", value: "500+" },
        ] },
        { name: "message", label: "What are you trying to solve?", type: "textarea", placeholder: "A few sentences is plenty.", fullWidth: true, rows: 4 },
      ],
      submitText: "Request a conversation",
      submittingText: "Sending…",
      submitUrl: "",
      successHeadline: "Thanks — we'll be in touch.",
      successBody: "A member of our team will reach out within one business day.",
      legal: "By submitting, you agree to our <a href=\"#\">privacy policy</a>.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <text x="10" y="16" fontSize="6" fill="#C7E738" fontFamily="monospace" opacity="0.8">GET IN TOUCH</text>
        <text x="10" y="28" fontSize="8" fill="#fff" fontFamily="Georgia, serif" fontStyle="italic">Let's talk.</text>
        <rect x="64" y="10" width="46" height="50" rx="3" fill="#0A2925" stroke="#1f3a36" strokeWidth="0.5" />
        <rect x="68" y="16" width="38" height="6" rx="1" fill="#06120f" stroke="#1e2e2b" strokeWidth="0.4" />
        <rect x="68" y="26" width="38" height="6" rx="1" fill="#06120f" stroke="#1e2e2b" strokeWidth="0.4" />
        <rect x="68" y="36" width="38" height="12" rx="1" fill="#06120f" stroke="#1e2e2b" strokeWidth="0.4" />
        <rect x="68" y="52" width="22" height="5" rx="2.5" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "id-stats" as const,
    label: "Inside Dandy · Stats",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdStatsBlockProps => ({
      stats: [
        { value: "<em>4,000</em>+", label: "Practices on Dandy", description: "From solo doctors to the largest DSOs in the country." },
        { value: "<em>2.4</em>M", label: "Cases delivered", description: "Crowns, bridges, aligners, dentures — all through one workflow." },
        { value: "<em>98.6</em>%", label: "Fit rate, first try", description: "Industry average is 91%. Our AI catches issues before they become remakes." },
        { value: "<em>24</em>hr", label: "Average turnaround", description: "Same-day scan, next-day delivery. The fastest in the industry." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        {[0,1,2,3].map(i => (
          <g key={i} transform={`translate(${6 + i * 28},0)`}>
            <text x="0" y="32" fontSize="13" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">{["4K","2M","99%","24h"][i]}</text>
            <rect x="0" y="40" width="14" height="1.5" rx="0.75" fill="#fff" opacity="0.5" />
            <rect x="0" y="46" width="22" height="1.5" rx="0.75" fill="#fff" opacity="0.3" />
            <rect x="0" y="50" width="18" height="1.5" rx="0.75" fill="#fff" opacity="0.3" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "id-invitation" as const,
    label: "Inside Dandy · Invitation",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdInvitationBlockProps => ({
      eyebrow: "The invitation",
      headline: "Come see <em>the future</em> of the dental lab.",
      blurb: "Twice a year we open our Provo lab to a small group of dentists and DSO leaders. Two days, full access, no script.",
      cta1Text: "Request an invitation",
      cta1Url: "#",
      cta2Text: "Watch the film",
      cta2Url: "#",
      meta: [
        { heading: "Q1", text: "Feb 12–13" },
        { heading: "Q2", text: "May 7–8" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <circle cx="60" cy="35" r="32" fill="#C7E738" opacity="0.08" />
        <text x="60" y="28" fontSize="10" fill="#fff" fontFamily="Georgia, serif" textAnchor="middle">Come see</text>
        <text x="60" y="40" fontSize="10" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif" textAnchor="middle">the future</text>
        <rect x="36" y="48" width="22" height="6" rx="3" fill="#C7E738" />
        <rect x="62" y="48" width="22" height="6" rx="3" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.6" />
      </svg>
    ),
  },
  {
    type: "id-grid" as const,
    label: "Inside Dandy · Numbered Grid",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdGridBlockProps => ({
      eyebrow: "Step inside",
      headline: "Four ways to step <em>inside</em>.",
      subheading: "Choose the format that fits — every path is hosted by the people who run the lab.",
      cards: [
        { eyebrow: "IN PERSON · PROVO", headline: "Lab tour, <em>two days</em>.", body: "Twice a year we open our Provo facility. Walk the floor with our master technicians and AI engineers, no script.", ctaText: "Request invitation", ctaUrl: "#" },
        { eyebrow: "VIRTUAL · LIVE", headline: "Quarterly <em>open house</em>.", body: "A 60-minute live walkthrough with Q&A. See the AI tools in action and ask the team anything.", ctaText: "Save a seat", ctaUrl: "#" },
        { eyebrow: "ON DEMAND", headline: "Watch the <em>film</em>.", body: "A cinematic tour of the lab — every step from scan to ship, narrated by the people behind the work.", ctaText: "Watch now", ctaUrl: "#" },
        { eyebrow: "1:1 · PRIVATE", headline: "Bring your <em>team</em>.", body: "DSO leadership and clinical groups can request a private session built around your specific workflow.", ctaText: "Book a private tour", ctaUrl: "#" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <text x="60" y="14" fontSize="6" fill="#C7E738" opacity="0.8" textAnchor="middle" fontFamily="Georgia, serif" letterSpacing="1">STEP INSIDE</text>
        <text x="60" y="24" fontSize="7" fill="#fff" fontFamily="Georgia, serif" textAnchor="middle">Four ways to step</text>
        <text x="60" y="32" fontSize="7" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif" textAnchor="middle">inside.</text>
        <line x1="14" y1="38" x2="106" y2="38" stroke="#fff" strokeOpacity="0.18" />
        <line x1="60" y1="38" x2="60" y2="64" stroke="#fff" strokeOpacity="0.18" />
        <line x1="14" y1="51" x2="106" y2="51" stroke="#fff" strokeOpacity="0.18" />
        <line x1="14" y1="64" x2="106" y2="64" stroke="#fff" strokeOpacity="0.18" />
        <text x="18" y="46" fontSize="4" fill="#C7E738" fontFamily="Georgia, serif">01</text>
        <text x="64" y="46" fontSize="4" fill="#C7E738" fontFamily="Georgia, serif">02</text>
        <text x="18" y="59" fontSize="4" fill="#C7E738" fontFamily="Georgia, serif">03</text>
        <text x="64" y="59" fontSize="4" fill="#C7E738" fontFamily="Georgia, serif">04</text>
      </svg>
    ),
  },
  {
    type: "id-spotlight" as const,
    label: "Inside Dandy · Spotlight (Video Feature)",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdSpotlightBlockProps => ({
      eyebrow: "",
      headline: "AI Crown Prep <em>Analysis</em>",
      body: "Detect hidden issues that lead to remakes and long-chairtime adjustments — in mere seconds.",
      videoSrc: "/videos/scan-overhead.mp4",
      posterUrl: "",
      videoPosition: "center",
      cardTitle: "AI Scan Review",
      cardSubtitle: "Results",
      results: [
        { tone: "alert", title: "Prep undercut", body: "Review scan flag and refine prep if needed", actionText: "Review in Undercut tool", actionUrl: "" },
      ],
      steps: [
        { label: "Alerts" },
        { label: "Guidance" },
        { label: "Confirmation" },
      ],
      activeStep: 0,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001814" rx="4" />
        <text x="6" y="22" fontSize="7" fill="#fff" fontFamily="Georgia, serif">AI Crown Prep</text>
        <text x="6" y="32" fontSize="7" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">Analysis</text>
        <rect x="44" y="10" width="60" height="40" rx="3" fill="#0A4A3E" />
        <ellipse cx="74" cy="30" rx="18" ry="14" fill="none" stroke="#C7E738" strokeOpacity="0.55" strokeWidth="0.6" />
        <ellipse cx="74" cy="30" rx="10" ry="8" fill="#C7E738" opacity="0.18" />
        <rect x="58" y="38" width="34" height="14" rx="2" fill="#0F1C1A" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
        <circle cx="62" cy="44" r="1.4" fill="#E5484D" />
        <rect x="66" y="42" width="22" height="1.6" rx="0.8" fill="#fff" opacity="0.7" />
        <rect x="66" y="46" width="18" height="1.2" rx="0.6" fill="#fff" opacity="0.4" />
        <text x="110" y="20" fontSize="3.6" fill="#fff" fontFamily="ui-monospace, monospace" textAnchor="end">ALERTS ●</text>
        <text x="110" y="30" fontSize="3.6" fill="rgba(255,255,255,0.35)" fontFamily="ui-monospace, monospace" textAnchor="end">GUIDANCE ○</text>
        <text x="110" y="40" fontSize="3.6" fill="rgba(255,255,255,0.35)" fontFamily="ui-monospace, monospace" textAnchor="end">CONFIRMATION ○</text>
      </svg>
    ),
  },
  {
    type: "id-reservation-pass" as const,
    label: "Inside Dandy · Reservation Pass (Final CTA)",
    category: "Showcase" as BlockCategory,
    defaultProps: (): IdReservationPassBlockProps => ({
      ordinal: "№ 001",
      status: "RESERVATION OPEN",
      eyebrow: "LIMITED ENGAGEMENT · DYKEMA · JULY 2026",
      headline: "Reserve your <em>front-row</em> seat.",
      body: "A 6–8 minute spatial experience on Apple Vision Pro. One real case, end to end — scan intake, AI design, robotic milling, QC, shipping. Twenty-four seats only.",
      seatsRemainingText: "12 of 24 seats remaining",
      passLabel: "DANDY · INSIDE PASS",
      passSerial: "№ INSIDE-2026-0418",
      meta: [
        { label: "DATE", value: "July 14 – 16, 2026" },
        { label: "LOCATION", value: "Dykema Lounge · Booth 412" },
        { label: "DURATION", value: "6 – 8 minutes" },
      ],
      primaryCtaText: "Reserve your seat",
      primaryCtaUrl: "#",
      primaryCtaAction: "url",
      chilipiperUrl: "",
      secondaryCtaText: "Press inquiry",
      secondaryCtaUrl: "mailto:press@meetdandy.com",
      backgroundImageUrl: "",
      footerNotes: ["PRESS", "INVESTORS", "BOOTH 412"],
      accentColor: "#C7E738",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <radialGradient id="rp-bg" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="#0A4A3E" />
            <stop offset="100%" stopColor="#00120F" />
          </radialGradient>
        </defs>
        <rect width="120" height="70" fill="url(#rp-bg)" rx="4" />
        <circle cx="20" cy="14" r="14" fill="#C7E738" opacity="0.18" />
        <circle cx="100" cy="58" r="16" fill="#50C8A0" opacity="0.18" />
        {/* corner HUD */}
        <path d="M6 6 H14 M6 6 V14" stroke="#C7E738" strokeWidth="0.6" fill="none" />
        <path d="M114 6 H106 M114 6 V14" stroke="#C7E738" strokeWidth="0.6" fill="none" />
        <path d="M6 64 H14 M6 64 V56" stroke="#C7E738" strokeWidth="0.6" fill="none" />
        <path d="M114 64 H106 M114 64 V56" stroke="#C7E738" strokeWidth="0.6" fill="none" />
        {/* ordinal + status */}
        <text x="10" y="13" fontSize="3.2" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">№ 001</text>
        <circle cx="100" cy="11" r="1" fill="#C7E738" />
        <text x="113" y="13" fontSize="3" fill="rgba(255,255,255,0.7)" textAnchor="end" fontFamily="ui-monospace, monospace">OPEN</text>
        {/* headline */}
        <text x="60" y="28" fontSize="6.6" fill="#fff" fontFamily="Georgia, serif" textAnchor="middle">Reserve your</text>
        <text x="60" y="37" fontSize="6.6" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif" textAnchor="middle">front-row seat.</text>
        {/* pass card */}
        <rect x="22" y="42" width="76" height="22" rx="3" fill="rgba(8,30,24,0.85)" stroke="#C7E738" strokeOpacity="0.5" strokeWidth="0.5" />
        <text x="26" y="47" fontSize="2.2" fill="#C7E738" fontFamily="ui-monospace, monospace">DANDY · INSIDE PASS</text>
        <text x="94" y="47" fontSize="2.2" fill="rgba(255,255,255,0.4)" textAnchor="end" fontFamily="ui-monospace, monospace">№ 0418</text>
        {/* perforation */}
        <circle cx="22" cy="52" r="1.4" fill="#00120F" stroke="#C7E738" strokeOpacity="0.4" strokeWidth="0.3" />
        <circle cx="98" cy="52" r="1.4" fill="#00120F" stroke="#C7E738" strokeOpacity="0.4" strokeWidth="0.3" />
        <line x1="25" y1="52" x2="95" y2="52" stroke="#C7E738" strokeOpacity="0.5" strokeDasharray="1 1" strokeWidth="0.4" />
        {/* meta */}
        <text x="28" y="58" fontSize="2" fill="rgba(255,255,255,0.45)" fontFamily="ui-monospace, monospace">DATE</text>
        <text x="28" y="62" fontSize="2.6" fill="#fff" fontFamily="Georgia, serif">Jul 14–16</text>
        <text x="54" y="58" fontSize="2" fill="rgba(255,255,255,0.45)" fontFamily="ui-monospace, monospace">LOC</text>
        <text x="54" y="62" fontSize="2.6" fill="#fff" fontFamily="Georgia, serif">Dykema</text>
        <text x="78" y="58" fontSize="2" fill="rgba(255,255,255,0.45)" fontFamily="ui-monospace, monospace">DUR</text>
        <text x="78" y="62" fontSize="2.6" fill="#fff" fontFamily="Georgia, serif">6–8 min</text>
      </svg>
    ),
  },
  {
    type: "bold-statement",
    label: "Bold Statement",
    category: "Content",
    defaultProps: () => ({
      eyebrow: "MANIFESTO",
      statement: "We don't make <em>tools</em>. We make <em>momentum</em>.",
      footnote:
        "Every product decision starts with one question: does this make our customers move faster today than yesterday?",
      ctaText: "Read the manifesto",
      ctaUrl: "#",
      bgColor: "#0A0A0A",
      textColor: "#FFFFFF",
      accentColor: "#C7E738",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0A0A0A" rx="4" />
        <rect x="10" y="10" width="3" height="2" fill="#C7E738" />
        <rect x="16" y="9" width="20" height="3" rx="0.5" fill="#C7E738" opacity="0.9" />
        <text x="10" y="34" fontSize="13" fontWeight="900" fill="#FFFFFF" fontFamily="sans-serif" letterSpacing="-0.5">BOLD</text>
        <text x="46" y="34" fontSize="13" fontWeight="900" fontStyle="italic" fill="#C7E738" fontFamily="Georgia, serif">moves</text>
        <text x="10" y="48" fontSize="13" fontWeight="900" fill="#FFFFFF" fontFamily="sans-serif" letterSpacing="-0.5">win.</text>
        <rect x="10" y="58" width="60" height="2" rx="1" fill="#FFFFFF" opacity="0.4" />
        <rect x="86" y="56" width="24" height="7" rx="3.5" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "bento-showcase",
    label: "Bento Showcase",
    category: "Showcase",
    defaultProps: () => ({
      eyebrow: "WHAT YOU GET",
      headline: "A toolkit, not a tool.",
      subheadline:
        "A grid of mixed-content tiles — images, stats, quotes, and features — for showing range without repetition.",
      tiles: [
        {
          kind: "stat",
          size: "md",
          primary: "12×",
          secondary: "Faster cycle time",
          tertiary: "Across 4,000+ teams",
          bgColor: "#0A0A0A",
          textColor: "#FFFFFF",
        },
        {
          kind: "image",
          size: "lg",
          primary:
            "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=900&h=600&fit=crop",
          secondary: "Designed for the way modern teams actually work",
          tertiary: "Workflow",
        },
        {
          kind: "feature",
          size: "md",
          primary: "Automations that run themselves",
          secondary: "Trigger any action from any event in 200+ apps.",
          icon: "Zap",
          bgColor: "#FFFFFF",
        },
        {
          kind: "feature",
          size: "md",
          primary: "Real numbers, not vanity dashboards",
          secondary: "Live metrics on the things that move the needle.",
          icon: "BarChart2",
          bgColor: "#FFFFFF",
        },
        {
          kind: "quote",
          size: "md",
          primary:
            "We replaced six tools in our first quarter and got our nights back.",
          secondary: "Maya Patel",
          tertiary: "VP Operations · Aperture",
          bgColor: "#FFFFFF",
        },
      ],
      bgColor: "#F4F4F5",
      textColor: "#0A0A0A",
      accentColor: "#3B82F6",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F4F4F5" rx="4" />
        <rect x="6" y="6" width="34" height="28" rx="3" fill="#0A0A0A" />
        <text x="10" y="24" fontSize="11" fontWeight="bold" fill="#3B82F6">12×</text>
        <rect x="42" y="6" width="50" height="28" rx="3" fill="#3B82F6" opacity="0.7" />
        <rect x="94" y="6" width="20" height="28" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="6" y="36" width="22" height="28" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="30" y="36" width="40" height="28" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="72" y="36" width="42" height="28" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
      </svg>
    ),
  },
  {
    type: "gradient-pricing",
    label: "Gradient Pricing",
    category: "Showcase",
    defaultProps: () => ({
      eyebrow: "PRICING",
      headline: "Pricing built for momentum.",
      subheadline:
        "Start free. Scale when you're ready. No surprises, no annual lock-in.",
      tiers: [
        {
          name: "Starter",
          price: "$0",
          period: "/mo",
          description: "Everything you need to ship your first project.",
          features: [
            "Up to 3 projects",
            "Community support",
            "Core integrations",
            "1 GB storage",
          ],
          ctaText: "Start free",
          ctaUrl: "#",
        },
        {
          name: "Growth",
          price: "$29",
          period: "/seat/mo",
          description: "For teams shipping every week.",
          features: [
            "Unlimited projects",
            "Priority email support",
            "All 200+ integrations",
            "100 GB storage",
            "Advanced analytics",
            "SSO & audit log",
          ],
          ctaText: "Start 14-day trial",
          ctaUrl: "#",
          featured: true,
          badge: "Most popular",
        },
        {
          name: "Scale",
          price: "Custom",
          description: "For organizations with custom security and SLAs.",
          features: [
            "Everything in Growth",
            "Dedicated success manager",
            "Custom contracts & DPA",
            "99.99% uptime SLA",
            "On-prem deploy options",
          ],
          ctaText: "Talk to sales",
          ctaUrl: "#",
        },
      ],
      gradientFrom: "#0B0B1A",
      gradientTo: "#1F1147",
      accentColor: "#A78BFA",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="gp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1F1147" />
            <stop offset="100%" stopColor="#0B0B1A" />
          </linearGradient>
        </defs>
        <rect width="120" height="70" fill="url(#gp-grad)" rx="4" />
        <rect x="8" y="14" width="32" height="46" rx="3" fill="#FFFFFF" opacity="0.06" stroke="#FFFFFF" strokeOpacity="0.12" />
        <rect x="44" y="9" width="32" height="56" rx="3" fill="#FFFFFF" opacity="0.10" stroke="#A78BFA" strokeOpacity="0.9" />
        <rect x="80" y="14" width="32" height="46" rx="3" fill="#FFFFFF" opacity="0.06" stroke="#FFFFFF" strokeOpacity="0.12" />
        <text x="60" y="32" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#FFFFFF">$29</text>
        <rect x="50" y="48" width="20" height="6" rx="3" fill="#A78BFA" />
        <rect x="14" y="48" width="20" height="6" rx="3" fill="#FFFFFF" opacity="0.18" />
        <rect x="86" y="48" width="20" height="6" rx="3" fill="#FFFFFF" opacity="0.18" />
      </svg>
    ),
  },
  {
    type: "editorial-carousel",
    label: "Editorial Carousel",
    category: "Showcase",
    defaultProps: (): EditorialCarouselBlockProps => ({
      eyebrow: "MOMENTS",
      headline: "An editorial reel of the work.",
      subheadline:
        "Drag, autoplay, or click — captions fade in on hover, with quiet corner accents and a single hairline underline.",
      slides: [
        {
          src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&h=900&fit=crop",
          alt: "Mountain ridge at dusk",
          caption: "Dusk over the ridge",
        },
        {
          src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&h=900&fit=crop",
          alt: "Pine forest at sunrise",
          caption: "First light, day two",
        },
        {
          src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1600&h=900&fit=crop",
          alt: "Snow-capped peak",
          caption: "Summit approach",
        },
        {
          src: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?q=80&w=1600&h=900&fit=crop",
          alt: "Valley lake reflection",
          caption: "Stillness, mid-afternoon",
        },
      ],
      // Colors and fonts intentionally omitted so new carousels inherit the
      // tenant's brand tokens (primary / accent / text / border + display /
      // body fonts). Authors can override per-block via the property panel.
      aspect: "16/9",
      slideWidthPct: 60,
      autoplay: true,
      autoplayInterval: 5000,
      rounded: false,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0c0f12" rx="4" />
        <rect x="6" y="14" width="22" height="42" rx="1" fill="#1a1f24" />
        <rect x="32" y="10" width="56" height="50" rx="1" fill="#3a4148" />
        <rect x="32" y="10" width="56" height="50" rx="1" fill="url(#ec-scrim)" opacity="0.6" />
        <defs>
          <linearGradient id="ec-scrim" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0c0f12" />
            <stop offset="60%" stopColor="#0c0f12" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="92" y="14" width="22" height="42" rx="1" fill="#1a1f24" />
        {/* corner accents on featured slide */}
        <path d="M82 14 H86 V18" fill="none" stroke="#b59a6e" strokeWidth="0.7" />
        <path d="M38 56 H34 V52" fill="none" stroke="#b59a6e" strokeWidth="0.7" />
        {/* caption underline */}
        <rect x="36" y="50" width="18" height="0.8" fill="#b59a6e" />
        {/* dots */}
        <circle cx="56" cy="64" r="1.4" fill="#b59a6e" />
        <circle cx="60" cy="64" r="1" fill="#3a4148" />
        <circle cx="64" cy="64" r="1" fill="#3a4148" />
      </svg>
    ),
  },
  // ── Container blocks (Phase 2 — nested children). They render a single
  //    drop slot in the builder so users can nest other blocks inside.
  {
    type: "section",
    label: "Section",
    category: "Grid Pieces",
    defaultProps: () => ({
      maxWidth: "default" as const,
      paddingY: "default" as const,
      align: "stretch" as const,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F4F4F5" rx="4" />
        <rect x="10" y="10" width="100" height="50" rx="3" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <text x="60" y="40" textAnchor="middle" fontSize="10" fill="#3B82F6" fontWeight="600">SECTION</text>
      </svg>
    ),
  },
  {
    type: "columns",
    label: "Columns",
    category: "Grid Pieces",
    defaultProps: () => ({ columns: 2 as const, gap: 1.5, align: "stretch" as const }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F4F4F5" rx="4" />
        <rect x="10" y="10" width="48" height="50" rx="3" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="62" y="10" width="48" height="50" rx="3" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
      </svg>
    ),
  },
  {
    type: "grid",
    label: "Grid",
    category: "Grid Pieces",
    defaultProps: () => ({ columns: 3, mobileColumns: 1, gap: 1 }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F4F4F5" rx="4" />
        <rect x="10" y="10" width="30" height="22" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="45" y="10" width="30" height="22" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="80" y="10" width="30" height="22" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="10" y="38" width="30" height="22" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="45" y="38" width="30" height="22" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="80" y="38" width="30" height="22" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
      </svg>
    ),
  },
  {
    type: "stack",
    label: "Stack",
    category: "Grid Pieces",
    defaultProps: () => ({ gap: 1, align: "stretch" as const }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F4F4F5" rx="4" />
        <rect x="20" y="10" width="80" height="14" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="20" y="28" width="80" height="14" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
        <rect x="20" y="46" width="80" height="14" rx="2" fill="none" stroke="#3B82F6" strokeDasharray="3 2" />
      </svg>
    ),
  },
  /* ── Grid pieces (task #120) ─────────────────────────────────────────── */
  {
    type: "grid-image",
    label: "Image",
    category: "Grid Pieces",
    defaultProps: (): GridImageBlockProps => ({ imageUrl: "", alt: "", rounded: true }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f1f5f9" rx="4" />
        <rect x="14" y="12" width="92" height="46" rx="4" fill="#cbd5e1" />
        <circle cx="36" cy="32" r="6" fill="#94a3b8" />
        <path d="M14 50 L48 30 L78 46 L106 28 L106 58 L14 58 Z" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    type: "grid-headline-sub",
    label: "Headline + Subheadline",
    category: "Grid Pieces",
    defaultProps: (): GridHeadlineSubBlockProps => ({ headline: "Your headline here", subheadline: "Supporting line of copy", align: "left" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="12" y="22" width="80" height="8" rx="2" fill="#003A30" />
        <rect x="12" y="36" width="60" height="4" rx="2" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    type: "grid-paragraph-bullets",
    label: "Paragraph + Bullets",
    category: "Grid Pieces",
    defaultProps: (): GridParagraphBulletsBlockProps => ({
      paragraph: "Short intro paragraph that frames the bullets below.",
      bullets: ["First key point", "Second key point", "Third key point"],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="10" width="100" height="3" rx="1" fill="#94a3b8" />
        <rect x="10" y="16" width="80" height="3" rx="1" fill="#94a3b8" opacity="0.6" />
        {[28, 40, 52].map(y => (
          <g key={y}>
            <circle cx="14" cy={y + 2} r="2" fill="#C7E738" />
            <rect x="20" y={y} width="80" height="4" rx="1" fill="#cbd5e1" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "grid-headline-paragraph",
    label: "Headline + Paragraph",
    category: "Grid Pieces",
    defaultProps: (): GridHeadlineParagraphBlockProps => ({ headline: "A bold headline", paragraph: "Two-to-three sentences of supporting body copy that explains the idea in more detail.", align: "left" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="12" y="14" width="80" height="8" rx="2" fill="#003A30" />
        <rect x="12" y="30" width="96" height="3" rx="1" fill="#94a3b8" />
        <rect x="12" y="38" width="90" height="3" rx="1" fill="#94a3b8" opacity="0.7" />
        <rect x="12" y="46" width="70" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "grid-icon-feature",
    label: "Icon + Headline + Paragraph",
    category: "Grid Pieces",
    defaultProps: (): GridIconFeatureBlockProps => ({ icon: "✨", headline: "Feature name", paragraph: "Quick explanation of why this matters." }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="12" y="12" width="20" height="20" rx="4" fill="#C7E738" />
        <rect x="12" y="38" width="70" height="6" rx="2" fill="#003A30" />
        <rect x="12" y="50" width="90" height="3" rx="1" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    type: "grid-stat",
    label: "Stat Callout",
    category: "Grid Pieces",
    defaultProps: (): GridStatBlockProps => ({ value: "92%", label: "of customers see results", caption: "" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <text x="60" y="36" fontSize="22" fontWeight="700" textAnchor="middle" fill="#003A30">92%</text>
        <rect x="22" y="46" width="76" height="4" rx="1" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    type: "grid-quote",
    label: "Quote",
    category: "Grid Pieces",
    defaultProps: (): GridQuoteBlockProps => ({ quote: "This product changed how we work.", attribution: "Jane Doe", role: "VP, Acme" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <text x="14" y="28" fontSize="22" fill="#C7E738" fontWeight="700">“</text>
        <rect x="26" y="18" width="80" height="4" rx="1" fill="#94a3b8" />
        <rect x="26" y="26" width="70" height="4" rx="1" fill="#94a3b8" />
        <rect x="26" y="42" width="40" height="3" rx="1" fill="#003A30" />
      </svg>
    ),
  },
  {
    type: "grid-cta-tile",
    label: "CTA Tile",
    category: "Grid Pieces",
    defaultProps: (): GridCtaTileBlockProps => ({ headline: "Ready to start?", body: "Book a 15-minute walkthrough.", ctaText: "Get a demo", ctaUrl: "#", bgColor: "#003A30", textColor: "#ffffff" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="12" y="14" width="70" height="6" rx="2" fill="#ffffff" />
        <rect x="12" y="26" width="80" height="4" rx="1" fill="#ffffff" opacity="0.6" />
        <rect x="12" y="44" width="40" height="14" rx="7" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "grid-logo",
    label: "Logo Tile",
    category: "Grid Pieces",
    defaultProps: (): GridLogoBlockProps => ({ logoUrl: "", alt: "Logo" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="30" y="22" width="60" height="26" rx="4" fill="#cbd5e1" />
        <text x="60" y="40" textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">LOGO</text>
      </svg>
    ),
  },
  {
    type: "grid-video",
    label: "Video Tile",
    category: "Grid Pieces",
    defaultProps: (): GridVideoBlockProps => ({ videoUrl: "", posterUrl: "", caption: "" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0f172a" rx="4" />
        <polygon points="52,24 52,46 74,35" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "menu-section",
    label: "Menu Section",
    category: "Content",
    defaultProps: (): MenuSectionBlockProps => ({
      eyebrow: "Tasting menu",
      headline: "Menu",
      subheadline: "Sourced daily from local farms and markets.",
      bgColor: "#FAF7F2",
      textColor: "#1A1A1A",
      accentColor: "#8B0000",
      footnote: "Please inform your server of any allergies or dietary restrictions.",
      courses: [
        {
          title: "Starters",
          description: "Small plates to share",
          dishes: [
            { name: "Burrata", description: "Heirloom tomato, basil oil, sourdough", price: "$16", tags: ["V"] },
            { name: "Tuna Crudo", description: "Yuzu, avocado, crispy shallot", price: "$22", tags: ["GF"] },
          ],
        },
        {
          title: "Mains",
          dishes: [
            { name: "Wagyu Strip", description: "48-day dry-aged, bone marrow butter", price: "$68" },
            { name: "Roasted Halibut", description: "Brown butter, charred lemon, capers", price: "$42", tags: ["GF"] },
            { name: "Wild Mushroom Risotto", description: "Aged parmesan, truffle oil", price: "$32", tags: ["V"] },
          ],
        },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAF7F2" rx="4" />
        <rect x="20" y="14" width="40" height="4" rx="1" fill="#8B0000" />
        <line x1="20" y1="26" x2="100" y2="26" stroke="#1A1A1A" strokeOpacity="0.2" />
        <rect x="20" y="32" width="50" height="3" rx="1" fill="#1A1A1A" opacity="0.7" />
        <rect x="92" y="32" width="8" height="3" rx="1" fill="#8B0000" />
        <rect x="20" y="42" width="50" height="3" rx="1" fill="#1A1A1A" opacity="0.7" />
        <rect x="92" y="42" width="8" height="3" rx="1" fill="#8B0000" />
        <rect x="20" y="52" width="50" height="3" rx="1" fill="#1A1A1A" opacity="0.7" />
        <rect x="92" y="52" width="8" height="3" rx="1" fill="#8B0000" />
      </svg>
    ),
  },
  {
    type: "hours-location",
    label: "Hours & Location",
    category: "Content",
    defaultProps: (): HoursLocationBlockProps => ({
      eyebrow: "Visit",
      headline: "Hours & Location",
      subheadline: "We can't wait to host you.",
      bgColor: "#0F0F10",
      textColor: "#F5F2EC",
      accentColor: "#C7A664",
      hours: [
        { day: "Monday", hours: "Closed" },
        { day: "Tuesday", hours: "5:00 PM – 10:00 PM" },
        { day: "Wednesday", hours: "5:00 PM – 10:00 PM" },
        { day: "Thursday", hours: "5:00 PM – 10:00 PM", highlight: true },
        { day: "Friday", hours: "5:00 PM – 11:00 PM" },
        { day: "Saturday", hours: "5:00 PM – 11:00 PM" },
        { day: "Sunday", hours: "5:00 PM – 9:00 PM" },
      ],
      businessName: "House of Daria",
      addressLine1: "248 Mulberry Street",
      addressLine2: "New York, NY 10012",
      phone: "(212) 555-0142",
      email: "reservations@houseofdaria.com",
      ctaText: "Get directions",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0F0F10" rx="4" />
        <rect x="14" y="16" width="42" height="38" rx="3" fill="#F5F2EC" opacity="0.08" />
        <rect x="20" y="22" width="20" height="3" rx="1" fill="#C7A664" />
        <rect x="20" y="30" width="30" height="2" rx="1" fill="#F5F2EC" opacity="0.6" />
        <rect x="20" y="36" width="30" height="2" rx="1" fill="#F5F2EC" opacity="0.6" />
        <rect x="20" y="42" width="30" height="2" rx="1" fill="#C7A664" />
        <rect x="64" y="16" width="42" height="38" rx="3" fill="#F5F2EC" opacity="0.08" />
        <rect x="70" y="22" width="20" height="3" rx="1" fill="#C7A664" />
        <rect x="70" y="30" width="30" height="2" rx="1" fill="#F5F2EC" opacity="0.6" />
        <rect x="70" y="36" width="24" height="2" rx="1" fill="#F5F2EC" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "before-after-gallery",
    label: "Before / After Gallery",
    category: "Showcase",
    defaultProps: (): BeforeAfterGalleryBlockProps => ({
      eyebrow: "Real projects",
      headline: "The transformation",
      subheadline: "Honest before and after photos from recent work.",
      bgColor: "#FFFFFF",
      textColor: "#0B0B0C",
      accentColor: "#0B6B3A",
      beforeLabel: "Before",
      afterLabel: "After",
      pairs: [
        { beforeSrc: "", beforeAlt: "Project 1 before", afterSrc: "", afterAlt: "Project 1 after", caption: "Kitchen renovation, completed in 4 weeks." },
        { beforeSrc: "", beforeAlt: "Project 2 before", afterSrc: "", afterAlt: "Project 2 after", caption: "Front yard refresh." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="14" width="42" height="42" rx="3" fill="#94A3B8" />
        <rect x="64" y="14" width="42" height="42" rx="3" fill="#0B6B3A" />
        <rect x="18" y="18" width="14" height="4" rx="1" fill="#0B0B0C" opacity="0.7" />
        <rect x="68" y="18" width="14" height="4" rx="1" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    type: "cta-centered-minimal",
    label: "CTA — Centered Minimal",
    category: "CTA",
    defaultProps: (): CtaCenteredMinimalBlockProps => ({
      eyebrow: "Ready to start?",
      heading: "Build your next great idea.",
      subheading: "Join thousands of developers building scalable, high-performance applications with our tools.",
      ctaPrimaryLabel: "Start building for free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Contact sales",
      ctaSecondaryUrl: "#",
      bgColor: "#FFFFFF",
      surfaceColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F1F5F9" rx="4" />
        <rect x="12" y="10" width="96" height="50" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
        <rect x="44" y="18" width="32" height="3" rx="1.5" fill="#4f46e5" />
        <rect x="32" y="26" width="56" height="6" rx="2" fill="#0F172A" />
        <rect x="40" y="37" width="40" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="36" y="46" width="28" height="9" rx="4.5" fill="#4f46e5" />
        <rect x="68" y="46" width="20" height="9" rx="4.5" fill="none" stroke="#CBD5E1" />
      </svg>
    ),
  },
  {
    type: "centered-logo-nav",
    label: "Navbar — Centered Logo",
    category: "Layout",
    defaultProps: (): CenteredLogoNavBlockProps => ({
      logoText: "",
      leftLinks: [
        { label: "Product", url: "#" },
        { label: "Solutions", url: "#" },
      ],
      rightLinks: [
        { label: "Pricing", url: "#" },
        { label: "About", url: "#" },
      ],
      ctaLabel: "Get started",
      ctaAction: "url",
      ctaUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="30" width="14" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="28" y="30" width="14" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="52" y="27" width="16" height="9" rx="2" fill="#0F172A" />
        <rect x="78" y="30" width="12" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="96" y="26" width="16" height="10" rx="5" fill="#4f46e5" />
      </svg>
    ),
  },
  {
    type: "mega-menu-nav",
    label: "Navbar — Mega Menu",
    category: "Layout",
    defaultProps: (): MegaMenuNavBlockProps => ({
      logoText: "",
      links: [
        { label: "Solutions", url: "#" },
        { label: "Pricing", url: "#" },
      ],
      menuLabel: "Products",
      menuGroups: [
        { title: "Platform", links: [{ label: "Overview", url: "#" }, { label: "Integrations", url: "#" }] },
        { title: "Use cases", links: [{ label: "Marketing", url: "#" }, { label: "Sales", url: "#" }] },
        { title: "Resources", links: [{ label: "Docs", url: "#" }, { label: "Guides", url: "#" }] },
      ],
      featuredImageUrl: "",
      featuredImageAlt: "",
      featuredTitle: "What's new",
      featuredText: "See the latest product updates and releases.",
      ctaLabel: "Get started",
      ctaAction: "url",
      ctaUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="12" width="16" height="9" rx="2" fill="#0F172A" />
        <rect x="34" y="14" width="12" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="52" y="14" width="12" height="3" rx="1.5" fill="#4f46e5" />
        <rect x="96" y="11" width="16" height="10" rx="5" fill="#4f46e5" />
        <rect x="10" y="28" width="100" height="34" rx="4" fill="#F8FAFC" stroke="#E2E8F0" />
        <rect x="18" y="34" width="18" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="48" y="34" width="18" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="78" y="34" width="24" height="20" rx="3" fill="#CBD5E1" />
      </svg>
    ),
  },
  {
    type: "minimal-nav",
    label: "Navbar — Minimal",
    category: "Layout",
    defaultProps: (): MinimalNavBlockProps => ({
      logoText: "",
      ctaLabel: "Get started",
      ctaAction: "url",
      ctaUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="12" y="30" width="20" height="9" rx="2" fill="#0F172A" />
        <rect x="88" y="29" width="20" height="11" rx="5.5" fill="#4f46e5" />
      </svg>
    ),
  },
  {
    type: "transparent-overlay-nav",
    label: "Navbar — Transparent Overlay",
    category: "Layout",
    defaultProps: (): TransparentOverlayNavBlockProps => ({
      logoText: "",
      links: [
        { label: "Features", url: "#" },
        { label: "Pricing", url: "#" },
        { label: "Company", url: "#" },
      ],
      announcementText: "",
      announcementUrl: "#",
      ctaLabel: "Get started",
      ctaAction: "url",
      ctaUrl: "#",
      scrolledBgColor: "#0F172A",
      overlayTextColor: "#FFFFFF",
      textColor: "#FFFFFF",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0F172A" rx="4" />
        <rect x="12" y="14" width="18" height="8" rx="2" fill="#FFFFFF" />
        <rect x="40" y="16" width="12" height="3" rx="1.5" fill="#CBD5E1" />
        <rect x="58" y="16" width="12" height="3" rx="1.5" fill="#CBD5E1" />
        <rect x="92" y="13" width="18" height="10" rx="5" fill="#4f46e5" />
        <rect x="0" y="34" width="120" height="36" fill="#1E293B" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "cta-split-image",
    label: "CTA — Split Image",
    category: "CTA",
    defaultProps: (): CtaSplitImageBlockProps => ({
      eyebrow: "Unlock potential",
      heading: "Everything you need to launch faster",
      subheading: "Stop building the same components over and over. Get access to a complete library of production-ready UI blocks.",
      imageUrl: "",
      imageAlt: "",
      ctaPrimaryLabel: "Get started today",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "View documentation",
      ctaSecondaryUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="14" width="46" height="42" rx="6" fill="#CBD5E1" />
        <path d="M22 44 l8 -10 l6 7 l5 -5 l9 13 z" fill="#94A3B8" />
        <circle cx="24" cy="26" r="4" fill="#E2E8F0" />
        <rect x="64" y="16" width="24" height="3" rx="1.5" fill="#4f46e5" />
        <rect x="64" y="24" width="46" height="6" rx="2" fill="#0F172A" />
        <rect x="64" y="34" width="40" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="64" y="40" width="34" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="64" y="49" width="26" height="9" rx="4.5" fill="#4f46e5" />
        <rect x="94" y="49" width="18" height="9" rx="4.5" fill="none" stroke="#CBD5E1" />
      </svg>
    ),
  },
  {
    type: "cta-stat-backed",
    label: "CTA — Stat Backed",
    category: "CTA",
    defaultProps: (): CtaStatBackedBlockProps => ({
      heading: "Join the industry leaders",
      subheading: "Our platform handles billions of requests daily for the world's most demanding teams. See what we can do for yours.",
      stats: [
        { value: "99.99%", label: "Uptime SLA" },
        { value: "10x", label: "Faster deployments" },
        { value: "24/7", label: "Expert support" },
      ],
      ctaPrimaryLabel: "Get a demo",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
      bgColor: "#FFFFFF",
      surfaceColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="18" width="40" height="6" rx="2" fill="#0F172A" />
        <rect x="10" y="29" width="46" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="10" y="35" width="38" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="10" y="46" width="24" height="9" rx="4.5" fill="#4f46e5" />
        <rect x="64" y="14" width="46" height="13" rx="3" fill="none" stroke="#E2E8F0" />
        <rect x="69" y="18" width="14" height="5" rx="1.5" fill="#4f46e5" />
        <rect x="64" y="30" width="46" height="13" rx="3" fill="none" stroke="#E2E8F0" />
        <rect x="69" y="34" width="14" height="5" rx="1.5" fill="#4f46e5" />
        <rect x="64" y="46" width="46" height="13" rx="3" fill="none" stroke="#E2E8F0" />
        <rect x="69" y="50" width="14" height="5" rx="1.5" fill="#4f46e5" />
      </svg>
    ),
  },
  {
    type: "cta-gradient-banner",
    label: "CTA — Gradient Banner",
    category: "CTA",
    defaultProps: (): CtaGradientBannerBlockProps => ({
      heading: "Ready to transform your workflow?",
      subheading: "Join thousands of teams who are already moving faster.",
      ctaPrimaryLabel: "Start for free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#FFFFFF",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="cta-gb-thumb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <rect width="120" height="70" fill="#FFFFFF" rx="4" />
        <rect x="10" y="12" width="100" height="46" rx="10" fill="url(#cta-gb-thumb)" />
        <rect x="34" y="22" width="52" height="6" rx="2" fill="#FFFFFF" />
        <rect x="42" y="33" width="36" height="3" rx="1.5" fill="#FFFFFF" opacity="0.7" />
        <rect x="36" y="42" width="26" height="9" rx="4.5" fill="#FFFFFF" />
        <rect x="66" y="42" width="20" height="9" rx="4.5" fill="none" stroke="#FFFFFF" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "case-study-card-grid",
    label: "Case Study — Card Grid",
    category: "Social Proof",
    defaultProps: (): CaseStudyCardGridBlockProps => ({
      heading: "Trusted by industry leaders",
      subheading: "See how fast-growing companies are transforming their operations with our platform.",
      cards: [
        {
          company: "Stark Industries",
          imageUrl: "",
          imageAlt: "Stark Industries logo",
          result: "Unified disparate engineering data into a single source of truth.",
          metricValue: "85%",
          metricLabel: "Reduction in manual sync tasks",
          linkUrl: "#",
        },
        {
          company: "Globex Corp",
          imageUrl: "",
          imageAlt: "Globex Corp logo",
          result: "Accelerated go-to-market motions across global regional teams.",
          metricValue: "2.5x",
          metricLabel: "Faster campaign launches",
          linkUrl: "#",
        },
        {
          company: "Soylent",
          imageUrl: "",
          imageAlt: "Soylent logo",
          result: "Optimized supply chain logistics with predictive AI routing.",
          metricValue: "$12M",
          metricLabel: "Annual logistics savings",
          linkUrl: "#",
        },
      ],
      ctaLabel: "Explore all customer stories",
      ctaUrl: "#",
      bgColor: "#F8FAFC",
      surfaceColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F8FAFC" rx="4" stroke="#E5E7EB" />
        <rect x="36" y="9" width="48" height="5" rx="2" fill="#0F172A" />
        <g>
          <rect x="9" y="22" width="32" height="38" rx="4" fill="#FFFFFF" stroke="#E2E8F0" />
          <circle cx="17" cy="30" r="4" fill="#4f46e5" opacity="0.25" />
          <rect x="13" y="40" width="24" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="13" y="47" width="14" height="6" rx="2" fill="#4f46e5" />
        </g>
        <g>
          <rect x="44" y="22" width="32" height="38" rx="4" fill="#FFFFFF" stroke="#E2E8F0" />
          <circle cx="52" cy="30" r="4" fill="#4f46e5" opacity="0.25" />
          <rect x="48" y="40" width="24" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="48" y="47" width="14" height="6" rx="2" fill="#4f46e5" />
        </g>
        <g>
          <rect x="79" y="22" width="32" height="38" rx="4" fill="#FFFFFF" stroke="#E2E8F0" />
          <circle cx="87" cy="30" r="4" fill="#4f46e5" opacity="0.25" />
          <rect x="83" y="40" width="24" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="83" y="47" width="14" height="6" rx="2" fill="#4f46e5" />
        </g>
      </svg>
    ),
  },
  {
    type: "case-study-logo-results-row",
    label: "Case Study — Logo Results Row",
    category: "Social Proof",
    defaultProps: (): CaseStudyLogoResultsRowBlockProps => ({
      heading: "Real results from real teams",
      results: [
        {
          company: "TechFlow",
          logoUrl: "",
          logoAlt: "TechFlow logo",
          outcome: "Migrated their entire infrastructure with zero downtime.",
          metricValue: "99.99% uptime",
        },
        {
          company: "DataSync",
          logoUrl: "",
          logoAlt: "DataSync logo",
          outcome: "Reduced customer onboarding time from weeks to days.",
          metricValue: "3x faster",
        },
        {
          company: "CloudScale",
          logoUrl: "",
          logoAlt: "CloudScale logo",
          outcome: "Scaled to handle Black Friday traffic spikes effortlessly.",
          metricValue: "50k req/s",
        },
        {
          company: "LogicCore",
          logoUrl: "",
          logoAlt: "LogicCore logo",
          outcome: "Consolidated five disparate tools into one platform.",
          metricValue: "$120k saved",
        },
      ],
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="40" y="10" width="40" height="4" rx="2" fill="#94A3B8" />
        <g>
          <circle cx="15" cy="28" r="4" fill="#0F172A" opacity="0.3" />
          <rect x="22" y="26" width="14" height="4" rx="2" fill="#0F172A" />
          <rect x="9" y="36" width="22" height="6" rx="2" fill="#4f46e5" />
          <rect x="9" y="46" width="26" height="3" rx="1.5" fill="#CBD5E1" />
        </g>
        <g>
          <circle cx="42" cy="28" r="4" fill="#0F172A" opacity="0.3" />
          <rect x="49" y="26" width="14" height="4" rx="2" fill="#0F172A" />
          <rect x="36" y="36" width="22" height="6" rx="2" fill="#4f46e5" />
          <rect x="36" y="46" width="26" height="3" rx="1.5" fill="#CBD5E1" />
        </g>
        <g>
          <circle cx="69" cy="28" r="4" fill="#0F172A" opacity="0.3" />
          <rect x="76" y="26" width="14" height="4" rx="2" fill="#0F172A" />
          <rect x="63" y="36" width="22" height="6" rx="2" fill="#4f46e5" />
          <rect x="63" y="46" width="26" height="3" rx="1.5" fill="#CBD5E1" />
        </g>
        <g>
          <circle cx="96" cy="28" r="4" fill="#0F172A" opacity="0.3" />
          <rect x="103" y="26" width="12" height="4" rx="2" fill="#0F172A" />
          <rect x="90" y="36" width="22" height="6" rx="2" fill="#4f46e5" />
          <rect x="90" y="46" width="24" height="3" rx="1.5" fill="#CBD5E1" />
        </g>
      </svg>
    ),
  },
  {
    type: "case-study-metric-triptych",
    label: "Case Study — Metric Triptych",
    category: "Social Proof",
    defaultProps: (): CaseStudyMetricTriptychBlockProps => ({
      company: "Acme Corp",
      metrics: [
        { value: "10x", label: "Faster deployment times" },
        { value: "$2.4M", label: "Pipeline generated in Q1" },
        { value: "45%", label: "Increase in conversion rate" },
      ],
      quote: "Implementing this platform was a turning point for our organization. The metrics speak for themselves, but the real value is how it empowered our team to move fast without breaking things.",
      author: "David Chen",
      role: "Chief Marketing Officer",
      ctaLabel: "View full story",
      ctaUrl: "#",
      bgColor: "#FAFAFA",
      surfaceColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="54" y="8" width="12" height="9" rx="3" fill="#FFFFFF" stroke="#E2E8F0" />
        <g textAnchor="middle">
          <rect x="20" y="26" width="18" height="8" rx="2" fill="#4f46e5" />
          <rect x="16" y="38" width="26" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="51" y="26" width="18" height="8" rx="2" fill="#4f46e5" />
          <rect x="47" y="38" width="26" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="82" y="26" width="18" height="8" rx="2" fill="#4f46e5" />
          <rect x="78" y="38" width="26" height="3" rx="1.5" fill="#CBD5E1" />
        </g>
        <rect x="30" y="52" width="60" height="3" rx="1.5" fill="#0F172A" />
        <rect x="40" y="59" width="40" height="3" rx="1.5" fill="#94A3B8" />
      </svg>
    ),
  },
  {
    type: "case-study-spotlight-feature",
    label: "Case Study — Spotlight Feature",
    category: "Social Proof",
    defaultProps: (): CaseStudySpotlightFeatureBlockProps => ({
      eyebrow: "Featured Case Study",
      company: "Nexus Data",
      headline: "How Nexus Data increased pipeline velocity by 300%",
      challenge: "Nexus Data's marketing team was blocked by a slow, engineering-led web update process, taking weeks to launch a single campaign.",
      solution: "By switching to our platform, the marketing team gained full autonomy to build, test, and optimize landing pages without writing code.",
      result: "They now launch 15+ campaigns per week, testing messaging instantly and significantly scaling their inbound pipeline.",
      metricValue: "300%",
      metricLabel: "Increase in campaign launch velocity",
      imageUrl: "",
      imageAlt: "Nexus Data team working",
      ctaLabel: "Read the case study",
      ctaUrl: "#",
      bgColor: "#FFFFFF",
      surfaceColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="9" y="9" width="24" height="3" rx="1.5" fill="#4f46e5" />
        <rect x="9" y="18" width="44" height="5" rx="2" fill="#0F172A" />
        <rect x="9" y="29" width="44" height="3" rx="1.5" fill="#CBD5E1" />
        <rect x="9" y="36" width="40" height="3" rx="1.5" fill="#CBD5E1" />
        <rect x="9" y="46" width="44" height="12" rx="3" fill="#F1F5F9" stroke="#E2E8F0" />
        <rect x="13" y="50" width="14" height="5" rx="2" fill="#4f46e5" />
        <rect x="63" y="12" width="48" height="46" rx="4" fill="#EEF2FF" stroke="#C7D2FE" />
        <circle cx="78" cy="30" r="6" fill="#C7D2FE" />
        <path d="M63 50 L78 38 L92 48 L101 42 L111 50 Z" fill="#A5B4FC" />
      </svg>
    ),
  },
  {
    type: "gallery-carousel-spotlight",
    label: "Gallery — Carousel Spotlight",
    category: "Showcase",
    defaultProps: (): GalleryCarouselSpotlightBlockProps => ({
      eyebrow: "Product Tour",
      headline: "See it in action",
      subheadline: "Explore the platform that's powering modern growth teams.",
      images: [
        { id: "1", src: "", caption: "Dashboard overview", alt: "Dashboard overview" },
        { id: "2", src: "", caption: "Analytics view", alt: "Analytics view" },
        { id: "3", src: "", caption: "Campaign builder", alt: "Campaign builder" },
        { id: "4", src: "", caption: "Team settings", alt: "Team settings" },
      ],
      ctaLabel: "Request a demo",
      ctaUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="20" y="10" width="80" height="34" rx="3" fill="#0F172A" />
        <path d="M14 27 l5 -5 v10 z" fill="#4f46e5" />
        <path d="M106 27 l-5 -5 v10 z" fill="#4f46e5" />
        <rect x="30" y="50" width="18" height="11" rx="2" fill="#4f46e5" />
        <rect x="51" y="50" width="18" height="11" rx="2" fill="#CBD5E1" />
        <rect x="72" y="50" width="18" height="11" rx="2" fill="#CBD5E1" />
      </svg>
    ),
  },
  {
    type: "gallery-filmstrip",
    label: "Gallery — Filmstrip Scroll",
    category: "Showcase",
    defaultProps: (): GalleryFilmstripBlockProps => ({
      headline: "Highlights from our recent retreat",
      images: [
        { id: "1", src: "", caption: "Keynote presentation", alt: "Keynote presentation" },
        { id: "2", src: "", caption: "Workshop session", alt: "Workshop session" },
        { id: "3", src: "", caption: "Team dinner", alt: "Team dinner" },
        { id: "4", src: "", caption: "Award ceremony", alt: "Award ceremony" },
        { id: "5", src: "", caption: "Morning hike", alt: "Morning hike" },
        { id: "6", src: "", caption: "Closing remarks", alt: "Closing remarks" },
      ],
      ctaLabel: "View the full album",
      ctaUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="14" width="8" height="3" rx="1" fill="#0F172A" />
        <rect x="10" y="26" width="34" height="30" rx="3" fill="#94A3B8" />
        <rect x="48" y="26" width="34" height="30" rx="3" fill="#64748B" />
        <rect x="86" y="26" width="34" height="30" rx="3" fill="#94A3B8" />
      </svg>
    ),
  },
  {
    type: "gallery-masonry",
    label: "Gallery — Masonry Grid",
    category: "Showcase",
    defaultProps: (): GalleryMasonryBlockProps => ({
      eyebrow: "Our Culture",
      headline: "Inside the studio",
      subheadline: "See how our team collaborates, creates, and celebrates everyday wins.",
      images: [
        { id: "1", src: "", caption: "Team meeting", alt: "Team meeting", aspect: "aspect-[4/3]" },
        { id: "2", src: "", caption: "Workspace", alt: "Workspace", aspect: "aspect-[3/4]" },
        { id: "3", src: "", caption: "Collaboration", alt: "Collaboration", aspect: "aspect-[1/1]" },
        { id: "4", src: "", caption: "Event", alt: "Event", aspect: "aspect-[4/5]" },
        { id: "5", src: "", caption: "Presentation", alt: "Presentation", aspect: "aspect-[16/9]" },
        { id: "6", src: "", caption: "Brainstorm", alt: "Brainstorm", aspect: "aspect-[4/3]" },
      ],
      ctaLabel: "Join our team",
      ctaUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="12" width="30" height="22" rx="3" fill="#94A3B8" />
        <rect x="14" y="38" width="30" height="18" rx="3" fill="#CBD5E1" />
        <rect x="48" y="12" width="30" height="30" rx="3" fill="#64748B" />
        <rect x="48" y="46" width="30" height="12" rx="3" fill="#94A3B8" />
        <rect x="82" y="12" width="24" height="16" rx="3" fill="#CBD5E1" />
        <rect x="82" y="32" width="24" height="24" rx="3" fill="#94A3B8" />
      </svg>
    ),
  },
  {
    type: "media-feature-reel",
    label: "Media — Feature Reel",
    category: "Showcase",
    defaultProps: (): MediaFeatureReelBlockProps => ({
      heading: "Unleash the full potential of your stack",
      videoUrl: "",
      posterUrl: "",
      features: [
        { icon: "Sparkles", title: "AI-Powered", desc: "Automate repetitive tasks with native intelligence." },
        { icon: "Zap", title: "Real-time Sync", desc: "Instantly update across all your devices." },
        { icon: "Shield", title: "Enterprise Grade", desc: "Bank-level security and compliance built in." },
      ],
      ctaLabel: "Watch the reel",
      ctaUrl: "#",
      ctaSecondaryLabel: "Read the docs",
      ctaSecondaryUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="30" y="8" width="60" height="4" rx="2" fill="#0F172A" />
        <rect x="22" y="18" width="76" height="28" rx="4" fill="#E2E8F0" />
        <circle cx="60" cy="32" r="8" fill="#4f46e5" />
        <polygon points="57,28 57,36 64,32" fill="#FFFFFF" />
        <rect x="16" y="52" width="26" height="12" rx="3" fill="#F1F5F9" />
        <rect x="47" y="52" width="26" height="12" rx="3" fill="#F1F5F9" />
        <rect x="78" y="52" width="26" height="12" rx="3" fill="#F1F5F9" />
      </svg>
    ),
  },
  {
    type: "media-looping-showcase",
    label: "Media — Looping Showcase",
    category: "Showcase",
    defaultProps: (): MediaLoopingShowcaseBlockProps => ({
      heading: "Experience the future of digital workflows",
      subheading: "A continuous, uninterrupted environment that adapts to how you work best. Built for scale, designed for speed.",
      videoUrl: "",
      posterUrl: "",
      ctaLabel: "Watch full film",
      ctaUrl: "#",
      bgColor: "#000000",
      textColor: "#FFFFFF",
      accentColor: "#4f46e5",
      mutedColor: "#94A3B8",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0B0B0F" rx="4" />
        <rect width="120" height="70" fill="#4f46e5" opacity="0.15" rx="4" />
        <circle cx="60" cy="26" r="9" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <polygon points="57,21 57,31 65,26" fill="#FFFFFF" />
        <rect x="34" y="42" width="52" height="5" rx="2" fill="#FFFFFF" />
        <rect x="42" y="52" width="36" height="3" rx="1" fill="#94A3B8" />
      </svg>
    ),
  },
  {
    type: "media-thumbnail-grid",
    label: "Media — Thumbnail Grid",
    category: "Showcase",
    defaultProps: (): MediaThumbnailGridBlockProps => ({
      eyebrow: "Video Library",
      heading: "Master the platform",
      subheading: "Watch quick tutorials and deep dives from our product team.",
      videos: [
        { id: "1", videoUrl: "", posterUrl: "", title: "Getting started with core workflows", duration: "4:12" },
        { id: "2", videoUrl: "", posterUrl: "", title: "Advanced data analytics and reporting", duration: "12:05" },
        { id: "3", videoUrl: "", posterUrl: "", title: "Managing team permissions safely", duration: "7:30" },
      ],
      ctaLabel: "Browse all videos",
      ctaUrl: "#",
      bgColor: "#F8FAFC",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F8FAFC" rx="4" stroke="#E5E7EB" />
        <rect x="12" y="8" width="44" height="4" rx="2" fill="#0F172A" />
        <g>
          <rect x="12" y="20" width="30" height="22" rx="3" fill="#E2E8F0" />
          <circle cx="27" cy="31" r="5" fill="#4f46e5" />
          <polygon points="25,28 25,34 30,31" fill="#FFFFFF" />
          <rect x="45" y="20" width="30" height="22" rx="3" fill="#E2E8F0" />
          <circle cx="60" cy="31" r="5" fill="#4f46e5" />
          <polygon points="58,28 58,34 63,31" fill="#FFFFFF" />
          <rect x="78" y="20" width="30" height="22" rx="3" fill="#E2E8F0" />
          <circle cx="93" cy="31" r="5" fill="#4f46e5" />
          <polygon points="91,28 91,34 96,31" fill="#FFFFFF" />
        </g>
        <rect x="12" y="48" width="26" height="3" rx="1" fill="#94A3B8" />
        <rect x="45" y="48" width="26" height="3" rx="1" fill="#94A3B8" />
        <rect x="78" y="48" width="26" height="3" rx="1" fill="#94A3B8" />
      </svg>
    ),
  },
  {
    type: "media-video-split",
    label: "Media — Video Split",
    category: "Showcase",
    defaultProps: (): MediaVideoSplitBlockProps => ({
      eyebrow: "Product Demo",
      heading: "See how our platform works in action",
      description: "Take a quick tour of the core features that help modern teams move faster and build better products. No fluff, just the workflow.",
      features: [
        "Intuitive drag-and-drop interface",
        "Real-time team collaboration",
        "Seamless third-party integrations",
      ],
      videoUrl: "",
      posterUrl: "",
      ctaLabel: "Start your free trial",
      ctaUrl: "#",
      ctaSecondaryLabel: "",
      ctaSecondaryUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="12" y="16" width="20" height="4" rx="2" fill="#4f46e5" />
        <rect x="12" y="26" width="42" height="5" rx="2" fill="#0F172A" />
        <rect x="12" y="36" width="38" height="3" rx="1" fill="#CBD5E1" />
        <rect x="12" y="43" width="32" height="3" rx="1" fill="#CBD5E1" />
        <rect x="12" y="52" width="24" height="8" rx="3" fill="#4f46e5" />
        <rect x="64" y="14" width="44" height="42" rx="4" fill="#E2E8F0" />
        <circle cx="86" cy="35" r="9" fill="#4f46e5" />
        <polygon points="83,30 83,40 91,35" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    type: "gallery-split-feature",
    label: "Gallery — Split Feature",
    category: "Showcase",
    defaultProps: (): GallerySplitFeatureBlockProps => ({
      eyebrow: "Global Footprint",
      headline: "Designed for teams without borders",
      subheadline: "Our global offices are built to foster connection, creativity, and deep focus. Whether you are in NYC or London, you're part of the same seamless culture.",
      imageUrl: "",
      images: [
        { id: "1", src: "", caption: "Gallery grid 1", alt: "Gallery grid 1" },
        { id: "2", src: "", caption: "Gallery grid 2", alt: "Gallery grid 2" },
      ],
      ctaLabel: "View open roles",
      ctaUrl: "#",
      ctaSecondaryLabel: "Our mission",
      ctaSecondaryUrl: "#",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="20" width="22" height="4" rx="2" fill="#4f46e5" />
        <rect x="14" y="30" width="40" height="5" rx="2" fill="#0F172A" />
        <rect x="14" y="40" width="36" height="3" rx="1" fill="#CBD5E1" />
        <rect x="14" y="46" width="30" height="3" rx="1" fill="#CBD5E1" />
        <rect x="66" y="12" width="30" height="46" rx="3" fill="#64748B" />
        <rect x="99" y="12" width="14" height="22" rx="3" fill="#94A3B8" />
        <rect x="99" y="36" width="14" height="22" rx="3" fill="#CBD5E1" />
      </svg>
    ),
  },
  {
    type: "speaker-grid",
    label: "Speaker Grid",
    category: "Showcase",
    defaultProps: (): SpeakerGridBlockProps => ({
      eyebrow: "Featured speakers",
      headline: "Meet the lineup",
      subheadline: "Founders, builders, and operators sharing what's actually working.",
      columns: 3,
      bgColor: "#0A0A0B",
      textColor: "#F5F5F7",
      accentColor: "#7B5BFF",
      speakers: [
        { name: "Maya Chen", role: "Co-founder & CEO", company: "Latticework", photoUrl: "", bio: "Building developer tools used by 30k+ teams.", socialLabel: "LinkedIn" },
        { name: "Jordan Reyes", role: "Head of Design", company: "Northwind", photoUrl: "", bio: "Previously at Stripe, Figma. Lover of small details.", socialLabel: "LinkedIn" },
        { name: "Priya Shah", role: "VP Engineering", company: "Veridian", photoUrl: "", bio: "Scaling teams from 5 to 500 without losing the magic.", socialLabel: "LinkedIn" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0A0A0B" rx="4" />
        <circle cx="30" cy="28" r="9" fill="#7B5BFF" opacity="0.7" />
        <circle cx="60" cy="28" r="9" fill="#7B5BFF" opacity="0.7" />
        <circle cx="90" cy="28" r="9" fill="#7B5BFF" opacity="0.7" />
        <rect x="20" y="44" width="20" height="3" rx="1" fill="#F5F5F7" />
        <rect x="50" y="44" width="20" height="3" rx="1" fill="#F5F5F7" />
        <rect x="80" y="44" width="20" height="3" rx="1" fill="#F5F5F7" />
        <rect x="22" y="51" width="16" height="2" rx="1" fill="#7B5BFF" />
        <rect x="52" y="51" width="16" height="2" rx="1" fill="#7B5BFF" />
        <rect x="82" y="51" width="16" height="2" rx="1" fill="#7B5BFF" />
      </svg>
    ),
  },
  {
    type: "benefits-alternating-rows",
    label: "Benefits — Alternating Rows",
    category: "Showcase",
    defaultProps: (): BenefitsAlternatingRowsBlockProps => ({
      eyebrow: "Why choose our platform",
      headline: "Everything you need to scale, nothing you don't.",
      subheadline: "We've spent years building the foundation so you can focus on building the product. Experience the difference a truly unified platform makes.",
      bgColor: "#FFFFFF",
      textColor: "#171717",
      accentColor: "#4f46e5",
      rows: [
        { icon: "Zap", title: "Accelerate your launch cycles", description: "Go from idea to production in days, not months. Our platform removes the boilerplate so your team can focus on building product.", features: ["Zero-config deployment pipelines", "Automated infrastructure provisioning", "Built-in CI/CD with instant rollbacks"], linkLabel: "Learn more about launches", linkUrl: "#" },
        { icon: "Layers", title: "Unify your team's knowledge", description: "Break down silos and bring everyone onto the same page. A single source of truth for your documentation, decisions, and architecture.", features: ["Real-time collaborative editing", "Automatic version history", "Cross-functional permission controls"], linkLabel: "Learn more about knowledge", linkUrl: "#" },
        { icon: "TrendingUp", title: "Scale without the growing pains", description: "Built on enterprise-grade infrastructure that grows with you. Handle traffic spikes effortlessly without rewriting your backend.", features: ["Auto-scaling compute resources", "Global edge CDN distribution", "99.99% guaranteed uptime SLA"], linkLabel: "Learn more about scaling", linkUrl: "#" },
      ],
      showCta: true,
      ctaEyebrow: "One unified platform",
      ctaHeading: "Ship faster, scale further",
      ctaSubheading: "Bring design, engineering, and marketing onto the same canvas. See what a truly unified platform does for your launch velocity.",
      ctaPrimaryLabel: "Get started free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="14" width="40" height="6" rx="2" fill="#171717" />
        <rect x="14" y="24" width="30" height="3" rx="1" fill="#94A3B8" />
        <rect x="14" y="31" width="34" height="3" rx="1" fill="#94A3B8" />
        <rect x="14" y="40" width="6" height="6" rx="3" fill="#4f46e5" />
        <rect x="24" y="41" width="22" height="3" rx="1" fill="#94A3B8" />
        <rect x="62" y="14" width="44" height="42" rx="3" fill="#EEF0FF" stroke="#C7D2FE" />
        <rect x="68" y="20" width="20" height="3" rx="1" fill="#4f46e5" />
        <rect x="68" y="30" width="32" height="18" rx="2" fill="#C7D2FE" />
      </svg>
    ),
  },
  {
    type: "how-it-works-alternating",
    label: "How It Works — Alternating Showcase",
    category: "Showcase",
    defaultProps: (): HowItWorksAlternatingBlockProps => ({
      eyebrow: "How it works",
      headline: "From idea to live page in minutes",
      subheadline: "Skip the development backlog. Empower your marketing team to build, test, and scale landing pages independently.",
      bgColor: "#FAFAFA",
      textColor: "#171717",
      accentColor: "#4f46e5",
      steps: [
        { icon: "LayoutTemplate", title: "Select a brand template", description: "Start with a high-converting baseline. Choose from dozens of battle-tested layouts designed specifically for B2B SaaS, then instantly apply your company's colors and fonts.", features: ["One-click brand import", "Mobile-responsive by default", "Accessible color palettes"] },
        { icon: "MousePointerClick", title: "Customize without code", description: "Drag, drop, and edit directly on the canvas. Our visual editor gives you complete control over spacing, typography, and content without writing a single line of CSS.", features: ["Inline text editing", "Global component libraries", "Version history"] },
        { icon: "Zap", title: "Publish and optimize", description: "Hit publish to deploy instantly to our global edge network. Track conversions, run A/B tests, and iterate rapidly based on real user data.", features: ["Instant edge deployment", "Built-in analytics", "SEO optimization tools"] },
      ],
      showCta: true,
      ctaEyebrow: "Get a guided tour",
      ctaHeading: "See how fast your team can ship landing pages",
      ctaSubheading: "Book a live walkthrough and watch a page go from brand template to published in minutes — no development backlog required.",
      ctaPrimaryLabel: "Schedule a walkthrough",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="40" y="8" width="40" height="4" rx="2" fill="#171717" />
        <rect x="14" y="22" width="6" height="6" rx="3" fill="#4f46e5" />
        <rect x="14" y="32" width="34" height="4" rx="2" fill="#171717" />
        <rect x="14" y="40" width="30" height="3" rx="1" fill="#94A3B8" />
        <rect x="14" y="47" width="22" height="3" rx="1" fill="#94A3B8" />
        <rect x="62" y="22" width="44" height="34" rx="3" fill="#EEF0FF" stroke="#C7D2FE" />
        <rect x="68" y="28" width="14" height="3" rx="1" fill="#4f46e5" />
        <rect x="68" y="36" width="32" height="14" rx="2" fill="#C7D2FE" />
      </svg>
    ),
  },
  {
    type: "how-it-works-numbered-bento",
    label: "How It Works — Numbered Bento",
    category: "Showcase",
    defaultProps: (): HowItWorksNumberedBentoBlockProps => ({
      eyebrow: "How it works",
      headline: "From raw data to live campaigns in minutes.",
      subheadline: "Stop waiting weeks for landing pages. Connect your systems once, define your rules, and let our engine build the rest.",
      bgColor: "#FAFAFA",
      textColor: "#171717",
      accentColor: "#4f46e5",
      steps: [
        { icon: "Plug", title: "Connect your data", description: "Link your CRM, CMS, and product databases in a few clicks. We automatically sync your inventory, pricing, and customer segments in real-time." },
        { icon: "Palette", title: "Map your brand", description: "Upload your fonts, colors, and logos. Our engine ensures every generated page stays strictly on-brand." },
        { icon: "Wand2", title: "Generate variants", description: "Instantly spin up hundreds of personalized page variants tailored to different audiences and search intents." },
        { icon: "BarChart3", title: "Publish & track", description: "Deploy to your domain with zero configuration. Watch conversions roll in through our built-in analytics dashboard." },
      ],
      buttonLabel: "Start building for free",
      buttonUrl: "#",
      showCta: true,
      ctaEyebrow: "Skip the wait",
      ctaHeading: "Turn your data into live campaigns today",
      ctaSubheading: "Connect your systems once and let LP Studio generate hundreds of on-brand, personalized pages — no weeks-long backlog required.",
      ctaPrimaryLabel: "Start building for free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="8" width="32" height="4" rx="2" fill="#171717" />
        <rect x="14" y="15" width="24" height="3" rx="1" fill="#94A3B8" />
        <rect x="14" y="26" width="56" height="18" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="18" y="30" width="6" height="6" rx="3" fill="#4f46e5" />
        <rect x="74" y="26" width="32" height="18" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="78" y="30" width="6" height="6" rx="3" fill="#4f46e5" />
        <rect x="14" y="48" width="32" height="14" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="18" y="52" width="6" height="6" rx="3" fill="#4f46e5" />
        <rect x="50" y="48" width="56" height="14" rx="3" fill="#4f46e5" />
        <rect x="54" y="52" width="6" height="6" rx="3" fill="#C7D2FE" />
      </svg>
    ),
  },
  {
    type: "how-it-works-vertical-timeline",
    label: "How It Works — Vertical Timeline",
    category: "Showcase",
    defaultProps: (): HowItWorksVerticalTimelineBlockProps => ({
      eyebrow: "How it works",
      headline: "From idea to published campaign in minutes",
      subheadline: "Skip the lengthy design cycles and developer bottlenecks. Our platform automates the heavy lifting so you can focus on strategy.",
      bgColor: "#ffffff",
      textColor: "#171717",
      accentColor: "#4f46e5",
      steps: [
        { icon: "Palette", title: "Connect your brand", description: "Link your style guide or let our AI extract colors, typography, and voice directly from your domain in seconds." },
        { icon: "Users", title: "Define your audience", description: "Select your target segment and campaign goals so our engine can assemble the right blocks and personalize the messaging." },
        { icon: "Zap", title: "Generate campaigns", description: "Create dozens of perfectly on-brand, high-converting landing pages tailored to your ad groups with a single click." },
        { icon: "BarChart3", title: "Publish & measure", description: "Push directly to your custom subdomain and track conversion uplift instantly with our built-in analytics." },
      ],
      primaryButtonLabel: "Start building for free",
      primaryButtonUrl: "#",
      secondaryButtonLabel: "View examples",
      secondaryButtonUrl: "#",
      showCta: true,
      ctaEyebrow: "Ready when you are",
      ctaHeading: "Launch your first on-brand campaign today",
      ctaSubheading: "Connect your brand, pick an audience, and let LP Studio assemble high-converting pages in minutes — no design or dev cycles required.",
      ctaPrimaryLabel: "Start building for free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "View live examples",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="8" width="40" height="4" rx="2" fill="#171717" />
        <rect x="14" y="15" width="28" height="3" rx="1" fill="#94A3B8" />
        <rect x="21" y="26" width="2" height="34" rx="1" fill="#E5E7EB" />
        <circle cx="22" cy="30" r="5" fill="#FFFFFF" stroke="#C7D2FE" />
        <circle cx="22" cy="44" r="5" fill="#FFFFFF" stroke="#C7D2FE" />
        <circle cx="22" cy="58" r="5" fill="#FFFFFF" stroke="#C7D2FE" />
        <rect x="34" y="27" width="30" height="3" rx="1" fill="#171717" />
        <rect x="34" y="33" width="50" height="2" rx="1" fill="#94A3B8" />
        <rect x="34" y="41" width="30" height="3" rx="1" fill="#171717" />
        <rect x="34" y="47" width="50" height="2" rx="1" fill="#94A3B8" />
        <rect x="34" y="55" width="30" height="3" rx="1" fill="#171717" />
      </svg>
    ),
  },
  {
    type: "how-it-works-horizontal-stepper",
    label: "How It Works — Horizontal Stepper",
    category: "Showcase",
    defaultProps: (): HowItWorksHorizontalStepperBlockProps => ({
      eyebrow: "How it works",
      headline: "From zero to automated in minutes",
      subheadline: "We've eliminated the technical complexity so you can focus on building the perfect revenue engine.",
      headerCtaLabel: "Start free trial",
      headerCtaUrl: "#",
      bgColor: "#FAFAFA",
      textColor: "#171717",
      accentColor: "#4f46e5",
      steps: [
        { icon: "UserPlus", title: "Connect your tools", description: "Securely link your existing CRM and data sources in one click." },
        { icon: "Zap", title: "Set your rules", description: "Define custom routing logic and scoring criteria without code." },
        { icon: "Rocket", title: "Go live instantly", description: "Launch your automated workflows and start routing leads immediately." },
      ],
      trustItems: ["No credit card required", "Cancel anytime", "14-day free trial"],
      showCta: true,
      ctaEyebrow: "See it in action",
      ctaHeading: "Watch your revenue engine go live in minutes",
      ctaSubheading: "Book a quick walkthrough and we'll show you how to connect your tools, set your rules, and start routing leads automatically.",
      ctaPrimaryLabel: "Book a demo",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="14" y="10" width="40" height="4" rx="2" fill="#171717" />
        <rect x="14" y="18" width="28" height="3" rx="1" fill="#94A3B8" />
        <rect x="90" y="10" width="16" height="8" rx="2" fill="#4f46e5" />
        <rect x="14" y="34" width="92" height="2" rx="1" fill="#E5E7EB" />
        <circle cx="22" cy="35" r="6" fill="#FFFFFF" stroke="#C7D2FE" />
        <circle cx="60" cy="35" r="6" fill="#FFFFFF" stroke="#C7D2FE" />
        <circle cx="98" cy="35" r="6" fill="#FFFFFF" stroke="#C7D2FE" />
        <rect x="14" y="46" width="20" height="3" rx="1" fill="#171717" />
        <rect x="52" y="46" width="20" height="3" rx="1" fill="#171717" />
        <rect x="90" y="46" width="20" height="3" rx="1" fill="#171717" />
        <rect x="14" y="53" width="24" height="2" rx="1" fill="#94A3B8" />
        <rect x="52" y="53" width="24" height="2" rx="1" fill="#94A3B8" />
        <rect x="90" y="53" width="22" height="2" rx="1" fill="#94A3B8" />
      </svg>
    ),
  },
  {
    type: "benefits-bento",
    label: "Benefits — Bento Grid",
    category: "Showcase",
    defaultProps: (): BenefitsBentoBlockProps => ({
      eyebrow: "Platform capabilities",
      headline: "Everything you need to scale operations.",
      subheadline: "We've built the foundation so you can focus on what matters most—delivering value to your customers with zero friction.",
      bgColor: "#FAFAFA",
      textColor: "#171717",
      accentColor: "#4f46e5",
      tiles: [
        { icon: "Layers", title: "Visual Workflow Builder", description: "Drag and drop your way to complex automations. Connect apps, databases, and APIs without writing a single line of code." },
        { icon: "CloudLightning", title: "Instant Deployments", description: "Push your changes live in milliseconds to our globally distributed edge network." },
        { icon: "Users", title: "Multiplayer Sync", description: "Work together in real-time. See cursors, leave comments, and ship faster as a team." },
        { icon: "ShieldCheck", title: "Enterprise Security", description: "SOC2 compliant, SSO, and granular RBAC out of the box for total peace of mind." },
        { icon: "BarChart3", title: "Advanced Telemetry", description: "Track every interaction, monitor performance, and gain actionable insights with our built-in analytics engine." },
      ],
      showCta: true,
      ctaEyebrow: "Built to scale with you",
      ctaHeading: "Bring every capability together",
      ctaSubheading: "From visual workflows to enterprise security, see how the platform powers your operations end to end.",
      ctaPrimaryLabel: "Request a walkthrough",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="12" width="50" height="32" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="64" y="12" width="20" height="15" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="88" y="12" width="20" height="15" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="64" y="29" width="20" height="15" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="88" y="29" width="20" height="15" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="10" y="48" width="50" height="12" rx="3" fill="#4f46e5" />
        <rect x="64" y="48" width="44" height="12" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="14" y="16" width="8" height="8" rx="2" fill="#EEF0FF" />
      </svg>
    ),
  },
  {
    type: "features-bento-showcase",
    label: "Features — Bento Showcase",
    category: "Showcase",
    defaultProps: (): FeaturesBentoShowcaseBlockProps => ({
      eyebrow: "Platform Capabilities",
      headline: "Everything you need to build at scale.",
      subheadline: "A comprehensive suite of tools designed for modern marketing teams. Build, test, and deploy without waiting on engineering.",
      bgColor: "#FAFAFA",
      textColor: "#171717",
      accentColor: "#4f46e5",
      tiles: [
        { icon: "Layout", title: "Visual Page Builder", description: "A truly WYSIWYG experience. Drag, drop, and configure components with a robust property panel. What you see is exactly what your customers get." },
        { icon: "Palette", title: "Global Brand Sync", description: "Define your palettes, fonts, and logos once. Updates cascade across all your pages instantly." },
        { icon: "Users", title: "Real-time Collab", description: "See who's editing, leave comments on specific blocks, and never overwrite someone else's work." },
        { icon: "LineChart", title: "A/B Testing Engine", description: "Test headlines, heroes, or entire page layouts. Automatic traffic routing and statistical significance." },
        { icon: "Shield", title: "Role-based Access", description: "Granular permissions ensure the right people can edit, while protecting your core templates." },
        { icon: "Rocket", title: "Instant Publishing", description: "Deploy to a global edge network in milliseconds. Changes are live instantly, with zero downtime." },
      ],
      showCta: true,
      ctaEyebrow: "Built for scale",
      ctaHeading: "Ship your next campaign without the engineering bottleneck.",
      ctaSubheading: "Bring every capability together in one workspace and launch pages your whole team can build on.",
      ctaPrimaryLabel: "Start building free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Book a walkthrough",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="10" width="50" height="34" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="14" y="14" width="8" height="8" rx="2" fill="#EEF0FF" />
        <rect x="14" y="30" width="38" height="10" rx="2" fill="#EEF1F5" />
        <rect x="64" y="10" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="88" y="10" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="64" y="28" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="88" y="28" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="10" y="52" width="44" height="10" rx="3" fill="#4f46e5" />
        <rect x="58" y="52" width="36" height="10" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
      </svg>
    ),
  },
  {
    type: "features-spotlight-cards",
    label: "Features — Spotlight Cards",
    category: "Showcase",
    defaultProps: (): FeaturesSpotlightCardsBlockProps => ({
      eyebrow: "Platform Capabilities",
      headline: "Everything you need to launch and scale.",
      spotlightIcon: "LayoutTemplate",
      spotlightTitle: "Drag-and-drop visual builder",
      spotlightDescription: "Design stunning, high-converting landing pages without writing a single line of code. Our intuitive builder gives you pixel-perfect control over every element, backed by a robust block library.",
      spotlightButtonLabel: "Try the builder",
      spotlightButtonUrl: "#",
      bgColor: "#FAFAFA",
      textColor: "#171717",
      accentColor: "#4f46e5",
      secondaryFeatures: [
        { icon: "SplitSquareHorizontal", title: "Native A/B Testing", description: "Split traffic automatically and find your winning variations." },
        { icon: "LineChart", title: "Real-time Analytics", description: "Track page views, conversion rates, and bounce rates instantly." },
        { icon: "Globe", title: "Custom Domains", description: "Publish pages directly to your own brand domains and subdomains." },
        { icon: "Users", title: "Team Collaboration", description: "Invite teammates, manage roles, and review drafts together." },
        { icon: "Search", title: "Advanced SEO Tools", description: "Optimize metadata, generate sitemaps, and score high on search." },
      ],
      showCta: true,
      ctaEyebrow: "Ready when you are",
      ctaHeading: "Launch your first page in minutes, not weeks.",
      ctaSubheading: "Everything from the visual builder to analytics is included — start free and upgrade only when you need to.",
      ctaPrimaryLabel: "Try the builder",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "See all features",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="10" width="48" height="30" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="14" y="14" width="9" height="9" rx="2" fill="#EEF0FF" />
        <rect x="14" y="28" width="34" height="8" rx="2" fill="#EEF1F5" />
        <rect x="62" y="10" width="48" height="30" rx="3" fill="#EDEEF2" stroke="#E5E7EB" />
        <rect x="10" y="46" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="34" y="46" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="58" y="46" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
        <rect x="82" y="46" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
      </svg>
    ),
  },
  {
    type: "features-tabbed-categories",
    label: "Features — Tabbed Categories",
    category: "Showcase",
    defaultProps: (): FeaturesTabbedCategoriesBlockProps => ({
      eyebrow: "Platform Capabilities",
      headline: "Everything you need to build at scale.",
      subheadline: "A complete suite of tools designed to help marketing teams launch faster, iterate smarter, and drive more pipeline without writing code.",
      bgColor: "#FFFFFF",
      textColor: "#171717",
      accentColor: "#4f46e5",
      categories: [
        {
          id: "design",
          label: "Design & Build",
          icon: "MonitorSmartphone",
          heading: "Pixel-perfect control, zero code required.",
          subheading: "Empower your marketing team to build stunning pages without waiting on engineering.",
          features: [
            { icon: "Paintbrush", title: "Visual Builder", description: "Drag-and-drop elements with real-time preview and precision layout controls." },
            { icon: "Palette", title: "Global Styles", description: "Define typography, colors, and spacing once to ensure brand consistency." },
            { icon: "Layers", title: "Dynamic Blocks", description: "Create smart, reusable components that sync instantly when updated anywhere." },
          ],
        },
        {
          id: "conversion",
          label: "Conversion Optimization",
          icon: "Zap",
          heading: "Turn more clicks into qualified pipeline.",
          subheading: "Deploy sophisticated experiments and smart forms to maximize your advertising ROI.",
          features: [
            { icon: "Split", title: "A/B Testing", description: "Run multivariate experiments and automatically route traffic to the winning variant." },
            { icon: "ListChecks", title: "Form Flows", description: "Build multi-step lead capture forms with conditional logic and progressive profiling." },
            { icon: "Sparkles", title: "Smart Personalization", description: "Swap headlines, imagery, and CTAs based on visitor firmographics." },
          ],
        },
        {
          id: "analytics",
          label: "Analytics & Attribution",
          icon: "BarChart3",
          heading: "Measure what matters, prove your impact.",
          subheading: "Connect the dots between marketing activity and closed revenue with precision.",
          features: [
            { icon: "Route", title: "Journey Tracking", description: "Map the complete path from initial ad click to final conversion event." },
            { icon: "DollarSign", title: "Revenue Attribution", description: "Connect marketing touches directly to closed-won deals in your CRM." },
            { icon: "MousePointerClick", title: "Heatmaps", description: "Understand exactly where visitors engage, hesitate, and drop off your pages." },
          ],
        },
      ],
      showCta: true,
      ctaEyebrow: "See it in action",
      ctaHeading: "Get a guided tour of the full platform.",
      ctaSubheading: "Walk through design, conversion, and analytics with a specialist who knows your use case.",
      ctaPrimaryLabel: "Book a live demo",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "See all features",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="10" y="9" width="24" height="6" rx="2" fill="#4f46e5" />
        <rect x="38" y="9" width="24" height="6" rx="2" fill="#EEF1F5" />
        <rect x="66" y="9" width="24" height="6" rx="2" fill="#EEF1F5" />
        <rect x="10" y="15" width="100" height="1.5" fill="#E5E7EB" />
        <rect x="10" y="24" width="40" height="8" rx="2" fill="#EEF1F5" />
        <rect x="10" y="36" width="44" height="5" rx="2" fill="#F1F3F6" />
        <rect x="10" y="44" width="44" height="5" rx="2" fill="#F1F3F6" />
        <rect x="10" y="52" width="44" height="5" rx="2" fill="#F1F3F6" />
        <rect x="60" y="24" width="50" height="36" rx="3" fill="#EEF0FF" stroke="#E5E7EB" />
      </svg>
    ),
  },
  {
    type: "features-comparison-checklist",
    label: "Features — Comparison Checklist",
    category: "Showcase",
    defaultProps: (): FeaturesComparisonChecklistBlockProps => ({
      eyebrow: "Platform Capabilities",
      headline: "Everything you need to scale",
      subheadline: "Stop worrying about the foundational pieces. We include all the enterprise-grade infrastructure and capabilities right out of the box.",
      featureColumnLabel: "Feature & Description",
      includedColumnLabel: "Included",
      bgColor: "#FFFFFF",
      textColor: "#171717",
      accentColor: "#4f46e5",
      categories: [
        {
          title: "Infrastructure & Security",
          features: [
            { icon: "Database", name: "Multi-tenant Architecture", description: "Isolate customer data automatically with dedicated database schemas." },
            { icon: "Shield", name: "Role-based Access Control", description: "Granular permissions, custom roles, and comprehensive audit logs." },
          ],
        },
        {
          title: "Platform Capabilities",
          features: [
            { icon: "Globe", name: "White-labeling Engine", description: "Custom domains, branding presets, and branded email delivery." },
            { icon: "Zap", name: "API & Webhooks", description: "RESTful endpoints and real-time events for external systems." },
          ],
        },
        {
          title: "Experience & Support",
          features: [
            { icon: "Layers", name: "Component Library", description: "Over 100+ accessible, pre-built components ready to deploy." },
            { icon: "MessageSquare", name: "Priority Support", description: "24/7 dedicated support team with 1-hour response SLA." },
          ],
        },
      ],
      showBespokeCard: true,
      bespokeHeading: "Need something bespoke?",
      bespokeSubheading: "Our engineering team can build custom modules for your enterprise.",
      bespokeButtonLabel: "Contact Enterprise Sales",
      bespokeButtonUrl: "#",
      showCta: true,
      ctaEyebrow: "Stay in the loop",
      ctaHeading: "Get the enterprise capabilities checklist.",
      ctaSubheading: "Drop your email and we'll send the full breakdown of what's included on every plan.",
      ctaPrimaryLabel: "Send it to me",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="38" y="8" width="44" height="5" rx="2" fill="#171717" />
        <rect x="14" y="20" width="92" height="42" rx="4" fill="#FFFFFF" stroke="#E5E7EB" />
        {[0, 1, 2].map((r) => (
          <g key={r} transform={`translate(20, ${26 + r * 12})`}>
            <rect width="7" height="7" rx="2" fill="#EEF0FF" />
            <rect x="12" y="1" width="44" height="3" rx="1" fill="#171717" />
            <rect x="12" y="6" width="34" height="2" rx="1" fill="#94A3B8" />
            <circle cx="86" cy="4" r="4" fill="#4f46e5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "benefits-icon-grid",
    label: "Benefits — Icon Grid",
    category: "Showcase",
    defaultProps: (): BenefitsIconGridBlockProps => ({
      eyebrow: "Why choose us",
      headline: "Everything you need to scale your marketing",
      subheadline: "We've eliminated the friction between design, engineering, and marketing. Focus on your message, and let our platform handle the rest.",
      bgColor: "#FFFFFF",
      textColor: "#171717",
      accentColor: "#4f46e5",
      columns: 3,
      items: [
        { icon: "Zap", title: "Lightning fast execution", description: "Launch campaigns in minutes, not weeks. Our intuitive builder removes technical bottlenecks so your team moves at the speed of thought." },
        { icon: "BarChart3", title: "Data-driven optimization", description: "Stop guessing what works. Built-in A/B testing and real-time analytics ensure every page performs better than the last." },
        { icon: "ShieldCheck", title: "Enterprise-grade security", description: "Rest easy knowing your brand assets and customer data are protected by bank-level encryption and compliance frameworks." },
        { icon: "Users", title: "Seamless collaboration", description: "Bring your whole team together. Comment, review, and approve changes directly on the canvas without context switching." },
        { icon: "Globe2", title: "Global localization", description: "Scale your message worldwide. Automatically adapt content, currency, and layouts for different regions with a single click." },
        { icon: "Clock", title: "24/7 automated scaling", description: "Handle viral traffic spikes effortlessly. Our edge network automatically distributes your pages globally for zero downtime." },
      ],
      showCta: true,
      ctaEyebrow: "Ready when you are",
      ctaHeading: "Build your first page in minutes",
      ctaSubheading: "See how the platform removes the friction between design, engineering, and marketing—no credit card required.",
      ctaPrimaryLabel: "Start building free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Book a demo",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="12" y="10" width="44" height="5" rx="2" fill="#171717" />
        {[0, 1, 2].map((c) => (
          <g key={c} transform={`translate(${12 + c * 34}, 26)`}>
            <rect width="8" height="8" rx="2" fill="#EEF0FF" />
            <rect x="0" y="13" width="26" height="3" rx="1" fill="#171717" />
            <rect x="0" y="19" width="22" height="2" rx="1" fill="#94A3B8" />
            <rect x="0" y="24" width="24" height="2" rx="1" fill="#94A3B8" />
          </g>
        ))}
        {[0, 1, 2].map((c) => (
          <g key={`b${c}`} transform={`translate(${12 + c * 34}, 50)`}>
            <rect width="8" height="8" rx="2" fill="#EEF0FF" />
            <rect x="0" y="13" width="26" height="3" rx="1" fill="#171717" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "benefits-stat-led",
    label: "Benefits — Stat-Led",
    category: "Showcase",
    defaultProps: (): BenefitsStatLedBlockProps => ({
      eyebrow: "Proven Outcomes",
      headline: "Measurable impact, delivered by design.",
      subheadline: "Don't just take our word for it. See the real numbers our platform delivers for marketing teams scaling their operations.",
      bgColor: "#FFFFFF",
      textColor: "#171717",
      accentColor: "#4f46e5",
      stats: [
        { stat: "3.5x", title: "Faster Deployment", description: "Launch new campaigns in days instead of weeks, eliminating developer bottlenecks and long QA cycles entirely.", icon: "Zap" },
        { stat: "+42%", title: "Conversion Uplift", description: "Our performance-optimized blocks and automatic A/B testing systematically drive higher lead generation across all your pages.", icon: "TrendingUp" },
        { stat: "15h", title: "Saved Per Week", description: "Free up your marketing team to focus on high-level strategy rather than wrestling with brittle code and rigid CMS limitations.", icon: "Clock" },
      ],
      showCta: true,
      ctaEyebrow: "See the numbers for yourself",
      ctaHeading: "Put these outcomes to work",
      ctaSubheading: "Get the benchmark report and a tailored walkthrough delivered straight to your inbox.",
      ctaPrimaryLabel: "Send me the report",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        {[0, 1, 2].map((c) => (
          <g key={c} transform={`translate(${12 + c * 36}, 16)`}>
            <text x="0" y="16" fontSize="16" fontWeight="800" fill="#4f46e5">{["3.5x", "+42%", "15h"][c]}</text>
            <rect x="0" y="24" width="30" height="2" rx="1" fill="#E5E7EB" />
            <rect x="0" y="32" width="7" height="7" rx="2" fill="#EEF0FF" />
            <rect x="10" y="33" width="20" height="3" rx="1" fill="#171717" />
            <rect x="10" y="39" width="18" height="2" rx="1" fill="#94A3B8" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "quote-carousel",
    label: "Quotes — Carousel",
    category: "Social Proof",
    defaultProps: (): QuoteCarouselBlockProps => ({
      eyebrow: "Customer Stories",
      headline: "Don't just take our word for it.",
      subheadline: "See how top teams are accelerating their work and driving more results.",
      bgColor: "#FAFAFA",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
      testimonials: [
        { quote: "We went from a 3-week backlog for landing pages to spinning up highly-targeted campaigns in under an hour. The conversion uplift speaks for itself.", author: "Sarah Jenkins", role: "VP of Growth", company: "Lumina Data", avatarInitials: "SJ", avatarImage: "", rating: 5 },
        { quote: "Most page builders ignore enterprise constraints. This is the first platform that enforces our brand guidelines while giving the team the agility they need.", author: "Marcus Chen", role: "Head of Demand Gen", company: "Vertex Systems", avatarInitials: "MC", avatarImage: "", rating: 5 },
        { quote: "The ability to rapidly launch and test new messaging without developer intervention is incredible. Our conversion rates are up 28%.", author: "Elena Rodriguez", role: "Marketing Director", company: "Finova Capital", avatarInitials: "ER", avatarImage: "", rating: 5 },
      ],
      showCta: true,
      ctaEyebrow: "Ready when you are",
      ctaHeading: "Ready to accelerate your campaigns?",
      ctaSubheading: "Join thousands of teams building better pages, faster.",
      ctaPrimaryLabel: "Start your free trial",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FAFAFA" rx="4" stroke="#E5E7EB" />
        <rect x="52" y="12" width="16" height="12" rx="3" fill="#EEF0FF" />
        <rect x="40" y="30" width="40" height="3" rx="1" fill="#0F172A" />
        <rect x="34" y="37" width="52" height="3" rx="1" fill="#94A3B8" />
        <circle cx="60" cy="50" r="5" fill="#4f46e5" opacity="0.3" />
        <path d="M16 38 l-5 -5 l5 -5" stroke="#94A3B8" strokeWidth="2" fill="none" />
        <path d="M104 28 l5 5 l-5 5" stroke="#94A3B8" strokeWidth="2" fill="none" />
        <circle cx="52" cy="62" r="2" fill="#4f46e5" />
        <circle cx="60" cy="62" r="2" fill="#CBD5E1" />
        <circle cx="68" cy="62" r="2" fill="#CBD5E1" />
      </svg>
    ),
  },
  {
    type: "quote-library",
    label: "Quotes — Wall of Love",
    category: "Social Proof",
    defaultProps: (): QuoteLibraryBlockProps => ({
      eyebrow: "Wall of Love",
      headline: "Trusted by the world's best teams",
      subheadline: "See what leaders are saying about how we transformed the way they work.",
      bgColor: "#F8FAFC",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
      testimonials: [
        { id: "1", quote: "Cut our campaign time-to-market from 3 weeks to 3 hours. The quality is indistinguishable from our custom-coded pages.", author: "Sarah Jenkins", role: "VP Marketing", company: "Acme Corp", rating: 5, avatarInitials: "SJ" },
        { id: "2", quote: "Finally, a builder that actually understands B2B requirements. The built-in components are incredibly well thought out.", author: "Marcus Chen", role: "Director of Demand Gen", company: "TechFlow", rating: 5, avatarInitials: "MC" },
        { id: "3", quote: "We were skeptical about losing design control, but the brand constraints actually made our pages more consistent.", author: "Elena Rodriguez", role: "CMO", company: "Nexus Systems", rating: 5, avatarInitials: "ER" },
        { id: "4", quote: "The ability to spin up bespoke ABM pages for our top accounts without waiting on engineering has transformed our outbound.", author: "David Kim", role: "Growth Lead", company: "Kira", rating: 5, avatarInitials: "DK" },
        { id: "5", quote: "I've tried them all. This is the first platform that feels like it was built for professionals who care about brand.", author: "Rachel Foster", role: "Head of Marketing", company: "Vanguard", rating: 5, avatarInitials: "RF" },
        { id: "6", quote: "Our engineering team was thrilled when we switched. They focus on the core product, and marketing gets infinite flexibility.", author: "Tom Baker", role: "CTO", company: "FinTech Solutions", rating: 4, avatarInitials: "TB" },
      ],
      showCta: true,
      ctaEyebrow: "Join them",
      ctaHeading: "Ready to move faster?",
      ctaSubheading: "Join thousands of teams shipping better pages today.",
      ctaPrimaryLabel: "Start building for free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Book a demo",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F8FAFC" rx="4" stroke="#E5E7EB" />
        <rect x="46" y="8" width="28" height="3" rx="1" fill="#0F172A" />
        {[0, 1, 2].map((c) => (
          <g key={c} transform={`translate(${10 + c * 36}, 18)`}>
            <rect width="32" height="20" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
            <rect x="4" y="4" width="16" height="2" rx="1" fill="#4f46e5" />
            <rect x="4" y="9" width="24" height="2" rx="1" fill="#94A3B8" />
            <circle cx="7" cy="15" r="2.5" fill="#EEF0FF" />
            <rect x="12" y="14" width="14" height="2" rx="1" fill="#94A3B8" />
          </g>
        ))}
        {[0, 1, 2].map((c) => (
          <g key={`b${c}`} transform={`translate(${10 + c * 36}, 42)`}>
            <rect width="32" height="20" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
            <rect x="4" y="4" width="16" height="2" rx="1" fill="#4f46e5" />
            <rect x="4" y="9" width="24" height="2" rx="1" fill="#94A3B8" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "quote-with-image",
    label: "Quotes — With Image",
    category: "Social Proof",
    defaultProps: (): QuoteWithImageBlockProps => ({
      eyebrow: "Customer Story",
      quote: "Before this, our team relied on engineering for every single iteration. It took weeks to test a new message. Now, we launch five high-converting campaigns a week. It fundamentally changed how we scale.",
      author: "Sarah Jenkins",
      role: "VP of Demand Generation",
      company: "Equinox",
      imageUrl: "",
      imageAlt: "Portrait of Sarah Jenkins",
      imageSide: "left",
      rating: 5,
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
      showCta: true,
      ctaHeading: "Ready to accelerate your team?",
      ctaSubheading: "See how it can transform your velocity in a 15-minute product tour.",
      ctaPrimaryLabel: "Book a personalized demo",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <rect x="12" y="12" width="40" height="46" rx="4" fill="#CBD5E1" />
        <circle cx="32" cy="30" r="8" fill="#94A3B8" />
        <path d="M20 52 q12 -14 24 0" fill="#94A3B8" />
        <rect x="62" y="16" width="20" height="3" rx="1" fill="#4f46e5" />
        <rect x="62" y="26" width="46" height="3" rx="1" fill="#0F172A" />
        <rect x="62" y="33" width="42" height="3" rx="1" fill="#0F172A" />
        <rect x="62" y="40" width="36" height="3" rx="1" fill="#94A3B8" />
        <rect x="62" y="50" width="24" height="8" rx="3" fill="#4f46e5" />
      </svg>
    ),
  },
  {
    type: "single-quote",
    label: "Quotes — Single",
    category: "Social Proof",
    defaultProps: (): SingleQuoteBlockProps => ({
      quote: "Before this, every campaign required a week of dev time just to get the tracking and styling right. Now, my demand gen team launches six flawless, brand-perfect pages a week on their own. It has fundamentally changed our velocity.",
      author: "Sarah Jenkins",
      role: "VP of Growth Marketing",
      company: "Acme Corp",
      avatarInitials: "SJ",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
      showCta: true,
      ctaEyebrow: "Ready when you are",
      ctaHeading: "Ready to scale your campaigns?",
      ctaSubheading: "Join thousands of marketers building better pages, faster.",
      ctaPrimaryLabel: "Start your free trial",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Talk to sales",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#FFFFFF" rx="4" stroke="#E5E7EB" />
        <circle cx="60" cy="16" r="6" fill="#EEF0FF" />
        <path d="M57 14 q0 -3 3 -3 M60 14 q0 -3 3 -3" stroke="#4f46e5" strokeWidth="1.5" fill="none" />
        <rect x="30" y="28" width="60" height="4" rx="2" fill="#0F172A" />
        <rect x="38" y="36" width="44" height="4" rx="2" fill="#0F172A" />
        <circle cx="60" cy="50" r="5" fill="#4f46e5" />
        <rect x="48" y="60" width="24" height="3" rx="1" fill="#94A3B8" />
      </svg>
    ),
  },
  {
    type: "testimonial-grid",
    label: "Testimonials — Grid",
    category: "Social Proof",
    defaultProps: (): TestimonialGridBlockProps => ({
      eyebrow: "Customer Stories",
      headline: "Trusted by the best marketing teams",
      subheadline: "See how high-growth companies are scaling their campaign execution without engineering bottlenecks.",
      bgColor: "#F8FAFC",
      textColor: "#0F172A",
      accentColor: "#4f46e5",
      testimonials: [
        { id: "1", quote: "It cut our campaign launch time from weeks to hours. Easily the highest leverage tool in our growth stack right now.", author: "Sarah Jenkins", role: "VP Growth", company: "Acme Corp", rating: 5, avatarInitials: "SJ" },
        { id: "2", quote: "Finally, a landing page builder that doesn't feel like a toy. The design constraints actually make us faster, and the conversion rates speak for themselves.", author: "David Chen", role: "Head of Demand Gen", company: "Nexus", rating: 5, avatarInitials: "DC" },
        { id: "3", quote: "We've scaled our personalized ABM pages to 500+ without hiring a single developer. The ROI was positive in month one.", author: "Emily Rodriguez", role: "Marketing Dir", company: "CloudScale", rating: 5, avatarInitials: "ER" },
        { id: "4", quote: "The built-in testing and analytics are a game-changer. We've seen a 34% lift in form completions across all our core campaigns.", author: "Marcus Thorne", role: "Co-founder", company: "Outbound", rating: 5, avatarInitials: "MT" },
        { id: "5", quote: "It's the first time our design team is actually happy with the output of a visual builder. Everything stays rigorously on-brand.", author: "Jessica Lin", role: "Brand Lead", company: "Vela", rating: 5, avatarInitials: "JL" },
        { id: "6", quote: "Incredible speed. We spun up an entire conference registration hub in two days. Highly recommended for any serious marketing org.", author: "Tom Barton", role: "CMO", company: "TechStars", rating: 5, avatarInitials: "TB" },
      ],
      showCta: true,
      ctaEyebrow: "Join them",
      ctaHeading: "Ready to move faster?",
      ctaSubheading: "Join thousands of teams shipping better pages today.",
      ctaPrimaryLabel: "Start building for free",
      ctaPrimaryUrl: "#",
      ctaSecondaryLabel: "Book a demo",
      ctaSecondaryUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#F8FAFC" rx="4" stroke="#E5E7EB" />
        <rect x="42" y="7" width="36" height="3" rx="1" fill="#0F172A" />
        {[0, 1, 2].map((c) => (
          <g key={c} transform={`translate(${10 + c * 36}, 16)`}>
            <rect width="32" height="22" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
            <rect x="4" y="4" width="14" height="2" rx="1" fill="#f59e0b" />
            <rect x="4" y="9" width="24" height="2" rx="1" fill="#94A3B8" />
            <circle cx="7" cy="17" r="2.5" fill="#EEF0FF" />
            <rect x="12" y="16" width="14" height="2" rx="1" fill="#94A3B8" />
          </g>
        ))}
        {[0, 1, 2].map((c) => (
          <g key={`b${c}`} transform={`translate(${10 + c * 36}, 42)`}>
            <rect width="32" height="20" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
            <rect x="4" y="4" width="14" height="2" rx="1" fill="#f59e0b" />
            <rect x="4" y="9" width="24" height="2" rx="1" fill="#94A3B8" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "content-series" as const,
    label: "Content Series",
    category: "Events" as BlockCategory,
    defaultProps: (): ContentSeriesBlockProps => ({
      seriesType: "podcast",
      seriesTitle: "The Margin Line",
      seriesSubtitle: "Conversations with the leaders reshaping dentistry — from the operatory to the boardroom.",
      navLinks: [
        { label: "Episodes", href: "#episodes" },
        { label: "Guests", href: "#guests" },
        { label: "About", href: "#about" },
        { label: "Subscribe", href: "#subscribe" },
      ],
      navCtaText: "Listen Now",
      navCtaUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
      navSecondaryCtaText: "Apply to be a Guest",
      navSecondaryCtaUrl: "#apply",
      heroLayout: "half-bleed",
      heroEyebrow: "NEW EPISODE",
      heroImageUrl: "/images/margin-line-cover.webp",
      heroEpisodeTitle: "The Future of Digital Dentistry",
      heroEpisodeDescription: "Dr. Sarah Chen shares her journey from a single-chair practice to a 15-location DSO — and how digital workflows transformed her margins, her team, and her patient outcomes.",
      heroGuestName: "Dr. Sarah Chen",
      heroGuestTitle: "CEO & Founder, Apex Dental Partners",
      heroCtaText: "Listen Now",
      heroCtaUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
      heroSourceMode: "auto",
      episodes: [
        {
          title: "The Future of Digital Dentistry",
          guestName: "Dr. Sarah Chen",
          guestTitle: "CEO",
          guestCompany: "Apex Dental Partners",
          description: "How digital workflows are transforming margins, teams, and patient outcomes across multi-location practices.",
          publishDate: "2025-04-28",
          ctaUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
          ctaText: "Listen",
          applePodcastsUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
          spotifyUrl: "",
          youtubeUrl: "",
          isFeatured: true,
          status: "on-demand" as const,
        },
        {
          title: "Scaling Without Losing Your Culture",
          guestName: "Marcus Williams",
          guestTitle: "COO",
          guestCompany: "Bright Smile Group",
          description: "Practical frameworks for maintaining clinical quality and team engagement as you grow from 5 to 50 locations.",
          publishDate: "2025-04-14",
          ctaUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
          ctaText: "Listen",
          applePodcastsUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
          status: "on-demand" as const,
        },
        {
          title: "What PE Gets Wrong About Dentistry",
          guestName: "Rachel Torres",
          guestTitle: "Managing Partner",
          guestCompany: "Clearview Capital",
          description: "An inside look at what private equity partners actually evaluate when acquiring dental groups — and the metrics most operators overlook.",
          publishDate: "2025-03-31",
          ctaUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
          ctaText: "Listen",
          applePodcastsUrl: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971",
          status: "on-demand" as const,
        },
      ],
      hosts: [
        {
          name: "The Margin Line Team",
          title: "Host",
          company: "Dandy",
          bio: "Conversations with the leaders who are reshaping how dental care is delivered, managed, and scaled.",
        },
      ],
      aboutHeadline: "About The Margin Line",
      aboutDescription: "The Margin Line is a podcast for dental leaders who think beyond the chair. Each episode features candid conversations with the founders, operators, and investors building the future of dentistry — from clinical innovation to operational scale.",
      aboutAudience: "DSO executives, practice owners, dental entrepreneurs, and industry leaders.",
      aboutTopics: ["Growth strategy", "Digital workflows", "M&A and private equity", "Clinical innovation", "Team culture", "Operational excellence"],
      ctaSectionHeadline: "Never Miss an Episode",
      ctaSectionSubheadline: "Subscribe to get an alert the moment a new episode drops — or follow along wherever you enjoy your podcasts.",
      ctas: [
        { label: "Apple Podcasts", url: "https://podcasts.apple.com/us/podcast/the-margin-line/id1853120971", variant: "primary" },
        { label: "Spotify", url: "https://open.spotify.com/", variant: "outline" },
        { label: "YouTube", url: "https://www.youtube.com/", variant: "outline" },
      ],
      formEyebrow: "Be a Guest",
      formHeadline: "Share Your Story",
      formSubheadline: "Know a leader reshaping dentistry? Nominate them — or yourself — for a future episode.",
      formSteps: [
        {
          title: "Guest Application",
          fields: [
            { id: "first_name", type: "text", label: "First Name", placeholder: "Jane", required: true },
            { id: "last_name", type: "text", label: "Last Name", placeholder: "Smith", required: true },
            { id: "email", type: "email", label: "Email", placeholder: "jane@example.com", required: true },
            { id: "company", type: "text", label: "Company / Practice", placeholder: "Apex Dental Partners", required: true },
            { id: "title", type: "text", label: "Title / Role", placeholder: "CEO", required: false },
            { id: "topic", type: "textarea", label: "What would you like to discuss?", placeholder: "Share the topics or stories you'd bring to the show…", required: false },
          ],
        },
      ],
      formSubmitUrl: "",
      formSuccessMessage: "Thank you! We'll be in touch about featuring you on the show.",
      formButtonLabel: "Apply to be a Guest",
      subscribeEnabled: true,
      subscribePlaceholder: "your@email.com",
      subscribeButtonLabel: "Subscribe",
      subscribeSuccessMessage: "You're in. Watch your inbox for the next episode.",
      subscribeShowInCta: false,
      subscribeFormEyebrow: "Stay in the Loop",
      subscribeFormHeadline: "Never Miss an Episode",
      subscribeFormSubheadline: "Drop your email and we'll send each new episode straight to your inbox.",
      subscribeFormSteps: [
        {
          title: "Subscribe",
          fields: [
            { id: "email", type: "email", label: "Email", placeholder: "your@email.com", required: true },
            { id: "first_name", type: "text", label: "First Name", placeholder: "Jane", required: false },
          ],
        },
      ],
      rssFeedUrl: "",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#0c0f12" rx="4" />
        <rect x="10" y="8" width="44" height="6" rx="2" fill="#b59a6e" />
        <rect x="10" y="18" width="60" height="3" rx="1" fill="#eeeae3" opacity="0.7" />
        <rect x="10" y="28" width="45" height="10" rx="3" fill="#141619" stroke="#262a2f" strokeWidth="0.5" />
        <circle cx="16" cy="33" r="3" fill="#b59a6e" opacity="0.6" />
        <rect x="22" y="31" width="28" height="2" rx="1" fill="#eeeae3" opacity="0.5" />
        <rect x="22" y="35" width="18" height="1.5" rx="0.5" fill="#7a8088" />
        <rect x="10" y="42" width="45" height="10" rx="3" fill="#141619" stroke="#262a2f" strokeWidth="0.5" />
        <circle cx="16" cy="47" r="3" fill="#b59a6e" opacity="0.6" />
        <rect x="22" y="45" width="28" height="2" rx="1" fill="#eeeae3" opacity="0.5" />
        <rect x="22" y="49" width="18" height="1.5" rx="0.5" fill="#7a8088" />
        <rect x="10" y="56" width="45" height="10" rx="3" fill="#141619" stroke="#262a2f" strokeWidth="0.5" />
        <circle cx="16" cy="61" r="3" fill="#b59a6e" opacity="0.6" />
        <rect x="22" y="59" width="28" height="2" rx="1" fill="#eeeae3" opacity="0.5" />
        <rect x="22" y="63" width="18" height="1.5" rx="0.5" fill="#7a8088" />
        <rect x="70" y="10" width="40" height="50" rx="4" fill="#141619" stroke="#262a2f" strokeWidth="0.5" />
        <rect x="76" y="16" width="28" height="16" rx="2" fill="#b59a6e" opacity="0.15" />
        <rect x="76" y="36" width="28" height="3" rx="1" fill="#eeeae3" opacity="0.6" />
        <rect x="76" y="42" width="20" height="2" rx="0.5" fill="#7a8088" />
        <rect x="76" y="48" width="28" height="8" rx="2" fill="#b59a6e" />
      </svg>
    ),
  },
  {
    type: "blog-series" as const,
    label: "Blog Series",
    category: "Events" as BlockCategory,
    defaultProps: (): BlogSeriesBlockProps => ({
      wordmark: "The Margin",
      navLinks: [
        { label: "The Series", href: "#top" },
        { label: "Archive", href: "#archive" },
        { label: "Topics", href: "#topics" },
        { label: "Contributors", href: "#contributors" },
      ],
      navCtaText: "Subscribe",
      navCtaUrl: "#subscribe",
      heroEyebrow: "A Series on Attention",
      heroHeadline: "Writing for people who",
      heroHeadlineAccent: "still read closely.",
      heroDeck:
        "A quarterly editorial series on craft, design, and the technology of attention — long essays, field notes, and the occasional quiet argument, published by the studio behind The Margin.",
      heroCtaText: "Start reading",
      heroCtaUrl: "#archive",
      heroMetaLeft: "Issue 04",
      heroMetaRight: "12 min read",
      heroImageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
      heroCaptionLabel: "In this issue",
      heroCaptionText: "Six essays · Three contributors",
      archiveEyebrow: "Latest from the archive",
      archiveLinkText: "View all 110 essays",
      archiveLinkUrl: "#",
      featuredBadge: "Featured Essay",
      featuredArticle: {
        category: "Research",
        title: "The slow web: what we lose when everything loads instantly",
        excerpt:
          "Speed became the only metric that mattered. We spent a year studying readers who deliberately chose friction — and found something the analytics never showed us.",
        author: "Mara Velasquez",
        avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80",
        date: "March 4",
        readTime: "14 min",
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80",
        href: "#",
      },
      articles: [
        { category: "Design", title: "Designing for the second read", excerpt: "How layout, rhythm, and restraint change what a returning reader notices the next time around.", author: "Jonas Auclair", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80", date: "Feb 27", readTime: "8 min", imageUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80", href: "#" },
        { category: "Engineering", title: "Building tools that stay out of the way", excerpt: "The quiet discipline of subtraction, and why our best feature this quarter was the one we removed.", author: "Priya Nair", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80", date: "Feb 21", readTime: "11 min", imageUrl: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=600&q=80", href: "#" },
        { category: "Craft", title: "Ink, paper, and the case for friction", excerpt: "A short study of why analog rituals keep returning to the most digital teams we know.", author: "Mara Velasquez", avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80", date: "Feb 14", readTime: "6 min", imageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80", href: "#" },
        { category: "Culture", title: "The empty room as a design brief", excerpt: "What gallery spaces taught us about negative space, attention, and the courage to leave things out.", author: "Jonas Auclair", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80", date: "Feb 9", readTime: "9 min", imageUrl: "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?auto=format&fit=crop&w=600&q=80", href: "#" },
        { category: "Field Notes", title: "Notes from a month without dashboards", excerpt: "We turned off the metrics and ran the studio on intuition. Here is what broke, and what didn't.", author: "Priya Nair", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80", date: "Feb 2", readTime: "7 min", imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80", href: "#" },
        { category: "Craft", title: "Letterpress lessons for the screen", excerpt: "Constraints of the press, reimagined for typography that has to survive any device.", author: "Mara Velasquez", avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80", date: "Jan 28", readTime: "10 min", imageUrl: "https://images.unsplash.com/photo-1503551723145-6c040742065b?auto=format&fit=crop&w=600&q=80", href: "#" },
      ],
      topicsEyebrow: "Browse",
      topicsHeadline: "Read by topic",
      topicsDescription: "Every essay is filed under a theme we keep returning to. Pick a thread and follow it.",
      topics: [
        { label: "Design", count: 24 },
        { label: "Engineering", count: 31 },
        { label: "Culture", count: 18 },
        { label: "Research", count: 12 },
        { label: "Craft", count: 9 },
        { label: "Field Notes", count: 16 },
      ],
      contributorsEyebrow: "The contributors",
      contributors: [
        { name: "Mara Velasquez", role: "Editor in Chief", bio: "Writes about attention, craft, and the slow web. Previously design editor at a publication you've probably read on a train.", avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80", twitterUrl: "#", linkedinUrl: "#", websiteUrl: "#" },
        { name: "Jonas Auclair", role: "Design Correspondent", bio: "Studies the spaces between things — typographic, architectural, and otherwise. Believes good layout is an act of generosity.", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80", twitterUrl: "#", linkedinUrl: "#", websiteUrl: "#" },
        { name: "Priya Nair", role: "Engineering at Large", bio: "Builds the quiet infrastructure behind the words. Has strong, well-reasoned opinions about footnotes and load times.", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80", twitterUrl: "#", linkedinUrl: "#", websiteUrl: "#" },
      ],
      subscribeEyebrow: "The Margin Letter",
      subscribeHeadline: "One considered essay,",
      subscribeHeadlineAccent: "every other Sunday.",
      subscribeDescription: "Join 38,000 readers who get the full series in their inbox — no tracking pixels, no growth hacks, just the writing.",
      subscribePlaceholder: "you@example.com",
      subscribeButtonLabel: "Subscribe free",
      subscribeDisclaimer: "Unsubscribe in one click. We'll never share your address.",
      subscribeSubmitUrl: "/api/lp/leads",
      subscribeSuccessMessage: "You're in. Watch your inbox.",
      footerTagline: "An editorial series on craft, design, and attention. Published quarterly since 2019.",
      footerColumns: [
        { heading: "Read", links: [ { label: "Latest", href: "#" }, { label: "Archive", href: "#archive" }, { label: "Topics", href: "#topics" }, { label: "Issue 04", href: "#" } ] },
        { heading: "About", links: [ { label: "The Studio", href: "#" }, { label: "Contributors", href: "#contributors" }, { label: "Ethics", href: "#" }, { label: "Contact", href: "#" } ] },
        { heading: "Follow", links: [ { label: "Newsletter", href: "#subscribe" }, { label: "Twitter", href: "#" }, { label: "LinkedIn", href: "#" }, { label: "RSS", href: "#" } ] },
      ],
      footerCopyright: "© 2025 The Margin Editorial. All rights reserved.",
      footerLegalLinks: [ { label: "Privacy", href: "#" }, { label: "Terms", href: "#" }, { label: "Colophon", href: "#" } ],
      showNav: true,
      showHero: true,
      showArchive: true,
      showTopics: true,
      showContributors: true,
      showSubscribe: true,
      showFooter: true,
      theme: { paper: "#f6f3ec", paper2: "#efeae0", ink: "#1c1a16", inkSoft: "#4a463f", muted: "#8b857a", line: "#d9d3c6", accent: "#b5491f", accentSoft: "#cf6a3e", displayFontFamily: "Fraunces", bodyFontFamily: "Inter" },
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f6f3ec" rx="4" />
        <rect x="10" y="8" width="34" height="6" rx="2" fill="#1c1a16" />
        <rect x="10" y="20" width="58" height="3" rx="1" fill="#4a463f" opacity="0.7" />
        <rect x="10" y="26" width="46" height="3" rx="1" fill="#b5491f" />
        <rect x="10" y="38" width="48" height="24" rx="3" fill="#efeae0" stroke="#d9d3c6" strokeWidth="0.5" />
        <rect x="14" y="42" width="40" height="11" rx="2" fill="#d9d3c6" />
        <rect x="14" y="56" width="24" height="2.5" rx="1" fill="#1c1a16" opacity="0.7" />
        <rect x="66" y="38" width="44" height="24" rx="3" fill="#efeae0" stroke="#d9d3c6" strokeWidth="0.5" />
        <rect x="70" y="42" width="36" height="11" rx="2" fill="#d9d3c6" />
        <rect x="70" y="56" width="20" height="2.5" rx="1" fill="#1c1a16" opacity="0.7" />
      </svg>
    ),
  },
  {
    type: "storefront" as const,
    label: "Storefront / Shop",
    category: "Showcase" as BlockCategory,
    defaultProps: (): StorefrontBlockProps => ({
      brandName: "Meridian Coffee Co.",
      showAnnouncement: true,
      showNav: true,
      showHero: true,
      showValueProps: true,
      showCollections: true,
      showSocialProof: true,
      showClosingCta: true,
      showFooter: true,
      showNewsletter: true,
      announcementText: "Free carbon-neutral shipping on orders over $50",
      announcementSecondaryText: "Roasted to order, shipped within 24 hours",
      navLinks: [
        { label: "Shop", href: "#shop" },
        { label: "Collections", href: "#collections" },
        { label: "Our Story", href: "#story" },
        { label: "Reviews", href: "#reviews" },
      ],
      navCtaText: "Shop coffee",
      navCtaUrl: "#shop",
      cartCount: 3,
      heroEyebrow: "Flagship Roast",
      heroTitle: "Midnight Reserve.",
      heroDescription: "A slow, small-batch dark roast with notes of dark chocolate, fig, and toasted hazelnut. Roasted to order, never sitting on a shelf.",
      heroRating: 4.9,
      heroReviewCount: 412,
      heroPrice: "$22",
      heroComparePrice: "$26",
      heroImageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80",
      heroVariantLabel: "Grind",
      heroVariants: [ { label: "Whole bean" }, { label: "Espresso" }, { label: "Pour over" }, { label: "French press" } ],
      heroAddToCartLabel: "Add to cart",
      heroAddToCartUrl: "#shop",
      heroBuyNowLabel: "Buy now",
      heroBuyNowUrl: "#checkout",
      heroCardLabel: "Roasted",
      heroCardValue: "Within 24 hours",
      heroTrustBadges: [ { icon: "returns", text: "Free 30-day returns" }, { icon: "shield", text: "Secure checkout" }, { icon: "leaf", text: "Ethically sourced" } ],
      valueProps: [
        { icon: "leaf", title: "Single-origin", description: "Traceable, ethically sourced beans" },
        { icon: "coffee", title: "Roasted to order", description: "Never sits on a shelf" },
        { icon: "truck", title: "Carbon-neutral shipping", description: "Free over $50" },
        { icon: "returns", title: "Easy returns", description: "30-day happiness guarantee" },
      ],
      collections: [
        { eyebrow: "Subscribe & save", title: "The Coffee Club", description: "Fresh beans on your schedule. Pause or cancel anytime. Save 15% on every bag.", ctaLabel: "Start your subscription", ctaUrl: "#shop", variant: "dark", imageUrl: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80" },
        { eyebrow: "Limited release", title: "Ethiopia Yirgacheffe", description: "Bright, floral, and citrus-forward. Only 200 bags roasted this season.", ctaLabel: "Explore collection", ctaUrl: "#shop", variant: "accent", imageUrl: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80" },
      ],
      productsEyebrow: "Shop the catalog",
      productsHeadline: "Featured roasts",
      productAddToCartLabel: "Add to cart",
      productFilters: ["All", "Dark", "Medium", "Light", "Decaf", "Bundles"],
      products: [
        { name: "Midnight Reserve", category: "Dark roast", price: "$22", comparePrice: "$26", rating: 4.9, reviewCount: 412, tag: "Bestseller", href: "#", imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80" },
        { name: "Sunrise Blend", category: "Medium roast", price: "$20", rating: 4.8, reviewCount: 286, href: "#", imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80" },
        { name: "Ethiopia Yirgacheffe", category: "Light roast", price: "$24", rating: 5.0, reviewCount: 134, tag: "New", href: "#", imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=600&q=80" },
        { name: "Decaf Nightcap", category: "Swiss water decaf", price: "$21", rating: 4.7, reviewCount: 98, href: "#", imageUrl: "https://images.unsplash.com/photo-1521302200778-33500795e128?auto=format&fit=crop&w=600&q=80" },
      ],
      pressLogos: ["Bon Appétit", "Sprudge", "Food & Wine", "Eater", "The Kitchn", "Imbibe"],
      reviewsHeadline: "Loved cup after cup",
      reviewsSummaryText: "Rated excellent by 11,400+ verified coffee drinkers",
      reviewsAggregateRating: 4.9,
      reviews: [
        { name: "Jordan M.", location: "Portland, OR", quote: "The freshest coffee I've ever had delivered. You can taste the difference when it's roasted to order — Midnight Reserve is unreal.", rating: 5, avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80" },
        { name: "Priya S.", location: "Austin, TX", quote: "Switched my whole office to the Coffee Club subscription. Shipping is fast, packaging is gorgeous, and the beans are consistently excellent.", rating: 5, avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80" },
        { name: "Marcus T.", location: "Brooklyn, NY", quote: "The Ethiopia Yirgacheffe is bright and floral without being acidic. Easily my favorite light roast — I re-order every month.", rating: 5, avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80" },
      ],
      bundleEyebrow: "Best value",
      bundleTitle: "The Morning Kit",
      bundleDescription: "Two of our most-loved roasts plus a handmade stoneware mug. Everything you need for a better morning ritual — bundled and discounted.",
      bundlePrice: "$48",
      bundleComparePrice: "$64",
      bundleSaveLabel: "Save 25%",
      bundleCtaLabel: "Add bundle to cart",
      bundleCtaUrl: "#shop",
      bundleImageUrl: "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=1000&q=80",
      bundleGuarantees: [ { icon: "shield", text: "100% satisfaction guarantee" }, { icon: "returns", text: "Free returns" } ],
      footerColumns: [
        { heading: "Shop", links: [ { label: "All coffee", href: "#shop" }, { label: "Subscriptions", href: "#shop" }, { label: "Bundles", href: "#shop" }, { label: "Gift cards", href: "#shop" } ] },
        { heading: "Company", links: [ { label: "Our story", href: "#story" }, { label: "Sourcing", href: "#" }, { label: "Sustainability", href: "#" }, { label: "Careers", href: "#" } ] },
        { heading: "Support", links: [ { label: "Contact", href: "#" }, { label: "Shipping", href: "#" }, { label: "Returns", href: "#" }, { label: "Brew guides", href: "#" } ] },
      ],
      footerTagline: "Small-batch coffee, roasted to order and shipped within 24 hours. Better mornings, one cup at a time.",
      footerCopyright: "© 2025 Meridian Coffee Co. All rights reserved.",
      paymentIcons: ["VISA", "MC", "AMEX", "PayPal", "GPay"],
      footerLegalLinks: [ { label: "Privacy", href: "#" }, { label: "Terms", href: "#" } ],
      newsletterHeading: "Join the club",
      newsletterSubtext: "Get 10% off your first order + brewing tips.",
      newsletterPlaceholder: "you@email.com",
      newsletterButtonLabel: "Subscribe",
      newsletterSubmitUrl: "/api/lp/leads",
      newsletterSuccessMessage: "You're in. Watch your inbox.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f6f3ec" rx="4" />
        <rect x="0" y="0" width="120" height="6" fill="#b5491f" />
        <rect x="10" y="12" width="40" height="38" rx="3" fill="#e7e0d4" />
        <rect x="56" y="14" width="30" height="4" rx="1" fill="#b5491f" />
        <rect x="56" y="22" width="48" height="3" rx="1" fill="#1c1a16" opacity="0.7" />
        <rect x="56" y="28" width="44" height="2.5" rx="1" fill="#4a463f" opacity="0.5" />
        <rect x="56" y="38" width="22" height="9" rx="2" fill="#1c1a16" />
        <rect x="10" y="56" width="22" height="9" rx="2" fill="#e7e0d4" />
        <rect x="40" y="56" width="22" height="9" rx="2" fill="#e7e0d4" />
        <rect x="70" y="56" width="22" height="9" rx="2" fill="#e7e0d4" />
      </svg>
    ),
  },
  {
    type: "custom-schema",
    label: "Schema-Based Custom Block",
    category: "Grid Pieces",
    defaultProps: (): CustomSchemaBlockProps => ({ schema: [], template: "", values: {} }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#fef3c7" rx="4" />
        <rect x="14" y="14" width="92" height="6" rx="2" fill="#92400e" />
        <rect x="14" y="26" width="92" height="4" rx="1" fill="#b45309" opacity="0.5" />
        <rect x="14" y="36" width="70" height="4" rx="1" fill="#b45309" opacity="0.5" />
        <rect x="14" y="46" width="40" height="10" rx="2" fill="#f59e0b" />
      </svg>
    ),
  },
  {
    type: "event-noir" as const,
    label: "Event — Editorial Noir",
    category: "Events" as BlockCategory,
    defaultProps: (): EventNoirBlockProps => eventPageDefaults("noir"),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#0b0b0d" rx="4" />
        <rect x="8" y="8" width="40" height="4" rx="1" fill="#f4f4f5" />
        <rect x="8" y="18" width="64" height="6" rx="1" fill="#f4f4f5" />
        <rect x="8" y="28" width="52" height="6" rx="1" fill="#f4f4f5" />
        <rect x="8" y="44" width="30" height="3" rx="1" fill="#c9a86a" />
        <rect x="8" y="58" width="22" height="14" rx="1" fill="#151517" />
        <rect x="36" y="58" width="22" height="14" rx="1" fill="#151517" />
        <rect x="64" y="58" width="22" height="14" rx="1" fill="#151517" />
        <rect x="92" y="58" width="22" height="14" rx="1" fill="#c9a86a" />
      </svg>
    ),
  },
  {
    type: "event-luminous" as const,
    label: "Event — Luminous Minimal",
    category: "Events" as BlockCategory,
    defaultProps: (): EventLuminousBlockProps => eventPageDefaults("luminous"),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#fafaf8" rx="4" />
        <rect x="44" y="12" width="32" height="3" rx="1" fill="#4f46e5" />
        <rect x="30" y="22" width="60" height="6" rx="3" fill="#18181b" />
        <rect x="38" y="32" width="44" height="4" rx="2" fill="#71717a" />
        <rect x="40" y="46" width="40" height="10" rx="5" fill="#4f46e5" />
        <rect x="14" y="64" width="28" height="10" rx="3" fill="#ffffff" stroke="#e7e5e0" />
        <rect x="46" y="64" width="28" height="10" rx="3" fill="#ffffff" stroke="#e7e5e0" />
        <rect x="78" y="64" width="28" height="10" rx="3" fill="#ffffff" stroke="#e7e5e0" />
      </svg>
    ),
  },
  {
    type: "event-split" as const,
    label: "Event — Split Conference",
    category: "Events" as BlockCategory,
    defaultProps: (): EventSplitBlockProps => eventPageDefaults("split"),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#ffffff" rx="4" />
        <rect x="0" y="0" width="60" height="80" fill="#0f172a" />
        <rect x="8" y="14" width="36" height="5" rx="1" fill="#ffffff" />
        <rect x="8" y="24" width="44" height="5" rx="1" fill="#ffffff" />
        <rect x="8" y="40" width="24" height="3" rx="1" fill="#2563eb" />
        <rect x="8" y="56" width="40" height="9" rx="2" fill="#2563eb" />
        <rect x="68" y="14" width="44" height="4" rx="1" fill="#0f172a" opacity="0.8" />
        <rect x="68" y="22" width="44" height="4" rx="1" fill="#64748b" opacity="0.5" />
        <rect x="68" y="34" width="20" height="20" rx="2" fill="#f8fafc" stroke="#e2e8f0" />
        <rect x="92" y="34" width="20" height="20" rx="2" fill="#f8fafc" stroke="#e2e8f0" />
      </svg>
    ),
  },
  {
    type: "case-metrics" as const,
    label: "Case Study — Metrics Forward",
    category: "Showcase" as BlockCategory,
    defaultProps: (): CaseMetricsBlockProps => caseStudyDefaults("metrics"),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#ffffff" rx="4" />
        <rect x="8" y="8" width="56" height="6" rx="1" fill="#0a0a0a" />
        <rect x="8" y="18" width="40" height="4" rx="1" fill="#6b7280" />
        <rect x="8" y="32" width="24" height="20" rx="2" fill="#f9fafb" stroke="#e5e7eb" />
        <rect x="36" y="32" width="24" height="20" rx="2" fill="#f9fafb" stroke="#e5e7eb" />
        <rect x="64" y="32" width="24" height="20" rx="2" fill="#16a34a" />
        <rect x="92" y="32" width="20" height="20" rx="2" fill="#f9fafb" stroke="#e5e7eb" />
        <rect x="8" y="60" width="104" height="12" rx="2" fill="#f9fafb" stroke="#e5e7eb" />
      </svg>
    ),
  },
  {
    type: "case-editorial" as const,
    label: "Case Study — Editorial Story",
    category: "Showcase" as BlockCategory,
    defaultProps: (): CaseEditorialBlockProps => caseStudyDefaults("editorial"),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#fbf9f5" rx="4" />
        <rect x="36" y="10" width="48" height="3" rx="1" fill="#b45309" />
        <rect x="22" y="18" width="76" height="7" rx="1" fill="#1c1917" />
        <rect x="30" y="30" width="60" height="4" rx="1" fill="#78716c" />
        <rect x="22" y="44" width="3" height="28" fill="#b45309" />
        <rect x="30" y="44" width="40" height="3" rx="1" fill="#1c1917" opacity="0.8" />
        <rect x="30" y="51" width="64" height="3" rx="1" fill="#78716c" opacity="0.6" />
        <rect x="30" y="58" width="58" height="3" rx="1" fill="#78716c" opacity="0.6" />
        <rect x="30" y="65" width="48" height="3" rx="1" fill="#78716c" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "case-modular" as const,
    label: "Case Study — Modular Report",
    category: "Showcase" as BlockCategory,
    defaultProps: (): CaseModularBlockProps => caseStudyDefaults("modular"),
    thumbnail: () => (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="40" height="5" rx="1" fill="#0f172a" />
        <rect x="8" y="20" width="50" height="22" rx="3" fill="#ffffff" stroke="#e2e8f0" />
        <rect x="62" y="20" width="50" height="22" rx="3" fill="#ffffff" stroke="#e2e8f0" />
        <rect x="8" y="48" width="50" height="24" rx="3" fill="#6366f1" />
        <rect x="62" y="48" width="50" height="24" rx="3" fill="#ffffff" stroke="#e2e8f0" />
        <rect x="14" y="26" width="20" height="3" rx="1" fill="#0f172a" opacity="0.7" />
        <rect x="68" y="26" width="20" height="3" rx="1" fill="#0f172a" opacity="0.7" />
      </svg>
    ),
  },
];

// Attach code-default semantic role tags to every registered block from the
// single shared DEFAULT_BLOCK_TAGS map (in @workspace/lp-template-engine), so
// the vocabulary lives in exactly one place. An author can still hard-code
// `tags` on an entry above to override the default for that block.
for (const def of BLOCK_REGISTRY) {
  if (!def.tags || def.tags.length === 0) {
    def.tags = getDefaultBlockTags(def.type);
  }
}

export function getBlockDef(type: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY.find(b => b.type === type);
}

function makeId(type: BlockType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlock(type: "magazine-hero"): Extract<PageBlock, { type: "magazine-hero" }>;
export function createBlock(type: "cinematic-video-hero"): Extract<PageBlock, { type: "cinematic-video-hero" }>;
export function createBlock(type: "aurora-gradient-hero"): Extract<PageBlock, { type: "aurora-gradient-hero" }>;
export function createBlock(type: "editorial-split-hero"): Extract<PageBlock, { type: "editorial-split-hero" }>;
export function createBlock(type: "parallax-layers-hero"): Extract<PageBlock, { type: "parallax-layers-hero" }>;
export function createBlock(type: "spotlight-glow-hero"): Extract<PageBlock, { type: "spotlight-glow-hero" }>;
export function createBlock(type: "logo-wall"): Extract<PageBlock, { type: "logo-wall" }>;
export function createBlock(type: "logo-marquee"): Extract<PageBlock, { type: "logo-marquee" }>;
export function createBlock(type: "rating-badges"): Extract<PageBlock, { type: "rating-badges" }>;
export function createBlock(type: "avatar-social-proof"): Extract<PageBlock, { type: "avatar-social-proof" }>;
export function createBlock(type: "bold-statement"): Extract<PageBlock, { type: "bold-statement" }>;
export function createBlock(type: "id-hero"): Extract<PageBlock, { type: "id-hero" }>;
export function createBlock(type: "id-marquee"): Extract<PageBlock, { type: "id-marquee" }>;
export function createBlock(type: "id-intro"): Extract<PageBlock, { type: "id-intro" }>;
export function createBlock(type: "id-cinema-pillars"): Extract<PageBlock, { type: "id-cinema-pillars" }>;
export function createBlock(type: "id-parallax-showcase"): Extract<PageBlock, { type: "id-parallax-showcase" }>;
export function createBlock(type: "id-system-flow"): Extract<PageBlock, { type: "id-system-flow" }>;
export function createBlock(type: "id-form"): Extract<PageBlock, { type: "id-form" }>;
export function createBlock(type: "id-stats"): Extract<PageBlock, { type: "id-stats" }>;
export function createBlock(type: "id-invitation"): Extract<PageBlock, { type: "id-invitation" }>;
export function createBlock(type: "id-grid"): Extract<PageBlock, { type: "id-grid" }>;
export function createBlock(type: "id-spotlight"): Extract<PageBlock, { type: "id-spotlight" }>;
export function createBlock(type: "id-reservation-pass"): Extract<PageBlock, { type: "id-reservation-pass" }>;
export function createBlock(type: "bento-showcase"): Extract<PageBlock, { type: "bento-showcase" }>;
export function createBlock(type: "gradient-pricing"): Extract<PageBlock, { type: "gradient-pricing" }>;
export function createBlock(type: "editorial-carousel"): Extract<PageBlock, { type: "editorial-carousel" }>;
export function createBlock(type: "menu-section"): Extract<PageBlock, { type: "menu-section" }>;
export function createBlock(type: "hours-location"): Extract<PageBlock, { type: "hours-location" }>;
export function createBlock(type: "before-after-gallery"): Extract<PageBlock, { type: "before-after-gallery" }>;
export function createBlock(type: "cta-centered-minimal"): Extract<PageBlock, { type: "cta-centered-minimal" }>;
export function createBlock(type: "centered-logo-nav"): Extract<PageBlock, { type: "centered-logo-nav" }>;
export function createBlock(type: "mega-menu-nav"): Extract<PageBlock, { type: "mega-menu-nav" }>;
export function createBlock(type: "minimal-nav"): Extract<PageBlock, { type: "minimal-nav" }>;
export function createBlock(type: "transparent-overlay-nav"): Extract<PageBlock, { type: "transparent-overlay-nav" }>;
export function createBlock(type: "cta-split-image"): Extract<PageBlock, { type: "cta-split-image" }>;
export function createBlock(type: "cta-stat-backed"): Extract<PageBlock, { type: "cta-stat-backed" }>;
export function createBlock(type: "cta-gradient-banner"): Extract<PageBlock, { type: "cta-gradient-banner" }>;
export function createBlock(type: "case-study-card-grid"): Extract<PageBlock, { type: "case-study-card-grid" }>;
export function createBlock(type: "case-study-logo-results-row"): Extract<PageBlock, { type: "case-study-logo-results-row" }>;
export function createBlock(type: "case-study-metric-triptych"): Extract<PageBlock, { type: "case-study-metric-triptych" }>;
export function createBlock(type: "case-study-spotlight-feature"): Extract<PageBlock, { type: "case-study-spotlight-feature" }>;
export function createBlock(type: "gallery-carousel-spotlight"): Extract<PageBlock, { type: "gallery-carousel-spotlight" }>;
export function createBlock(type: "gallery-filmstrip"): Extract<PageBlock, { type: "gallery-filmstrip" }>;
export function createBlock(type: "gallery-masonry"): Extract<PageBlock, { type: "gallery-masonry" }>;
export function createBlock(type: "gallery-split-feature"): Extract<PageBlock, { type: "gallery-split-feature" }>;
export function createBlock(type: "speaker-grid"): Extract<PageBlock, { type: "speaker-grid" }>;
export function createBlock(type: "benefits-alternating-rows"): Extract<PageBlock, { type: "benefits-alternating-rows" }>;
export function createBlock(type: "how-it-works-alternating"): Extract<PageBlock, { type: "how-it-works-alternating" }>;
export function createBlock(type: "how-it-works-numbered-bento"): Extract<PageBlock, { type: "how-it-works-numbered-bento" }>;
export function createBlock(type: "how-it-works-vertical-timeline"): Extract<PageBlock, { type: "how-it-works-vertical-timeline" }>;
export function createBlock(type: "how-it-works-horizontal-stepper"): Extract<PageBlock, { type: "how-it-works-horizontal-stepper" }>;
export function createBlock(type: "benefits-bento"): Extract<PageBlock, { type: "benefits-bento" }>;
export function createBlock(type: "features-bento-showcase"): Extract<PageBlock, { type: "features-bento-showcase" }>;
export function createBlock(type: "features-spotlight-cards"): Extract<PageBlock, { type: "features-spotlight-cards" }>;
export function createBlock(type: "features-tabbed-categories"): Extract<PageBlock, { type: "features-tabbed-categories" }>;
export function createBlock(type: "features-comparison-checklist"): Extract<PageBlock, { type: "features-comparison-checklist" }>;
export function createBlock(type: "benefits-icon-grid"): Extract<PageBlock, { type: "benefits-icon-grid" }>;
export function createBlock(type: "benefits-stat-led"): Extract<PageBlock, { type: "benefits-stat-led" }>;
export function createBlock(type: "quote-carousel"): Extract<PageBlock, { type: "quote-carousel" }>;
export function createBlock(type: "quote-library"): Extract<PageBlock, { type: "quote-library" }>;
export function createBlock(type: "quote-with-image"): Extract<PageBlock, { type: "quote-with-image" }>;
export function createBlock(type: "single-quote"): Extract<PageBlock, { type: "single-quote" }>;
export function createBlock(type: "testimonial-grid"): Extract<PageBlock, { type: "testimonial-grid" }>;
export function createBlock(type: "section"): Extract<PageBlock, { type: "section" }>;
export function createBlock(type: "columns"): Extract<PageBlock, { type: "columns" }>;
export function createBlock(type: "grid"): Extract<PageBlock, { type: "grid" }>;
export function createBlock(type: "stack"): Extract<PageBlock, { type: "stack" }>;
export function createBlock(type: "hero"): Extract<PageBlock, { type: "hero" }>;
export function createBlock(type: "trust-bar"): Extract<PageBlock, { type: "trust-bar" }>;
export function createBlock(type: "pas-section"): Extract<PageBlock, { type: "pas-section" }>;
export function createBlock(type: "comparison"): Extract<PageBlock, { type: "comparison" }>;
export function createBlock(type: "stat-callout"): Extract<PageBlock, { type: "stat-callout" }>;
export function createBlock(type: "benefits-grid"): Extract<PageBlock, { type: "benefits-grid" }>;
export function createBlock(type: "testimonial"): Extract<PageBlock, { type: "testimonial" }>;
export function createBlock(type: "how-it-works"): Extract<PageBlock, { type: "how-it-works" }>;
export function createBlock(type: "product-grid"): Extract<PageBlock, { type: "product-grid" }>;
export function createBlock(type: "photo-strip"): Extract<PageBlock, { type: "photo-strip" }>;
export function createBlock(type: "bottom-cta"): Extract<PageBlock, { type: "bottom-cta" }>;
export function createBlock(type: "video-section"): Extract<PageBlock, { type: "video-section" }>;
export function createBlock(type: "media-feature-reel"): Extract<PageBlock, { type: "media-feature-reel" }>;
export function createBlock(type: "media-looping-showcase"): Extract<PageBlock, { type: "media-looping-showcase" }>;
export function createBlock(type: "media-thumbnail-grid"): Extract<PageBlock, { type: "media-thumbnail-grid" }>;
export function createBlock(type: "media-video-split"): Extract<PageBlock, { type: "media-video-split" }>;
export function createBlock(type: "case-studies"): Extract<PageBlock, { type: "case-studies" }>;
export function createBlock(type: "resources"): Extract<PageBlock, { type: "resources" }>;
export function createBlock(type: "rich-text"): Extract<PageBlock, { type: "rich-text" }>;
export function createBlock(type: "custom-html"): Extract<PageBlock, { type: "custom-html" }>;
export function createBlock(type: "grid-image"): Extract<PageBlock, { type: "grid-image" }>;
export function createBlock(type: "grid-headline-sub"): Extract<PageBlock, { type: "grid-headline-sub" }>;
export function createBlock(type: "grid-paragraph-bullets"): Extract<PageBlock, { type: "grid-paragraph-bullets" }>;
export function createBlock(type: "grid-headline-paragraph"): Extract<PageBlock, { type: "grid-headline-paragraph" }>;
export function createBlock(type: "grid-icon-feature"): Extract<PageBlock, { type: "grid-icon-feature" }>;
export function createBlock(type: "grid-stat"): Extract<PageBlock, { type: "grid-stat" }>;
export function createBlock(type: "grid-quote"): Extract<PageBlock, { type: "grid-quote" }>;
export function createBlock(type: "grid-cta-tile"): Extract<PageBlock, { type: "grid-cta-tile" }>;
export function createBlock(type: "grid-logo"): Extract<PageBlock, { type: "grid-logo" }>;
export function createBlock(type: "grid-video"): Extract<PageBlock, { type: "grid-video" }>;
export function createBlock(type: "custom-schema"): Extract<PageBlock, { type: "custom-schema" }>;
export function createBlock(type: "zigzag-features"): Extract<PageBlock, { type: "zigzag-features" }>;
export function createBlock(type: "product-showcase"): Extract<PageBlock, { type: "product-showcase" }>;
export function createBlock(type: "nav-header"): Extract<PageBlock, { type: "nav-header" }>;
export function createBlock(type: "cta-button"): Extract<PageBlock, { type: "cta-button" }>;
export function createBlock(type: "full-bleed-hero"): Extract<PageBlock, { type: "full-bleed-hero" }>;
export function createBlock(type: "parallax-image-hero"): Extract<PageBlock, { type: "parallax-image-hero" }>;
export function createBlock(type: "footer"): Extract<PageBlock, { type: "footer" }>;
export function createBlock(type: "form"): Extract<PageBlock, { type: "form" }>;
export function createBlock(type: "popup"): Extract<PageBlock, { type: "popup" }>;
export function createBlock(type: "sticky-bar"): Extract<PageBlock, { type: "sticky-bar" }>;
export function createBlock(type: "sticky-header"): Extract<PageBlock, { type: "sticky-header" }>;
export function createBlock(type: "roi-calculator"): Extract<PageBlock, { type: "roi-calculator" }>;
export function createBlock(type: "spacer"): Extract<PageBlock, { type: "spacer" }>;
export function createBlock(type: "dso-insights-dashboard"): Extract<PageBlock, { type: "dso-insights-dashboard" }>;
export function createBlock(type: "dso-lab-tour"): Extract<PageBlock, { type: "dso-lab-tour" }>;
export function createBlock(type: "dso-stat-bar"): Extract<PageBlock, { type: "dso-stat-bar" }>;
export function createBlock(type: "dso-success-stories"): Extract<PageBlock, { type: "dso-success-stories" }>;
export function createBlock(type: "dso-challenges"): Extract<PageBlock, { type: "dso-challenges" }>;
export function createBlock(type: "dso-pilot-steps"): Extract<PageBlock, { type: "dso-pilot-steps" }>;
export function createBlock(type: "dso-final-cta"): Extract<PageBlock, { type: "dso-final-cta" }>;
export function createBlock(type: "dso-comparison"): Extract<PageBlock, { type: "dso-comparison" }>;
export function createBlock(type: "dso-heartland-hero"): Extract<PageBlock, { type: "dso-heartland-hero" }>;
export function createBlock(type: "dandy-product-hero"): Extract<PageBlock, { type: "dandy-product-hero" }>;
export function createBlock(type: "dso-problem"): Extract<PageBlock, { type: "dso-problem" }>;
export function createBlock(type: "dso-ai-feature"): Extract<PageBlock, { type: "dso-ai-feature" }>;
export function createBlock(type: "dso-stat-showcase"): Extract<PageBlock, { type: "dso-stat-showcase" }>;
export function createBlock(type: "dso-scroll-story"): Extract<PageBlock, { type: "dso-scroll-story" }>;
export function createBlock(type: "dso-scroll-story-hero"): Extract<PageBlock, { type: "dso-scroll-story-hero" }>;
export function createBlock(type: "dso-network-map"): Extract<PageBlock, { type: "dso-network-map" }>;
export function createBlock(type: "dso-case-flow"): Extract<PageBlock, { type: "dso-case-flow" }>;
export function createBlock(type: "dso-live-feed"): Extract<PageBlock, { type: "dso-live-feed" }>;
export function createBlock(type: "dso-particle-mesh"): Extract<PageBlock, { type: "dso-particle-mesh" }>;
export function createBlock(type: "dso-flow-canvas"): Extract<PageBlock, { type: "dso-flow-canvas" }>;
export function createBlock(type: "dso-bento-outcomes"): Extract<PageBlock, { type: "dso-bento-outcomes" }>;
export function createBlock(type: "dso-cta-capture"): Extract<PageBlock, { type: "dso-cta-capture" }>;
export function createBlock(type: "dso-meet-team"): Extract<PageBlock, { type: "dso-meet-team" }>;
export function createBlock(type: "dso-paradigm-shift"): Extract<PageBlock, { type: "dso-paradigm-shift" }>;
export function createBlock(type: "dso-partnership-perks"): Extract<PageBlock, { type: "dso-partnership-perks" }>;
export function createBlock(type: "dso-products-grid"): Extract<PageBlock, { type: "dso-products-grid" }>;
export function createBlock(type: "dso-promo-cards"): Extract<PageBlock, { type: "dso-promo-cards" }>;
export function createBlock(type: "dso-activation-steps"): Extract<PageBlock, { type: "dso-activation-steps" }>;
export function createBlock(type: "dso-promises"): Extract<PageBlock, { type: "dso-promises" }>;
export function createBlock(type: "dso-testimonials"): Extract<PageBlock, { type: "dso-testimonials" }>;
export function createBlock(type: "dso-practice-hero"): Extract<PageBlock, { type: "dso-practice-hero" }>;
export function createBlock(type: "dso-stat-row"): Extract<PageBlock, { type: "dso-stat-row" }>;
export function createBlock(type: "dso-faq"): Extract<PageBlock, { type: "dso-faq" }>;
export function createBlock(type: "dso-split-feature"): Extract<PageBlock, { type: "dso-split-feature" }>;
export function createBlock(type: "dso-software-showcase"): Extract<PageBlock, { type: "dso-software-showcase" }>;
export function createBlock(type: "dso-insights-video"): Extract<PageBlock, { type: "dso-insights-video" }>;
export function createBlock(type: "dso-case-study"): Extract<PageBlock, { type: "dso-case-study" }>;
export function createBlock(type: "dandy-versus"): Extract<PageBlock, { type: "dandy-versus" }>;
export function createBlock(type: "dandy-columns-v2"): Extract<PageBlock, { type: "dandy-columns-v2" }>;
export function createBlock(type: "dandy-columns-v3"): Extract<PageBlock, { type: "dandy-columns-v3" }>;
export function createBlock(type: "dandy-vertical-tabs"): Extract<PageBlock, { type: "dandy-vertical-tabs" }>;
export function createBlock(type: "dandy-switchback"): Extract<PageBlock, { type: "dandy-switchback" }>;
export function createBlock(type: "dandy-site-header"): Extract<PageBlock, { type: "dandy-site-header" }>;
export function createBlock(type: "dandy-site-footer"): Extract<PageBlock, { type: "dandy-site-footer" }>;
export function createBlock(type: "dandy-video-testimonials"): Extract<PageBlock, { type: "dandy-video-testimonials" }>;
export function createBlock(type: "dandy-side-image-v6"): Extract<PageBlock, { type: "dandy-side-image-v6" }>;
export function createBlock(type: "dandy-hero-v7-s3"): Extract<PageBlock, { type: "dandy-hero-v7-s3" }>;
export function createBlock(type: "dandy-form-right-alt"): Extract<PageBlock, { type: "dandy-form-right-alt" }>;
export function createBlock(type: "dandy-conversion-panel-1"): Extract<PageBlock, { type: "dandy-conversion-panel-1" }>;
export function createBlock(type: "dandy-cta-block"): Extract<PageBlock, { type: "dandy-cta-block" }>;
export function createBlock(type: "one-pager-hero"): Extract<PageBlock, { type: "one-pager-hero" }>;
export function createBlock(type: "content-series"): Extract<PageBlock, { type: "content-series" }>;
export function createBlock(type: "blog-series"): Extract<PageBlock, { type: "blog-series" }>;
export function createBlock(type: "storefront"): Extract<PageBlock, { type: "storefront" }>;
export function createBlock(type: "event-noir"): Extract<PageBlock, { type: "event-noir" }>;
export function createBlock(type: "event-luminous"): Extract<PageBlock, { type: "event-luminous" }>;
export function createBlock(type: "event-split"): Extract<PageBlock, { type: "event-split" }>;
export function createBlock(type: "case-metrics"): Extract<PageBlock, { type: "case-metrics" }>;
export function createBlock(type: "case-editorial"): Extract<PageBlock, { type: "case-editorial" }>;
export function createBlock(type: "case-modular"): Extract<PageBlock, { type: "case-modular" }>;
export function createBlock(type: "event-page"): Extract<PageBlock, { type: "event-page" }>;
export function createBlock(type: "product-launch"): Extract<PageBlock, { type: "product-launch" }>;
export function createBlock(type: "story-hub"): Extract<PageBlock, { type: "story-hub" }>;
export function createBlock(type: "event-landing-hero"): Extract<PageBlock, { type: "event-landing-hero" }>;
export function createBlock(type: "spatial-tour"): Extract<PageBlock, { type: "spatial-tour" }>;
export function createBlock(type: "business-case-split"): Extract<PageBlock, { type: "business-case-split" }>;
export function createBlock(type: "business-case-centered"): Extract<PageBlock, { type: "business-case-centered" }>;
export function createBlock(type: "business-case-premium"): Extract<PageBlock, { type: "business-case-premium" }>;
export function createBlock(type: "scroll-assembly"): Extract<PageBlock, { type: "scroll-assembly" }>;
export function createBlock(type: "horizontal-showcase"): Extract<PageBlock, { type: "horizontal-showcase" }>;
export function createBlock(type: "sticky-stack"): Extract<PageBlock, { type: "sticky-stack" }>;
export function createBlock(type: BlockType): PageBlock;
export function createBlock(type: BlockType): PageBlock {
  const def = getBlockDef(type);
  if (!def) throw new Error(`Unknown block type: ${type}`);
  const id = makeId(type);
  const props = def.defaultProps();
  switch (type) {
    case "hero": return { id, type: "hero", props: props as HeroBlockProps };
    case "trust-bar": return { id, type: "trust-bar", props: props as TrustBarBlockProps };
    case "pas-section": return { id, type: "pas-section", props: props as PasSectionBlockProps };
    case "comparison": return { id, type: "comparison", props: props as ComparisonBlockProps };
    case "stat-callout": return { id, type: "stat-callout", props: props as StatCalloutBlockProps };
    case "benefits-grid": return { id, type: "benefits-grid", props: props as BenefitsGridBlockProps };
    case "testimonial": return { id, type: "testimonial", props: props as TestimonialBlockProps };
    case "how-it-works": return { id, type: "how-it-works", props: props as HowItWorksBlockProps };
    case "product-grid": return { id, type: "product-grid", props: props as ProductGridBlockProps };
    case "photo-strip": return { id, type: "photo-strip", props: props as PhotoStripBlockProps };
    case "bottom-cta": return { id, type: "bottom-cta", props: props as BottomCtaBlockProps };
    case "video-section": return { id, type: "video-section", props: props as VideoSectionBlockProps };
    case "media-feature-reel": return { id, type: "media-feature-reel", props: props as MediaFeatureReelBlockProps };
    case "media-looping-showcase": return { id, type: "media-looping-showcase", props: props as MediaLoopingShowcaseBlockProps };
    case "media-thumbnail-grid": return { id, type: "media-thumbnail-grid", props: props as MediaThumbnailGridBlockProps };
    case "media-video-split": return { id, type: "media-video-split", props: props as MediaVideoSplitBlockProps };
    case "case-studies": return { id, type: "case-studies", props: props as CaseStudiesBlockProps };
    case "resources": return { id, type: "resources", props: props as ResourcesBlockProps };
    case "rich-text": return { id, type: "rich-text", props: props as RichTextBlockProps };
    case "custom-html": return { id, type: "custom-html", props: props as CustomHtmlBlockProps };
    case "grid-image": return { id, type: "grid-image", props: props as GridImageBlockProps };
    case "grid-headline-sub": return { id, type: "grid-headline-sub", props: props as GridHeadlineSubBlockProps };
    case "grid-paragraph-bullets": return { id, type: "grid-paragraph-bullets", props: props as GridParagraphBulletsBlockProps };
    case "grid-headline-paragraph": return { id, type: "grid-headline-paragraph", props: props as GridHeadlineParagraphBlockProps };
    case "grid-icon-feature": return { id, type: "grid-icon-feature", props: props as GridIconFeatureBlockProps };
    case "grid-stat": return { id, type: "grid-stat", props: props as GridStatBlockProps };
    case "grid-quote": return { id, type: "grid-quote", props: props as GridQuoteBlockProps };
    case "grid-cta-tile": return { id, type: "grid-cta-tile", props: props as GridCtaTileBlockProps };
    case "grid-logo": return { id, type: "grid-logo", props: props as GridLogoBlockProps };
    case "grid-video": return { id, type: "grid-video", props: props as GridVideoBlockProps };
    case "custom-schema": return { id, type: "custom-schema", props: props as CustomSchemaBlockProps };
    case "zigzag-features": return { id, type: "zigzag-features", props: props as ZigzagFeaturesBlockProps };
    case "product-showcase": return { id, type: "product-showcase", props: props as ProductShowcaseBlockProps };
    case "nav-header": return { id, type: "nav-header", props: props as NavHeaderBlockProps };
    case "cta-button": return { id, type: "cta-button", props: props as CtaButtonBlockProps };
    case "full-bleed-hero": return { id, type: "full-bleed-hero", props: props as FullBleedHeroBlockProps };
    case "parallax-image-hero": return { id, type: "parallax-image-hero", props: props as ParallaxImageHeroBlockProps };
    case "footer": return { id, type: "footer", props: props as FooterBlockProps };
    case "form": return { id, type: "form", props: props as FormBlockProps };
    case "popup": return { id, type: "popup", props: props as PopupBlockProps };
    case "sticky-bar": return { id, type: "sticky-bar", props: props as StickyBarBlockProps };
    case "sticky-header": return { id, type: "sticky-header", props: props as StickyHeaderBlockProps };
    case "roi-calculator": return { id, type: "roi-calculator", props: props as RoiCalculatorBlockProps };
    case "spacer": return { id, type: "spacer", props: props as SpacerBlockProps };
    case "dso-insights-dashboard": return { id, type: "dso-insights-dashboard", props: props as DsoInsightsDashboardBlockProps };
    case "dso-lab-tour": return { id, type: "dso-lab-tour", props: props as DsoLabTourBlockProps };
    case "dso-stat-bar": return { id, type: "dso-stat-bar", props: props as DsoStatBarBlockProps };
    case "dso-success-stories": return { id, type: "dso-success-stories", props: props as DsoSuccessStoriesBlockProps };
    case "dso-challenges": return { id, type: "dso-challenges", props: props as DsoChallengesBlockProps };
    case "dso-pilot-steps": return { id, type: "dso-pilot-steps", props: props as DsoPilotStepsBlockProps };
    case "dso-final-cta": return { id, type: "dso-final-cta", props: props as DsoFinalCtaBlockProps };
    case "dso-comparison": return { id, type: "dso-comparison", props: props as DsoComparisonBlockProps };
    case "dso-heartland-hero": return { id, type: "dso-heartland-hero", props: props as DsoHeartlandHeroBlockProps };
    case "dandy-product-hero": return { id, type: "dandy-product-hero", props: props as DandyProductHeroBlockProps };
    case "dso-problem": return { id, type: "dso-problem", props: props as DsoProblemBlockProps };
    case "dso-ai-feature": return { id, type: "dso-ai-feature", props: props as DsoAiFeatureBlockProps };
    case "dso-stat-showcase": return { id, type: "dso-stat-showcase", props: props as DsoStatShowcaseBlockProps };
    case "dso-scroll-story": return { id, type: "dso-scroll-story", props: props as DsoScrollStoryBlockProps };
    case "dso-scroll-story-hero": return { id, type: "dso-scroll-story-hero", props: props as DsoScrollStoryHeroBlockProps };
    case "dso-network-map": return { id, type: "dso-network-map", props: props as DsoNetworkMapBlockProps };
    case "dso-case-flow": return { id, type: "dso-case-flow", props: props as DsoCaseFlowBlockProps };
    case "dso-live-feed": return { id, type: "dso-live-feed", props: props as DsoLiveFeedBlockProps };
    case "dso-particle-mesh": return { id, type: "dso-particle-mesh", props: props as DsoParticleMeshBlockProps };
    case "dso-flow-canvas": return { id, type: "dso-flow-canvas", props: props as DsoFlowCanvasBlockProps };
    case "dso-bento-outcomes": return { id, type: "dso-bento-outcomes", props: props as DsoBentoOutcomesBlockProps };
    case "dso-cta-capture": return { id, type: "dso-cta-capture", props: props as DsoCtaCaptureBlockProps };
    case "dso-meet-team": return { id, type: "dso-meet-team", props: props as DsoMeetTeamBlockProps };
    case "dso-paradigm-shift": return { id, type: "dso-paradigm-shift", props: props as DsoParadigmShiftBlockProps };
    case "dso-partnership-perks": return { id, type: "dso-partnership-perks", props: props as DsoPartnershipPerksBlockProps };
    case "dso-products-grid": return { id, type: "dso-products-grid", props: props as DsoProductsGridBlockProps };
    case "dso-promo-cards": return { id, type: "dso-promo-cards", props: props as DsoPromoCardsBlockProps };
    case "dso-activation-steps": return { id, type: "dso-activation-steps", props: props as DsoActivationStepsBlockProps };
    case "dso-promises": return { id, type: "dso-promises", props: props as DsoPromisesBlockProps };
    case "dso-testimonials": return { id, type: "dso-testimonials", props: props as DsoTestimonialsBlockProps };
    case "dso-practice-nav": return { id, type: "dso-practice-nav", props: props as DsoPracticeNavBlockProps };
    case "dso-practice-hero": return { id, type: "dso-practice-hero", props: props as DsoPracticeHeroBlockProps };
    case "dso-stat-row": return { id, type: "dso-stat-row", props: props as DsoStatRowBlockProps };
    case "dso-faq": return { id, type: "dso-faq", props: props as DsoFaqBlockProps };
    case "dso-split-feature": return { id, type: "dso-split-feature", props: props as DsoSplitFeatureBlockProps };
    case "dso-software-showcase": return { id, type: "dso-software-showcase", props: props as DsoSoftwareShowcaseBlockProps };
    case "dso-insights-video": return { id, type: "dso-insights-video", props: props as DsoInsightsVideoBlockProps };
    case "dso-case-study": return { id, type: "dso-case-study", props: props as DsoCaseStudyBlockProps };
    case "dandy-versus": return { id, type: "dandy-versus", props: props as DandyVersusBlockProps };
    case "dandy-columns-v2": return { id, type: "dandy-columns-v2", props: props as DandyColumnsV2BlockProps };
    case "dandy-columns-v3": return { id, type: "dandy-columns-v3", props: props as DandyColumnsV3BlockProps };
    case "dandy-vertical-tabs": return { id, type: "dandy-vertical-tabs", props: props as DandyVerticalTabsBlockProps };
    case "dandy-switchback": return { id, type: "dandy-switchback", props: props as DandySwitchbackBlockProps };
    case "dandy-site-header": return { id, type: "dandy-site-header", props: props as DandySiteHeaderBlockProps };
    case "dandy-site-footer": return { id, type: "dandy-site-footer", props: props as DandySiteFooterBlockProps };
    case "dandy-video-testimonials": return { id, type: "dandy-video-testimonials", props: props as DandyVideoTestimonialsBlockProps };
    case "dandy-side-image-v6": return { id, type: "dandy-side-image-v6", props: props as DandySideImageV6BlockProps };
    case "dandy-hero-v7-s3": return { id, type: "dandy-hero-v7-s3", props: props as DandyHeroV7S3BlockProps };
    case "dandy-form-right-alt": return { id, type: "dandy-form-right-alt", props: props as DandyFormRightAltBlockProps };
    case "dandy-conversion-panel-1": return { id, type: "dandy-conversion-panel-1", props: props as DandyConversionPanel1BlockProps };
    case "dandy-cta-block": return { id, type: "dandy-cta-block", props: props as DandyCtaBlockProps };
    case "one-pager-hero": return { id, type: "one-pager-hero", props: props as OnePagerHeroBlockProps };
    case "event-page": return { id, type: "event-page", props: props as EventPageBlockProps };
    case "product-launch": return { id, type: "product-launch", props: props as ProductLaunchBlockProps };
    case "story-hub": return { id, type: "story-hub", props: props as StoryHubBlockProps };
    case "event-landing-hero": return { id, type: "event-landing-hero", props: props as EventLandingHeroBlockProps };
    case "spatial-tour": return { id, type: "spatial-tour", props: props as SpatialTourBlockProps };
    case "business-case-split": return { id, type: "business-case-split", props: props as BusinessCaseSplitBlockProps };
    case "business-case-centered": return { id, type: "business-case-centered", props: props as BusinessCaseCenteredBlockProps };
    case "business-case-premium": return { id, type: "business-case-premium", props: props as BusinessCasePremiumBlockProps };
    case "scroll-assembly": return { id, type: "scroll-assembly", props: props as ScrollAssemblyBlockProps };
    case "horizontal-showcase": return { id, type: "horizontal-showcase", props: props as HorizontalShowcaseBlockProps };
    case "sticky-stack": return { id, type: "sticky-stack", props: props as StickyStackBlockProps };
    case "magazine-hero": return { id, type: "magazine-hero", props: props as MagazineHeroBlockProps };
    case "cinematic-video-hero": return { id, type: "cinematic-video-hero", props: props as CinematicVideoHeroBlockProps };
    case "aurora-gradient-hero": return { id, type: "aurora-gradient-hero", props: props as AuroraGradientHeroBlockProps };
    case "editorial-split-hero": return { id, type: "editorial-split-hero", props: props as EditorialSplitHeroBlockProps };
    case "parallax-layers-hero": return { id, type: "parallax-layers-hero", props: props as ParallaxLayersHeroBlockProps };
    case "spotlight-glow-hero": return { id, type: "spotlight-glow-hero", props: props as SpotlightGlowHeroBlockProps };
    case "logo-wall": return { id, type: "logo-wall", props: props as LogoWallBlockProps };
    case "logo-marquee": return { id, type: "logo-marquee", props: props as LogoMarqueeBlockProps };
    case "rating-badges": return { id, type: "rating-badges", props: props as RatingBadgesBlockProps };
    case "avatar-social-proof": return { id, type: "avatar-social-proof", props: props as AvatarSocialProofBlockProps };
    case "bold-statement": return { id, type: "bold-statement", props: props as BoldStatementBlockProps };
    case "id-hero": return { id, type: "id-hero", props: props as IdHeroBlockProps };
    case "id-marquee": return { id, type: "id-marquee", props: props as IdMarqueeBlockProps };
    case "id-intro": return { id, type: "id-intro", props: props as IdIntroBlockProps };
    case "id-cinema-pillars": return { id, type: "id-cinema-pillars", props: props as IdCinemaPillarsBlockProps };
    case "id-parallax-showcase": return { id, type: "id-parallax-showcase", props: props as IdParallaxShowcaseBlockProps };
    case "id-system-flow": return { id, type: "id-system-flow", props: props as IdSystemFlowBlockProps };
    case "id-form": return { id, type: "id-form", props: props as IdFormBlockProps };
    case "id-stats": return { id, type: "id-stats", props: props as IdStatsBlockProps };
    case "id-invitation": return { id, type: "id-invitation", props: props as IdInvitationBlockProps };
    case "id-grid": return { id, type: "id-grid", props: props as IdGridBlockProps };
    case "id-spotlight": return { id, type: "id-spotlight", props: props as IdSpotlightBlockProps };
    case "id-reservation-pass": return { id, type: "id-reservation-pass", props: props as IdReservationPassBlockProps };
    case "bento-showcase": return { id, type: "bento-showcase", props: props as BentoShowcaseBlockProps };
    case "gradient-pricing": return { id, type: "gradient-pricing", props: props as GradientPricingBlockProps };
    case "editorial-carousel": return { id, type: "editorial-carousel", props: props as EditorialCarouselBlockProps };
    case "menu-section": return { id, type: "menu-section", props: props as MenuSectionBlockProps };
    case "hours-location": return { id, type: "hours-location", props: props as HoursLocationBlockProps };
    case "before-after-gallery": return { id, type: "before-after-gallery", props: props as BeforeAfterGalleryBlockProps };
    case "cta-centered-minimal": return { id, type: "cta-centered-minimal", props: props as CtaCenteredMinimalBlockProps };
    case "centered-logo-nav": return { id, type: "centered-logo-nav", props: props as CenteredLogoNavBlockProps };
    case "mega-menu-nav": return { id, type: "mega-menu-nav", props: props as MegaMenuNavBlockProps };
    case "minimal-nav": return { id, type: "minimal-nav", props: props as MinimalNavBlockProps };
    case "transparent-overlay-nav": return { id, type: "transparent-overlay-nav", props: props as TransparentOverlayNavBlockProps };
    case "cta-split-image": return { id, type: "cta-split-image", props: props as CtaSplitImageBlockProps };
    case "cta-stat-backed": return { id, type: "cta-stat-backed", props: props as CtaStatBackedBlockProps };
    case "cta-gradient-banner": return { id, type: "cta-gradient-banner", props: props as CtaGradientBannerBlockProps };
    case "case-study-card-grid": return { id, type: "case-study-card-grid", props: props as CaseStudyCardGridBlockProps };
    case "case-study-logo-results-row": return { id, type: "case-study-logo-results-row", props: props as CaseStudyLogoResultsRowBlockProps };
    case "case-study-metric-triptych": return { id, type: "case-study-metric-triptych", props: props as CaseStudyMetricTriptychBlockProps };
    case "case-study-spotlight-feature": return { id, type: "case-study-spotlight-feature", props: props as CaseStudySpotlightFeatureBlockProps };
    case "gallery-carousel-spotlight": return { id, type: "gallery-carousel-spotlight", props: props as GalleryCarouselSpotlightBlockProps };
    case "gallery-filmstrip": return { id, type: "gallery-filmstrip", props: props as GalleryFilmstripBlockProps };
    case "gallery-masonry": return { id, type: "gallery-masonry", props: props as GalleryMasonryBlockProps };
    case "gallery-split-feature": return { id, type: "gallery-split-feature", props: props as GallerySplitFeatureBlockProps };
    case "speaker-grid": return { id, type: "speaker-grid", props: props as SpeakerGridBlockProps };
    case "benefits-alternating-rows": return { id, type: "benefits-alternating-rows", props: props as BenefitsAlternatingRowsBlockProps };
    case "how-it-works-alternating": return { id, type: "how-it-works-alternating", props: props as HowItWorksAlternatingBlockProps };
    case "how-it-works-numbered-bento": return { id, type: "how-it-works-numbered-bento", props: props as HowItWorksNumberedBentoBlockProps };
    case "how-it-works-vertical-timeline": return { id, type: "how-it-works-vertical-timeline", props: props as HowItWorksVerticalTimelineBlockProps };
    case "how-it-works-horizontal-stepper": return { id, type: "how-it-works-horizontal-stepper", props: props as HowItWorksHorizontalStepperBlockProps };
    case "benefits-bento": return { id, type: "benefits-bento", props: props as BenefitsBentoBlockProps };
    case "features-bento-showcase": return { id, type: "features-bento-showcase", props: props as FeaturesBentoShowcaseBlockProps };
    case "features-spotlight-cards": return { id, type: "features-spotlight-cards", props: props as FeaturesSpotlightCardsBlockProps };
    case "features-tabbed-categories": return { id, type: "features-tabbed-categories", props: props as FeaturesTabbedCategoriesBlockProps };
    case "features-comparison-checklist": return { id, type: "features-comparison-checklist", props: props as FeaturesComparisonChecklistBlockProps };
    case "benefits-icon-grid": return { id, type: "benefits-icon-grid", props: props as BenefitsIconGridBlockProps };
    case "benefits-stat-led": return { id, type: "benefits-stat-led", props: props as BenefitsStatLedBlockProps };
    case "quote-carousel": return { id, type: "quote-carousel", props: props as QuoteCarouselBlockProps };
    case "quote-library": return { id, type: "quote-library", props: props as QuoteLibraryBlockProps };
    case "quote-with-image": return { id, type: "quote-with-image", props: props as QuoteWithImageBlockProps };
    case "single-quote": return { id, type: "single-quote", props: props as SingleQuoteBlockProps };
    case "testimonial-grid": return { id, type: "testimonial-grid", props: props as TestimonialGridBlockProps };
    case "content-series": return { id, type: "content-series", props: props as ContentSeriesBlockProps };
    case "blog-series": return { id, type: "blog-series", props: props as BlogSeriesBlockProps };
    case "storefront": return { id, type: "storefront", props: props as StorefrontBlockProps };
    case "event-noir": return { id, type: "event-noir", props: props as EventNoirBlockProps };
    case "event-luminous": return { id, type: "event-luminous", props: props as EventLuminousBlockProps };
    case "event-split": return { id, type: "event-split", props: props as EventSplitBlockProps };
    case "case-metrics": return { id, type: "case-metrics", props: props as CaseMetricsBlockProps };
    case "case-editorial": return { id, type: "case-editorial", props: props as CaseEditorialBlockProps };
    case "case-modular": return { id, type: "case-modular", props: props as CaseModularBlockProps };
    case "section": return { id, type: "section", props: props as SectionBlockProps, children: [] };
    case "columns": return { id, type: "columns", props: props as ColumnsBlockProps, children: [] };
    case "grid": return { id, type: "grid", props: props as GridBlockProps, children: [] };
    case "stack": return { id, type: "stack", props: props as StackBlockProps, children: [] };
  }
}

export function templateToBlocks(templateId: string): PageBlock[] {
  const templates: Record<string, BlockType[]> = {
    "video-hero": ["hero", "video-section", "trust-bar", "photo-strip", "stat-callout", "benefits-grid", "testimonial", "product-grid", "bottom-cta"],
    "problem-first": ["hero", "pas-section", "comparison", "stat-callout", "trust-bar", "benefits-grid", "testimonial", "bottom-cta"],
    "social-proof-leader": ["hero", "testimonial", "photo-strip", "stat-callout", "trust-bar", "benefits-grid", "bottom-cta"],
    "how-it-works": ["hero", "how-it-works", "trust-bar", "product-grid", "benefits-grid", "testimonial", "bottom-cta"],
    "minimal-cta": ["hero", "trust-bar"],
    "inside-dandy-event": ["event-page"],
    "inside-dandy-spatial-tour": ["spatial-tour"],
    "product-launch-keynote": ["product-launch"],
    "story-hub-dark-luxury": ["story-hub"],
    "business-case-split": ["business-case-split"],
    "business-case-centered": ["business-case-centered"],
    "business-case-premium": ["business-case-premium"],
  };
  const types = templates[templateId] ?? [];
  return types.map(t => createBlock(t));
}
