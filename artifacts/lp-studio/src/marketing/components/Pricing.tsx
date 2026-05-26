import { useState } from "react";
import { useInView } from "../hooks/useInView";

type Billing = "monthly" | "annual";

interface Tier {
  name: string;
  monthly: number | "Custom";
  annual: number | "Custom";
  desc: string;
  /**
   * Sections grouped by capability area so the feature list reads as a
   * proper comparison rather than one long bulleted column.
   */
  groups: { label: string; items: string[] }[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  badge?: string;
}

// Pricing tiers — kept in lockstep with the canonical PLAN_FEATURES matrix
// in artifacts/api-server/src/lib/planFeatures.ts. If you change a number
// here, also change it there (and the mirror in
// artifacts/lp-studio/src/lib/plan-features.ts) so the marketing promise
// matches what the 402 plan-gates actually enforce.
const tiers: Tier[] = [
  {
    name: "Starter",
    monthly: 49,
    annual: 39,
    desc: "For individuals and small teams getting their first pages live.",
    groups: [
      {
        label: "Build",
        items: [
          "5 active landing pages",
          "2 forms",
          "Up to 3 user seats",
          "Visual builder",
          "AI copy · 50 generations/mo",
        ],
      },
      {
        label: "Test & measure",
        items: ["Basic A/B testing (2 variants)", "Heatmaps · 1,000 sessions/mo"],
      },
      {
        label: "Branding",
        items: ['"Powered by LP Studio" badge on published pages'],
      },
      {
        label: "Support",
        items: ["Email support"],
      },
    ],
    cta: "Start free",
    ctaHref: "https://app.lpstudio.ai",
  },
  {
    name: "Growth",
    monthly: 149,
    annual: 119,
    desc: "For revenue teams who need unlimited pages, the Sales Console, and a domain of their own.",
    groups: [
      {
        label: "Everything in Starter, plus",
        items: [
          "Unlimited landing pages",
          "Unlimited forms",
          "Up to 10 user seats",
          "Your own custom domain",
          "Sales Console — track and route leads",
          "No LP Studio badge on published pages",
        ],
      },
      {
        label: "Build",
        items: [
          "Visual builder + custom blocks",
          "AI copy · unlimited",
          "Brand system & locked tokens",
        ],
      },
      {
        label: "Test & measure",
        items: [
          "Unlimited A/B & multivariate tests",
          "Smart Traffic routing",
          "Heatmaps · 10,000 sessions/mo",
        ],
      },
      {
        label: "Support",
        items: ["Priority support · live chat", "Onboarding workshop"],
      },
    ],
    cta: "Get started",
    ctaHref: "https://app.lpstudio.ai",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Enterprise",
    monthly: "Custom",
    annual: "Custom",
    desc: "For high-volume teams that need custom contracts, SLAs, and dedicated support.",
    groups: [
      {
        label: "Everything in Growth, plus",
        items: [
          "Unlimited user seats",
          "AI image generation",
          "SSO / SAML",
          "99.9% uptime SLA",
        ],
      },
      {
        label: "Programs",
        items: [
          "Dedicated account manager",
          "Quarterly business reviews",
          "Custom integrations",
        ],
      },
      {
        label: "Security & compliance",
        items: ["SOC 2 Type II report", "DPA & MSA", "Custom data residency"],
      },
    ],
    cta: "Contact sales",
    ctaHref: "mailto:admin@lpstudio.ai",
  },
];

function formatPrice(t: Tier, billing: Billing): string {
  const v = billing === "monthly" ? t.monthly : t.annual;
  if (typeof v === "string") return v;
  return `$${v}`;
}

export default function Pricing() {
  const { ref, inView } = useInView();
  const [billing, setBilling] = useState<Billing>("annual");
  return (
    <section
      id="pricing"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{ background: "var(--cream-2)", borderTop: "1px solid var(--hairline)" }}
    >
      {/* Section-level orb behind the Growth tier */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "26%",
          left: "50%",
          width: 720,
          height: 720,
          transform: "translate(-50%, 0)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(75,71,229,0.10) 0%, rgba(75,71,229,0) 65%)",
          filter: "blur(6px)",
        }}
      />

      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div className="max-w-2xl">
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

          {/* Billing toggle */}
          <div
            className="inline-flex items-center p-1 rounded-full relative"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline-strong)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
            }}
          >
            {(["monthly", "annual"] as Billing[]).map((b) => {
              const active = billing === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBilling(b)}
                  className="relative px-4 py-1.5 text-[12.5px] rounded-full transition-colors"
                  style={{
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--cream)" : "var(--ink-soft)",
                    fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                    textTransform: "capitalize",
                  }}
                >
                  {b}
                  {b === "annual" && (
                    <span
                      className="ml-1.5 inline-block text-[9.5px] uppercase px-1.5 py-0.5 rounded-full align-middle"
                      style={{
                        background: active ? "var(--coral)" : "var(--coral-soft)",
                        color: active ? "var(--cream)" : "var(--coral)",
                        letterSpacing: "0.14em",
                        fontWeight: 700,
                      }}
                    >
                      Save 20%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <PricingTier key={tier.name} tier={tier} billing={billing} />
          ))}
        </div>

        {/* Footnote / compare link */}
        <div
          className="mt-10 flex items-center justify-between flex-wrap gap-4 px-5 py-4 rounded-xl"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-soft)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5L10 17.5L20 7.5"/>
            </svg>
            <span><strong style={{ color: "var(--ink)" }}>14-day free trial</strong> on Growth — no card required.</span>
            <span style={{ color: "var(--ink-faint)" }}>·</span>
            <span>Annual prepay or month-to-month, your call.</span>
          </div>
          <a
            href="mailto:admin@lpstudio.ai?subject=LP%20Studio%20feature%20comparison"
            className="text-[13px] font-medium transition-colors inline-flex items-center gap-1"
            style={{ color: "var(--indigo)" }}
          >
            Compare all features →
          </a>
        </div>
      </div>
    </section>
  );
}

function PricingTier({ tier, billing }: { tier: Tier; billing: Billing }) {
  const highlight = !!tier.highlight;
  return (
    <div
      className="relative rounded-2xl"
      style={{
        background: highlight ? "var(--ink)" : "var(--paper)",
        color: highlight ? "var(--cream)" : "var(--ink)",
        border: `1px solid ${highlight ? "var(--ink)" : "var(--hairline-strong)"}`,
        padding: 28,
        boxShadow: highlight
          ? "0 30px 80px -30px rgba(75,71,229,0.55), 0 12px 28px -10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 20px -16px rgba(26,24,21,0.08)",
        transform: highlight ? "translateY(-4px)" : "none",
        transition: "transform 200ms ease",
      }}
    >
      {/* Aurora behind highlighted tier */}
      {highlight && (
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: -80,
            right: -80,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(75,71,229,0.55) 0%, rgba(75,71,229,0) 70%)",
            filter: "blur(8px)",
          }}
        />
      )}

      {tier.badge && (
        <div
          className="absolute -top-3 left-7 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: `linear-gradient(180deg, var(--coral) 0%, color-mix(in srgb, var(--coral) 80%, #000) 100%)`,
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
            boxShadow: "0 4px 10px -2px color-mix(in srgb, var(--coral) 50%, transparent)",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.7 6.7L22 9.6l-5.4 4.7L18 22l-6-3.5L6 22l1.4-7.7L2 9.6l7.3-.9z" />
          </svg>
          {tier.badge}
        </div>
      )}

      <div className="relative">
        <div
          className="flex items-center justify-between mb-4"
        >
          <span
            className="font-mono uppercase"
            style={{
              color: highlight ? "rgba(244,239,227,0.7)" : "var(--ink-mute)",
              fontSize: 11,
              letterSpacing: "0.22em",
              fontWeight: 700,
            }}
          >
            {tier.name}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="font-display"
            style={{
              color: highlight ? "var(--cream)" : "var(--ink)",
              fontSize: 52,
              fontWeight: 500,
              letterSpacing: "-0.038em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPrice(tier, billing)}
          </span>
          {typeof tier.monthly === "number" && (
            <span
              style={{
                color: highlight ? "rgba(244,239,227,0.6)" : "var(--ink-mute)",
                fontSize: 14,
                fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
              }}
            >
              /mo · {billing === "annual" ? "billed annually" : "billed monthly"}
            </span>
          )}
        </div>
        {typeof tier.monthly === "number" && billing === "annual" && (
          <div className="text-[11.5px] mb-5" style={{ color: highlight ? "rgba(244,239,227,0.55)" : "var(--ink-mute)" }}>
            <span style={{ textDecoration: "line-through" }}>${tier.monthly}/mo</span> · save 20% annually
          </div>
        )}
        {!(typeof tier.monthly === "number" && billing === "annual") && <div className="mb-5" />}

        <p
          className="text-[14.5px] leading-[1.55] mb-6"
          style={{ color: highlight ? "rgba(244,239,227,0.75)" : "var(--ink-soft)" }}
        >
          {tier.desc}
        </p>

        <a
          href={tier.ctaHref}
          className="block w-full text-center py-2.5 mb-7 text-[13.5px] inline-flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: highlight
              ? "var(--cream)"
              : "var(--ink)",
            color: highlight ? "var(--ink)" : "var(--cream)",
            borderRadius: 8,
            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
            fontWeight: 600,
            letterSpacing: "-0.005em",
            boxShadow: highlight
              ? "0 6px 18px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5)"
              : "inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = highlight ? "#FFFFFF" : "var(--ink-2)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = highlight ? "var(--cream)" : "var(--ink)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {tier.cta}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14"/>
            <path d="M13 5l7 7-7 7"/>
          </svg>
        </a>

        {/* Grouped feature list */}
        <div className="space-y-5">
          {tier.groups.map((g) => (
            <div key={g.label}>
              <div
                className="text-[10px] uppercase mb-2.5"
                style={{
                  color: highlight ? "rgba(244,239,227,0.5)" : "var(--ink-mute)",
                  letterSpacing: "0.2em",
                  fontWeight: 700,
                }}
              >
                {g.label}
              </div>
              <ul className="flex flex-col gap-2.5">
                {g.items.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[13.5px] leading-[1.5]"
                    style={{ color: highlight ? "rgba(244,239,227,0.92)" : "var(--ink-2)" }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={highlight ? "var(--coral)" : "var(--indigo)"}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginTop: 4, flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <path d="M5 12.5L10 17.5L20 7.5"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
