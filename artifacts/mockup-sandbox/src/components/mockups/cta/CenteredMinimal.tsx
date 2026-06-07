import React from "react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface CenteredMinimalProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;
  
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  
  cta?: MockupCTAProps | null;
}

export function CenteredMinimal({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Ready to start?",
  heading = "Build your next great idea.",
  subheading = "Join thousands of developers building scalable, high-performance applications with our tools.",
  cta = {
    variant: "link",
    primaryLabel: "Start building for free",
    secondaryLabel: "Contact sales",
    align: "center"
  }
}: CenteredMinimalProps = {}) {
  return (
    <section className="w-full py-32 sm:py-48 px-6" style={{ backgroundColor: bg }}>
      <div 
        className="container mx-auto max-w-4xl rounded-[3rem] p-12 sm:p-24 text-center shadow-sm border border-black/5"
        style={{ backgroundColor: surface, borderColor: border }}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          {eyebrow && (
            <span 
              className="text-sm font-bold uppercase tracking-[0.2em] mb-8 block"
              style={{ color: accent }}
            >
              {eyebrow}
            </span>
          )}
          
          <h2 
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8 leading-tight" 
            style={{ color: ink }}
          >
            {heading}
          </h2>
          
          <p 
            className="text-lg md:text-xl mb-12 leading-relaxed" 
            style={{ color: muted }}
          >
            {subheading}
          </p>
          
          {cta && (
            <div className="w-full flex justify-center">
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
      </div>
    </section>
  );
}

export default CenteredMinimal;
