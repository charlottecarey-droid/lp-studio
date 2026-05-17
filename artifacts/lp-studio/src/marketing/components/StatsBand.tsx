import { useEffect, useState } from "react";
import { useInView } from "../hooks/useInView";

// Stats rendered side-by-side along the editorial cream band. Each stat has
// a numeric value that counts up on view, a tiny per-stat visualisation
// (sparkline / bar burst / dial / row of dots) coloured with the accent,
// and a soft tinted tile background so the band reads as a row of curated
// "cards" rather than four flat numbers.
const stats: {
  value: number;
  fmt: (n: number) => string;
  suffix: string;
  label: string;
  delta?: string;
  color: string;
  tint: string;
  viz: "spark" | "bars" | "dial" | "dots";
}[] = [
  {
    value: 1.2,
    fmt: (n) => n.toFixed(1),
    suffix: "M",
    label: "Pages launched",
    delta: "+34% YoY",
    color: "var(--indigo)",
    tint: "var(--indigo-soft)",
    viz: "spark",
  },
  {
    value: 4.8,
    fmt: (n) => n.toFixed(1),
    suffix: "×",
    label: "Median conversion lift",
    delta: "vs hand-built",
    color: "var(--coral)",
    tint: "var(--coral-soft)",
    viz: "bars",
  },
  {
    value: 47,
    fmt: (n) => Math.round(n).toString(),
    suffix: "s",
    label: "Brief to live, median",
    delta: "P95: 1m 12s",
    color: "var(--sage)",
    tint: "var(--sage-soft)",
    viz: "dial",
  },
  {
    value: 1200,
    fmt: (n) => Math.round(n).toLocaleString(),
    suffix: "+",
    label: "Revenue teams shipping",
    delta: "94 added this month",
    color: "var(--gold)",
    tint: "var(--gold-soft)",
    viz: "dots",
  },
];

function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic — counts up fast at first then settles.
      const eased = 1 - Math.pow(1 - t, 3);
      setV(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return v;
}

function Spark({ color }: { color: string }) {
  // 12-point gently-rising sparkline with a soft fill underneath.
  return (
    <svg viewBox="0 0 120 36" width="100%" height={36} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="ss-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,30 L12,26 L24,28 L36,22 L48,24 L60,16 L72,18 L84,12 L96,14 L108,8 L120,4 L120,36 L0,36 Z"
        fill="url(#ss-fill)"
      />
      <path
        d="M0,30 L12,26 L24,28 L36,22 L48,24 L60,16 L72,18 L84,12 L96,14 L108,8 L120,4"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="120" cy="4" r="2.6" fill="#FFFFFF" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function Bars({ color }: { color: string }) {
  // A vs B bar comparison — the second bar is taller, accenting the lift.
  return (
    <svg viewBox="0 0 120 36" width="100%" height={36} preserveAspectRatio="none" aria-hidden="true">
      <rect x="6"   y="20" width="14" height="14" rx="2" fill={color} fillOpacity="0.28" />
      <rect x="28"  y="10" width="14" height="24" rx="2" fill={color} />
      <rect x="50"  y="22" width="14" height="12" rx="2" fill={color} fillOpacity="0.28" />
      <rect x="72"  y="4"  width="14" height="30" rx="2" fill={color} />
      <rect x="94"  y="16" width="14" height="18" rx="2" fill={color} fillOpacity="0.28" />
      <path d="M0 35 L120 35" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
    </svg>
  );
}

function Dial({ color }: { color: string }) {
  // 3/4 dial with most of the arc filled — reads as "fast".
  const R = 18;
  const C = R * 2 * Math.PI;
  const filled = C * 0.74;
  return (
    <svg viewBox="0 0 64 40" width="100%" height={40} aria-hidden="true">
      <circle cx="32" cy="32" r={R} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="4" />
      <circle
        cx="32"
        cy="32"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${C - filled}`}
        strokeDashoffset={C * 0.625}
      />
      <text
        x="32"
        y="34"
        fontSize="9"
        textAnchor="middle"
        fill={color}
        style={{ fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif", fontWeight: 700, letterSpacing: "0.02em" }}
      >
        P95
      </text>
    </svg>
  );
}

function Dots({ color }: { color: string }) {
  // 5×8 grid of dots — most filled with the accent, a row added "this week".
  return (
    <svg viewBox="0 0 120 36" width="100%" height={36} aria-hidden="true">
      {Array.from({ length: 5 }).flatMap((_, r) =>
        Array.from({ length: 12 }).map((_, c) => {
          const filled = r * 12 + c < 50;
          const fresh = r * 12 + c >= 44 && r * 12 + c < 50;
          return (
            <circle
              key={`${r}-${c}`}
              cx={6 + c * 9.5}
              cy={4 + r * 7}
              r={fresh ? 2.4 : 2}
              fill={filled ? color : "currentColor"}
              fillOpacity={fresh ? 1 : filled ? 0.85 : 0.18}
              stroke={fresh ? "#FFFFFF" : "none"}
              strokeWidth={fresh ? 0.8 : 0}
            />
          );
        }),
      )}
    </svg>
  );
}

export default function StatsBand() {
  const { ref, inView } = useInView();
  return (
    <section
      className="px-6 py-20 md:py-24 relative overflow-hidden"
      style={{
        background: "var(--cream)",
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      {/* Soft band glow — subtle hairline of indigo behind the row so it
       *  reads as a curated stats strip, not just borders. */}
      <div
        aria-hidden
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          height: 180,
          background:
            "radial-gradient(ellipse at center, rgba(75,71,229,0.06) 0%, rgba(75,71,229,0) 70%)",
          filter: "blur(2px)",
        }}
      />

      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(16px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} active={inView} delayMs={i * 90} />
        ))}
      </div>
    </section>
  );
}

function StatCard({
  value,
  fmt,
  suffix,
  label,
  delta,
  color,
  tint,
  viz,
  active,
  delayMs,
}: (typeof stats)[number] & { active: boolean; delayMs: number }) {
  // Delay the count-up per-card so the row cascades in.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setArmed(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  const v = useCountUp(value, armed);

  return (
    <div
      className="relative rounded-xl p-5 md:p-6 overflow-hidden"
      style={{
        background: tint,
        border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
    >
      {/* Corner glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `radial-gradient(circle, color-mix(in srgb, ${color} 22%, transparent) 0%, transparent 65%)`,
          filter: "blur(4px)",
        }}
      />
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span
              className="font-display tabular-nums"
              style={{
                color,
                fontSize: "clamp(38px, 4.2vw, 52px)",
                fontWeight: 600,
                letterSpacing: "-0.032em",
                lineHeight: 1,
              }}
            >
              {fmt(v)}
            </span>
            <span
              className="font-display"
              style={{
                color,
                opacity: 0.7,
                fontSize: "clamp(20px, 2vw, 26px)",
                fontWeight: 500,
                letterSpacing: "-0.018em",
                lineHeight: 1,
              }}
            >
              {suffix}
            </span>
          </div>
        </div>
        {delta && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] uppercase shrink-0"
            style={{
              background: "rgba(255,255,255,0.7)",
              color,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              letterSpacing: "0.12em",
              fontWeight: 700,
              backdropFilter: "blur(4px)",
            }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5"/>
              <path d="M5 12l7-7 7 7"/>
            </svg>
            <span style={{ whiteSpace: "nowrap" }}>{delta}</span>
          </span>
        )}
      </div>

      {/* Mini visualisation */}
      <div className="relative mb-4" style={{ color }}>
        {viz === "spark" && <Spark color={color} />}
        {viz === "bars" && <Bars color={color} />}
        {viz === "dial" && <Dial color={color} />}
        {viz === "dots" && <Dots color={color} />}
      </div>

      <div
        className="font-mono uppercase relative"
        style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.06em" }}
      >
        {label}
      </div>
    </div>
  );
}
