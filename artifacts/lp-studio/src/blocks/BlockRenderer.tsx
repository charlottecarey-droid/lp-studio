import type { PageBlock, BlockSettings, HeroBlockProps, PasSectionBlockProps, ComparisonBlockProps, StatCalloutBlockProps, BenefitsGridBlockProps, TestimonialBlockProps, HowItWorksBlockProps, BottomCtaBlockProps, ZigzagFeaturesBlockProps, ProductShowcaseBlockProps, NavHeaderBlockProps, CtaButtonBlockProps, FullBleedHeroBlockProps, PopupBlockProps, StickyBarBlockProps } from "@/lib/block-types";
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
import { BlockDsoPracticeHero } from "./BlockDsoPracticeHero";
import { BlockDsoStatRow } from "./BlockDsoStatRow";
import { BlockDsoFaq } from "./BlockDsoFaq";
import { BlockDsoSplitFeature } from "./BlockDsoSplitFeature";
import { BlockDsoSoftwareShowcase } from "./BlockDsoSoftwareShowcase";
import type { BrandConfig } from "@/lib/brand-config";
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
import BlockCaseStudies from "./BlockCaseStudies";
import BlockResources from "./BlockResources";
import { BlockRichText } from "./BlockRichText";
import { BlockCustomHtml } from "./BlockCustomHtml";
import { BlockZigzagFeatures } from "./BlockZigzagFeatures";
import { BlockProductShowcase } from "./BlockProductShowcase";
import { BlockNavHeader } from "./BlockNavHeader";
import { BlockCtaButton } from "./BlockCtaButton";
import { BlockFullBleedHero } from "./BlockFullBleedHero";
import { BlockFooter } from "./BlockFooter";
import { BlockForm } from "./BlockForm";
import { BlockPopup } from "./BlockPopup";
import { BlockStickyBar } from "./BlockStickyBar";
import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface Props {
  block: PageBlock;
  brand: BrandConfig;
  onCtaClick?: (url: string) => void;
  onBlockChange?: (updated: PageBlock) => void;
  animationsEnabled?: boolean;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
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

  if (!hasBgImage && Object.keys(style).length === 0 && blkBgVar === null) {
    if (!anchorId) return children;
    return <div id={anchorId}>{children}</div>;
  }

  if (hasBgImage) {
    return (
      <div id={anchorId} {...blkBgAttr} style={{ ...(blkBgAttr.style as React.CSSProperties), position: "relative" }}>
        <BgImageLayer
          url={settings.bgImageUrl!}
          opacity={settings.bgImageOpacity ?? 100}
          parallax={!!(settings.bgImageParallax && animationsEnabled)}
        />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    );
  }

  return <div id={anchorId} {...blkBgAttr}>{children}</div>;
}

function resolveCtaUrl(props: { ctaUrl?: string; ctaAction?: string; chilipiperUrl?: string }): string {
  if (props.ctaAction === "chilipiper" && props.chilipiperUrl) {
    return `chilipiper:${props.chilipiperUrl}`;
  }
  return props.ctaUrl ?? "#";
}

export function BlockRenderer({ block, brand, onCtaClick, onBlockChange, animationsEnabled = true, pageId, variantId, sessionId }: Props) {
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
          />
        );
      case "trust-bar":
        return <BlockTrustBar props={block.props} brand={brand} animationsEnabled={animationsEnabled} />;
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
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
            onFieldChange={onBlockChange
              ? (updated: ComparisonBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
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
            onFieldChange={onBlockChange
              ? (updated: HowItWorksBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
          />
        );
      case "product-grid":
        return <BlockProductGrid props={block.props} brand={brand} animationsEnabled={animationsEnabled} />;
      case "photo-strip":
        return <BlockPhotoStrip props={block.props} brand={brand} />;
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
        return <BlockVideoSection props={block.props} brand={brand} onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined} />;
      case "case-studies":
        return <BlockCaseStudies props={block.props} brand={brand} animationsEnabled={animationsEnabled} />;
      case "resources":
        return <BlockResources props={block.props} brand={brand} animationsEnabled={animationsEnabled} />;
      case "rich-text":
        return <BlockRichText props={block.props} brand={brand} />;
      case "custom-html":
        return <BlockCustomHtml props={block.props} brand={brand} />;
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
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
            onFieldChange={onBlockChange
              ? (updated: FullBleedHeroBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
            animationsEnabled={animationsEnabled}
          />
        );
      case "footer":
        return <BlockFooter props={block.props} brand={brand} />;
      case "form":
        return <BlockForm props={block.props} brand={brand} pageId={pageId} variantId={variantId} sessionId={sessionId} />;
      case "popup":
        return (
          <BlockPopup
            props={block.props}
            brand={brand}
            blockId={block.id}
            isEditing={!!onBlockChange}
            pageId={pageId}
            variantId={variantId}
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
          />
        );
      case "dso-lab-tour":
        return (
          <BlockDsoLabTour
            props={block.props}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
          />
        );
      case "dso-stat-bar":
        return <BlockDsoStatBar props={block.props} />;
      case "dso-success-stories":
        return <BlockDsoSuccessStories props={block.props} />;
      case "dso-challenges":
        return <BlockDsoChallenges props={block.props} />;
      case "dso-pilot-steps":
        return <BlockDsoPilotSteps props={block.props} />;
      case "dso-final-cta":
        return (
          <BlockDsoFinalCta
            props={block.props}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.primaryCtaUrl) : undefined}
          />
        );
      case "dso-comparison":
        return (
          <BlockDsoComparison
            props={block.props}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
            animationsEnabled={animationsEnabled}
          />
        );
      case "dso-heartland-hero":
        return (
          <BlockDsoHeartlandHero
            props={block.props}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.primaryCtaUrl) : undefined}
          />
        );
      case "dso-problem":
        return <BlockDsoProblem props={block.props} />;
      case "dso-ai-feature":
        return <BlockDsoAiFeature props={block.props} />;
      case "dso-stat-showcase":
        return <BlockDsoStatShowcase props={block.props} />;
      case "dso-scroll-story":
        return <BlockDsoScrollStory props={block.props} />;
      case "dso-scroll-story-hero":
        return <BlockDsoScrollStoryHero props={block.props} />;
      case "dso-network-map":
        return <BlockDsoNetworkMap props={block.props} />;
      case "dso-case-flow":
        return <BlockDsoCaseFlow props={block.props} />;
      case "dso-live-feed":
        return <BlockDsoLiveFeed props={block.props} />;
      case "dso-particle-mesh":
        return <BlockDsoParticleMesh props={block.props} />;
      case "dso-flow-canvas":
        return <BlockDsoFlowCanvas props={block.props} />;
      case "dso-bento-outcomes":
        return <BlockDsoBentoOutcomes props={block.props} brand={brand} />;
      case "dso-cta-capture":
        return <BlockDsoCtaCapture props={block.props} pageId={pageId} variantId={variantId} />;
      case "dso-meet-team":
        return <BlockDsoMeetTeam props={block.props} brand={brand} />;
      case "dso-paradigm-shift":
        return <BlockDsoParadigmShift props={block.props} brand={brand} />;
      case "dso-partnership-perks":
        return <BlockDsoPartnershipPerks props={block.props} brand={brand} />;
      case "dso-products-grid":
        return <BlockDsoProductsGrid props={block.props} brand={brand} />;
      case "dso-promo-cards":
        return <BlockDsoPromoCards props={block.props} />;
      case "dso-activation-steps":
        return <BlockDsoActivationSteps props={block.props} brand={brand} />;
      case "dso-promises":
        return <BlockDsoPromises props={block.props} brand={brand} />;
      case "dso-testimonials":
        return <BlockDsoTestimonials props={block.props} brand={brand} />;
      case "dso-practice-hero":
        return <BlockDsoPracticeHero props={block.props} brand={brand} />;
      case "dso-stat-row":
        return <BlockDsoStatRow props={block.props} brand={brand} />;
      case "dso-faq":
        return <BlockDsoFaq props={block.props} brand={brand} />;
      case "dso-split-feature":
        return <BlockDsoSplitFeature props={block.props} brand={brand} />;
      case "dso-software-showcase":
        return <BlockDsoSoftwareShowcase props={block.props} brand={brand} />;
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

  const outerSettings = heroContentPaddingX && block.blockSettings
    ? { ...block.blockSettings, paddingX: undefined }
    : block.blockSettings;

  return <>{wrapWithSettings(inner, outerSettings, animationsEnabled)}</>;
}
