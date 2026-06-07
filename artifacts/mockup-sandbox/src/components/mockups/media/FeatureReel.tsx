import React from "react";
import { Play, Sparkles, Zap, Shield } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";
import "./_group.css";

export interface FeatureReelProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;
  
  heading?: string;
  features?: Array<{
    icon: React.ReactNode;
    title: string;
    desc: string;
  }>;
  posterSrc?: string;
  
  cta?: MockupCTAProps | null;
}

export function FeatureReel({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  heading = "Unleash the full potential of your stack",
  features = [
    { icon: <Sparkles className="w-5 h-5" />, title: "AI-Powered", desc: "Automate repetitive tasks with native intelligence." },
    { icon: <Zap className="w-5 h-5" />, title: "Real-time Sync", desc: "Instantly update across all your devices." },
    { icon: <Shield className="w-5 h-5" />, title: "Enterprise Grade", desc: "Bank-level security and compliance built in." },
  ],
  posterSrc = "/__mockup/images/media-poster-main.png",
  cta = {
    variant: "link",
    primaryLabel: "Watch the reel",
    secondaryLabel: "Read the docs",
    align: "center"
  }
}: FeatureReelProps = {}) {
  return (
    <section className="relative w-full py-24 sm:py-32 overflow-hidden" style={{ backgroundColor: bg }}>
      
      {/* Background motion graphics */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl aspect-square pointer-events-none opacity-20 blur-[100px] select-none z-0">
        <div 
          className="absolute top-0 left-1/4 w-1/2 h-1/2 rounded-full animate-media-spin-slow mix-blend-multiply"
          style={{ backgroundColor: accent }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-1/2 h-1/2 rounded-full animate-media-float mix-blend-multiply"
          style={{ backgroundColor: `${accent}80` }}
        />
      </div>

      <div className="container relative z-10 mx-auto px-6 md:px-12 max-w-6xl text-center">
        
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-16 max-w-3xl mx-auto" style={{ color: ink }}>
          {heading}
        </h2>

        {/* Video Card */}
        <div className="relative mx-auto max-w-4xl rounded-[2rem] overflow-hidden shadow-2xl mb-20 group border-4 border-white/20 media-glass-panel" style={{ backgroundColor: surface }}>
          <div className="aspect-video relative w-full overflow-hidden cursor-pointer">
            <img 
              src={posterSrc} 
              alt="Feature Reel" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-md transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${accent}E6`, color: accentText }}
              >
                <Play className="h-8 w-8 sm:h-10 sm:w-10 ml-2" fill="currentColor" />
              </div>
            </div>
            
            {/* Play text hint */}
            <div className="absolute bottom-6 left-0 w-full text-center text-white/90 font-medium text-sm tracking-widest uppercase transition-opacity duration-300 opacity-0 group-hover:opacity-100">
              Click to play
            </div>
          </div>
        </div>

        {/* Feature Captions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
          {features.map((feat, i) => (
            <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl transition-colors hover:bg-black/5" style={{ backgroundColor: `${surface}80` }}>
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${accent}1A`, color: accent }}
              >
                {feat.icon}
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: ink }}>{feat.title}</h3>
              <p className="text-base" style={{ color: muted }}>{feat.desc}</p>
            </div>
          ))}
        </div>

        {cta && (
          <div className="flex justify-center mt-8">
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

export default FeatureReel;
