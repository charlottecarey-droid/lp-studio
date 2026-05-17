import { useInView } from "../hooks/useInView";

const TRUSTED_BY = [
  { name: "Northwind",  mark: "circle"   },
  { name: "Acme",       mark: "triangle" },
  { name: "Globex",     mark: "square"   },
  { name: "Initech",    mark: "wave"     },
  { name: "Umbrella",   mark: "hex"      },
  { name: "Vandelay",   mark: "diamond"  },
];

function Mark({ kind }: { kind: string }) {
  const color = "rgba(244,239,227,0.55)";
  if (kind === "circle") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="12" r="2.5" fill={color} />
      </svg>
    );
  }
  if (kind === "triangle") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4l8 14H4z" fill={color}/>
      </svg>
    );
  }
  if (kind === "square") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="2" fill={color}/>
        <rect x="9" y="9" width="6" height="6" rx="1" fill="var(--dark)"/>
      </svg>
    );
  }
  if (kind === "wave") {
    return (
      <svg width="18" height="12" viewBox="0 0 32 18" aria-hidden="true">
        <path d="M0 9 Q 4 0, 8 9 T 16 9 T 24 9 T 32 9" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (kind === "hex") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 4.5v9L12 21l-7-4.5v-9z" fill="none" stroke={color} strokeWidth="2"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l9 9-9 9-9-9z" fill="none" stroke={color} strokeWidth="2"/>
    </svg>
  );
}

export default function Waitlist() {
  const { ref, inView } = useInView();

  return (
    <section
      id="waitlist"
      className="px-6 py-28 md:py-40 relative overflow-hidden"
      style={{
        background: "var(--dark)",
        color: "var(--dark-text)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <style>{`
        @keyframes lpw-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes lpw-aurora { 0%, 100% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(3%,-2%,0) scale(1.06) } }
      `}</style>

      {/* Aurora orbs */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-10%",
          left: "10%",
          width: 640,
          height: 640,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.45) 0%, rgba(75,71,229,0.16) 35%, rgba(75,71,229,0) 70%)",
          filter: "blur(10px)",
          animation: "lpw-aurora 18s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "-15%",
          right: "-5%",
          width: 580,
          height: 580,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(226,107,79,0.30) 0%, rgba(226,107,79,0.08) 40%, rgba(226,107,79,0) 70%)",
          filter: "blur(10px)",
          animation: "lpw-aurora 22s ease-in-out infinite reverse",
        }}
      />

      {/* Subtle dot grid on the dark background */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(244,239,227,0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          opacity: 0.5,
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, rgba(0,0,0,0) 85%)",
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, rgba(0,0,0,0) 85%)",
        }}
      />

      <div
        ref={ref}
        className="relative max-w-3xl mx-auto text-center"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Eyebrow pill */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
          style={{
            background: "rgba(244,239,227,0.06)",
            border: "1px solid rgba(244,239,227,0.14)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--indigo)",
              boxShadow: "0 0 8px var(--indigo)",
            }}
          />
          <span
            className="text-[11px] uppercase"
            style={{ color: "var(--dark-mute)", letterSpacing: "0.22em", fontWeight: 600 }}
          >
            Free to start · no card required
          </span>
        </div>

        <h2
          className="font-display"
          style={{
            color: "var(--dark-text)",
            fontSize: "clamp(46px, 6.4vw, 84px)",
            fontWeight: 500,
            lineHeight: 1.0,
            letterSpacing: "-0.038em",
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          Your next landing page is{" "}
          <span
            className="font-display"
            style={{
              background: "linear-gradient(135deg, var(--cream) 0%, #F4A172 50%, var(--cream) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            already
          </span>{" "}
          <span
            className="font-display"
            style={{
              background: "linear-gradient(135deg, var(--cream) 0%, #F4A172 50%, var(--cream) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            half-built.
          </span>
        </h2>

        <p
          className="mt-7 text-[17px] leading-[1.55] max-w-xl mx-auto"
          style={{ color: "var(--dark-mute)" }}
        >
          Sign in with Google, create your workspace in 30 seconds, and ship something today.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="https://app.lpstudio.ai"
            className="relative px-7 py-3.5 text-[14px] inline-flex items-center gap-2 overflow-hidden"
            style={{
              background: `linear-gradient(180deg, #6C68F0 0%, var(--indigo) 100%)`,
              color: "#FFFFFF",
              fontWeight: 600,
              letterSpacing: "-0.005em",
              borderRadius: 8,
              fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
              boxShadow:
                "0 10px 24px -6px rgba(75,71,229,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
              border: "1px solid color-mix(in srgb, var(--indigo) 80%, white 30%)",
              transition: "transform 120ms ease, filter 200ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.filter = "brightness(1.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.filter = "none";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4L12 3z" />
            </svg>
            <span>Create your workspace</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14"/>
              <path d="M13 5l7 7-7 7"/>
            </svg>
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "lpw-shimmer 3s linear infinite",
                mixBlendMode: "overlay",
                pointerEvents: "none",
              }}
            />
          </a>
          <a
            href="mailto:admin@lpstudio.ai?subject=LP%20Studio%20demo"
            className="px-6 py-3.5 text-[14px] inline-flex items-center gap-2 transition-all"
            style={{
              background: "rgba(244,239,227,0.04)",
              color: "var(--dark-text)",
              border: "1px solid var(--dark-hairline)",
              borderRadius: 8,
              fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(244,239,227,0.10)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(244,239,227,0.04)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Talk to sales
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14"/>
              <path d="M13 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        <p
          className="font-mono uppercase mt-8"
          style={{ color: "var(--dark-faint)", fontSize: 11, letterSpacing: "0.16em" }}
        >
          Sign in with Google · no setup · cancel any time
        </p>

        {/* Reassurance row */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { value: "30s", label: "Workspace setup" },
            { value: "5 min", label: "First page live" },
            { value: "14 days", label: "Free trial on Growth" },
          ].map((m, i) => (
            <div
              key={m.label}
              className="flex items-baseline justify-center gap-2"
              style={{
                borderLeft: i === 0 ? "none" : "1px solid var(--dark-hairline)",
                paddingLeft: i === 0 ? 0 : 12,
              }}
            >
              <span
                className="font-display tabular-nums"
                style={{
                  color: "var(--dark-text)",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.022em",
                  lineHeight: 1,
                }}
              >
                {m.value}
              </span>
              <span className="text-[12px]" style={{ color: "var(--dark-mute)" }}>
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* Trusted-by strip */}
        <div className="mt-14">
          <div
            className="text-[10px] uppercase mb-5"
            style={{ color: "var(--dark-faint)", letterSpacing: "0.22em", fontWeight: 600 }}
          >
            — Trusted by revenue teams at —
          </div>
          <div className="flex items-center justify-center flex-wrap gap-x-8 gap-y-4">
            {TRUSTED_BY.map((b) => (
              <div key={b.name} className="flex items-center gap-1.5">
                <Mark kind={b.mark} />
                <span
                  style={{
                    color: "rgba(244,239,227,0.55)",
                    fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
                    fontSize: 12.5,
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {b.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
