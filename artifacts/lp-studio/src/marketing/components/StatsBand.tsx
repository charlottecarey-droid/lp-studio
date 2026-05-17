import { useInView } from "../hooks/useInView";

const stats = [
  { value: "1.2", suffix: "M", label: "Pages launched", color: "var(--indigo)" },
  { value: "4.8", suffix: "×", label: "Median conversion lift", color: "var(--coral)" },
  { value: "47", suffix: "min", label: "Brief to live, median", color: "var(--sage)" },
  { value: "1,200", suffix: "", label: "Revenue teams shipping", color: "var(--gold)" },
];

export default function StatsBand() {
  const { ref, inView } = useInView();
  return (
    <section
      className="px-6 py-20 md:py-24"
      style={{
        background: "var(--cream)",
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto grid grid-cols-2 md:grid-cols-4"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(16px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="px-6 py-5 md:py-2"
            style={{
              borderLeft: i === 0 ? "none" : "1px solid var(--hairline)",
            }}
          >
            <div className="flex items-baseline gap-1 mb-2.5">
              <span
                className="font-display"
                style={{
                  color: s.color,
                  fontSize: "clamp(40px, 4.4vw, 56px)",
                  fontWeight: 600,
                  letterSpacing: "-0.032em",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </span>
              <span
                className="font-display"
                style={{
                  color: s.color,
                  opacity: 0.6,
                  fontSize: "clamp(22px, 2.2vw, 28px)",
                  fontWeight: 500,
                  letterSpacing: "-0.018em",
                  lineHeight: 1,
                }}
              >
                {s.suffix}
              </span>
            </div>
            <div
              className="font-mono uppercase"
              style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.04em" }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
