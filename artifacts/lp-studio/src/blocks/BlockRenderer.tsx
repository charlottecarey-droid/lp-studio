import type { PageBlock, BlockSettings, HeroBlockProps, PasSectionBlockProps, ComparisonBlockProps, StatCalloutBlockProps, BenefitsGridBlockProps, TestimonialBlockProps, HowItWorksBlockProps, BottomCtaBlockProps, ZigzagFeaturesBlockProps, ProductShowcaseBlockProps, NavHeaderBlockProps, CtaButtonBlockProps, FullBleedHeroBlockProps } from "@/lib/block-types";
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
import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface Props {
  block: PageBlock;
  brand: BrandConfig;
  onCtaClick?: (url: string) => void;
  onBlockChange?: (updated: PageBlock) => void;
  animationsEnabled?: boolean;
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
  if (settings.cardBgColor) (style as Record<string, string>)["--card-bg"] = settings.cardBgColor;

  const hasBgImage = !!settings.bgImageUrl;

  if (!hasBgImage && Object.keys(style).length === 0) return children;

  if (hasBgImage) {
    return (
      <div style={{ ...style, position: "relative" }}>
        <BgImageLayer
          url={settings.bgImageUrl!}
          opacity={settings.bgImageOpacity ?? 100}
          parallax={!!(settings.bgImageParallax && animationsEnabled)}
        />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    );
  }

  return <div style={style}>{children}</div>;
}

export function BlockRenderer({ block, brand, onCtaClick, onBlockChange, animationsEnabled = true }: Props) {
  const inner = (() => {
    switch (block.type) {
      case "hero":
        return (
          <BlockHero
            props={block.props}
            brand={brand}
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
            onFieldChange={onBlockChange
              ? (updated: HeroBlockProps) => onBlockChange({ ...block, props: updated })
              : undefined}
            animationsEnabled={animationsEnabled}
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
            onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined}
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

  return <>{wrapWithSettings(inner, block.blockSettings, animationsEnabled)}</>;
}
