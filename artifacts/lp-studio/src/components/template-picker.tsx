import { LPTemplate, LP_TEMPLATES, getTemplatesForIndustry } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BuilderPageSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
}

interface TemplatePickerProps {
  onSelect: (template: LPTemplate) => void;
  onSkip: () => void;
  builderPages?: BuilderPageSummary[];
  onSelectBuilderPage?: (pageId: number) => void;
  /**
   * Tenant industry. When provided, the built-in template list is filtered so
   * non-dental tenants don't see the Dandy/dental templates (which contain
   * hardcoded Dandy copy and dental imagery). Omit only on Dandy-internal
   * surfaces (e.g. sales tooling).
   */
  industry?: string | null;
}

export function TemplatePicker({ onSelect, onSkip, builderPages, onSelectBuilderPage, industry }: TemplatePickerProps) {
  const hasBuilderPages = builderPages && builderPages.length > 0;
  const visibleTemplates =
    industry === undefined ? LP_TEMPLATES : getTemplatesForIndustry(industry);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">Choose a Template</h2>
          <p className="text-muted-foreground mt-1">Start with a proven landing page framework or build from scratch.</p>
        </div>
        <Button variant="outline" onClick={onSkip}>Start from scratch</Button>
      </div>

      {hasBuilderPages && onSelectBuilderPage && (
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-lg font-semibold font-display">Your Builder Pages</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Reuse a page you've already built as a starting point for this variant.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {builderPages.map((page) => (
              <Card key={page.id} className="flex flex-col border-2 hover:border-[var(--brand-primary)] transition-colors duration-200 shadow-sm hover:shadow-md cursor-default">
                <div className="p-5 flex flex-col flex-1 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-4.5 h-4.5 text-[var(--brand-primary)]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 truncate">{page.title}</h4>
                        <p className="text-xs text-slate-500 font-mono truncate">/{page.slug}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs shrink-0 ml-2",
                        page.status === "published"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      )}
                    >
                      {page.status === "published" ? "Live" : "Draft"}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectBuilderPage(page.id)}
                    className="w-full mt-auto border-[rgb(var(--brand-primary-rgb)/0.3)] text-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/0.05)]"
                  >
                    Use this page
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {builderPages && builderPages.length === 0 && (
        <div className="pt-2 pb-2 border-b border-border/60">
          <p className="text-sm text-muted-foreground italic">No builder pages yet — create one from an existing variant or start from scratch.</p>
        </div>
      )}

      {visibleTemplates.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground italic">
            No built-in templates for your industry yet — start from scratch
            and add blocks below, or pick one of your team's saved pages.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleTemplates.map((template) => (
          <Card key={template.id} className="flex flex-col overflow-hidden border-2 hover:border-[var(--brand-primary)] transition-colors duration-200 shadow-sm hover:shadow-md cursor-default">
            {/* Wireframe Preview */}
            {template.id === "inside-dandy-event" ? (
              <div className="h-48 bg-[#0d1117] p-4 flex flex-col gap-2 overflow-hidden border-b border-slate-800">
                {/* Nav */}
                <div className="h-5 w-full flex justify-between items-center px-1">
                  <div className="h-2 w-10 bg-white/60 rounded-sm" />
                  <div className="h-2 w-14 bg-white/20 rounded-sm" />
                </div>
                {/* Hero */}
                <div className="flex flex-col items-center text-center flex-1 justify-center gap-2 mt-1">
                  <div className="h-1 w-8 bg-[rgb(var(--brand-accent-rgb)/0.6)] rounded-sm" />
                  <div className="h-5 w-36 bg-white/90 rounded-sm" />
                  <div className="h-2 w-28 bg-white/30 rounded-sm" />
                  <div className="h-0.5 w-8 bg-white/20 rounded-sm" />
                  <div className="h-6 w-20 bg-[var(--brand-primary)] rounded-sm mt-1" />
                </div>
                {/* Agenda strip */}
                <div className="flex gap-2 mt-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex-1 border border-white/10 rounded p-1.5 space-y-1">
                      <div className="h-1.5 w-4 bg-[rgb(var(--brand-accent-rgb)/0.5)] rounded-sm" />
                      <div className="h-2 w-full bg-white/40 rounded-sm" />
                      <div className="h-1.5 w-3/4 bg-white/20 rounded-sm" />
                    </div>
                  ))}
                </div>
              </div>
            ) : template.id === "inside-dandy-spatial-tour" ? (
              <div className="h-48 bg-[#003A30] p-4 flex flex-col gap-2 overflow-hidden border-b border-[#00231D] relative">
                {/* Dot grid texture */}
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(197,241,197,0.25) 1px, transparent 0)', backgroundSize: '12px 12px' }} />
                {/* Mint glow */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(197,241,197,0.18) 0%, transparent 65%)', filter: 'blur(8px)' }} />
                {/* Nav */}
                <div className="relative h-4 flex justify-between items-center">
                  <div className="h-1.5 w-12 bg-[#C5F1C5]/70 rounded-sm" />
                  <div className="h-3 w-16 bg-[#158915] rounded-full" />
                </div>
                {/* Vision Pro chip */}
                <div className="relative flex justify-end">
                  <div className="h-2.5 w-20 bg-black/40 rounded-full border border-[#C5F1C5]/40" />
                </div>
                {/* Hero text */}
                <div className="relative flex-1 flex flex-col justify-center gap-1.5">
                  <div className="h-1 w-10 bg-[#C5F1C5]/60 rounded-sm" />
                  <div className="h-3 w-44 bg-white/95 rounded-sm" />
                  <div className="h-3 w-36 bg-white/95 rounded-sm" />
                  <div className="h-3 w-28 bg-[#C5F1C5] rounded-sm italic" />
                  <div className="flex gap-1.5 mt-1.5">
                    <div className="h-4 w-16 bg-[#158915] rounded-full" />
                    <div className="h-4 w-20 bg-transparent border border-white/40 rounded-full" />
                  </div>
                </div>
                {/* Marquee strip */}
                <div className="relative flex gap-3 pt-1.5 border-t border-white/10">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <div className="h-1.5 w-7 bg-[#C5F1C5] rounded-sm" />
                      <div className="h-1 w-9 bg-white/40 rounded-sm" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div className="h-48 bg-slate-50 p-4 flex flex-col gap-2 overflow-hidden border-b border-slate-100">
              {/* Nav */}
              <div className="h-6 bg-white border border-slate-100 rounded-md w-full flex justify-between items-center px-3 shadow-sm">
                <div className="h-2 w-12 bg-[var(--brand-primary)] rounded-sm" />
                <div className="h-3 w-16 bg-[var(--brand-accent)] rounded-full" />
              </div>
              
              {/* Hero */}
              <div className={cn("flex flex-1 gap-3 mt-1", template.config.layout === 'split' ? "flex-row" : "flex-col items-center text-center")}>
                <div className={cn("space-y-2 flex flex-col justify-center", template.config.layout === 'split' ? "w-1/2" : "w-3/4 items-center")}>
                  <div className="h-4 w-full bg-slate-800 rounded-sm" />
                  <div className="h-4 w-3/4 bg-slate-800 rounded-sm" />
                  <div className="h-2 w-5/6 bg-slate-400 rounded-sm mt-1" />
                  <div className="h-2 w-4/6 bg-slate-400 rounded-sm" />
                  <div className="h-5 w-24 bg-[var(--brand-accent)] rounded-full mt-2" />
                </div>
                {template.config.heroType !== 'none' && (
                  <div className={cn("bg-slate-200 rounded-lg border border-slate-300", template.config.layout === 'split' ? "w-1/2 h-full" : "w-full flex-1 mt-2")} />
                )}
              </div>

              {/* Trust Bar */}
              {template.config.trustBar?.enabled && (
                <div className="h-6 w-full bg-white border border-slate-100 rounded-md mt-2 flex justify-around items-center px-4 shadow-sm">
                  <div className="h-1.5 w-8 bg-[var(--brand-primary)] rounded-sm" />
                  <div className="h-1.5 w-8 bg-[var(--brand-primary)] rounded-sm" />
                  <div className="h-1.5 w-8 bg-[var(--brand-primary)] rounded-sm" />
                  <div className="h-1.5 w-8 bg-[var(--brand-primary)] rounded-sm hidden sm:block" />
                </div>
              )}
            </div>
            )}

            <div className="p-6 flex flex-col flex-1 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-[var(--brand-primary)]" />
                  <h3 className="font-bold text-lg text-slate-900">{template.name}</h3>
                </div>
                {template.badge && (
                  <Badge className="bg-[var(--brand-accent)] text-[var(--brand-primary)] hover:bg-[rgb(var(--brand-accent-rgb)/0.9)] font-medium shadow-none border-none">{template.badge}</Badge>
                )}
              </div>
              <div className="text-xs text-slate-500 font-mono mb-3 bg-slate-100 self-start px-2 py-1 rounded-md">{template.framework}</div>
              <p className="text-sm text-slate-600 mb-6 flex-1 leading-relaxed">{template.description}</p>
              
              <Button 
                onClick={() => onSelect(template)} 
                className="w-full bg-[var(--brand-primary)] text-white hover:bg-[rgb(var(--brand-primary-rgb)/0.9)] rounded-xl h-11"
              >
                Use this template
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
