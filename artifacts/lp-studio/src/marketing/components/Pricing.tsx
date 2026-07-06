import { useState } from "react";
import { useInView } from "../hooks/useInView";
import { PLAN_CONFIG, type Plan } from "../../lib/plan-features";

type Billing = "monthly" | "annual";

// ── Canonical-config derivation ────────────────────────────────────────────
// Every price and numeric cap on this page is DERIVED from the shared
// `PLAN_CONFIG` (@workspace/plan-config) so the marketing promises can never
// drift from what the backend 402-gates actually enforce. Only descriptive
// prose (feature names, support copy) is authored here. A drift test guards
// that PLAN_CONFIG matches the DB seed.

// Comparison-table column order (also the self-serve card order minus free).
const COMPARE_PLANS: Plan[] = ["free", "starter", "growth", "scale"];

/** Format a numeric cap: null → "Unlimited". */
function fmtCap(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString();
}

/** Build a comparison-table row of a single limit across COMPARE_PLANS. */
function capRow(key: keyof (typeof PLAN_CONFIG)["free"]["features"]["limits"]): string[] {
  return COMPARE_PLANS.map((p) => fmtCap(PLAN_CONFIG[p].features.limits[key]));
}

/** Heatmap row: "<n> sessions/mo" across COMPARE_PLANS. */
function heatmapRow(): string[] {
  return COMPARE_PLANS.map((p) => {
    const n = PLAN_CONFIG[p].features.limits.heatmapSessionsPerMonth;
    return n === null ? "Unlimited" : `${n.toLocaleString()} sessions/mo`;
  });
}

/** Build a boolean comparison row for a gated feature across COMPARE_PLANS. */
function featRow(key: "salesConsole" | "aiImageGen" | "customDomain"): boolean[] {
  return COMPARE_PLANS.map((p) => PLAN_CONFIG[p].features[key]);
}

interface Tier {
  name: string;
  monthly: number | "Custom";
  annual: number | "Custom";
  desc: string;
  /** One-line "ideal for" — helps prospects self-qualify in 3 seconds. */
  idealFor: string;
  groups: { label: string; items: string[] }[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  badge?: string;
}

// Card tiers — kept in lockstep with the canonical PLAN_FEATURES matrix in
// artifacts/api-server/src/lib/planFeatures.ts. If you change a cap here,
// also change it there (and in artifacts/lp-studio/src/lib/plan-features.ts)
// so marketing promises match what the 402 plan-gates actually enforce.
//
// Free and Enterprise live OUTSIDE this array: Free is a callout above the
// cards (it converts worse as a visible card — buyers anchor on it and never
// upgrade), and Enterprise is a horizontal strip below the cards (different
// sales motion, deserves visual separation from self-serve tiers).
const cardTiers: Tier[] = [
  {
    name: "Starter",
    monthly: PLAN_CONFIG.starter.priceMonthly ?? "Custom",
    annual: PLAN_CONFIG.starter.priceAnnual ?? "Custom",
    desc: "Ship more than one page. Custom domain. No badge.",
    idealFor: "Founders, agencies & small teams",
    groups: [
      {
        label: "Build",
        items: [
          `${fmtCap(PLAN_CONFIG.starter.features.limits.pages)} active landing pages`,
          `${fmtCap(PLAN_CONFIG.starter.features.limits.forms)} forms`,
          `Up to ${fmtCap(PLAN_CONFIG.starter.features.limits.userSeats)} seats`,
          "Visual builder + 124-block library",
          `AI copy · ${fmtCap(PLAN_CONFIG.starter.features.limits.aiGenerationsPerMonth)} generations/mo`,
          "Your own custom domain",
          "No LP Studio badge",
        ],
      },
      {
        label: "Test & measure",
        items: [
          "Unlimited A/B variants",
          `Heatmaps · ${fmtCap(PLAN_CONFIG.starter.features.limits.heatmapSessionsPerMonth)} sessions/mo`,
        ],
      },
      {
        label: "Support",
        items: ["Email support"],
      },
    ],
    cta: "Start free trial",
    ctaHref: "https://app.lpstudio.ai",
  },
  {
    name: "Growth",
    monthly: PLAN_CONFIG.growth.priceMonthly ?? "Custom",
    annual: PLAN_CONFIG.growth.priceAnnual ?? "Custom",
    desc: "Sales and marketing shipping from the same canvas. The Sales Console unlocks here.",
    idealFor: "Mid-market revenue teams",
    groups: [
      {
        label: "Everything in Starter, plus the Sales Console",
        items: [
          "Unlimited pages, forms & A/B tests",
          `Up to ${fmtCap(PLAN_CONFIG.growth.features.limits.userSeats)} seats`,
          "Sales Console — per-account microsites, AI outreach drafts, personalized links",
          "Salesforce + Marketo + HubSpot bidirectional sync",
          "Apollo signals · Chili Piper · Asana · GA4 · Webhooks",
          `Smart Traffic routing + heatmaps · ${fmtCap(PLAN_CONFIG.growth.features.limits.heatmapSessionsPerMonth)} sessions/mo`,
          "Brand system & locked tokens",
          "Token-based external review (no seat cost for legal/clients)",
        ],
      },
      {
        label: "Support",
        items: ["Priority support · live chat", "Onboarding workshop"],
      },
    ],
    cta: "Try Growth free for 14 days",
    ctaHref: "https://app.lpstudio.ai",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Scale",
    monthly: PLAN_CONFIG.scale.priceMonthly ?? "Custom",
    annual: PLAN_CONFIG.scale.priceAnnual ?? "Custom",
    desc: "Multi-brand, multi-team. The whole revenue org on one canvas.",
    idealFor: "Multi-brand operations & agencies",
    groups: [
      {
        label: "Everything in Growth, plus",
        items: [
          "Multi-workspace · multi-brand",
          `Up to ${fmtCap(PLAN_CONFIG.scale.features.limits.userSeats)} seats`,
          "Custom blocks + advanced template library",
          "Programmatic pages + smart sections",
          "Salesforce custom field mapping",
          `Heatmaps · ${fmtCap(PLAN_CONFIG.scale.features.limits.heatmapSessionsPerMonth)} sessions/mo`,
        ],
      },
      {
        label: "Support",
        items: ["Slack channel with founders", "Quarterly review"],
      },
    ],
    cta: "Talk to us",
    ctaHref: "mailto:admin@lpstudio.ai?subject=LP%20Studio%20Scale%20tier",
  },
];

// Feature comparison map — every paid tier (and Free) shown as columns. Each
// row is a single capability. Values can be strings, true (✓), or false (—).
// Order matters: most important capabilities first within each group.
interface FeatureRow {
  feature: string;
  /** Order: Free, Starter, Growth, Scale */
  values: (string | boolean)[];
  /** Optional tooltip / explainer */
  note?: string;
}

interface FeatureGroup {
  label: string;
  rows: FeatureRow[];
}

const FEATURE_MAP: FeatureGroup[] = [
  {
    label: "Build",
    rows: [
      { feature: "Active landing pages", values: capRow("pages") },
      { feature: "Forms", values: capRow("forms") },
      { feature: "User seats", values: capRow("userSeats") },
      { feature: "AI copy generations / month", values: capRow("aiGenerationsPerMonth") },
      { feature: "124-block library", values: [true, true, true, true] },
      { feature: "Brand system & locked tokens", values: [false, true, true, true] },
      { feature: "Custom blocks", values: [false, false, true, true] },
      { feature: "AI image generation", values: featRow("aiImageGen") },
    ],
  },
  {
    label: "Sales Console — per-account ABM workflow",
    rows: [
      { feature: "Accounts, Contacts, Signals, Campaigns", values: [false, false, true, true] },
      { feature: "Per-account microsites (1-click)", values: [false, false, true, true] },
      { feature: "Personalized links per contact (/p/:token)", values: [false, false, true, true] },
      { feature: "Per-contact open tracking", values: [false, false, true, true] },
      { feature: "AI outreach email drafts (link auto-inserted)", values: [false, false, true, true] },
      { feature: "ROI calculator", values: [false, false, true, true] },
      { feature: "One-pager suite (PDF + web)", values: [false, false, true, true] },
    ],
  },
  {
    label: "Integrations",
    rows: [
      { feature: "Salesforce bidirectional sync", values: [false, false, true, "+ custom field mapping"] },
      { feature: "Marketo bidirectional", values: [false, false, true, true] },
      { feature: "HubSpot bidirectional", values: [false, false, true, true] },
      { feature: "Apollo signals + enrichment", values: [false, false, true, true] },
      { feature: "Chili Piper handoff", values: [false, false, true, true] },
      { feature: "Asana review routing", values: [false, false, true, true] },
      { feature: "Resend (email + DNS)", values: [false, false, true, true] },
      { feature: "Google Analytics 4 events", values: [true, true, true, true] },
      { feature: "Webhooks", values: [true, true, true, true] },
    ],
  },
  {
    label: "Test & measure",
    rows: [
      { feature: "A/B testing", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
      { feature: "Multivariate testing", values: [false, false, true, true] },
      { feature: "Smart Traffic routing (Thompson sampling)", values: [false, false, true, true] },
      { feature: "Heatmaps & scroll depth", values: heatmapRow() },
      { feature: "Conversion scoring", values: [false, false, true, true] },
      { feature: "Page speed audit", values: [true, true, true, true] },
      { feature: "Programmatic pages + smart sections", values: [false, false, false, true] },
    ],
  },
  {
    label: "Distribution",
    rows: [
      { feature: "Custom domain (auto SSL)", values: featRow("customDomain") },
      { feature: 'No "Built with LP Studio" badge', values: [false, true, true, true] },
      { feature: "Tenant subdomain (your-brand.lpstudio.ai)", values: [true, true, true, true] },
      { feature: "Vanity short links", values: [false, false, true, true] },
      { feature: "Partner microsites", values: [false, false, true, true] },
      { feature: "Multi-workspace / multi-brand", values: [false, false, false, true] },
      { feature: "Scheduled publish + expiry", values: [false, true, true, true] },
    ],
  },
  {
    label: "Collaboration & review",
    rows: [
      { feature: "Inline comments + @mentions", values: [true, true, true, true] },
      { feature: "Review workflow (approve / changes-requested)", values: [false, false, true, true] },
      { feature: "Token-based external review (no seat cost)", values: [false, false, true, true] },
      { feature: "Live presence", values: [true, true, true, true] },
      { feature: "Version history + restore", values: [true, true, true, true] },
    ],
  },
  {
    label: "Support",
    rows: [
      { feature: "Support channel", values: ["Community", "Email", "Live chat", "Slack channel with founders"] },
      { feature: "Onboarding", values: ["Self-serve", "Self-serve", "Workshop", "Workshop + quarterly review"] },
    ],
  },
];

// Enterprise additions — listed as a strip below the cards rather than as a
// 5th comparison column. Enterprise is a sales-led tier with a different
// motion; visually separating it from the self-serve grid avoids the
// "everything-on-one-page" sprawl.
const ENTERPRISE_FEATURES = [
  "Everything in Scale",
  "Unlimited seats & workspaces",
  "AI image generation",
  "SSO / SAML",
  "99.9% uptime SLA",
  "DPA & MSA",
  "Custom data residency",
  "Dedicated account manager",
  "Quarterly business reviews",
  "Custom integrations",
];

const TIER_COLUMNS = ["Free", "Starter", "Growth", "Scale"] as const;

function formatPrice(t: Tier, billing: Billing): string {
  const v = billing === "monthly" ? t.monthly : t.annual;
  if (typeof v === "string") return v;
  return `$${v}`;
}

interface PricingProps {
  /**
   * Whether the "Compare every feature" map starts expanded. The dedicated
   * /pricing page passes `true` so visitors who hit it specifically get the
   * full breakdown straight away. Embedded on the homepage we leave it
   * closed so the page stays scannable. The toggle button works the same
   * either way.
   */
  defaultCompareOpen?: boolean;
  /**
   * Render the headline as the page's <h1>. The standalone /pricing route
   * passes true (it has no other h1 and the page is prerendered for SEO);
   * embedded on the homepage it stays an <h2> under the hero's h1.
   */
  asPageHeading?: boolean;
}

export default function Pricing({ defaultCompareOpen = false, asPageHeading = false }: PricingProps = {}) {
  const Heading = asPageHeading ? "h1" : "h2";
  const { ref, inView } = useInView();
  const [billing, setBilling] = useState<Billing>("annual");
  const [compareOpen, setCompareOpen] = useState(defaultCompareOpen);

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
        <div className="flex items-end justify-between flex-wrap gap-6 mb-10">
          <div className="max-w-2xl">
            <div className="marker marker-rule mb-6">Pricing</div>
            <Heading className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
              Pricing for teams who actually ship.
            </Heading>
            <p
              className="mt-6 text-[17px] leading-[1.55]"
              style={{ color: "var(--ink-soft)" }}
            >
              No credit-metered demos. No 6-month procurement cycle. Real
              pricing for real usage — and a free tier that ships real pages.
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

        {/* Free-tier callout — small, above the cards. Anchors visitors to the
            free option without giving it a full-card real estate that would
            depress conversion to paid. */}
        <div
          className="mb-6 flex items-center justify-between flex-wrap gap-3 px-5 py-3 rounded-xl"
          style={{
            background: "var(--paper)",
            border: "1px dashed var(--hairline-strong)",
          }}
        >
          <div className="flex items-center gap-3 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            <span
              className="inline-flex items-center gap-1.5 text-[10.5px] uppercase px-2 py-0.5 rounded-full"
              style={{
                background: "var(--sage-soft)",
                color: "var(--sage)",
                letterSpacing: "0.16em",
                fontWeight: 700,
                border: "1px solid color-mix(in srgb, var(--sage) 25%, transparent)",
              }}
            >
              Free forever
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>Just kicking the tires?</strong> Free gets you {fmtCap(PLAN_CONFIG.free.features.limits.pages)} page, {fmtCap(PLAN_CONFIG.free.features.limits.forms)} form, {fmtCap(PLAN_CONFIG.free.features.limits.aiGenerationsPerMonth)} AI generations/mo and a "Built with LP Studio" badge — no card required.
            </span>
          </div>
          <a
            href="https://app.lpstudio.ai"
            className="inline-flex items-center gap-1.5 text-[12.5px] transition-colors"
            style={{
              color: "var(--indigo)",
              fontWeight: 600,
              fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
            }}
          >
            Start free
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* 3-card grid: Starter / Growth (highlighted) / Scale */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cardTiers.map((tier) => (
            <PricingTier key={tier.name} tier={tier} billing={billing} />
          ))}
        </div>

        {/* Enterprise CTA strip — visually separated from self-serve cards
            because the sales motion is different (procurement-driven). */}
        <div
          className="mt-4 p-6 md:p-7 rounded-2xl flex flex-wrap items-start gap-6"
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--indigo) 8%, var(--ink)) 0%, var(--ink) 65%)",
            color: "var(--cream)",
            border: "1px solid color-mix(in srgb, var(--indigo) 40%, var(--ink))",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 80px -30px rgba(75,71,229,0.4), 0 8px 22px -12px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
            <div
              className="font-mono uppercase mb-2"
              style={{ color: "rgba(244,239,227,0.55)", fontSize: 11, letterSpacing: "0.22em", fontWeight: 700 }}
            >
              Enterprise
            </div>
            <div
              className="font-display mb-2"
              style={{ color: "var(--cream)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.022em", lineHeight: 1.15 }}
            >
              For procurement-driven deals.
            </div>
            <p style={{ color: "rgba(244,239,227,0.65)", fontSize: 14, lineHeight: 1.55, maxWidth: 480 }}>
              SSO/SAML, MSA, custom DPA, dedicated CSM, AI image generation, custom integrations, and unlimited everything else. Custom pricing tied to seats and usage.
            </p>
          </div>
          <div style={{ flex: "1 1 320px" }}>
            <div
              className="font-mono uppercase mb-3"
              style={{ color: "rgba(244,239,227,0.45)", fontSize: 10, letterSpacing: "0.2em", fontWeight: 700 }}
            >
              What you also get
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {ENTERPRISE_FEATURES.slice(1).map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-[12.5px]"
                  style={{ color: "rgba(244,239,227,0.85)" }}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--coral)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginTop: 4, flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <path d="M5 12.5L10 17.5L20 7.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flexShrink: 0, alignSelf: "center" }}>
            <a
              href="mailto:admin@lpstudio.ai?subject=LP%20Studio%20Enterprise"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg text-[13.5px] transition-all"
              style={{
                background: "var(--cream)",
                color: "var(--ink)",
                fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
                fontWeight: 600,
                letterSpacing: "-0.005em",
                boxShadow: "0 6px 18px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              Contact sales
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>

        {/* Trial / billing footnote */}
        <div
          className="mt-6 flex items-center justify-between flex-wrap gap-4 px-5 py-4 rounded-xl"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-soft)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5L10 17.5L20 7.5" />
            </svg>
            <span>
              <strong style={{ color: "var(--ink)" }}>Every paid tier</strong> comes with a 14-day Growth trial. No card to start.
            </span>
            <span style={{ color: "var(--ink-faint)" }}>·</span>
            <span>Annual prepay saves 20%. Month-to-month if you'd rather.</span>
          </div>
          <button
            type="button"
            onClick={() => setCompareOpen((v) => !v)}
            className="text-[13px] transition-colors inline-flex items-center gap-1"
            style={{ color: "var(--indigo)", fontWeight: 600 }}
          >
            {compareOpen ? "Hide feature map" : "Compare every feature"}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: compareOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Feature map — full comparison table, collapsible to keep the
            pricing section scannable for visitors who just want the cards. */}
        <div
          aria-hidden={!compareOpen}
          style={{
            maxHeight: compareOpen ? 8000 : 0,
            opacity: compareOpen ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 600ms ease, opacity 300ms ease",
          }}
        >
          <FeatureMap />
        </div>
      </div>
    </section>
  );
}

function FeatureMap() {
  return (
    <div
      className="mt-8 rounded-2xl overflow-hidden"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
      }}
    >
      {/* Wrap the whole grid (header + body) so it scrolls horizontally on
          mobile instead of overflowing the page. */}
      <div className="overflow-x-auto">
      <div style={{ minWidth: 640 }}>
      {/* Sticky header row with tier names + price reminders */}
      <div
        className="grid items-end px-5 py-4"
        style={{
          gridTemplateColumns: "minmax(220px, 2fr) repeat(4, minmax(90px, 1fr))",
          gap: 12,
          background: "var(--cream)",
          borderBottom: "1px solid var(--hairline-strong)",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        <div
          className="font-mono uppercase"
          style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.18em", fontWeight: 700 }}
        >
          Feature
        </div>
        {TIER_COLUMNS.map((name) => (
          <div key={name} className="text-center">
            <div
              className="font-mono uppercase"
              style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.18em", fontWeight: 700 }}
            >
              {name}
            </div>
            <div
              className="font-display mt-1"
              style={{ color: "var(--ink)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.012em" }}
            >
              {tierPriceLabel(name)}
            </div>
          </div>
        ))}
      </div>

      {/* Group + row body */}
      <div>
        {FEATURE_MAP.map((group) => (
          <div key={group.label}>
            <div
              className="px-5 py-3"
              style={{
                background: "color-mix(in srgb, var(--indigo) 4%, var(--paper))",
                borderTop: "1px solid var(--hairline)",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <div
                className="font-display"
                style={{ color: "var(--ink)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.012em" }}
              >
                {group.label}
              </div>
            </div>
            {group.rows.map((row, idx) => (
              <div
                key={row.feature}
                className="grid items-center px-5 py-3"
                style={{
                  gridTemplateColumns: "minmax(220px, 2fr) repeat(4, minmax(90px, 1fr))",
                  gap: 12,
                  borderTop: idx === 0 ? "none" : "1px solid var(--hairline)",
                }}
              >
                <div className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
                  {row.feature}
                  {row.note && (
                    <span
                      className="ml-2 text-[11px]"
                      style={{ color: "var(--ink-mute)", fontStyle: "italic" }}
                    >
                      {row.note}
                    </span>
                  )}
                </div>
                {row.values.map((v, i) => (
                  <div
                    key={`${row.feature}-${i}`}
                    className="text-center text-[13px]"
                    style={{
                      color:
                        v === false
                          ? "var(--ink-faint)"
                          : v === true
                          ? "var(--indigo)"
                          : "var(--ink)",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: v === true ? 600 : 500,
                    }}
                  >
                    {v === true ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-label="Included"
                        style={{ display: "inline-block" }}
                      >
                        <path d="M5 12.5L10 17.5L20 7.5" />
                      </svg>
                    ) : v === false ? (
                      <span aria-label="Not included">—</span>
                    ) : (
                      <span>{v}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* Enterprise row at the bottom — a single full-width callout, not
            a fifth column, to preserve the table's "self-serve tiers only"
            visual cleanliness. */}
        <div
          className="px-5 py-4 flex items-center justify-between flex-wrap gap-3"
          style={{
            background: "color-mix(in srgb, var(--indigo) 6%, var(--paper))",
            borderTop: "1px solid var(--hairline-strong)",
          }}
        >
          <div className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
            <strong style={{ color: "var(--ink)" }}>Need SSO, SOC 2, MSA, or unlimited seats?</strong>{" "}
            Enterprise covers everything above plus AI image generation, dedicated CSM, custom integrations, and a 99.9% uptime SLA.
          </div>
          <a
            href="mailto:admin@lpstudio.ai?subject=LP%20Studio%20Enterprise"
            className="inline-flex items-center gap-1.5 text-[12.5px] transition-colors"
            style={{ color: "var(--indigo)", fontWeight: 600 }}
          >
            Talk to sales
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}

// Sticky-header price reminders — annual (month-equivalent) prices derived
// from PLAN_CONFIG so they can't drift from the cards above.
function tierPriceLabel(name: string): string {
  const byName: Record<string, Plan> = {
    Free: "free",
    Starter: "starter",
    Growth: "growth",
    Scale: "scale",
  };
  const plan = byName[name];
  if (!plan) return "";
  const annual = PLAN_CONFIG[plan].priceAnnual;
  if (annual === null) return "";
  return annual === 0 ? "$0" : `$${annual}/mo`;
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
        <div className="flex items-center justify-between mb-2">
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

        <div
          className="text-[11.5px] mb-4"
          style={{ color: highlight ? "rgba(244,239,227,0.55)" : "var(--ink-mute)", letterSpacing: "0.02em" }}
        >
          {tier.idealFor}
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
            background: highlight ? "var(--cream)" : "var(--ink)",
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
          {highlight && (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="var(--coral)" aria-hidden="true">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
            </svg>
          )}
          {tier.cta}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
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
                      <path d="M5 12.5L10 17.5L20 7.5" />
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
