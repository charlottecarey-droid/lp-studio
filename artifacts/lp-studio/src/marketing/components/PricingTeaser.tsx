import { useInView } from "../hooks/useInView";
import { PLAN_CONFIG } from "../../lib/plan-features";

/**
 * PricingTeaser — homepage pricing summary (Option B redesign, Sept 2026).
 *
 * The full Pricing component (cards + Free callout + Enterprise strip +
 * collapsible feature map) now renders only on /pricing; the homepage shows
 * just the three paid tiers so the scroll stays short. Every price still
 * derives from PLAN_CONFIG — never hardcode a number here (the schemaDrift-
 * style plan test guards the config against the DB seed, not this file).
 * Prices shown are the annual rate, labeled as such below the cards.
 */
const TIERS = [
  {
    key: "starter" as const,
    name: "Starter",
    blurb: "For one team shipping pages",
    featured: false,
  },
  {
    key: "growth" as const,
    name: "Growth",
    blurb: "Microsites, A/B testing, identity",
    featured: true,
  },
  {
    key: "scale" as const,
    name: "Scale",
    blurb: "Full sales console + routing",
    featured: false,
  },
];

export default function PricingTeaser() {
  const { ref, inView } = useInView();
  return (
    <section
      id="pricing"
      className="px-6 py-24 md:py-32"
      style={{ background: "var(--cream-2)", borderTop: "1px solid var(--hairline)" }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto text-center"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="marker marker-rule mb-6 justify-center" style={{ justifyContent: "center" }}>
          Pricing
        </div>
        <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
          Start free. Scale when it works.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-[900px] mx-auto mt-12">
          {TIERS.map((t) => {
            const price = PLAN_CONFIG[t.key].priceAnnual;
            return (
              <a
                key={t.key}
                href="/pricing"
                className="relative rounded-2xl p-7 flex flex-col items-center gap-1.5 transition-all"
                style={{
                  background: "var(--paper)",
                  border: t.featured
                    ? "2px solid var(--indigo)"
                    : "1px solid var(--hairline)",
                  boxShadow: t.featured
                    ? "0 18px 40px -20px color-mix(in srgb, var(--indigo) 45%, transparent)"
                    : "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(26,24,21,0.10)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {t.featured && (
                  <span
                    className="font-mono uppercase absolute"
                    style={{
                      top: -11,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      color: "#FFFFFF",
                      background: "var(--indigo)",
                      borderRadius: 999,
                      padding: "4px 12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Most popular
                  </span>
                )}
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    color: t.featured ? "var(--indigo)" : "var(--ink-mute)",
                  }}
                >
                  {t.name}
                </span>
                <span
                  className="font-display"
                  style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}
                >
                  {typeof price === "number" ? `$${price}` : "Custom"}
                  {typeof price === "number" && (
                    <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-mute)" }}>/mo</span>
                  )}
                </span>
                <span className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
                  {t.blurb}
                </span>
              </a>
            );
          })}
        </div>

        <p className="mt-8 text-[14.5px]" style={{ color: "var(--ink-soft)" }}>
          Shown billed annually · every plan starts free, no card.{" "}
          <a
            href="/pricing"
            className="font-semibold transition-colors"
            style={{ color: "var(--indigo)", textDecoration: "none" }}
          >
            Full pricing, Enterprise &amp; feature map →
          </a>
        </p>
      </div>
    </section>
  );
}
