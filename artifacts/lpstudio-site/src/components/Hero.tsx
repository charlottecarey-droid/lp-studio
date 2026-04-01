export default function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #000 60%, #001f18 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 800px 500px at 50% 30%, rgba(199,231,56,0.06) 0%, transparent 70%)"
      }} />

      <div className="relative max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 animate-fade-in"
          style={{ background: "rgba(199,231,56,0.1)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.25)", animationDelay: "0s" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#C7E738" }} />
          Now in early access — limited spots available
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fade-up"
          style={{ fontFamily: "Outfit, sans-serif", animationDelay: "0.1s" }}
        >
          Build landing pages that{" "}
          <span style={{ color: "#C7E738" }}>actually convert.</span>
        </h1>

        <p
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          LP Studio is the all-in-one platform for direct-response teams. Visual builder, A/B testing, AI copy, heatmaps — all in one place. Ship in days, not months.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <a
            href="https://app.lpstudio.ai"
            className="px-8 py-4 rounded-full text-base font-bold transition-all shadow-lg"
            style={{ background: "#C7E738", color: "#000", fontFamily: "Outfit, sans-serif", boxShadow: "0 0 32px rgba(199,231,56,0.25)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#d6f54a"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#C7E738"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Start for Free
          </a>
          <a
            href="#how-it-works"
            className="px-8 py-4 rounded-full text-base font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            See How It Works
          </a>
        </div>

        <div className="mt-16 animate-fade-up" style={{ animationDelay: "0.45s" }}>
          <div
            className="relative mx-auto rounded-2xl overflow-hidden"
            style={{
              maxWidth: 900,
              border: "1px solid rgba(199,231,56,0.15)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
              background: "#003A30"
            }}
          >
            <div className="h-8 flex items-center gap-2 px-4" style={{ background: "#001f18", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
              <span className="ml-4 text-xs text-gray-500">LP Studio — Visual Builder</span>
            </div>
            <div className="p-6 md:p-10" style={{ minHeight: 320 }}>
              <div className="grid grid-cols-12 gap-4 h-full">
                <div className="col-span-3 rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Hero", "Features", "Pricing", "Testimonials", "CTA", "Footer"].map(s => (
                    <div key={s} className="px-3 py-2 rounded-lg text-xs text-gray-300 cursor-pointer transition-all first:text-white first:font-semibold"
                      style={{ background: s === "Hero" ? "rgba(199,231,56,0.12)" : "transparent", color: s === "Hero" ? "#C7E738" : undefined }}>
                      {s}
                    </div>
                  ))}
                </div>
                <div className="col-span-6 rounded-xl flex flex-col gap-3 p-4" style={{ background: "#003A30", border: "1px solid rgba(199,231,56,0.1)" }}>
                  <div className="rounded-lg h-12 flex items-center justify-center text-sm font-bold" style={{ background: "rgba(199,231,56,0.15)", color: "#C7E738" }}>
                    Your Next Big Campaign Starts Here
                  </div>
                  <div className="rounded-lg h-6 w-3/4" style={{ background: "rgba(255,255,255,0.05)" }} />
                  <div className="rounded-lg h-6 w-1/2" style={{ background: "rgba(255,255,255,0.05)" }} />
                  <div className="mt-2 rounded-full h-9 w-32 flex items-center justify-center text-xs font-bold" style={{ background: "#C7E738", color: "#000" }}>
                    Get Started
                  </div>
                </div>
                <div className="col-span-3 rounded-xl p-3 flex flex-col gap-3" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Properties</div>
                  {[["Font", "Outfit Bold"], ["Color", "#C7E738"], ["Size", "64px"], ["Align", "Center"]].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-gray-500">{k}</span>
                      <span className="text-gray-200">{v}</span>
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
