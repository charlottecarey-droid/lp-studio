import { useInView } from "@/hooks/useInView";

const stats = [
  { value: "< 1 hr", label: "From brief to live page" },
  { value: "3×", label: "Faster than building from code" },
  { value: "100+", label: "Revenue teams onboarded" },
  { value: "99.9%", label: "Uptime SLA" },
];

const tags = [
  "Built for revenue teams",
  "On-brand, every time",
  "AI copy that actually sounds human",
  "A/B testing built-in",
  "Instant publishing",
];

const logos = [
  { name: "Meridian Health", abbr: "MH" },
  { name: "Vantage Growth", abbr: "VG" },
  { name: "Apex Revenue", abbr: "AR" },
  { name: "Fieldstone", abbr: "FS" },
  { name: "Cornerstone GTM", abbr: "CG" },
];

export default function SocialProof() {
  const { ref, inView } = useInView();
  return (
    <section style={{ background: "#002B24", borderTop: "1px solid rgba(199,231,56,0.12)", borderBottom: "1px solid rgba(199,231,56,0.12)" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto px-6 py-12 md:py-16"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {stats.map(s => (
            <div key={s.value} className="text-center">
              <div className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: "Outfit, sans-serif", color: "#C7E738" }}>{s.value}</div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-10">
          <p className="text-center text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: "rgba(255,255,255,0.2)" }}>
            Trusted by revenue teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {logos.map(logo => (
              <div key={logo.name} className="flex items-center gap-2.5 opacity-40 hover:opacity-70 transition-opacity">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: "rgba(199,231,56,0.15)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.2)" }}
                >
                  {logo.abbr}
                </div>
                <span className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>{logo.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {tags.map(tag => (
            <span
              key={tag}
              className="px-4 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
