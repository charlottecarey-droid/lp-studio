import navyDepthIcon from "@assets/lp-icon-navy-depth_1781930852665.svg";

// All in-page hashes target ids that actually exist on the new home —
// see home.tsx (FeatureRow id="builder", id="generate", id="templates",
// id="sales-console") plus the section ids on Integrations / Pricing /
// FAQ. The legacy /#features, /#waitlist, /#testimonials hashes pointed
// at sections that were cut in the homepage rewrite and are gone.
const productLinks = [
  { label: "Visual Builder", href: "/#builder" },
  { label: "AI Generation", href: "/#generate" },
  { label: "Campaigns", href: "/for-marketing#campaigns" },
  { label: "Analytics", href: "/#analytics" },
  { label: "For Marketing", href: "/for-marketing" },
  { label: "For Sales", href: "/for-sales" },
  { label: "Integrations", href: "/docs/integrations" },
  { label: "Compare", href: "/compare" },
];

const pricingLinks = [
  { label: "Plans & Pricing", href: "/pricing" },
  { label: "Start a workspace", href: "https://app.lpstudio.ai" },
  { label: "Contact Sales", href: "mailto:admin@lpstudio.ai?subject=LP%20Studio%20-%20Sales%20inquiry" },
];

const companyLinks = [
  { label: "Blog", href: "/blog" },
  { label: "About", href: "mailto:admin@lpstudio.ai?subject=About%20LP%20Studio" },
  { label: "FAQ", href: "/#faq" },
  { label: "Careers", href: "mailto:admin@lpstudio.ai?subject=Careers%20at%20LP%20Studio" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Security", href: "mailto:admin@lpstudio.ai?subject=Security%20inquiry" },
];

const LINK_BASE = { color: "var(--ink-soft)" } as const;
const LINK_HOVER = "var(--ink)";

const sections: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Product", links: productLinks },
  { title: "Pricing", links: pricingLinks },
  { title: "Company", links: companyLinks },
  { title: "Legal", links: legalLinks },
];

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--cream)",
        color: "var(--ink)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 pt-12 pb-10">
        {/* Status row */}
        <div
          className="flex items-center justify-between flex-wrap gap-3 pb-10"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <a
            href="https://status.lpstudio.ai"
            className="inline-flex items-center gap-2 transition-colors"
            style={{ color: "var(--ink-soft)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
          >
            <span style={{ position: "relative", width: 8, height: 8, display: "inline-block" }}>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: "var(--sage)",
                  opacity: 0.45,
                  animation: "lpf-ping 1.8s ease-out infinite",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 2,
                  borderRadius: 999,
                  background: "var(--sage)",
                  boxShadow: "0 0 6px var(--sage)",
                }}
              />
            </span>
            <span
              className="text-[12.5px]"
              style={{ fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif", fontWeight: 600 }}
            >
              All systems normal
            </span>
            <span style={{ color: "var(--ink-faint)" }}>·</span>
            <span
              className="text-[11.5px] uppercase"
              style={{ color: "var(--ink-mute)", letterSpacing: "0.16em", fontWeight: 600 }}
            >
              99.99% · last 90 days
            </span>
          </a>
        </div>

        <style>{`
          @keyframes lpf-ping {
            0% { transform: scale(1); opacity: 0.45 }
            70%, 100% { transform: scale(2.2); opacity: 0 }
          }
        `}</style>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mt-12 mb-14">
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="inline-flex mb-5" aria-label="LP Studio — home">
              <img
                src={navyDepthIcon}
                alt="LP Studio"
                style={{ height: 56, width: 56, display: "block" }}
              />
            </a>
            <p className="text-[14px] leading-[1.6]" style={{ color: "var(--ink-soft)", maxWidth: 240 }}>
              The landing-page platform for revenue teams who need to move fast without going off-brand.
            </p>
          </div>

          {sections.map((s) => (
            <div key={s.title}>
              <div
                className="font-mono uppercase mb-5"
                style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.18em", fontWeight: 600 }}
              >
                {s.title}
              </div>
              <ul className="flex flex-col gap-2.5">
                {s.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[14px] transition-colors"
                      style={LINK_BASE}
                      onMouseEnter={(e) => (e.currentTarget.style.color = LINK_HOVER)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-8"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <div className="flex items-center gap-3">
            <p
              className="font-mono uppercase"
              style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
            >
              © {new Date().getFullYear()} LP Studio, Inc.
            </p>
            <span
              className="hidden md:inline-flex items-center gap-1 text-[11px] uppercase px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--paper)",
                color: "var(--ink-mute)",
                border: "1px solid var(--hairline-strong)",
                letterSpacing: "0.14em",
                fontWeight: 600,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="1.5"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
              </svg>
              SOC 2 Type II
            </span>
            <span
              className="hidden md:inline-flex items-center gap-1 text-[11px] uppercase px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--paper)",
                color: "var(--ink-mute)",
                border: "1px solid var(--hairline-strong)",
                letterSpacing: "0.14em",
                fontWeight: 600,
              }}
            >
              GDPR
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="/privacy"
              className="font-mono uppercase transition-colors"
              style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-mute)")}
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="font-mono uppercase transition-colors"
              style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-mute)")}
            >
              Terms
            </a>
            <a
              href="mailto:admin@lpstudio.ai?subject=Security%20inquiry"
              className="font-mono uppercase transition-colors"
              style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-mute)")}
            >
              Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
