import React from "react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface FilmstripScrollProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;

  heading?: string;
  images?: Array<{ id: string; src: string; caption: string }>;

  cta?: MockupCTAProps | null;
}

export function FilmstripScroll({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  heading = "Highlights from our recent retreat",
  images = [
    { id: "1", src: "/__mockup/images/gallery-team_1.jpg", caption: "Keynote presentation" },
    { id: "2", src: "/__mockup/images/gallery-team_2.jpg", caption: "Workshop session" },
    { id: "3", src: "/__mockup/images/gallery-team_3.jpg", caption: "Team dinner" },
    { id: "4", src: "/__mockup/images/gallery-team_4.jpg", caption: "Award ceremony" },
    { id: "5", src: "/__mockup/images/gallery-team_5.jpg", caption: "Morning hike" },
    { id: "6", src: "/__mockup/images/gallery-team_6.jpg", caption: "Closing remarks" },
  ],
  cta = {
    variant: "link",
    primaryLabel: "View the full album",
    align: "left"
  }
}: FilmstripScrollProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32 overflow-hidden" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 max-w-7xl mb-12 flex justify-between items-end">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: ink }}>
          {heading}
        </h2>
        {cta && (
          <div className="hidden md:block shrink-0">
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

      <div className="w-full overflow-x-auto pb-8 hide-scrollbar cursor-grab active:cursor-grabbing snap-x snap-mandatory">
        <div className="flex gap-6 px-6 md:px-12 w-max">
          {images.map((img) => (
            <div key={img.id} className="relative w-[300px] sm:w-[400px] md:w-[500px] aspect-[4/3] rounded-3xl overflow-hidden shrink-0 snap-center shadow-xl group">
              <img 
                src={img.src} 
                alt={img.caption} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="text-white text-lg font-medium tracking-wide">
                  {img.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FilmstripScroll;