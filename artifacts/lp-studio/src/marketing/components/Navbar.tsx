import { useEffect, useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Use cases", href: "#use-cases" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all"
      style={{
        background: scrolled ? "rgba(246, 242, 233, 0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(18px) saturate(140%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(18px) saturate(140%)" : "none",
        borderBottom: scrolled ? "1px solid var(--hairline)" : "1px solid transparent",
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href="#"
          className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          {/* Wordmark — serif L paired with sans, no bright color block */}
          <span
            className="font-display"
            style={{
              fontSize: 22,
              lineHeight: 1,
              fontWeight: 500,
              fontVariationSettings: "'opsz' 144",
              letterSpacing: "-0.04em",
            }}
          >
            LP
          </span>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.22em",
              color: "var(--ink-soft)",
              paddingTop: 3,
            }}
          >
            Studio
          </span>
        </a>

        <div
          className="hidden md:flex items-center gap-9 text-[13.5px]"
          style={{ color: "var(--ink-soft)" }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a
            href="https://app.lpstudio.ai"
            className="px-3 py-2 text-[13px] font-medium transition-colors"
            style={{ color: "var(--ink-soft)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
          >
            Sign in
          </a>
          <a
            href="https://app.lpstudio.ai"
            className="px-4 py-2 text-[13px] font-medium transition-all"
            style={{
              background: "var(--ink)",
              color: "var(--cream)",
              borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink)")}
          >
            Get started
          </a>
        </div>

        <button
          className="md:hidden"
          style={{ color: "var(--ink)" }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            {menuOpen ? (
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          className="md:hidden px-6 pb-6 pt-2 flex flex-col gap-4 text-sm"
          style={{ color: "var(--ink-soft)", background: "rgba(246, 242, 233, 0.98)" }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://app.lpstudio.ai"
            onClick={() => setMenuOpen(false)}
            className="self-start mt-2 px-4 py-2 text-sm font-medium"
            style={{ background: "var(--ink)", color: "var(--cream)", borderRadius: 6 }}
          >
            Get started
          </a>
        </div>
      )}
    </nav>
  );
}
