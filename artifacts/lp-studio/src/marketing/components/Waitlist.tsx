import { useInView } from "../hooks/useInView";

export default function Waitlist() {
  const { ref, inView } = useInView();

  return (
    <section
      id="waitlist"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{
        background: "var(--dark)",
        color: "var(--dark-text)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div
        ref={ref}
        className="relative max-w-3xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div
          className="marker marker-rule mb-7"
          style={{ color: "var(--dark-faint)" }}
        >
          Free to start — no card required
        </div>

        <h2
          className="font-display"
          style={{
            color: "var(--dark-text)",
            fontSize: "clamp(44px, 6.4vw, 80px)",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.034em",
            fontVariationSettings: "'opsz' 144",
            maxWidth: 720,
          }}
        >
          Your next landing page is{" "}
          <em
            className="font-display"
            style={{
              fontStyle: "italic",
              color: "var(--cream)",
              fontVariationSettings: "'opsz' 144",
            }}
          >
            already
          </em>{" "}
          half-built.
        </h2>

        <p
          className="mt-7 text-[17px] leading-[1.55]"
          style={{ color: "var(--dark-mute)", maxWidth: 540 }}
        >
          Sign in with Google, create your workspace in 30 seconds, and ship something today.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <a
            href="https://app.lpstudio.ai"
            className="px-6 py-3.5 text-[14px] font-medium transition-all"
            style={{
              background: "var(--cream)",
              color: "var(--ink)",
              borderRadius: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#FFFFFF";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--cream)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Create your workspace
          </a>
          <a
            href="mailto:admin@lpstudio.ai?subject=LP%20Studio%20demo"
            className="px-6 py-3.5 text-[14px] font-medium transition-colors"
            style={{
              background: "transparent",
              color: "var(--dark-text)",
              border: "1px solid var(--dark-hairline)",
              borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(244,239,227,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Talk to sales →
          </a>
        </div>

        <p
          className="font-mono uppercase mt-8"
          style={{ color: "var(--dark-faint)", fontSize: 11, letterSpacing: "0.16em" }}
        >
          Sign in with Google · No setup · Cancel any time
        </p>
      </div>
    </section>
  );
}
