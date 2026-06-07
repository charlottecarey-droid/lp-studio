import React from "react";
import { ArrowRight, BarChart3, Target, Zap } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface SpotlightFeatureProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;

  company?: string;
  logoIcon?: React.ReactNode;
  eyebrow?: string;
  headline?: string;
  challenge?: string;
  solution?: string;
  result?: string;
  
  metricValue?: string;
  metricLabel?: string;
  
  imageSrc?: string;
  
  cta?: MockupCTAProps | null;
}

export function SpotlightFeature({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  
  company = "Nexus Data",
  logoIcon = <Zap className="w-6 h-6" />,
  eyebrow = "Featured Case Study",
  headline = "How Nexus Data increased pipeline velocity by 300%",
  challenge = "Nexus Data's marketing team was blocked by a slow, engineering-led web update process, taking weeks to launch a single campaign.",
  solution = "By switching to LP Studio, the marketing team gained full autonomy to build, test, and optimize landing pages without writing code.",
  result = "They now launch 15+ campaigns per week, testing messaging instantly and significantly scaling their inbound pipeline.",
  
  metricValue = "300%",
  metricLabel = "Increase in campaign launch velocity",
  
  imageSrc = "/__mockup/images/csb-spotlight-hero.png",
  
  cta = {
    variant: "link",
    primaryLabel: "Read the case study",
    align: "left"
  }
}: SpotlightFeatureProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        
        {eyebrow && (
          <div className="mb-12">
            <span 
              className="text-sm font-bold uppercase tracking-wider block"
              style={{ color: accent }}
            >
              {eyebrow}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content Side */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accent}1a`, color: accent }}
              >
                {logoIcon}
              </div>
              <span className="text-xl font-bold" style={{ color: ink }}>
                {company}
              </span>
            </div>

            <h2 
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-8 leading-tight"
              style={{ color: ink }}
            >
              {headline}
            </h2>

            <div className="space-y-6 mb-10 text-lg leading-relaxed" style={{ color: muted }}>
              <div>
                <strong className="block mb-1 font-semibold uppercase tracking-wider text-xs" style={{ color: ink }}>The Challenge</strong>
                <p>{challenge}</p>
              </div>
              <div>
                <strong className="block mb-1 font-semibold uppercase tracking-wider text-xs" style={{ color: ink }}>The Solution</strong>
                <p>{solution}</p>
              </div>
              <div>
                <strong className="block mb-1 font-semibold uppercase tracking-wider text-xs" style={{ color: ink }}>The Result</strong>
                <p>{result}</p>
              </div>
            </div>

            <div 
              className="p-6 rounded-2xl mb-10 border"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accent}1a`, color: accent }}
                >
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-3xl font-bold tracking-tight mb-1" style={{ color: ink }}>
                    {metricValue}
                  </div>
                  <div className="text-sm font-medium" style={{ color: muted }}>
                    {metricLabel}
                  </div>
                </div>
              </div>
            </div>

            {cta && (
              <MockupCTA
                {...cta}
                accent={accent}
                accentText={accentText}
                surface={surface}
                ink={ink}
                muted={muted}
                border={border}
              />
            )}
          </div>

          {/* Image Side */}
          <div className="relative">
            <div 
              className="absolute -inset-4 rounded-3xl opacity-50 blur-2xl transform rotate-3"
              style={{ backgroundColor: accent }}
            />
            <div 
              className="relative aspect-[4/3] rounded-2xl overflow-hidden border shadow-xl"
              style={{ borderColor: border, backgroundColor: surface }}
            >
              <img 
                src={imageSrc} 
                alt={`${company} team working`} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2850&q=80";
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SpotlightFeature;
