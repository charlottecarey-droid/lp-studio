import type { PageBlock } from "@/lib/block-types";
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

interface Props {
  block: PageBlock;
  brand: BrandConfig;
  onCtaClick?: (url: string) => void;
}

export function BlockRenderer({ block, brand, onCtaClick }: Props) {
  switch (block.type) {
    case "hero":
      return <BlockHero props={block.props} brand={brand} onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined} />;
    case "trust-bar":
      return <BlockTrustBar props={block.props} brand={brand} />;
    case "pas-section":
      return <BlockPasSection props={block.props} brand={brand} />;
    case "comparison":
      return <BlockComparison props={block.props} brand={brand} onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined} />;
    case "stat-callout":
      return <BlockStatCallout props={block.props} brand={brand} />;
    case "benefits-grid":
      return <BlockBenefitsGrid props={block.props} brand={brand} />;
    case "testimonial":
      return <BlockTestimonial props={block.props} brand={brand} />;
    case "how-it-works":
      return <BlockHowItWorks props={block.props} brand={brand} />;
    case "product-grid":
      return <BlockProductGrid props={block.props} brand={brand} />;
    case "photo-strip":
      return <BlockPhotoStrip props={block.props} brand={brand} />;
    case "bottom-cta":
      return <BlockBottomCta props={block.props} brand={brand} onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined} />;
    case "video-section":
      return <BlockVideoSection props={block.props} brand={brand} onCtaClick={onCtaClick ? () => onCtaClick(block.props.ctaUrl) : undefined} />;
    case "case-studies":
      return <BlockCaseStudies props={block.props} brand={brand} />;
    case "resources":
      return <BlockResources props={block.props} brand={brand} />;
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
}
