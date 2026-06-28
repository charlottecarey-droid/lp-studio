import React from "react";
import { ArrowRight, Headphones, GraduationCap, Globe, LucideIcon } from "lucide-react";

export interface OutlinedCard {
  id?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  ctaHref?: string;
}

export interface OutlinedCardsProps {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  headerCtaLabel?: string;
  headerCtaHref?: string;
  showHeaderCta?: boolean;
  ctaLabel?: string;
  showCta?: boolean;
  /** Corner radius of each card. Defaults to the brand radius; pass "0px" for square. */
  radius?: string;
  cards?: OutlinedCard[];
}

const HEAD_FONT =
  "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";
const BODY_FONT =
  "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";

const DEFAULT_CARDS: OutlinedCard[] = [
  {
    id: "support",
    title: "Real-time support",
    description:
      "Get immediate answers from industry experts, any time of day.",
    icon: Headphones,
  },
  {
    id: "training",
    title: "On-demand training",
    description:
      "Master the platform with courses designed for your specific role.",
    icon: GraduationCap,
  },
  {
    id: "community",
    title: "Peer community",
    description:
      "Connect with professionals around the world to get the most out of your experience.",
    icon: Globe,
  },
];

export function OutlinedCards({
  eyebrow = "Trusted Partners",
  heading = "Let's build better — together",
  intro = "We know it takes more than tools; it takes people working toward the same goals. That's why our partnership goes beyond software.",
  headerCtaLabel = "Learn more",
  headerCtaHref,
  showHeaderCta = true,
  ctaLabel = "Learn more",
  showCta = true,
  radius = "var(--brand-radius, 16px)",
  cards = DEFAULT_CARDS,
}: OutlinedCardsProps) {
  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        backgroundColor: "var(--brand-surface-2, #f7f6f3)",
        fontFamily: BODY_FONT,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow && (
            <p
              className="mb-4 text-xs font-bold uppercase tracking-widest"
              style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
            >
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2
              className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
              style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
            >
              {heading}
            </h2>
          )}
          {intro && (
            <p
              className="mx-auto mt-5 max-w-2xl text-lg leading-8"
              style={{ color: "var(--brand-muted, #475569)" }}
            >
              {intro}
            </p>
          )}
          {showHeaderCta && headerCtaLabel && (
            <div className="mt-6">
              <a
                href={headerCtaHref || "#"}
                className="inline-flex items-center text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: "var(--brand-primary, #2563eb)", fontFamily: BODY_FONT }}
              >
                {headerCtaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          )}
        </div>

        <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-6 sm:mt-16 md:grid-cols-3 lg:max-w-none">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id || i}
                className="flex flex-col p-8 transition-all duration-300 hover:-translate-y-1"
                style={{
                  borderRadius: radius,
                  backgroundColor: "transparent",
                  border:
                    "1px solid color-mix(in srgb, var(--brand-ink, #0f172a) 14%, transparent)",
                }}
              >
                {Icon && (
                  <div className="mb-5" style={{ color: "var(--brand-primary, #2563eb)" }}>
                    <Icon className="h-9 w-9" aria-hidden="true" />
                  </div>
                )}
                <h3
                  className="text-xl font-bold tracking-tight"
                  style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
                >
                  {card.title}
                </h3>
                <p
                  className="mt-3 flex-1 text-base leading-7"
                  style={{ color: "var(--brand-muted, #475569)" }}
                >
                  {card.description}
                </p>
                {showCta && ctaLabel && (
                  <div className="mt-6">
                    <a
                      href={card.ctaHref || "#"}
                      className="inline-flex items-center text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{ color: "var(--brand-primary, #2563eb)", fontFamily: BODY_FONT }}
                    >
                      {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
