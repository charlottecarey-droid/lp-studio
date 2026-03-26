import { useInView } from "@/hooks/useInView";

const features = [
  {
    icon: "✦",
    title: "Visual Builder",
    desc: "Drag-and-drop blocks, real-time preview, and pixel-perfect control. No design tools required — just drag, drop, and publish.",
  },
  {
    icon: "⚡",
    title: "A/B Testing",
    desc: "Run multi-variant tests with statistical significance tracking. Know exactly which version converts before going wide.",
  },
  {
    icon: "✍️",
    title: "AI Copy",
    desc: "Generate high-converting headlines, CTAs, and body copy with AI trained on direct-response best practices.",
  },
  {
    icon: "🔥",
    title: "Heatmaps",
    desc: "See where visitors click, scroll, and drop off. Make data-backed decisions to optimize every fold.",
  },
  {
    icon: "🎯",
    title: "Smart Traffic",
    desc: "Route visitors to the best-performing variant automatically. Let the algorithm maximize your conversion rate.",
  },
  {
    icon: "🎨",
    title: "Brand System",
    desc: "Set your fonts, colors, and logo once. Every page you create stays on-brand automatically — zero rework.",
  },
];

export default function Features() {
  const { ref, inView } = useInView();
  return (
    <section id="features" className="px-6 py-20 md:py-28" style={{ background: "#000" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}>
            Everything You Need
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Six capabilities. <span style={{ color: "#C7E738" }}>One platform.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Stop stitching together a dozen tools. LP Studio has everything your direct-response team needs to launch, test, and optimize.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl transition-all cursor-default"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                animationDelay: `${i * 0.08}s`
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(199,231,56,0.04)";
                e.currentTarget.style.borderColor = "rgba(199,231,56,0.2)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
              }}
            >
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2 text-white" style={{ fontFamily: "Outfit, sans-serif" }}>{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
