import { useInView } from "@/marketing/hooks/useInView";

const stats = [
  { value: "1.2M", suffix: "+", label: "Pages launched" },
  { value: "4.8", suffix: "×", label: "Avg conversion lift" },
  { value: "47", suffix: "min", label: "From brief to live" },
  { value: "1,200", suffix: "+", label: "Revenue teams" },
];

export default function StatsBand() {
  const { ref, inView } = useInView();
  return (
    <section
      className="px-6 py-16 md:py-20"
      style={{
        background: "#0A0A0A",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        ref={ref}
        className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(16px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="px-6 py-6 md:py-2"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftStyle: "solid",
            }}
          >
            <div className="flex items-baseline gap-1 mb-2">
              <span
                className="font-display text-4xl md:text-5xl font-semibold"
                style={{ color: "#FAFAFA", letterSpacing: "-0.04em" }}
              >
                {s.value}
              </span>
              <span
                className="font-display text-2xl md:text-3xl font-medium"
                style={{ color: "#D4F542", letterSpacing: "-0.03em" }}
              >
                {s.suffix}
              </span>
            </div>
            <div className="text-[13px]" style={{ color: "rgba(250,250,250,0.5)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
