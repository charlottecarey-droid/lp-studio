import { Trash2, SlidersHorizontal, AlignLeft, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageBlock, BlockSettings } from "@/lib/block-types";
import { BG_OPTIONS, type BackgroundStyle } from "@/lib/bg-styles";
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
import { RoiCalculatorPanel } from "./RoiCalculatorPanel";
import { getBlockDef } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subheadline</Label>
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
          </div>
        );
      }
      case "dso-lab-tour": {
        const p = block.props;
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body text</Label>
              <Textarea rows={3} value={p.body} onChange={e => onChange({ ...block, props: { ...p, body: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quote</Label>
              <Textarea rows={2} value={p.quote} onChange={e => onChange({ ...block, props: { ...p, quote: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quote attribution</Label>
              <Input value={p.quoteAttribution} onChange={e => onChange({ ...block, props: { ...p, quoteAttribution: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image URL</Label>
              <Input value={p.imageUrl} onChange={e => onChange({ ...block, props: { ...p, imageUrl: e.target.value } })} placeholder="https://..." />
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
        const updateCase = (i: number, patch: Partial<{name: string; stat: string; label: string; quote: string; author: string}>) => {
          const next = cases.map((c, idx) => idx === i ? { ...c, ...patch } : c);
          onChange({ ...block, props: { ...p, cases: next } });
        };
        const addCase = () => onChange({ ...block, props: { ...p, cases: [...cases, { name: "", stat: "", label: "", quote: "", author: "" }] } });
        const removeCase = (i: number) => onChange({ ...block, props: { ...p, cases: cases.filter((_, idx) => idx !== i) } });
        return (
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
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
                  <p className="text-xs text-slate-400 text-center py-2">No stories yet. Click Add to get started.</p>
                )}
              </div>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
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
                  <p className="text-xs text-slate-400 text-center py-2">No challenges yet. Click Add to get started.</p>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subheadline</Label>
              <Textarea rows={3} value={p.subheadline} onChange={e => onChange({ ...block, props: { ...p, subheadline: e.target.value } })} />
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
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subheadline</Label>
              <Textarea rows={3} value={p.subheadline} onChange={e => onChange({ ...block, props: { ...p, subheadline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Primary CTA text</Label>
              <Input value={p.primaryCtaText} onChange={e => onChange({ ...block, props: { ...p, primaryCtaText: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Primary CTA URL</Label>
              <Input value={p.primaryCtaUrl} onChange={e => onChange({ ...block, props: { ...p, primaryCtaUrl: e.target.value } })} placeholder="#" />
            </div>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Eyebrow</Label>
              <Input value={p.eyebrow} onChange={e => onChange({ ...block, props: { ...p, eyebrow: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input value={p.headline} onChange={e => onChange({ ...block, props: { ...p, headline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subheadline</Label>
              <Textarea rows={3} value={p.subheadline} onChange={e => onChange({ ...block, props: { ...p, subheadline: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">DSO company name (column header)</Label>
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
