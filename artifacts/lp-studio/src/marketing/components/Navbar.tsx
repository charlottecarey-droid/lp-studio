import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import lpLockup from "@assets/lp-lockup-horizontal-navy-depth-2048_1781934486001.png";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Route-based top nav — consistent across every marketing page so
  // prospects can move between them without hunting.
  const navLinks = [
    { label: "For Marketing", href: "/for-marketing", active: location === "/for-marketing" },
    { label: "For Sales", href: "/for-sales", active: location === "/for-sales" },
    { label: "Features", href: "/features", active: location === "/features" },
    { label: "Compare", href: "/compare", active: location === "/compare" },
    { label: "Pricing", href: "/pricing", active: location === "/pricing" },
    { label: "Blog", href: "/blog", active: location === "/blog" || location.startsWith("/blog/") },
  ];

  return (
    <nav
      className="fixed left-0 right-0 z-50 transition-all"
      style={{
        top: scrolled ? "0px" : "var(--lp-banner-h, 0px)",
        background: scrolled ? "rgba(246, 242, 233, 0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(18px) saturate(140%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(18px) saturate(140%)" : "none",
        borderBottom: scrolled ? "1px solid var(--hairline)" : "1px solid transparent",
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href="/"
          className="flex items-center gap-2"
          style={{ color: "var(--ink)" }}
          aria-label="LP Studio — home"
        >
          <img
            src={lpLockup}
            alt="LP Studio"
            style={{ height: 40, width: "auto", display: "block" }}
          />
        </a>

        <div
          className="hidden md:flex items-center gap-9 text-[13.5px]"
          style={{ color: "var(--ink-soft)" }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`nav-link transition-colors${l.active ? " nav-link-active" : ""}`}
              style={{
                color: l.active ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: l.active ? 600 : 400,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = l.active ? "var(--ink)" : "var(--ink-soft)";
              }}
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
            className="px-4 py-2 text-[13px] font-medium transition-all inline-flex items-center gap-1.5"
            style={{
              background: "var(--navy)",
              color: "var(--cream)",
              borderRadius: 8,
              boxShadow:
                "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--navy-2)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 1px 2px rgba(26, 24, 21, 0.10), 0 8px 18px -6px rgba(26, 24, 21, 0.32)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--navy)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="var(--coral)" aria-hidden="true">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
            </svg>
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
              style={{
                color: l.active ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: l.active ? 600 : 400,
              }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://app.lpstudio.ai"
            onClick={() => setMenuOpen(false)}
            className="self-start mt-2 px-4 py-2 text-sm font-medium inline-flex items-center gap-1.5"
            style={{ background: "var(--ink)", color: "var(--cream)", borderRadius: 8 }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="var(--coral)" aria-hidden="true">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
            </svg>
            Get started
          </a>
        </div>
      )}
    </nav>
  );
}
