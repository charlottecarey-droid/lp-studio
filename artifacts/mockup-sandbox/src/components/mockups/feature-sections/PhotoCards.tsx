import React from "react";
import { ArrowRight } from "lucide-react";

export interface PhotoCard {
  id?: string;
  title: string;
  description: string;
  image?: string;
  ctaHref?: string;
}

export interface PhotoCardsProps {
  eyebrow?: string;
  heading?: string;
  subhead?: string;
  ctaLabel?: string;
  showCta?: boolean;
  showImages?: boolean;
  /** Corner radius of the photo cards and caption boxes. Defaults to the brand radius; pass "0px" for square. */
  radius?: string;
  cards?: PhotoCard[];
}

const HEAD_FONT =
  "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";
const BODY_FONT =
  "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";

const DEFAULT_CARDS: PhotoCard[] = [
  {
    id: "general",
    title: "General Contractors",
    description: "Keep projects within budget from the palm of your hand.",
    image: "/__mockup/images/gallery-team_1.jpg",
  },
  {
    id: "owners",
    title: "Owners",
    description: "Improve return with visibility into every step of the process.",
    image: "/__mockup/images/gallery-team_2.jpg",
  },
  {
    id: "specialty",
    title: "Specialty Contractors",
    description: "Connect your teams from field to office in real time.",
    image: "/__mockup/images/gallery-team_3.jpg",
  },
];

export function PhotoCards({
  eyebrow,
  heading = "The #1 end-to-end construction management solution",
  subhead,
  ctaLabel = "Learn more",
  showCta = true,
  showImages = true,
  radius = "var(--brand-radius, 16px)",
  cards = DEFAULT_CARDS,
}: PhotoCardsProps) {
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
              className="mb-3 text-sm font-bold uppercase tracking-widest"
              style={{ color: "var(--brand-primary, #2563eb)", fontFamily: HEAD_FONT }}
            >
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
            >
              {heading}
            </h2>
          )}
          {subhead && (
            <p
              className="mt-4 text-lg leading-8"
              style={{ color: "var(--brand-muted, #475569)" }}
            >
              {subhead}
            </p>
          )}
        </div>

        <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-6 sm:mt-16 md:grid-cols-3 lg:max-w-none">
          {cards.map((card, i) => {
            const hasImage = showImages && card.image;
            return (
              <div
                key={card.id || i}
                className="group relative overflow-hidden"
                style={{ borderRadius: radius }}
              >
                <div
                  className="aspect-[3/4] w-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--brand-ink, #0f172a) 8%, var(--brand-surface, #ffffff))" }}
                >
                  {hasImage && (
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                </div>

                <div
                  className="absolute bottom-4 left-4 right-10 p-5 sm:p-6"
                  style={{
                    borderRadius: radius,
                    backgroundColor: "var(--brand-surface, #ffffff)",
                    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.25)",
                  }}
                >
                  <h3
                    className="text-lg font-bold tracking-tight sm:text-xl"
                    style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-6"
                    style={{ color: "var(--brand-muted, #475569)" }}
                  >
                    {card.description}
                  </p>
                  {showCta && ctaLabel && (
                    <a
                      href={card.ctaHref || "#"}
                      className="mt-3 inline-flex items-center text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{ color: "var(--brand-primary, #2563eb)", fontFamily: BODY_FONT }}
                    >
                      {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
