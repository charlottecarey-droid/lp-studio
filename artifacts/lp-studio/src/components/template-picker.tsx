import { LPTemplate, LP_TEMPLATES } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplatePickerProps {
  onSelect: (template: LPTemplate) => void;
  onSkip: () => void;
}

export function TemplatePicker({ onSelect, onSkip }: TemplatePickerProps) {
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
    </div>
  );
}
