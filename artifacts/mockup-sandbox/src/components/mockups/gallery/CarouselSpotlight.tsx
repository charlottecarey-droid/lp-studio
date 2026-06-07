import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface CarouselSpotlightProps {
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
  images?: Array<{ id: string; src: string; caption: string }>;
  cta?: MockupCTAProps | null;
}

export function CarouselSpotlight({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Product Tour",
  heading = "See it in action",
  subheading = "Explore the platform that's powering modern growth teams.",
  images = [
    { id: "1", src: "/__mockup/images/gallery-team_1.jpg", caption: "Dashboard overview" },
    { id: "2", src: "/__mockup/images/gallery-team_2.jpg", caption: "Analytics view" },
    { id: "3", src: "/__mockup/images/gallery-team_3.jpg", caption: "Campaign builder" },
    { id: "4", src: "/__mockup/images/gallery-team_4.jpg", caption: "Team settings" },
  ],
  cta = {
    variant: "modal",
    modalKind: "booking",
    primaryLabel: "Request a demo",
    align: "center"
  }
}: CarouselSpotlightProps = {}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  const handleNext = () => setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));

  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          {eyebrow && (
            <span className="text-sm font-bold uppercase tracking-widest mb-4 block" style={{ color: accent }}>{eyebrow}</span>
          )}
          {heading && (
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6" style={{ color: ink }}>{heading}</h2>
          )}
          {subheading && (
            <p className="text-lg" style={{ color: muted }}>{subheading}</p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl bg-black">
            <img 
              src={images[activeIndex].src} 
              alt={images[activeIndex].caption}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            />
            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white text-xl font-medium">{images[activeIndex].caption}</p>
            </div>
            <button 
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white transition"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white transition"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar justify-center">
            {images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setActiveIndex(idx)}
                className={`relative shrink-0 w-32 aspect-video rounded-xl overflow-hidden transition-all duration-300 snap-center ${activeIndex === idx ? "scale-105" : "opacity-60 hover:opacity-100"}`}
                style={activeIndex === idx ? { boxShadow: `0 0 0 4px ${surface}, 0 0 0 8px ${accent}` } : {}}
              >
                <img src={img.src} alt={img.caption} className="absolute inset-0 w-full h-full object-cover" />
              </button>
            ))}
          </div>
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

export default CarouselSpotlight;