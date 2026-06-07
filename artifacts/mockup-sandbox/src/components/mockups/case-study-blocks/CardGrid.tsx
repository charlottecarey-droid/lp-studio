import React from "react";
import { ArrowRight, Hexagon, Triangle, Circle, Square } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface CardGridProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;

  heading?: string;
  subheading?: string;
  
  cards?: Array<{
    company: string;
    logoIcon: React.ReactNode;
    result: string;
    metricValue: string;
    metricLabel: string;
    linkUrl?: string;
  }>;
  
  cta?: MockupCTAProps | null;
}

export function CardGrid({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#f8fafc",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  
  heading = "Trusted by industry leaders",
  subheading = "See how fast-growing companies are transforming their operations with our platform.",
  
  cards = [
    {
      company: "Stark Industries",
      logoIcon: <Triangle className="w-6 h-6" />,
      result: "Unified disparate engineering data into a single source of truth.",
      metricValue: "85%",
      metricLabel: "Reduction in manual sync tasks"
    },
    {
      company: "Globex Corp",
      logoIcon: <Hexagon className="w-6 h-6" />,
      result: "Accelerated go-to-market motions across global regional teams.",
      metricValue: "2.5x",
      metricLabel: "Faster campaign launches"
    },
    {
      company: "Soylent",
      logoIcon: <Circle className="w-6 h-6" />,
      result: "Optimized supply chain logistics with predictive AI routing.",
      metricValue: "$12M",
      metricLabel: "Annual logistics savings"
    }
  ],
  
  cta = {
    variant: "link",
    primaryLabel: "Explore all customer stories",
    align: "center"
  }
}: CardGridProps = {}) {
  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <h2 
            className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: ink }}
          >
            {heading}
          </h2>
          <p className="text-lg md:text-xl" style={{ color: muted }}>
            {subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {cards.map((card, i) => (
            <div 
              key={i}
              className="flex flex-col h-full p-8 rounded-3xl border shadow-sm transition-shadow hover:shadow-md group"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <div className="flex items-center gap-3 mb-8 pb-8 border-b" style={{ borderColor: border }}>
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accent}15`, color: accent }}
                >
                  {card.logoIcon}
                </div>
                <span className="text-xl font-bold tracking-tight" style={{ color: ink }}>
                  {card.company}
                </span>
              </div>
              
              <div className="flex-grow">
                <p className="text-lg font-medium leading-relaxed mb-10" style={{ color: ink }}>
                  "{card.result}"
                </p>
              </div>
              
              <div className="mb-10">
                <div className="text-4xl font-extrabold tracking-tight mb-2" style={{ color: accent }}>
                  {card.metricValue}
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: muted }}>
                  {card.metricLabel}
                </div>
              </div>
              
              <button 
                type="button"
                className="inline-flex items-center gap-2 font-bold group-hover:gap-3 transition-all"
                style={{ color: accent }}
              >
                View story <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {cta && (
          <div className="flex justify-center">
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

export default CardGrid;
