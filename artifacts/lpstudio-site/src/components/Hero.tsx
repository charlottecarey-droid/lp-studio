export default function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden"
      style={{ background: "#003A30" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 900px 600px at 50% 20%, rgba(199,231,56,0.08) 0%, transparent 65%)"
      }} />

      <div className="relative max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 animate-fade-in"
          style={{ background: "rgba(199,231,56,0.12)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.3)", animationDelay: "0s" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#C7E738" }} />
          Built for revenue teams
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fade-up"
          style={{ fontFamily: "Outfit, sans-serif", animationDelay: "0.1s" }}
        >
          Fast, branded landing pages{" "}
          <span style={{ color: "#C7E738" }}>for revenue teams.</span>
        </h1>

        <p
          className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up"
          style={{ color: "rgba(255,255,255,0.65)", animationDelay: "0.2s" }}
        >
          Build personalized pages in minutes — AI copy, on-brand design, instant publishing. No waiting on marketing. No going off-script.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <a
            href="https://app.lpstudio.ai"
            className="px-8 py-4 rounded-full text-base font-bold transition-all shadow-lg"
            style={{ background: "#C7E738", color: "#003A30", fontFamily: "Outfit, sans-serif", boxShadow: "0 0 40px rgba(199,231,56,0.3)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#d6f54a"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#C7E738"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Start Building Free
          </a>
          <a
            href="#how-it-works"
            className="px-8 py-4 rounded-full text-base font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >
            See How It Works
          </a>
        </div>

        <div className="mt-16 animate-fade-up" style={{ animationDelay: "0.45s" }}>
          <div
            className="relative mx-auto rounded-2xl overflow-hidden"
            style={{
              maxWidth: 900,
              border: "1px solid rgba(199,231,56,0.2)",
              boxShadow: "0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
              background: "#002B24"
            }}
          >
            <div className="h-8 flex items-center gap-2 px-4" style={{ background: "#001f18", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
              <span className="ml-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>LP Studio — Visual Builder</span>
            </div>
            <div className="p-6 md:p-10" style={{ minHeight: 320 }}>
              <div className="grid grid-cols-12 gap-4 h-full">
                <div className="col-span-3 rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Hero", "Features", "Pricing", "Testimonials", "CTA", "Footer"].map(s => (
                    <div key={s} className="px-3 py-2 rounded-lg text-xs cursor-pointer transition-all"
                      style={{
                        background: s === "Hero" ? "rgba(199,231,56,0.14)" : "transparent",
                        color: s === "Hero" ? "#C7E738" : "rgba(255,255,255,0.45)",
                        fontWeight: s === "Hero" ? 600 : 400
                      }}>
                      {s}
                    </div>
                  ))}
                </div>
                <div className="col-span-6 rounded-xl flex flex-col gap-3 p-4" style={{ background: "#003A30", border: "1px solid rgba(199,231,56,0.12)" }}>
                  <div className="rounded-lg h-12 flex items-center justify-center text-sm font-bold" style={{ background: "rgba(199,231,56,0.15)", color: "#C7E738" }}>
                    Your Next Big Campaign Starts Here
                  </div>
                  <div className="rounded-lg h-5 w-3/4" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="rounded-lg h-5 w-1/2" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="mt-2 rounded-full h-9 w-32 flex items-center justify-center text-xs font-bold" style={{ background: "#C7E738", color: "#003A30" }}>
                    Get Started
                  </div>
                </div>
                <div className="col-span-3 rounded-xl p-3 flex flex-col gap-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Properties</div>
                  {[["Font", "Outfit Bold"], ["Color", "#C7E738"], ["Size", "64px"], ["Align", "Center"]].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span style={{ color: "rgba(255,255,255,0.35)" }}>{k}</span>
                      <span style={{ color: "rgba(255,255,255,0.8)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
