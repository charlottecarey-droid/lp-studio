import { useInView } from "../hooks/useInView";

const cases = [
  {
    num: "01",
    name: "ABM Sales",
    headline: "One page for every account on the list.",
    body:
      "Pull the logo, swap the hero, drop in the case study they actually relate to. Personalized at the account level — no design ticket, no waiting on marketing.",
    bullets: [
      "Personalize at the account level",
      "Embed in 1:1 outreach",
      "See who viewed and for how long",
    ],
    accent: "var(--indigo)",
    tint: "var(--indigo-soft)",
  },
  {
    num: "02",
    name: "Demand Gen",
    headline: "Five variants live by Friday.",
    body:
      "Run paid traffic across A/B/C variants of headline, hero, and CTA. Smart Traffic routes to the winner the moment significance lands.",
    bullets: [
      "Built-in A/B and multivariate testing",
      "Auto-significance detection",
      "Heatmaps and scroll depth, in the box",
    ],
    accent: "var(--coral)",
    tint: "var(--coral-soft)",
  },
  {
    num: "03",
    name: "Product Launches",
    headline: "Brand-locked. Marketer-fast.",
    body:
      "Brand tokens, blocks, and approvals baked in. Anyone ships on-brand the first time. Designers stay in the loop only when they want to.",
    bullets: [
      "Tokens enforced at the block level",
      "Approval workflows when you need them",
      "Locked vs editable regions",
    ],
    accent: "var(--sage)",
    tint: "var(--sage-soft)",
  },
  {
    num: "04",
    name: "Customer Success",
    headline: "QBRs and renewals, repeatable.",
    body:
      "Executive-ready pages for QBRs, expansions, and renewals. Their data, their goals, their next milestones. Send a link, not a deck.",
    bullets: [
      "Pre-built QBR and renewal templates",
      "Auto-pull from your CRM",
      "Branded, shareable, trackable",
    ],
    accent: "var(--gold)",
    tint: "var(--gold-soft)",
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
        <div className="max-w-2xl mb-20">
          <div className="marker marker-rule mb-6">For the whole revenue org</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            One builder. Every motion the revenue team runs.
          </h2>
          <p
            className="mt-6 text-[17px] leading-[1.55]"
            style={{ color: "var(--ink-soft)", maxWidth: 580 }}
          >
            Sales personalizes. Demand gen tests. Product launches. Success renews. The same primitives carry across every play.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderTop: "1px solid var(--hairline)" }}>
          {cases.map((c, i) => (
            <div
              key={c.name}
              className="py-10 md:py-12 pr-6 md:pr-10 transition-colors group"
              style={{
                borderBottom: "1px solid var(--hairline)",
                borderLeft: i % 2 === 1 ? "1px solid var(--hairline)" : "none",
                paddingLeft: i % 2 === 1 ? "2.5rem" : 0,
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="font-mono inline-flex items-center justify-center"
                  style={{
                    background: c.tint,
                    color: c.accent,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  {c.num}
                </span>
                <span
                  className="font-mono uppercase"
                  style={{ color: c.accent, fontSize: 11, letterSpacing: "0.18em", fontWeight: 500 }}
                >
                  {c.name}
                </span>
              </div>
              <h3
                className="font-display text-display-md mb-4"
                style={{ color: "var(--ink)" }}
              >
                {c.headline}
              </h3>
              <p
                className="text-[15.5px] leading-[1.6] mb-6"
                style={{ color: "var(--ink-soft)" }}
              >
                {c.body}
              </p>
              <ul className="space-y-2.5">
                {c.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 text-[14px]"
                    style={{ color: "var(--ink-2)" }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 14,
                        height: 1,
                        background: "var(--ink-faint)",
                        display: "inline-block",
                        marginTop: 10,
                        flexShrink: 0,
                      }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
