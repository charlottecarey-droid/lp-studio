import React from "react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface SplitFeatureProps {
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
  heroImage?: string;
  gridImages?: string[];
  cta?: MockupCTAProps | null;
}

export function SplitFeature({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Global Footprint",
  heading = "Designed for teams without borders",
  subheading = "Our global offices are built to foster connection, creativity, and deep focus. Whether you are in NYC or London, you're part of the same seamless culture.",
  heroImage = "/__mockup/images/gallery-team_5.jpg",
  gridImages = [
    "/__mockup/images/gallery-team_1.jpg",
    "/__mockup/images/gallery-team_2.jpg",
    "/__mockup/images/gallery-team_3.jpg",
    "/__mockup/images/gallery-team_4.jpg"
  ],
  cta = {
    variant: "link",
    primaryLabel: "View open roles",
    secondaryLabel: "Our mission",
    align: "left"
  }
}: SplitFeatureProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          <div className="flex flex-col">
            {eyebrow && (
              <span className="text-sm font-bold uppercase tracking-[0.18em] mb-6 block" style={{ color: accent }}>
                {eyebrow}
              </span>
            )}
            {heading && (
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]" style={{ color: ink }}>
                {heading}
              </h2>
            )}
            {subheading && (
              <p className="text-lg md:text-xl leading-relaxed mb-10" style={{ color: muted }}>
                {subheading}
              </p>
            )}
            {cta && (
              <MockupCTA {...cta} accent={accent} accentText={accentText} surface={surface} ink={ink} muted={muted} border={border} />
            )}
          </div>

          <div className="grid grid-cols-12 grid-rows-12 gap-4 h-[600px] w-full">
            <div className="col-span-8 row-span-12 relative rounded-3xl overflow-hidden shadow-xl">
              <img src={heroImage} alt="Main gallery" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="col-span-4 row-span-6 relative rounded-2xl overflow-hidden shadow-lg flex flex-col gap-4">
              <img src={gridImages[0]} alt="Gallery grid 1" className="w-full h-full object-cover rounded-2xl" />
            </div>
            <div className="col-span-4 row-span-6 relative rounded-2xl overflow-hidden shadow-lg">
              <img src={gridImages[1]} alt="Gallery grid 2" className="w-full h-full object-cover rounded-2xl" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default SplitFeature;