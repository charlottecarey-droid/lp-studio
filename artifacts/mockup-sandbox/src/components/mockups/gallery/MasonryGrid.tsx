import React from "react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface MasonryGridProps {
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
  
  images?: Array<{ id: string; src: string; alt: string; aspect: string }>;
  cta?: MockupCTAProps | null;
}

export function MasonryGrid({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Our Culture",
  heading = "Inside the studio",
  subheading = "See how our team collaborates, creates, and celebrates everyday wins.",
  images = [
    { id: "1", src: "/__mockup/images/gallery-team_1.jpg", alt: "Team meeting", aspect: "aspect-[4/3]" },
    { id: "2", src: "/__mockup/images/gallery-team_2.jpg", alt: "Workspace", aspect: "aspect-[3/4]" },
    { id: "3", src: "/__mockup/images/gallery-team_3.jpg", alt: "Collaboration", aspect: "aspect-[1/1]" },
    { id: "4", src: "/__mockup/images/gallery-team_4.jpg", alt: "Event", aspect: "aspect-[4/5]" },
    { id: "5", src: "/__mockup/images/gallery-team_5.jpg", alt: "Presentation", aspect: "aspect-[16/9]" },
    { id: "6", src: "/__mockup/images/gallery-team_6.jpg", alt: "Brainstorm", aspect: "aspect-[4/3]" },
  ],
  cta = {
    variant: "link",
    primaryLabel: "Join our team",
    align: "center"
  }
}: MasonryGridProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32 flex flex-col items-center" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          {eyebrow && (
            <span className="text-sm font-bold uppercase tracking-widest mb-4 block" style={{ color: accent }}>
              {eyebrow}
            </span>
          )}
          {heading && (
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6" style={{ color: ink }}>
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-lg" style={{ color: muted }}>
              {subheading}
            </p>
          )}
        </div>
        
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {images.map((img) => (
            <div key={img.id} className={`relative overflow-hidden rounded-2xl break-inside-avoid ${img.aspect} group`}>
              <img 
                src={img.src} 
                alt={img.alt}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          ))}
        </div>

        {cta && (
          <div className="mt-16 flex justify-center">
            <MockupCTA {...cta} accent={accent} accentText={accentText} surface={surface} ink={ink} muted={muted} border={border} />
          </div>
        )}
      </div>
    </section>
  );
}

export default MasonryGrid;