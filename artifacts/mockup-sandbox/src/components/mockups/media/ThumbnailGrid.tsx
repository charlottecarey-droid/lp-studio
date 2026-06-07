import React from "react";
import { Play } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface ThumbnailGridProps {
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
  
  videos?: Array<{
    id: string;
    title: string;
    duration: string;
    image: string;
  }>;
  
  cta?: MockupCTAProps | null;
}

export function ThumbnailGrid({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#f8fafc",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Video Library",
  heading = "Master the platform",
  subheading = "Watch quick tutorials and deep dives from our product team.",
  videos = [
    {
      id: "1",
      title: "Getting started with core workflows",
      duration: "4:12",
      image: "/__mockup/images/media-thumb-1.png"
    },
    {
      id: "2",
      title: "Advanced data analytics and reporting",
      duration: "12:05",
      image: "/__mockup/images/media-thumb-2.png"
    },
    {
      id: "3",
      title: "Managing team permissions safely",
      duration: "7:30",
      image: "/__mockup/images/media-thumb-3.png"
    }
  ],
  cta = {
    variant: "link",
    primaryLabel: "Browse all videos",
    align: "left"
  }
}: ThumbnailGridProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div className="max-w-2xl">
            {eyebrow && (
              <span 
                className="text-sm font-bold uppercase tracking-[0.18em] mb-4 block"
                style={{ color: accent }}
              >
                {eyebrow}
              </span>
            )}
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4" style={{ color: ink }}>
              {heading}
            </h2>
            <p className="text-lg" style={{ color: muted }}>
              {subheading}
            </p>
          </div>
          
          {cta && (
            <div className="shrink-0 hidden md:block">
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

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {videos.map((vid) => (
            <div key={vid.id} className="group cursor-pointer flex flex-col">
              <div 
                className="relative w-full aspect-video rounded-2xl overflow-hidden mb-5 border shadow-sm"
                style={{ borderColor: border, backgroundColor: surface }}
              >
                <img 
                  src={vid.image} 
                  alt={vid.title} 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-black/20 transition-colors duration-300 group-hover:bg-black/30" />
                
                {/* Duration Badge */}
                <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-semibold backdrop-blur-sm">
                  {vid.duration}
                </div>
                
                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-90 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: accent, color: accentText }}
                  >
                    <Play className="h-6 w-6 ml-1" fill="currentColor" />
                  </div>
                </div>
              </div>
              
              <h3 className="text-xl font-semibold leading-snug transition-colors duration-200 group-hover:opacity-80" style={{ color: ink }}>
                {vid.title}
              </h3>
            </div>
          ))}
        </div>
        
        {/* Mobile CTA */}
        {cta && (
          <div className="mt-12 md:hidden block">
            <MockupCTA
              {...cta}
              align="center"
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

export default ThumbnailGrid;
