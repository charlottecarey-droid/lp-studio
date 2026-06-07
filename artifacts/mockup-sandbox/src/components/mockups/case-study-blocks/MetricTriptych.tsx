import React from "react";
import { Quote, Sparkles } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface MetricTriptychProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;

  company?: string;
  logoIcon?: React.ReactNode;
  
  metrics?: Array<{
    value: string;
    label: string;
  }>;
  
  quote?: string;
  author?: string;
  role?: string;
  
  cta?: MockupCTAProps | null;
}

export function MetricTriptych({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#fafafa",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  
  company = "Acme Corp",
  logoIcon = <Sparkles className="w-8 h-8" />,
  
  metrics = [
    { value: "10x", label: "Faster deployment times" },
    { value: "$2.4M", label: "Pipeline generated in Q1" },
    { value: "45%", label: "Increase in conversion rate" }
  ],
  
  quote = "Implementing this platform was a turning point for our organization. The metrics speak for themselves, but the real value is how it empowered our team to move fast without breaking things.",
  author = "David Chen",
  role = "Chief Marketing Officer",
  
  cta = {
    variant: "link",
    primaryLabel: "View full story",
    align: "center"
  }
}: MetricTriptychProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-6xl text-center">
        
        <div className="flex flex-col items-center justify-center mb-16">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border"
            style={{ backgroundColor: surface, borderColor: border, color: accent }}
          >
            {logoIcon}
          </div>
          <span className="text-xl font-bold tracking-tight uppercase" style={{ color: ink }}>
            {company}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-20">
          {metrics.map((metric, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div 
                className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-4"
                style={{ color: accent }}
              >
                {metric.value}
              </div>
              <div 
                className="text-lg md:text-xl font-medium max-w-[200px]"
                style={{ color: ink }}
              >
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <Quote className="h-12 w-12 mx-auto mb-8 opacity-20" style={{ color: ink }} />
          <h3 
            className="text-2xl md:text-3xl font-medium leading-relaxed tracking-tight mb-8"
            style={{ color: ink }}
          >
            "{quote}"
          </h3>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg mb-1" style={{ color: ink }}>{author}</span>
            <span className="font-medium" style={{ color: muted }}>{role}, {company}</span>
          </div>
        </div>

        {cta && (
          <div className="pt-10 border-t" style={{ borderColor: border }}>
            <MockupCTA
              {...cta}
              accent={accent}
              accentText={accentText}
              surface={surface}
              ink={ink}
              muted={muted}
              border={border}
            />
          </div>
        )}
        
      </div>
    </section>
  );
}

export default MetricTriptych;
