import { useInView } from "../hooks/useInView";

// Use-case section: two checklist cards (Sales, Marketing). Each shows the
// essentials that team reaches for most, plus a link out to the matching
// core page. Editorial "ledger" styling — numbered headers, hairline rule,
// brand-accent checkmarks.

interface UseCase {
  num: string;
  name: string;
  headline: string;
  items: string[];
  accent: string;
  cta: { label: string; href: string };
}

const cases: UseCase[] = [
  {
    num: "01",
    name: "Sales",
    headline: "From prompt to pipeline.",
    items: [
      "Live pages embedded right in your 1:1 outreach",
      "The exact case study each buyer relates to",
      "Their logo and use case, not a generic deck",
      "See who viewed, and for how long",
      "No design tickets, no waiting on marketing",
    ],
    accent: "var(--indigo)",
    cta: { label: "Explore for sales", href: "/for-sales" },
  },
  {
    num: "02",
    name: "Marketing",
    headline: "Campaign ready in minutes.",
    items: [
      "Five variants live by Friday, with A/B and multivariate testing",
      "Pull your brand from any URL — colors, fonts, logo",
      "Save your own templates and reuse them anywhere",
      "Sync to your campaigns, or send straight from LP Studio",
      "AI writes from your media library, with approved stats only",
    ],
    accent: "var(--coral)",
    cta: { label: "Explore for marketing", href: "/for-marketing" },
  },
];

export default function UseCases() {
  const { ref, inView } = useInView();
  return (
    <section id="use-cases" className="px-6 py-28 md:py-36" style={{ background: "var(--cream)" }}>
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="max-w-2xl mb-16 md:mb-20">
          <div className="marker marker-rule mb-6">For the whole revenue org</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            Sales and marketing, shipping from the same canvas.
          </h2>
          <p
            className="mt-6 text-[17px] leading-[1.55]"
            style={{ color: "var(--ink-soft)", maxWidth: 580 }}
          >
            The essentials each team reaches for most — and where to dig into the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-7">
          {cases.map((c) => (
            <CaseCard key={c.name} c={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CaseCard({ c }: { c: UseCase }) {
  return (
    <div
      className="group relative rounded-2xl p-7 md:p-9 transition-all"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(26,24,21,0.10)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          `0 1px 0 rgba(255,255,255,0.6) inset, 0 14px 32px -14px rgba(26,24,21,0.16), 0 0 0 1px color-mix(in srgb, ${c.accent} 30%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(26,24,21,0.10)";
      }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="font-display tabular-nums"
          style={{ color: c.accent, fontSize: 30, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1 }}
        >
          {c.num}
        </span>
        <span
          className="font-mono uppercase"
          style={{ color: c.accent, fontSize: 11, letterSpacing: "0.18em", fontWeight: 600 }}
        >
          {c.name}
        </span>
      </div>

      <div
        aria-hidden
        style={{
          height: 1,
          margin: "18px 0 22px",
          background: `linear-gradient(90deg, color-mix(in srgb, ${c.accent} 35%, transparent), transparent)`,
        }}
      />

      <h3
        className="font-display"
        style={{
          color: "var(--ink)",
          fontSize: "clamp(22px, 2.4vw, 26px)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          margin: "0 0 24px",
          maxWidth: 360,
        }}
      >
        {c.headline}
      </h3>

      <ul className="flex flex-col gap-[15px]">
        {c.items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-[13px] text-[15px] leading-[1.45]"
            style={{ color: "var(--ink-2)" }}
          >
            <Check accent={c.accent} />
            {item}
          </li>
        ))}
      </ul>

      <a
        href={c.cta.href}
        className="inline-flex items-center gap-[7px] mt-7 text-[14.5px] font-semibold transition-colors"
        style={{
          color: c.accent,
          textDecoration: "none",
          borderBottom: `1px solid color-mix(in srgb, ${c.accent} 30%, transparent)`,
          paddingBottom: 3,
        }}
      >
        {c.cta.label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

function Check({ accent }: { accent: string }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        border: `1.5px solid color-mix(in srgb, ${accent} 35%, transparent)`,
        background: `color-mix(in srgb, ${accent} 8%, transparent)`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.5L10 17.5L20 7.5" />
      </svg>
    </span>
  );
}
