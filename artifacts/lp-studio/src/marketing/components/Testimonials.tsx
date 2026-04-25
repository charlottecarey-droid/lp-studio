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
      "The visual builder is the best I've used. Fast, intuitive, and the AI copy actually sounds like us — not generic filler. Our outbound conversion went up 40% in the first month.",
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
    <section id="testimonials" className="px-6 py-24 md:py-32" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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
          <div className="eyebrow mb-5">From the field</div>
          <h2 className="font-display text-4xl md:text-[44px] leading-[1.05] font-semibold text-white">
            Real results from <span className="" style={{ color: "#D4F542" }}>real teams</span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="rounded-xl p-7 flex flex-col gap-7 h-full"
              style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <blockquote className="font-display text-[17px] leading-[1.45] flex-1" style={{ color: "rgba(250,250,250,0.92)", letterSpacing: "-0.015em" }}>
                {t.quote}
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(250,250,250,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="leading-tight">
                  <div className="text-[13.5px] font-medium" style={{ color: "#FAFAFA" }}>
                    {t.name}
                  </div>
                  <div className="text-[12px]" style={{ color: "rgba(250,250,250,0.45)" }}>
                    {t.role} · {t.company}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
