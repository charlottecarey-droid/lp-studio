import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Copy, Check, User, Target, Layout, Wand2, ChevronDown, ChevronUp, Users, Rocket } from "lucide-react";
import { fetchBrandConfig, type BrandConfig, type AudienceSegment } from "@/lib/brand-config";

const API_BASE = "/api";

export interface ContentBrief {
  companyOverview: string;
  personas: Array<{
    title: string;
    painPoints: string[];
    motivations: string;
  }>;
  suggestedHeadline: string;
  valueProps: string[];
  toneGuidance: string;
  recommendedBlocks: string[];
  ctaSuggestions: string[];
}

interface ContentBriefModalProps {
  open: boolean;
  onClose: () => void;
  onApply?: (brief: ContentBrief, company: string, objective: string, segment?: AudienceSegment) => void;
  onGeneratePage?: (prompt: string) => Promise<void>;
  initialSegmentId?: string;
  initialCompany?: string;
}

function isDsoPracticesSegment(segment: AudienceSegment | null): boolean {
  if (!segment) return false;
  const name = segment.name.toLowerCase();
  return name.includes("dso practices") || name.includes("dso practice");
}

function buildBriefPrompt(brief: ContentBrief, company: string, objective: string, segment: AudienceSegment | null): string {
  const isDsoPractices = isDsoPracticesSegment(segment);
  const parts: string[] = [];

  if (isDsoPractices) {
    parts.push(`Create a DSO Practices landing page for "${company}". Use ONLY DSO Practices block types — do NOT use any standard or DSO enterprise block types.`);
  } else {
    parts.push(`Create a landing page for "${company}".`);
  }

  if (segment) parts.push(`Target audience segment: ${segment.name} — ${segment.messagingAngle || segment.description}`);
  parts.push(`Campaign objective: ${objective}`);
  if (brief.suggestedHeadline) parts.push(`Headline: "${brief.suggestedHeadline}"`);
  if (brief.companyOverview) parts.push(`Audience context: ${brief.companyOverview}`);
  if (brief.valueProps.length) parts.push(`Key value props:\n${brief.valueProps.map(v => `- ${v}`).join("\n")}`);
  if (brief.toneGuidance) parts.push(`Tone: ${brief.toneGuidance}`);
  if (brief.ctaSuggestions.length) parts.push(`CTAs: ${brief.ctaSuggestions.join("; ")}`);
  if (!isDsoPractices && brief.recommendedBlocks.length) {
    parts.push(`Recommended block flow: ${brief.recommendedBlocks.join(" → ")}`);
  }
  if (brief.personas.length) {
    const personaLines = brief.personas.map(p => `${p.title}: ${p.painPoints.slice(0, 2).join("; ")}`);
    parts.push(`Buyer personas: ${personaLines.join(" | ")}`);
  }
  return parts.join("\n\n");
}

const BLOCK_LABELS: Record<string, string> = {
  hero: "Hero",
  "trust-bar": "Trust Bar",
  "stat-callout": "Stat Callout",
  "benefits-grid": "Benefits Grid",
  "how-it-works": "How It Works",
  testimonial: "Testimonial",
  "photo-strip": "Photo Strip",
  "product-grid": "Product Grid",
  comparison: "Comparison",
  "pas-section": "Problem-Agitate-Solve",
  "bottom-cta": "Bottom CTA",
  "lead-form": "Lead Form",
};

function buildBrandContext(brand: BrandConfig | null) {
  if (!brand) return undefined;
  const ctx: Record<string, unknown> = {};
  if (brand.brandName) ctx.brandName = brand.brandName;
  if (brand.taglines?.length) ctx.taglines = brand.taglines;
  if (brand.toneOfVoice) ctx.toneOfVoice = brand.toneOfVoice;
  if (brand.toneKeywords?.length) ctx.toneKeywords = brand.toneKeywords;
  if (brand.avoidPhrases?.length) ctx.avoidPhrases = brand.avoidPhrases;
  if (brand.targetAudience) ctx.targetAudience = brand.targetAudience;
  if (brand.copyExamples?.length) ctx.copyExamples = brand.copyExamples;
  if (brand.copyInstructions) ctx.copyInstructions = brand.copyInstructions;
  if (brand.messagingPillars?.length) ctx.messagingPillars = brand.messagingPillars;
  if (brand.productLines?.length) ctx.productLines = brand.productLines;
  if (brand.defaultCtaText) ctx.defaultCtaText = brand.defaultCtaText;
  return Object.keys(ctx).length > 0 ? ctx : undefined;
}

export function ContentBriefModal({ open, onClose, onApply, onGeneratePage, initialSegmentId, initialCompany }: ContentBriefModalProps) {
  const [company, setCompany] = useState(initialCompany ?? "");
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [briefCompany, setBriefCompany] = useState("");
  const [briefObjective, setBriefObjective] = useState("");
  const [copied, setCopied] = useState(false);
  const [expandedPersona, setExpandedPersona] = useState<number | null>(0);
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(initialSegmentId ?? "");

  const segments: AudienceSegment[] = brand?.segments ?? [];
  const selectedSegment = segments.find(s => s.id === selectedSegmentId) ?? null;

  useEffect(() => {
    if (open && !brand) {
      fetchBrandConfig().then(setBrand).catch(() => {});
    }
  }, [open, brand]);

  useEffect(() => {
    if (initialSegmentId !== undefined) setSelectedSegmentId(initialSegmentId);
  }, [initialSegmentId]);

  useEffect(() => {
    if (initialCompany !== undefined) setCompany(initialCompany);
  }, [initialCompany]);

  const handleGenerate = async () => {
    if (!company.trim() || !objective.trim()) return;
    setLoading(true);
    setError(null);
    setBrief(null);

    const brandContext = buildBrandContext(brand);
    const segmentContext = selectedSegment ? {
      name: selectedSegment.name,
      description: selectedSegment.description,
      messagingAngle: selectedSegment.messagingAngle,
      uniqueContext: selectedSegment.uniqueContext,
      valueProps: selectedSegment.valueProps,
      personas: selectedSegment.personas.map(p => ({ role: p.role, painPoints: p.painPoints })),
      challenges: selectedSegment.challenges.map(c => ({ title: c.title, desc: c.desc })),
    } : undefined;

    try {
      const res = await fetch(`${API_BASE}/lp/content-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          objective: objective.trim(),
          ...(brandContext ? { brandContext } : {}),
          ...(segmentContext ? { segmentContext } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate brief" }));
        throw new Error((err as { error?: string }).error ?? "Failed to generate brief");
      }
      const data = await res.json() as { brief: ContentBrief; company: string; objective: string };
      setBrief(data.brief);
      setBriefCompany(data.company);
      setBriefObjective(data.objective);
      setExpandedPersona(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!brief) return;
    const lines = [
      `# AI Content Brief — ${briefCompany}`,
      `**Objective:** ${briefObjective}`,
      "",
      `## Company / Audience Overview`,
      brief.companyOverview,
      "",
      `## Buyer Personas`,
      ...brief.personas.flatMap((p, i) => [
        `### ${i + 1}. ${p.title}`,
        `**Motivations:** ${p.motivations}`,
        `**Pain Points:**`,
        ...p.painPoints.map(pp => `- ${pp}`),
        "",
      ]),
      `## Suggested Headline`,
      brief.suggestedHeadline,
      "",
      `## Key Value Props`,
      ...brief.valueProps.map(v => `- ${v}`),
      "",
      `## Tone Guidance`,
      brief.toneGuidance,
      "",
      `## CTA Suggestions`,
      ...brief.ctaSuggestions.map(c => `- ${c}`),
      "",
      `## Recommended LP Blocks`,
      brief.recommendedBlocks.map(b => BLOCK_LABELS[b] ?? b).join(" → "),
    ].join("\n");

    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (!brief || !onApply) return;
    onApply(brief, briefCompany, briefObjective, selectedSegment ?? undefined);
    onClose();
  };

  const handleGeneratePage = async () => {
    if (!brief || !onGeneratePage) return;
    setGenerating(true);
    setError(null);
    try {
      const prompt = buildBriefPrompt(brief, briefCompany, briefObjective, selectedSegment);
      await onGeneratePage(prompt);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate page");
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    onClose();
    if (!brief) {
      setCompany(initialCompany ?? "");
      setObjective("");
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            AI Content Brief
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Input form */}
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
            {segments.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  Target Audience Segment
                </Label>
                <select
                  className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedSegmentId}
                  onChange={e => setSelectedSegmentId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">— No specific segment —</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {selectedSegment && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                    {selectedSegment.messagingAngle || selectedSegment.description}
                  </p>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Target Company or Audience
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Acme Corp, SaaS companies with 50-200 employees, Healthcare providers"
                value={company}
                onChange={e => setCompany(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && objective.trim()) handleGenerate(); }}
                disabled={loading}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Campaign Objective
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Drive trial signups for our project management tool, Book demo calls for enterprise plan"
                value={objective}
                onChange={e => setObjective(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && company.trim()) handleGenerate(); }}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading || !company.trim() || !objective.trim()}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating brief…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Brief
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Brief results */}
          {brief && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{briefCompany}</h3>
                  <p className="text-xs text-muted-foreground">{briefObjective}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy all"}
                </button>
              </div>

              {/* Overview */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company / Audience Overview
                </p>
                <p className="text-sm text-foreground leading-relaxed">{brief.companyOverview}</p>
              </div>

              {/* Personas */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Buyer Personas
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {brief.personas.map((persona, i) => (
                    <div key={i} className="bg-background">
                      <button
                        onClick={() => setExpandedPersona(expandedPersona === i ? null : i)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground">{persona.title}</span>
                        </div>
                        {expandedPersona === i ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedPersona === i && (
                        <div className="px-3 pb-3 space-y-2">
                          <p className="text-xs text-muted-foreground italic leading-relaxed">{persona.motivations}</p>
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Pain Points</p>
                            <ul className="space-y-1">
                              {persona.painPoints.map((pp, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full bg-destructive/60 mt-1.5 shrink-0" />
                                  {pp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Headline */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Wand2 className="w-3 h-3" />
                  Suggested Headline
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">{brief.suggestedHeadline}</p>
              </div>

              {/* Value Props */}
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  Key Value Props
                </p>
                <ul className="space-y-1.5">
                  {brief.valueProps.map((vp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {vp}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Two-column: Tone + CTA */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tone Guidance</p>
                  <p className="text-xs text-foreground leading-relaxed">{brief.toneGuidance}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">CTA Suggestions</p>
                  <ul className="space-y-1">
                    {brief.ctaSuggestions.map((cta, i) => (
                      <li key={i} className="text-xs text-foreground font-medium">"{cta}"</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Blocks */}
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layout className="w-3 h-3" />
                  Recommended LP Blocks
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {brief.recommendedBlocks.map((block, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/40 text-xs">→</span>}
                      <Badge variant="secondary" className="text-[11px] px-2 py-0.5 font-medium">
                        {BLOCK_LABELS[block] ?? block}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                {onGeneratePage && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Generate page from brief</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Builds a full landing page using the brief's audience, headline, value props, and block structure.
                      </p>
                    </div>
                    <Button onClick={handleGeneratePage} disabled={generating} className="gap-2 shrink-0">
                      {generating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Building…
                        </>
                      ) : (
                        <>
                          <Rocket className="w-3.5 h-3.5" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {onApply && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Apply to current page</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Pre-fills AI copy generation with this brief's value props, tone, and company context.
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleApply} className="gap-2 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
