const productLinks = [
  { label: "Visual Builder", href: "/#features" },
  { label: "A/B Testing", href: "/#features" },
  { label: "AI Copy", href: "/#features" },
  { label: "Heatmaps", href: "/#features" },
  { label: "Smart Traffic", href: "/#features" },
  { label: "Brand System", href: "/#features" },
];

const pricingLinks = [
  { label: "Starter", href: "/#pricing" },
  { label: "Growth", href: "/#pricing" },
  { label: "Enterprise", href: "mailto:sales@lpstudio.ai" },
];

const companyLinks = [
  { label: "About", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

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

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#C7E738" }}>Product</div>
            <ul className="flex flex-col gap-2.5">
              {productLinks.map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                  >{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#C7E738" }}>Pricing</div>
            <ul className="flex flex-col gap-2.5">
              {pricingLinks.map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                  >{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#C7E738" }}>Company</div>
            <ul className="flex flex-col gap-2.5">
              {companyLinks.map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                  >{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#C7E738" }}>Legal</div>
            <ul className="flex flex-col gap-2.5">
              {legalLinks.map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                  >{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>© {new Date().getFullYear()} LP Studio, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.25)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
            >Privacy Policy</a>
            <a href="/terms" className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.25)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
            >Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
