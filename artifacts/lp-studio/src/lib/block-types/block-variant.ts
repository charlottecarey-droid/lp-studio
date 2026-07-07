import type { BlockSettings } from "./common";
import type {
  EventNoirBlockProps,
  EventLuminousBlockProps,
  EventSplitBlockProps,
  CaseMetricsBlockProps,
  CaseEditorialBlockProps,
  CaseModularBlockProps,
} from "./template-pages";
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
  ResourceLinkListBlockProps,
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
  ChatCaptureBlockProps,
  ZigzagFeaturesBlockProps,
  ProductShowcaseBlockProps,
  FooterBlockProps,
  FullBleedHeroBlockProps,
  AiScanHeroBlockProps,
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
  SplitMediaRowBlockProps,
  FullBleedSplitBlockProps,
  IconRowBlockProps,
  MediaCardsRowBlockProps,
  StatRowBlockProps,
  PasIconGridBlockProps,
  PasSplitImageBlockProps,
  PasStatAgitateBlockProps,
  PasBeforeAfterBlockProps,
  FullBleedFinalCtaBlockProps,
  SplitFormFinalCtaBlockProps,
  StatBackedFinalCtaBlockProps,
  SocialUrgencyFinalCtaBlockProps,
  GradientGlowFinalCtaBlockProps,
  VideoBackgroundFinalCtaBlockProps,
  CtaGradientBannerBlockProps,
  CtaSplitImageBlockProps,
  CtaStatBackedBlockProps,
  CaseStudyCardGridBlockProps,
  CaseStudyLogoResultsRowBlockProps,
  CaseStudyMetricTriptychBlockProps,
  CaseStudySpotlightFeatureBlockProps,
  GalleryCarouselSpotlightBlockProps,
  GalleryFilmstripBlockProps,
  GalleryMasonryBlockProps,
  GallerySplitFeatureBlockProps,
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
  WebinarHubBlockProps,
  BlogSeriesBlockProps,
  StorefrontBlockProps,
  CinematicVideoHeroBlockProps,
  AuroraGradientHeroBlockProps,
  EditorialSplitHeroBlockProps,
  ParallaxLayersHeroBlockProps,
  SpotlightGlowHeroBlockProps,
  LogoWallBlockProps,
  AboutTeamBlockProps,
  LogoMarqueeBlockProps,
  RatingBadgesBlockProps,
  AvatarSocialProofBlockProps,
  MediaFeatureReelBlockProps,
  ValuePillarsIconTrioBlockProps,
  ValuePillarsOutlinedCardsBlockProps,
  ValuePillarsColorBlockCardsBlockProps,
  ValuePillarsDividedColumnsBlockProps,
  ValuePillarsHeadlineBadgeBlockProps,
  ValuePillarsCardColumnsBlockProps,
  FeaturePhotoCardsBlockProps,
  FeatureCardGridBlockProps,
  FeatureBigFeaturesBlockProps,
  MediaLoopingShowcaseBlockProps,
  MediaThumbnailGridBlockProps,
  MediaVideoSplitBlockProps,
  LaunchSpotlightHeroBlockProps,
  BentoMosaicHeroBlockProps,
  KineticTypeHeroBlockProps,
  GlassBentoFeaturesBlockProps,
  FeatureTabsShowcaseBlockProps,
  StatCounterBandBlockProps,
  TestimonialWallBlockProps,
  GlassPricingTiersBlockProps,
  AuroraCtaFinaleBlockProps,
  StorybrandJourneyBlockProps,
  ExecDecisionBriefBlockProps,
  ChallengerInsightBlockProps,
  DealRoomBlockProps,
  AccountMicrositeBlockProps,
  OnboardingHubBlockProps,
  ValueRenewalReviewBlockProps,
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
  | { type: "media-feature-reel"; props: MediaFeatureReelBlockProps }
  | { type: "value-pillars-icon-trio"; props: ValuePillarsIconTrioBlockProps }
  | { type: "value-pillars-outlined-cards"; props: ValuePillarsOutlinedCardsBlockProps }
  | { type: "value-pillars-color-block-cards"; props: ValuePillarsColorBlockCardsBlockProps }
  | { type: "value-pillars-divided-columns"; props: ValuePillarsDividedColumnsBlockProps }
  | { type: "value-pillars-headline-badge"; props: ValuePillarsHeadlineBadgeBlockProps }
  | { type: "value-pillars-card-columns"; props: ValuePillarsCardColumnsBlockProps }
  | { type: "feature-photo-cards"; props: FeaturePhotoCardsBlockProps }
  | { type: "feature-card-grid"; props: FeatureCardGridBlockProps }
  | { type: "feature-big-features"; props: FeatureBigFeaturesBlockProps }
  | { type: "media-looping-showcase"; props: MediaLoopingShowcaseBlockProps }
  | { type: "media-thumbnail-grid"; props: MediaThumbnailGridBlockProps }
  | { type: "media-video-split"; props: MediaVideoSplitBlockProps }
  | { type: "case-studies"; props: CaseStudiesBlockProps }
  | { type: "resources"; props: ResourcesBlockProps }
  | { type: "resource-link-list"; props: ResourceLinkListBlockProps }
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
  | { type: "ai-scan-hero"; props: AiScanHeroBlockProps }
  | { type: "parallax-image-hero"; props: ParallaxImageHeroBlockProps }
  | { type: "footer"; props: FooterBlockProps }
  | { type: "form"; props: FormBlockProps }
  | { type: "chat-capture"; props: ChatCaptureBlockProps }
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
  | { type: "storybrand-journey"; props: StorybrandJourneyBlockProps }
  | { type: "exec-decision-brief"; props: ExecDecisionBriefBlockProps }
  | { type: "challenger-insight"; props: ChallengerInsightBlockProps }
  | { type: "deal-room"; props: DealRoomBlockProps }
  | { type: "account-microsite"; props: AccountMicrositeBlockProps }
  | { type: "onboarding-hub"; props: OnboardingHubBlockProps }
  | { type: "value-renewal-review"; props: ValueRenewalReviewBlockProps }
  | { type: "magazine-hero"; props: MagazineHeroBlockProps }
  | { type: "bold-statement"; props: BoldStatementBlockProps }
  | { type: "id-hero"; props: IdHeroBlockProps }
  | { type: "id-marquee"; props: IdMarqueeBlockProps }
  | { type: "id-intro"; props: IdIntroBlockProps }
  | { type: "id-cinema-pillars"; props: IdCinemaPillarsBlockProps }
  | { type: "id-parallax-showcase"; props: IdParallaxShowcaseBlockProps }
  | { type: "id-system-flow"; props: IdSystemFlowBlockProps }
  | { type: "id-form"; props: IdFormBlockProps }
  | { type: "id-stats"; props: IdStatsBlockProps }
  | { type: "id-invitation"; props: IdInvitationBlockProps }
  | { type: "id-grid"; props: IdGridBlockProps }
  | { type: "id-spotlight"; props: IdSpotlightBlockProps }
  | { type: "id-reservation-pass"; props: IdReservationPassBlockProps }
  | { type: "bento-showcase"; props: BentoShowcaseBlockProps }
  | { type: "gradient-pricing"; props: GradientPricingBlockProps }
  | { type: "editorial-carousel"; props: EditorialCarouselBlockProps }
  | { type: "menu-section"; props: MenuSectionBlockProps }
  | { type: "hours-location"; props: HoursLocationBlockProps }
  | { type: "before-after-gallery"; props: BeforeAfterGalleryBlockProps }
  | { type: "cta-centered-minimal"; props: CtaCenteredMinimalBlockProps }
  | { type: "cta-gradient-banner"; props: CtaGradientBannerBlockProps }
  | { type: "cta-split-image"; props: CtaSplitImageBlockProps }
  | { type: "cta-stat-backed"; props: CtaStatBackedBlockProps }
  | { type: "case-study-card-grid"; props: CaseStudyCardGridBlockProps }
  | { type: "case-study-logo-results-row"; props: CaseStudyLogoResultsRowBlockProps }
  | { type: "case-study-metric-triptych"; props: CaseStudyMetricTriptychBlockProps }
  | { type: "case-study-spotlight-feature"; props: CaseStudySpotlightFeatureBlockProps }
  | { type: "gallery-carousel-spotlight"; props: GalleryCarouselSpotlightBlockProps }
  | { type: "gallery-filmstrip"; props: GalleryFilmstripBlockProps }
  | { type: "gallery-masonry"; props: GalleryMasonryBlockProps }
  | { type: "gallery-split-feature"; props: GallerySplitFeatureBlockProps }
  | { type: "speaker-grid"; props: SpeakerGridBlockProps }
  | { type: "benefits-alternating-rows"; props: BenefitsAlternatingRowsBlockProps }
  | { type: "how-it-works-alternating"; props: HowItWorksAlternatingBlockProps }
  | { type: "how-it-works-numbered-bento"; props: HowItWorksNumberedBentoBlockProps }
  | { type: "how-it-works-vertical-timeline"; props: HowItWorksVerticalTimelineBlockProps }
  | { type: "how-it-works-horizontal-stepper"; props: HowItWorksHorizontalStepperBlockProps }
  | { type: "benefits-bento"; props: BenefitsBentoBlockProps }
  | { type: "features-bento-showcase"; props: FeaturesBentoShowcaseBlockProps }
  | { type: "features-spotlight-cards"; props: FeaturesSpotlightCardsBlockProps }
  | { type: "features-tabbed-categories"; props: FeaturesTabbedCategoriesBlockProps }
  | { type: "features-comparison-checklist"; props: FeaturesComparisonChecklistBlockProps }
  | { type: "benefits-icon-grid"; props: BenefitsIconGridBlockProps }
  | { type: "benefits-stat-led"; props: BenefitsStatLedBlockProps }
  | { type: "quote-carousel"; props: QuoteCarouselBlockProps }
  | { type: "quote-library"; props: QuoteLibraryBlockProps }
  | { type: "quote-with-image"; props: QuoteWithImageBlockProps }
  | { type: "single-quote"; props: SingleQuoteBlockProps }
  | { type: "testimonial-grid"; props: TestimonialGridBlockProps }
  | { type: "content-series"; props: ContentSeriesBlockProps }
  | { type: "webinar-hub"; props: WebinarHubBlockProps }
  | { type: "blog-series"; props: BlogSeriesBlockProps }
  | { type: "storefront"; props: StorefrontBlockProps }
  | { type: "cinematic-video-hero"; props: CinematicVideoHeroBlockProps }
  | { type: "aurora-gradient-hero"; props: AuroraGradientHeroBlockProps }
  | { type: "editorial-split-hero"; props: EditorialSplitHeroBlockProps }
  | { type: "parallax-layers-hero"; props: ParallaxLayersHeroBlockProps }
  | { type: "spotlight-glow-hero"; props: SpotlightGlowHeroBlockProps }
  | { type: "logo-wall"; props: LogoWallBlockProps }
  | { type: "about-team"; props: AboutTeamBlockProps }
  | { type: "logo-marquee"; props: LogoMarqueeBlockProps }
  | { type: "rating-badges"; props: RatingBadgesBlockProps }
  | { type: "avatar-social-proof"; props: AvatarSocialProofBlockProps }
  | { type: "launch-spotlight-hero"; props: LaunchSpotlightHeroBlockProps }
  | { type: "bento-mosaic-hero"; props: BentoMosaicHeroBlockProps }
  | { type: "kinetic-type-hero"; props: KineticTypeHeroBlockProps }
  | { type: "glass-bento-features"; props: GlassBentoFeaturesBlockProps }
  | { type: "feature-tabs-showcase"; props: FeatureTabsShowcaseBlockProps }
  | { type: "stat-counter-band"; props: StatCounterBandBlockProps }
  | { type: "testimonial-wall"; props: TestimonialWallBlockProps }
  | { type: "glass-pricing-tiers"; props: GlassPricingTiersBlockProps }
  | { type: "aurora-cta-finale"; props: AuroraCtaFinaleBlockProps }
  | { type: "event-noir"; props: EventNoirBlockProps }
  | { type: "event-luminous"; props: EventLuminousBlockProps }
  | { type: "event-split"; props: EventSplitBlockProps }
  | { type: "case-metrics"; props: CaseMetricsBlockProps }
  | { type: "case-editorial"; props: CaseEditorialBlockProps }
  | { type: "case-modular"; props: CaseModularBlockProps }
  | { type: "centered-logo-nav"; props: CenteredLogoNavBlockProps }
  | { type: "mega-menu-nav"; props: MegaMenuNavBlockProps }
  | { type: "minimal-nav"; props: MinimalNavBlockProps }
  | { type: "transparent-overlay-nav"; props: TransparentOverlayNavBlockProps }
  | { type: "split-media-row"; props: SplitMediaRowBlockProps }
  | { type: "full-bleed-split"; props: FullBleedSplitBlockProps }
  | { type: "icon-row"; props: IconRowBlockProps }
  | { type: "media-cards-row"; props: MediaCardsRowBlockProps }
  | { type: "stat-row"; props: StatRowBlockProps }
  | { type: "pas-icon-grid"; props: PasIconGridBlockProps }
  | { type: "pas-split-image"; props: PasSplitImageBlockProps }
  | { type: "pas-stat-agitate"; props: PasStatAgitateBlockProps }
  | { type: "pas-before-after"; props: PasBeforeAfterBlockProps }
  | { type: "full-bleed-final-cta"; props: FullBleedFinalCtaBlockProps }
  | { type: "split-form-final-cta"; props: SplitFormFinalCtaBlockProps }
  | { type: "stat-backed-final-cta"; props: StatBackedFinalCtaBlockProps }
  | { type: "social-urgency-final-cta"; props: SocialUrgencyFinalCtaBlockProps }
  | { type: "gradient-glow-final-cta"; props: GradientGlowFinalCtaBlockProps }
  | { type: "video-background-final-cta"; props: VideoBackgroundFinalCtaBlockProps }
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
