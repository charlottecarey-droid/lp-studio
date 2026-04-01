import { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 text-white font-display font-bold text-xl tracking-tight">
          <span style={{ color: "#C7E738" }}>LP</span>
          <span>Studio</span>
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-gray-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://app.lpstudio.ai"
            className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
            style={{ background: "#C7E738", color: "#000", fontFamily: "Outfit, sans-serif" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#d6f54a")}
            onMouseLeave={e => (e.currentTarget.style.background = "#C7E738")}
          >
            Start Free
          </a>
        </div>

        <button
          className="md:hidden text-white"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {menuOpen ? (
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden mt-4 pb-4 flex flex-col gap-4 text-sm text-gray-300 px-2">
          <a href="#features" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors">How It Works</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors">Pricing</a>
          <a href="#testimonials" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors">Testimonials</a>
          <a
            href="#waitlist"
            onClick={() => setMenuOpen(false)}
            className="self-start px-5 py-2 rounded-full text-sm font-semibold"
            style={{ background: "#C7E738", color: "#000", fontFamily: "Outfit, sans-serif" }}
          >
            Get Early Access
          </a>
        </div>
      )}
    </nav>
  );
}
