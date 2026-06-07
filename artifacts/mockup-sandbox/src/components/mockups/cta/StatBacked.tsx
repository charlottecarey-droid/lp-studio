import React from "react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface StatBackedProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;
  
  heading?: string;
  subheading?: string;
  
  stats?: Array<{ value: string; label: string }>;
  
  cta?: MockupCTAProps | null;
}

export function StatBacked({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  heading = "Join the industry leaders",
  subheading = "Our platform handles billions of requests daily for the world's most demanding teams. See what we can do for yours.",
  stats = [
    { value: "99.99%", label: "Uptime SLA" },
    { value: "10x", label: "Faster deployments" },
    { value: "24/7", label: "Expert support" }
  ],
  cta = {
    variant: "link",
    primaryLabel: "Get a demo",
    align: "left"
  }
}: StatBackedProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start lg:items-center">
          
          <div className="lg:w-1/2">
            <h2 
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8 leading-tight" 
              style={{ color: ink }}
            >
              {heading}
            </h2>
            <p 
              className="text-lg md:text-xl mb-12 leading-relaxed max-w-lg" 
              style={{ color: muted }}
            >
              {subheading}
            </p>
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
          
          <div className="lg:w-1/2 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
              {stats.map((stat, i) => (
                <div 
                  key={i} 
                  className="flex flex-col gap-2 p-8 md:p-10 rounded-3xl border shadow-sm"
                  style={{ backgroundColor: surface, borderColor: border }}
                >
                  <span 
                    className="text-5xl md:text-6xl font-black tracking-tight" 
                    style={{ color: accent }}
                  >
                    {stat.value}
                  </span>
                  <span 
                    className="text-sm md:text-base font-bold uppercase tracking-[0.15em]" 
                    style={{ color: muted }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}

export default StatBacked;
