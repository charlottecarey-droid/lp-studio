import type { BlockSettings } from "./common";
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
  SpacerBlockProps,
  FormBlockProps,
  ZigzagFeaturesBlockProps,
  ProductShowcaseBlockProps,
  FooterBlockProps,
  FullBleedHeroBlockProps,
  RoiCalculatorBlockProps,
} from "./generic-blocks";
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
  DsoPracticeHeroBlockProps,
  DsoStatRowBlockProps,
  DsoFaqBlockProps,
  DsoSplitFeatureBlockProps,
  DsoSoftwareShowcaseBlockProps,
} from "./dso-blocks";
import type {
  NavHeaderBlockProps,
  CtaButtonBlockProps,
  PopupBlockProps,
  StickyBarBlockProps,
} from "./utility-blocks";

export type BlockVariant =
  | { type: "hero"; props: HeroBlockProps }
  | { type: "trust-bar"; props: TrustBarBlockProps }
  | { type: "pas-section"; props: PasSectionBlockProps }
  | { type: "comparison"; props: ComparisonBlockProps }
  | { type: "stat-callout"; props: StatCalloutBlockProps }
  | { type: "benefits-grid"; props: BenefitsGridBlockProps }
  | { type: "testimonial"; props: TestimonialBlockProps }
  | { type: "how-it-works"; props: HowItWorksBlockProps }
  | { type: "product-grid"; props: ProductGridBlockProps }
  | { type: "photo-strip"; props: PhotoStripBlockProps }
  | { type: "bottom-cta"; props: BottomCtaBlockProps }
  | { type: "video-section"; props: VideoSectionBlockProps }
  | { type: "case-studies"; props: CaseStudiesBlockProps }
  | { type: "resources"; props: ResourcesBlockProps }
  | { type: "rich-text"; props: RichTextBlockProps }
  | { type: "custom-html"; props: CustomHtmlBlockProps }
  | { type: "zigzag-features"; props: ZigzagFeaturesBlockProps }
  | { type: "product-showcase"; props: ProductShowcaseBlockProps }
  | { type: "nav-header"; props: NavHeaderBlockProps }
  | { type: "cta-button"; props: CtaButtonBlockProps }
  | { type: "full-bleed-hero"; props: FullBleedHeroBlockProps }
  | { type: "footer"; props: FooterBlockProps }
  | { type: "form"; props: FormBlockProps }
  | { type: "popup"; props: PopupBlockProps }
  | { type: "sticky-bar"; props: StickyBarBlockProps }
  | { type: "roi-calculator"; props: RoiCalculatorBlockProps }
  | { type: "spacer"; props: SpacerBlockProps }
  | { type: "dso-insights-dashboard"; props: DsoInsightsDashboardBlockProps }
  | { type: "dso-lab-tour"; props: DsoLabTourBlockProps }
  | { type: "dso-stat-bar"; props: DsoStatBarBlockProps }
  | { type: "dso-success-stories"; props: DsoSuccessStoriesBlockProps }
  | { type: "dso-challenges"; props: DsoChallengesBlockProps }
  | { type: "dso-pilot-steps"; props: DsoPilotStepsBlockProps }
  | { type: "dso-final-cta"; props: DsoFinalCtaBlockProps }
  | { type: "dso-comparison"; props: DsoComparisonBlockProps }
  | { type: "dso-heartland-hero"; props: DsoHeartlandHeroBlockProps }
  | { type: "dso-problem"; props: DsoProblemBlockProps }
  | { type: "dso-ai-feature"; props: DsoAiFeatureBlockProps }
  | { type: "dso-stat-showcase"; props: DsoStatShowcaseBlockProps }
  | { type: "dso-scroll-story"; props: DsoScrollStoryBlockProps }
  | { type: "dso-scroll-story-hero"; props: DsoScrollStoryHeroBlockProps }
  | { type: "dso-network-map"; props: DsoNetworkMapBlockProps }
  | { type: "dso-case-flow"; props: DsoCaseFlowBlockProps }
  | { type: "dso-live-feed"; props: DsoLiveFeedBlockProps }
  | { type: "dso-particle-mesh"; props: DsoParticleMeshBlockProps }
  | { type: "dso-flow-canvas"; props: DsoFlowCanvasBlockProps }
  | { type: "dso-bento-outcomes"; props: DsoBentoOutcomesBlockProps }
  | { type: "dso-cta-capture"; props: DsoCtaCaptureBlockProps }
  | { type: "dso-meet-team"; props: DsoMeetTeamBlockProps }
  | { type: "dso-paradigm-shift"; props: DsoParadigmShiftBlockProps }
  | { type: "dso-partnership-perks"; props: DsoPartnershipPerksBlockProps }
  | { type: "dso-products-grid"; props: DsoProductsGridBlockProps }
  | { type: "dso-promo-cards"; props: DsoPromoCardsBlockProps }
  | { type: "dso-activation-steps"; props: DsoActivationStepsBlockProps }
  | { type: "dso-promises"; props: DsoPromisesBlockProps }
  | { type: "dso-testimonials"; props: DsoTestimonialsBlockProps }
  | { type: "dso-practice-hero"; props: DsoPracticeHeroBlockProps }
  | { type: "dso-stat-row"; props: DsoStatRowBlockProps }
  | { type: "dso-faq"; props: DsoFaqBlockProps }
  | { type: "dso-split-feature"; props: DsoSplitFeatureBlockProps }
  | { type: "dso-software-showcase"; props: DsoSoftwareShowcaseBlockProps };

export type PageBlock = { id: string; blockSettings?: BlockSettings } & BlockVariant;

export type BlockType = PageBlock["type"];
