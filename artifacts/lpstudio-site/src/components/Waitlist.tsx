import { useInView } from "@/hooks/useInView";

const LIME = "#D4F542";

export default function Waitlist() {
  const { ref, inView } = useInView();

  return (
    <section
      id="waitlist"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 700px 280px at 50% 100%, rgba(212,245,66,0.06), transparent 70%)",
        }}
      />
      <div
        ref={ref}
        className="relative max-w-2xl mx-auto text-center"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="eyebrow mb-6">Free to start — no card required</div>

        <h2 className="font-display text-[44px] md:text-[60px] leading-[1] font-semibold text-white">
          Build pages that <span className="" style={{ color: LIME }}>convert</span>.
        </h2>
        <p className="mt-6 text-[17px] leading-relaxed" style={{ color: "rgba(250,250,250,0.6)" }}>
          Sign in with Google, create your workspace in 30 seconds, and start building.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="https://app.lpstudio.ai"
            className="px-6 py-3 rounded-md text-[14px] font-medium transition-all"
            style={{ background: LIME, color: "#0A0A0A" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#dcf85a";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = LIME;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Create your workspace
          </a>
          <a
            href="mailto:sales@lpstudio.ai?subject=LP%20Studio%20demo"
            className="px-6 py-3 rounded-md text-[14px] font-medium transition-colors"
            style={{
              background: "transparent",
              color: "rgba(250,250,250,0.85)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Talk to sales →
          </a>
        </div>

        <p className="text-[12px] mt-6" style={{ color: "rgba(250,250,250,0.35)" }}>
          Sign in with Google · No setup required · Cancel any time
        </p>
      </div>
    </section>
  );
}
