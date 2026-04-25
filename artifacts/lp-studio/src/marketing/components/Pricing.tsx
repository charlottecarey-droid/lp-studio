import { useInView } from "../hooks/useInView";

const LIME = "#D4F542";

const tiers = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "For individuals and small teams getting their first pages live fast.",
    features: [
      "5 active landing pages",
      "Visual builder",
      "Basic A/B testing (2 variants)",
      "Heatmaps (1,000 sessions/mo)",
      "AI copy (50 generations/mo)",
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
      "Heatmaps (10,000 sessions/mo)",
      "AI copy (unlimited)",
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
    <section id="pricing" className="px-6 py-24 md:py-32" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="max-w-2xl mb-14">
          <div className="eyebrow mb-5">Pricing</div>
          <h2 className="font-display text-4xl md:text-[44px] leading-[1.05] font-semibold text-white">
            Start free. <span className="" style={{ color: LIME }}>Scale</span> when you win.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed" style={{ color: "rgba(250,250,250,0.55)" }}>
            No contracts. No surprises. Cancel any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-xl p-7 flex flex-col gap-6 relative"
              style={{
                background: tier.highlight ? "#101010" : "#0D0D0D",
                border: tier.highlight ? "1px solid rgba(212,245,66,0.3)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {tier.highlight && (
                <div
                  className="absolute -top-2.5 left-7 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] rounded"
                  style={{ background: LIME, color: "#0A0A0A" }}
                >
                  Most popular
                </div>
              )}

              <div>
                <div className="text-[13px] font-medium mb-3" style={{ color: tier.highlight ? LIME : "rgba(250,250,250,0.65)" }}>
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-display text-[42px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
                    {tier.price}
                  </span>
                  <span className="text-[14px]" style={{ color: "rgba(250,250,250,0.4)" }}>
                    {tier.period}
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: "rgba(250,250,250,0.55)" }}>
                  {tier.desc}
                </p>
              </div>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              <ul className="flex flex-col gap-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "rgba(250,250,250,0.78)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={tier.ctaHref}
                className="block w-full text-center py-2.5 rounded-md text-[13.5px] font-medium transition-all"
                style={{
                  background: tier.highlight ? LIME : "rgba(255,255,255,0.04)",
                  color: tier.highlight ? "#0A0A0A" : "#FAFAFA",
                  border: tier.highlight ? "none" : "1px solid rgba(255,255,255,0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tier.highlight ? "#dcf85a" : "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = tier.highlight ? LIME : "rgba(255,255,255,0.04)";
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
