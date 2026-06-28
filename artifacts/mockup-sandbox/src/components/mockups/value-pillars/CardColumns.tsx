import React from 'react';
import { Settings, BarChart2, Shield, ArrowRight, LucideIcon } from 'lucide-react';

export interface CardColumnsPillar {
  title: string;
  description: string;
  icon?: LucideIcon;
  image?: string;
  ctaHref?: string;
}

export interface CardColumnsProps {
  eyebrow?: string;
  heading?: React.ReactNode;
  subhead?: string;
  pillars?: CardColumnsPillar[];
  showImages?: boolean; // Included for interface compliance; this variant is image-free
  showCta?: boolean;
  ctaLabel?: string;
}

const DEFAULT_PILLARS: CardColumnsPillar[] = [
  {
    title: 'Effortless setup',
    description: 'Get started and ship in minutes, no engineering required. Connect your data sources instantly and see value on day one.',
    icon: Settings,
  },
  {
    title: 'Clarity at a glance',
    description: 'Real-time insight and analytics that are actually easy to read. Turn complex datasets into clear, actionable narratives.',
    icon: BarChart2,
  },
  {
    title: 'Reliability that scales',
    description: 'Enterprise-grade dependability from day one. As your team grows, our infrastructure seamlessly handles the increased load.',
    icon: Shield,
  },
];

export function CardColumns({
  eyebrow = 'Platform Capabilities',
  heading = (
    <>
      Designed for velocity.
      <br className="hidden md:block" /> Built for scale.
    </>
  ),
  subhead = "Everything you need to orchestrate your team's workflow, without the complexity that usually comes with it.",
  pillars = DEFAULT_PILLARS,
  showCta = true,
  ctaLabel = 'Learn more',
}: CardColumnsProps) {
  return (
    <section
      className="w-full py-16 md:py-20 px-6 md:px-12 lg:px-24"
      style={{
        backgroundColor: 'var(--brand-surface, #ffffff)',
        fontFamily: 'var(--brand-font-body, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 md:mb-16 max-w-3xl text-center mx-auto">
          {eyebrow && (
            <span
              className="inline-block mb-4 text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: 'var(--brand-accent, #B24B36)' }}
            >
              {eyebrow}
            </span>
          )}
          {heading && (
            <h2
              className="mb-4 text-3xl md:text-4xl lg:text-5xl tracking-tight leading-tight"
              style={{
                fontFamily: 'var(--brand-font-heading, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif)',
                color: 'var(--brand-ink, #0f172a)',
              }}
            >
              {heading}
            </h2>
          )}
          {subhead && (
            <p
              className="text-base md:text-lg font-light max-w-2xl mx-auto leading-relaxed"
              style={{ color: 'var(--brand-muted, #475569)' }}
            >
              {subhead}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="group flex flex-col rounded-2xl p-8 border transition-all duration-500 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--brand-ink, #0f172a) 5%, var(--brand-surface, #ffffff))',
                  borderColor: 'color-mix(in srgb, var(--brand-ink, #0f172a) 8%, transparent)',
                }}
              >
                {Icon && (
                  <div
                    className="mb-6 inline-flex items-center justify-center p-3 shadow-sm border rounded-xl transition-all duration-500"
                    style={{
                      backgroundColor: 'var(--brand-surface, #ffffff)',
                      borderColor: 'color-mix(in srgb, var(--brand-ink, #0f172a) 10%, transparent)',
                      color: 'var(--brand-accent, #B24B36)',
                    }}
                  >
                    <Icon className="w-6 h-6 icon-hover-target" strokeWidth={1.5} />
                  </div>
                )}

                <h3
                  className="mb-3 text-xl tracking-tight"
                  style={{
                    fontFamily: 'var(--brand-font-heading, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif)',
                    color: 'var(--brand-ink, #0f172a)',
                  }}
                >
                  {pillar.title}
                </h3>

                <p
                  className="leading-relaxed font-light text-sm md:text-base"
                  style={{ color: 'var(--brand-muted, #475569)' }}
                >
                  {pillar.description}
                </p>

                {showCta && ctaLabel && (
                  <a
                    href={pillar.ctaHref || '#'}
                    className="pillar-cta mt-auto pt-6 inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-300 w-fit"
                    style={{ color: 'var(--brand-accent, #B24B36)' }}
                  >
                    <span
                      className="pillar-cta-pill inline-flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-300"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--brand-accent, #B24B36) 12%, var(--brand-surface, #ffffff))',
                      }}
                    >
                      {ctaLabel}
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .group:hover .icon-hover-target {
          color: var(--brand-surface, #ffffff);
        }
        .group:hover > div:first-child {
          background-color: var(--brand-accent, #B24B36) !important;
          border-color: var(--brand-accent, #B24B36) !important;
        }
        .pillar-cta:hover .pillar-cta-pill {
          background-color: color-mix(in srgb, var(--brand-accent, #B24B36) 22%, var(--brand-surface, #ffffff));
        }
      `}</style>
    </section>
  );
}
