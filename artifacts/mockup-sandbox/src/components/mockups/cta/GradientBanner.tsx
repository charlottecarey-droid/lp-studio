import React from "react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface GradientBannerProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;
  
  heading?: string;
  subheading?: string;
  
  cta?: MockupCTAProps | null;
}

export function GradientBanner({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  heading = "Ready to transform your workflow?",
  subheading = "Join thousands of teams who are already moving faster.",
  cta = {
    variant: "link",
    primaryLabel: "Start for free",
    secondaryLabel: "Talk to sales",
    align: "center"
  }
}: GradientBannerProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32 px-6" style={{ backgroundColor: bg }}>
      <div className="container mx-auto max-w-5xl">
        <div 
          className="rounded-[2.5rem] p-12 md:p-24 text-center relative overflow-hidden shadow-2xl"
          style={{ 
            background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
            color: accentText 
          }}
        >
          <div className="absolute inset-0 bg-black/5 mix-blend-overlay" />
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl leading-tight">
              {heading}
            </h2>
            <p className="text-lg md:text-xl opacity-90 mb-12 max-w-2xl leading-relaxed">
              {subheading}
            </p>
            {cta && (
              <MockupCTA 
                {...cta} 
                accent={accentText} 
                accentText={accent} 
                surface={surface} 
                ink={accentText} 
                muted={`${accentText}cc`} 
                border={`${accentText}33`} 
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default GradientBanner;
