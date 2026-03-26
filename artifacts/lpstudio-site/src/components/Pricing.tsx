import { useInView } from "@/hooks/useInView";

const tiers = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "Perfect for solo marketers and small teams getting started with conversion optimization.",
    features: [
      "5 active landing pages",
      "Visual builder",
      "Basic A/B testing (2 variants)",
      "Heatmaps (1,000 sessions/mo)",
      "AI copy (50 generations/mo)",
      "Email support",
    ],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$149",
    period: "/mo",
    desc: "For growing teams who need unlimited testing, more traffic, and advanced optimization.",
    features: [
      "Unlimited landing pages",
      "Visual builder + custom blocks",
      "Unlimited A/B & multivariate tests",
      "Heatmaps (10,000 sessions/mo)",
      "AI copy (unlimited)",
      "Smart Traffic routing",
      "Brand system",
      "Priority support",
    ],
    cta: "Get Early Access",
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
    cta: "Contact Us",
    highlight: false,
  },
];

export default function Pricing() {
  const { ref, inView } = useInView();
  return (
    <section id="pricing" className="px-6 py-20 md:py-28" style={{ background: "#000" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}>
            Simple Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Start free. <span style={{ color: "#C7E738" }}>Scale when you win.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            No contracts. No surprises. Cancel any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-2xl p-8 flex flex-col gap-6 relative"
              style={{
                background: tier.highlight ? "rgba(199,231,56,0.04)" : "rgba(255,255,255,0.03)",
                border: tier.highlight ? "1px solid rgba(199,231,56,0.35)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {tier.highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                  style={{ background: "#C7E738", color: "#000", fontFamily: "Outfit, sans-serif" }}
                >
                  Most Popular
                </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-1" style={{ color: "#C7E738" }}>{tier.name}</div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-bold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>{tier.price}</span>
                  <span className="text-gray-400 text-sm">{tier.period}</span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{tier.desc}</p>
              </div>

              <ul className="flex flex-col gap-3 flex-1">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <span className="mt-0.5 flex-shrink-0" style={{ color: "#C7E738" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#waitlist"
                className="block w-full text-center py-3 rounded-full text-sm font-bold transition-all"
                style={{
                  background: tier.highlight ? "#C7E738" : "rgba(255,255,255,0.06)",
                  color: tier.highlight ? "#000" : "#fff",
                  border: tier.highlight ? "none" : "1px solid rgba(255,255,255,0.12)",
                  fontFamily: "Outfit, sans-serif"
                }}
                onMouseEnter={e => {
                  if (tier.highlight) e.currentTarget.style.background = "#d6f54a";
                  else e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={e => {
                  if (tier.highlight) e.currentTarget.style.background = "#C7E738";
                  else e.currentTarget.style.background = "rgba(255,255,255,0.06)";
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
