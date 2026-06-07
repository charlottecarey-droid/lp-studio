import React, { useState } from "react";
import { Play, CheckCircle2 } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface VideoSplitProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;
  
  eyebrow?: string;
  heading?: string;
  description?: string;
  features?: string[];
  videoPoster?: string;
  
  cta?: MockupCTAProps | null;
}

export function VideoSplit({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Product Demo",
  heading = "See how our platform works in action",
  description = "Take a quick tour of the core features that help modern teams move faster and build better products. No fluff, just the workflow.",
  features = [
    "Intuitive drag-and-drop interface",
    "Real-time team collaboration",
    "Seamless third-party integrations"
  ],
  videoPoster = "/__mockup/images/media-poster-main.png",
  cta = {
    variant: "modal",
    modalKind: "form",
    heading: "",
    primaryLabel: "Start your free trial",
    align: "left"
  }
}: VideoSplitProps = {}) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="w-full py-24 sm:py-32 overflow-hidden" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          {/* Content Side */}
          <div className="flex flex-col justify-center order-2 lg:order-1">
            {eyebrow && (
              <span 
                className="text-sm font-bold uppercase tracking-[0.18em] mb-6 block"
                style={{ color: accent }}
              >
                {eyebrow}
              </span>
            )}
            
            {heading && (
              <h2 
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6" 
                style={{ color: ink }}
              >
                {heading}
              </h2>
            )}
            
            {description && (
              <p className="text-lg md:text-xl leading-relaxed mb-8" style={{ color: muted }}>
                {description}
              </p>
            )}
            
            {features && features.length > 0 && (
              <ul className="flex flex-col gap-4 mb-10">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 shrink-0 mt-0.5" style={{ color: accent }} />
                    <span className="text-base font-medium" style={{ color: ink }}>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
            
            {cta && (
              <div className="mt-2">
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
          
          {/* Video Side */}
          <div
            role="button"
            tabIndex={0}
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="relative order-1 lg:order-2 w-full aspect-video rounded-3xl overflow-hidden shadow-2xl group cursor-pointer"
            onClick={() => setIsPlaying(!isPlaying)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsPlaying((p) => !p);
              }
            }}
          >
            <img 
              src={videoPoster} 
              alt="Video thumbnail" 
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'group-hover:scale-105'}`} 
            />
            
            {/* Scrim */}
            <div className="absolute inset-0 bg-black/30 transition-opacity duration-300 group-hover:bg-black/40" />
            
            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center backdrop-blur-md shadow-xl transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${accent}E6`, color: accentText }}
              >
                <Play className="h-8 w-8 sm:h-10 sm:w-10 ml-2" fill="currentColor" />
              </div>
            </div>
            
            {/* Faux progress bar if "playing" */}
            {isPlaying && (
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                <div 
                  className="h-full animate-[pulse_4s_ease-in-out_infinite]" 
                  style={{ backgroundColor: accent, width: '35%' }} 
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

export default VideoSplit;
