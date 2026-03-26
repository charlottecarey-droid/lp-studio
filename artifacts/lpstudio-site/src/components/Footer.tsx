const links = {
  Product: ["Visual Builder", "A/B Testing", "AI Copy", "Heatmaps", "Smart Traffic", "Brand System"],
  Pricing: ["Starter", "Growth", "Enterprise", "Compare Plans"],
  Company: ["About", "Blog", "Careers", "Press"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy"],
};

export default function Footer() {
  return (
    <footer style={{ background: "#000", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4 text-white font-display font-bold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>
              <span style={{ color: "#C7E738" }}>LP</span>
              <span>Studio</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              The all-in-one landing page platform built for direct-response teams who don't settle for average.
            </p>
          </div>

          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#C7E738" }}>{group}</div>
              <ul className="flex flex-col gap-2.5">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} LP Studio, Inc. All rights reserved.</p>
          <p className="text-xs text-gray-600">Made for direct-response teams everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
