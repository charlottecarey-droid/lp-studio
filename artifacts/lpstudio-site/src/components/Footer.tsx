const links = {
  Product: ["Visual Builder", "A/B Testing", "AI Copy", "Heatmaps", "Smart Traffic", "Brand System"],
  Pricing: ["Starter", "Growth", "Enterprise", "Compare Plans"],
  Company: ["About", "Blog", "Careers", "Press"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy"],
};

export default function Footer() {
  return (
    <footer style={{ background: "#001f18", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4 text-white font-display font-bold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>
              <span style={{ color: "#C7E738" }}>LP</span>
              <span>Studio</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
              The landing page platform for revenue teams who need to move fast without going off-brand.
            </p>
          </div>

          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#C7E738" }}>{group}</div>
              <ul className="flex flex-col gap-2.5">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                    >{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>© {new Date().getFullYear()} LP Studio, Inc. All rights reserved.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Made for revenue teams everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
