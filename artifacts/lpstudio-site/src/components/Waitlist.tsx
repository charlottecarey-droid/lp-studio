import { useInView } from "@/hooks/useInView";

export default function Waitlist() {
  const { ref, inView } = useInView();

  return (
    <section
      id="get-started"
      className="px-6 py-20 md:py-28"
      style={{ background: "#000", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        ref={ref}
        className="max-w-2xl mx-auto text-center"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#C7E738" }} />
          Free to start — no credit card required
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
          Ready to build pages that <span style={{ color: "#C7E738" }}>convert?</span>
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Sign in with Google, create your workspace in 30 seconds, and start building.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://app.lpstudio.ai"
            className="px-10 py-4 rounded-full text-base font-bold transition-all"
            style={{
              background: "#C7E738",
              color: "#000",
              fontFamily: "Outfit, sans-serif",
              boxShadow: "0 0 40px rgba(199,231,56,0.2)"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#d6f54a"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#C7E738"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Create Your Workspace
          </a>
        </div>

        <p className="text-xs text-gray-600 mt-6">
          Sign in with Google · No setup required · Cancel any time
        </p>
      </div>
    </section>
  );
}
