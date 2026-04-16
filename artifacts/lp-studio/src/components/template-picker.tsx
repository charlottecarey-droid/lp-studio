import { LPTemplate, LP_TEMPLATES } from "@/lib/templates";
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
}

export function TemplatePicker({ onSelect, onSkip, builderPages, onSelectBuilderPage }: TemplatePickerProps) {
  const hasBuilderPages = builderPages && builderPages.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">Choose a Template</h2>
          <p className="text-muted-foreground mt-1">Start with a proven landing page framework or build from scratch.</p>
        </div>
        <Button variant="outline" onClick={onSkip}>Start from scratch</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LP_TEMPLATES.map((template) => (
          <Card key={template.id} className="flex flex-col overflow-hidden border-2 hover:border-[#003A30] transition-colors duration-200 shadow-sm hover:shadow-md cursor-default">
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
                  <div className="h-1 w-8 bg-[#C7E738]/60 rounded-sm" />
                  <div className="h-5 w-36 bg-white/90 rounded-sm" />
                  <div className="h-2 w-28 bg-white/30 rounded-sm" />
                  <div className="h-0.5 w-8 bg-white/20 rounded-sm" />
                  <div className="h-6 w-20 bg-[#003A30] rounded-sm mt-1" />
                </div>
                {/* Agenda strip */}
                <div className="flex gap-2 mt-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex-1 border border-white/10 rounded p-1.5 space-y-1">
                      <div className="h-1.5 w-4 bg-[#C7E738]/50 rounded-sm" />
                      <div className="h-2 w-full bg-white/40 rounded-sm" />
                      <div className="h-1.5 w-3/4 bg-white/20 rounded-sm" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div className="h-48 bg-slate-50 p-4 flex flex-col gap-2 overflow-hidden border-b border-slate-100">
              {/* Nav */}
              <div className="h-6 bg-white border border-slate-100 rounded-md w-full flex justify-between items-center px-3 shadow-sm">
                <div className="h-2 w-12 bg-[#003A30] rounded-sm" />
                <div className="h-3 w-16 bg-[#C7E738] rounded-full" />
              </div>
              
              {/* Hero */}
              <div className={cn("flex flex-1 gap-3 mt-1", template.config.layout === 'split' ? "flex-row" : "flex-col items-center text-center")}>
                <div className={cn("space-y-2 flex flex-col justify-center", template.config.layout === 'split' ? "w-1/2" : "w-3/4 items-center")}>
                  <div className="h-4 w-full bg-slate-800 rounded-sm" />
                  <div className="h-4 w-3/4 bg-slate-800 rounded-sm" />
                  <div className="h-2 w-5/6 bg-slate-400 rounded-sm mt-1" />
                  <div className="h-2 w-4/6 bg-slate-400 rounded-sm" />
                  <div className="h-5 w-24 bg-[#C7E738] rounded-full mt-2" />
                </div>
                {template.config.heroType !== 'none' && (
                  <div className={cn("bg-slate-200 rounded-lg border border-slate-300", template.config.layout === 'split' ? "w-1/2 h-full" : "w-full flex-1 mt-2")} />
                )}
              </div>

              {/* Trust Bar */}
              {template.config.trustBar?.enabled && (
                <div className="h-6 w-full bg-white border border-slate-100 rounded-md mt-2 flex justify-around items-center px-4 shadow-sm">
                  <div className="h-1.5 w-8 bg-[#003A30] rounded-sm" />
                  <div className="h-1.5 w-8 bg-[#003A30] rounded-sm" />
                  <div className="h-1.5 w-8 bg-[#003A30] rounded-sm" />
                  <div className="h-1.5 w-8 bg-[#003A30] rounded-sm hidden sm:block" />
                </div>
              )}
            </div>
            )}

            <div className="p-6 flex flex-col flex-1 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-[#003A30]" />
                  <h3 className="font-bold text-lg text-slate-900">{template.name}</h3>
                </div>
                {template.badge && (
                  <Badge className="bg-[#C7E738] text-[#003A30] hover:bg-[#C7E738]/90 font-medium shadow-none border-none">{template.badge}</Badge>
                )}
              </div>
              <div className="text-xs text-slate-500 font-mono mb-3 bg-slate-100 self-start px-2 py-1 rounded-md">{template.framework}</div>
              <p className="text-sm text-slate-600 mb-6 flex-1 leading-relaxed">{template.description}</p>
              
              <Button 
                onClick={() => onSelect(template)} 
                className="w-full bg-[#003A30] text-white hover:bg-[#003A30]/90 rounded-xl h-11"
              >
                Use this template
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {hasBuilderPages && onSelectBuilderPage && (
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-lg font-semibold font-display">Your Builder Pages</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Reuse a page you've already built as a starting point for this variant.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {builderPages.map((page) => (
              <Card key={page.id} className="flex flex-col border-2 hover:border-[#003A30] transition-colors duration-200 shadow-sm hover:shadow-md cursor-default">
                <div className="p-5 flex flex-col flex-1 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-4.5 h-4.5 text-[#003A30]" />
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
                    className="w-full mt-auto border-[#003A30]/30 text-[#003A30] hover:bg-[#003A30]/5"
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
        <div className="pt-2 border-t border-border/60">
          <p className="text-sm text-muted-foreground italic">No builder pages yet — create one from an existing variant or start from scratch.</p>
        </div>
      )}
    </div>
  );
}
