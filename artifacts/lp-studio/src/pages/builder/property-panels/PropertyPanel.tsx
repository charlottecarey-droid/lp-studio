import { useState, useEffect, type ReactNode } from "react";
import { Trash2, SlidersHorizontal, AlignLeft, Plus, GripVertical, RefreshCcw, Loader2, BookmarkPlus, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageBlock, BlockSettings, CtaMode, DsoCaseFlowStage, DsoCaseStudyExtraSection } from "@/lib/block-types";
import { DSO_CASE_FLOW_DEFAULT_STAGES, createBlock } from "@/lib/block-types";
import { getBgOptions, type BackgroundStyle } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import type { CtaConfig } from "@/lib/cta/ctaConfig";
import { ctaConfigHasValue, blockHasPrimaryCta } from "@/lib/cta/ctaConfig";
import { buildBlockCtaSource } from "@/lib/cta/ctaSource";
import { BlockSettingsPanel, ColorField } from "./BlockSettingsPanel";
import { BrandSwatches } from "@/components/BrandSwatches";
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
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { VideoSectionPanel } from "./VideoSectionPanel";
import CaseStudiesPanel from "./CaseStudiesPanel";
import ResourcesPanel from "./ResourcesPanel";
import ResourceLinkListPanel from "./ResourceLinkListPanel";
import { RichTextPanel } from "./RichTextPanel";
import { CustomHtmlPanel } from "./CustomHtmlPanel";
// --- Graduated section blocks (auto-batched routing) ---
import { BenefitsAlternatingRowsPanel } from "./BenefitsAlternatingRowsPanel";
import { BenefitsBentoPanel } from "./BenefitsBentoPanel";
import { BenefitsIconGridPanel } from "./BenefitsIconGridPanel";
import { BenefitsStatLedPanel } from "./BenefitsStatLedPanel";
import { QuoteCarouselPanel } from "./QuoteCarouselPanel";
import { QuoteLibraryPanel } from "./QuoteLibraryPanel";
import { QuoteWithImagePanel } from "./QuoteWithImagePanel";
import { SingleQuotePanel } from "./SingleQuotePanel";
import { TestimonialGridPanel } from "./TestimonialGridPanel";
import { GalleryCarouselSpotlightPanel } from "./GalleryCarouselSpotlightPanel";
import { GalleryFilmstripPanel } from "./GalleryFilmstripPanel";
import { GalleryMasonryPanel } from "./GalleryMasonryPanel";
import { GallerySplitFeaturePanel } from "./GallerySplitFeaturePanel";
import { FeaturesBentoShowcasePanel } from "./FeaturesBentoShowcasePanel";
import { FeaturesComparisonChecklistPanel } from "./FeaturesComparisonChecklistPanel";
import { FeaturesSpotlightCardsPanel } from "./FeaturesSpotlightCardsPanel";
import { FeaturesTabbedCategoriesPanel } from "./FeaturesTabbedCategoriesPanel";
import { HowItWorksAlternatingPanel } from "./HowItWorksAlternatingPanel";
import { HowItWorksHorizontalStepperPanel } from "./HowItWorksHorizontalStepperPanel";
import { HowItWorksNumberedBentoPanel } from "./HowItWorksNumberedBentoPanel";
import { HowItWorksVerticalTimelinePanel } from "./HowItWorksVerticalTimelinePanel";
import { MediaFeatureReelPanel } from "./MediaFeatureReelPanel";
import { MediaLoopingShowcasePanel } from "./MediaLoopingShowcasePanel";
import { MediaThumbnailGridPanel } from "./MediaThumbnailGridPanel";
import { MediaVideoSplitPanel } from "./MediaVideoSplitPanel";
import { CtaCenteredMinimalPanel } from "./CtaCenteredMinimalPanel";
import { CenteredLogoNavPanel } from "./CenteredLogoNavPanel";
import { MegaMenuNavPanel } from "./MegaMenuNavPanel";
import { MinimalNavPanel } from "./MinimalNavPanel";
import { TransparentOverlayNavPanel } from "./TransparentOverlayNavPanel";
import { SplitMediaRowPanel } from "./SplitMediaRowPanel";
import { FullBleedSplitPanel } from "./FullBleedSplitPanel";
import { IconRowPanel } from "./IconRowPanel";
import { MediaCardsRowPanel } from "./MediaCardsRowPanel";
import { StatRowPanel } from "./StatRowPanel";
import { CtaGradientBannerPanel } from "./CtaGradientBannerPanel";
import { CtaSplitImagePanel } from "./CtaSplitImagePanel";
import { CtaStatBackedPanel } from "./CtaStatBackedPanel";
import { PasIconGridPanel } from "./PasIconGridPanel";
import { PasSplitImagePanel } from "./PasSplitImagePanel";
import { PasStatAgitatePanel } from "./PasStatAgitatePanel";
import { PasBeforeAfterPanel } from "./PasBeforeAfterPanel";
import { FullBleedFinalCtaPanel } from "./FullBleedFinalCtaPanel";
import { SplitFormFinalCtaPanel } from "./SplitFormFinalCtaPanel";
import { StatBackedFinalCtaPanel } from "./StatBackedFinalCtaPanel";
import { SocialUrgencyFinalCtaPanel } from "./SocialUrgencyFinalCtaPanel";
import { GradientGlowFinalCtaPanel } from "./GradientGlowFinalCtaPanel";
import { VideoBackgroundFinalCtaPanel } from "./VideoBackgroundFinalCtaPanel";
import { CaseStudyCardGridPanel } from "./CaseStudyCardGridPanel";
import { CaseStudyLogoResultsRowPanel } from "./CaseStudyLogoResultsRowPanel";
import { CaseStudyMetricTriptychPanel } from "./CaseStudyMetricTriptychPanel";
import { CaseStudySpotlightFeaturePanel } from "./CaseStudySpotlightFeaturePanel";
import type {
  BenefitsAlternatingRowsBlockProps,
  BenefitsBentoBlockProps,
  BenefitsIconGridBlockProps,
  BenefitsStatLedBlockProps,
  QuoteCarouselBlockProps,
  QuoteLibraryBlockProps,
  QuoteWithImageBlockProps,
  SingleQuoteBlockProps,
  TestimonialGridBlockProps,
  GalleryCarouselSpotlightBlockProps,
  GalleryFilmstripBlockProps,
  GalleryMasonryBlockProps,
  GallerySplitFeatureBlockProps,
  FeaturesBentoShowcaseBlockProps,
  FeaturesComparisonChecklistBlockProps,
  FeaturesSpotlightCardsBlockProps,
  FeaturesTabbedCategoriesBlockProps,
  HowItWorksAlternatingBlockProps,
  HowItWorksHorizontalStepperBlockProps,
  HowItWorksNumberedBentoBlockProps,
  HowItWorksVerticalTimelineBlockProps,
  MediaFeatureReelBlockProps,
  MediaLoopingShowcaseBlockProps,
  MediaThumbnailGridBlockProps,
  MediaVideoSplitBlockProps,
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
  CtaGradientBannerBlockProps,
  CtaSplitImageBlockProps,
  CtaStatBackedBlockProps,
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
  CaseStudyCardGridBlockProps,
  CaseStudyLogoResultsRowBlockProps,
  CaseStudyMetricTriptychBlockProps,
  CaseStudySpotlightFeatureBlockProps,
} from "@/lib/block-types";
import {
  GridImagePanel,
  GridHeadlineSubPanel,
  GridParagraphBulletsPanel,
  GridHeadlineParagraphPanel,
  GridIconFeaturePanel,
  GridStatPanel,
  GridQuotePanel,
  GridCtaTilePanel,
  GridLogoPanel,
  GridVideoPanel,
} from "./GridPiecePanels";
import { CustomSchemaPanel } from "./CustomSchemaPanel";
import { ZigzagFeaturesPanel } from "./ZigzagFeaturesPanel";
import { ProductShowcasePanel } from "./ProductShowcasePanel";
import { NavHeaderPanel } from "./NavHeaderPanel";
import { CtaButtonPanel } from "./CtaButtonPanel";
import { FullBleedHeroPanel } from "./FullBleedHeroPanel";
import { AiScanHeroPanel } from "./AiScanHeroPanel";
import { ParallaxImageHeroPanel } from "./ParallaxImageHeroPanel";
import { FooterPanel } from "./FooterPanel";
import { ModalFormSourcePanel } from "./ModalFormSourcePanel";
import { FormPanel } from "./FormPanel";
import { PopupPanel } from "./PopupPanel";
import { StickyBarPanel } from "./StickyBarPanel";
import { SpacerPanel } from "./SpacerPanel";
import { RoiCalculatorPanel } from "./RoiCalculatorPanel";
import { DsoMeetTeamPanel } from "./DsoMeetTeamPanel";
import { DsoPracticeNavPanel } from "./DsoPracticeNavPanel";
import { DandyVersusPanel } from "./DandyVersusPanel";
import { DandyColumnsV2Panel } from "./DandyColumnsV2Panel";
import { DandyColumnsV3Panel } from "./DandyColumnsV3Panel";
import { DandyVerticalTabsPanel } from "./DandyVerticalTabsPanel";
import { DandySwitchbackPanel } from "./DandySwitchbackPanel";
import { ScrollAssemblyPanel } from "./ScrollAssemblyPanel";
import { HorizontalShowcasePanel } from "./HorizontalShowcasePanel";
import { StickyStackPanel } from "./StickyStackPanel";
import { DandySiteHeaderPanel } from "./DandySiteHeaderPanel";
import { DandySiteFooterPanel } from "./DandySiteFooterPanel";
import { DandyVideoTestimonialsPanel } from "./DandyVideoTestimonialsPanel";
import { DandySideImageV6Panel } from "./DandySideImageV6Panel";
import { DandyHeroV7S3Panel } from "./DandyHeroV7S3Panel";
import { DandyFormRightAltPanel } from "./DandyFormRightAltPanel";
import { DandyConversionPanel1Panel } from "./DandyConversionPanel1Panel";
import { DandyCtaBlockPanel } from "./DandyCtaBlockPanel";
import { OnePagerHeroPanel } from "./OnePagerHeroPanel";
import { EventPagePanel } from "./EventPagePanel";
import { ProductLaunchPanel } from "./ProductLaunchPanel";
import { StoryHubPanel } from "./StoryHubPanel";
import { BentoShowcasePanel } from "./BentoShowcasePanel";
import { MagazineHeroPanel } from "./MagazineHeroPanel";
import { CinematicVideoHeroPanel } from "./CinematicVideoHeroPanel";
import { AuroraGradientHeroPanel } from "./AuroraGradientHeroPanel";
import { EditorialSplitHeroPanel } from "./EditorialSplitHeroPanel";
import { ParallaxLayersHeroPanel } from "./ParallaxLayersHeroPanel";
import { SpotlightGlowHeroPanel } from "./SpotlightGlowHeroPanel";
import { LogoWallPanel } from "./LogoWallPanel";
import { AboutTeamPanel } from "./AboutTeamPanel";
import { LogoMarqueePanel } from "./LogoMarqueePanel";
import { LaunchSpotlightHeroPanel } from "./LaunchSpotlightHeroPanel";
import { BentoMosaicHeroPanel } from "./BentoMosaicHeroPanel";
import { KineticTypeHeroPanel } from "./KineticTypeHeroPanel";
import { GlassBentoFeaturesPanel } from "./GlassBentoFeaturesPanel";
import { FeatureTabsShowcasePanel } from "./FeatureTabsShowcasePanel";
import { StatCounterBandPanel } from "./StatCounterBandPanel";
import { TestimonialWallPanel } from "./TestimonialWallPanel";
import { GlassPricingTiersPanel } from "./GlassPricingTiersPanel";
import { AuroraCtaFinalePanel } from "./AuroraCtaFinalePanel";
import { RatingBadgesPanel } from "./RatingBadgesPanel";
import { AvatarSocialProofPanel } from "./AvatarSocialProofPanel";
import { BoldStatementPanel } from "./BoldStatementPanel";
import { IdHeroPanel } from "./IdHeroPanel";
import { IdMarqueePanel } from "./IdMarqueePanel";
import { IdIntroPanel } from "./IdIntroPanel";
import { IdCinemaPillarsPanel } from "./IdCinemaPillarsPanel";
import { IdSpotlightPanel } from "./IdSpotlightPanel";
import { IdReservationPassPanel } from "./IdReservationPassPanel";
import { IdParallaxShowcasePanel } from "./IdParallaxShowcasePanel";
import { IdSystemFlowPanel } from "./IdSystemFlowPanel";
import { IdFormPanel } from "./IdFormPanel";
import { IdStatsPanel } from "./IdStatsPanel";
import { IdInvitationPanel } from "./IdInvitationPanel";
import { IdGridPanel } from "./IdGridPanel";
import { GradientPricingPanel } from "./GradientPricingPanel";
import { EditorialCarouselPanel } from "./EditorialCarouselPanel";
import { MenuSectionPanel } from "./MenuSectionPanel";
import { HoursLocationPanel } from "./HoursLocationPanel";
import { BeforeAfterGalleryPanel } from "./BeforeAfterGalleryPanel";
import { SpeakerGridPanel } from "./SpeakerGridPanel";
import { ContentSeriesPanel } from "./ContentSeriesPanel";
import { WebinarHubPanel } from "./WebinarHubPanel";
import { BlogSeriesPanel } from "./BlogSeriesPanel";
import { StorefrontPanel } from "./StorefrontPanel";
import { BusinessCasePanel } from "./BusinessCasePanel";
import { StorybrandJourneyPanel } from "./StorybrandJourneyPanel";
import { ExecDecisionBriefPanel } from "./ExecDecisionBriefPanel";
import { ChallengerInsightPanel } from "./ChallengerInsightPanel";
import { DealRoomPanel } from "./DealRoomPanel";
import { AccountMicrositePanel } from "./AccountMicrositePanel";
import { OnboardingHubPanel } from "./OnboardingHubPanel";
import { ValueRenewalReviewPanel } from "./ValueRenewalReviewPanel";
import { SectionBlockPanel } from "./SectionBlockPanel";
import { TemplateEventPanel } from "./TemplateEventPanel";
import { TemplateCaseStudyPanel } from "./TemplateCaseStudyPanel";
import { SpatialTourPanel } from "./SpatialTourPanel";
import { DtrTokenInserter } from "@/components/DtrTokenInserter";
import { CampaignVarInserter } from "@/components/CampaignVarInserter";
import { getBlockDef } from "@/lib/block-types";
import { ImagePicker } from "@/components/ImagePicker";
import { IconPicker } from "@/components/IconPicker";
import { FocalPointPicker } from "@/components/FocalPointPicker";
import { VideoPicker } from "@/components/VideoPicker";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy, refreshBlockCopy, refreshBentoTiles, type DsoBentoTile } from "@/lib/copy-api";

/** Extra tab injected alongside the built-in Content / Style tabs (task #6 —
 *  e.g. the per-block Governance tab in the Block Defaults editor). */
export interface PropertyPanelExtraTab {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface Props {
  block: PageBlock;
  onChange: (block: PageBlock) => void;
  onDelete?: () => void;
  hideBlockSettings?: boolean;
  brandVoiceSet?: boolean;
  /** Active tenant brand. Used to render brand-aware labels in the section
   *  background dropdown (e.g. "Royal brand color" instead of "Dandy green"). */
  brand?: BrandConfig;
  pageId?: number;
  onApplyCtaToAll?: () => void;
  /** Page-level default CTA (lp_pages.cta_default). Used to compute each block's
   *  effective CTA source (tenant → page → block) for the source indicator. */
  pageCta?: CtaConfig | null;
  /** Extra tabs rendered after Content / Style (only when block settings are
   *  shown). Used by the Block Defaults editor to add a Governance tab. */
  extraTabs?: PropertyPanelExtraTab[];
}

interface EventLandingHeroPanelProps {
  props: Extract<PageBlock, { type: "event-landing-hero" }>["props"];
  onChange: (props: Extract<PageBlock, { type: "event-landing-hero" }>["props"]) => void;
}

interface GlobalFormSummaryLite { id: number; name: string }

/**
 * Property panel for the "Dandy Events Page" hero block. Exposes:
 *   - Background image (with focal-point hint) + overlay color/opacity
 *   - Headline width (in `ch`) + headline/date font-size scale sliders
 *   - Optional details/RSVP section toggle, with copy fields and a global
 *     form picker for the right-column form embed.
 *
 * Kept inline (rather than its own file) to match the convention used by
 * other small Events-category panels in this file.
 */
function EventLandingHeroPanel({ props, onChange }: EventLandingHeroPanelProps) {
  const set = <K extends keyof typeof props>(k: K, v: typeof props[K]) =>
    onChange({ ...props, [k]: v });

  const [forms, setForms] = useState<GlobalFormSummaryLite[]>([]);
  useEffect(() => {
    fetch("/api/lp/forms")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: GlobalFormSummaryLite[]) => {
        if (Array.isArray(data)) setForms(data);
      })
      .catch(() => {});
  }, []);

  const bullets = props.eventDetailsBullets ?? [];
  const updateBullet = (i: number, v: string) =>
    set("eventDetailsBullets", bullets.map((b, idx) => (idx === i ? v : b)));
  const addBullet = () => set("eventDetailsBullets", [...bullets, "New detail"]);
  const removeBullet = (i: number) =>
    set("eventDetailsBullets", bullets.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5 p-4">
      {/* Background ----------------------------------------------------- */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background</Label>
        <ImagePicker
          label="Hero image"
          value={props.backgroundImage ?? ""}
          onChange={(v) => set("backgroundImage", v)}
          placeholder="https://images.unsplash.com/…"
        />
        <div className="space-y-1.5">
          <Label className="text-xs">Image alt text</Label>
          <Input
            value={props.backgroundImageAlt ?? ""}
            onChange={(e) => set("backgroundImageAlt", e.target.value)}
            className="h-8 text-xs"
            placeholder="City skyline at dusk"
          />
        </div>
        <FocalPointPicker
          label="Focal point"
          value={props.backgroundFocalPoint ?? "50% 50%"}
          onChange={(v) => set("backgroundFocalPoint", v)}
          previewUrl={props.backgroundImage ?? undefined}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="Overlay color"
            value={props.overlayColor ?? "#000000"}
            onChange={(v) => set("overlayColor", v)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Overlay opacity ({(props.backgroundOverlay ?? 0.5).toFixed(2)})</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[props.backgroundOverlay ?? 0.5]}
              onValueChange={(v) => set("backgroundOverlay", v[0])}
            />
          </div>
        </div>
      </div>

      {/* Headline ------------------------------------------------------- */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</Label>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline</Label>
          <Textarea
            value={props.headline ?? ""}
            onChange={(e) => set("headline", e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Eyebrow (optional)</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={(e) => set("eyebrow", e.target.value)}
            className="h-8 text-xs"
            placeholder="*Limited spots*"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Italic eyebrow</Label>
          <Switch
            checked={props.eyebrowItalic ?? true}
            onCheckedChange={(v) => set("eyebrowItalic", v)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline width — {props.headlineMaxWidthCh ?? 18} ch</Label>
          <Slider
            min={10}
            max={40}
            step={1}
            value={[props.headlineMaxWidthCh ?? 18]}
            onValueChange={(v) => set("headlineMaxWidthCh", v[0])}
          />
          <p className="text-[11px] text-muted-foreground">Controls when the headline wraps. Lower = narrower column, more line breaks.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline size — {(props.headlineFontScale ?? 1).toFixed(2)}×</Label>
          <Slider
            min={0.6}
            max={1.6}
            step={0.05}
            value={[props.headlineFontScale ?? 1]}
            onValueChange={(v) => set("headlineFontScale", v[0])}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Alignment</Label>
          <Select value={props.align ?? "center"} onValueChange={(v) => set("align", v as "center" | "left")}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="left">Left</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date / Location ------------------------------------------------ */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & location</Label>
        <div className="space-y-1.5">
          <Label className="text-xs">Date text</Label>
          <Input
            value={props.dateText ?? ""}
            onChange={(e) => set("dateText", e.target.value)}
            className="h-8 text-xs"
            placeholder="Wednesday June 10 & Thursday June 11, 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date size — {(props.dateFontScale ?? 1).toFixed(2)}×</Label>
          <Slider
            min={0.6}
            max={1.6}
            step={0.05}
            value={[props.dateFontScale ?? 1]}
            onValueChange={(v) => set("dateFontScale", v[0])}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Location text (optional)</Label>
          <Input
            value={props.locationText ?? ""}
            onChange={(e) => set("locationText", e.target.value)}
            className="h-8 text-xs"
            placeholder="Manhattan rooftop venue"
          />
        </div>
      </div>

      {/* CTA + scroll --------------------------------------------------- */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA & scroll indicator</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">CTA label</Label>
            <Input
              value={props.ctaText ?? ""}
              onChange={(e) => set("ctaText", e.target.value)}
              className="h-8 text-xs"
              placeholder="Save Your Spot"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CTA URL or #anchor</Label>
            <Input
              value={props.ctaUrl ?? ""}
              onChange={(e) => set("ctaUrl", e.target.value)}
              className="h-8 text-xs"
              placeholder="#rsvp"
            />
          </div>
        </div>
        <div className="space-y-2 border rounded-md p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Button colors</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="Background"
              value={props.ctaBgColor}
              onChange={(v) => set("ctaBgColor", v)}
            />
            <ColorField
              label="Text"
              value={props.ctaTextColor}
              onChange={(v) => set("ctaTextColor", v)}
            />
            <ColorField
              label="Hover background"
              value={props.ctaHoverBgColor}
              onChange={(v) => set("ctaHoverBgColor", v)}
            />
            <ColorField
              label="Hover text"
              value={props.ctaHoverTextColor}
              onChange={(v) => set("ctaHoverTextColor", v)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Empty fields fall back to your brand colors. Text auto-picks a readable shade if you only set a background.</p>
        </div>
        <div className="space-y-2 border rounded-md p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Premium drop shadow on CTA</Label>
            <Switch
              checked={props.ctaDropShadow ?? false}
              onCheckedChange={(v) => set("ctaDropShadow", v)}
            />
          </div>
          <ColorField
            label="Shadow color"
            value={props.ctaDropShadowColor}
            onChange={(v) => set("ctaDropShadowColor", v)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">
              Shadow intensity — {((props.ctaDropShadowIntensity ?? 1) * 100).toFixed(0)}%
            </Label>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[props.ctaDropShadowIntensity ?? 1]}
              onValueChange={(v) => set("ctaDropShadowIntensity", v[0])}
            />
            <p className="text-[11px] text-muted-foreground">100% = original look. 0 hides the shadow; up to 200% boosts it.</p>
          </div>
        </div>
        <div className="space-y-2 border rounded-md p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Animated shine on CTA</Label>
            <Switch
              checked={props.ctaShine ?? false}
              onCheckedChange={(v) => set("ctaShine", v)}
            />
          </div>
          {(props.ctaShine ?? false) && (
            <>
              <ColorField
                label="Shine color"
                value={props.ctaShineColor}
                onChange={(v) => set("ctaShineColor", v)}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Shine intensity — {((props.ctaShineIntensity ?? 1) * 100).toFixed(0)}%
                </Label>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[props.ctaShineIntensity ?? 1]}
                  onValueChange={(v) => set("ctaShineIntensity", v[0])}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show "Scroll down" indicator</Label>
          <Switch
            checked={props.showScrollIndicator ?? true}
            onCheckedChange={(v) => set("showScrollIndicator", v)}
          />
        </div>
        {(props.showScrollIndicator ?? true) && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Scroll label</Label>
              <Input
                value={props.scrollLabel ?? "SCROLL DOWN"}
                onChange={(e) => set("scrollLabel", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scroll target id</Label>
              <Input
                value={props.scrollTargetId ?? ""}
                onChange={(e) => set("scrollTargetId", e.target.value)}
                className="h-8 text-xs"
                placeholder="rsvp"
              />
            </div>
          </div>
        )}
      </div>

      {/* Details / RSVP section ---------------------------------------- */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details & RSVP section</Label>
          <Switch
            checked={props.showDetailsSection ?? false}
            onCheckedChange={(v) => set("showDetailsSection", v)}
          />
        </div>

        {props.showDetailsSection && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Background</Label>
                <Select
                  value={props.detailsBackgroundStyle ?? "light-gray"}
                  onValueChange={(v) => set("detailsBackgroundStyle", v as NonNullable<typeof props.detailsBackgroundStyle>)}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="light-gray">Light gray</SelectItem>
                    <SelectItem value="muted">Muted (cream)</SelectItem>
                    <SelectItem value="dark">Dark (brand)</SelectItem>
                    <SelectItem value="dandy-green">Dandy green</SelectItem>
                    <SelectItem value="black">Black</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anchor id</Label>
                <Input
                  value={props.detailsAnchorId ?? "rsvp"}
                  onChange={(e) => set("detailsAnchorId", e.target.value)}
                  className="h-8 text-xs"
                  placeholder="rsvp"
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Left column · What to expect</Label>
              <Input
                value={props.whatToExpectHeading ?? ""}
                onChange={(e) => set("whatToExpectHeading", e.target.value)}
                className="h-8 text-xs"
                placeholder="What to expect"
              />
              <Textarea
                value={props.whatToExpectBody ?? ""}
                onChange={(e) => set("whatToExpectBody", e.target.value)}
                rows={3}
                className="text-xs"
                placeholder="Join us for an evening of conversation…"
              />
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Left column · Event Details</Label>
              <Input
                value={props.eventDetailsHeading ?? ""}
                onChange={(e) => set("eventDetailsHeading", e.target.value)}
                className="h-8 text-xs"
                placeholder="Event Details"
              />
              <Textarea
                value={props.eventDetailsBody ?? ""}
                onChange={(e) => set("eventDetailsBody", e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Two nights of curated programming…"
              />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Bullets</Label>
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={addBullet}>
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                {bullets.map((b, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input
                      value={b}
                      onChange={(e) => updateBullet(i, e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeBullet(i)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                {bullets.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No bullets yet.</p>
                )}
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Right column · RSVP form</Label>
              <Input
                value={props.formHeading ?? ""}
                onChange={(e) => set("formHeading", e.target.value)}
                className="h-8 text-xs"
                placeholder="Save your spot"
              />
              <Textarea
                value={props.formSubheading ?? ""}
                onChange={(e) => set("formSubheading", e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Spots are limited — RSVP to confirm your seat."
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Form source</Label>
                <Select
                  value={props.formMode ?? "native"}
                  onValueChange={(v) => set("formMode", v as "native" | "marketo")}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="native">Linked global form</SelectItem>
                    <SelectItem value="marketo">Embed Marketo form</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(props.formMode ?? "native") === "native" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Linked global form</Label>
                  <Select
                    value={props.formId != null ? String(props.formId) : "__none__"}
                    onValueChange={(v) => set("formId", v === "__none__" ? undefined : parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a form" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {forms.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name} (#{f.id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Manage forms in <span className="underline">/forms</span>. Submissions inherit Marketo / notification config from the global form.</p>
                </div>
              ) : (
                <div className="space-y-2 rounded-md border border-dashed p-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Marketo instance URL</Label>
                    <Input
                      value={props.marketoBaseUrl ?? ""}
                      onChange={(e) => set("marketoBaseUrl", e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="//app-XXX.marketo.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Munchkin ID</Label>
                    <Input
                      value={props.marketoMunchkinId ?? ""}
                      onChange={(e) => set("marketoMunchkinId", e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="123-ABC-456"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Marketo form ID</Label>
                    <Input
                      type="number"
                      value={props.marketoFormId != null ? String(props.marketoFormId) : ""}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        set("marketoFormId", Number.isFinite(n) ? n : undefined);
                      }}
                      className="h-8 text-xs font-mono"
                      placeholder="1234"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Find these in Marketo under Form Embed Code (the `loadForm` call shows base URL, Munchkin ID, and form ID).</p>
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Left column · Extra section (optional)</Label>
              <Input
                value={props.extraSectionHeading ?? ""}
                onChange={(e) => set("extraSectionHeading", e.target.value)}
                className="h-8 text-xs"
                placeholder="Parking & venue"
              />
              <Textarea
                value={props.extraSectionBody ?? ""}
                onChange={(e) => set("extraSectionBody", e.target.value)}
                rows={3}
                className="text-xs"
                placeholder="Valet parking is available on-site. Business casual attire suggested."
              />
              <p className="text-[11px] text-muted-foreground">Hidden when both fields are empty.</p>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Layout</Label>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Swap columns (form on left)</Label>
                <Switch
                  checked={props.swapColumns ?? false}
                  onCheckedChange={(v) => set("swapColumns", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Copy column width — {(props.copyColumnWidth ?? 1.05).toFixed(2)}× the form column</Label>
                <Slider
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={[props.copyColumnWidth ?? 1.05]}
                  onValueChange={(v) => set("copyColumnWidth", v[0])}
                />
                <p className="text-[11px] text-muted-foreground">Form column stays at 1×. Lower = narrower copy column, more space for the form.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Left column top padding — {(props.leftColumnTopPadding ?? 0).toFixed(1)} rem</Label>
                <Slider
                  min={0}
                  max={12}
                  step={0.5}
                  value={[props.leftColumnTopPadding ?? 0]}
                  onValueChange={(v) => set("leftColumnTopPadding", v[0])}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Right column top padding — {(props.rightColumnTopPadding ?? 0).toFixed(1)} rem</Label>
                <Slider
                  min={0}
                  max={12}
                  step={0.5}
                  value={[props.rightColumnTopPadding ?? 0]}
                  onValueChange={(v) => set("rightColumnTopPadding", v[0])}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsReorderList<T extends { value: string; label: string }>({
  stats,
  onReorder,
  onUpdate,
  onRemove,
}: {
  stats: T[];
  onReorder: (from: number, to: number) => void;
  onUpdate: (i: number, field: "value" | "label", val: string) => void;
  onRemove: (i: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  return (
    <>
      {stats.map((s, i) => {
        const isDragging = dragIndex === i;
        const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
        return (
          <div
            key={i}
            draggable={dragIndex === i}
            onDragOver={e => {
              if (dragIndex === null) return;
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              if (overIndex !== i) setOverIndex(i);
            }}
            onDrop={e => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            className={`flex gap-2 items-start bg-muted/40 rounded-lg p-2 transition-all ${isDragging ? "opacity-40" : ""} ${isOver ? "ring-2 ring-primary" : ""}`}
          >
            <button
              type="button"
              aria-label="Drag to reorder"
              onMouseDown={() => setDragIndex(i)}
              onMouseUp={() => { if (dragIndex === i) setDragIndex(null); }}
              onTouchStart={() => setDragIndex(i)}
              onTouchEnd={() => { if (dragIndex === i) setDragIndex(null); }}
              className="cursor-grab active:cursor-grabbing touch-none mt-1.5 p-0.5 text-muted-foreground/60 hover:text-muted-foreground"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 space-y-1.5">
              <Input
                className="h-7 text-xs"
                placeholder="Value (e.g. 30%)"
                value={s.value}
                onChange={e => onUpdate(i, "value", e.target.value)}
              />
              <Input
                className="h-7 text-xs"
                placeholder="Label"
                value={s.label}
                onChange={e => onUpdate(i, "label", e.target.value)}
              />
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 mt-1 text-muted-foreground hover:text-destructive" onClick={() => onRemove(i)}>
              ×
            </Button>
          </div>
        );
      })}
    </>
  );
}

function StageReorderList({
  stages,
  onReorder,
  onUpdate,
  onUpdateIcon,
  onRemove,
}: {
  stages: DsoCaseFlowStage[];
  onReorder: (from: number, to: number) => void;
  onUpdate: (i: number, field: "label" | "metric" | "metricLabel" | "body", val: string) => void;
  onUpdateIcon: (i: number, val: string) => void;
  onRemove: (i: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  return (
    <>
      {stages.map((s, i) => {
        const isDragging = dragIndex === i;
        const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
        const overflow = i >= 4;
        return (
          <div
            key={i}
            draggable={dragIndex === i}
            onDragOver={e => {
              if (dragIndex === null) return;
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              if (overIndex !== i) setOverIndex(i);
            }}
            onDrop={e => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            className={`flex gap-2 items-start bg-muted/40 rounded-lg p-2 transition-all ${isDragging ? "opacity-40" : ""} ${isOver ? "ring-2 ring-primary" : ""} ${overflow ? "ring-1 ring-amber-400/70" : ""}`}
          >
            <button
              type="button"
              aria-label="Drag to reorder"
              onMouseDown={() => setDragIndex(i)}
              onMouseUp={() => { if (dragIndex === i) setDragIndex(null); }}
              onTouchStart={() => setDragIndex(i)}
              onTouchEnd={() => { if (dragIndex === i) setDragIndex(null); }}
              className="cursor-grab active:cursor-grabbing touch-none mt-1.5 p-0.5 text-muted-foreground/60 hover:text-muted-foreground"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stage {i + 1}</span>
                {overflow && <span className="text-[10px] font-medium text-amber-600">Not shown (max 4)</span>}
              </div>
              <IconPicker value={s.iconName} onChange={v => onUpdateIcon(i, v)} aiHint={`${s.label || "Stage"} icon`} />
              <Input
                className="h-7 text-xs"
                placeholder="Label (e.g. Submit)"
                value={s.label}
                onChange={e => onUpdate(i, "label", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-1">
                <Input
                  className="h-7 text-xs"
                  placeholder="Metric (e.g. < 1 min)"
                  value={s.metric}
                  onChange={e => onUpdate(i, "metric", e.target.value)}
                />
                <Input
                  className="h-7 text-xs"
                  placeholder="Metric label"
                  value={s.metricLabel}
                  onChange={e => onUpdate(i, "metricLabel", e.target.value)}
                />
              </div>
              <Textarea
                className="text-xs min-h-[3rem]"
                rows={2}
                placeholder="Body text"
                value={s.body}
                onChange={e => onUpdate(i, "body", e.target.value)}
              />
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 mt-1 text-muted-foreground hover:text-destructive" onClick={() => onRemove(i)}>
              ×
            </Button>
          </div>
        );
      })}
    </>
  );
}

export function PropertyPanel({ block, onChange, onDelete, hideBlockSettings = false, brandVoiceSet, brand, pageId, onApplyCtaToAll, pageCta, extraTabs }: Props) {
  // Resolve once per render so every child panel + every inline Background
  // <Select> below shares the same brand-aware label set.
  const bgOptions = getBgOptions(brand);
  // CTA source indicator + inherit/override controls for the selected block.
  // Migrated panels spread this straight into their shared CtaActionConfigSection.
  const ctaSource = buildBlockCtaSource({
    blockType: block.type,
    props: block.props as Record<string, unknown>,
    onProps: (next) => onChange({ ...block, props: next } as PageBlock),
    brand,
    pageCta,
    useCustomCta: block.blockSettings?.useCustomCta,
  });
  // The "Use a custom button here" opt-out is only meaningful when a Page CTA is
  // set AND this block actually has a primary button to override. Otherwise the
  // toggle is hidden (the block keeps its own buttons regardless).
  const canFollowPageCta =
    ctaConfigHasValue(pageCta ?? null) &&
    blockHasPrimaryCta(block.props as Record<string, unknown>);
  const def = getBlockDef(block.type);
  const [dsoRefreshing, setDsoRefreshing] = useState(false);
  const [bentoTilesRefreshing, setBentoTilesRefreshing] = useState(false);
  const [storyApprovedForAi, setStoryApprovedForAi] = useState<Record<number, boolean>>({});
  const [storySaveStatus, setStorySaveStatus] = useState<Record<number, "idle" | "saving" | "saved" | "error">>({});
  const [loadingStoryDefaults, setLoadingStoryDefaults] = useState(false);

  const handleAddStoryToLibrary = async (
    story: { name?: string; stat?: string; label?: string; quote?: string; author?: string; image?: string },
    index: number,
    approvedForAi: boolean,
  ) => {
    setStorySaveStatus(prev => ({ ...prev, [index]: "saving" }));
    try {
      const title = (story.name || story.label || "Success Story").trim();
      // Map onto the case_study content shape best-effort (title/image) while
      // preserving the full DSO story data so nothing is dropped.
      const content = {
        title,
        image: story.image ?? "",
        name: story.name ?? "",
        stat: story.stat ?? "",
        label: story.label ?? "",
        quote: story.quote ?? "",
        author: story.author ?? "",
      };
      const res = await fetch(`/api/lp/library/case_study`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, content, is_default: false, approved_for_ai: approvedForAi }),
      });
      if (!res.ok) throw new Error("Save failed");
      setStorySaveStatus(prev => ({ ...prev, [index]: "saved" }));
      setTimeout(() => setStorySaveStatus(prev => ({ ...prev, [index]: "idle" })), 2500);
    } catch (e) {
      console.error("Add story to library failed", e);
      setStorySaveStatus(prev => ({ ...prev, [index]: "error" }));
      setTimeout(() => setStorySaveStatus(prev => ({ ...prev, [index]: "idle" })), 4000);
    }
  };

  const handleBentoTilesRefresh = async (currentTiles: DsoBentoTile[]) => {
    setBentoTilesRefreshing(true);
    try {
      const types = currentTiles.length > 0 ? currentTiles.map(t => t.type) : ["stat", "stat", "stat", "photo", "quote", "feature"];
      const tiles = await refreshBentoTiles(types);
      onChange({ ...block, props: { ...block.props, tiles } } as unknown as PageBlock);
    } catch (e) {
      console.error("Bento tiles refresh failed", e);
    } finally {
      setBentoTilesRefreshing(false);
    }
  };

  const handleDsoRefresh = async (fields: string[], currentValues: Record<string, string>) => {
    setDsoRefreshing(true);
    try {
      const updated = await refreshBlockCopy(block.type, fields, currentValues);
      onChange({ ...block, props: { ...block.props, ...updated } } as PageBlock);
    } catch (e) {
      console.error("DSO copy refresh failed", e);
    } finally {
      setDsoRefreshing(false);
    }
  };

  const DsoRefreshRow = ({ fields, values }: { fields: string[]; values: Record<string, string> }) => (
    <div className="flex justify-end -mt-1 mb-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5 text-emerald-700 hover:text-emerald-800"
        disabled={dsoRefreshing}
        onClick={() => handleDsoRefresh(fields, values)}
      >
        {dsoRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
        Refresh copy
      </Button>
    </div>
  );

  const renderForm = () => {
    switch (block.type) {
      case "benefits-alternating-rows":
        return (
          <BenefitsAlternatingRowsPanel
            props={block.props as BenefitsAlternatingRowsBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "benefits-bento":
        return (
          <BenefitsBentoPanel
            props={block.props as BenefitsBentoBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "benefits-icon-grid":
        return (
          <BenefitsIconGridPanel
            props={block.props as BenefitsIconGridBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "benefits-stat-led":
        return (
          <BenefitsStatLedPanel
            props={block.props as BenefitsStatLedBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "quote-carousel":
        return (
          <QuoteCarouselPanel
            props={block.props as QuoteCarouselBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "quote-library":
        return (
          <QuoteLibraryPanel
            props={block.props as QuoteLibraryBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "quote-with-image":
        return (
          <QuoteWithImagePanel
            props={block.props as QuoteWithImageBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "single-quote":
        return (
          <SingleQuotePanel
            props={block.props as SingleQuoteBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "testimonial-grid":
        return (
          <TestimonialGridPanel
            props={block.props as TestimonialGridBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "gallery-carousel-spotlight":
        return (
          <GalleryCarouselSpotlightPanel
            props={block.props as GalleryCarouselSpotlightBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "gallery-filmstrip":
        return (
          <GalleryFilmstripPanel
            props={block.props as GalleryFilmstripBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "gallery-masonry":
        return (
          <GalleryMasonryPanel
            props={block.props as GalleryMasonryBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "gallery-split-feature":
        return (
          <GallerySplitFeaturePanel
            props={block.props as GallerySplitFeatureBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "features-bento-showcase":
        return (
          <FeaturesBentoShowcasePanel
            props={block.props as FeaturesBentoShowcaseBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "features-comparison-checklist":
        return (
          <FeaturesComparisonChecklistPanel
            props={block.props as FeaturesComparisonChecklistBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "features-spotlight-cards":
        return (
          <FeaturesSpotlightCardsPanel
            props={block.props as FeaturesSpotlightCardsBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "features-tabbed-categories":
        return (
          <FeaturesTabbedCategoriesPanel
            props={block.props as FeaturesTabbedCategoriesBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "how-it-works-alternating":
        return (
          <HowItWorksAlternatingPanel
            props={block.props as HowItWorksAlternatingBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "how-it-works-horizontal-stepper":
        return (
          <HowItWorksHorizontalStepperPanel
            props={block.props as HowItWorksHorizontalStepperBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "how-it-works-numbered-bento":
        return (
          <HowItWorksNumberedBentoPanel
            props={block.props as HowItWorksNumberedBentoBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "how-it-works-vertical-timeline":
        return (
          <HowItWorksVerticalTimelinePanel
            props={block.props as HowItWorksVerticalTimelineBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "media-feature-reel":
        return (
          <MediaFeatureReelPanel
            props={block.props as MediaFeatureReelBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "media-looping-showcase":
        return (
          <MediaLoopingShowcasePanel
            props={block.props as MediaLoopingShowcaseBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "media-thumbnail-grid":
        return (
          <MediaThumbnailGridPanel
            props={block.props as MediaThumbnailGridBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "media-video-split":
        return (
          <MediaVideoSplitPanel
            props={block.props as MediaVideoSplitBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "cta-centered-minimal":
        return (
          <CtaCenteredMinimalPanel
            props={block.props as CtaCenteredMinimalBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "centered-logo-nav":
        return (
          <CenteredLogoNavPanel
            props={block.props as CenteredLogoNavBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "mega-menu-nav":
        return (
          <MegaMenuNavPanel
            props={block.props as MegaMenuNavBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "minimal-nav":
        return (
          <MinimalNavPanel
            props={block.props as MinimalNavBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "transparent-overlay-nav":
        return (
          <TransparentOverlayNavPanel
            props={block.props as TransparentOverlayNavBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "split-media-row":
        return (
          <SplitMediaRowPanel
            props={block.props as SplitMediaRowBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "full-bleed-split":
        return (
          <FullBleedSplitPanel
            props={block.props as FullBleedSplitBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "icon-row":
        return (
          <IconRowPanel
            props={block.props as IconRowBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "media-cards-row":
        return (
          <MediaCardsRowPanel
            props={block.props as MediaCardsRowBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "stat-row":
        return (
          <StatRowPanel
            props={block.props as StatRowBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "cta-gradient-banner":
        return (
          <CtaGradientBannerPanel
            props={block.props as CtaGradientBannerBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "cta-split-image":
        return (
          <CtaSplitImagePanel
            props={block.props as CtaSplitImageBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "cta-stat-backed":
        return (
          <CtaStatBackedPanel
            props={block.props as CtaStatBackedBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "pas-icon-grid":
        return (
          <PasIconGridPanel
            props={block.props as PasIconGridBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "pas-split-image":
        return (
          <PasSplitImagePanel
            props={block.props as PasSplitImageBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "pas-stat-agitate":
        return (
          <PasStatAgitatePanel
            props={block.props as PasStatAgitateBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "pas-before-after":
        return (
          <PasBeforeAfterPanel
            props={block.props as PasBeforeAfterBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "full-bleed-final-cta":
        return (
          <FullBleedFinalCtaPanel
            props={block.props as FullBleedFinalCtaBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "split-form-final-cta":
        return (
          <SplitFormFinalCtaPanel
            props={block.props as SplitFormFinalCtaBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "stat-backed-final-cta":
        return (
          <StatBackedFinalCtaPanel
            props={block.props as StatBackedFinalCtaBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "social-urgency-final-cta":
        return (
          <SocialUrgencyFinalCtaPanel
            props={block.props as SocialUrgencyFinalCtaBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "gradient-glow-final-cta":
        return (
          <GradientGlowFinalCtaPanel
            props={block.props as GradientGlowFinalCtaBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "video-background-final-cta":
        return (
          <VideoBackgroundFinalCtaPanel
            props={block.props as VideoBackgroundFinalCtaBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "case-study-card-grid":
        return (
          <CaseStudyCardGridPanel
            props={block.props as CaseStudyCardGridBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "case-study-logo-results-row":
        return (
          <CaseStudyLogoResultsRowPanel
            props={block.props as CaseStudyLogoResultsRowBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "case-study-metric-triptych":
        return (
          <CaseStudyMetricTriptychPanel
            props={block.props as CaseStudyMetricTriptychBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "case-study-spotlight-feature":
        return (
          <CaseStudySpotlightFeaturePanel
            props={block.props as CaseStudySpotlightFeatureBlockProps}
            onChange={(next) => onChange({ ...block, props: next })}
          />
        );
      case "hero":
        return (
          <HeroPanel
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
            bgOptions={bgOptions}
            onApplyCtaToAll={onApplyCtaToAll}
            ctaSource={ctaSource}
          />
        );
      case "trust-bar":
        return (
          <TrustBarPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "logo-wall":
        return (
          <LogoWallPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "about-team":
        return (
          <AboutTeamPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "logo-marquee":
        return (
          <LogoMarqueePanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "launch-spotlight-hero":
        return (
          <LaunchSpotlightHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "bento-mosaic-hero":
        return (
          <BentoMosaicHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "kinetic-type-hero":
        return (
          <KineticTypeHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "glass-bento-features":
        return (
          <GlassBentoFeaturesPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "feature-tabs-showcase":
        return (
          <FeatureTabsShowcasePanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "stat-counter-band":
        return (
          <StatCounterBandPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "testimonial-wall":
        return (
          <TestimonialWallPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "glass-pricing-tiers":
        return (
          <GlassPricingTiersPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "aurora-cta-finale":
        return (
          <AuroraCtaFinalePanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "rating-badges":
        return (
          <RatingBadgesPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "avatar-social-proof":
        return (
          <AvatarSocialProofPanel
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
            ctaSource={ctaSource}
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
            ctaSource={ctaSource}
          />
        );
      case "video-section":
        return (
          <VideoSectionPanel
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
            bgOptions={bgOptions}
            onApplyCtaToAll={onApplyCtaToAll}
            ctaSource={ctaSource}
          />
        );
      case "case-studies":
        return (
          <CaseStudiesPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            bgOptions={bgOptions}
          />
        );
      case "resources":
        return (
          <ResourcesPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            bgOptions={bgOptions}
          />
        );
      case "resource-link-list":
        return (
          <ResourceLinkListPanel
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
      case "grid-image":
        return <GridImagePanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-headline-sub":
        return <GridHeadlineSubPanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-paragraph-bullets":
        return <GridParagraphBulletsPanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-headline-paragraph":
        return <GridHeadlineParagraphPanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-icon-feature":
        return <GridIconFeaturePanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-stat":
        return <GridStatPanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-quote":
        return <GridQuotePanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-cta-tile":
        return <GridCtaTilePanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-logo":
        return <GridLogoPanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "grid-video":
        return <GridVideoPanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
      case "custom-schema":
        return <CustomSchemaPanel props={block.props} onChange={p => onChange({ ...block, props: p })} />;
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
            ctaSource={ctaSource}
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
            ctaSource={ctaSource}
          />
        );
      case "ai-scan-hero":
        return (
          <AiScanHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "parallax-image-hero":
        return (
          <ParallaxImageHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
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
            bgOptions={bgOptions}
          />
        );
      case "popup":
        return (
          <PopupPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            onApplyCtaToAll={onApplyCtaToAll}
            bgOptions={bgOptions}
          />
        );
      case "sticky-bar":
        return (
          <StickyBarPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            onApplyCtaToAll={onApplyCtaToAll}
            bgOptions={bgOptions}
          />
        );
      case "sticky-header": {
        const p = block.props;
        const links = p.navLinks ?? [];
        const updateLink = (i: number, key: "label" | "href", val: string) => {
          const next = links.map((l, idx) => idx === i ? { ...l, [key]: val } : l);
          onChange({ ...block, props: { ...p, navLinks: next } });
        };
        const addLink = () => onChange({ ...block, props: { ...p, navLinks: [...links, { label: "New", href: "#" }] } });
        const removeLink = (i: number) => onChange({ ...block, props: { ...p, navLinks: links.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <ImagePicker
              label="Logo (optional)"
              value={p.logoUrl ?? ""}
              onChange={v => onChange({ ...block, props: { ...p, logoUrl: v } })}
              placeholder="Defaults to your logo"
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Logo alt text</Label>
              <Input value={p.logoAlt ?? ""} onChange={e => onChange({ ...block, props: { ...p, logoAlt: e.target.value } })} placeholder="Acme" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Partner / company name (optional)</Label>
              <Input value={p.companyName ?? ""} onChange={e => onChange({ ...block, props: { ...p, companyName: e.target.value } })} placeholder="Shown as: Logo × Company" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Theme</Label>
              <div className="flex gap-2">
                {([["dark","Dark glass"],["light","Light glass"]] as const).map(([v,lbl]) => (
                  <button key={v} onClick={() => onChange({ ...block, props: { ...p, theme: v } })} className={`flex-1 py-1.5 text-xs rounded border ${(p.theme ?? "dark") === v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Position</Label>
              <div className="flex gap-2">
                {([["fixed","Overlay hero (fixed)"],["sticky","In flow (sticky)"]] as const).map(([v,lbl]) => (
                  <button key={v} onClick={() => onChange({ ...block, props: { ...p, position: v } })} className={`flex-1 py-1.5 text-xs rounded border ${(p.position ?? "fixed") === v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{lbl}</button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Use "Overlay hero" when placed above a tall hero so it blends in until you scroll.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Nav links</Label>
                <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={addLink}><Plus className="w-3 h-3" /> Add</Button>
              </div>
              {links.map((l, i) => (
                <div key={i} className="flex gap-2 items-start bg-muted/40 rounded-lg p-2">
                  <div className="flex-1 grid grid-cols-2 gap-1">
                    <Input className="h-7 text-xs" placeholder="Label" value={l.label} onChange={e => updateLink(i, "label", e.target.value)} />
                    <Input className="h-7 text-xs" placeholder="#anchor or URL" value={l.href} onChange={e => updateLink(i, "href", e.target.value)} />
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeLink(i)}>×</Button>
                </div>
              ))}
              {links.length === 0 && <p className="text-[11px] text-muted-foreground">No nav links yet. Use #anchor-id to scroll to other blocks on this page.</p>}
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary CTA (optional)</Label>
              <Input className="h-8 text-xs" placeholder="Button label" value={p.primaryCtaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryCtaText: e.target.value } })} />
              <div className="space-y-1.5">
                <Label className="text-xs">Action</Label>
                <Select
                  value={p.primaryCtaAction ?? "url"}
                  onValueChange={v => onChange({ ...block, props: { ...p, primaryCtaAction: v as NonNullable<typeof p.primaryCtaAction> } })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url" className="text-xs">Open URL</SelectItem>
                    <SelectItem value="chilipiper" className="text-xs">Open Chili Piper popup</SelectItem>
                    <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                    <SelectItem value="modal-chilipiper" className="text-xs">Open modal then Chili Piper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(p.primaryCtaAction ?? "url") === "url" && (
                <Input className="h-8 text-xs" placeholder="URL" value={p.primaryCtaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value } })} />
              )}
              {p.primaryCtaAction === "chilipiper" && (
                <Input
                  className="h-8 text-xs font-mono"
                  placeholder="https://yourcompany.chilipiper.com/router/your-router"
                  value={p.chilipiperUrl ?? ""}
                  onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value } })}
                />
              )}
            </div>
            {(p.primaryCtaAction === "modal-form" || p.primaryCtaAction === "modal-chilipiper") && (
              <CtaButtonModalConfigSection
                ctaAction={p.primaryCtaAction}
                value={p}
                onChange={(next) => onChange({ ...block, props: { ...p, ...next } })}
              />
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">CTA style</Label>
              <div className="flex gap-2">
                {([["pill","Pill"],["square","Square"],["default","Default"]] as const).map(([v,lbl]) => (
                  <button
                    key={v}
                    onClick={() => onChange({ ...block, props: { ...p, ctaStyle: v } })}
                    className={`flex-1 py-1.5 text-xs rounded border ${(p.ctaStyle === "pill" || p.ctaStyle === "square" || p.ctaStyle === "default" ? p.ctaStyle : "default") === v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">"Pill" is fully rounded, "Square" has sharp corners, and "Default" follows your brand's button shape from Brand Settings.</p>
            </div>
            <div className="space-y-1.5">
              <ColorField label="CTA color" value={p.accentColor ?? "var(--brand-accent)"} onChange={v => onChange({ ...block, props: { ...p, accentColor: v } })} />
            </div>
          </div>
        );
      }
      case "spacer":
        return (
          <SpacerPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "roi-calculator":
        return (
          <RoiCalculatorPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            bgOptions={bgOptions}
          />
        );
      case "dso-insights-dashboard": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: p.eyebrow + token } })} />
              </div>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: p.headline + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: p.headline + token } })} />
                </div>
              </div>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: p.subheadline + token } })} />
              </div>
              <Textarea rows={3} value={p.subheadline} onChange={e => onChange({ ...block, props: { ...p, subheadline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={(p.backgroundStyle && p.backgroundStyle.length > 0) ? p.backgroundStyle : (p.dashboardVariant === "dark" ? "dark" : "muted")} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dashboard theme</Label>
              <Select value={p.dashboardVariant} onValueChange={v => onChange({ ...block, props: { ...p, dashboardVariant: v as "light" | "dark" } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light (white cards)</SelectItem>
                  <SelectItem value="dark">Dark (dark cards)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold">Dashboard Image</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">Optional. Replaces the simulated dashboard with a real image. Leave blank to keep the interactive demo. (Video takes priority if set.)</p>
              <ImagePicker value={p.dashboardImage ?? ""} onChange={v => onChange({ ...block, props: { ...p, dashboardImage: v || undefined } })} aiHint="Product dashboard screenshot" />
            </div>
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold">Dashboard Video</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">Upload or paste a video URL. Replaces the interactive dashboard when set.</p>
              <VideoPicker
                label="Video"
                value={p.videoUrl ?? ""}
                onChange={v => onChange({ ...block, props: { ...p, videoUrl: v || undefined } })}
              />
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Video Options</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Autoplay &amp; Loop</Label>
                    <p className="text-[11px] text-muted-foreground">Plays silently on page load and repeats.</p>
                  </div>
                  <Switch checked={p.videoAutoplay !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, videoAutoplay: v } })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Play on scroll</Label>
                    <p className="text-[11px] text-muted-foreground">Start playing when this section scrolls into view.</p>
                  </div>
                  <Switch checked={p.videoPlayOnScroll ?? false} onCheckedChange={v => onChange({ ...block, props: { ...p, videoPlayOnScroll: v } })} />
                </div>
              </div>
            </div>
          </div>
        );
      }
      case "dso-insights-video": {
        const p = block.props;
        // Build live callouts array — use explicit array if it's been set, else fall back to legacy named props
        const calloutsArr: Array<{ label: string; desc: string }> = p.callouts != null
          ? p.callouts
          : [
              { label: p.callout1Label ?? "Remake Rates",        desc: p.callout1Desc ?? "Track quality by provider, not just practice" },
              { label: p.callout2Label ?? "Spend Tracking",      desc: p.callout2Desc ?? "Know where every dollar goes across all locations" },
              { label: p.callout3Label ?? "Scan Quality",        desc: p.callout3Desc ?? "Catch clinical issues before they become remakes" },
              { label: p.callout4Label ?? "Provider Performance",desc: p.callout4Desc ?? "Coach with data, not instinct" },
            ];
        const updateCallout = (i: number, key: "label" | "desc", val: string) => {
          const next = calloutsArr.map((c, idx) => idx === i ? { ...c, [key]: val } : c);
          onChange({ ...block, props: { ...p, callouts: next } });
        };
        const addCallout = () => onChange({ ...block, props: { ...p, callouts: [...calloutsArr, { label: "", desc: "" }] } });
        const removeCallout = (i: number) => onChange({ ...block, props: { ...p, callouts: calloutsArr.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            {/* Background */}
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Image</Label>
              <p className="text-[11px] text-muted-foreground">Overrides the background color above.</p>
              <ImagePicker value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v || undefined } })} />
            </div>
            {p.imageUrl && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay Opacity <span className="text-slate-400">({Math.round((p.backgroundOverlay ?? 0.55) * 100)}%)</span></Label>
                  <input type="color" value={p.overlayColor ?? "#000000"} onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })} className="h-6 w-10 rounded cursor-pointer border border-slate-200 p-0.5" title="Overlay color" />
                </div>
                <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                <input type="range" min={0} max={1} step={0.05} value={p.backgroundOverlay ?? 0.55} onChange={e => onChange({ ...block, props: { ...p, backgroundOverlay: parseFloat(e.target.value) } })} className="w-full accent-emerald-700" />
              </div>
            )}

            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold">Dashboard Video</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">Upload or paste a video URL. Replaces the animated screenshot gallery when set.</p>
              <VideoPicker
                label="Video"
                value={p.videoUrl ?? ""}
                onChange={v => onChange({ ...block, props: { ...p, videoUrl: v || undefined } })}
              />
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Video Options</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Autoplay &amp; Loop</Label>
                    <p className="text-[11px] text-muted-foreground">Plays silently on page load and repeats.</p>
                  </div>
                  <Switch checked={p.videoAutoplay !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, videoAutoplay: v } })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Play on scroll</Label>
                    <p className="text-[11px] text-muted-foreground">Start playing when this section scrolls into view.</p>
                  </div>
                  <Switch checked={p.videoPlayOnScroll ?? false} onCheckedChange={v => onChange({ ...block, props: { ...p, videoPlayOnScroll: v } })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Hide browser frame</Label>
                    <p className="text-[11px] text-muted-foreground">Remove the fake URL bar and window chrome.</p>
                  </div>
                  <Switch checked={p.hideBrowserFrame ?? false} onCheckedChange={v => onChange({ ...block, props: { ...p, hideBrowserFrame: v } })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Show scan GIF</Label>
                    <p className="text-[11px] text-muted-foreground">Display the animated scan visualization card.</p>
                  </div>
                  <Switch checked={p.showScanGif !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, showScanGif: v } })} />
                </div>
              </div>
            </div>

            {/* AI refresh */}
            <DsoRefreshRow fields={["title", "subtitle", "description", "quote", "quoteAttribution", "ctaLabel"]} values={{ title: p.title ?? "", subtitle: p.subtitle ?? "", description: p.description ?? "", quote: p.quote ?? "", quoteAttribution: p.quoteAttribution ?? "", ctaLabel: p.ctaLabel ?? "" }} />

            {/* Copy */}
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline <span className="text-muted-foreground font-normal">(Enter = new line)</span></Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, title: (p.title ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, title: (p.title ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={3} value={p.title ?? ""} onChange={v => onChange({ ...block, props: { ...p, title: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "title", p.title ?? "", { subtitle: p.subtitle ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Accent Line</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subtitle: (p.subtitle ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.subtitle ?? ""} onChange={v => onChange({ ...block, props: { ...p, subtitle: v } })} fieldLabel="Accent Line" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subtitle", p.subtitle ?? "", { title: p.title ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Description</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, description: (p.description ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.description ?? ""} onChange={v => onChange({ ...block, props: { ...p, description: v } })} fieldLabel="Description" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "description", p.description ?? "", { title: p.title ?? "" })} />
            </div>

            {/* Callouts — dynamic add/remove */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feature Callouts</Label>
                <Button variant="ghost" size="sm" onClick={addCallout} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button>
              </div>
              <div className="space-y-3">
                {calloutsArr.map((c, i) => (
                  <div key={i} className="border rounded-lg p-2 space-y-1.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Callout {i + 1}</span>
                      <button type="button" onClick={() => removeCallout(i)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <Input value={c.label} onChange={e => updateCallout(i, "label", e.target.value)} placeholder="Remake Rates" className="h-7 text-xs" />
                    <Input value={c.desc} onChange={e => updateCallout(i, "desc", e.target.value)} placeholder="Track quality by provider…" className="h-7 text-xs" />
                  </div>
                ))}
              </div>
            </div>

            {/* Quote */}
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Quote</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, quote: (p.quote ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.quote ?? ""} onChange={v => onChange({ ...block, props: { ...p, quote: v } })} fieldLabel="Quote" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "quote", p.quote ?? "", { title: p.title ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quote Attribution</Label>
              <Input value={p.quoteAttribution ?? ""} onChange={e => onChange({ ...block, props: { ...p, quoteAttribution: e.target.value } })} placeholder="Dr. Eller, Clinical Leader" className="h-8 text-xs" />
            </div>

            {/* CTA */}
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">CTA Label</Label>
                <Input value={p.ctaLabel ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaLabel: e.target.value || undefined } })} placeholder="Get a demo" className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Mode</Label>
                  <Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link" className="text-xs">Link</SelectItem>
                      <SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Style</Label>
                  <Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary" className="text-xs">Primary</SelectItem>
                      <SelectItem value="secondary" className="text-xs">Outline</SelectItem>
                      <SelectItem value="link" className="text-xs">Link →</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(p.ctaMode ?? "link") === "link" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">CTA URL</Label>
                  <Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://…" className="h-8 text-xs" />
                </div>
              )}
            </div>

            {/* Chili Piper */}
            {(p.ctaMode ?? "link") === "chilipiper" && (
              <div className="border-t pt-3 space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chili Piper</Label>
                <div className="space-y-1.5">
                  <Label className="text-xs">Chili Piper URL</Label>
                  <Input value={p.chilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value || undefined } })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs" />
                  <p className="text-[11px] text-muted-foreground">When mode is set to Chili Piper, this URL opens the scheduling popup.</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case "dso-lab-tour": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: p.eyebrow + token } })} />
              </div>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: p.headline + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: p.headline + token } })} />
                </div>
              </div>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body text</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: p.body + token } })} />
              </div>
              <Textarea rows={3} value={p.body} onChange={e => onChange({ ...block, props: { ...p, body: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Quote</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, quote: p.quote + token } })} />
              </div>
              <Textarea rows={2} value={p.quote} onChange={e => onChange({ ...block, props: { ...p, quote: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Quote attribution</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, quoteAttribution: p.quoteAttribution + token } })} />
              </div>
              <Input value={p.quoteAttribution} onChange={e => onChange({ ...block, props: { ...p, quoteAttribution: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image</Label>
              <ImagePicker value={p.imageUrl} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v } })} />
            </div>
            <div className="space-y-1.5">
              <VideoPicker label="Video (YouTube embed or library)" value={p.videoUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, videoUrl: v } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA text</Label>
              <Input value={p.ctaText} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA URL</Label>
              <Input value={p.ctaUrl} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value } })} placeholder="#" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Image URL (optional)</Label>
              <Input value={p.backgroundImage ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundImage: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            {p.backgroundImage && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay Opacity <span className="text-slate-400">({Math.round((p.backgroundOverlay ?? 0.55) * 100)}%)</span></Label>
                  <input type="color" value={p.overlayColor ?? "#000000"} onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })} className="h-6 w-10 rounded cursor-pointer border border-slate-200 p-0.5" title="Overlay color" />
                </div>
                <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                <input type="range" min={0} max={1} step={0.05} value={p.backgroundOverlay ?? 0.55} onChange={e => onChange({ ...block, props: { ...p, backgroundOverlay: parseFloat(e.target.value) } })} className="w-full accent-emerald-700" />
              </div>
            )}
          </div>
        );
      }
      case "dso-stat-bar": {
        const p = block.props;
        const stats = p.stats ?? [];
        const updateStat = (i: number, patch: Partial<{value: string; label: string}>) => {
          const next = stats.map((s, idx) => idx === i ? { ...s, ...patch } : s);
          onChange({ ...block, props: { ...p, stats: next } });
        };
        const addStat = () => onChange({ ...block, props: { ...p, stats: [...stats, { value: "", label: "" }] } });
        const removeStat = (i: number) => onChange({ ...block, props: { ...p, stats: stats.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</Label>
                <Button variant="ghost" size="sm" onClick={addStat} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {stats.map((stat, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Stat {i + 1}</span>
                      <button onClick={() => removeStat(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Value</Label>
                      <Input value={stat.value} onChange={e => updateStat(i, { value: e.target.value })} placeholder="30%" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Label</Label>
                      <Input value={stat.label} onChange={e => updateStat(i, { label: e.target.value })} placeholder="Avg case acceptance lift" className="h-8 text-xs mt-1" />
                    </div>
                  </div>
                ))}
                {stats.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No stats yet. Click Add to get started.</p>
                )}
              </div>
            </div>
          </div>
        );
      }
      case "dso-success-stories": {
        const p = block.props;
        const cases = p.cases ?? [];
        const updateCase = (i: number, patch: Partial<{name: string; stat: string; label: string; quote: string; author: string; image: string}>) => {
          const next = cases.map((c, idx) => idx === i ? { ...c, ...patch } : c);
          onChange({ ...block, props: { ...p, cases: next } });
        };
        const addCase = () => onChange({ ...block, props: { ...p, cases: [...cases, { name: "", stat: "", label: "", quote: "", author: "", image: "" }] } });
        // Index-keyed ephemeral UI state (approval + save status) must shift when a
        // story is removed, or it would drift onto the wrong card.
        const reindexAfterRemove = <T,>(m: Record<number, T>, removed: number): Record<number, T> => {
          const next: Record<number, T> = {};
          for (const key of Object.keys(m)) {
            const idx = Number(key);
            if (idx === removed) continue;
            next[idx > removed ? idx - 1 : idx] = m[idx];
          }
          return next;
        };
        const removeCase = (i: number) => {
          setStoryApprovedForAi(prev => reindexAfterRemove(prev, i));
          setStorySaveStatus(prev => reindexAfterRemove(prev, i));
          onChange({ ...block, props: { ...p, cases: cases.filter((_, idx) => idx !== i) } });
        };
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Image URL (optional)</Label>
              <Input value={p.backgroundImage ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundImage: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            {p.backgroundImage && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay Opacity <span className="text-slate-400">({Math.round((p.backgroundOverlay ?? 0.55) * 100)}%)</span></Label>
                  <input type="color" value={p.overlayColor ?? "#000000"} onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })} className="h-6 w-10 rounded cursor-pointer border border-slate-200 p-0.5" title="Overlay color" />
                </div>
                <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                <input type="range" min={0} max={1} step={0.05} value={p.backgroundOverlay ?? 0.55} onChange={e => onChange({ ...block, props: { ...p, backgroundOverlay: parseFloat(e.target.value) } })} className="w-full accent-emerald-700" />
              </div>
            )}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Success Stories</Label>
                <Button variant="ghost" size="sm" onClick={addCase} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {cases.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Story {i + 1}</span>
                      <button onClick={() => removeCase(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">DSO Name</Label>
                      <Input value={c.name} onChange={e => updateCase(i, { name: e.target.value })} placeholder="Acme Dental Group" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Card Image (optional)</Label>
                      <ImagePicker value={c.image ?? ""} onChange={v => updateCase(i, { image: v || undefined })} placeholder="https://images.unsplash.com/…" className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-slate-400">Stat</Label>
                        <Input value={c.stat} onChange={e => updateCase(i, { stat: e.target.value })} placeholder="30%" className="h-8 text-xs mt-1" />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-400">Stat label</Label>
                        <Input value={c.label} onChange={e => updateCase(i, { label: e.target.value })} placeholder="Remake reduction" className="h-8 text-xs mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Quote</Label>
                      <Textarea value={c.quote} onChange={e => updateCase(i, { quote: e.target.value })} rows={2} placeholder="Acme transformed…" className="text-xs mt-1 resize-none" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Attribution</Label>
                      <Input value={c.author} onChange={e => updateCase(i, { author: e.target.value })} placeholder="VP Clinical Operations" className="h-8 text-xs mt-1" />
                    </div>
                    <div className="border-t border-slate-200 pt-2 mt-1 space-y-2">
                      <label className="flex items-start gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={storyApprovedForAi[i] ?? true}
                          onChange={e => setStoryApprovedForAi(prev => ({ ...prev, [i]: e.target.checked }))}
                          className="mt-0.5 h-3.5 w-3.5"
                        />
                        <span className="text-slate-600">
                          Approved for AI use
                          <span className="block text-[11px] text-slate-400">
                            When Strict Facts Mode is on (Brand Settings), unapproved case studies will be hidden from AI generation.
                          </span>
                        </span>
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-xs gap-1.5"
                        disabled={storySaveStatus[i] === "saving"}
                        onClick={() => handleAddStoryToLibrary(c, i, storyApprovedForAi[i] ?? true)}
                      >
                        {storySaveStatus[i] === "saving"
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <BookmarkPlus className="w-3 h-3" />}
                        {storySaveStatus[i] === "saved"
                          ? "Added to library ✓"
                          : storySaveStatus[i] === "error"
                            ? "Failed — click to retry"
                            : "Add to library"}
                      </Button>
                    </div>
                  </div>
                ))}
                {cases.length === 0 && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-xs text-slate-400">No stories yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={loadingStoryDefaults}
                      onClick={async () => {
                        // Load the tenant's AI-approved case studies from the
                        // Content Library (source of truth for what's approved),
                        // never hardcoded/unapproved stories. The block's
                        // illustrative registry default is used ONLY when the
                        // library is genuinely empty (no case studies at all) or
                        // the request fails — when the library has case studies
                        // but none are approved, we load an empty set rather
                        // than reintroduce hardcoded stories.
                        setLoadingStoryDefaults(true);
                        try {
                          const res = await fetch("/api/lp/library/case_study");
                          if (res.ok) {
                            const items = (await res.json()) as Array<{
                              name?: string;
                              approved_for_ai?: boolean;
                              content?: {
                                title?: string; categories?: string; image?: string;
                                quote?: string; author?: string; stat?: string;
                                statLabel?: string; label?: string;
                              };
                            }>;
                            const library = Array.isArray(items) ? items : [];
                            const mapped = library
                              .filter((it) => it.approved_for_ai !== false)
                              .map((it) => {
                                const c = it.content ?? {};
                                return {
                                  name: it.name || c.title || "",
                                  stat: c.stat ?? "",
                                  label: c.statLabel || c.label || c.categories || "",
                                  quote: c.quote ?? "",
                                  author: c.author ?? "",
                                  image: c.image || "",
                                };
                              })
                              .filter((c) => c.name);
                            // Library has content: honour it exactly (approved
                            // items, or an empty set when none are approved).
                            // Never fall back to hardcoded stories here.
                            if (library.length > 0) {
                              onChange({ ...block, props: { ...p, cases: mapped } });
                              return;
                            }
                          }
                        } catch {
                          /* fall through to registry default */
                        } finally {
                          setLoadingStoryDefaults(false);
                        }
                        // Library is empty (or the request failed) — fall back to
                        // the block's illustrative registry default.
                        const fallback = (createBlock("dso-success-stories").props as typeof p).cases ?? [];
                        onChange({ ...block, props: { ...p, cases: fallback } });
                      }}
                    >
                      {loadingStoryDefaults ? "Loading…" : "Load defaults"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Button</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5"><p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p><p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p><Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button></div>}
            </div>
          </div>
        );
      }
      case "dso-challenges": {
        const p = block.props;
        const challenges = p.challenges ?? [];
        const updateChallenge = (i: number, patch: Partial<{title: string; desc: string}>) => {
          const next = challenges.map((c, idx) => idx === i ? { ...c, ...patch } : c);
          onChange({ ...block, props: { ...p, challenges: next } });
        };
        const addChallenge = () => onChange({ ...block, props: { ...p, challenges: [...challenges, { title: "", desc: "" }] } });
        const removeChallenge = (i: number) => onChange({ ...block, props: { ...p, challenges: challenges.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "muted"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Image URL (optional)</Label>
              <Input value={p.backgroundImage ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundImage: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            {p.backgroundImage && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay Opacity <span className="text-slate-400">({Math.round((p.backgroundOverlay ?? 0.55) * 100)}%)</span></Label>
                  <input type="color" value={p.overlayColor ?? "#000000"} onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })} className="h-6 w-10 rounded cursor-pointer border border-slate-200 p-0.5" title="Overlay color" />
                </div>
                <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                <input type="range" min={0} max={1} step={0.05} value={p.backgroundOverlay ?? 0.55} onChange={e => onChange({ ...block, props: { ...p, backgroundOverlay: parseFloat(e.target.value) } })} className="w-full accent-emerald-700" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <Select value={p.layout} onValueChange={v => onChange({ ...block, props: { ...p, layout: v as "4-col" | "2-col" } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4-col">4 columns</SelectItem>
                  <SelectItem value="2-col">2 columns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Challenges</Label>
                <Button variant="ghost" size="sm" onClick={addChallenge} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {challenges.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Card {i + 1}</span>
                      <button onClick={() => removeChallenge(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Title</Label>
                      <Input value={c.title} onChange={e => updateChallenge(i, { title: e.target.value })} placeholder="Inconsistent scan quality" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Description</Label>
                      <Textarea value={c.desc} onChange={e => updateChallenge(i, { desc: e.target.value })} rows={2} placeholder="Without standardized…" className="text-xs mt-1 resize-none" />
                    </div>
                  </div>
                ))}
                {challenges.length === 0 && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-xs text-slate-400">No challenges yet.</p>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange({ ...block, props: { ...block.props, challenges: [
                      { title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers." },
                      { title: "Fragmented Lab Relationships", desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
                      { title: "Standards That Don't Survive Growth", desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
                      { title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months." },
                    ] } } as PageBlock)}>
                      Load defaults
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
      case "dso-pilot-steps": {
        const p = block.props;
        const steps = p.steps ?? [];
        const updateStep = (i: number, patch: Partial<{title: string; subtitle: string; desc: string}>) => {
          const next = steps.map((s, idx) => idx === i ? { ...s, ...patch } : s);
          onChange({ ...block, props: { ...p, steps: next } });
        };
        const updateStepDetail = (stepIdx: number, detailIdx: number, val: string) => {
          const next = steps.map((s, i) => {
            if (i !== stepIdx) return s;
            const details = [...(s.details ?? [])];
            details[detailIdx] = val;
            return { ...s, details };
          });
          onChange({ ...block, props: { ...p, steps: next } });
        };
        const addStepDetail = (stepIdx: number) => {
          const next = steps.map((s, i) => i !== stepIdx ? s : { ...s, details: [...(s.details ?? []), ""] });
          onChange({ ...block, props: { ...p, steps: next } });
        };
        const removeStepDetail = (stepIdx: number, detailIdx: number) => {
          const next = steps.map((s, i) => i !== stepIdx ? s : { ...s, details: (s.details ?? []).filter((_, di) => di !== detailIdx) });
          onChange({ ...block, props: { ...p, steps: next } });
        };
        const addStep = () => onChange({ ...block, props: { ...p, steps: [...steps, { title: "", subtitle: "", desc: "", details: [] }] } });
        const removeStep = (i: number) => onChange({ ...block, props: { ...p, steps: steps.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "", subheadline: p.subheadline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "muted"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Image URL (optional)</Label>
              <Input value={p.backgroundImage ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundImage: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            {p.backgroundImage && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay Opacity <span className="text-slate-400">({Math.round((p.backgroundOverlay ?? 0.55) * 100)}%)</span></Label>
                  <input type="color" value={p.overlayColor ?? "#000000"} onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })} className="h-6 w-10 rounded cursor-pointer border border-slate-200 p-0.5" title="Overlay color" />
                </div>
                <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                <input type="range" min={0} max={1} step={0.05} value={p.backgroundOverlay ?? 0.55} onChange={e => onChange({ ...block, props: { ...p, backgroundOverlay: parseFloat(e.target.value) } })} className="w-full accent-emerald-700" />
              </div>
            )}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Steps</Label>
                <Button variant="ghost" size="sm" onClick={addStep} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Step {i + 1}</span>
                      <button onClick={() => removeStep(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Title</Label>
                      <Input value={step.title} onChange={e => updateStep(i, { title: e.target.value })} placeholder="Launch a Pilot" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Subtitle</Label>
                      <Input value={step.subtitle} onChange={e => updateStep(i, { subtitle: e.target.value })} placeholder="Start with 5–10 offices" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Description</Label>
                      <Textarea value={step.desc} onChange={e => updateStep(i, { desc: e.target.value })} rows={2} placeholder="Acme deploys…" className="text-xs mt-1 resize-none" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[11px] text-slate-400">Bullet points</Label>
                        <button onClick={() => addStepDetail(i)} className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-0.5">
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {(step.details ?? []).map((d, di) => (
                          <div key={di} className="flex gap-1">
                            <Input value={d} onChange={e => updateStepDetail(i, di, e.target.value)} placeholder="Detail point…" className="h-7 text-xs flex-1" />
                            <button onClick={() => removeStepDetail(i, di)} className="text-slate-300 hover:text-red-500 shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {steps.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No steps yet. Click Add to get started.</p>
                )}
              </div>
            </div>
          </div>
        );
      }
      case "dso-final-cta": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline", "primaryCtaText"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "", primaryCtaText: p.primaryCtaText ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Primary CTA text</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, primaryCtaText: (p.primaryCtaText ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.primaryCtaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, primaryCtaText: v } })} fieldLabel="Primary CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "primaryCtaText", p.primaryCtaText ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Primary CTA URL</Label>
              <Input value={p.primaryCtaUrl} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value } })} placeholder="#" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Primary CTA mode</Label>
              <Select value={p.primaryCtaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, primaryCtaMode: v as CtaMode } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link" className="text-xs">Link / Redirect</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {p.primaryCtaMode === "chilipiper" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Chili Piper URL</Label>
                <Input value={p.primaryChilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryChilipiperUrl: e.target.value } })} className="h-8 text-xs font-mono" placeholder="https://yourcompany.chilipiper.com/round-robin/..." />
              </div>
            )}
            {(p.primaryCtaMode === "modal-form" || p.primaryCtaMode === "modal-chilipiper") && (
              <CtaButtonModalConfigSection
                ctaAction={p.primaryCtaMode}
                value={p}
                onChange={(next) => onChange({ ...block, props: { ...p, ...next } })}
              />
            )}
            {onApplyCtaToAll && (
              <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.primaryCtaText && !p.primaryCtaUrl}>
                  Apply CTA to All Sections
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Secondary CTA text</Label>
              <Input value={p.secondaryCtaText} onChange={e => onChange({ ...block, props: { ...p, secondaryCtaText: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Secondary CTA URL</Label>
              <Input value={p.secondaryCtaUrl} onChange={e => onChange({ ...block, props: { ...p, secondaryCtaUrl: e.target.value } })} placeholder="#" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Image URL (optional)</Label>
              <Input value={p.backgroundImage ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundImage: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            {p.backgroundImage && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay Opacity <span className="text-slate-400">({Math.round((p.backgroundOverlay ?? 0.55) * 100)}%)</span></Label>
                  <input type="color" value={p.overlayColor ?? "#000000"} onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })} className="h-6 w-10 rounded cursor-pointer border border-slate-200 p-0.5" title="Overlay color" />
                </div>
                <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                <input type="range" min={0} max={1} step={0.05} value={p.backgroundOverlay ?? 0.55} onChange={e => onChange({ ...block, props: { ...p, backgroundOverlay: parseFloat(e.target.value) } })} className="w-full accent-emerald-700" />
              </div>
            )}
          </div>
        );
      }
      case "dso-comparison": {
        const p = block.props;
        const rows = p.rows ?? [];
        const updateRow = (i: number, patch: Partial<{need: string; dandy: string; traditional: string}>) => {
          const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
          onChange({ ...block, props: { ...p, rows: next } });
        };
        const addRow = () => onChange({ ...block, props: { ...p, rows: [...rows, { need: "", dandy: "", traditional: "" }] } });
        const removeRow = (i: number) => onChange({ ...block, props: { ...p, rows: rows.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">DSO company name (column header)</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, companyName: p.companyName + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, companyName: p.companyName + token } })} />
                </div>
              </div>
              <Input value={p.companyName} onChange={e => onChange({ ...block, props: { ...p, companyName: e.target.value } })} placeholder="Your DSO" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA text</Label>
              <Input value={p.ctaText} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Action</Label>
              <Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link" className="text-xs">Open URL</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(p.ctaMode ?? "link") === "link" && (
              <div className="space-y-1.5">
                <Label className="text-xs">CTA URL</Label>
                <Input value={p.ctaUrl} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value } })} placeholder="#" />
              </div>
            )}
            {p.ctaMode === "chilipiper" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Chili Piper URL</Label>
                <Input value={p.chilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value } })} className="font-mono" placeholder="https://yourcompany.chilipiper.com/..." />
              </div>
            )}
            {(p.ctaMode === "modal-form" || p.ctaMode === "modal-chilipiper") && (
              <CtaButtonModalConfigSection
                ctaAction={p.ctaMode}
                value={p}
                onChange={(next) => onChange({ ...block, props: { ...p, ...next } })}
              />
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "muted"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bgOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Image URL (optional)</Label>
              <Input value={p.backgroundImage ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundImage: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            {p.backgroundImage && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay Opacity <span className="text-slate-400">({Math.round((p.backgroundOverlay ?? 0.55) * 100)}%)</span></Label>
                  <input type="color" value={p.overlayColor ?? "#000000"} onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })} className="h-6 w-10 rounded cursor-pointer border border-slate-200 p-0.5" title="Overlay color" />
                </div>
                <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                <input type="range" min={0} max={1} step={0.05} value={p.backgroundOverlay ?? 0.55} onChange={e => onChange({ ...block, props: { ...p, backgroundOverlay: parseFloat(e.target.value) } })} className="w-full accent-emerald-700" />
              </div>
            )}
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Table Text Colors</Label>
              <ColorField
                label="Dandy column header"
                value={p.headerDandyColor}
                onChange={v => onChange({ ...block, props: { ...p, headerDandyColor: v } })}
              />
              <ColorField
                label="Need / Requirement column"
                value={p.tableNeedColor}
                onChange={v => onChange({ ...block, props: { ...p, tableNeedColor: v } })}
              />
              <ColorField
                label="Dandy answer column"
                value={p.tableDandyColor}
                onChange={v => onChange({ ...block, props: { ...p, tableDandyColor: v } })}
              />
              <ColorField
                label="Traditional lab column"
                value={p.tableTraditionalColor}
                onChange={v => onChange({ ...block, props: { ...p, tableTraditionalColor: v } })}
              />
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comparison Rows</Label>
                <Button variant="ghost" size="sm" onClick={addRow} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {rows.map((row, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Row {i + 1}</span>
                      <button onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Need / Requirement</Label>
                      <Input value={row.need} onChange={e => updateRow(i, { need: e.target.value })} placeholder="Scan quality standard" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Dandy (your value)</Label>
                      <Input value={row.dandy} onChange={e => updateRow(i, { dandy: e.target.value })} placeholder="AI quality control on every case" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Traditional lab</Label>
                      <Input value={row.traditional} onChange={e => updateRow(i, { traditional: e.target.value })} placeholder="Manual inspection, inconsistent" className="h-8 text-xs mt-1" />
                    </div>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No rows yet. Click Add to get started.</p>
                )}
              </div>
            </div>
          </div>
        );
      }
      case "dso-heartland-hero": {
        const p = block.props;
        const stats = p.stats ?? [];
        const updateStat = (i: number, field: "value" | "label", val: string) => {
          const next = stats.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
          onChange({ ...block, props: { ...p, stats: next } });
        };
        const addStat = () => onChange({ ...block, props: { ...p, stats: [...stats, { value: "", label: "" }] } });
        const removeStat = (i: number) => onChange({ ...block, props: { ...p, stats: stats.filter((_, idx) => idx !== i) } });
        const reorderStat = (from: number, to: number) => {
          const next = stats.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          onChange({ ...block, props: { ...p, stats: next } });
        };
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline", "primaryCtaText"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "", primaryCtaText: p.primaryCtaText ?? "" }} />

            {/* Layout */}
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <div className="flex gap-2 flex-wrap">
                {([["full-bleed", "Full Bleed"], ["split", "2-Col Image"], ["split-video", "2-Col Video"], ["stacked-video", "Stacked Video"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => onChange({ ...block, props: { ...p, layout: val } })} className={`flex-1 py-1.5 text-xs rounded border ${(p.layout ?? "full-bleed") === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background color */}
            <div className="space-y-1.5">
              <Label className="text-xs">Background color</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Scroll fade toggle — all layouts */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Scroll fade</Label>
                <p className="text-[11px] text-muted-foreground">Content fades out as you scroll down</p>
              </div>
              <button
                onClick={() => onChange({ ...block, props: { ...p, disableScrollFade: !p.disableScrollFade } })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${!p.disableScrollFade ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${!p.disableScrollFade ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Sticky premium header toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Sticky premium header</Label>
                <p className="text-[11px] text-muted-foreground">Header blends into the hero, then frosts on scroll.</p>
              </div>
              <button
                onClick={() => onChange({ ...block, props: { ...p, stickyHeader: !p.stickyHeader } })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${p.stickyHeader ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${p.stickyHeader ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Hide brand logo toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Hide logo</Label>
                <p className="text-[11px] text-muted-foreground">Remove your brand logo (top-left) from the nav.</p>
              </div>
              <button
                onClick={() => onChange({ ...block, props: { ...p, hideBrandLogo: !p.hideBrandLogo } })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${p.hideBrandLogo ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${p.hideBrandLogo ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Hide nav CTA toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Hide nav CTA</Label>
                <p className="text-[11px] text-muted-foreground">Remove the top-right CTA pill. Body CTAs are unaffected.</p>
              </div>
              <button
                onClick={() => onChange({ ...block, props: { ...p, hideNavCta: !p.hideNavCta } })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${p.hideNavCta ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${p.hideNavCta ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Nav links (used by sticky header) */}
            {p.stickyHeader && (() => {
              const nav = p.navLinks ?? [];
              const updateNav = (i: number, key: "label" | "href", val: string) => {
                const next = nav.map((l, idx) => idx === i ? { ...l, [key]: val } : l);
                onChange({ ...block, props: { ...p, navLinks: next } });
              };
              const addNav = () => onChange({ ...block, props: { ...p, navLinks: [...nav, { label: "New", href: "#" }] } });
              const removeNav = (i: number) => onChange({ ...block, props: { ...p, navLinks: nav.filter((_, idx) => idx !== i) } });
              return (
                <div className="space-y-2 border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nav links</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={addNav}><Plus className="w-3 h-3" /> Add</Button>
                  </div>
                  {nav.map((l, i) => (
                    <div key={i} className="flex gap-2 items-start bg-muted/40 rounded-lg p-2">
                      <div className="flex-1 grid grid-cols-2 gap-1">
                        <Input className="h-7 text-xs" placeholder="Label" value={l.label} onChange={e => updateNav(i, "label", e.target.value)} />
                        <Input className="h-7 text-xs" placeholder="#anchor or URL" value={l.href} onChange={e => updateNav(i, "href", e.target.value)} />
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeNav(i)}>×</Button>
                    </div>
                  ))}
                  {nav.length === 0 && <p className="text-[11px] text-muted-foreground">Use #section-id to smooth-scroll to other blocks on this page.</p>}
                </div>
              );
            })()}

            {/* Hero sizing controls — only for video layouts */}
            {(p.layout === "split-video" || p.layout === "stacked-video") && (
              <div className="space-y-4 border border-border rounded-lg p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Hero sizing</p>

                {/* Min height */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Min height</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {p.heroMinHeight ?? (p.layout === "split-video" ? 80 : 70)}vh
                    </span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    step={5}
                    value={p.heroMinHeight ?? (p.layout === "split-video" ? 80 : 70)}
                    onChange={e => onChange({ ...block, props: { ...p, heroMinHeight: Number(e.target.value) } })}
                    className="w-full accent-primary"
                  />
                </div>

                {/* Top padding (space above content / below nav) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{p.layout === "split-video" ? "Top space" : "Content top padding"}</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {p.heroTopPadding ?? (p.layout === "stacked-video" ? 128 : 0)}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={280}
                    step={8}
                    value={p.heroTopPadding ?? (p.layout === "stacked-video" ? 128 : 0)}
                    onChange={e => onChange({ ...block, props: { ...p, heroTopPadding: Number(e.target.value) } })}
                    className="w-full accent-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {p.layout === "split-video" ? "Grows the hero from the top — content stays centered." : "Space between the navbar and the headline."}
                  </p>
                </div>

                {/* Heading font size */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Heading size</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {p.heroHeadingSize ?? 100}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={180}
                    step={5}
                    value={p.heroHeadingSize ?? 100}
                    onChange={e => onChange({ ...block, props: { ...p, heroHeadingSize: Number(e.target.value) } })}
                    className="w-full accent-primary"
                  />
                </div>

                {/* Video size */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Video size</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {p.layout === "split-video"
                        ? `${p.heroVideoWidth ?? 48}%`
                        : `${p.heroVideoWidth ?? 1100}px`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={p.layout === "split-video" ? 30 : 400}
                    max={p.layout === "split-video" ? 65 : 1400}
                    step={p.layout === "split-video" ? 1 : 50}
                    value={p.heroVideoWidth ?? (p.layout === "split-video" ? 48 : 1100)}
                    onChange={e => onChange({ ...block, props: { ...p, heroVideoWidth: Number(e.target.value) } })}
                    className="w-full accent-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {p.layout === "split-video" ? "% of the row width used by the video column." : "Max width of the video showcase below the text."}
                  </p>
                </div>

                {/* Side padding (split-video only — content column width) */}
                {p.layout === "split-video" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Content side padding</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {p.heroSidePadding ?? 48}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={120}
                      step={8}
                      value={p.heroSidePadding ?? 48}
                      onChange={e => onChange({ ...block, props: { ...p, heroSidePadding: Number(e.target.value) } })}
                      className="w-full accent-primary"
                    />
                    <p className="text-[11px] text-muted-foreground">Horizontal padding inside the text column.</p>
                  </div>
                )}
              </div>
            )}

            {/* Full-bleed media */}
            {(p.layout ?? "full-bleed") === "full-bleed" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Background image (optional)</Label>
                  <ImagePicker value={p.backgroundImageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, backgroundImageUrl: v } })} />
                </div>
                <div className="space-y-1.5">
                  <VideoPicker label="Background Video (optional)" value={p.backgroundVideoUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, backgroundVideoUrl: v || undefined } })} />
                  <p className="text-[11px] text-muted-foreground">Overrides background image when set. Use a direct MP4/WebM link.</p>
                </div>
                {p.backgroundImageUrl && !p.backgroundVideoUrl && (
                  <div className="space-y-3 border border-border rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Image framing</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Image fit</Label>
                      <div className="flex gap-2">
                        {(["cover", "contain"] as const).map(fit => (
                          <button key={fit} onClick={() => onChange({ ...block, props: { ...p, heroImageFit: fit } })} className={`flex-1 py-1.5 text-xs rounded border capitalize ${(p.heroImageFit ?? "cover") === fit ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                            {fit}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Image anchor (focal point)</Label>
                      <div className="grid grid-cols-3 gap-1">
                        {([
                          ["top left", "↖"], ["top", "↑"], ["top right", "↗"],
                          ["left", "←"], ["center", "•"], ["right", "→"],
                          ["bottom left", "↙"], ["bottom", "↓"], ["bottom right", "↘"],
                        ] as const).map(([pos, glyph]) => (
                          <button
                            key={pos}
                            onClick={() => onChange({ ...block, props: { ...p, heroImagePosition: pos } })}
                            className={`py-1.5 text-sm rounded border ${(p.heroImagePosition ?? "center") === pos ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                            title={pos}
                          >
                            {glyph}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Image zoom: {(p.heroImageScale ?? 1).toFixed(2)}×</Label>
                      <Slider value={[p.heroImageScale ?? 1]} min={0.5} max={3} step={0.05} onValueChange={([v]) => onChange({ ...block, props: { ...p, heroImageScale: v } })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Image padding: {p.heroImagePadding ?? 0}px</Label>
                      <Slider value={[p.heroImagePadding ?? 0]} min={0} max={120} step={2} onValueChange={([v]) => onChange({ ...block, props: { ...p, heroImagePadding: v } })} />
                    </div>
                  </div>
                )}
                {(p.backgroundImageUrl || p.backgroundVideoUrl) && (
                  <div className="space-y-3 border border-border rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Overlay</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded border border-border cursor-pointer shrink-0 overflow-hidden"
                        style={{ backgroundColor: p.overlayColor ?? "#0d1f1e" }}
                      >
                        <input
                          type="color"
                          value={p.overlayColor ?? "#0d1f1e"}
                          onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })}
                          className="opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                      <Input
                        value={p.overlayColor ?? "#0d1f1e"}
                        onChange={e => onChange({ ...block, props: { ...p, overlayColor: e.target.value } })}
                        className="h-7 text-xs font-mono flex-1"
                        placeholder="#0d1f1e"
                      />
                    </div>
                    <BrandSwatches current={p.overlayColor} onPick={hex => onChange({ ...block, props: { ...p, overlayColor: hex } })} />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Opacity</Label>
                        <span className="text-xs text-muted-foreground tabular-nums">{p.overlayOpacity ?? 55}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={p.overlayOpacity ?? 55}
                        onChange={e => onChange({ ...block, props: { ...p, overlayOpacity: Number(e.target.value) } })}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Background dimming</Label>
                        <span className="text-xs text-muted-foreground tabular-nums">{p.scrimStrength ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={150}
                        step={5}
                        value={p.scrimStrength ?? 100}
                        onChange={e => onChange({ ...block, props: { ...p, scrimStrength: Number(e.target.value) } })}
                        className="w-full accent-primary"
                      />
                      <p className="text-[11px] text-muted-foreground">Extra dimming behind the headline and CTAs to keep text readable. Lower it for already-dark photos; raise it for light or busy ones.</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Two-column image */}
            {(p.layout ?? "full-bleed") === "split" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hero image</Label>
                  <ImagePicker value={p.heroImageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, heroImageUrl: v } })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image side</Label>
                  <div className="flex gap-2">
                    {(["left", "right"] as const).map(side => (
                      <button key={side} onClick={() => onChange({ ...block, props: { ...p, heroImageSide: side } })} className={`flex-1 py-1.5 text-xs rounded border capitalize ${(p.heroImageSide ?? "right") === side ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                        Image {side}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image fit</Label>
                  <div className="flex gap-2">
                    {(["cover", "contain"] as const).map(fit => (
                      <button key={fit} onClick={() => onChange({ ...block, props: { ...p, heroImageFit: fit } })} className={`flex-1 py-1.5 text-xs rounded border capitalize ${(p.heroImageFit ?? "cover") === fit ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                        {fit}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    <strong>Cover</strong>: crops &amp; fills (best for photos). <strong>Contain</strong>: shows whole image (best for product shots / transparent PNGs like the crown).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image column width: {p.heroImageWidth ?? 45}%</Label>
                  <Slider value={[p.heroImageWidth ?? 45]} min={25} max={70} step={1} onValueChange={([v]) => onChange({ ...block, props: { ...p, heroImageWidth: v } })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image padding: {p.heroImagePadding ?? ((p.heroImageFit ?? "cover") === "contain" ? 32 : 0)}px</Label>
                  <Slider value={[p.heroImagePadding ?? ((p.heroImageFit ?? "cover") === "contain" ? 32 : 0)]} min={0} max={120} step={2} onValueChange={([v]) => onChange({ ...block, props: { ...p, heroImagePadding: v } })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image anchor (focal point)</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ["top left", "↖"], ["top", "↑"], ["top right", "↗"],
                      ["left", "←"], ["center", "•"], ["right", "→"],
                      ["bottom left", "↙"], ["bottom", "↓"], ["bottom right", "↘"],
                    ] as const).map(([pos, glyph]) => (
                      <button
                        key={pos}
                        onClick={() => onChange({ ...block, props: { ...p, heroImagePosition: pos } })}
                        className={`py-1.5 text-sm rounded border ${(p.heroImagePosition ?? "center") === pos ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                        title={pos}
                      >
                        {glyph}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    With <strong>cover</strong> fit, this is the focal point that stays visible — the rest bleeds off the opposite edges. To match meetdandy.com Crown &amp; Bridge, choose <strong>top left</strong> so the crown bleeds off bottom &amp; right.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image zoom: {(p.heroImageScale ?? 1).toFixed(2)}×</Label>
                  <Slider value={[p.heroImageScale ?? 1]} min={0.5} max={3} step={0.05} onValueChange={([v]) => onChange({ ...block, props: { ...p, heroImageScale: v } })} />
                </div>
                {p.heroImageUrl && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Background dimming</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{p.assetDimming ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={p.assetDimming ?? 0}
                      onChange={e => onChange({ ...block, props: { ...p, assetDimming: Number(e.target.value) } })}
                      className="w-full accent-primary"
                    />
                    <p className="text-[11px] text-muted-foreground">Darkens the hero image to keep any text or logos overlaid on it readable. 0% keeps the photo as-is; raise it for bright or busy shots.</p>
                  </div>
                )}
              </>
            )}

            {/* Video picker — shown for both split-video and stacked-video */}
            {(p.layout === "split-video" || p.layout === "stacked-video") && (
              <>
                <div className="space-y-1.5">
                  <VideoPicker label="Hero Video" value={p.heroVideoUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, heroVideoUrl: v || undefined } })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Autoplay video</Label>
                  <Switch checked={p.videoAutoplay !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, videoAutoplay: v } })} />
                </div>
                {p.layout === "split-video" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Video side</Label>
                    <div className="flex gap-2">
                      {(["right", "left"] as const).map(side => (
                        <button key={side} onClick={() => onChange({ ...block, props: { ...p, heroImageSide: side } })} className={`flex-1 py-1.5 text-xs rounded border capitalize ${(p.heroImageSide ?? "right") === side ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                          Video {side}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {p.heroVideoUrl && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Background dimming</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{p.assetDimming ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={p.assetDimming ?? 0}
                      onChange={e => onChange({ ...block, props: { ...p, assetDimming: Number(e.target.value) } })}
                      className="w-full accent-primary"
                    />
                    <p className="text-[11px] text-muted-foreground">Darkens the hero video to keep any text or logos overlaid on it readable. 0% keeps the footage as-is; raise it for bright or busy clips.</p>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow (optional)</Label>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Company name to highlight (in your accent color)</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, companyName: p.companyName + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, companyName: p.companyName + token } })} />
                </div>
              </div>
              <Input value={p.companyName} onChange={e => onChange({ ...block, props: { ...p, companyName: e.target.value } })} placeholder="{company}" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Partner / co-brand logo (optional)</Label>
              <ImagePicker value={p.companyLogoUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, companyLogoUrl: v } })} />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Shown in the nav as <span className="font-medium">Dandy × [logo]</span>. Replaces the company name text. Dark logos are auto-inverted to white for the dark hero background.
              </p>
              {p.companyLogoUrl && (
                <Input
                  value={p.companyLogoAlt ?? ""}
                  onChange={e => onChange({ ...block, props: { ...p, companyLogoAlt: e.target.value } })}
                  placeholder="Logo alt text (e.g. 'Heartland Dental')"
                  className="h-8 text-xs"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary CTA</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">CTA style</Label>
                <Select value={p.ctaStyle ?? "buttons"} onValueChange={v => onChange({ ...block, props: { ...p, ctaStyle: v as "buttons" | "email-capture" } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buttons" className="text-xs">Buttons (primary + secondary)</SelectItem>
                    <SelectItem value="email-capture" className="text-xs">Inline email capture pill</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Email capture mirrors the meetdandy.com Crown &amp; Bridge hero. On submit, the email is appended to the CTA URL as <code>?email=…</code>.
                </p>
              </div>
              {(p.ctaStyle === "email-capture") && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email field placeholder</Label>
                    <Input value={p.emailCapturePlaceholder ?? ""} onChange={e => onChange({ ...block, props: { ...p, emailCapturePlaceholder: e.target.value } })} placeholder="Email address" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Submit button label</Label>
                    <Input value={p.emailCaptureButtonText ?? ""} onChange={e => onChange({ ...block, props: { ...p, emailCaptureButtonText: e.target.value } })} placeholder="GET STARTED" className="h-8 text-xs" />
                    <p className="text-[11px] text-muted-foreground">Falls back to "CTA text" below if blank.</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-dashed">
                    <Label className="text-xs">On submit</Label>
                    <Select value={p.submitMode ?? "navigate"} onValueChange={v => onChange({ ...block, props: { ...p, submitMode: v as "navigate" | "modal-form" | "modal-chilipiper" } })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="navigate" className="text-xs">Redirect to URL</SelectItem>
                        <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                        <SelectItem value="modal-chilipiper" className="text-xs">Open modal with Chili Piper</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Email is pre-populated in the modal.</p>
                  </div>

                  {p.submitMode === "modal-chilipiper" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Chili Piper booking URL</Label>
                      <Input value={p.modalChilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalChilipiperUrl: e.target.value } })} placeholder="https://yourcompany.chilipiper.com/router/…" className="h-8 text-xs" />
                    </div>
                  )}

                  {p.submitMode === "modal-form" && (
                    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                      <Label className="text-xs font-semibold uppercase tracking-wider">Modal form</Label>
                      <ModalFormSourcePanel
                        value={{
                          modalFormSource: p.modalFormSource,
                          modalFormId: p.modalFormId,
                          modalMarketoBaseUrl: p.modalMarketoBaseUrl,
                          modalMarketoMunchkinId: p.modalMarketoMunchkinId,
                          modalMarketoFormId: p.modalMarketoFormId,
                        }}
                        onChange={next => onChange({ ...block, props: { ...p, ...next } })}
                      />
                      <div className="space-y-1.5">
                        <Label className="text-xs">Headline</Label>
                        <Input value={p.modalHeadline ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalHeadline: e.target.value } })} placeholder="Tell us a bit about you" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Subheadline</Label>
                        <Input value={p.modalSubheadline ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalSubheadline: e.target.value } })} placeholder="We'll be in touch shortly." className="h-8 text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.modalShowFirstName !== false} onChange={e => onChange({ ...block, props: { ...p, modalShowFirstName: e.target.checked } })} />First name</label>
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.modalShowLastName !== false} onChange={e => onChange({ ...block, props: { ...p, modalShowLastName: e.target.checked } })} />Last name</label>
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.modalShowPhone !== false} onChange={e => onChange({ ...block, props: { ...p, modalShowPhone: e.target.checked } })} />Phone</label>
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!p.modalShowCompany} onChange={e => onChange({ ...block, props: { ...p, modalShowCompany: e.target.checked } })} />Company</label>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Submit button text</Label>
                        <Input value={p.modalSubmitText ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalSubmitText: e.target.value } })} placeholder="Submit" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Success message</Label>
                        <Input value={p.modalSuccessMessage ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalSuccessMessage: e.target.value } })} placeholder="Thanks! We'll be in touch shortly." className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Disclaimer (under submit)</Label>
                        <Input value={p.modalDisclaimer ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalDisclaimer: e.target.value } })} className="h-8 text-xs" />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">CTA text</Label>
                <AiTextField type="input" value={p.primaryCtaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, primaryCtaText: v } })} fieldLabel="Primary CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "primaryCtaText", p.primaryCtaText ?? "", { headline: p.headline ?? "" })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CTA mode</Label>
                <Select value={p.primaryCtaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, primaryCtaMode: v as CtaMode } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link" className="text-xs">Link / Redirect</SelectItem>
                    <SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(p.primaryCtaMode ?? "link") === "link" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">CTA URL</Label>
                  <Input value={p.primaryCtaUrl} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value } })} placeholder="#" className="h-8 text-xs" />
                </div>
              )}
              {(p.primaryCtaMode ?? "link") === "chilipiper" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Chili Piper URL</Label>
                  <Input value={p.primaryCtaUrl} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value } })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs" />
                  <p className="text-[11px] text-muted-foreground">Opens the scheduling popup when the button is clicked.</p>
                </div>
              )}
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply Primary CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies the CTA text, URL, and mode above to every section on this page.</p>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                    onClick={onApplyCtaToAll}
                    disabled={!p.primaryCtaText && !p.primaryCtaUrl}
                  >
                    Apply CTA to All Sections
                  </Button>
                </div>
              )}
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secondary CTA (optional)</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">CTA text</Label>
                <Input value={p.secondaryCtaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, secondaryCtaText: e.target.value } })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CTA URL</Label>
                <Input value={p.secondaryCtaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, secondaryCtaUrl: e.target.value } })} placeholder="#" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Stats bar items (up to 4)</Label>
                {stats.length < 4 && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={addStat}>
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                )}
              </div>
              <StatsReorderList stats={stats} onReorder={reorderStat} onUpdate={updateStat} onRemove={removeStat} />
            </div>

            {/* Button colors */}
            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button Colors</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Button background</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.buttonColor ?? "#C7E738" }}>
                    <input type="color" value={p.buttonColor ?? "#C7E738"} onChange={e => onChange({ ...block, props: { ...p, buttonColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.buttonColor ?? ""} onChange={e => onChange({ ...block, props: { ...p, buttonColor: e.target.value } })} placeholder="brand accent" className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Button text color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.buttonTextColor ?? "#0a1416" }}>
                    <input type="color" value={p.buttonTextColor ?? "#0a1416"} onChange={e => onChange({ ...block, props: { ...p, buttonTextColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.buttonTextColor ?? ""} onChange={e => onChange({ ...block, props: { ...p, buttonTextColor: e.target.value } })} placeholder="#0a1416" className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stat value color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.statValueColor ?? "#C7E738" }}>
                    <input type="color" value={p.statValueColor ?? "#C7E738"} onChange={e => onChange({ ...block, props: { ...p, statValueColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.statValueColor ?? ""} onChange={e => onChange({ ...block, props: { ...p, statValueColor: e.target.value } })} placeholder="brand accent" className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stat label color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.statLabelColor ?? "#7d8a8d" }}>
                    <input type="color" value={p.statLabelColor ?? "#7d8a8d"} onChange={e => onChange({ ...block, props: { ...p, statLabelColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.statLabelColor ?? ""} onChange={e => onChange({ ...block, props: { ...p, statLabelColor: e.target.value } })} placeholder="muted gray" className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Stat value size</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.statValueSize ?? 100}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={180}
                  step={5}
                  value={p.statValueSize ?? 100}
                  onChange={e => onChange({ ...block, props: { ...p, statValueSize: Number(e.target.value) } })}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Value / label spacing</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.statLabelGap ?? 4}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={32}
                  step={1}
                  value={p.statLabelGap ?? 4}
                  onChange={e => onChange({ ...block, props: { ...p, statLabelGap: Number(e.target.value) } })}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>
        );
      }
      case "dandy-product-hero": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline", "primaryCtaText", "disclaimer"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "", primaryCtaText: p.primaryCtaText ?? "", disclaimer: p.disclaimer ?? "" }} />

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Eyebrow</Label>
                <Input value={p.eyebrow ?? ""} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} placeholder="Crown & Bridge" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Headline (use \n for line break)</Label>
                <Textarea rows={2} value={p.headline ?? ""} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subheadline</Label>
                <Textarea rows={3} value={p.subheadline ?? ""} onChange={e => onChange({ ...block, props: { ...p, subheadline: e.target.value } })} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Disclaimer (under email pill)</Label>
                <Textarea rows={2} value={p.disclaimer ?? ""} onChange={e => onChange({ ...block, props: { ...p, disclaimer: e.target.value } })} className="text-xs" />
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">CTA Action</Label>
                <Select
                  value={p.ctaAction ?? "inline-form"}
                  onValueChange={v => onChange({ ...block, props: { ...p, ctaAction: v as "inline-form" | "url" | "chilipiper" | "modal-form" | "modal-chilipiper" } })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inline-form" className="text-xs">Inline email form (default)</SelectItem>
                    <SelectItem value="url" className="text-xs">Open URL</SelectItem>
                    <SelectItem value="chilipiper" className="text-xs">Open Chili Piper (iframe)</SelectItem>
                    <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                    <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Button label</Label>
                <Input value={p.primaryCtaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryCtaText: e.target.value } })} placeholder="Get Started" className="h-8 text-xs" />
              </div>

              {(p.ctaAction ?? "inline-form") === "inline-form" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email field placeholder</Label>
                    <Input value={p.emailPlaceholder ?? ""} onChange={e => onChange({ ...block, props: { ...p, emailPlaceholder: e.target.value } })} placeholder="Email address" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Submit URL (email is appended as ?email=…)</Label>
                    <Input value={p.primaryCtaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value } })} placeholder="https://…" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CTA mode</Label>
                    <Select value={p.primaryCtaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, primaryCtaMode: v as CtaMode } })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link" className="text-xs">Link / Redirect</SelectItem>
                        <SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-dashed">
                    <Label className="text-xs">On submit</Label>
                    <Select value={p.submitMode ?? "navigate"} onValueChange={v => onChange({ ...block, props: { ...p, submitMode: v as "navigate" | "modal-form" | "modal-chilipiper" } })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="navigate" className="text-xs">Redirect to URL</SelectItem>
                        <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                        <SelectItem value="modal-chilipiper" className="text-xs">Open modal with Chili Piper</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Email is pre-populated in the modal.</p>
                  </div>
                </>
              )}

              {p.ctaAction === "url" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">CTA URL</Label>
                  <Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://…" className="h-8 text-xs" />
                </div>
              )}

              {p.ctaAction === "chilipiper" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Chili Piper URL</Label>
                  <Input value={p.chilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value || undefined } })} placeholder="https://yourcompany.chilipiper.com/router/…" className="h-8 text-xs font-mono" />
                </div>
              )}

              {(p.ctaAction === "modal-form" || p.ctaAction === "modal-chilipiper") && (
                <CtaButtonModalConfigSection
                  ctaAction={p.ctaAction}
                  value={p}
                  onChange={next => onChange({ ...block, props: { ...p, ...next } })}
                />
              )}

              {p.submitMode === "modal-chilipiper" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Chili Piper booking URL</Label>
                  <Input value={p.modalChilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalChilipiperUrl: e.target.value } })} placeholder="https://yourcompany.chilipiper.com/router/…" className="h-8 text-xs" />
                </div>
              )}

              {p.submitMode === "modal-form" && p.modalFormSource === "marketo" && (
                <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider">Chili Piper hand-off (after Marketo submit)</Label>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Chili Piper URL</Label>
                    <Input
                      value={p.modalChiliPiperHandoffUrl ?? ""}
                      onChange={e => onChange({ ...block, props: { ...p, modalChiliPiperHandoffUrl: e.target.value || undefined } })}
                      placeholder="https://yourcompany.chilipiper.com/router/your-router"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mode</Label>
                    <Select
                      value={p.modalChiliPiperHandoffMode ?? "modal"}
                      onValueChange={v => onChange({ ...block, props: { ...p, modalChiliPiperHandoffMode: v as "modal" | "redirect" } })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modal" className="text-xs">Modal (in-page iframe)</SelectItem>
                        <SelectItem value="redirect" className="text-xs">Redirect (open in new tab)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    After submit, the visitor is handed off to this Chili Piper router with their identity fields prefilled. Leave blank to skip the hand-off.
                  </p>
                </div>
              )}

              {p.submitMode === "modal-form" && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider">Modal form</Label>
                  <ModalFormSourcePanel
                    value={{
                      modalFormSource: p.modalFormSource,
                      modalFormId: p.modalFormId,
                      modalMarketoBaseUrl: p.modalMarketoBaseUrl,
                      modalMarketoMunchkinId: p.modalMarketoMunchkinId,
                      modalMarketoFormId: p.modalMarketoFormId,
                    }}
                    onChange={next => onChange({ ...block, props: { ...p, ...next } })}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Headline</Label>
                    <Input value={p.modalHeadline ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalHeadline: e.target.value } })} placeholder="Tell us a bit about you" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subheadline</Label>
                    <Input value={p.modalSubheadline ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalSubheadline: e.target.value } })} placeholder="We'll be in touch shortly." className="h-8 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.modalShowFirstName !== false} onChange={e => onChange({ ...block, props: { ...p, modalShowFirstName: e.target.checked } })} />First name</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.modalShowLastName !== false} onChange={e => onChange({ ...block, props: { ...p, modalShowLastName: e.target.checked } })} />Last name</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.modalShowPhone !== false} onChange={e => onChange({ ...block, props: { ...p, modalShowPhone: e.target.checked } })} />Phone</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!p.modalShowCompany} onChange={e => onChange({ ...block, props: { ...p, modalShowCompany: e.target.checked } })} />Company</label>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Submit button text</Label>
                    <Input value={p.modalSubmitText ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalSubmitText: e.target.value } })} placeholder="Submit" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Success message</Label>
                    <Input value={p.modalSuccessMessage ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalSuccessMessage: e.target.value } })} placeholder="Thanks! We'll be in touch shortly." className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Disclaimer (under submit)</Label>
                    <Input value={p.modalDisclaimer ?? ""} onChange={e => onChange({ ...block, props: { ...p, modalDisclaimer: e.target.value } })} className="h-8 text-xs" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Image</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Image</Label>
                <ImagePicker value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v } })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alt text</Label>
                <Input value={p.imageAlt ?? ""} onChange={e => onChange({ ...block, props: { ...p, imageAlt: e.target.value } })} className="h-8 text-xs" />
              </div>
              <div className="flex items-center justify-between">
                <Label className={`text-xs ${(p.variant ?? "split") !== "split" ? "text-muted-foreground/60" : ""}`}>
                  Bleed off right edge
                </Label>
                <Switch
                  checked={p.imageBleed !== false}
                  disabled={(p.variant ?? "split") !== "split"}
                  onCheckedChange={v => onChange({ ...block, props: { ...p, imageBleed: v } })}
                />
              </div>
              {(p.variant ?? "split") !== "split" && (
                <p className="text-[10px] text-muted-foreground -mt-1">
                  Bleed only applies to the <strong>Split</strong> variant. Switch the variant above to enable it.
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Image anchor (focal point)</Label>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    ["top left", "↖"], ["top", "↑"], ["top right", "↗"],
                    ["left", "←"], ["center", "•"], ["right", "→"],
                    ["bottom left", "↙"], ["bottom", "↓"], ["bottom right", "↘"],
                  ] as const).map(([pos, glyph]) => (
                    <button key={pos} onClick={() => onChange({ ...block, props: { ...p, imageAnchor: pos } })} className={`py-1.5 text-sm rounded border ${(p.imageAnchor ?? "top left") === pos ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`} title={pos}>
                      {glyph}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Image zoom: {(p.imageScale ?? 1.35).toFixed(2)}×</Label>
                <Slider value={[p.imageScale ?? 1.35]} min={0.5} max={3} step={0.05} onValueChange={([v]) => onChange({ ...block, props: { ...p, imageScale: v } })} />
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...block, props: {
                  ...p,
                  imageUrl: "/images/dandy-crown-bridge-spin.webp",
                  imageAlt: p.imageAlt || "Dandy crown",
                  imageBleed: false,
                  imageAnchor: "center",
                  imageScale: 1,
                  spinImage: true,
                  spinDuration: p.spinDuration ?? 18,
                  spinDirection: p.spinDirection ?? "cw",
                } })}
                className="w-full py-2 text-xs font-medium rounded-md border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
              >
                ↻ Use the Dandy spinning crown
              </button>
              <p className="text-[11px] text-muted-foreground -mt-1">Loads the crown image, centers it, and turns on the spin animation in one click.</p>
              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs">Spin image (Hero 7 Style 3)</Label>
                <Switch checked={p.spinImage ?? false} onCheckedChange={(v) => onChange({ ...block, props: { ...p, spinImage: v } })} />
              </div>
              {p.spinImage && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Spin duration: {p.spinDuration ?? 18}s / rotation</Label>
                    <Slider value={[p.spinDuration ?? 18]} min={4} max={60} step={1} onValueChange={([v]) => onChange({ ...block, props: { ...p, spinDuration: v } })} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["cw", "ccw"] as const).map(dir => (
                      <button key={dir} onClick={() => onChange({ ...block, props: { ...p, spinDirection: dir } })} className={`py-1.5 text-xs rounded border ${(p.spinDirection ?? "cw") === dir ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                        {dir === "cw" ? "Clockwise ↻" : "Counter ↺"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout Variant</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ["split", "Split", "Hard line, image bleeds right"],
                  ["card", "Grey Card", "Card behind copy + form"],
                  ["gradient", "Gradient", "Soft fade between sides"],
                ] as const).map(([val, label, hint]) => (
                  <button
                    key={val}
                    onClick={() => onChange({ ...block, props: { ...p, variant: val } })}
                    className={`py-2 px-2 text-[11px] rounded border ${(p.variant ?? "split") === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    title={hint}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Input style</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    ["rounded", "Rounded (pill)"],
                    ["square", "Square corners"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => onChange({ ...block, props: { ...p, inputStyle: val } })}
                      className={`py-1.5 text-xs rounded border ${(p.inputStyle ?? "rounded") === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Left column width: {(p.leftColumnFr ?? 1.05).toFixed(2)}fr</Label>
                <Slider value={[p.leftColumnFr ?? 1.05]} min={0.5} max={2} step={0.05} onValueChange={([v]) => onChange({ ...block, props: { ...p, leftColumnFr: v } })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Right column width: {(p.rightColumnFr ?? 1).toFixed(2)}fr</Label>
                <Slider value={[p.rightColumnFr ?? 1]} min={0.5} max={2} step={0.05} onValueChange={([v]) => onChange({ ...block, props: { ...p, rightColumnFr: v } })} />
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Min height: {p.minHeight ?? 90}vh</Label>
                <Slider value={[p.minHeight ?? 90]} min={50} max={100} step={1} onValueChange={([v]) => onChange({ ...block, props: { ...p, minHeight: v } })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Background color {((p.variant ?? "split") !== "split") && <span className="text-muted-foreground">(used for gradient overlay)</span>}</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.backgroundColor ?? "#003a30" }}>
                    <input type="color" value={p.backgroundColor ?? "#003a30"} onChange={e => onChange({ ...block, props: { ...p, backgroundColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.backgroundColor ?? "#003a30"} onChange={e => onChange({ ...block, props: { ...p, backgroundColor: e.target.value } })} className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Accent color (eyebrow)</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.accentColor ?? "#c7e738" }}>
                    <input type="color" value={p.accentColor ?? "#c7e738"} onChange={e => onChange({ ...block, props: { ...p, accentColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.accentColor ?? "#c7e738"} onChange={e => onChange({ ...block, props: { ...p, accentColor: e.target.value } })} className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Text color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.textColor ?? "#ffffff" }}>
                    <input type="color" value={p.textColor ?? "#ffffff"} onChange={e => onChange({ ...block, props: { ...p, textColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.textColor ?? "#ffffff"} onChange={e => onChange({ ...block, props: { ...p, textColor: e.target.value } })} className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>

              {((p.variant ?? "split") === "card" || (p.variant ?? "split") === "gradient") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Image side background</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.imageBackgroundColor ?? "#ffffff" }}>
                      <input type="color" value={p.imageBackgroundColor ?? "#ffffff"} onChange={e => onChange({ ...block, props: { ...p, imageBackgroundColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                    </div>
                    <Input value={p.imageBackgroundColor ?? "#ffffff"} onChange={e => onChange({ ...block, props: { ...p, imageBackgroundColor: e.target.value } })} className="h-7 text-xs font-mono flex-1" />
                  </div>
                </div>
              )}

              {(p.variant ?? "split") === "card" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Card background</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.cardColor ?? "#e8e6df" }}>
                        <input type="color" value={p.cardColor ?? "#e8e6df"} onChange={e => onChange({ ...block, props: { ...p, cardColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <Input value={p.cardColor ?? "#e8e6df"} onChange={e => onChange({ ...block, props: { ...p, cardColor: e.target.value } })} className="h-7 text-xs font-mono flex-1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Card text color</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.cardTextColor ?? "#0a2b25" }}>
                        <input type="color" value={p.cardTextColor ?? "#0a2b25"} onChange={e => onChange({ ...block, props: { ...p, cardTextColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <Input value={p.cardTextColor ?? "#0a2b25"} onChange={e => onChange({ ...block, props: { ...p, cardTextColor: e.target.value } })} className="h-7 text-xs font-mono flex-1" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button Colors</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Button background</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.buttonColor ?? p.accentColor ?? "#c7e738" }}>
                    <input type="color" value={p.buttonColor ?? p.accentColor ?? "#c7e738"} onChange={e => onChange({ ...block, props: { ...p, buttonColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.buttonColor ?? ""} onChange={e => onChange({ ...block, props: { ...p, buttonColor: e.target.value } })} placeholder={p.accentColor ?? "#c7e738"} className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Button hover background</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.buttonHoverColor ?? p.buttonColor ?? p.accentColor ?? "#b3d028" }}>
                    <input type="color" value={p.buttonHoverColor ?? p.buttonColor ?? p.accentColor ?? "#b3d028"} onChange={e => onChange({ ...block, props: { ...p, buttonHoverColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.buttonHoverColor ?? ""} onChange={e => onChange({ ...block, props: { ...p, buttonHoverColor: e.target.value } })} placeholder="#b3d028" className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Button text color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0" style={{ backgroundColor: p.buttonTextColor ?? p.backgroundColor ?? "#003a30" }}>
                    <input type="color" value={p.buttonTextColor ?? p.backgroundColor ?? "#003a30"} onChange={e => onChange({ ...block, props: { ...p, buttonTextColor: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={p.buttonTextColor ?? ""} onChange={e => onChange({ ...block, props: { ...p, buttonTextColor: e.target.value } })} placeholder={p.backgroundColor ?? "#003a30"} className="h-7 text-xs font-mono flex-1" />
                </div>
              </div>
            </div>
          </div>
        );
      }
      case "dso-problem": {
        const p = block.props;
        const panels = p.panels ?? [];
        const PANEL_ICONS = [
          { value: "alert-triangle", label: "Alert Triangle" },
          { value: "bar-chart",      label: "Bar Chart" },
          { value: "users",          label: "Users" },
          { value: "trending-down",  label: "Trending Down" },
          { value: "clock",          label: "Clock" },
          { value: "shield",         label: "Shield" },
          { value: "microscope",     label: "Microscope" },
          { value: "layers",         label: "Layers" },
          { value: "zap",            label: "Zap" },
          { value: "target",         label: "Target" },
          { value: "dollar",         label: "Dollar" },
          { value: "network",        label: "Network" },
          { value: "activity",       label: "Activity" },
          { value: "scale",          label: "Scale" },
        ];
        const updatePanel = (i: number, patch: Partial<typeof panels[0]>) => {
          const next = panels.map((c, idx) => idx === i ? { ...c, ...patch } : c);
          onChange({ ...block, props: { ...p, panels: next } });
        };
        const addPanel = () => {
          if (panels.length >= 4) return;
          onChange({ ...block, props: { ...p, panels: [...panels, { icon: "alert-triangle" as const, title: "", desc: "" }] } });
        };
        const removePanel = (i: number) => onChange({ ...block, props: { ...p, panels: panels.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "body"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body (optional)</Label>
              <AiTextField type="textarea" rows={3} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Photos</Label>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-400">Primary image</Label>
                <ImagePicker
                  value={(p.imageUrls ?? [])[0] ?? ""}
                  onChange={v => {
                    const urls = [...(p.imageUrls ?? [])];
                    urls[0] = v;
                    onChange({ ...block, props: { ...p, imageUrls: urls } });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-400">Secondary image</Label>
                <ImagePicker
                  value={(p.imageUrls ?? [])[1] ?? ""}
                  onChange={v => {
                    const urls = [...(p.imageUrls ?? [])];
                    urls[1] = v;
                    onChange({ ...block, props: { ...p, imageUrls: urls } });
                  }}
                />
              </div>
              <div className="space-y-1.5 pt-2">
                <Label className="text-[11px] text-slate-400">Stat value (overlay)</Label>
                <Input value={p.statValue ?? "96%"} onChange={e => onChange({ ...block, props: { ...p, statValue: e.target.value } })} placeholder="96%" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-400">Stat label (overlay)</Label>
                <Input value={p.statLabel ?? "First-time right rate"} onChange={e => onChange({ ...block, props: { ...p, statLabel: e.target.value } })} placeholder="First-time right rate" className="h-8 text-xs" />
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Panels (max 4)</Label>
                {panels.length < 4 && (
                  <Button variant="ghost" size="sm" onClick={addPanel} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {panels.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Panel {i + 1}</span>
                      <button onClick={() => removePanel(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Icon</Label>
                      <Select value={c.icon} onValueChange={v => updatePanel(i, { icon: v as typeof c.icon })}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PANEL_ICONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Title</Label>
                      <Input value={c.title} onChange={e => updatePanel(i, { title: e.target.value })} placeholder="Fragmented Networks" className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Description</Label>
                      <Textarea value={c.desc} onChange={e => updatePanel(i, { desc: e.target.value })} rows={2} placeholder="No centralized visibility…" className="text-xs mt-1 resize-none" />
                    </div>
                  </div>
                ))}
                {panels.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No panels yet. Click Add to get started.</p>
                )}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Button</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5"><p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p><p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p><Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button></div>}
            </div>
          </div>
        );
      }
      case "dso-ai-feature": {
        const p = block.props;
        const bullets = p.bullets ?? [];
        const stats   = p.stats   ?? [];
        const updateBullet = (i: number, val: string) => {
          const next = bullets.map((b, idx) => idx === i ? val : b);
          onChange({ ...block, props: { ...p, bullets: next } });
        };
        const addBullet = () => onChange({ ...block, props: { ...p, bullets: [...bullets, ""] } });
        const removeBullet = (i: number) => onChange({ ...block, props: { ...p, bullets: bullets.filter((_, idx) => idx !== i) } });
        const updateStat = (i: number, patch: Partial<{ value: string; label: string }>) => {
          const next = stats.map((s, idx) => idx === i ? { ...s, ...patch } : s);
          onChange({ ...block, props: { ...p, stats: next } });
        };
        const addStat = () => onChange({ ...block, props: { ...p, stats: [...stats, { value: "", label: "" }] } });
        const removeStat = (i: number) => onChange({ ...block, props: { ...p, stats: stats.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "body"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: (p.body ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image (fallback when no video)</Label>
              <ImagePicker value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v } })} />
            </div>
            <div className="space-y-1.5">
              <VideoPicker label="Video" value={p.videoUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, videoUrl: v || undefined } })} />
              <p className="text-[10px] text-muted-foreground">Loops as motion graphic. Leave empty to show animated UI instead.</p>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bullet Points</Label>
                <Button variant="ghost" size="sm" onClick={addBullet} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={b} onChange={e => updateBullet(i, e.target.value)} placeholder="AI reviews every scan…" className="h-8 text-xs flex-1" />
                    <button onClick={() => removeBullet(i)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {bullets.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No bullets yet.</p>
                )}
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats Row</Label>
                <Button variant="ghost" size="sm" onClick={addStat} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-1.5 mb-2">
                <Label className="text-xs">Layout</Label>
                <div className="flex gap-2">
                  {([
                    { v: "row", label: "Side by side" },
                    { v: "stack", label: "Stacked" },
                  ] as const).map(opt => (
                    <button key={opt.v} onClick={() => onChange({ ...block, props: { ...p, statsLayout: opt.v } })} className={`flex-1 py-1.5 text-xs rounded border ${(p.statsLayout ?? "row") === opt.v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {stats.map((s, i) => (
                  <div key={i} className="border rounded-lg p-2.5 space-y-1.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Stat {i + 1}</span>
                      <button onClick={() => removeStat(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[11px] text-slate-400">Value</Label>
                        <Input value={s.value} onChange={e => updateStat(i, { value: e.target.value })} placeholder="96%" className="h-7 text-xs mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-400">Label</Label>
                        <Input value={s.label} onChange={e => updateStat(i, { label: e.target.value })} placeholder="First-Time Right" className="h-7 text-xs mt-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
                {stats.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No stats yet.</p>
                )}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Button</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5"><p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p><p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p><Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button></div>}
            </div>
          </div>
        );
      }
      case "dso-stat-showcase": {
        const p = block.props;
        const stats = p.stats ?? [];
        const updateStat = (i: number, patch: Partial<{ value: string; label: string; description: string }>) => {
          const next = stats.map((s, idx) => idx === i ? { ...s, ...patch } : s);
          onChange({ ...block, props: { ...p, stats: next } });
        };
        const addStat = () => onChange({ ...block, props: { ...p, stats: [...stats, { value: "", label: "", description: "" }] } });
        const removeStat = (i: number) => onChange({ ...block, props: { ...p, stats: stats.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats (up to 6)</Label>
                <Button variant="ghost" size="sm" onClick={addStat} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {stats.map((s, i) => (
                  <div key={i} className="border rounded-lg p-2.5 space-y-1.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Stat {i + 1}</span>
                      <button onClick={() => removeStat(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[11px] text-slate-400">Value</Label>
                        <Input value={s.value} onChange={e => updateStat(i, { value: e.target.value })} placeholder="96%" className="h-7 text-xs mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-400">Label</Label>
                        <Input value={s.label} onChange={e => updateStat(i, { label: e.target.value })} placeholder="First-time right rate" className="h-7 text-xs mt-0.5" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Description</Label>
                      <Input value={s.description ?? ""} onChange={e => updateStat(i, { description: e.target.value })} placeholder="Short supporting text…" className="h-7 text-xs mt-0.5" />
                    </div>
                  </div>
                ))}
                {stats.length === 0 && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Showing built-in defaults. Load them to start editing.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => onChange({ ...block, props: { ...p, stats: [
                        { value: "96%",      label: "First-time right rate",  description: "Industry-leading precision at enterprise scale" },
                        { value: "12,000+",  label: "Dental practices",       description: "Trust Dandy for their lab work" },
                        { value: "4.2 days", label: "Average turnaround",     description: "Including AI review and quality control" },
                        { value: "$0",       label: "CAPEX to start",         description: "All hardware included at no upfront cost" },
                        { value: "30%",      label: "Case acceptance lift",   description: "On average across DSO partner networks" },
                        { value: "100%",     label: "AI quality screened",    description: "Every scan reviewed before it leaves the chair" },
                      ] } })}
                    >
                      <Plus className="w-3 h-3" /> Load defaults to edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Button</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5"><p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p><p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p><Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button></div>}
            </div>
          </div>
        );
      }
      case "dso-scroll-story": {
        const p = block.props;
        const chapters = p.chapters ?? [];
        const updateChapter = (i: number, patch: Partial<{ headline: string; body: string; imageUrl: string }>) => {
          const next = chapters.map((c, idx) => idx === i ? { ...c, ...patch } : c);
          onChange({ ...block, props: { ...p, chapters: next } });
        };
        const addChapter = () => onChange({ ...block, props: { ...p, chapters: [...chapters, { headline: "", body: "", imageUrl: "" }] } });
        const removeChapter = (i: number) => onChange({ ...block, props: { ...p, chapters: chapters.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow"]} values={{ eyebrow: p.eyebrow ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", {})} />
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chapters (2–4)</Label>
                <Button variant="ghost" size="sm" onClick={addChapter} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {chapters.map((c, i) => (
                  <div key={i} className="border rounded-lg p-2.5 space-y-1.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Chapter {i + 1}</span>
                      <button onClick={() => removeChapter(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Headline</Label>
                      <Input value={c.headline} onChange={e => updateChapter(i, { headline: e.target.value })} placeholder="One lab for every location." className="h-7 text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Body</Label>
                      <Textarea rows={2} value={c.body} onChange={e => updateChapter(i, { body: e.target.value })} placeholder="Supporting paragraph…" className="resize-none text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Image</Label>
                      <ImagePicker value={c.imageUrl} onChange={v => updateChapter(i, { imageUrl: v })} />
                    </div>
                  </div>
                ))}
                {chapters.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No chapters yet — uses defaults.</p>
                )}
              </div>
            </div>
          </div>
        );
      }
      case "dso-particle-mesh": {
        const p = block.props;
        const urlsStr = (p.imageUrl ? [p.imageUrl] : []).join("\n");
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "body"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: (p.body ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="border-t pt-3 space-y-1.5">
              <Label className="text-xs">Image</Label>
              <p className="text-xs text-muted-foreground">Full-bleed image on one half. Leave blank to hide.</p>
              <ImagePicker value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image Side</Label>
              <div className="flex gap-2">
                {(["left", "right"] as const).map(side => (
                  <button
                    key={side}
                    onClick={() => onChange({ ...block, props: { ...p, imagePosition: side } })}
                    className={`flex-1 py-1.5 text-xs rounded border capitalize ${
                      (p.imagePosition ?? "right") === side
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Stat 1</Label>
              <div className="flex gap-2">
                <Input className="w-24" value={p.stat1Value ?? ""} onChange={e => onChange({ ...block, props: { ...p, stat1Value: e.target.value } })} placeholder="500+" />
                <Input value={p.stat1Label ?? ""} onChange={e => onChange({ ...block, props: { ...p, stat1Label: e.target.value } })} placeholder="Locations" />
              </div>
              <Label className="text-xs text-muted-foreground">Stat 2</Label>
              <div className="flex gap-2">
                <Input className="w-24" value={p.stat2Value ?? ""} onChange={e => onChange({ ...block, props: { ...p, stat2Value: e.target.value } })} placeholder="96%" />
                <Input value={p.stat2Label ?? ""} onChange={e => onChange({ ...block, props: { ...p, stat2Label: e.target.value } })} placeholder="First-Time Right" />
              </div>
              <Label className="text-xs text-muted-foreground">Stat 3</Label>
              <div className="flex gap-2">
                <Input className="w-24" value={p.stat3Value ?? ""} onChange={e => onChange({ ...block, props: { ...p, stat3Value: e.target.value } })} placeholder="< 4d" />
                <Input value={p.stat3Label ?? ""} onChange={e => onChange({ ...block, props: { ...p, stat3Label: e.target.value } })} placeholder="Avg Turnaround" />
              </div>
            </div>
          </div>
        );
      }
      case "dso-flow-canvas": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Left Image</Label>
              <p className="text-xs text-muted-foreground">Full-bleed image on the left half. Leave blank for centered layout.</p>
              <ImagePicker value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v } })} />
            </div>
            <DsoRefreshRow fields={["eyebrow", "stat", "statLabel", "quote", "attribution"]} values={{ eyebrow: p.eyebrow ?? "", stat: p.stat ?? "", statLabel: p.statLabel ?? "", quote: p.quote ?? "", attribution: p.attribution ?? "" }} />
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", {})} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Large Stat</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, stat: (p.stat ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.stat ?? ""} onChange={v => onChange({ ...block, props: { ...p, stat: v } })} fieldLabel="Stat" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "stat", p.stat ?? "", { statLabel: p.statLabel ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Stat Label</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, statLabel: (p.statLabel ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.statLabel ?? ""} onChange={v => onChange({ ...block, props: { ...p, statLabel: v } })} fieldLabel="Stat Label" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "statLabel", p.statLabel ?? "", { stat: p.stat ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Quote</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, quote: (p.quote ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.quote ?? ""} onChange={v => onChange({ ...block, props: { ...p, quote: v } })} fieldLabel="Quote" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "quote", p.quote ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Attribution</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, attribution: (p.attribution ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.attribution ?? ""} onChange={v => onChange({ ...block, props: { ...p, attribution: v } })} fieldLabel="Attribution" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "attribution", p.attribution ?? "", {})} />
            </div>
          </div>
        );
      }
      case "dso-case-flow": {
        const p = block.props;
        // Seed from the block's own stages, or the renderer's built-in defaults
        // when none are set, so editing always starts from the visible content.
        const stages: DsoCaseFlowStage[] = (p.stages && p.stages.length > 0) ? p.stages : DSO_CASE_FLOW_DEFAULT_STAGES;
        const writeStages = (next: DsoCaseFlowStage[]) => onChange({ ...block, props: { ...p, stages: next } });
        const updateStage = (i: number, field: "label" | "metric" | "metricLabel" | "body", val: string) =>
          writeStages(stages.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
        const updateStageIcon = (i: number, val: string) =>
          writeStages(stages.map((s, idx) => idx === i ? { ...s, iconName: val || undefined } : s));
        const addStage = () => writeStages([...stages, { label: "", metric: "", metricLabel: "", body: "" }]);
        const removeStage = (i: number) => writeStages(stages.filter((_, idx) => idx !== i));
        const reorderStage = (from: number, to: number) => {
          const next = stages.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          writeStages(next);
        };
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Stage cards (up to 4 shown)</Label>
                {stages.length < 4 && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={addStage}>
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                )}
              </div>
              <StageReorderList stages={stages} onReorder={reorderStage} onUpdate={updateStage} onUpdateIcon={updateStageIcon} onRemove={removeStage} />
              <p className="text-[11px] text-muted-foreground">Drag to reorder. The block displays the first 4 stages.</p>
            </div>
          </div>
        );
      }
      case "dso-live-feed": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "body", "footerNote"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "", footerNote: p.footerNote ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: (p.body ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Footer Note</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, footerNote: (p.footerNote ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.footerNote ?? ""} onChange={v => onChange({ ...block, props: { ...p, footerNote: v } })} fieldLabel="Footer Note" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "footerNote", p.footerNote ?? "", {})} />
            </div>
          </div>
        );
      }
      case "dso-network-map": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "body"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: (p.body ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Text</Label>
              <Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value } })} placeholder="See the Live Network" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA URL</Label>
              <Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value } })} placeholder="https://…" />
            </div>
          </div>
        );
      }
      case "dso-scroll-story-hero": {
        const p = block.props;
        const chapters = p.chapters ?? [];
        const updateChapter = (i: number, patch: Partial<{ headline: string; body: string; imageUrl: string }>) => {
          const next = chapters.map((c, idx) => idx === i ? { ...c, ...patch } : c);
          onChange({ ...block, props: { ...p, chapters: next } });
        };
        const addChapter = () => onChange({ ...block, props: { ...p, chapters: [...chapters, { headline: "", body: "", imageUrl: "" }] } });
        const removeChapter = (i: number) => onChange({ ...block, props: { ...p, chapters: chapters.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image Side</Label>
              <div className="flex gap-2">
                {(["left", "right"] as const).map(side => (
                  <button key={side} onClick={() => onChange({ ...block, props: { ...p, imagePosition: side } })} className={`flex-1 py-1.5 text-xs rounded border capitalize ${(p.imagePosition ?? "right") === side ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    Image {side}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <VideoPicker label="Background Video (optional)" value={p.backgroundVideoUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, backgroundVideoUrl: v || undefined } })} />
              <p className="text-[11px] text-muted-foreground">Plays behind the full section. Use a direct MP4/WebM link.</p>
            </div>
            <DsoRefreshRow fields={["eyebrow"]} values={{ eyebrow: p.eyebrow ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", {})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Text</Label>
              <Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value } })} placeholder="Request a Custom Demo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Action</Label>
              <Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link" className="text-xs">Open URL</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(p.ctaMode ?? "link") === "link" && (
              <div className="space-y-1.5">
                <Label className="text-xs">CTA URL</Label>
                <Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value } })} placeholder="https://…" />
              </div>
            )}
            {p.ctaMode === "chilipiper" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Chili Piper URL</Label>
                <Input value={p.chilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value } })} className="font-mono h-8 text-xs" placeholder="https://yourcompany.chilipiper.com/..." />
              </div>
            )}
            {(p.ctaMode === "modal-form" || p.ctaMode === "modal-chilipiper") && (
              <CtaButtonModalConfigSection
                ctaAction={p.ctaMode}
                value={p}
                onChange={(next) => onChange({ ...block, props: { ...p, ...next } })}
              />
            )}
            {onApplyCtaToAll && (
              <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>
                  Apply CTA to All Sections
                </Button>
              </div>
            )}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chapters (2–4)</Label>
                <Button variant="ghost" size="sm" onClick={addChapter} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {chapters.map((c, i) => (
                  <div key={i} className="border rounded-lg p-2.5 space-y-1.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Chapter {i + 1}</span>
                      <button onClick={() => removeChapter(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Headline</Label>
                      <Input value={c.headline} onChange={e => updateChapter(i, { headline: e.target.value })} placeholder="One lab for every location." className="h-7 text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Body</Label>
                      <Textarea rows={2} value={c.body} onChange={e => updateChapter(i, { body: e.target.value })} placeholder="Supporting paragraph…" className="resize-none text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Image</Label>
                      <ImagePicker value={c.imageUrl} onChange={v => updateChapter(i, { imageUrl: v })} />
                    </div>
                  </div>
                ))}
                {chapters.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No chapters yet — uses defaults.</p>
                )}
              </div>
            </div>
          </div>
        );
      }
      case "dso-bento-outcomes": {
        const p = block.props;
        const tiles = p.tiles ?? [];
        const updateTile = (i: number, patch: Partial<Record<string, unknown>>) => {
          const next = tiles.map((t, idx) => idx === i ? { ...t, ...patch } : t);
          onChange({ ...block, props: { ...p, tiles: next as typeof tiles } });
        };
        const removeTile = (i: number) => onChange({ ...block, props: { ...p, tiles: tiles.filter((_, idx) => idx !== i) } });
        const addTile = (type: string) => {
          const base = type === "stat"
            ? { type: "stat", value: "", label: "", description: "" }
            : type === "photo"
            ? { type: "photo", imageUrl: "", caption: "" }
            : type === "feature"
            ? { type: "feature", headline: "", body: "" }
            : { type: "quote", quote: "", author: "" };
          onChange({ ...block, props: { ...p, tiles: [...tiles, base as typeof tiles[number]] } });
        };
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DsoRefreshRow fields={["eyebrow", "headline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tiles</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-1.5 gap-1 text-emerald-700 hover:text-emerald-800"
                  disabled={bentoTilesRefreshing}
                  onClick={() => handleBentoTilesRefresh(tiles as DsoBentoTile[])}
                >
                  {bentoTilesRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                  AI tiles
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(["stat","photo","feature","quote"] as const).map(t => (
                  <Button key={t} variant="ghost" size="sm" onClick={() => addTile(t)} className="h-6 text-[10px] px-1.5 capitalize">
                    +{t}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                {tiles.map((tile, i) => (
                  <div key={i} className="border rounded-lg p-2.5 space-y-1.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 capitalize">{tile.type} tile {i + 1}</span>
                      <button onClick={() => removeTile(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {tile.type === "stat" && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <Label className="text-[11px] text-slate-400">Value</Label>
                            <Input value={tile.value} onChange={e => updateTile(i, { value: e.target.value })} placeholder="96%" className="h-7 text-xs mt-0.5" />
                          </div>
                          <div>
                            <Label className="text-[11px] text-slate-400">Label</Label>
                            <Input value={tile.label} onChange={e => updateTile(i, { label: e.target.value })} placeholder="FTR Rate" className="h-7 text-xs mt-0.5" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-400">Description</Label>
                          <Input value={tile.description ?? ""} onChange={e => updateTile(i, { description: e.target.value })} placeholder="Short description" className="h-7 text-xs mt-0.5" />
                        </div>
                      </>
                    )}
                    {tile.type === "photo" && (
                      <>
                        <div>
                          <Label className="text-[11px] text-slate-400">Image</Label>
                          <ImagePicker value={tile.imageUrl} onChange={v => updateTile(i, { imageUrl: v })} />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-400">Caption</Label>
                          <Input value={tile.caption} onChange={e => updateTile(i, { caption: e.target.value })} placeholder="U.S. manufacturing" className="h-7 text-xs mt-0.5" />
                        </div>
                      </>
                    )}
                    {tile.type === "feature" && (
                      <>
                        <div>
                          <Label className="text-[11px] text-slate-400">Headline</Label>
                          <Input value={tile.headline} onChange={e => updateTile(i, { headline: e.target.value })} placeholder="Feature headline" className="h-7 text-xs mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-400">Body</Label>
                          <Textarea rows={2} value={tile.body} onChange={e => updateTile(i, { body: e.target.value })} placeholder="Supporting copy…" className="resize-none text-xs mt-0.5" />
                        </div>
                      </>
                    )}
                    {tile.type === "quote" && (
                      <>
                        <div>
                          <Label className="text-[11px] text-slate-400">Quote</Label>
                          <Textarea rows={2} value={tile.quote} onChange={e => updateTile(i, { quote: e.target.value })} placeholder="The results were immediate…" className="resize-none text-xs mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-400">Author</Label>
                          <Input value={tile.author} onChange={e => updateTile(i, { author: e.target.value })} placeholder="VP of Ops, Smile Brands" className="h-7 text-xs mt-0.5" />
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {tiles.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No tiles yet — uses defaults.</p>
                )}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-cta-capture": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={String((p as Record<string, unknown>).backgroundStyle ?? "dandy-green")} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } } as PageBlock)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image</Label>
              <p className="text-xs text-muted-foreground">Full-bleed image on one half. Leave blank for text-only.</p>
              <ImagePicker value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v } })} />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="space-y-0.5 pr-3">
                <Label className="text-xs font-medium">Hide capture form</Label>
                <p className="text-xs text-muted-foreground leading-snug">Removes the email pill, CTA button, and success state. Headline, body, and trust strip remain.</p>
              </div>
              <Switch
                checked={p.hideCaptureForm ?? false}
                onCheckedChange={v => onChange({ ...block, props: { ...p, hideCaptureForm: v } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image Side</Label>
              <div className="flex gap-2">
                {(["left", "right"] as const).map(side => (
                  <button key={side} onClick={() => onChange({ ...block, props: { ...p, imagePosition: side } })} className={`flex-1 py-1.5 text-xs rounded border capitalize ${(p.imagePosition ?? "right") === side ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    {side}
                  </button>
                ))}
              </div>
            </div>
            <DsoRefreshRow fields={["eyebrow", "headline", "body", "inputLabel", "ctaLabel", "trust1", "trust2", "trust3"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "", inputLabel: p.inputLabel ?? "", ctaLabel: p.ctaLabel ?? "", trust1: p.trust1 ?? "", trust2: p.trust2 ?? "", trust3: p.trust3 ?? "" }} />
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: (p.body ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="border-t pt-3 space-y-1.5">
              <Label className="text-xs">Input Label</Label>
              <Input value={p.inputLabel ?? ""} onChange={e => onChange({ ...block, props: { ...p, inputLabel: e.target.value } })} placeholder="Work email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Input Placeholder</Label>
              <Input value={p.inputPlaceholder ?? ""} onChange={e => onChange({ ...block, props: { ...p, inputPlaceholder: e.target.value } })} placeholder="yourname@dsogroup.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Label</Label>
              <Input value={p.ctaLabel ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaLabel: e.target.value } })} placeholder="Request a Demo" />
            </div>
            <div className="border-t pt-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Trust Line 1</Label>
              <Input value={p.trust1 ?? ""} onChange={e => onChange({ ...block, props: { ...p, trust1: e.target.value } })} placeholder="1,200+ DSO locations" />
              <Label className="text-xs text-muted-foreground">Trust Line 2</Label>
              <Input value={p.trust2 ?? ""} onChange={e => onChange({ ...block, props: { ...p, trust2: e.target.value } })} placeholder="No long-term contract" />
              <Label className="text-xs text-muted-foreground">Trust Line 3</Label>
              <Input value={p.trust3 ?? ""} onChange={e => onChange({ ...block, props: { ...p, trust3: e.target.value } })} placeholder="Live in 30 days" />
            </div>
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chili Piper</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Chili Piper URL</Label>
                <Input value={p.chilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value } })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs" />
                <p className="text-xs text-muted-foreground">Email will be auto-prefilled when the form is submitted.</p>
              </div>
            </div>
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Success State</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Success Headline</Label>
                <Input value={p.successHeadline ?? ""} onChange={e => onChange({ ...block, props: { ...p, successHeadline: e.target.value } })} placeholder="You're on the list!" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Success Body</Label>
                <Input value={p.successBody ?? ""} onChange={e => onChange({ ...block, props: { ...p, successBody: e.target.value } })} placeholder="Check your inbox..." className="h-8 text-xs" />
              </div>
            </div>
          </div>
        );
      }
      case "dso-meet-team":
        return <DsoMeetTeamPanel block={block as PageBlock & { type: "dso-meet-team" }} onChange={onChange} brandVoiceSet={brandVoiceSet} bgOptions={bgOptions} />;
      case "dso-paradigm-shift": {
        const p = block.props;
        const updateItem = (side: "oldWayItems" | "newWayItems", idx: number, val: string) => {
          const arr = [...(p[side] ?? [])];
          arr[idx] = val;
          onChange({ ...block, props: { ...p, [side]: arr } });
        };
        const addItem = (side: "oldWayItems" | "newWayItems") => onChange({ ...block, props: { ...p, [side]: [...(p[side] ?? []), ""] } });
        const removeItem = (side: "oldWayItems" | "newWayItems", idx: number) => onChange({ ...block, props: { ...p, [side]: (p[side] ?? []).filter((_, i) => i !== idx) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Old Way Label</Label><Input value={p.oldWayLabel ?? ""} onChange={e => onChange({ ...block, props: { ...p, oldWayLabel: e.target.value } })} className="h-8 text-xs" placeholder="The Old Way" /></div>
              <div className="space-y-1.5"><Label className="text-xs">New Way Label</Label><Input value={p.newWayLabel ?? ""} onChange={e => onChange({ ...block, props: { ...p, newWayLabel: e.target.value } })} className="h-8 text-xs" placeholder="The Acme Way" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</Label>
              <p className="text-[10px] text-muted-foreground leading-snug">Leave a color empty to use the auto, contrast-correct brand default.</p>
              <ColorField label="Headline text color" value={p.headlineColor} onChange={v => onChange({ ...block, props: { ...p, headlineColor: v } })} />
              <ColorField label="Old Way card background" value={p.oldWayCardBg} onChange={v => onChange({ ...block, props: { ...p, oldWayCardBg: v } })} />
              <ColorField label="New Way card background" value={p.newWayCardBg} onChange={v => onChange({ ...block, props: { ...p, newWayCardBg: v } })} />
              <ColorField label="Card text color" value={p.cardTextColor} onChange={v => onChange({ ...block, props: { ...p, cardTextColor: v } })} />
            </div>
            {(["oldWayItems", "newWayItems"] as const).map(side => (
              <div key={side} className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{side === "oldWayItems" ? "Old Way Items" : "New Way Items"}</Label>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={async () => {
                      try {
                        const current = (p[side] ?? []).join(" | ");
                        const suggestions = await suggestCopy(block.type, side, current, { headline: p.headline ?? "", [side === "oldWayItems" ? "newWayItems" : "oldWayItems"]: (p[side === "oldWayItems" ? "newWayItems" : "oldWayItems"] ?? []).join(" | ") }, 5);
                        if (suggestions.length > 0) onChange({ ...block, props: { ...p, [side]: suggestions } });
                      } catch {}
                    }} className="h-7 text-xs gap-1 text-purple-600 hover:text-purple-700"><RefreshCcw className="w-3 h-3" /> AI</Button>
                    <Button variant="ghost" size="sm" onClick={() => addItem(side)} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(p[side] ?? []).map((item, i) => (
                    <div key={i} className="flex gap-1 items-center">
                      <Input value={item} onChange={e => updateItem(side, i, e.target.value)} className="h-8 text-xs flex-1" />
                      <button onClick={() => removeItem(side, i)} className="text-slate-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-partnership-perks": {
        const p = block.props;
        const perks = p.perks ?? [];
        const updatePerk = (i: number, patch: Partial<typeof perks[0]>) => {
          const next = perks.map((pk, idx) => idx === i ? { ...pk, ...patch } : pk);
          onChange({ ...block, props: { ...p, perks: next } });
        };
        const addPerk = () => onChange({ ...block, props: { ...p, perks: [...perks, { icon: "star", title: "", desc: "" }] } });
        const removePerk = (i: number) => onChange({ ...block, props: { ...p, perks: perks.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perks</Label><Button variant="ghost" size="sm" onClick={addPerk} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {perks.map((perk, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Perk {i + 1}</span><button onClick={() => removePerk(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <IconPicker value={perk.icon ?? "Star"} onChange={v => updatePerk(i, { icon: v })} aiHint={`${perk.title || "Perk"} icon`} />
                    <Input value={perk.title} onChange={e => updatePerk(i, { title: e.target.value })} placeholder="Perk title" className="h-8 text-xs" />
                    <Textarea value={perk.desc} onChange={e => updatePerk(i, { desc: e.target.value })} placeholder="Description" rows={2} className="text-xs resize-none" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "secondary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-products-grid": {
        const p = block.props;
        const products = p.products ?? [];
        const updateProduct = (i: number, patch: Partial<typeof products[0]>) => {
          const next = products.map((pr, idx) => idx === i ? { ...pr, ...patch } : pr);
          onChange({ ...block, props: { ...p, products: next } });
        };
        const addProduct = () => onChange({ ...block, props: { ...p, products: [...products, { name: "", detail: "", price: "" }] } });
        const removeProduct = (i: number) => onChange({ ...block, props: { ...p, products: products.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "muted"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Products</Label><Button variant="ghost" size="sm" onClick={addProduct} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {products.map((prod, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Product {i + 1}</span><button onClick={() => removeProduct(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Input value={prod.name} onChange={e => updateProduct(i, { name: e.target.value })} placeholder="Product name" className="h-8 text-xs" />
                    <Input value={prod.detail} onChange={e => updateProduct(i, { detail: e.target.value })} placeholder="Short detail" className="h-8 text-xs" />
                    <Input value={prod.price} onChange={e => updateProduct(i, { price: e.target.value })} placeholder="From $109" className="h-8 text-xs" />
                    <Input value={prod.icon ?? ""} onChange={e => updateProduct(i, { icon: e.target.value || undefined })} placeholder="Icon key (crown, smile, moon…)" className="h-8 text-xs" />
                    <Input value={prod.imageKey ?? ""} onChange={e => updateProduct(i, { imageKey: e.target.value || undefined })} placeholder="Image key (posterior-crowns, dentures…)" className="h-8 text-xs" />
                    <ImagePicker label="Image (overrides key)" value={prod.imageUrl ?? ""} onChange={v => updateProduct(i, { imageUrl: v || undefined })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Button</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5"><p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p><p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p><Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button></div>}
            </div>
          </div>
        );
      }
      case "dso-promo-cards": {
        const p = block.props;
        const cards = p.cards ?? [];
        const updateCard = (i: number, patch: Partial<typeof cards[0]>) => {
          const next = cards.map((c, idx) => idx === i ? { ...c, ...patch } : c);
          onChange({ ...block, props: { ...p, cards: next } });
        };
        const addCard = () => onChange({ ...block, props: { ...p, cards: [...cards, { title: "", desc: "", badge: "", ctaText: "", ctaUrl: "" }] } });
        const removeCard = (i: number) => onChange({ ...block, props: { ...p, cards: cards.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Promo Cards</Label><Button variant="ghost" size="sm" onClick={addCard} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {cards.map((card, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Card {i + 1}</span><button onClick={() => removeCard(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Input value={card.title} onChange={e => updateCard(i, { title: e.target.value })} placeholder="$1,500 Lab Credit" className="h-8 text-xs" />
                    <Textarea value={card.desc} onChange={e => updateCard(i, { desc: e.target.value })} placeholder="Description" rows={2} className="text-xs resize-none" />
                    <Input value={card.badge ?? ""} onChange={e => updateCard(i, { badge: e.target.value || undefined })} placeholder="Badge (CREDIT, FREE, NEW)" className="h-8 text-xs" />
                    <Input value={card.ctaText ?? ""} onChange={e => updateCard(i, { ctaText: e.target.value || undefined })} placeholder="CTA text" className="h-8 text-xs" />
                    <Input value={card.ctaUrl ?? ""} onChange={e => updateCard(i, { ctaUrl: e.target.value || undefined })} placeholder="CTA URL" className="h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Section CTA</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={String((p as unknown as Record<string, unknown>).ctaText ?? "")} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } } as PageBlock)} placeholder="See All Products" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={String((p as unknown as Record<string, unknown>).ctaUrl ?? "")} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } } as PageBlock)} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={String((p as unknown as Record<string, unknown>).ctaMode ?? "link")} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } } as PageBlock)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={String((p as unknown as Record<string, unknown>).ctaVariant ?? "link")} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } } as PageBlock)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-activation-steps": {
        const p = block.props;
        const steps = p.steps ?? [];
        const updateStep = (i: number, patch: Partial<typeof steps[0]>) => {
          const next = steps.map((s, idx) => idx === i ? { ...s, ...patch } : s);
          onChange({ ...block, props: { ...p, steps: next } });
        };
        const addStep = () => onChange({ ...block, props: { ...p, steps: [...steps, { step: String(steps.length + 1).padStart(2, "0"), title: "", desc: "" }] } });
        const removeStep = (i: number) => onChange({ ...block, props: { ...p, steps: steps.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline", "ctaText"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "", ctaText: p.ctaText ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Text</Label>
              <AiTextField type="input" value={p.ctaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, ctaText: v || undefined } })} placeholder="Book Your Activation Call" fieldLabel="CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "ctaText", p.ctaText ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">CTA Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link / Redirect</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem><SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem><SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem></SelectContent></Select></div>
            {(p.ctaMode ?? "link") === "link" && (
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
            )}
            {p.ctaMode === "chilipiper" && (
              <div className="space-y-1.5"><Label className="text-xs">Chili Piper URL</Label><Input value={p.chilipiperUrl ?? p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value || undefined } })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs font-mono" /></div>
            )}
            <div className="space-y-1.5"><Label className="text-xs">CTA Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
            {(p.ctaMode === "modal-form" || p.ctaMode === "modal-chilipiper") && (
              <CtaButtonModalConfigSection
                ctaAction={p.ctaMode}
                value={p}
                onChange={(next) => onChange({ ...block, props: { ...p, ...next } })}
              />
            )}
            {onApplyCtaToAll && (
              <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
              </div>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Steps</Label><Button variant="ghost" size="sm" onClick={addStep} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Step {i + 1}</span><button onClick={() => removeStep(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Input value={step.step} onChange={e => updateStep(i, { step: e.target.value })} placeholder="01" className="h-8 text-xs" />
                    <AiTextField type="input" value={step.title} onChange={v => updateStep(i, { title: v })} placeholder="Step title" fieldLabel="Step Title" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "stepTitle", step.title, { desc: step.desc, headline: p.headline ?? "" })} />
                    <AiTextField type="textarea" rows={2} value={step.desc} onChange={v => updateStep(i, { desc: v })} placeholder="What happens in this step…" fieldLabel="Step Description" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "stepDesc", step.desc, { title: step.title, headline: p.headline ?? "" })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case "dso-promises": {
        const p = block.props;
        const promises = p.promises ?? [];
        const updatePromise = (i: number, patch: Partial<typeof promises[0]>) => {
          const next = promises.map((pr, idx) => idx === i ? { ...pr, ...patch } : pr);
          onChange({ ...block, props: { ...p, promises: next } });
        };
        const addPromise = () => onChange({ ...block, props: { ...p, promises: [...promises, { icon: "shield-check", title: "", desc: "" }] } });
        const removePromise = (i: number) => onChange({ ...block, props: { ...p, promises: promises.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Promises</Label><Button variant="ghost" size="sm" onClick={addPromise} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {promises.map((promise, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Promise {i + 1}</span><button onClick={() => removePromise(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Input value={promise.icon} onChange={e => updatePromise(i, { icon: e.target.value })} placeholder="Icon (e.g. shield-check, clock)" className="h-8 text-xs" />
                    <Input value={promise.title} onChange={e => updatePromise(i, { title: e.target.value })} placeholder="Title" className="h-8 text-xs" />
                    <Textarea value={promise.desc} onChange={e => updatePromise(i, { desc: e.target.value })} placeholder="Description" rows={2} className="text-xs resize-none" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-testimonials": {
        const p = block.props;
        const testimonials = p.testimonials ?? [];
        const updateT = (i: number, patch: Partial<typeof testimonials[0]>) => {
          const next = testimonials.map((t, idx) => idx === i ? { ...t, ...patch } : t);
          onChange({ ...block, props: { ...p, testimonials: next } });
        };
        const addT = () => onChange({ ...block, props: { ...p, testimonials: [...testimonials, { quote: "", author: "", location: "" }] } });
        const removeT = (i: number) => onChange({ ...block, props: { ...p, testimonials: testimonials.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Testimonials</Label><Button variant="ghost" size="sm" onClick={addT} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {testimonials.map((t, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Testimonial {i + 1}</span><button onClick={() => removeT(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Textarea value={t.quote} onChange={e => updateT(i, { quote: e.target.value })} placeholder="Quote text" rows={3} className="text-xs resize-none" />
                    <Input value={t.author} onChange={e => updateT(i, { author: e.target.value })} placeholder="Author name" className="h-8 text-xs" />
                    <Input value={t.location ?? ""} onChange={e => updateT(i, { location: e.target.value || undefined })} placeholder="Title / Organization" className="h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Read More Stories" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-practice-nav":
        return (
          <div className="p-4">
            <DsoPracticeNavPanel
              props={block.props}
              onChange={(updated) => onChange({ ...block, props: updated })}
            />
          </div>
        );
      case "dso-practice-hero": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline", "primaryCtaText", "secondaryCtaText", "trustLine"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "", primaryCtaText: p.primaryCtaText ?? "", secondaryCtaText: p.secondaryCtaText ?? "", trustLine: p.trustLine ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow (co-brand)</Label>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} placeholder="Heartland Dental × Acme" fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "", subheadline: p.subheadline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Primary CTA Text</Label>
                <AiTextField type="input" value={p.primaryCtaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, primaryCtaText: v || undefined } })} placeholder="Start your first case" fieldLabel="Primary CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "primaryCtaText", p.primaryCtaText ?? "", { headline: p.headline ?? "" })} />
              </div>
              {(p.primaryCtaMode ?? "link") === "link" && (
                <div className="space-y-1.5"><Label className="text-xs">Primary CTA URL</Label><Input value={p.primaryCtaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              )}
              {p.primaryCtaMode === "chilipiper" && (
                <div className="space-y-1.5"><Label className="text-xs">Primary Chili Piper URL</Label><Input value={p.primaryChilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryChilipiperUrl: e.target.value || undefined } })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs font-mono" /></div>
              )}
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Primary CTA Action</Label><Select value={p.primaryCtaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, primaryCtaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Open URL</SelectItem><SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem><SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem><SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Secondary CTA Text</Label>
                <AiTextField type="input" value={p.secondaryCtaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, secondaryCtaText: v || undefined } })} placeholder="See how it works" fieldLabel="Secondary CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "secondaryCtaText", p.secondaryCtaText ?? "", { headline: p.headline ?? "" })} />
              </div>
              {(p.secondaryCtaMode ?? "link") === "link" && (
                <div className="space-y-1.5"><Label className="text-xs">Secondary CTA URL</Label><Input value={p.secondaryCtaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, secondaryCtaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              )}
              {p.secondaryCtaMode === "chilipiper" && (
                <div className="space-y-1.5"><Label className="text-xs">Secondary Chili Piper URL</Label><Input value={p.secondaryChilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, secondaryChilipiperUrl: e.target.value || undefined } })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs font-mono" /></div>
              )}
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Secondary CTA Action</Label><Select value={p.secondaryCtaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, secondaryCtaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Open URL</SelectItem><SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem><SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem><SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem></SelectContent></Select></div>
            </div>
            {(p.primaryCtaMode === "modal-form" || p.primaryCtaMode === "modal-chilipiper" ||
              p.secondaryCtaMode === "modal-form" || p.secondaryCtaMode === "modal-chilipiper") && (
              <CtaButtonModalConfigSection
                ctaAction={
                  (p.primaryCtaMode === "modal-form" || p.primaryCtaMode === "modal-chilipiper")
                    ? p.primaryCtaMode
                    : (p.secondaryCtaMode as "modal-form" | "modal-chilipiper")
                }
                value={p}
                onChange={(next) => onChange({ ...block, props: { ...p, ...next } })}
              />
            )}
            {onApplyCtaToAll && (
              <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">Apply Primary CTA to All Blocks</p>
                <p className="text-xs text-emerald-700 leading-snug">Copies the Primary CTA text, URL, and mode above to every other section on this page.</p>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                  onClick={onApplyCtaToAll}
                  disabled={!p.primaryCtaText && !p.primaryCtaUrl}
                >
                  Apply CTA to All Sections
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Trust Line</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, trustLine: (p.trustLine ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.trustLine ?? ""} onChange={v => onChange({ ...block, props: { ...p, trustLine: v || undefined } })} placeholder="Join 200+ practices already using Acme" fieldLabel="Trust Line" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "trustLine", p.trustLine ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Height</Label><Select value={p.heroHeight ?? "default"} onValueChange={v => onChange({ ...block, props: { ...p, heroHeight: v as "compact" | "default" | "large" | "full" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact" className="text-xs">Compact</SelectItem><SelectItem value="default" className="text-xs">Default</SelectItem><SelectItem value="large" className="text-xs">Large</SelectItem><SelectItem value="full" className="text-xs">Full Screen</SelectItem></SelectContent></Select></div>
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout & Image</Label>
              <div className="space-y-1.5"><Label className="text-xs">Layout</Label><Select value={p.layout ?? "centered"} onValueChange={v => onChange({ ...block, props: { ...p, layout: v as "centered" | "split" | "bg-image" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="centered" className="text-xs">Centered (no image)</SelectItem><SelectItem value="split" className="text-xs">Split — content left, image right</SelectItem><SelectItem value="bg-image" className="text-xs">Background image</SelectItem></SelectContent></Select></div>
              {(p.layout === "split" || p.layout === "bg-image") && <>
                <ImagePicker label="Image" value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v || undefined } })} />
                <div className="space-y-1.5"><Label className="text-xs">Image Alt Text</Label><Input value={p.imageAlt ?? ""} onChange={e => onChange({ ...block, props: { ...p, imageAlt: e.target.value || undefined } })} placeholder="Doctor reviewing a case" className="h-8 text-xs" /></div>
              </>}
              {p.layout === "split" && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">Image Aspect Ratio</Label><Select value={p.imageAspect ?? "4/3"} onValueChange={v => onChange({ ...block, props: { ...p, imageAspect: v as "16/9" | "4/3" | "1/1" | "3/4" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="16/9" className="text-xs">Wide (16:9)</SelectItem><SelectItem value="4/3" className="text-xs">Standard (4:3)</SelectItem><SelectItem value="1/1" className="text-xs">Square (1:1)</SelectItem><SelectItem value="3/4" className="text-xs">Tall (3:4)</SelectItem></SelectContent></Select></div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image Drop Shadow</Label>
                    <Switch checked={p.imageShadow !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, imageShadow: v } })} />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      }
      case "dso-stat-row": {
        const p = block.props;
        const items = p.items ?? [];
        const updateItem = (i: number, patch: Partial<typeof items[0]>) => {
          const next = items.map((it, idx) => idx === i ? { ...it, ...patch } : it);
          onChange({ ...block, props: { ...p, items: next } });
        };
        const addItem = () => onChange({ ...block, props: { ...p, items: [...items, { value: "", label: "", detail: "" }] } });
        const removeItem = (i: number) => onChange({ ...block, props: { ...p, items: items.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Animate numbers on scroll</Label>
              <Switch checked={p.animateNumbers !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, animateNumbers: v } })} />
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</Label><Button variant="ghost" size="sm" onClick={addItem} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Stat {i + 1}</span><button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Input value={item.value} onChange={e => updateItem(i, { value: e.target.value })} placeholder="96% or 50+ or 2x" className="h-8 text-xs" />
                    <Input value={item.label} onChange={e => updateItem(i, { label: e.target.value })} placeholder="Label" className="h-8 text-xs" />
                    <Input value={item.detail ?? ""} onChange={e => updateItem(i, { detail: e.target.value || undefined })} placeholder="Detail line (optional)" className="h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Book a Demo" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "secondary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-faq": {
        const p = block.props;
        const items = p.items ?? [];
        const updateItem = (i: number, patch: Partial<typeof items[0]>) => {
          const next = items.map((it, idx) => idx === i ? { ...it, ...patch } : it);
          onChange({ ...block, props: { ...p, items: next } });
        };
        const addItem = () => onChange({ ...block, props: { ...p, items: [...items, { question: "", answer: "" }] } });
        const removeItem = (i: number) => onChange({ ...block, props: { ...p, items: items.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subheadline</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, subheadline: (p.subheadline ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Question size</Label><Select value={p.itemSize ?? "md"} onValueChange={v => onChange({ ...block, props: { ...p, itemSize: v as "sm" | "md" | "lg" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sm" className="text-xs">Small</SelectItem><SelectItem value="md" className="text-xs">Medium</SelectItem><SelectItem value="lg" className="text-xs">Large</SelectItem></SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">FAQ Items</Label><Button variant="ghost" size="sm" onClick={addItem} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Q{i + 1}</span><button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Input value={item.question} onChange={e => updateItem(i, { question: e.target.value })} placeholder="Question" className="h-8 text-xs" />
                    <Textarea value={item.answer} onChange={e => updateItem(i, { answer: e.target.value })} placeholder="Answer" rows={3} className="text-xs resize-none" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <div className="space-y-1.5"><Label className="text-xs">CTA Text</Label><Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} placeholder="Still have questions?" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Style</Label><Select value={p.ctaVariant ?? "secondary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
              </div>
              {onApplyCtaToAll && (
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                  <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                  <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "dso-split-feature": {
        const p = block.props;
        const bullets = p.bullets ?? [];
        const updateBullet = (i: number, val: string) => {
          const next = [...bullets]; next[i] = val;
          onChange({ ...block, props: { ...p, bullets: next } });
        };
        const addBullet = () => onChange({ ...block, props: { ...p, bullets: [...bullets, ""] } });
        const removeBullet = (i: number) => onChange({ ...block, props: { ...p, bullets: bullets.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "body", "ctaText"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "", ctaText: p.ctaText ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "", body: p.body ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: (p.body ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v || undefined } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Text</Label>
              <AiTextField type="input" value={p.ctaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, ctaText: v || undefined } })} placeholder="Learn more" fieldLabel="CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "ctaText", p.ctaText ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">CTA Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link / Redirect</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">CTA Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
            {onApplyCtaToAll && (
              <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
              </div>
            )}
            <ImagePicker label="Image" value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v || undefined } })} />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Image Position</Label><Select value={p.imagePosition ?? "right"} onValueChange={v => onChange({ ...block, props: { ...p, imagePosition: v as "left" | "right" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left" className="text-xs">Left</SelectItem><SelectItem value="right" className="text-xs">Right</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bullet Points</Label><Button variant="ghost" size="sm" onClick={addBullet} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-1.5">
                {bullets.map((b, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <Input value={b} onChange={e => updateBullet(i, e.target.value)} className="h-8 text-xs flex-1" placeholder={`Bullet ${i + 1}`} />
                    <button onClick={() => removeBullet(i)} className="text-slate-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case "dso-software-showcase": {
        const p = block.props;
        const features = p.features ?? [];
        const updateFeature = (i: number, key: "label" | "icon", val: string) => {
          const next = features.map((f, idx) => idx === i ? { ...f, [key]: val } : f);
          onChange({ ...block, props: { ...p, features: next } });
        };
        const addFeature = () => onChange({ ...block, props: { ...p, features: [...features, { icon: "check", label: "" }] } });
        const removeFeature = (i: number) => onChange({ ...block, props: { ...p, features: features.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "body", "ctaText"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", body: p.body ?? "", ctaText: p.ctaText ?? "" }} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Eyebrow</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, eyebrow: (p.eyebrow ?? "") + token } })} />
              </div>
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headline</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, headline: (p.headline ?? "") + token } })} />
                </div>
              </div>
              <AiTextField type="textarea" rows={2} value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "", body: p.body ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, body: (p.body ?? "") + token } })} />
              </div>
              <AiTextField type="textarea" rows={3} value={p.body ?? ""} onChange={v => onChange({ ...block, props: { ...p, body: v || undefined } })} fieldLabel="Body" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "body", p.body ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Text</Label>
              <AiTextField type="input" value={p.ctaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, ctaText: v || undefined } })} placeholder="See it in action" fieldLabel="CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "ctaText", p.ctaText ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">CTA Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link / Redirect</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem></SelectContent></Select></div>
            {onApplyCtaToAll && (
              <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">Apply CTA to All Blocks</p>
                <p className="text-xs text-emerald-700 leading-snug">Copies this CTA text, URL, and mode to every other section on this page.</p>
                <Button size="sm" className="w-full h-8 text-xs mt-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onApplyCtaToAll} disabled={!p.ctaText && !p.ctaUrl}>Apply CTA to All Sections</Button>
              </div>
            )}
            <ImagePicker label="Screenshot" value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v || undefined } })} />
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">Or use a video instead — overrides the screenshot when set.</p>
              <VideoPicker label="Video" value={p.videoUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, videoUrl: v || undefined } })} />
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Video Options</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Autoplay &amp; Loop</Label>
                    <p className="text-[11px] text-muted-foreground">Plays silently on page load and repeats.</p>
                  </div>
                  <Switch checked={p.videoAutoplay !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, videoAutoplay: v } })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Play on scroll</Label>
                    <p className="text-[11px] text-muted-foreground">Start playing when this section scrolls into view.</p>
                  </div>
                  <Switch checked={p.videoPlayOnScroll ?? false} onCheckedChange={v => onChange({ ...block, props: { ...p, videoPlayOnScroll: v } })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-medium">Hide browser frame</Label>
                    <p className="text-[11px] text-muted-foreground">Remove the fake URL bar and window chrome.</p>
                  </div>
                  <Switch checked={p.hideBrowserFrame ?? false} onCheckedChange={v => onChange({ ...block, props: { ...p, hideBrowserFrame: v } })} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Layout</Label><Select value={p.layout ?? "centered"} onValueChange={v => onChange({ ...block, props: { ...p, layout: v as "centered" | "split" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="centered" className="text-xs">Centered</SelectItem><SelectItem value="split" className="text-xs">Split</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feature Chips</Label><Button variant="ghost" size="sm" onClick={addFeature} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <Select value={f.icon ?? "check"} onValueChange={v => updateFeature(i, "icon", v)}>
                      <SelectTrigger className="h-8 text-xs w-24 flex-shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="check" className="text-xs">✓ Check</SelectItem>
                        <SelectItem value="zap" className="text-xs">⚡ Zap</SelectItem>
                        <SelectItem value="clock" className="text-xs">🕐 Clock</SelectItem>
                        <SelectItem value="bar" className="text-xs">📊 Bar</SelectItem>
                        <SelectItem value="monitor" className="text-xs">🖥 Monitor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={f.label} onChange={e => updateFeature(i, "label", e.target.value)} className="h-8 text-xs flex-1" placeholder="Feature label" />
                    <button onClick={() => removeFeature(i)} className="text-slate-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case "dso-case-study": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-xs font-semibold text-foreground">Summary only</p>
                <p className="text-[11px] text-muted-foreground">Show just the hero &amp; stats, hide the full case study</p>
              </div>
              <button
                onClick={() => onChange({ ...block, props: { ...p, heroOnly: !p.heroOnly } })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${p.heroOnly ? "bg-primary" : "bg-input"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${p.heroOnly ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="space-y-2 pb-2 border-b">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Section Colors</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Hero &amp; Stats</Label>
                <Select value={p.heroBackgroundStyle ?? p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, heroBackgroundStyle: v as BackgroundStyle } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Challenge, Solution &amp; Quote</Label>
                <Select value={p.bodyBackgroundStyle ?? p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, bodyBackgroundStyle: v as BackgroundStyle } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Results &amp; Why It Matters</Label>
                <Select value={p.resultsBackgroundStyle ?? p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, resultsBackgroundStyle: v as BackgroundStyle } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow ?? ""} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Textarea value={p.headline ?? ""} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} className="text-xs min-h-[80px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subheadline</Label>
              <Textarea value={p.subheadline ?? ""} onChange={e => onChange({ ...block, props: { ...p, subheadline: e.target.value } })} className="text-xs min-h-[60px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pull Quote</Label>
              <Textarea value={p.quote ?? ""} onChange={e => onChange({ ...block, props: { ...p, quote: e.target.value } })} className="text-xs min-h-[80px]" />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Section Images</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Challenge Image</Label>
                <ImagePicker value={p.challenge?.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, challenge: { heading: p.challenge?.heading ?? "The Challenge", body: p.challenge?.body ?? "", imageUrl: v || undefined } } })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Solution Image</Label>
                <ImagePicker value={p.solution?.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, solution: { heading: p.solution?.heading ?? "The Solution", body: p.solution?.body ?? "", imageUrl: v || undefined } } })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Results Image</Label>
                <ImagePicker value={p.resultsImageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, resultsImageUrl: v || undefined } })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Why It Matters Image</Label>
                <ImagePicker value={p.whyItMatters?.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, whyItMatters: { heading: p.whyItMatters?.heading ?? "Why It Matters", body: p.whyItMatters?.body ?? "", imageUrl: v || undefined } } })} />
              </div>
            </div>
            {(() => {
              const sections = p.sections ?? [];
              const writeSections = (next: typeof sections) => onChange({ ...block, props: { ...p, sections: next } });
              const updateSection = (i: number, patch: Partial<DsoCaseStudyExtraSection>) =>
                writeSections(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
              const addSection = () => writeSections([...sections, { heading: "New Section", body: "" }]);
              const duplicateSection = (i: number) => {
                const next = [...sections];
                next.splice(i + 1, 0, { ...sections[i] });
                writeSections(next);
              };
              const removeSection = (i: number) => writeSections(sections.filter((_, idx) => idx !== i));
              const moveSection = (i: number, dir: -1 | 1) => {
                const to = i + dir;
                if (to < 0 || to >= sections.length) return;
                const next = [...sections];
                const [moved] = next.splice(i, 1);
                next.splice(to, 0, moved);
                writeSections(next);
              };
              return (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Additional Sections</p>
                    <Button variant="ghost" size="sm" onClick={addSection} className="h-7 text-xs gap-1">
                      <Plus className="w-3 h-3" /> Add section
                    </Button>
                  </div>
                  {sections.length === 0 && (
                    <p className="text-[11px] text-muted-foreground py-1">No extra sections. Add one to extend the case study.</p>
                  )}
                  <div className="space-y-3">
                    {sections.map((sec, i) => (
                      <div key={i} className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Section {i + 1}</span>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                            <button onClick={() => duplicateSection(i)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={() => removeSection(i)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Position</Label>
                          <Select value={sec.position ?? "after-results"} onValueChange={v => updateSection(i, { position: v as DsoCaseStudyExtraSection["position"] })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="before-results" className="text-xs">Before Results band</SelectItem>
                              <SelectItem value="after-results" className="text-xs">After Results / CTA</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Background</Label>
                          <Select value={sec.backgroundStyle ?? p.backgroundStyle ?? "white"} onValueChange={v => updateSection(i, { backgroundStyle: v as BackgroundStyle })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{bgOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
                          <Input value={sec.heading} onChange={e => updateSection(i, { heading: e.target.value })} className="h-8 text-xs" placeholder="Section heading" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Body</Label>
                          <Textarea value={sec.body} onChange={e => updateSection(i, { body: e.target.value })} className="text-xs min-h-[70px]" placeholder="Section body copy…" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Quote (optional)</Label>
                          <Textarea value={sec.quote ?? ""} onChange={e => updateSection(i, { quote: e.target.value || undefined })} className="text-xs min-h-[60px]" placeholder="Optional pull quote" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Image (optional)</Label>
                          <ImagePicker value={sec.imageUrl ?? ""} onChange={v => updateSection(i, { imageUrl: v || undefined })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="space-y-2 pt-2 border-t">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">CTA Button</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Button Text</Label>
                <Input value={p.ctaText ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaText: e.target.value || undefined } })} className="h-8 text-xs" placeholder="e.g. Book a Demo" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Button URL</Label>
                <Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} className="h-8 text-xs" placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Style</Label>
                <Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary" className="text-xs">Button</SelectItem>
                    <SelectItem value="secondary" className="text-xs">Outline</SelectItem>
                    <SelectItem value="link" className="text-xs">Link →</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
      }
      case "dandy-versus":
        return <DandyVersusPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-columns-v2":
        return <DandyColumnsV2Panel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-columns-v3":
        return <DandyColumnsV3Panel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-vertical-tabs":
        return <DandyVerticalTabsPanel blockType={block.type} props={block.props} onChange={props => onChange({ ...block, props })} brandVoiceSet={brandVoiceSet} />;
      case "dandy-switchback":
        return <DandySwitchbackPanel blockType={block.type} props={block.props} onChange={props => onChange({ ...block, props })} brandVoiceSet={brandVoiceSet} />;
      case "scroll-assembly":
        return <ScrollAssemblyPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "horizontal-showcase":
        return <HorizontalShowcasePanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "sticky-stack":
        return <StickyStackPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-site-header":
        return <DandySiteHeaderPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-site-footer":
        return <DandySiteFooterPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-video-testimonials":
        return <DandyVideoTestimonialsPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-side-image-v6":
        return <DandySideImageV6Panel props={block.props} onChange={props => onChange({ ...block, props })} ctaSource={ctaSource} />;
      case "dandy-hero-v7-s3":
        return <DandyHeroV7S3Panel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-form-right-alt":
        return <DandyFormRightAltPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-conversion-panel-1":
        return <DandyConversionPanel1Panel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "dandy-cta-block":
        return <DandyCtaBlockPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "one-pager-hero":
        return (
          <OnePagerHeroPanel
            blockType={block.type}
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "event-page":
        return (
          <EventPagePanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "product-launch":
        return (
          <ProductLaunchPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "story-hub":
        return (
          <StoryHubPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "spatial-tour":
        return (
          <SpatialTourPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            brandVoiceSet={brandVoiceSet}
          />
        );
      case "bento-showcase":
        return (
          <BentoShowcasePanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "magazine-hero":
        return (
          <MagazineHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "cinematic-video-hero":
        return (
          <CinematicVideoHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "aurora-gradient-hero":
        return (
          <AuroraGradientHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "editorial-split-hero":
        return (
          <EditorialSplitHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "parallax-layers-hero":
        return (
          <ParallaxLayersHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "spotlight-glow-hero":
        return (
          <SpotlightGlowHeroPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "bold-statement":
        return (
          <BoldStatementPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
            ctaSource={ctaSource}
          />
        );
      case "id-hero":
        return <IdHeroPanel props={block.props} onChange={props => onChange({ ...block, props })} ctaSource={ctaSource} />;
      case "id-marquee":
        return <IdMarqueePanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-intro":
        return <IdIntroPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-cinema-pillars":
        return <IdCinemaPillarsPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-parallax-showcase":
        return <IdParallaxShowcasePanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-system-flow":
        return <IdSystemFlowPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-form":
        return <IdFormPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-stats":
        return <IdStatsPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-invitation":
        return <IdInvitationPanel props={block.props} onChange={props => onChange({ ...block, props })} ctaSource={ctaSource} />;
      case "id-grid":
        return <IdGridPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-spotlight":
        return <IdSpotlightPanel props={block.props} onChange={props => onChange({ ...block, props })} />;
      case "id-reservation-pass":
        return <IdReservationPassPanel props={block.props} onChange={props => onChange({ ...block, props })} ctaSource={ctaSource} />;
      case "gradient-pricing":
        return (
          <GradientPricingPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "editorial-carousel":
        return (
          <EditorialCarouselPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "menu-section":
        return (
          <MenuSectionPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "hours-location":
        return (
          <HoursLocationPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "before-after-gallery":
        return (
          <BeforeAfterGalleryPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "speaker-grid":
        return (
          <SpeakerGridPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
          />
        );
      case "event-landing-hero":
        return (
          <EventLandingHeroPanel
            props={block.props}
            onChange={(props) => onChange({ ...block, props })}
          />
        );
      case "section": {
        const p = block.props;
        const update = (patch: Partial<typeof p>) =>
          onChange({ ...block, props: { ...p, ...patch } });
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Max width</Label>
              <Select value={p.maxWidth ?? "default"} onValueChange={(v) => update({ maxWidth: v as typeof p.maxWidth })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrow">Narrow (640px)</SelectItem>
                  <SelectItem value="default">Default (1100px)</SelectItem>
                  <SelectItem value="wide">Wide (1280px)</SelectItem>
                  <SelectItem value="full">Full bleed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vertical padding</Label>
              <Select value={p.paddingY ?? "default"} onValueChange={(v) => update({ paddingY: v as typeof p.paddingY })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="spacious">Spacious</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Align children</Label>
              <Select value={p.align ?? "stretch"} onValueChange={(v) => update({ align: v as typeof p.align })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">Start</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="end">End</SelectItem>
                  <SelectItem value="stretch">Stretch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }
      case "columns": {
        const p = block.props;
        const update = (patch: Partial<typeof p>) =>
          onChange({ ...block, props: { ...p, ...patch } });
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Columns</Label>
              <Select value={String(p.columns ?? 2)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gap (rem)</Label>
              <Input
                type="number" step="0.25" min="0" max="8"
                value={p.gap ?? 1.5}
                onChange={(e) => update({ gap: Number(e.target.value) })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Align children</Label>
              <Select value={p.align ?? "stretch"} onValueChange={(v) => update({ align: v as typeof p.align })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">Start</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="end">End</SelectItem>
                  <SelectItem value="stretch">Stretch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }
      case "grid": {
        const p = block.props;
        const update = (patch: Partial<typeof p>) =>
          onChange({ ...block, props: { ...p, ...patch } });
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Desktop columns</Label>
              <Input
                type="number" step="1" min="1" max="12"
                value={p.columns ?? 3}
                onChange={(e) => update({ columns: Math.max(1, Math.min(12, Number(e.target.value))) })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Mobile columns</Label>
              <Input
                type="number" step="1" min="1" max="4"
                value={p.mobileColumns ?? 1}
                onChange={(e) => update({ mobileColumns: Math.max(1, Math.min(4, Number(e.target.value))) })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Gap (rem)</Label>
              <Input
                type="number" step="0.25" min="0" max="8"
                value={p.gap ?? 1.5}
                onChange={(e) => update({ gap: Number(e.target.value) })}
                className="h-8"
              />
            </div>
          </div>
        );
      }
      case "stack": {
        const p = block.props;
        const update = (patch: Partial<typeof p>) =>
          onChange({ ...block, props: { ...p, ...patch } });
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Gap (rem)</Label>
              <Input
                type="number" step="0.25" min="0" max="8"
                value={p.gap ?? 1}
                onChange={(e) => update({ gap: Number(e.target.value) })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Align children</Label>
              <Select value={p.align ?? "stretch"} onValueChange={(v) => update({ align: v as typeof p.align })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">Start</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="end">End</SelectItem>
                  <SelectItem value="stretch">Stretch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }
      case "content-series":
        return <ContentSeriesPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} pageId={pageId} />;
      case "webinar-hub":
        return <WebinarHubPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} pageId={pageId} />;
      case "blog-series":
        return <BlogSeriesPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} />;
      case "storefront":
        return <StorefrontPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} />;
      case "business-case-split":
        return <BusinessCasePanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} variant="split" />;
      case "business-case-centered":
        return <BusinessCasePanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} variant="centered" />;
      case "business-case-premium":
        return <BusinessCasePanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} variant="premium" />;
      case "storybrand-journey":
        return <StorybrandJourneyPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} />;
      case "exec-decision-brief":
        return <ExecDecisionBriefPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} />;
      case "challenger-insight":
        return <ChallengerInsightPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} />;
      case "deal-room":
        return <DealRoomPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} onApplyCtaToAll={onApplyCtaToAll} />;
      case "account-microsite":
        return <AccountMicrositePanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} onApplyCtaToAll={onApplyCtaToAll} />;
      case "onboarding-hub":
        return <OnboardingHubPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} />;
      case "value-renewal-review":
        return <ValueRenewalReviewPanel props={block.props} onChange={updated => onChange({ ...block, props: updated })} />;
      case "event-noir":
      case "event-luminous":
      case "event-split":
        return <TemplateEventPanel props={block.props} blockType={block.type} onChange={next => onChange({ ...block, props: next })} />;
      case "case-metrics":
      case "case-editorial":
      case "case-modular":
        return <TemplateCaseStudyPanel props={block.props} onChange={next => onChange({ ...block, props: next })} />;
      case "value-pillars-icon-trio":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Pillar" showMediaSize />;
      case "value-pillars-outlined-cards":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Pillar" showCardBorder showItemLinks showMediaSize />;
      case "value-pillars-color-block-cards":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Pillar" showItemLinks showMediaSize />;
      case "value-pillars-divided-columns":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Pillar" showDividers showItemLinks showMediaSize />;
      case "value-pillars-headline-badge":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Pillar" />;
      case "value-pillars-card-columns":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Pillar" showItemLinks showMediaSize />;
      case "feature-photo-cards":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Feature" showItemLinks />;
      case "feature-card-grid":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Feature" showColumns />;
      case "feature-big-features":
        return <SectionBlockPanel blockType={block.type} props={block.props} onChange={updated => onChange({ ...block, props: updated })} brandVoiceSet={brandVoiceSet} itemNoun="Feature" showImageTreatment showImageSide />;
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
                className="flex-1 h-8 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--brand-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <AlignLeft className="w-3 h-3" />
                Content
              </TabsTrigger>
              <TabsTrigger
                value="style"
                className="flex-1 h-8 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--brand-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <SlidersHorizontal className="w-3 h-3" />
                Style
              </TabsTrigger>
              {extraTabs?.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="flex-1 h-8 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--brand-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {t.icon}
                  {t.label}
                </TabsTrigger>
              ))}
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
                  blockType={block.type}
                  canFollowPageCta={canFollowPageCta}
                  onChange={(settings: BlockSettings) => onChange({ ...block, blockSettings: settings })}
                  modalTheme={(block.props as { modalTheme?: "light" | "dark" } | undefined)?.modalTheme}
                  brandDefaultModalTheme={brand?.modalTheme ?? null}
                  onModalThemeChange={(v) =>
                    onChange({
                      ...block,
                      props: { ...(block.props as object), modalTheme: v },
                    } as typeof block)
                  }
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

            {extraTabs?.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-0 border-0 p-0">
                <div className="p-4 overflow-y-auto">{t.content}</div>
              </TabsContent>
            ))}
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
