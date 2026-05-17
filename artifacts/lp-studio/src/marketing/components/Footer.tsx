import type { ReactNode } from "react";
import { Logo } from "./Logo";

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
  { label: "Contact Sales", href: "mailto:admin@lpstudio.ai?subject=LP%20Studio%20-%20Sales%20inquiry" },
];

const companyLinks = [
  { label: "About", href: "mailto:admin@lpstudio.ai?subject=About%20LP%20Studio" },
  { label: "Customers", href: "/#testimonials" },
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

const SOCIAL: { label: string; href: string; icon: ReactNode }[] = [
  {
    label: "X / Twitter",
    href: "https://twitter.com/lpstudio",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2H21.5l-7.36 8.4L23 22h-6.93l-5.43-7.1L4.4 22H1.14l7.88-9L1 2h7.06l4.91 6.49L18.244 2zm-2.43 18.05h1.91L7.27 3.86H5.22l10.594 16.19z"/>
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/lpstudio",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm6.5 0H13v1.7c.6-.9 2-1.95 4.2-1.95 4.49 0 5.3 2.95 5.3 6.8V21h-4v-4.5c0-1.08-.02-2.47-1.5-2.47-1.5 0-1.73 1.17-1.73 2.39V21h-4V9z"/>
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/lpstudio",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.28-1.67-1.28-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.69.41.35.78 1.04.78 2.1 0 1.52-.01 2.75-.01 3.12 0 .3.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@lpstudio",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.5 6.2a3.02 3.02 0 0 0-2.13-2.14C19.45 3.5 12 3.5 12 3.5s-7.45 0-9.37.56A3.02 3.02 0 0 0 .5 6.2C-.05 8.13 0 12 0 12s-.05 3.87.5 5.8a3.02 3.02 0 0 0 2.13 2.14c1.92.56 9.37.56 9.37.56s7.45 0 9.37-.56a3.02 3.02 0 0 0 2.13-2.14c.55-1.93.5-5.8.5-5.8s.05-3.87-.5-5.8zM9.5 15.5v-7l6.5 3.5-6.5 3.5z"/>
      </svg>
    ),
  },
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

          {/* Social icons */}
          <div className="flex items-center gap-1.5">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="inline-flex items-center justify-center transition-all"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--paper)",
                  color: "var(--ink-soft)",
                  border: "1px solid var(--hairline-strong)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--ink)";
                  e.currentTarget.style.borderColor = "var(--ink-faint)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--ink-soft)";
                  e.currentTarget.style.borderColor = "var(--hairline-strong)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {s.icon}
              </a>
            ))}
          </div>
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
              <Logo variant="icon" height={56} />
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
