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
  BoldStatementBlockProps,
  IdHeroBlockProps,
  IdMarqueeBlockProps,
  IdIntroBlockProps,
  IdCinemaPillarsBlockProps,
  IdParallaxShowcaseBlockProps,
  IdStatsBlockProps,
  IdInvitationBlockProps,
  IdGridBlockProps,
  IdSpotlightBlockProps,
  BentoShowcaseBlockProps,
  GradientPricingBlockProps,
  EditorialCarouselBlockProps,
  MenuSectionBlockProps,
  HoursLocationBlockProps,
  BeforeAfterGalleryBlockProps,
  SpeakerGridBlockProps,
  ContentSeriesBlockProps,
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
  SectionBlockProps,
  ColumnsBlockProps,
  GridBlockProps,
  StackBlockProps,
} from "./container-blocks";

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
  | { type: "grid-image"; props: GridImageBlockProps }
  | { type: "grid-headline-sub"; props: GridHeadlineSubBlockProps }
  | { type: "grid-paragraph-bullets"; props: GridParagraphBulletsBlockProps }
  | { type: "grid-headline-paragraph"; props: GridHeadlineParagraphBlockProps }
  | { type: "grid-icon-feature"; props: GridIconFeatureBlockProps }
  | { type: "grid-stat"; props: GridStatBlockProps }
  | { type: "grid-quote"; props: GridQuoteBlockProps }
  | { type: "grid-cta-tile"; props: GridCtaTileBlockProps }
  | { type: "grid-logo"; props: GridLogoBlockProps }
  | { type: "grid-video"; props: GridVideoBlockProps }
  | { type: "custom-schema"; props: CustomSchemaBlockProps }
  | { type: "zigzag-features"; props: ZigzagFeaturesBlockProps }
  | { type: "product-showcase"; props: ProductShowcaseBlockProps }
  | { type: "nav-header"; props: NavHeaderBlockProps }
  | { type: "cta-button"; props: CtaButtonBlockProps }
  | { type: "full-bleed-hero"; props: FullBleedHeroBlockProps }
  | { type: "parallax-image-hero"; props: ParallaxImageHeroBlockProps }
  | { type: "footer"; props: FooterBlockProps }
  | { type: "form"; props: FormBlockProps }
  | { type: "popup"; props: PopupBlockProps }
  | { type: "sticky-bar"; props: StickyBarBlockProps }
  | { type: "sticky-header"; props: StickyHeaderBlockProps }
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
  | { type: "dandy-product-hero"; props: DandyProductHeroBlockProps }
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
  | { type: "dso-practice-nav"; props: DsoPracticeNavBlockProps }
  | { type: "dso-practice-hero"; props: DsoPracticeHeroBlockProps }
  | { type: "dso-stat-row"; props: DsoStatRowBlockProps }
  | { type: "dso-faq"; props: DsoFaqBlockProps }
  | { type: "dso-split-feature"; props: DsoSplitFeatureBlockProps }
  | { type: "dso-software-showcase"; props: DsoSoftwareShowcaseBlockProps }
  | { type: "dso-insights-video"; props: DsoInsightsVideoBlockProps }
  | { type: "dso-case-study"; props: DsoCaseStudyBlockProps }
  | { type: "dandy-versus"; props: DandyVersusBlockProps }
  | { type: "dandy-columns-v2"; props: DandyColumnsV2BlockProps }
  | { type: "dandy-columns-v3"; props: DandyColumnsV3BlockProps }
  | { type: "dandy-vertical-tabs"; props: DandyVerticalTabsBlockProps }
  | { type: "dandy-switchback"; props: DandySwitchbackBlockProps }
  | { type: "dandy-site-header"; props: DandySiteHeaderBlockProps }
  | { type: "dandy-site-footer"; props: DandySiteFooterBlockProps }
  | { type: "dandy-video-testimonials"; props: DandyVideoTestimonialsBlockProps }
  | { type: "dandy-side-image-v6"; props: DandySideImageV6BlockProps }
  | { type: "dandy-hero-v7-s3"; props: DandyHeroV7S3BlockProps }
  | { type: "dandy-form-right-alt"; props: DandyFormRightAltBlockProps }
  | { type: "dandy-conversion-panel-1"; props: DandyConversionPanel1BlockProps }
  | { type: "dandy-cta-block"; props: DandyCtaBlockProps }
  | { type: "scroll-assembly"; props: ScrollAssemblyBlockProps }
  | { type: "horizontal-showcase"; props: HorizontalShowcaseBlockProps }
  | { type: "sticky-stack"; props: StickyStackBlockProps }
  | { type: "one-pager-hero"; props: OnePagerHeroBlockProps }
  | { type: "event-page"; props: EventPageBlockProps }
  | { type: "product-launch"; props: ProductLaunchBlockProps }
  | { type: "story-hub"; props: StoryHubBlockProps }
  | { type: "event-landing-hero"; props: EventLandingHeroBlockProps }
  | { type: "spatial-tour"; props: SpatialTourBlockProps }
  | { type: "business-case-split"; props: BusinessCaseSplitBlockProps }
  | { type: "business-case-centered"; props: BusinessCaseCenteredBlockProps }
  | { type: "business-case-premium"; props: BusinessCasePremiumBlockProps }
  | { type: "magazine-hero"; props: MagazineHeroBlockProps }
  | { type: "bold-statement"; props: BoldStatementBlockProps }
  | { type: "id-hero"; props: IdHeroBlockProps }
  | { type: "id-marquee"; props: IdMarqueeBlockProps }
  | { type: "id-intro"; props: IdIntroBlockProps }
  | { type: "id-cinema-pillars"; props: IdCinemaPillarsBlockProps }
  | { type: "id-parallax-showcase"; props: IdParallaxShowcaseBlockProps }
  | { type: "id-stats"; props: IdStatsBlockProps }
  | { type: "id-invitation"; props: IdInvitationBlockProps }
  | { type: "id-grid"; props: IdGridBlockProps }
  | { type: "id-spotlight"; props: IdSpotlightBlockProps }
  | { type: "bento-showcase"; props: BentoShowcaseBlockProps }
  | { type: "gradient-pricing"; props: GradientPricingBlockProps }
  | { type: "editorial-carousel"; props: EditorialCarouselBlockProps }
  | { type: "menu-section"; props: MenuSectionBlockProps }
  | { type: "hours-location"; props: HoursLocationBlockProps }
  | { type: "before-after-gallery"; props: BeforeAfterGalleryBlockProps }
  | { type: "speaker-grid"; props: SpeakerGridBlockProps }
  | { type: "content-series"; props: ContentSeriesBlockProps }
  | { type: "section"; props: SectionBlockProps }
  | { type: "columns"; props: ColumnsBlockProps }
  | { type: "grid"; props: GridBlockProps }
  | { type: "stack"; props: StackBlockProps };

/**
 * A page block, optionally with a `children` slot for nested blocks. The
 * `children` field is only meaningful for container/overlay block types
 * (Section/Columns/Grid/Stack, plus Hero & BentoShowcase overlay/tile slots).
 * Other block types may carry an empty/undefined children safely — the
 * renderer ignores it.
 */
export type PageBlock =
  & { id: string; blockSettings?: BlockSettings; children?: PageBlock[] }
  & BlockVariant;

export type BlockType = PageBlock["type"];
