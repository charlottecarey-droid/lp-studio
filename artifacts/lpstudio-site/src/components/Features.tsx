import { useInView } from "@/hooks/useInView";

const features = [
  {
    icon: "✦",
    title: "Visual Builder",
    desc: "Drag-and-drop blocks, real-time preview, pixel-perfect control. Go from blank canvas to live page without touching code or waiting on a designer.",
  },
  {
    icon: "⚡",
    title: "AI Copy",
    desc: "Generate headlines, CTAs, and body copy specific to each account — in your brand voice. Not generic filler. Actual sentences you'd write yourself.",
  },
  {
    icon: "🎨",
    title: "Brand System",
    desc: "Set your fonts, colors, logo, and tone of voice once. Every page your team builds stays on-brand automatically — no QA, no rework.",
  },
  {
    icon: "🔀",
    title: "A/B Testing",
    desc: "Run multi-variant tests with significance tracking. Know exactly which version converts before you scale spend or send to more accounts.",
  },
  {
    icon: "🔥",
    title: "Heatmaps",
    desc: "See where visitors click, scroll, and drop off. Make data-backed decisions on what to fix and what to keep.",
  },
  {
    icon: "🎯",
    title: "Smart Traffic",
    desc: "Route visitors to your best-performing variant automatically. Set it up once and let the algorithm do the work.",
  },
];

export default function Features() {
  const { ref, inView } = useInView();
  return (
    <section id="features" className="px-6 py-20 md:py-28" style={{ background: "#003A30" }}>
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
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
            Six capabilities. <span style={{ color: "#C7E738" }}>One platform.</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
            Stop stitching together a dozen tools. LP Studio has everything a revenue team needs to build fast, stay on brand, and keep improving.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl transition-all cursor-default"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                animationDelay: `${i * 0.08}s`
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(199,231,56,0.06)";
                e.currentTarget.style.borderColor = "rgba(199,231,56,0.22)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2 text-white" style={{ fontFamily: "Outfit, sans-serif" }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
