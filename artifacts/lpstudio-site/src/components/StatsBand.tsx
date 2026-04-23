import { useInView } from "@/hooks/useInView";

const stats = [
  { value: "1.2M+", label: "Pages launched" },
  { value: "4.8×", label: "Avg conversion lift" },
  { value: "47 min", label: "From brief to live" },
  { value: "1,200+", label: "Revenue teams shipping" },
];

export default function StatsBand() {
  const { ref, inView } = useInView();
  return (
    <section
      className="px-6 py-14 md:py-20 relative"
      style={{
        background: "#000",
        borderTop: "1px solid rgba(199,231,56,0.08)",
        borderBottom: "1px solid rgba(199,231,56,0.08)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 1000px 200px at 50% 50%, rgba(199,231,56,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        ref={ref}
        className="relative max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {stats.map((s, i) => (
          <div key={s.label} className="text-center" style={{ transitionDelay: `${i * 70}ms` }}>
            <div
              className="text-4xl md:text-5xl font-bold mb-2"
              style={{
                color: "#C7E738",
                fontFamily: "Outfit, sans-serif",
                textShadow: "0 0 30px rgba(199,231,56,0.25)",
              }}
            >
              {s.value}
            </div>
            <div
              className="text-xs md:text-sm uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
