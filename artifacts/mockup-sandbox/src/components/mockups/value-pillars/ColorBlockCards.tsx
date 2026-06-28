import React from "react";
import { ArrowRight, Zap, BarChart3, ShieldCheck, LucideIcon } from "lucide-react";

export interface ColorBlockCardsProps {
  eyebrow?: string;
  heading?: string;
  subhead?: string;
  showImages?: boolean;
  showCta?: boolean;
  ctaLabel?: string;
  pillars?: Array<{
    id?: string;
    title: string;
    description: string;
    icon?: LucideIcon;
    image?: string;
    brandVar?: string;
    fallbackColor?: string;
    ctaHref?: string;
  }>;
}

export function ColorBlockCards({
  eyebrow = "Core Values",
  heading = "Everything you need. Nothing you don't.",
  subhead = "A platform engineered to stay out of your way while delivering the power and performance your team demands.",
  showImages = true,
  showCta = true,
  ctaLabel = "Learn more",
  pillars = [
    {
      id: "setup",
      title: "Effortless setup",
      description: "Get started and ship in minutes. Zero engineering required to integrate into your existing workflow.",
      icon: Zap,
      image: "/__mockup/images/colorblock-setup.png",
      brandVar: "--brand-primary",
      fallbackColor: "#2563eb", // blue-600
    },
    {
      id: "clarity",
      title: "Clarity at a glance",
      description: "Real-time insight and analytics that are actually easy to read, bringing your key metrics into focus.",
      icon: BarChart3,
      image: "/__mockup/images/colorblock-clarity.png",
      brandVar: "--brand-secondary",
      fallbackColor: "#9333ea", // purple-600
    },
    {
      id: "reliability",
      title: "Reliability that scales",
      description: "Enterprise-grade dependability from day one. Build with confidence knowing our infrastructure grows with you.",
      icon: ShieldCheck,
      image: "/__mockup/images/colorblock-reliability.png",
      brandVar: "--brand-accent",
      fallbackColor: "#e11d48", // rose-600
    },
  ],
}: ColorBlockCardsProps) {
  return (
    <section 
      className="w-full py-16 sm:py-24"
      style={{ backgroundColor: "var(--brand-surface, #ffffff)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow && (
            <h2 
              className="text-sm font-bold tracking-widest uppercase mb-3"
              style={{ 
                color: "var(--brand-primary, #2563eb)",
                fontFamily: "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)"
              }}
            >
              {eyebrow}
            </h2>
          )}
          {heading && (
            <p 
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ 
                color: "var(--brand-ink, #0f172a)",
                fontFamily: "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)"
              }}
            >
              {heading}
            </p>
          )}
          {subhead && (
            <p 
              className="mt-4 text-lg leading-8"
              style={{ 
                color: "var(--brand-muted, #475569)",
                fontFamily: "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)"
              }}
            >
              {subhead}
            </p>
          )}
        </div>

        <div className="mx-auto mt-12 max-w-2xl sm:mt-16 lg:max-w-none">
          <div className="grid max-w-xl grid-cols-1 gap-6 lg:max-w-none md:grid-cols-3">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              const hasImage = showImages && pillar.image;
              const bVar = pillar.brandVar || "--brand-primary";
              const fColor = pillar.fallbackColor || "#2563eb";
              
              return (
                <div
                  key={pillar.id || i}
                  className="flex flex-col overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(${bVar}, ${fColor}) 8%, var(--brand-surface, #ffffff))`
                  }}
                >
                  {hasImage && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                      <img
                        src={pillar.image}
                        alt={pillar.title}
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                    </div>
                  )}
                  
                  <div className={`flex flex-1 flex-col justify-between p-6 sm:p-8 ${!hasImage ? 'pt-8' : ''}`}>
                    <div>
                      {Icon && (
                        <div 
                          className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-6 shadow-sm"
                          style={{
                            backgroundColor: `var(--brand-surface, #ffffff)`,
                            color: `var(${bVar}, ${fColor})`
                          }}
                        >
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </div>
                      )}
                      <h3 
                        className="text-xl font-bold leading-8 tracking-tight"
                        style={{ 
                          color: `color-mix(in srgb, var(${bVar}, ${fColor}) 90%, black)`,
                          fontFamily: "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)"
                        }}
                      >
                        {pillar.title}
                      </h3>
                      <p 
                        className="mt-3 text-base leading-7"
                        style={{ 
                          color: `color-mix(in srgb, var(${bVar}, ${fColor}) 70%, black)`,
                          fontFamily: "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)"
                        }}
                      >
                        {pillar.description}
                      </p>
                    </div>
                    {showCta && ctaLabel && (
                      <div className="mt-8">
                        <a
                          href={pillar.ctaHref || "#"}
                          className="inline-flex items-center text-sm font-semibold hover:opacity-80 transition-opacity"
                          style={{ 
                            color: `var(${bVar}, ${fColor})`,
                            fontFamily: "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)"
                          }}
                        >
                          {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
