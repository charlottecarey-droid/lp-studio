import { useState } from "react";
import { Trash2, SlidersHorizontal, AlignLeft, Plus, GripVertical, RefreshCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageBlock, BlockSettings, CtaMode } from "@/lib/block-types";
import { BG_OPTIONS, type BackgroundStyle } from "@/lib/bg-styles";
import { BlockSettingsPanel, ColorField } from "./BlockSettingsPanel";
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
import { RoiCalculatorPanel } from "./RoiCalculatorPanel";
import { DsoMeetTeamPanel } from "./DsoMeetTeamPanel";
import { DsoPracticeNavPanel } from "./DsoPracticeNavPanel";
import { DtrTokenInserter } from "@/components/DtrTokenInserter";
import { CampaignVarInserter } from "@/components/CampaignVarInserter";
import { getBlockDef } from "@/lib/block-types";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy, refreshBlockCopy, refreshBentoTiles, type DsoBentoTile } from "@/lib/copy-api";

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
  const [dsoRefreshing, setDsoRefreshing] = useState(false);
  const [bentoTilesRefreshing, setBentoTilesRefreshing] = useState(false);

  const handleBentoTilesRefresh = async (currentTiles: DsoBentoTile[]) => {
    setBentoTilesRefreshing(true);
    try {
      const types = currentTiles.length > 0 ? currentTiles.map(t => t.type) : ["stat", "stat", "stat", "photo", "quote", "feature"];
      const tiles = await refreshBentoTiles(types);
      onChange({ ...block, props: { ...block.props, tiles } } as PageBlock);
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
      case "roi-calculator":
        return (
          <RoiCalculatorPanel
            props={block.props}
            onChange={props => onChange({ ...block, props })}
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
              <Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                  <Input value={p.chilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value || undefined } })} placeholder="https://meetdandy.chilipiper.com/..." className="h-8 text-xs" />
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
              <Label className="text-xs">Video URL (YouTube embed)</Label>
              <Input value={p.videoUrl} onChange={e => onChange({ ...block, props: { ...p, videoUrl: e.target.value } })} placeholder="https://www.youtube.com/embed/..." />
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
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
        const removeCase = (i: number) => onChange({ ...block, props: { ...p, cases: cases.filter((_, idx) => idx !== i) } });
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
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                      <Label className="text-[11px] text-slate-400">Card Image URL (optional)</Label>
                      <Input value={c.image ?? ""} onChange={e => updateCase(i, { image: e.target.value || undefined })} placeholder="https://images.unsplash.com/…" className="h-8 text-xs mt-1" />
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
                      <Textarea value={c.quote} onChange={e => updateCase(i, { quote: e.target.value })} rows={2} placeholder="Dandy transformed…" className="text-xs mt-1 resize-none" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-400">Attribution</Label>
                      <Input value={c.author} onChange={e => updateCase(i, { author: e.target.value })} placeholder="VP Clinical Operations" className="h-8 text-xs mt-1" />
                    </div>
                  </div>
                ))}
                {cases.length === 0 && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-xs text-slate-400">No stories yet.</p>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange({ ...block, props: { ...p, cases: [
                      { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people.", author: "Dr. Layla Lohmann, Founder", image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=800&h=480&fit=crop" },
                      { name: "Smile Brands", stat: "2–3 min", label: "saved per crown appointment", quote: "The efficiency gains were immediate.", author: "VP of Clinical Operations", image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=800&h=480&fit=crop" },
                      { name: "Tend", stat: "40%", label: "faster lab turnaround", quote: "Dandy keeps pace with our expansion without sacrificing quality.", author: "Head of Operations", image: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=800&h=480&fit=crop" },
                    ] } })}>
                      Load defaults
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
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                      <Textarea value={step.desc} onChange={e => updateStep(i, { desc: e.target.value })} rows={2} placeholder="Dandy deploys…" className="text-xs mt-1 resize-none" />
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
                </SelectContent>
              </Select>
            </div>
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
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
              <Label className="text-xs">CTA URL</Label>
              <Input value={p.ctaUrl} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value } })} placeholder="#" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "muted"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline", "primaryCtaText"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "", primaryCtaText: p.primaryCtaText ?? "" }} />

            {/* Layout */}
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <div className="flex gap-2">
                {([["full-bleed", "Full Bleed"], ["split", "Two Column"]] as const).map(([val, label]) => (
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Full-bleed media */}
            {(p.layout ?? "full-bleed") === "full-bleed" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Background image (optional)</Label>
                  <ImagePicker value={p.backgroundImageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, backgroundImageUrl: v } })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Background video URL (optional)</Label>
                  <Input value={p.backgroundVideoUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundVideoUrl: e.target.value } })} placeholder="https://…/video.mp4" className="h-8 text-xs" />
                  <p className="text-[11px] text-muted-foreground">Overrides background image when set. Use a direct MP4/WebM link.</p>
                </div>
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
                <Label className="text-xs">Company name to highlight (in lime)</Label>
                <div className="flex items-center gap-1">
                  <CampaignVarInserter onInsert={(token) => onChange({ ...block, props: { ...p, companyName: p.companyName + token } })} />
                  <DtrTokenInserter onInsert={(token) => onChange({ ...block, props: { ...p, companyName: p.companyName + token } })} />
                </div>
              </div>
              <Input value={p.companyName} onChange={e => onChange({ ...block, props: { ...p, companyName: e.target.value } })} placeholder="{company}" />
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
                  <Input value={p.primaryCtaUrl} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value } })} placeholder="https://meetdandy.chilipiper.com/..." className="h-8 text-xs" />
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
              {stats.map((s, i) => (
                <div key={i} className="flex gap-2 items-start bg-muted/40 rounded-lg p-2">
                  <GripVertical className="w-3.5 h-3.5 mt-2.5 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Input
                      className="h-7 text-xs"
                      placeholder="Value (e.g. 30%)"
                      value={s.value}
                      onChange={e => updateStat(i, "value", e.target.value)}
                    />
                    <Input
                      className="h-7 text-xs"
                      placeholder="Label"
                      value={s.label}
                      onChange={e => updateStat(i, "label", e.target.value)}
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 mt-1 text-muted-foreground hover:text-destructive" onClick={() => removeStat(i)}>
                    ×
                  </Button>
                </div>
              ))}
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
              <Label className="text-xs">Video URL</Label>
              <Input value={p.videoUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, videoUrl: e.target.value } })} placeholder="/videos/ai-scan-review.mp4" className="h-8 text-xs" />
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
        return (
          <div className="space-y-4 p-4">
            <DsoRefreshRow fields={["eyebrow", "headline", "subheadline"]} values={{ eyebrow: p.eyebrow ?? "", headline: p.headline ?? "", subheadline: p.subheadline ?? "" }} />
            <div className="space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
            <p className="text-xs text-muted-foreground italic">Stage cards use built-in defaults. Custom stage editing coming soon.</p>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
              <Label className="text-xs">Background video URL (optional)</Label>
              <Input value={p.backgroundVideoUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, backgroundVideoUrl: e.target.value } })} placeholder="https://…/video.mp4" className="h-8 text-xs" />
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
              <Label className="text-xs">CTA URL</Label>
              <Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value } })} placeholder="https://…" />
            </div>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
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
                <SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image</Label>
              <p className="text-xs text-muted-foreground">Full-bleed image on one half. Leave blank for text-only.</p>
              <ImagePicker value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v } })} />
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
                <Input value={p.chilipiperUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, chilipiperUrl: e.target.value } })} placeholder="https://meetdandy.chilipiper.com/..." className="h-8 text-xs" />
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
        return <DsoMeetTeamPanel block={block as PageBlock & { type: "dso-meet-team" }} onChange={onChange} brandVoiceSet={brandVoiceSet} />;
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
              <div className="space-y-1.5"><Label className="text-xs">New Way Label</Label><Input value={p.newWayLabel ?? ""} onChange={e => onChange({ ...block, props: { ...p, newWayLabel: e.target.value } })} className="h-8 text-xs" placeholder="The Dandy Way" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perks</Label><Button variant="ghost" size="sm" onClick={addPerk} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add</Button></div>
              <div className="space-y-3">
                {perks.map((perk, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Perk {i + 1}</span><button onClick={() => removePerk(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    <Select value={perk.icon ?? "star"} onValueChange={v => updatePerk(i, { icon: v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Icon" /></SelectTrigger><SelectContent>{[["gift","Gift"],["star","Star"],["shield","Shield"],["sparkles","Sparkles"],["zap","Zap"],["users","Users"],["clock","Clock"],["trending-up","Trending Up"],["check-circle","Check Circle"],["award","Award"],["heart","Heart"],["layers","Layers"]].map(([val, label]) => <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>)}</SelectContent></Select>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "muted"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
              <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} placeholder="Heartland Dental × Dandy" fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
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
              <div className="space-y-1.5"><Label className="text-xs">Primary CTA URL</Label><Input value={p.primaryCtaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Primary CTA Mode</Label><Select value={p.primaryCtaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, primaryCtaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link / Redirect</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Secondary CTA Text</Label>
                <AiTextField type="input" value={p.secondaryCtaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, secondaryCtaText: v || undefined } })} placeholder="See how it works" fieldLabel="Secondary CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "secondaryCtaText", p.secondaryCtaText ?? "", { headline: p.headline ?? "" })} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Secondary CTA URL</Label><Input value={p.secondaryCtaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, secondaryCtaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Secondary CTA Mode</Label><Select value={p.secondaryCtaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, secondaryCtaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link / Redirect</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem></SelectContent></Select></div>
            </div>
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
              <AiTextField type="input" value={p.trustLine ?? ""} onChange={v => onChange({ ...block, props: { ...p, trustLine: v || undefined } })} placeholder="Join 200+ practices already using Dandy" fieldLabel="Trust Line" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "trustLine", p.trustLine ?? "", { headline: p.headline ?? "" })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="border-t pt-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout & Image</Label>
              <div className="space-y-1.5"><Label className="text-xs">Layout</Label><Select value={p.layout ?? "centered"} onValueChange={v => onChange({ ...block, props: { ...p, layout: v as "centered" | "split" | "bg-image" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="centered" className="text-xs">Centered (no image)</SelectItem><SelectItem value="split" className="text-xs">Split — content left, image right</SelectItem><SelectItem value="bg-image" className="text-xs">Background image</SelectItem></SelectContent></Select></div>
              {(p.layout === "split" || p.layout === "bg-image") && <>
                <ImagePicker label="Image" value={p.imageUrl ?? ""} onChange={v => onChange({ ...block, props: { ...p, imageUrl: v || undefined } })} />
                <div className="space-y-1.5"><Label className="text-xs">Image Alt Text</Label><Input value={p.imageAlt ?? ""} onChange={e => onChange({ ...block, props: { ...p, imageAlt: e.target.value || undefined } })} placeholder="Doctor reviewing a case" className="h-8 text-xs" /></div>
              </>}
              {p.layout === "split" && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image Drop Shadow</Label>
                  <Switch checked={p.imageShadow !== false} onCheckedChange={v => onChange({ ...block, props: { ...p, imageShadow: v } })} />
                </div>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
            <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
              <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
              <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dandy-green"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>
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
