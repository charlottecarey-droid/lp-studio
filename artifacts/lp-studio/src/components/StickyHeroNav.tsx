import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

export interface StickyHeroNavLink {
  label: string;
  href: string;
}

export interface StickyHeroNavProps {
  logoUrl?: string;
  logoAlt?: string;
  /** Optional partner / company shown as "logo × Company" */
  companyName?: string;
  /** Optional nav links. # anchors smooth-scroll. */
  navLinks?: StickyHeroNavLink[];
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  onPrimaryCtaClick?: () => void;
  /** Pixels of scroll before transitioning from transparent → solid. */
  scrollThreshold?: number;
  /** "dark" = blurred dark bg w/ light text (default). "light" = white bg w/ dark text. */
  theme?: "dark" | "light";
  /** Accent color for the CTA button. Defaults to Dandy primary. */
  accentColor?: string;
  /** Position. "fixed" overlays content (premium hero feel). "sticky" stays in flow. */
  position?: "fixed" | "sticky";
  /** When true, invert the logo to white. Useful for dark hero backgrounds. */
  invertLogo?: boolean;
}

const DEFAULT_ACCENT = "hsl(72, 55%, 48%)";

export function StickyHeroNav({
  logoUrl,
  logoAlt = "Logo",
  companyName,
  navLinks,
  primaryCtaText,
  primaryCtaUrl,
  onPrimaryCtaClick,
  scrollThreshold = 40,
  theme = "dark",
  accentColor = DEFAULT_ACCENT,
  position = "fixed",
  invertLogo,
}: StickyHeroNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > scrollThreshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollThreshold]);

  const isDark = theme === "dark";
  const shouldInvertLogo = invertLogo ?? isDark;

  const linkColor = isDark ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.72)";
  const linkHover = isDark ? "#fff" : "rgb(15,23,42)";
  const dividerColor = isDark ? "rgba(255,255,255,0.30)" : "rgba(15,23,42,0.30)";
  const companyTextColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.85)";

  const scrolledBg = isDark
    ? "rgba(8, 22, 20, 0.72)"
    : "rgba(255, 255, 255, 0.82)";
  const transparentBg = isDark
    ? "linear-gradient(to bottom, rgba(8,22,20,0.55) 0%, rgba(8,22,20,0) 100%)"
    : "linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)";
  const scrolledBorder = isDark
    ? "1px solid rgba(255,255,255,0.08)"
    : "1px solid rgba(15,23,42,0.08)";

  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  const handleCta = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onPrimaryCtaClick) {
      e.preventDefault();
      onPrimaryCtaClick();
    }
  };

  const links = navLinks ?? [];

  return (
    <>
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`${position === "fixed" ? "fixed" : "sticky"} top-0 left-0 right-0 z-50`}
        style={{
          background: scrolled ? scrolledBg : transparentBg,
          backdropFilter: scrolled ? "blur(18px) saturate(160%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(18px) saturate(160%)" : "none",
          borderBottom: scrolled ? scrolledBorder : "1px solid transparent",
          boxShadow: scrolled
            ? (isDark
              ? "0 1px 0 rgba(255,255,255,0.04), 0 12px 32px -16px rgba(0,0,0,0.5)"
              : "0 1px 0 rgba(15,23,42,0.04), 0 12px 32px -16px rgba(15,23,42,0.18)")
            : "none",
          transition: "background 320ms ease, backdrop-filter 320ms ease, border-color 320ms ease, box-shadow 320ms ease",
        }}
      >
        <div
          className="mx-auto flex items-center justify-between"
          style={{
            maxWidth: 1200,
            padding: "1rem 1.5rem",
            height: scrolled ? 60 : 72,
            transition: "height 320ms ease",
          }}
        >
          {/* Logo + optional company */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl || dandyLogoUrl}
              alt={logoAlt}
              style={{
                height: 24,
                width: "auto",
                display: "block",
                filter: shouldInvertLogo ? "brightness(0) invert(1)" : undefined,
              }}
            />
            {companyName && (
              <>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: dividerColor,
                    margin: "0 0.125rem",
                    userSelect: "none",
                  }}
                >
                  ×
                </span>
                <span
                  className="truncate"
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: companyTextColor,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {companyName}
                </span>
              </>
            )}
          </div>

          {/* Desktop nav links */}
          {links.length > 0 && (
            <nav className="hidden md:flex items-center gap-7 mx-8">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.href || "#"}
                  onClick={(e) => handleAnchor(e, link.href || "")}
                  className="whitespace-nowrap transition-colors"
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: linkColor,
                    letterSpacing: "0.005em",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = linkHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = linkColor)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {primaryCtaText && (
              <a
                href={primaryCtaUrl || "#"}
                onClick={handleCta}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-90"
                style={{
                  background: accentColor,
                  color: "hsl(192, 30%, 6%)",
                  padding: "0.5rem 1.125rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  cursor: "pointer",
                }}
              >
                {primaryCtaText}
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}

            {(links.length > 0 || primaryCtaText) && (
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden inline-flex items-center justify-center rounded-md p-1.5"
                style={{ color: isDark ? "#fff" : "rgb(15,23,42)" }}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-x-0 z-40 md:hidden"
            style={{
              top: scrolled ? 60 : 72,
              background: isDark ? "rgba(8,22,20,0.96)" : "rgba(255,255,255,0.98)",
              backdropFilter: "blur(20px)",
              borderBottom: scrolledBorder,
              padding: "1.25rem 1.5rem 1.5rem",
            }}
          >
            <nav className="flex flex-col gap-4">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.href || "#"}
                  onClick={(e) => handleAnchor(e, link.href || "")}
                  style={{
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: isDark ? "#fff" : "rgb(15,23,42)",
                  }}
                >
                  {link.label}
                </a>
              ))}
              {primaryCtaText && (
                <a
                  href={primaryCtaUrl || "#"}
                  onClick={(e) => {
                    handleCta(e);
                    setMobileOpen(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full mt-2"
                  style={{
                    background: accentColor,
                    color: "hsl(192, 30%, 6%)",
                    padding: "0.6rem 1.25rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {primaryCtaText}
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
