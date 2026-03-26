import { useInView } from "@/hooks/useInView";

const testimonials = [
  {
    quote: "We cut our landing page production time from 3 weeks to 3 days. The A/B testing alone has increased our lead conversion rate by 34%.",
    name: "Sarah M.",
    role: "VP of Growth, TechScale",
    avatar: "SM",
  },
  {
    quote: "The visual builder is genuinely the best I've used. It's fast, intuitive, and the AI copy suggestions are actually good — not just filler.",
    name: "James K.",
    role: "Performance Marketing Lead, Launchpad",
    avatar: "JK",
  },
  {
    quote: "Smart Traffic changed how we think about optimization. We set it up once and it just keeps improving our conversion rate in the background.",
    name: "Priya D.",
    role: "Head of Digital, Forma Agency",
    avatar: "PD",
  },
];

export default function Testimonials() {
  const { ref, inView } = useInView();
  return (
    <section id="testimonials" className="px-6 py-20 md:py-28" style={{ background: "linear-gradient(180deg, #001f18 0%, #003A30 100%)" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}>
            What Teams Are Saying
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Real results from <span style={{ color: "#C7E738" }}>real teams.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl p-8 flex flex-col gap-6"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(199,231,56,0.1)" }}
            >
              <div className="text-3xl" style={{ color: "#C7E738", fontFamily: "Georgia, serif" }}>"</div>
              <p className="text-gray-200 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "rgba(199,231,56,0.15)", color: "#C7E738" }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-gray-400">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
