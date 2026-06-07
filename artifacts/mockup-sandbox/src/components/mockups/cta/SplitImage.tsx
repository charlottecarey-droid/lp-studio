import React from "react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface SplitImageProps {
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
  imageSrc?: string;
  
  cta?: MockupCTAProps | null;
}

export function SplitImage({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Unlock potential",
  heading = "Everything you need to launch faster",
  subheading = "Stop building the same components over and over. Get access to a complete library of production-ready UI blocks.",
  imageSrc = "/__mockup/images/cta-split.png",
  cta = {
    variant: "link",
    primaryLabel: "Get started today",
    secondaryLabel: "View documentation",
    align: "left"
  }
}: SplitImageProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          <div className="order-2 lg:order-1 relative aspect-[4/3] lg:aspect-square rounded-3xl overflow-hidden shadow-2xl">
            <img 
              src={imageSrc} 
              alt="Launch faster" 
              className="absolute inset-0 w-full h-full object-cover transform transition-transform duration-700 hover:scale-105" 
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-3xl" />
          </div>
          
          <div className="order-1 lg:order-2 flex flex-col justify-center">
            {eyebrow && (
              <span 
                className="text-sm font-bold uppercase tracking-[0.15em] mb-6 block"
                style={{ color: accent }}
              >
                {eyebrow}
              </span>
            )}
            
            <h2 
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight" 
              style={{ color: ink }}
            >
              {heading}
            </h2>
            
            <p 
              className="text-lg md:text-xl mb-10 leading-relaxed max-w-xl" 
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

        </div>
      </div>
    </section>
  );
}

export default SplitImage;
