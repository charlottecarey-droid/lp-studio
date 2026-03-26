import { Trash2, SlidersHorizontal, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageBlock, BlockSettings } from "@/lib/block-types";
import { BlockSettingsPanel } from "./BlockSettingsPanel";
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
import { FullBleedHeroPanel } from "./FullBleedHeroPanel";
import { FooterPanel } from "./FooterPanel";
import { FormPanel } from "./FormPanel";
import { PopupPanel } from "./PopupPanel";
import { StickyBarPanel } from "./StickyBarPanel";
import { SpacerPanel } from "./SpacerPanel";
import { getBlockDef } from "@/lib/block-types";

interface Props {
  block: PageBlock;
  onChange: (block: PageBlock) => void;
  onDelete?: () => void;
  hideBlockSettings?: boolean;
  brandVoiceSet?: boolean;
  pageId?: number;
  onApplyCtaToAll?: () => void;
}

export function PropertyPanel({ block, onChange, onDelete, hideBlockSettings = false, brandVoiceSet, pageId, onApplyCtaToAll }: Props) {
  const def = getBlockDef(block.type);

  const renderForm = () => {
    switch (block.type) {
      case "hero":
        return (
          <HeroPanel
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
            onApplyCtaToAll={onApplyCtaToAll}
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
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "comparison":
        return (
          <ComparisonPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            onApplyCtaToAll={onApplyCtaToAll}
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
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
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
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
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
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
            onApplyCtaToAll={onApplyCtaToAll}
          />
        );
      case "video-section":
        return (
          <VideoSectionPanel
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
            onApplyCtaToAll={onApplyCtaToAll}
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
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
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
            onApplyCtaToAll={onApplyCtaToAll}
          />
        );
      case "full-bleed-hero":
        return (
          <FullBleedHeroPanel
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
            onApplyCtaToAll={onApplyCtaToAll}
          />
        );
      case "footer":
        return (
          <FooterPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "form":
        return (
          <FormPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            pageId={pageId}
          />
        );
      case "popup":
        return (
          <PopupPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            onApplyCtaToAll={onApplyCtaToAll}
          />
        );
      case "sticky-bar":
        return (
          <StickyBarPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            onApplyCtaToAll={onApplyCtaToAll}
          />
        );
      case "spacer":
        return (
          <SpacerPanel
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
      <div className="px-4 pt-4 pb-0 border-b bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {def?.category ?? "Block"}
        </p>
        <h3 className="font-semibold text-sm text-foreground mt-0.5 mb-3">{def?.label ?? block.type}</h3>
        {!hideBlockSettings ? (
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="w-full h-8 mb-0 rounded-none rounded-t bg-transparent border-0 p-0 gap-0">
              <TabsTrigger
                value="content"
                className="flex-1 h-8 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#003A30] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <AlignLeft className="w-3 h-3" />
                Content
              </TabsTrigger>
              <TabsTrigger
                value="style"
                className="flex-1 h-8 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#003A30] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <SlidersHorizontal className="w-3 h-3" />
                Style
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-0 border-0 p-0">
              <div className="p-4 overflow-y-auto">
                {renderForm()}
                {onDelete && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <Button variant="destructive" size="sm" className="w-full gap-2" onClick={onDelete}>
                      <Trash2 className="w-3.5 h-3.5" /> Remove Block
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="style" className="mt-0 border-0 p-0">
              <div className="p-4 overflow-y-auto">
                <BlockSettingsPanel
                  settings={block.blockSettings}
                  onChange={(settings: BlockSettings) => onChange({ ...block, blockSettings: settings })}
                />
                {onDelete && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <Button variant="destructive" size="sm" className="w-full gap-2" onClick={onDelete}>
                      <Trash2 className="w-3.5 h-3.5" /> Remove Block
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {renderForm()}
            {onDelete && (
              <div className="mt-6 pt-4 border-t border-border">
                <Button variant="destructive" size="sm" className="w-full gap-2" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove Block
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
