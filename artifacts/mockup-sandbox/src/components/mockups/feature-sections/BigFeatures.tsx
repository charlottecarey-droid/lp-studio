import React from "react";

export interface BigFeatureItem {
  id?: string;
  title: string;
  description: string;
  image?: string;
  ctaLabel?: string;
  ctaHref?: string;
  note?: string;
}

export interface BigFeaturesProps {
  heading?: string;
  subhead?: string;
  showImages?: boolean;
  /** When true, alternate the image/text sides down the stack. Defaults to false (matches reference). */
  alternate?: boolean;
  /** Corner radius of each large card and its CTA button. Defaults to the brand radius; pass "0px" for square. */
  radius?: string;
  features?: BigFeatureItem[];
}

const HEAD_FONT =
  "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";
const BODY_FONT =
  "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";

const DEFAULT_FEATURES: BigFeatureItem[] = [
  {
    id: "project",
    title: "Project Management",
    description:
      "Easy-to-use, mobile project management software that improves efficiency by connecting field and office for real-time visibility.",
    image: "/__mockup/images/bigcard-project.png",
    ctaLabel: "Request Demo",
    note: "Get started today!",
  },
  {
    id: "quality",
    title: "Quality & Safety",
    description:
      "Standardize inspections, track issues, and keep every team accountable so nothing slips through the cracks on site.",
    image: "/__mockup/images/bigcard-quality.png",
    ctaLabel: "Request Demo",
    note: "Get started today!",
  },
  {
    id: "financials",
    title: "Financial Management",
    description:
      "Manage budgets, contracts, and change orders in one place with a live view of project costs from start to finish.",
    image: "/__mockup/images/bigcard-financials.png",
    ctaLabel: "Request Demo",
    note: "Get started today!",
  },
  {
    id: "field",
    title: "Field Productivity",
    description:
      "Plan schedules, log daily progress, and keep crews aligned with a single source of truth they can update from anywhere.",
    image: "/__mockup/images/bigcard-field.png",
    ctaLabel: "Request Demo",
    note: "Get started today!",
  },
];

export function BigFeatures({
  heading = "Access to the right tools to manage your projects, available on any device.",
  subhead = "Work more efficiently, communicate better, and build faster from a single source of truth.",
  showImages = true,
  alternate = false,
  radius = "var(--brand-radius, 16px)",
  features = DEFAULT_FEATURES,
}: BigFeaturesProps) {
  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        backgroundColor: "var(--brand-surface-2, #f3f2f0)",
        fontFamily: BODY_FONT,
      }}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
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
              className="mx-auto mt-4 max-w-2xl text-lg leading-8"
              style={{ color: "var(--brand-muted, #475569)" }}
            >
              {subhead}
            </p>
          )}
        </div>

        <div className="mt-12 flex flex-col gap-8 sm:mt-16">
          {features.map((feature, i) => {
            const hasImage = showImages && feature.image;
            const imageRight = !alternate || i % 2 === 0;
            return (
              <div
                key={feature.id || i}
                className="grid grid-cols-1 overflow-hidden lg:grid-cols-2"
                style={{
                  borderRadius: radius,
                  backgroundColor: "var(--brand-surface, #ffffff)",
                  boxShadow: "0 10px 40px -16px rgba(0,0,0,0.18)",
                }}
              >
                <div
                  className={`flex flex-col justify-center p-8 sm:p-12 ${
                    imageRight ? "" : "lg:order-2"
                  }`}
                >
                  <h3
                    className="text-2xl font-bold tracking-tight sm:text-3xl"
                    style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="mt-4 text-base leading-7"
                    style={{ color: "var(--brand-muted, #475569)" }}
                  >
                    {feature.description}
                  </p>
                  {feature.ctaLabel && (
                    <div className="mt-7">
                      <a
                        href={feature.ctaHref || "#"}
                        className="inline-flex items-center justify-center px-7 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                        style={{
                          borderRadius: radius,
                          backgroundColor: "var(--brand-primary, #2563eb)",
                          color: "var(--brand-on-primary, #ffffff)",
                          fontFamily: BODY_FONT,
                        }}
                      >
                        {feature.ctaLabel}
                      </a>
                    </div>
                  )}
                  {feature.note && (
                    <a
                      href={feature.ctaHref || "#"}
                      className="mt-4 text-sm font-medium transition-opacity hover:opacity-80"
                      style={{ color: "var(--brand-muted, #475569)", fontFamily: BODY_FONT }}
                    >
                      {feature.note}
                    </a>
                  )}
                </div>

                <div
                  className={`min-h-[280px] ${imageRight ? "lg:order-2" : ""}`}
                  style={{ backgroundColor: "var(--brand-surface, #ffffff)" }}
                >
                  {hasImage && (
                    <img
                      src={feature.image}
                      alt={feature.title}
                      className="h-full min-h-[280px] w-full object-cover"
                    />
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
