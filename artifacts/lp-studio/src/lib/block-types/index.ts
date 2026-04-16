// Common types and utilities
export type { BlockCategory, CtaMode, FormFieldType, BlockSettings } from "./common";
export type { StepCondition, FormField, FormStep } from "./common";
export type { CaseStudyItem, ResourceItem } from "./common";
export type { NavHeaderLink, NavHeaderCta } from "./common";
export type { FooterLink, FooterColumn } from "./common";
export type { ZigzagFeatureRow, ProductShowcaseCard } from "./common";
export type { RoiInputField, RoiOutputField } from "./common";
export type { PopupTrigger } from "./common";

// Generic block types
export type {
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
  DandyColumnsV2Item,
  DandyColumnsV3Item,
  DandyVerticalTabItem,
  DandySwitchbackItem,
  DandyVideoTestimonialItem,
  DandySiteHeaderNavLink,
  DandySiteFooterLinkGroup,
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
  DandyHeroV7S3TrustItem,
  DandyFormRightAltBlockProps,
  DandyConversionPanel1BlockProps,
  DandyConversionPanel1Stat,
  DandyCtaBlockProps,
} from "./generic-blocks";

// DSO block types
export type {
  DsoInsightsDashboardBlockProps,
  DsoLabTourBlockProps,
  DsoStatBarBlockProps,
  DsoHeartlandHeroBlockProps,
  DsoSuccessStoriesBlockProps,
  DsoChallengesBlockProps,
  DsoProblemPanelIcon,
  DsoProblemBlockProps,
  DsoAiFeatureBlockProps,
  DsoStatShowcaseBlockProps,
  DsoScrollStoryChapter,
  DsoScrollStoryBlockProps,
  DsoScrollStoryHeroBlockProps,
  DsoNetworkMapBlockProps,
  DsoCaseFlowStage,
  DsoCaseFlowBlockProps,
  DsoLiveFeedBlockProps,
  DsoParticleMeshBlockProps,
  DsoFlowCanvasBlockProps,
  DsoBentoTile,
  DsoBentoOutcomesBlockProps,
  DsoCtaCaptureBlockProps,
  DsoMeetTeamMember,
  DsoMeetTeamBlockProps,
  DsoParadigmShiftBlockProps,
  DsoPartnershipPerk,
  DsoPartnershipPerksBlockProps,
  DsoProductItem,
  DsoProductsGridBlockProps,
  DsoPromoCard,
  DsoPromoCardsBlockProps,
  DsoActivationStep,
  DsoActivationStepsBlockProps,
  DsoPromise,
  DsoPromisesBlockProps,
  DsoTestimonialItem,
  DsoTestimonialsBlockProps,
  DsoPracticeNavLink,
  DsoPracticeNavBlockProps,
  DsoPracticeHeroBlockProps,
  DsoStatRowItem,
  DsoStatRowBlockProps,
  DsoFaqItem,
  DsoFaqBlockProps,
  DsoSplitFeatureBlockProps,
  DsoSoftwareShowcaseBlockProps,
  DsoPilotStep,
  DsoPilotStepsBlockProps,
  DsoFinalCtaBlockProps,
  DsoComparisonBlockProps,
  DsoInsightsVideoBlockProps,
  DsoCaseStudyBlockProps,
  DsoCaseStudyBodySection,
  DsoCaseStudyResultItem,
  EventPageBlockProps,
  EventPageAgendaDay,
  EventPagePhoto,
  EventPageDetail,
  EventPageNavLink,
  OnePagerHeroBlockProps,
} from "./dso-blocks";

// Utility block types
export type {
  NavHeaderBlockProps,
  CtaButtonBlockProps,
  PopupBlockProps,
  StickyBarBlockProps,
} from "./utility-blocks";

// Block variant and page block types
export type { BlockVariant, PageBlock, BlockType } from "./block-variant";

// Block registry
export type { BlockDefinition } from "./block-registry";
export { BLOCK_REGISTRY, getBlockDef, createBlock, templateToBlocks } from "./block-registry";
