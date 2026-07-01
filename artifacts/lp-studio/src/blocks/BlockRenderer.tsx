import type { PageBlock, BlockSettings, HeroBlockProps, PasSectionBlockProps, ComparisonBlockProps, StatCalloutBlockProps, BenefitsGridBlockProps, TestimonialBlockProps, HowItWorksBlockProps, BottomCtaBlockProps, ZigzagFeaturesBlockProps, ProductShowcaseBlockProps, NavHeaderBlockProps, CtaButtonBlockProps, FullBleedHeroBlockProps, PopupBlockProps, StickyBarBlockProps, ProductGridBlockProps, PhotoStripBlockProps } from "@/lib/block-types";
import { PageContextProvider } from "@/lib/page-context";
import { getBlockSettingsCapabilities } from "@/lib/block-settings-capabilities";
import { BlockRoiCalculator } from "./BlockRoiCalculator";
import { BlockDsoInsightsDashboard } from "./BlockDsoInsightsDashboard";
import { BlockDsoLabTour } from "./BlockDsoLabTour";
import { BlockDsoStatBar } from "./BlockDsoStatBar";
import { BlockDsoSuccessStories } from "./BlockDsoSuccessStories";
import { BlockDsoChallenges } from "./BlockDsoChallenges";
import { BlockDsoPilotSteps } from "./BlockDsoPilotSteps";
import { BlockDsoFinalCta } from "./BlockDsoFinalCta";
import { BlockDsoComparison } from "./BlockDsoComparison";
import { BlockDsoHeartlandHero } from "./BlockDsoHeartlandHero";
import { BlockValuePillarsIconTrio } from "./BlockValuePillarsIconTrio";
import { BlockValuePillarsOutlinedCards } from "./BlockValuePillarsOutlinedCards";
import { BlockValuePillarsColorBlockCards } from "./BlockValuePillarsColorBlockCards";
import { BlockValuePillarsDividedColumns } from "./BlockValuePillarsDividedColumns";
import { BlockValuePillarsHeadlineBadge } from "./BlockValuePillarsHeadlineBadge";
import { BlockValuePillarsCardColumns } from "./BlockValuePillarsCardColumns";
import { BlockFeaturePhotoCards } from "./BlockFeaturePhotoCards";
import { BlockFeatureCardGrid } from "./BlockFeatureCardGrid";
import { BlockFeatureBigFeatures } from "./BlockFeatureBigFeatures";
import { BlockDandyProductHero } from "./BlockDandyProductHero";
import { BlockDsoProblem } from "./BlockDsoProblem";
import { BlockDsoAiFeature } from "./BlockDsoAiFeature";
import { BlockDsoStatShowcase } from "./BlockDsoStatShowcase";
import { BlockDsoScrollStory } from "./BlockDsoScrollStory";
import { BlockDsoScrollStoryHero } from "./BlockDsoScrollStoryHero";
import { BlockDsoNetworkMap } from "./BlockDsoNetworkMap";
import { BlockDsoCaseFlow } from "./BlockDsoCaseFlow";
import { BlockDsoLiveFeed } from "./BlockDsoLiveFeed";
import { BlockDsoParticleMesh } from "./BlockDsoParticleMesh";
import { BlockDsoFlowCanvas } from "./BlockDsoFlowCanvas";
import { BlockDsoBentoOutcomes } from "./BlockDsoBentoOutcomes";
import { BlockDsoCtaCapture } from "./BlockDsoCtaCapture";
import { BlockDsoMeetTeam } from "./BlockDsoMeetTeam";
import { BlockDsoParadigmShift } from "./BlockDsoParadigmShift";
import { BlockDsoPartnershipPerks } from "./BlockDsoPartnershipPerks";
import { BlockDsoProductsGrid } from "./BlockDsoProductsGrid";
import { BlockDsoPromoCards } from "./BlockDsoPromoCards";
import { BlockDsoActivationSteps } from "./BlockDsoActivationSteps";
import { BlockDsoPromises } from "./BlockDsoPromises";
import { BlockDsoTestimonials } from "./BlockDsoTestimonials";
import { BlockDsoPracticeNav } from "./BlockDsoPracticeNav";
import { BlockDsoPracticeHero } from "./BlockDsoPracticeHero";
import { BlockDsoStatRow } from "./BlockDsoStatRow";
import { BlockDsoFaq } from "./BlockDsoFaq";
import { BlockDsoSplitFeature } from "./BlockDsoSplitFeature";
import { BlockDsoSoftwareShowcase } from "./BlockDsoSoftwareShowcase";
import { BlockDsoInsightsVideo } from "./BlockDsoInsightsVideo";
import { BlockDsoCaseStudy } from "./BlockDsoCaseStudy";
import { BlockOnePagerHero } from "./BlockOnePagerHero";
import { BlockEventPage } from "./BlockEventPage";
import { BlockProductLaunch } from "./BlockProductLaunch";
import { BlockStoryHub } from "./BlockStoryHub";
import { BlockBusinessCaseSplit } from "./BlockBusinessCaseSplit";
import { BlockBusinessCaseCentered } from "./BlockBusinessCaseCentered";
import { BlockBusinessCasePremium } from "./BlockBusinessCasePremium";
import { BlockStorybrandJourney } from "./BlockStorybrandJourney";
import { BlockExecDecisionBrief } from "./BlockExecDecisionBrief";
import { BlockChallengerInsight } from "./BlockChallengerInsight";
import { BlockDealRoom } from "./BlockDealRoom";
import { BlockAccountMicrosite } from "./BlockAccountMicrosite";
import { BlockOnboardingHub } from "./BlockOnboardingHub";
import { BlockValueRenewalReview } from "./BlockValueRenewalReview";
import { BlockEventLandingHero } from "./BlockEventLandingHero";
import { BlockSpatialTour } from "./BlockSpatialTour";
import type { BrandConfig } from "@/lib/brand-config";
import { brandDefaultCtaConfig, ctaConfigHasValue, blockHasPrimaryCta, applyPageCtaToBlockProps, restorePrimaryCtaProps, type CtaConfig } from "@/lib/cta/ctaConfig";
import { BlockHero } from "./BlockHero";
import { BlockTrustBar } from "./BlockTrustBar";
import { BlockPasSection } from "./BlockPasSection";
import { BlockComparison } from "./BlockComparison";
import { BlockStatCallout } from "./BlockStatCallout";
import { BlockBenefitsGrid } from "./BlockBenefitsGrid";
import { BlockTestimonial } from "./BlockTestimonial";
import { BlockHowItWorks } from "./BlockHowItWorks";
import { BlockProductGrid } from "./BlockProductGrid";
import { BlockPhotoStrip } from "./BlockPhotoStrip";
import { BlockBottomCta } from "./BlockBottomCta";
import { BlockVideoSection } from "./BlockVideoSection";
import { BlockMediaFeatureReel } from "./BlockMediaFeatureReel";
import { BlockMediaLoopingShowcase } from "./BlockMediaLoopingShowcase";
import { BlockMediaThumbnailGrid } from "./BlockMediaThumbnailGrid";
import { BlockMediaVideoSplit } from "./BlockMediaVideoSplit";
import BlockCaseStudies from "./BlockCaseStudies";
import BlockResources from "./BlockResources";
import { BlockResourceLinkList } from "./BlockResourceLinkList";
import { BlockRichText } from "./BlockRichText";
import { BlockCustomHtml } from "./BlockCustomHtml";
import {
  BlockGridImage,
  BlockGridHeadlineSub,
  BlockGridParagraphBullets,
  BlockGridHeadlineParagraph,
  BlockGridIconFeature,
  BlockGridStat,
  BlockGridQuote,
  BlockGridCtaTile,
  BlockGridLogo,
  BlockGridVideo,
} from "./BlockGridPieces";
import { BlockCustomSchema } from "./BlockCustomSchema";
import { BlockZigzagFeatures } from "./BlockZigzagFeatures";
import { BlockProductShowcase } from "./BlockProductShowcase";
import { BlockNavHeader } from "./BlockNavHeader";
import { BlockCtaButton } from "./BlockCtaButton";
import { BlockFullBleedHero } from "./BlockFullBleedHero";
import { BlockParallaxImageHero } from "./BlockParallaxImageHero";
import { BlockFooter } from "./BlockFooter";
import { BlockForm } from "./BlockForm";
import { BlockPopup } from "./BlockPopup";
import { BlockStickyBar } from "./BlockStickyBar";
import { BlockStickyHeader } from "./BlockStickyHeader";
import { BlockDandyVersus } from "./BlockDandyVersus";
import { BlockDandyColumnsV2 } from "./BlockDandyColumnsV2";
import { BlockDandyColumnsV3 } from "./BlockDandyColumnsV3";
import { BlockDandyVerticalTabs } from "./BlockDandyVerticalTabs";
import { BlockDandySwitchback } from "./BlockDandySwitchback";
import { BlockDandySiteHeader } from "./BlockDandySiteHeader";
import { BlockDandySiteFooter } from "./BlockDandySiteFooter";
import { BlockDandyVideoTestimonials } from "./BlockDandyVideoTestimonials";
import { BlockDandySideImageV6 } from "./BlockDandySideImageV6";
import { BlockDandyHeroV7S3 } from "./BlockDandyHeroV7S3";
import { BlockDandyFormRightAlt } from "./BlockDandyFormRightAlt";
import { BlockDandyConversionPanel1 } from "./BlockDandyConversionPanel1";
import { BlockDandyCtaBlock } from "./BlockDandyCtaBlock";
import { BlockScrollAssembly } from "./BlockScrollAssembly";
import { BlockHorizontalShowcase } from "./BlockHorizontalShowcase";
import { BlockStickyStack } from "./BlockStickyStack";
import { BlockMagazineHero } from "./BlockMagazineHero";
import { BlockCinematicVideoHero } from "./BlockCinematicVideoHero";
import { BlockAuroraGradientHero } from "./BlockAuroraGradientHero";
import { BlockEditorialSplitHero } from "./BlockEditorialSplitHero";
import { BlockParallaxLayersHero } from "./BlockParallaxLayersHero";
import { BlockSpotlightGlowHero } from "./BlockSpotlightGlowHero";
import { BlockLogoWall } from "./BlockLogoWall";
import { BlockAboutTeam } from "./BlockAboutTeam";
import { BlockLogoMarquee } from "./BlockLogoMarquee";
import { BlockLaunchSpotlightHero } from "./BlockLaunchSpotlightHero";
import { BlockBentoMosaicHero } from "./BlockBentoMosaicHero";
import { BlockKineticTypeHero } from "./BlockKineticTypeHero";
import { BlockGlassBentoFeatures } from "./BlockGlassBentoFeatures";
import { BlockFeatureTabsShowcase } from "./BlockFeatureTabsShowcase";
import { BlockStatCounterBand } from "./BlockStatCounterBand";
import { BlockTestimonialWall } from "./BlockTestimonialWall";
import { BlockGlassPricingTiers } from "./BlockGlassPricingTiers";
import { BlockAuroraCtaFinale } from "./BlockAuroraCtaFinale";
import { BlockRatingBadges } from "./BlockRatingBadges";
import { BlockAvatarSocialProof } from "./BlockAvatarSocialProof";
import { BlockEditorialCarousel } from "./BlockEditorialCarousel";
import { BlockBoldStatement } from "./BlockBoldStatement";
import { BlockIdHero } from "./BlockIdHero";
import { BlockIdMarquee } from "./BlockIdMarquee";
import { BlockIdIntro } from "./BlockIdIntro";
import { BlockIdCinemaPillars } from "./BlockIdCinemaPillars";
import { BlockIdParallaxShowcase } from "./BlockIdParallaxShowcase";
import { BlockIdSystemFlow } from "./BlockIdSystemFlow";
import { BlockIdForm } from "./BlockIdForm";
import { BlockIdStats } from "./BlockIdStats";
import { BlockIdInvitation } from "./BlockIdInvitation";
import { BlockIdGrid } from "./BlockIdGrid";
import { BlockIdSpotlight } from "./BlockIdSpotlight";
import { BlockIdReservationPass } from "./BlockIdReservationPass";
import { BlockBentoShowcase } from "./BlockBentoShowcase";
import { BlockGradientPricing } from "./BlockGradientPricing";
import { BlockMenuSection } from "./BlockMenuSection";
import { BlockHoursLocation } from "./BlockHoursLocation";
import { BlockBeforeAfterGallery } from "./BlockBeforeAfterGallery";
import { BlockCtaCenteredMinimal } from "./BlockCtaCenteredMinimal";
import { BlockCenteredLogoNav } from "./BlockCenteredLogoNav";
import { BlockMegaMenuNav } from "./BlockMegaMenuNav";
import { BlockMinimalNav } from "./BlockMinimalNav";
import { BlockTransparentOverlayNav } from "./BlockTransparentOverlayNav";
import { BlockSplitMediaRow } from "./BlockSplitMediaRow";
import { BlockFullBleedSplit } from "./BlockFullBleedSplit";
import { BlockIconRow } from "./BlockIconRow";
import { BlockMediaCardsRow } from "./BlockMediaCardsRow";
import { BlockStatRow } from "./BlockStatRow";
import { BlockPasIconGrid } from "./BlockPasIconGrid";
import { BlockPasSplitImage } from "./BlockPasSplitImage";
import { BlockPasStatAgitate } from "./BlockPasStatAgitate";
import { BlockPasBeforeAfter } from "./BlockPasBeforeAfter";
import { BlockFullBleedFinalCta } from "./BlockFullBleedFinalCta";
import { BlockSplitFormFinalCta } from "./BlockSplitFormFinalCta";
import { BlockStatBackedFinalCta } from "./BlockStatBackedFinalCta";
import { BlockSocialUrgencyFinalCta } from "./BlockSocialUrgencyFinalCta";
import { BlockGradientGlowFinalCta } from "./BlockGradientGlowFinalCta";
import { BlockVideoBackgroundFinalCta } from "./BlockVideoBackgroundFinalCta";
import { BlockCtaSplitImage } from "./BlockCtaSplitImage";
import { BlockCtaStatBacked } from "./BlockCtaStatBacked";
import { BlockCtaGradientBanner } from "./BlockCtaGradientBanner";
import { BlockCaseStudyCardGrid } from "./BlockCaseStudyCardGrid";
import { BlockCaseStudyLogoResultsRow } from "./BlockCaseStudyLogoResultsRow";
import { BlockCaseStudyMetricTriptych } from "./BlockCaseStudyMetricTriptych";
import { BlockCaseStudySpotlightFeature } from "./BlockCaseStudySpotlightFeature";
import { BlockGalleryCarouselSpotlight } from "./BlockGalleryCarouselSpotlight";
import { BlockGalleryFilmstrip } from "./BlockGalleryFilmstrip";
import { BlockGalleryMasonry } from "./BlockGalleryMasonry";
import { BlockGallerySplitFeature } from "./BlockGallerySplitFeature";
import { BlockBenefitsAlternatingRows } from "./BlockBenefitsAlternatingRows";
import { BlockHowItWorksAlternating } from "./BlockHowItWorksAlternating";
import { BlockHowItWorksNumberedBento } from "./BlockHowItWorksNumberedBento";
import { BlockHowItWorksVerticalTimeline } from "./BlockHowItWorksVerticalTimeline";
import { BlockHowItWorksHorizontalStepper } from "./BlockHowItWorksHorizontalStepper";
import { BlockBenefitsBento } from "./BlockBenefitsBento";
import { BlockFeaturesBentoShowcase } from "./BlockFeaturesBentoShowcase";
import { BlockFeaturesSpotlightCards } from "./BlockFeaturesSpotlightCards";
import { BlockFeaturesTabbedCategories } from "./BlockFeaturesTabbedCategories";
import { BlockFeaturesComparisonChecklist } from "./BlockFeaturesComparisonChecklist";
import { BlockBenefitsIconGrid } from "./BlockBenefitsIconGrid";
import { BlockBenefitsStatLed } from "./BlockBenefitsStatLed";
import { BlockQuoteCarousel } from "./BlockQuoteCarousel";
import { BlockQuoteLibrary } from "./BlockQuoteLibrary";
import { BlockQuoteWithImage } from "./BlockQuoteWithImage";
import { BlockSingleQuote } from "./BlockSingleQuote";
import { BlockTestimonialGrid } from "./BlockTestimonialGrid";
import { BlockSpeakerGrid } from "./BlockSpeakerGrid";
import { BlockContentSeries } from "./BlockContentSeries";
import { BlockWebinarHub } from "./BlockWebinarHub";
import { BlockEventNoir } from "./BlockEventNoir";
import { BlockEventLuminous } from "./BlockEventLuminous";
import { BlockEventSplit } from "./BlockEventSplit";
import { BlockCaseMetrics } from "./BlockCaseMetrics";
import { BlockCaseEditorial } from "./BlockCaseEditorial";
import { BlockCaseModular } from "./BlockCaseModular";
import { BlockBlogSeries } from "./BlockBlogSeries";
import { BlockStorefront } from "./BlockStorefront";
import { BlockSection } from "./BlockSection";
import { BlockColumns } from "./BlockColumns";
import { BlockGrid } from "./BlockGrid";
import { BlockStack } from "./BlockStack";
import type { BlockPath } from "@/lib/block-tree";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { Reveal } from "@/components/Reveal";
import type { ReactNode } from "react";
import { memo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface Props {
  block: PageBlock;
  brand: BrandConfig;
  onCtaClick?: (url: string) => void;
  onBlockChange?: (updated: PageBlock) => void;
  animationsEnabled?: boolean;
  /** Path to this block in the page tree (defaults to []). */
  path?: BlockPath;
  /**
   * Optional override for rendering child blocks of container/overlay blocks.
   * If absent, container blocks recursively render children via BlockRenderer
   * with no chrome (used by viewer/published pages). The builder supplies a
   * version that wraps each child in selection/drag chrome and insert chips.
   */
  renderChild?: (child: PageBlock, index: number, parentPath: BlockPath, parentLayout?: "stack" | "grid") => ReactNode;
  /**
   * Optional callback for "drop block here" zones inside empty containers.
   * Builder uses this to register a useDroppable target. Viewer ignores it.
   */
  renderEmptySlot?: (parentPath: BlockPath, parentLayout?: "stack" | "grid") => ReactNode;
  /**
   * Optional callback for an "append-at-end" drop zone rendered after the
   * last child of a non-empty container. Without this, dragging a block to
   * the bottom of a list is impossible (sortable's "before over" semantics
   * never resolves to "after the last item").
   */
  renderTailSlot?: (parentPath: BlockPath, parentLayout?: "stack" | "grid") => ReactNode;
  pageId?: number;
  /**
   * Active A/B test id when the page is being rendered as a test variant.
   * Plumbed alongside `variantId` so descendant blocks can attribute
   * conversions to the right test/variant pair instead of falling back to the
   * legacy `testId: 0` placeholder (which violated the FK and silently 500'd).
   */
  testId?: number;
  variantId?: number;
  sessionId?: string;
  pageVars?: Record<string, string>;
  /**
   * Unified CTA architecture (Phase 1). The page-level default CTA, threaded so
   * the shared CtaButton can resolve a block's effective CTA as
   * tenant default → page CTA → block override. Undefined = no page-level CTA
   * (the common case, and every pre-feature page), so resolution falls back to
   * the block's own props and the tenant default exactly as before.
   */
  pageCta?: CtaConfig | null;
  /** True when rendering inside the LP Studio builder canvas. Blocks that mount
   *  fixed-position chrome (e.g. sticky hero nav) should opt into a contained
   *  variant in builder mode so they don't overlap the builder's top bar. */
  isBuilder?: boolean;
}

const SPACING_PX: Record<string, string> = {
  none: "0px",
  xs: "8px",
  sm: "16px",
  md: "32px",
  lg: "64px",
  xl: "96px",
};

const PADDING_X_PX: Record<string, string> = {
  none: "0px",
  sm: "16px",
  md: "40px",
  lg: "80px",
  xl: "120px",
};

function BgImageLayer({ url, opacity, parallax }: { url: string; opacity: number; parallax: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      {parallax ? (
        <motion.div
          className="absolute inset-[-15%]"
          style={{ y, backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: opacity / 100 }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: opacity / 100 }}
        />
      )}
    </div>
  );
}

/** Strip any saved block-setting that the block type does not actually support
 *  (per its declared capabilities). Capabilities only govern which controls the
 *  inspector shows — `wrapWithSettings` would otherwise still apply orphaned
 *  values (e.g. a `paddingX` / `minHeight` left on a chrome block such as a nav),
 *  producing layout artifacts the user can no longer see or edit. Gating here
 *  keeps the rendered result aligned with the editable surface. */
function gateSettingsByCapabilities(blockType: string, settings?: BlockSettings): BlockSettings | undefined {
  if (!settings) return settings;
  const caps = getBlockSettingsCapabilities(blockType);
  const gated: BlockSettings = { ...settings };
  if (!caps.spacing) { gated.spacingTop = undefined; gated.spacingBottom = undefined; }
  if (!caps.textScale) gated.textScale = undefined;
  if (!caps.paddingX) gated.paddingX = undefined;
  if (!caps.minHeight) gated.minHeight = undefined;
  if (!caps.bgColor) gated.bgColor = undefined;
  if (!caps.textColors) { gated.textColor = undefined; gated.headlineColor = undefined; gated.bodyColor = undefined; }
  if (!caps.cardBgColor) gated.cardBgColor = undefined;
  if (!caps.bgImage) { gated.bgImageUrl = undefined; gated.bgImageParallax = undefined; gated.bgImageOpacity = undefined; }
  return gated;
}

function wrapWithSettings(children: ReactNode, settings?: BlockSettings, animationsEnabled = true): ReactNode {
  if (!settings) return children;
  const style: React.CSSProperties = {};
  if (settings.spacingTop && settings.spacingTop !== "md") style.paddingTop = SPACING_PX[settings.spacingTop];
  if (settings.spacingBottom && settings.spacingBottom !== "md") style.paddingBottom = SPACING_PX[settings.spacingBottom];
  if (settings.textScale && settings.textScale !== "100") style.zoom = Number(settings.textScale) / 100;
  if (settings.paddingX && settings.paddingX !== "none") {
    style.paddingLeft = PADDING_X_PX[settings.paddingX];
    style.paddingRight = PADDING_X_PX[settings.paddingX];
  }
  if (settings.minHeight && settings.minHeight !== "none") {
    style.minHeight = `${settings.minHeight}vh`;
    style.display = "flex";
    style.flexDirection = "column";
    style.justifyContent = "center";
  }
  if (settings.bgColor) style.backgroundColor = settings.bgColor;
  if (settings.textColor) style.color = settings.textColor;
  if (settings.headlineColor) (style as Record<string, string>)["--blk-headline-color"] = settings.headlineColor;
  if (settings.bodyColor) (style as Record<string, string>)["--blk-body-color"] = settings.bodyColor;
  if (settings.cardBgColor) (style as Record<string, string>)["--card-bg"] = settings.cardBgColor;

  const hasBgImage = !!settings.bgImageUrl;
  const anchorId = settings.anchorId || undefined;

  // CSS variable so the override rule in index.css can reach through blocks'
  // hardcoded bg-white / bg-slate-50 classes.
  const blkBgVar = settings.bgColor
    ? settings.bgColor
    : hasBgImage
      ? "transparent"
      : null;

  const blkBgAttr = blkBgVar !== null
    ? { "data-blk-bg": "", style: { ...style, "--blk-bg": blkBgVar } as React.CSSProperties }
    : { style };

  // Marker for the fixed horizontal padding so a media-query rule can dial it
  // down on narrow screens (see the `.one-pager-frame [data-blk-px]` override in
  // the viewer). The inline px value above keeps desktop spacing untouched; the
  // attribute alone is inert on non-One-Pager pages (no scoped rule targets it).
  const pxAttr = settings.paddingX && settings.paddingX !== "none"
    ? { "data-blk-px": settings.paddingX }
    : {};

  if (!hasBgImage && Object.keys(style).length === 0 && blkBgVar === null) {
    if (!anchorId) return children;
    return <div id={anchorId}>{children}</div>;
  }

  if (hasBgImage) {
    return (
      <div id={anchorId} {...blkBgAttr} {...pxAttr} style={{ ...(blkBgAttr.style as React.CSSProperties), position: "relative" }}>
        <BgImageLayer
          url={settings.bgImageUrl!}
          opacity={settings.bgImageOpacity ?? 100}
          parallax={!!(settings.bgImageParallax && animationsEnabled)}
        />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    );
  }

  return <div id={anchorId} {...blkBgAttr} {...pxAttr}>{children}</div>;
}

function resolveCtaUrl(props: { ctaUrl?: string; ctaAction?: string; chilipiperUrl?: string }): string {
  if (props.ctaAction === "chilipiper" && props.chilipiperUrl) {
    return `chilipiper:${props.chilipiperUrl}`;
  }
  return props.ctaUrl ?? "#";
}

function resolveDsoCtaUrl(ctaUrl: string | undefined, ctaMode: string | undefined): string {
  const url = ctaUrl ?? "#";
  if (ctaMode === "chilipiper") return `chilipiper:${url}`;
  return url;
}

// Blocks that should NOT be wrapped in any entrance/scroll-reveal motion
// wrapper, either by the viewer (outer fade-up wrapper) or by BlockRenderer
// itself (inner Reveal wrapper). We exclude:
//   - layout chrome (nav, sticky, popups, footers) — they shouldn't animate
//   - blocks that own their own scroll-driven animations (pinned scroll
//     stories, switchbacks, scroll-assembly, the spatial tour) — wrapping them
//     in a transformed motion.div breaks their internal useScroll measurements
//   - first-paint hero blocks — visitors expect to see them immediately
//   - spacers — nothing visible to reveal
export const NO_REVEAL = new Set<string>([
  "nav-header", "sticky-header", "sticky-bar", "popup", "footer",
  "dandy-site-header", "dandy-site-footer",
  "centered-logo-nav", "mega-menu-nav", "minimal-nav", "transparent-overlay-nav",
  "full-bleed-split",
  "full-bleed-final-cta", "video-background-final-cta",
  "scroll-assembly", "horizontal-showcase", "sticky-stack", "spatial-tour",
  "dso-scroll-story", "dso-scroll-story-hero",
  "dandy-switchback", "dso-paradigm-shift",
  "hero", "full-bleed-hero", "parallax-image-hero", "dandy-hero-v7-s3", "dandy-product-hero",
  "cinematic-video-hero", "aurora-gradient-hero", "editorial-split-hero", "parallax-layers-hero", "spotlight-glow-hero",
  // June-2026 modern wave: first-paint heroes with their own entrance
  // animations, plus sections that own internal staggered scroll-reveals /
  // scroll-linked transforms (glass bento cards, tab crossfades, count-up
  // stats, masonry quote wall) — the outer reveal wrapper double-animates
  // them and its transform breaks their internal useScroll/useInView math.
  "launch-spotlight-hero", "bento-mosaic-hero", "kinetic-type-hero",
  "glass-bento-features", "feature-tabs-showcase", "stat-counter-band",
  "testimonial-wall",
  "dso-heartland-hero", "dso-practice-hero", "one-pager-hero", "event-page", "event-landing-hero", "product-launch", "story-hub",
  "business-case-split", "business-case-centered", "business-case-premium",
  "storybrand-journey", "exec-decision-brief", "challenger-insight",
  "deal-room", "account-microsite", "onboarding-hub", "value-renewal-review",
  "content-series", "blog-series", "storefront", "webinar-hub",
  "event-noir", "event-luminous", "event-split",
  "case-metrics", "case-editorial", "case-modular",
  // Inside Dandy blocks: own their own scroll-driven internals (sticky cinema
  // pillars, scroll-progress letter reveal, parallax showcase) and the hero's
  // own entrance animation. Wrapping them in a transformed motion.div breaks
  // position:sticky and shifts getBoundingClientRect measurements.
  "id-hero", "id-intro", "id-cinema-pillars", "id-parallax-showcase", "id-spotlight",
  "spacer",
  // Blocks with an internal `position: sticky` panel. The reveal wrapper applies
  // a CSS transform (motion.div), and a transformed ancestor becomes the
  // containing block for descendants — which breaks `position: sticky` inside
  // the child. On published pages this strands the sticky panel (and, for tall
  // scroll containers, collapses them into a large whitespace gap). Excluding
  // them keeps the published render identical to the builder (which never wraps
  // blocks in the reveal motion.div). dandy-switchback already covers the tall
  // 100vh*N scroll variant above.
  "dandy-vertical-tabs", "roi-calculator", "dso-practice-nav",
  // Owns its own carousel state + transition animations; wrapping it in the
  // reveal motion.div double-animates the slide and fights the internal
  // opacity/scale transition.
  "quote-carousel",
  // Photo gallery sections with horizontal scroll / snap + active-index
  // carousel state. The reveal motion.div transform breaks the horizontal
  // scroll-snap container and double-animates the active-slide transition.
  "gallery-carousel-spotlight", "gallery-filmstrip",
  // Horizontal scroll-snap stepper row: the reveal motion.div transform breaks
  // the horizontal scroll-snap container, so it owns its own scroll interactivity.
  "how-it-works-horizontal-stepper",
  // Card Grid owns per-card hover interactivity (hover lift + image scale). The
  // reveal motion.div sets a persistent transform on the wrapper, which fights
  // the card's own hover transform on published pages. Excluding it keeps the
  // hover interaction identical to the builder.
  "feature-card-grid",
]);

function BlockRendererInner({ block: rawBlock, brand, onCtaClick, onBlockChange: rawOnBlockChange, animationsEnabled = true, pageId, testId, variantId, sessionId, pageVars, pageCta, isBuilder, path = [], renderChild, renderEmptySlot, renderTailSlot }: Props) {
  // Helper: render the children slot for container/overlay blocks. Uses the
  // caller-supplied renderChild (builder chrome) when provided, otherwise
  // recurses into BlockRenderer directly (viewer/published pages).
  const childrenArr: PageBlock[] = Array.isArray((rawBlock as PageBlock).children)
    ? ((rawBlock as PageBlock).children as PageBlock[])
    : [];
  // Container layout signal forwarded to the builder chrome. CSS-grid
  // containers (`grid` / `columns`) auto-place every direct child into a
  // grid cell, so the per-child insert chips and the tail-slot wrapper
  // would otherwise occupy real grid cells and shove all the actual
  // content into the right column. We tell the chrome to drop the chips
  // and let the tail/empty slots span the full row instead.
  const rawType = (rawBlock as PageBlock).type;
  const parentLayout: "stack" | "grid" =
    rawType === "grid" || rawType === "columns" ? "grid" : "stack";
  const renderChildren = (parentPath: BlockPath, kids: PageBlock[]): ReactNode => {
    if (kids.length === 0) {
      return renderEmptySlot ? renderEmptySlot(parentPath, parentLayout) : null;
    }
    if (renderChild) {
      const rendered = kids.map((c, i) => renderChild(c, i, parentPath, parentLayout));
      // Append a tail droppable so users can drop blocks AFTER the last
      // child (sortable "before over" semantics can't otherwise reach the
      // end-of-list slot). In grid layouts we use display:contents on the
      // wrapper so the inner slot becomes the grid item directly (and can
      // span the full row via its own gridColumn style).
      if (renderTailSlot) {
        const tailWrapStyle = parentLayout === "grid" ? { display: "contents" as const } : undefined;
        return [...rendered, <span key="__tail__" style={tailWrapStyle}>{renderTailSlot(parentPath, parentLayout)}</span>];
      }
      return rendered;
    }
    return kids.map((c, i) => (
      <BlockRenderer
        key={c.id}
        block={c}
        brand={brand}
        onCtaClick={onCtaClick}
        animationsEnabled={animationsEnabled}
        pageId={pageId}
        testId={testId}
        variantId={variantId}
        sessionId={sessionId}
        pageVars={pageVars}
        pageCta={pageCta}
        isBuilder={isBuilder}
        path={[...parentPath, i]}
        renderChild={renderChild}
        renderEmptySlot={renderEmptySlot}
        renderTailSlot={renderTailSlot}
      />
    ));
  };
  const childrenSlot = renderChildren(path, childrenArr);

  // Guard: AI-generated blocks saved before schema fix may lack a `props` object.
  // Ensure `block.props` always exists so child components don't crash on prop access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseBlock: typeof rawBlock = (rawBlock as any).props
    ? rawBlock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : ({ ...(rawBlock as any), props: {} } as typeof rawBlock);

  // Page CTA = single source of truth for each block's PRIMARY button. A block
  // follows it by default; it opts out via "Use a custom button here"
  // (blockSettings.useCustomCta). The transform overwrites ONLY primary CTA props
  // (label/url/action/chilipiper/modal/button colors) — secondary buttons read
  // their own untouched props. When there is no page CTA, `block === baseBlock`
  // so every pre-feature page renders byte-identically.
  const followsPageCta =
    baseBlock.blockSettings?.useCustomCta !== true &&
    ctaConfigHasValue(pageCta) &&
    blockHasPrimaryCta(baseBlock.props);
  const block: typeof rawBlock = followsPageCta
    ? ({ ...baseBlock, props: applyPageCtaToBlockProps(baseBlock.type, baseBlock.props, pageCta) } as typeof rawBlock)
    : baseBlock;

  // Persist guard: while following, the block component's edit callbacks rebuild
  // their updated block from `block` (whose primary CTA props are the injected
  // page CTA). Restore the ORIGINAL primary CTA before it flows back so the page
  // CTA is never baked into saved props; every other edit (and all secondary CTA
  // props) passes through untouched.
  const onBlockChange = followsPageCta && rawOnBlockChange
    ? (updated: PageBlock) =>
        rawOnBlockChange({ ...updated, props: restorePrimaryCtaProps(updated.props, baseBlock.props) } as PageBlock)
    : rawOnBlockChange;

  const heroContentPaddingX = block.type === "hero" && block.blockSettings?.paddingX && block.blockSettings.paddingX !== "none"
    ? PADDING_X_PX[block.blockSettings.paddingX]
    : undefined;

  const inner = (() => {
    switch (block.type) {
      case "hero":
        return (
          <BlockHero
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated: HeroBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
            animationsEnabled={animationsEnabled}
            contentPaddingX={heroContentPaddingX}
            childrenSlot={childrenArr.length > 0 || isBuilder ? childrenSlot : null}
          />
        );
      case "trust-bar":
        return (
          <BlockTrustBar
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "pas-section":
        return (
          <BlockPasSection
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: PasSectionBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "comparison":
        return (
          <BlockComparison
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated: ComparisonBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "value-pillars-icon-trio":
        return (
          <BlockValuePillarsIconTrio
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "value-pillars-outlined-cards":
        return (
          <BlockValuePillarsOutlinedCards
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "value-pillars-color-block-cards":
        return (
          <BlockValuePillarsColorBlockCards
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "value-pillars-divided-columns":
        return (
          <BlockValuePillarsDividedColumns
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "value-pillars-headline-badge":
        return (
          <BlockValuePillarsHeadlineBadge
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "value-pillars-card-columns":
        return (
          <BlockValuePillarsCardColumns
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "feature-photo-cards":
        return (
          <BlockFeaturePhotoCards
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "feature-card-grid":
        return (
          <BlockFeatureCardGrid
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "feature-big-features":
        return (
          <BlockFeatureBigFeatures
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onFieldChange={onBlockChange ? updated => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "stat-callout":
        return (
          <BlockStatCallout
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: StatCalloutBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "benefits-grid":
        return (
          <BlockBenefitsGrid
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: BenefitsGridBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
            animationsEnabled={animationsEnabled}
          />
        );
      case "testimonial":
        return (
          <BlockTestimonial
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: TestimonialBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "how-it-works":
        return (
          <BlockHowItWorks
            props={block.props}
            brand={brand}
            bgColor={block.blockSettings?.bgColor}
            onFieldChange={onBlockChange
              ? (updated: HowItWorksBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "product-grid":
        return (
          <BlockProductGrid
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated: ProductGridBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "photo-strip":
        return (
          <BlockPhotoStrip
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: PhotoStripBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "bottom-cta":
        return (
          <BlockBottomCta
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated: BottomCtaBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "video-section":
        return <BlockVideoSection props={block.props} brand={brand} onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "media-feature-reel":
        return <BlockMediaFeatureReel props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "media-looping-showcase":
        return <BlockMediaLoopingShowcase props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "media-thumbnail-grid":
        return <BlockMediaThumbnailGrid props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "media-video-split":
        return <BlockMediaVideoSplit props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "case-studies":
        return <BlockCaseStudies props={block.props} brand={brand} animationsEnabled={animationsEnabled} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "resources":
        return <BlockResources props={block.props} brand={brand} animationsEnabled={animationsEnabled} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "resource-link-list":
        return <BlockResourceLinkList props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "rich-text":
        return <BlockRichText props={block.props} brand={brand} />;
      case "custom-html":
        return <BlockCustomHtml props={block.props} brand={brand} />;
      case "grid-image":
        return <BlockGridImage props={block.props} brand={brand} />;
      case "grid-headline-sub":
        return <BlockGridHeadlineSub props={block.props} brand={brand} />;
      case "grid-paragraph-bullets":
        return <BlockGridParagraphBullets props={block.props} brand={brand} />;
      case "grid-headline-paragraph":
        return <BlockGridHeadlineParagraph props={block.props} brand={brand} />;
      case "grid-icon-feature":
        return <BlockGridIconFeature props={block.props} brand={brand} />;
      case "grid-stat":
        return <BlockGridStat props={block.props} brand={brand} />;
      case "grid-quote":
        return <BlockGridQuote props={block.props} brand={brand} />;
      case "grid-cta-tile":
        return <BlockGridCtaTile props={block.props} brand={brand} />;
      case "grid-logo":
        return <BlockGridLogo props={block.props} brand={brand} />;
      case "grid-video":
        return <BlockGridVideo props={block.props} brand={brand} />;
      case "custom-schema":
        return <BlockCustomSchema props={block.props} brand={brand} />;
      case "zigzag-features":
        return (
          <BlockZigzagFeatures
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: ZigzagFeaturesBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "product-showcase":
        return (
          <BlockProductShowcase
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: ProductShowcaseBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
            animationsEnabled={animationsEnabled}
          />
        );
      case "nav-header":
        return (
          <BlockNavHeader
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            isBuilder={isBuilder}
            onFieldChange={onBlockChange
              ? (updated: NavHeaderBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "cta-button":
        return (
          <BlockCtaButton
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated: CtaButtonBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "full-bleed-hero":
        return (
          <BlockFullBleedHero
            props={block.props}
            brand={brand}
            isBuilder={isBuilder}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
            onFieldChange={onBlockChange
              ? (updated: FullBleedHeroBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
            animationsEnabled={animationsEnabled}
            childrenSlot={childrenArr.length > 0 || isBuilder ? childrenSlot : null}
          />
        );
      case "parallax-image-hero":
        return (
          <BlockParallaxImageHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveDsoCtaUrl(block.props.ctaUrl, block.props.ctaMode)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
            animationsEnabled={animationsEnabled}
          />
        );
      case "footer":
        return <BlockFooter props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "form":
        return <BlockForm props={block.props} brand={brand} pageId={pageId} testId={testId} variantId={variantId} sessionId={sessionId} />;
      case "popup":
        return (
          <BlockPopup
            props={block.props}
            brand={brand}
            blockId={block.id}
            isEditing={!!onBlockChange}
            isBuilder={isBuilder}
            pageId={pageId}
            variantId={variantId ? String(variantId) : undefined}
            sessionId={sessionId}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
          />
        );
      case "sticky-bar":
        return (
          <BlockStickyBar
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
            isBuilder={isBuilder}
          />
        );
      case "sticky-header":
        return (
          <BlockStickyHeader
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.primaryCtaUrl ?? "#") : undefined}
            isBuilder={isBuilder}
          />
        );
      case "roi-calculator":
        return (
          <BlockRoiCalculator
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => {
              const url = block.props.ctaAction === "chilipiper" && block.props.chilipiperUrl
                ? `chilipiper:${block.props.chilipiperUrl}`
                : block.props.ctaUrl;
              onCtaClick(url);
            } : undefined}
          />
        );
      case "spacer":
        return (
          <div
            style={{
              height: `${block.props.height}px`,
              backgroundColor: block.props.backgroundColor === "transparent" ? undefined : block.props.backgroundColor,
            }}
          />
        );
      case "dso-insights-dashboard":
        return (
          <BlockDsoInsightsDashboard
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick("") : undefined}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dso-lab-tour":
        return (
          <BlockDsoLabTour
            props={block.props} brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dso-stat-bar":
        return <BlockDsoStatBar props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-success-stories":
        return <BlockDsoSuccessStories props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-challenges":
        return <BlockDsoChallenges props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-pilot-steps":
        return <BlockDsoPilotSteps props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-final-cta":
        return (
          <BlockDsoFinalCta
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            sessionId={sessionId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveDsoCtaUrl(block.props.primaryCtaUrl, block.props.primaryCtaMode)) : undefined}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dso-comparison":
        return (
          <BlockDsoComparison
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dso-heartland-hero":
        return (
          <BlockDsoHeartlandHero
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveDsoCtaUrl(block.props.primaryCtaUrl, block.props.primaryCtaMode)) : undefined}
            isBuilder={isBuilder}
            pageId={pageId}
            variantId={variantId}
          />
        );
      case "dandy-product-hero":
        return (
          <BlockDandyProductHero
            block={block}
            onCtaClick={onCtaClick ? (url) => onCtaClick(resolveDsoCtaUrl(url, block.props.primaryCtaMode)) : undefined}
            pageId={pageId}
            variantId={variantId}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dso-problem":
        return <BlockDsoProblem props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-ai-feature":
        return <BlockDsoAiFeature props={block.props} brand={brand} headlineColor={block.blockSettings?.headlineColor} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-stat-showcase":
        return <BlockDsoStatShowcase props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-scroll-story":
        return <BlockDsoScrollStory props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-scroll-story-hero":
        return (
          <BlockDsoScrollStoryHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dso-network-map":
        return (
          <BlockDsoNetworkMap
            props={block.props}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveDsoCtaUrl(block.props.ctaUrl, block.props.ctaMode)) : undefined}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dso-case-flow":
        return <BlockDsoCaseFlow props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-live-feed":
        return <BlockDsoLiveFeed props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-particle-mesh":
        return <BlockDsoParticleMesh props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-flow-canvas":
        return <BlockDsoFlowCanvas props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-bento-outcomes":
        return <BlockDsoBentoOutcomes props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-cta-capture":
        return <BlockDsoCtaCapture props={block.props} brand={brand} pageId={pageId} variantId={variantId} prefillCompany={pageVars?.["{{company}}"]} isBuilder={isBuilder} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-meet-team":
        return <BlockDsoMeetTeam props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-paradigm-shift":
        return <BlockDsoParadigmShift props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-partnership-perks":
        return <BlockDsoPartnershipPerks props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-products-grid":
        return <BlockDsoProductsGrid props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-promo-cards":
        return <BlockDsoPromoCards props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-activation-steps":
        return <BlockDsoActivationSteps props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-promises":
        return <BlockDsoPromises props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-testimonials":
        return <BlockDsoTestimonials props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-practice-nav":
        return <BlockDsoPracticeNav props={block.props} brand={brand} pageId={pageId} variantId={variantId} isBuilder={isBuilder} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-practice-hero":
        return <BlockDsoPracticeHero props={block.props} brand={brand} pageId={pageId} variantId={variantId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-stat-row":
        return <BlockDsoStatRow props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-faq":
        return <BlockDsoFaq props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-split-feature":
        return <BlockDsoSplitFeature props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-software-showcase":
        return <BlockDsoSoftwareShowcase props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-insights-video":
        return <BlockDsoInsightsVideo props={block.props} brand={brand} onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl ?? "#") : undefined} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dso-case-study":
        return (
          <BlockDsoCaseStudy
            props={block.props} brand={brand}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "dandy-versus":
        return <BlockDandyVersus props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-columns-v2":
        return <BlockDandyColumnsV2 props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-columns-v3":
        return <BlockDandyColumnsV3 props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-vertical-tabs":
        return <BlockDandyVerticalTabs props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-switchback":
        return <BlockDandySwitchback props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-site-header":
        return <BlockDandySiteHeader props={block.props} brand={brand} pageId={pageId} variantId={variantId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-site-footer":
        return <BlockDandySiteFooter props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-video-testimonials":
        return <BlockDandyVideoTestimonials props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-side-image-v6":
        return <BlockDandySideImageV6 props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-hero-v7-s3":
        return <BlockDandyHeroV7S3 props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} pageId={pageId} variantId={variantId} />;
      case "dandy-form-right-alt":
        return <BlockDandyFormRightAlt props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} pageId={pageId} variantId={variantId} />;
      case "dandy-conversion-panel-1":
        return <BlockDandyConversionPanel1 props={block.props} brand={brand} pageId={pageId} variantId={variantId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "dandy-cta-block":
        return <BlockDandyCtaBlock props={block.props} brand={brand} pageId={pageId} variantId={variantId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "one-pager-hero":
        return <BlockOnePagerHero props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "content-series":
        return <BlockContentSeries props={block.props} brand={brand} pageId={pageId} sessionId={sessionId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "webinar-hub":
        return <BlockWebinarHub props={block.props} brand={brand} pageId={pageId} variantId={variantId} testId={testId} sessionId={sessionId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "blog-series":
        return <BlockBlogSeries props={block.props} brand={brand} pageId={pageId} sessionId={sessionId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "storefront":
        return <BlockStorefront props={block.props} brand={brand} pageId={pageId} sessionId={sessionId} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "event-noir":
        return <BlockEventNoir props={block.props} brand={brand} isBuilder={isBuilder} />;
      case "event-luminous":
        return <BlockEventLuminous props={block.props} />;
      case "event-split":
        return <BlockEventSplit props={block.props} brand={brand} />;
      case "case-metrics":
        return <BlockCaseMetrics props={block.props} brand={brand} />;
      case "case-editorial":
        return <BlockCaseEditorial props={block.props} brand={brand} />;
      case "case-modular":
        return <BlockCaseModular props={block.props} />;
      case "event-page":
        return <BlockEventPage props={block.props} pageId={pageId} testId={testId} variantId={variantId} sessionId={sessionId} />;
      case "product-launch":
        return <BlockProductLaunch props={block.props} />;
      case "story-hub":
        return <BlockStoryHub props={block.props} />;
      case "event-landing-hero":
        return (
          <BlockEventLandingHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            testId={testId}
            variantId={variantId}
            sessionId={sessionId}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl ?? "") : undefined}
            onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined}
          />
        );
      case "spatial-tour":
        return <BlockSpatialTour props={block.props} />;
      case "business-case-split":
        return <BlockBusinessCaseSplit props={block.props} brand={brand} />;
      case "business-case-centered":
        return <BlockBusinessCaseCentered props={block.props} brand={brand} />;
      case "business-case-premium":
        return <BlockBusinessCasePremium props={block.props} brand={brand} isBuilder={isBuilder} />;
      case "storybrand-journey":
        return (
          <BlockStorybrandJourney
            props={block.props}
            brand={brand}
            isBuilder={isBuilder}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "exec-decision-brief":
        return (
          <BlockExecDecisionBrief
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "challenger-insight":
        return (
          <BlockChallengerInsight
            props={block.props}
            brand={brand}
            isBuilder={isBuilder}
            onCtaClick={onCtaClick
              ? () => onCtaClick(block.props.finalCtaUrl ?? block.props.heroCtaUrl ?? "#")
              : undefined}
          />
        );
      case "deal-room":
        return (
          <BlockDealRoom
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl ?? "#") : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "account-microsite":
        return (
          <BlockAccountMicrosite
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl ?? "#") : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "onboarding-hub":
        return (
          <BlockOnboardingHub
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl ?? "#") : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "value-renewal-review":
        return (
          <BlockValueRenewalReview
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl ?? "#") : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "scroll-assembly":
        return (
          <BlockScrollAssembly
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
            onCtaClick={onCtaClick}
          />
        );
      case "horizontal-showcase":
        return (
          <BlockHorizontalShowcase
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
            onCtaClick={onCtaClick}
          />
        );
      case "sticky-stack":
        return (
          <BlockStickyStack
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
            onCtaClick={onCtaClick}
          />
        );
      case "magazine-hero":
        return (
          <BlockMagazineHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "cinematic-video-hero":
        return (
          <BlockCinematicVideoHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "aurora-gradient-hero":
        return (
          <BlockAuroraGradientHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "editorial-split-hero":
        return (
          <BlockEditorialSplitHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "parallax-layers-hero":
        return (
          <BlockParallaxLayersHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            isBuilder={isBuilder}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "logo-wall":
        return (
          <BlockLogoWall
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "about-team":
        return (
          <BlockAboutTeam
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "logo-marquee":
        return (
          <BlockLogoMarquee
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "launch-spotlight-hero":
        return (
          <BlockLaunchSpotlightHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "bento-mosaic-hero":
        return (
          <BlockBentoMosaicHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "kinetic-type-hero":
        return (
          <BlockKineticTypeHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "glass-bento-features":
        return (
          <BlockGlassBentoFeatures
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "feature-tabs-showcase":
        return (
          <BlockFeatureTabsShowcase
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "stat-counter-band":
        return (
          <BlockStatCounterBand
            props={block.props}
            brand={brand}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "testimonial-wall":
        return (
          <BlockTestimonialWall
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "glass-pricing-tiers":
        return (
          <BlockGlassPricingTiers
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "aurora-cta-finale":
        return (
          <BlockAuroraCtaFinale
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl ?? "#") : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "rating-badges":
        return (
          <BlockRatingBadges
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "avatar-social-proof":
        return (
          <BlockAvatarSocialProof
            props={block.props}
            brand={brand}
            animationsEnabled={animationsEnabled}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "spotlight-glow-hero":
        return (
          <BlockSpotlightGlowHero
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "bold-statement":
        return (
          <BlockBoldStatement
            props={block.props}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined}
            onFieldChange={onBlockChange
              ? (updated) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "id-hero":
        return <BlockIdHero props={block.props} onCtaClick={onCtaClick} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-marquee":
        return <BlockIdMarquee props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-intro":
        return <BlockIdIntro props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-cinema-pillars":
        return <BlockIdCinemaPillars props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-parallax-showcase":
        return <BlockIdParallaxShowcase props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-system-flow":
        return <BlockIdSystemFlow props={block.props} />;
      case "id-form":
        return <BlockIdForm props={block.props} />;
      case "id-stats":
        return <BlockIdStats props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-invitation":
        return <BlockIdInvitation props={block.props} onCtaClick={onCtaClick} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-grid":
        return <BlockIdGrid props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-spotlight":
        return <BlockIdSpotlight props={block.props} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "id-reservation-pass":
        return (
          <BlockIdReservationPass
            props={block.props}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.primaryCtaUrl || "") : undefined}
          />
        );
      case "bento-showcase":
        return <BlockBentoShowcase props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} childrenSlot={childrenArr.length > 0 || isBuilder ? childrenSlot : null} />;
      case "gradient-pricing":
        return <BlockGradientPricing props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "editorial-carousel":
        return <BlockEditorialCarousel props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "menu-section":
        return <BlockMenuSection props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "hours-location":
        return <BlockHoursLocation props={block.props} brand={brand} onCtaClick={onCtaClick && block.props.ctaUrl ? () => onCtaClick(block.props.ctaUrl!) : undefined} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "before-after-gallery":
        return <BlockBeforeAfterGallery props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "cta-centered-minimal":
        return <BlockCtaCenteredMinimal props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "centered-logo-nav":
        return <BlockCenteredLogoNav props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "mega-menu-nav":
        return <BlockMegaMenuNav props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "minimal-nav":
        return <BlockMinimalNav props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "transparent-overlay-nav":
        return <BlockTransparentOverlayNav props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "split-media-row":
        return <BlockSplitMediaRow props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "full-bleed-split":
        return <BlockFullBleedSplit props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "icon-row":
        return <BlockIconRow props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "media-cards-row":
        return <BlockMediaCardsRow props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "stat-row":
        return <BlockStatRow props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "pas-icon-grid":
        return <BlockPasIconGrid props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "pas-split-image":
        return <BlockPasSplitImage props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "pas-stat-agitate":
        return <BlockPasStatAgitate props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "pas-before-after":
        return <BlockPasBeforeAfter props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "full-bleed-final-cta":
        return <BlockFullBleedFinalCta props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "split-form-final-cta":
        return <BlockSplitFormFinalCta props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "stat-backed-final-cta":
        return <BlockStatBackedFinalCta props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "social-urgency-final-cta":
        return <BlockSocialUrgencyFinalCta props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "gradient-glow-final-cta":
        return <BlockGradientGlowFinalCta props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "video-background-final-cta":
        return <BlockVideoBackgroundFinalCta props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "cta-split-image":
        return <BlockCtaSplitImage props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "cta-stat-backed":
        return <BlockCtaStatBacked props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "cta-gradient-banner":
        return <BlockCtaGradientBanner props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "gallery-carousel-spotlight":
        return <BlockGalleryCarouselSpotlight props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "gallery-filmstrip":
        return <BlockGalleryFilmstrip props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "case-study-card-grid":
        return <BlockCaseStudyCardGrid props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "case-study-logo-results-row":
        return <BlockCaseStudyLogoResultsRow props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "case-study-metric-triptych":
        return <BlockCaseStudyMetricTriptych props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "case-study-spotlight-feature":
        return <BlockCaseStudySpotlightFeature props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "gallery-masonry":
        return <BlockGalleryMasonry props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "gallery-split-feature":
        return <BlockGallerySplitFeature props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "benefits-alternating-rows":
        return <BlockBenefitsAlternatingRows props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "how-it-works-alternating":
        return <BlockHowItWorksAlternating props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "how-it-works-numbered-bento":
        return <BlockHowItWorksNumberedBento props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "how-it-works-vertical-timeline":
        return <BlockHowItWorksVerticalTimeline props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "how-it-works-horizontal-stepper":
        return <BlockHowItWorksHorizontalStepper props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "benefits-bento":
        return <BlockBenefitsBento props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "features-bento-showcase":
        return <BlockFeaturesBentoShowcase props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "features-spotlight-cards":
        return <BlockFeaturesSpotlightCards props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "features-tabbed-categories":
        return <BlockFeaturesTabbedCategories props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "features-comparison-checklist":
        return <BlockFeaturesComparisonChecklist props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "benefits-icon-grid":
        return <BlockBenefitsIconGrid props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "benefits-stat-led":
        return <BlockBenefitsStatLed props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "speaker-grid":
        return <BlockSpeakerGrid props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "quote-carousel":
        return <BlockQuoteCarousel props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "quote-library":
        return <BlockQuoteLibrary props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "quote-with-image":
        return <BlockQuoteWithImage props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "single-quote":
        return <BlockSingleQuote props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "testimonial-grid":
        return <BlockTestimonialGrid props={block.props} brand={brand} onFieldChange={onBlockChange ? (updated) => onBlockChange({ ...block, props: updated }) : undefined} />;
      case "section":
        return <BlockSection props={block.props} brand={brand} childrenSlot={childrenSlot} isBuilder={isBuilder} />;
      case "columns":
        return <BlockColumns props={block.props} childrenSlot={childrenSlot} isBuilder={isBuilder} />;
      case "grid":
        return <BlockGrid props={block.props} childrenSlot={childrenSlot} isBuilder={isBuilder} />;
      case "stack":
        return <BlockStack props={block.props} childrenSlot={childrenSlot} isBuilder={isBuilder} />;
      default: {
        const _exhaustive: never = block;
        void _exhaustive;
        return (
          <div className="p-8 text-center bg-slate-100 text-slate-500 text-sm">
            Unknown block type
          </div>
        );
      }
    }
  })();

  const gatedSettings = gateSettingsByCapabilities(block.type, block.blockSettings);
  const outerSettings = heroContentPaddingX && gatedSettings
    ? { ...gatedSettings, paddingX: undefined }
    : gatedSettings;

  // Skip the inner reveal for the same blocks the outer viewer skips
  // (layout chrome, self-contained scroll-driven blocks, first-paint heroes),
  // and always skip on the builder canvas.
  const shouldReveal = animationsEnabled && !isBuilder && !NO_REVEAL.has(block.type);

  const wrapped = wrapWithSettings(inner, outerSettings, animationsEnabled);
  const final = shouldReveal ? <Reveal>{wrapped}</Reveal> : wrapped;

  return (
    <PageContextProvider value={{ pageId, testId, variantId, sessionId, pageCta, tenantDefaultCta: brandDefaultCtaConfig(brand) }}>
      <BlockErrorBoundary
        key={`${block.id}-${block.type}`}
        blockType={block.type}
        isEditor={!!isBuilder || !!onBlockChange}
      >
        {final}
      </BlockErrorBoundary>
    </PageContextProvider>
  );
}

/** Memoize so a keystroke in the inspector that updates one block doesn't
 *  reconcile every other block on the page. Parent already wraps callbacks
 *  in useCallback so default shallow-equal props comparison works well. */
export const BlockRenderer = memo(BlockRendererInner);
