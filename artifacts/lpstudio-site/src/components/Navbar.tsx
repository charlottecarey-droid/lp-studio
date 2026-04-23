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
        background: scrolled ? "rgba(10,10,10,0.72)" : "rgba(10,10,10,0)",
        backdropFilter: scrolled ? "blur(14px) saturate(140%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(14px) saturate(140%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#" className="flex items-center gap-1.5 font-display text-[15px] font-semibold tracking-tight" style={{ color: "#FAFAFA" }}>
          <span
            className="inline-block w-5 h-5 rounded"
            style={{ background: "#D4F542" }}
            aria-hidden
          />
          <span>LP Studio</span>
        </a>

        <div
          className="hidden md:flex items-center gap-7 text-[13.5px]"
          style={{ color: "rgba(250,250,250,0.65)" }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-1">
          <a
            href="https://app.lpstudio.ai"
            className="px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            style={{ color: "rgba(250,250,250,0.7)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#FAFAFA")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(250,250,250,0.7)")}
          >
            Sign in
          </a>
          <a
            href="https://app.lpstudio.ai"
            className="px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all"
            style={{ background: "#FAFAFA", color: "#0A0A0A" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FAFAFA")}
          >
            Get started
          </a>
        </div>

        <button
          className="md:hidden text-white"
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
          className="md:hidden px-6 pb-5 flex flex-col gap-4 text-sm"
          style={{ color: "rgba(250,250,250,0.7)", background: "rgba(10,10,10,0.95)" }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://app.lpstudio.ai"
            onClick={() => setMenuOpen(false)}
            className="self-start px-3.5 py-1.5 rounded-md text-sm font-medium"
            style={{ background: "#FAFAFA", color: "#0A0A0A" }}
          >
            Get started
          </a>
        </div>
      )}
    </nav>
  );
}
