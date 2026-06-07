import React from "react";
import { Play } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface LoopingShowcaseProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;
  
  heading?: string;
  subheading?: string;
  videoSrc?: string;
  
  cta?: MockupCTAProps | null;
}

export function LoopingShowcase({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#000000",
  ink = "#ffffff",
  muted = "#94a3b8",
  border = "#334155",
  heading = "Experience the future of digital workflows",
  subheading = "A continuous, uninterrupted environment that adapts to how you work best. Built for scale, designed for speed.",
  videoSrc = "/__mockup/images/hero-cinematic-video-bg.mp4",
  cta = {
    variant: "link",
    primaryLabel: "Watch full film",
    align: "center"
  }
}: LoopingShowcaseProps = {}) {
  return (
    <section className="relative w-full min-h-[600px] sm:min-h-[800px] flex items-center justify-center overflow-hidden" style={{ backgroundColor: bg }}>
      
      {/* Background Video */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={videoSrc} type="video/mp4" />
          <img src="/__mockup/images/media-poster-main.png" alt="Fallback" className="w-full h-full object-cover" />
        </video>
        
        {/* Gradients to blend text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80" />
        
        {/* Subtle accent glow */}
        <div 
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ background: `radial-gradient(circle at center, ${accent} 0%, transparent 60%)` }}
        />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 container mx-auto px-6 md:px-12 flex flex-col items-center justify-center text-center max-w-4xl py-24">
        
        <button 
          aria-label="Play video"
          className="mb-8 w-20 h-20 rounded-full flex items-center justify-center border-2 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/10"
          style={{ borderColor: accentText, color: accentText }}
        >
          <Play className="h-8 w-8 ml-1" fill="currentColor" />
        </button>

        <h2 
          className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6" 
          style={{ color: ink }}
        >
          {heading}
        </h2>
        
        <p className="text-lg sm:text-xl md:text-2xl font-medium mb-10 max-w-2xl" style={{ color: muted }}>
          {subheading}
        </p>

        {cta && (
          <div className="mt-4">
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

export default LoopingShowcase;
