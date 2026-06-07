import React from "react";
import { Boxes, Box, Workflow, Layers } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface LogoResultsRowProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;

  heading?: string;
  
  results?: Array<{
    company: string;
    logoIcon: React.ReactNode;
    outcome: string;
    metricValue: string;
  }>;
  
  cta?: MockupCTAProps | null;
}

export function LogoResultsRow({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  
  heading = "Real results from real teams",
  
  results = [
    {
      company: "TechFlow",
      logoIcon: <Boxes className="w-8 h-8" />,
      outcome: "Migrated their entire infrastructure with zero downtime.",
      metricValue: "99.99% uptime"
    },
    {
      company: "DataSync",
      logoIcon: <Workflow className="w-8 h-8" />,
      outcome: "Reduced customer onboarding time from weeks to days.",
      metricValue: "3x faster"
    },
    {
      company: "CloudScale",
      logoIcon: <Layers className="w-8 h-8" />,
      outcome: "Scaled to handle Black Friday traffic spikes effortlessly.",
      metricValue: "50k req/s"
    },
    {
      company: "LogicCore",
      logoIcon: <Box className="w-8 h-8" />,
      outcome: "Consolidated five disparate tools into one platform.",
      metricValue: "$120k saved"
    }
  ],
  
  cta = null
}: LogoResultsRowProps = {}) {
  return (
    <section className="w-full py-16 sm:py-24 border-y" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        
        {heading && (
          <h3 
            className="text-center text-sm font-bold uppercase tracking-[0.2em] mb-16"
            style={{ color: muted }}
          >
            {heading}
          </h3>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 lg:gap-y-0">
          {results.map((item, i) => (
            <div key={i} className="flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div style={{ color: ink }}>
                  {item.logoIcon}
                </div>
                <span className="font-extrabold text-lg tracking-tight" style={{ color: ink }}>
                  {item.company}
                </span>
              </div>
              
              <div 
                className="text-2xl sm:text-3xl font-black tracking-tight mb-4"
                style={{ color: accent }}
              >
                {item.metricValue}
              </div>
              
              <p className="text-base font-medium leading-relaxed" style={{ color: muted }}>
                {item.outcome}
              </p>
            </div>
          ))}
        </div>

        {cta && (
          <div className="mt-16 pt-12 border-t text-center" style={{ borderColor: border }}>
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

export default LogoResultsRow;
