import type { PageBlock } from "@/lib/block-types";
import { HeroPanel } from "./HeroPanel";
import { TrustBarPanel } from "./TrustBarPanel";
import { PasSectionPanel } from "./PasSectionPanel";
import { ComparisonPanel } from "./ComparisonPanel";
import { StatCalloutPanel } from "./StatCalloutPanel";
import { BenefitsGridPanel } from "./BenefitsGridPanel";
import { TestimonialPanel } from "./TestimonialPanel";
import { HowItWorksPanel } from "./HowItWorksPanel";
import { ProductGridPanel } from "./ProductGridPanel";
import { PhotoStripPanel } from "./PhotoStripPanel";
import { BottomCtaPanel } from "./BottomCtaPanel";
import { VideoSectionPanel } from "./VideoSectionPanel";
import CaseStudiesPanel from "./CaseStudiesPanel";
import ResourcesPanel from "./ResourcesPanel";
import { RichTextPanel } from "./RichTextPanel";
import { CustomHtmlPanel } from "./CustomHtmlPanel";
import { ZigzagFeaturesPanel } from "./ZigzagFeaturesPanel";
import { ProductShowcasePanel } from "./ProductShowcasePanel";
import { NavHeaderPanel } from "./NavHeaderPanel";
import { CtaButtonPanel } from "./CtaButtonPanel";
import { getBlockDef } from "@/lib/block-types";

interface Props {
  block: PageBlock;
  onChange: (block: PageBlock) => void;
}

export function PropertyPanel({ block, onChange }: Props) {
  const def = getBlockDef(block.type);

  const renderForm = () => {
    switch (block.type) {
      case "hero":
        return (
          <HeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "trust-bar":
        return (
          <TrustBarPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "pas-section":
        return (
          <PasSectionPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "comparison":
        return (
          <ComparisonPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "stat-callout":
        return (
          <StatCalloutPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "benefits-grid":
        return (
          <BenefitsGridPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "testimonial":
        return (
          <TestimonialPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "how-it-works":
        return (
          <HowItWorksPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "product-grid":
        return (
          <ProductGridPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "photo-strip":
        return (
          <PhotoStripPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "bottom-cta":
        return (
          <BottomCtaPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "video-section":
        return (
          <VideoSectionPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "case-studies":
        return (
          <CaseStudiesPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "resources":
        return (
          <ResourcesPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "rich-text":
        return (
          <RichTextPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "custom-html":
        return (
          <CustomHtmlPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "zigzag-features":
        return (
          <ZigzagFeaturesPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "product-showcase":
        return (
          <ProductShowcasePanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "nav-header":
        return (
          <NavHeaderPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "cta-button":
        return (
          <CtaButtonPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      default: {
        const _exhaustive: never = block;
        void _exhaustive;
        return <p className="text-sm text-muted-foreground">No settings available for this block.</p>;
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {def?.category ?? "Block"}
        </p>
        <h3 className="font-semibold text-sm text-foreground mt-0.5">{def?.label ?? block.type}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {renderForm()}
      </div>
    </div>
  );
}
