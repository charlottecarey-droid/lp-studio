import { useInView } from "../hooks/useInView";

const tiers = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "For individuals and small teams getting their first pages live.",
    features: [
      "5 active landing pages",
      "Visual builder",
      "Basic A/B testing (2 variants)",
      "Heatmaps — 1,000 sessions/mo",
      "AI copy — 50 generations/mo",
      "Email support",
    ],
    cta: "Start free",
    ctaHref: "https://app.lpstudio.ai",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$149",
    period: "/mo",
    desc: "For revenue teams who need unlimited pages, unlimited testing, and AI copy at scale.",
    features: [
      "Unlimited landing pages",
      "Visual builder + custom blocks",
      "Unlimited A/B & multivariate tests",
      "Heatmaps — 10,000 sessions/mo",
      "AI copy — unlimited",
      "Smart Traffic routing",
      "Brand system",
      "Priority support",
    ],
    cta: "Get started",
    ctaHref: "https://app.lpstudio.ai",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For high-volume teams that need custom contracts, SLAs, and dedicated support.",
    features: [
      "Everything in Growth",
      "Custom domain(s)",
      "SSO / SAML",
      "Dedicated account manager",
      "99.9% uptime SLA",
      "Custom integrations",
      "Quarterly business reviews",
    ],
    cta: "Contact sales",
    ctaHref: "mailto:sales@lpstudio.ai",
    highlight: false,
  },
];

export default function Pricing() {
  const { ref, inView } = useInView();
  return (
    <section
      id="pricing"
      className="px-6 py-28 md:py-36"
      style={{ background: "var(--cream-2)", borderTop: "1px solid var(--hairline)" }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="max-w-2xl mb-16">
          <div className="marker marker-rule mb-6">Pricing</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            Start free. Scale when you start winning.
          </h2>
          <p
            className="mt-6 text-[17px] leading-[1.55]"
            style={{ color: "var(--ink-soft)" }}
          >
            No contracts. No surprises. Cancel any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="p-7 flex flex-col gap-6 relative"
              style={{
                background: tier.highlight ? "var(--ink)" : "var(--paper)",
                color: tier.highlight ? "var(--cream)" : "var(--ink)",
                border: tier.highlight ? "1px solid var(--ink)" : "1px solid var(--hairline)",
                borderRadius: 10,
              }}
            >
              {tier.highlight && (
                <div
                  className="font-mono absolute -top-2.5 left-7 px-2.5 py-0.5"
                  style={{
                    background: "var(--coral)",
                    color: "var(--cream)",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    borderRadius: 4,
                  }}
                >
                  Most popular
                </div>
              )}

              <div>
                <div
                  className="font-mono uppercase mb-4"
                  style={{
                    color: tier.highlight ? "var(--dark-mute)" : "var(--ink-mute)",
                    fontSize: 11,
                    letterSpacing: "0.18em",
                  }}
                >
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1 mb-5">
                  <span
                    className="font-display"
                    style={{
                      color: tier.highlight ? "var(--cream)" : "var(--ink)",
                      fontSize: 48,
                      fontWeight: 500,
                      letterSpacing: "-0.038em",
                      lineHeight: 1,
                      fontVariationSettings: "'opsz' 144",
                    }}
                  >
                    {tier.price}
                  </span>
                  <span
                    style={{
                      color: tier.highlight ? "var(--dark-mute)" : "var(--ink-mute)",
                      fontSize: 14,
                    }}
                  >
                    {tier.period}
                  </span>
                </div>
                <p
                  className="text-[14.5px] leading-[1.55]"
                  style={{ color: tier.highlight ? "var(--dark-mute)" : "var(--ink-soft)" }}
                >
                  {tier.desc}
                </p>
              </div>

              <div
                className="h-px"
                style={{ background: tier.highlight ? "var(--dark-hairline)" : "var(--hairline)" }}
              />

              <ul className="flex flex-col gap-2.5 flex-1">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-[13.5px] leading-[1.55]"
                    style={{ color: tier.highlight ? "rgba(244,239,227,0.85)" : "var(--ink-2)" }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={tier.highlight ? "var(--coral)" : "var(--indigo)"}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-1.5 flex-shrink-0"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={tier.ctaHref}
                className="block w-full text-center py-2.5 text-[13.5px] font-medium transition-all"
                style={{
                  background: tier.highlight ? "var(--cream)" : "var(--ink)",
                  color: tier.highlight ? "var(--ink)" : "var(--cream)",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tier.highlight
                    ? "#FFFFFF"
                    : "var(--ink-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = tier.highlight ? "var(--cream)" : "var(--ink)";
                }}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
