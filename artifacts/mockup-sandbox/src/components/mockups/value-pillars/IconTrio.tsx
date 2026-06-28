import React from "react";
import { Building2, HardHat, Wrench, LucideIcon } from "lucide-react";

export interface IconTrioItem {
  id?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}

export interface IconTrioProps {
  eyebrow?: string;
  heading?: string;
  subhead?: string;
  /** Corner radius of the icon tile. Defaults to the brand radius; pass "0px" for square. */
  radius?: string;
  items?: IconTrioItem[];
}

const HEAD_FONT =
  "var(--brand-font-heading, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";
const BODY_FONT =
  "var(--brand-font-body, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif)";

const DEFAULT_ITEMS: IconTrioItem[] = [
  {
    id: "owners",
    title: "Owners",
    description:
      "Take control of your projects with visibility into every step of the process.",
    icon: Building2,
  },
  {
    id: "general",
    title: "General Contractors",
    description:
      "Deliver projects on time and on budget by managing everything from the palm of your hand.",
    icon: HardHat,
  },
  {
    id: "specialty",
    title: "Specialty Contractors",
    description:
      "Connect your teams from field to office in real time to deliver quality work.",
    icon: Wrench,
  },
];

export function IconTrio({
  eyebrow,
  heading = "3M+ projects. 160+ countries.",
  subhead = "See how every stakeholder builds better on one connected platform.",
  radius = "var(--brand-radius, 16px)",
  items = DEFAULT_ITEMS,
}: IconTrioProps) {
  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        backgroundColor: "var(--brand-surface, #ffffff)",
        fontFamily: BODY_FONT,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow && (
            <p
              className="text-sm font-bold tracking-widest uppercase mb-3"
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

        <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-10 sm:mt-16 sm:gap-8 md:grid-cols-3 lg:max-w-none">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id || i}
                className="flex flex-col items-center text-center"
              >
                {Icon && (
                  <div
                    className="mb-6 inline-flex h-16 w-16 items-center justify-center"
                    style={{
                      borderRadius: radius,
                      backgroundColor:
                        "color-mix(in srgb, var(--brand-primary, #2563eb) 10%, var(--brand-surface, #ffffff))",
                      color: "var(--brand-primary, #2563eb)",
                    }}
                  >
                    <Icon className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
                <h3
                  className="text-xl font-bold tracking-tight"
                  style={{ color: "var(--brand-ink, #0f172a)", fontFamily: HEAD_FONT }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-3 max-w-xs text-base leading-7"
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
