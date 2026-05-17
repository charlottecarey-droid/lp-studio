const productLinks = [
  { label: "Visual Builder", href: "/#features" },
  { label: "AI Copy", href: "/#features" },
  { label: "Brand System", href: "/#features" },
  { label: "A/B Testing", href: "/#features" },
  { label: "Integrations", href: "/#integrations" },
  { label: "Use Cases", href: "/#use-cases" },
];

const pricingLinks = [
  { label: "Plans & Pricing", href: "/#pricing" },
  { label: "Get Early Access", href: "/#waitlist" },
  { label: "Contact Sales", href: "mailto:sales@lpstudio.ai?subject=LP%20Studio%20-%20Sales%20inquiry" },
];

const companyLinks = [
  { label: "About", href: "mailto:hello@lpstudio.ai?subject=About%20LP%20Studio" },
  { label: "Customers", href: "/#testimonials" },
  { label: "FAQ", href: "/#faq" },
  { label: "Careers", href: "mailto:careers@lpstudio.ai?subject=Careers%20at%20LP%20Studio" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Security", href: "mailto:security@lpstudio.ai?subject=Security%20inquiry" },
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
      <div className="max-w-[1180px] mx-auto px-6 py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <span
                className="font-display"
                style={{
                  fontSize: 28,
                  lineHeight: 1,
                  fontWeight: 500,
                  fontVariationSettings: "'opsz' 144",
                  letterSpacing: "-0.04em",
                  color: "var(--ink)",
                }}
              >
                LP
              </span>
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  color: "var(--ink-soft)",
                  paddingTop: 4,
                }}
              >
                Studio
              </span>
            </div>
            <p className="text-[14px] leading-[1.6]" style={{ color: "var(--ink-soft)", maxWidth: 240 }}>
              The landing-page platform for revenue teams who need to move fast without going off-brand.
            </p>
          </div>

          {sections.map((s) => (
            <div key={s.title}>
              <div
                className="font-mono uppercase mb-5"
                style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.18em" }}
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
          <p
            className="font-mono uppercase"
            style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
          >
            © {new Date().getFullYear()} LP Studio, Inc. All rights reserved.
          </p>
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
          </div>
        </div>
      </div>
    </footer>
  );
}
