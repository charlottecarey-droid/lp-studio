import React from "react";

export interface FeatureCardItem {
  id?: string;
  title: string;
  description: string;
  image?: string;
}

export interface FeatureCardGridProps {
  eyebrow?: string;
  heading?: string;
  subhead?: string;
  showImages?: boolean;
  /** Corner radius of each card image. Defaults to the brand radius; pass "0px" for square. */
  radius?: string;
  items?: FeatureCardItem[];
}

const HEAD_FONT =
  "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";
const BODY_FONT =
  "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";

const DEFAULT_ITEMS: FeatureCardItem[] = [
  {
    id: "civil",
    title: "Civil and Infrastructure",
    description: "Build resilient infrastructure with total certainty.",
    image: "/__mockup/images/bigfeatures-civil.png",
  },
  {
    id: "commercial",
    title: "Commercial",
    description: "Protect margins across your commercial portfolio.",
    image: "/__mockup/images/bigfeatures-commercial.png",
  },
  {
    id: "data",
    title: "Data Centers",
    description: "Scale mission-critical builds with unified data.",
    image: "/__mockup/images/bigfeatures-datacenter.png",
  },
  {
    id: "government",
    title: "Government",
    description: "Meet rigorous standards with purpose-built tools.",
    image: "/__mockup/images/bigfeatures-government.png",
  },
];

export function FeatureCardGrid({
  eyebrow = "Built for you",
  heading = "We empower teams to build more of what the world needs",
  subhead,
  showImages = true,
  radius = "var(--brand-radius, 16px)",
  items = DEFAULT_ITEMS,
}: FeatureCardGridProps) {
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
              className="mb-3 text-xs font-bold uppercase tracking-widest"
              style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
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

        <div className="mx-auto mt-12 grid grid-cols-1 gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const hasImage = showImages && item.image;
            return (
              <div
                key={item.id || i}
                className="group flex cursor-pointer flex-col transition-all duration-300 ease-out hover:-translate-y-2"
              >
                <div
                  className="mb-5 overflow-hidden transition-shadow duration-300 group-hover:shadow-xl"
                  style={{
                    borderRadius: radius,
                    backgroundColor: "color-mix(in srgb, var(--brand-ink, #0f172a) 8%, var(--brand-surface, #ffffff))",
                  }}
                >
                  {hasImage && (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <h3
                  className="text-lg font-bold tracking-tight"
                  style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-6"
                  style={{ color: "var(--brand-muted, #475569)" }}
                >
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
