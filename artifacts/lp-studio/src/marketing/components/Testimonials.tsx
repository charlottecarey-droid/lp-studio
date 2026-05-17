import { useInView } from "../hooks/useInView";

const testimonials = [
  {
    quote:
      "We used to wait two weeks for marketing to build a landing page. Now our AEs spin one up in an afternoon — on brand, with real copy. It's completely changed how we run outbound.",
    name: "Rachel Tran",
    role: "VP, Revenue Operations",
    company: "Series B SaaS",
  },
  {
    quote:
      "The visual builder is the best I've used. Fast, intuitive, and the AI copy actually sounds like us — not generic filler. Outbound conversion went up 40% in the first month.",
    name: "Marcus Jordan",
    role: "Head of Demand Generation",
    company: "Growth-stage fintech",
  },
  {
    quote:
      "Smart Traffic changed how we think about optimization. Set it up once and it just keeps improving conversion in the background. No babysitting, no analyst needed.",
    name: "Priya Shah",
    role: "Director, Performance Marketing",
    company: "B2B SaaS · Enterprise",
  },
];

export default function Testimonials() {
  const { ref, inView } = useInView();
  return (
    <section
      id="testimonials"
      className="px-6 py-28 md:py-36"
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
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
          <div className="marker marker-rule mb-6">From the field</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            Teams that have stopped waiting on the page.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderTop: "1px solid var(--hairline)" }}>
          {testimonials.map((t, i) => (
            <figure
              key={t.name}
              className="py-10 md:py-12 px-0 md:px-8 flex flex-col gap-8 h-full"
              style={{
                borderRight: i < testimonials.length - 1 ? "1px solid var(--hairline)" : "none",
                paddingLeft: i === 0 ? 0 : undefined,
                paddingRight: i === testimonials.length - 1 ? 0 : undefined,
              }}
            >
              {/* Editorial open-quote glyph, restrained */}
              <span
                aria-hidden
                className="font-display"
                style={{
                  fontSize: 56,
                  lineHeight: 0.6,
                  color: "var(--ink-faint)",
                  fontWeight: 500,
                  fontVariationSettings: "'opsz' 144",
                }}
              >
                “
              </span>
              <blockquote
                className="font-display flex-1"
                style={{
                  color: "var(--ink)",
                  fontSize: 19,
                  lineHeight: 1.45,
                  fontWeight: 400,
                  letterSpacing: "-0.012em",
                }}
              >
                {t.quote}
              </blockquote>
              <figcaption>
                <div className="text-[13.5px] font-medium mb-0.5" style={{ color: "var(--ink)" }}>
                  {t.name}
                </div>
                <div
                  className="font-mono uppercase"
                  style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
                >
                  {t.role} · {t.company}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
