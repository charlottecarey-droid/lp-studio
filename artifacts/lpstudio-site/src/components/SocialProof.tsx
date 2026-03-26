import { useInView } from "@/hooks/useInView";

const stats = [
  { value: "5-day", label: "Delivery guarantee" },
  { value: "3×", label: "Faster than code" },
  { value: "100+", label: "Teams onboarded" },
  { value: "99.9%", label: "Uptime SLA" },
];

const tags = [
  "Built for direct-response teams",
  "No-code, no compromise",
  "A/B testing built-in",
  "AI-powered copywriting",
  "Real-time analytics",
];

export default function SocialProof() {
  const { ref, inView } = useInView();
  return (
    <section style={{ background: "#003A30", borderTop: "1px solid rgba(199,231,56,0.12)", borderBottom: "1px solid rgba(199,231,56,0.12)" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto px-6 py-12 md:py-16"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {stats.map(s => (
            <div key={s.value} className="text-center">
              <div className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: "Outfit, sans-serif", color: "#C7E738" }}>{s.value}</div>
              <div className="text-sm text-gray-400">{s.label}</div>
            </div>
          ))}
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
