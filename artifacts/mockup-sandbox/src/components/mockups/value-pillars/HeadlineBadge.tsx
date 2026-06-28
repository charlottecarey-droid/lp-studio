import React from "react";
import { Zap, BarChart3, ShieldCheck, LucideIcon } from "lucide-react";

export interface Pillar {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  image?: string;
  alt?: string;
  brandColorVar?: string;
}

export interface HeadlineBadgeProps {
  eyebrow?: string;
  heading?: string;
  subhead?: string;
  pillars?: Pillar[];
  showImages?: boolean;
}

const DEFAULT_PILLARS: Pillar[] = [
  {
    id: "setup",
    title: "Effortless setup",
    description: "Get started and ship in minutes. Bypass the complex engineering overhead and integrate seamlessly with your existing toolchain.",
    icon: Zap,
    image: "/__mockup/images/headlinebox-setup.png",
    alt: "Abstract visualization of seamless integration and setup",
    brandColorVar: "--brand-primary",
  },
  {
    id: "clarity",
    title: "Clarity at a glance",
    description: "Transform raw data into real-time insights. Our analytics are designed to be instantly readable, giving you the truth without the noise.",
    icon: BarChart3,
    image: "/__mockup/images/headlinebox-clarity.png",
    alt: "Abstract visualization of crystal clear data analytics",
    brandColorVar: "--brand-secondary",
  },
  {
    id: "reliability",
    title: "Reliability that scales",
    description: "Enterprise-grade dependability from day one. Built on a fault-tolerant architecture that scales effortlessly as your team grows.",
    icon: ShieldCheck,
    image: "/__mockup/images/headlinebox-reliability.png",
    alt: "Abstract visualization of robust enterprise architecture",
    brandColorVar: "--brand-accent",
  }
];

export function HeadlineBadge({
  eyebrow = "The Platform Advantage",
  heading = "Built for teams that demand excellence",
  subhead = "Experience a platform where every detail is optimized for speed, precision, and unbreakable performance.",
  pillars = DEFAULT_PILLARS,
  showImages = true,
}: HeadlineBadgeProps) {
  
  // Fallbacks corresponding to the old hardcoded tailwind classes roughly
  const getFallbackColor = (colorVar?: string) => {
    if (colorVar === "--brand-primary") return "#2563eb";
    if (colorVar === "--brand-secondary") return "#059669";
    if (colorVar === "--brand-accent") return "#7c3aed";
    return "#2563eb";
  };

  return (
    <section 
      className="py-16 relative overflow-hidden"
      style={{
        backgroundColor: "var(--brand-surface-2, #f8fafc)",
        fontFamily: "var(--brand-font-body, system-ui, sans-serif)",
      }}
    >
      {/* Subtle background decoration */}
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--brand-muted, #cbd5e1), transparent)" }} />
      <div 
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none" 
        style={{ backgroundColor: "var(--brand-primary, #2563eb)" }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          {eyebrow && (
            <p 
              className="text-xs md:text-sm font-bold tracking-widest uppercase mb-3"
              style={{ color: "var(--brand-primary, #4f46e5)" }}
            >
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 
              className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
              style={{ 
                color: "var(--brand-ink, #0f172a)",
                fontFamily: "var(--brand-font-heading, system-ui, sans-serif)"
              }}
            >
              {heading}
            </h2>
          )}
          {subhead && (
            <p 
              className="text-base md:text-lg"
              style={{ color: "var(--brand-muted, #475569)" }}
            >
              {subhead}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const hasImage = showImages && pillar.image;
            const colorVarStr = pillar.brandColorVar || "--brand-primary";
            const fallbackColorStr = getFallbackColor(pillar.brandColorVar);
            
            return (
              <div 
                key={pillar.id} 
                className="flex flex-col rounded-2xl shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                style={{ 
                  backgroundColor: "var(--brand-surface, #ffffff)",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)"
                }}
              >
                {hasImage && (
                  <div className="relative h-40 w-full rounded-t-2xl overflow-hidden bg-zinc-100/50 shrink-0">
                    <img 
                      src={pillar.image} 
                      alt={pillar.alt || ""}
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  </div>
                )}
                
                {/* The Signature Colored Box */}
                <div 
                  className={`p-4 flex items-center gap-3 relative overflow-hidden shrink-0 ${!hasImage ? 'rounded-t-2xl' : ''}`}
                  style={{
                    backgroundColor: `var(${colorVarStr}, ${fallbackColorStr})`
                  }}
                >
                  <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none" />
                  {Icon && <Icon className="w-5 h-5 text-white/90 relative z-10 shrink-0" />}
                  <h3 
                    className="text-lg md:text-xl font-bold text-white tracking-tight relative z-10"
                    style={{ fontFamily: "var(--brand-font-heading, system-ui, sans-serif)" }}
                  >
                    {pillar.title}
                  </h3>
                </div>

                <div className="p-6 md:p-8 rounded-b-2xl border border-t-0 flex-1 flex flex-col" style={{ borderColor: "color-mix(in srgb, var(--brand-ink, #0f172a) 10%, transparent)" }}>
                  <p 
                    className="leading-relaxed text-sm md:text-base"
                    style={{ color: "var(--brand-muted, #475569)" }}
                  >
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
