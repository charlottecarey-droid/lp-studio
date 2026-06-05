import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";

export interface StickyHeroNavLink {
  label: string;
  href: string;
}

export interface StickyHeroNavProps {
  /** Brand for the logo (auto-recolor + fallback). When omitted, defaults are used. */
  brand?: BrandConfig;
  logoUrl?: string;
  logoAlt?: string;
  /** Optional partner / company shown as "logo × Company" */
  companyName?: string;
  /** Optional partner logo URL. When set, replaces the text rendering of `companyName`
   *  in the divider slot — useful for co-branded heroes. */
  companyLogoUrl?: string;
  /** Alt text for the partner logo. Falls back to `companyName` or "Partner". */
  companyLogoAlt?: string;
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
  accentTextColor?: string;
  /** CTA visual treatment.
   *  - "pill"  (default): the original compact rounded-pill nav button.
   *  - "pass": flatter 6px-radius citron rectangle with an inset white
   *    highlight, soft glow and an arrow that slides on hover — same
   *    shape used by the Inside-Dandy reservation pass primary CTA, so
   *    a header above that block reads as the same button family. */
  ctaStyle?: "pill" | "pass";
  /** Position. "fixed" overlays content (premium hero feel). "sticky" stays in flow.
   *  "absolute" pins to nearest positioned ancestor (used in the page builder so
   *  the nav cannot escape the hero block's bounds). */
  position?: "fixed" | "sticky" | "absolute";
  /** When true, invert the logo to white. Useful for dark hero backgrounds. */
  invertLogo?: boolean;
  /** When true, hides the brand logo entirely (top-left). The partner
   *  logo/name (if present) still renders, without a leading "×" separator. */
  hideBrandLogo?: boolean;
}

const DEFAULT_ACCENT = "hsl(72, 55%, 48%)";

export function StickyHeroNav({
  brand,
  logoUrl,
  logoAlt = "Logo",
  companyName,
  companyLogoUrl,
  companyLogoAlt,
  navLinks,
  primaryCtaText,
  primaryCtaUrl,
  onPrimaryCtaClick,
  scrollThreshold = 40,
  theme = "dark",
  accentColor = DEFAULT_ACCENT,
  accentTextColor = "hsl(192, 30%, 6%)",
  ctaStyle = "pill",
  position = "fixed",
  invertLogo,
  hideBrandLogo,
}: StickyHeroNavProps) {
  // `progress` is a continuous 0..1 ramp that begins at scrollThreshold and
  // saturates one viewport-height later. We still derive a boolean `scrolled`
  // off it for the height transition + sizing, but the visual properties
  // (bg alpha, blur radius, shadow) interpolate so the nav crossfades into
  // its glass state instead of popping. Throttled to one update per frame.
  const [progress, setProgress] = useState(0);
  const scrolled = progress > 0.02;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const y = window.scrollY;
      const ramp = Math.max(200, window.innerHeight * 0.6);
      const next = Math.max(0, Math.min(1, (y - scrollThreshold) / ramp));
      setProgress((cur) => (Math.abs(cur - next) < 0.005 ? cur : next));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scrollThreshold]);

  const isDark = theme === "dark";
  const shouldInvertLogo = invertLogo ?? isDark;

  const linkColor = isDark ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.72)";
  const linkHover = isDark ? "#fff" : "rgb(15,23,42)";
  const dividerColor = isDark ? "rgba(255,255,255,0.30)" : "rgba(15,23,42,0.30)";
  const companyTextColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.85)";

  // Continuous glass crossfade. At progress=0 the nav is fully transparent
  // (so it blends into the hero). As progress climbs the dark/light glass
  // fills in. Final alpha matches what the old binary state used to jump to.
  const bgAlpha = (isDark ? 0.72 : 0.82) * progress;
  const blurPx = 18 * progress;
  const satPct = 100 + 60 * progress;
  const scrolledBg = isDark
    ? `rgba(8, 22, 20, ${bgAlpha.toFixed(3)})`
    : `rgba(255, 255, 255, ${bgAlpha.toFixed(3)})`;
  const transparentBg = "transparent";
  const borderAlpha = 0.08 * progress;
  const scrolledBorder = isDark
    ? `1px solid rgba(255,255,255,${borderAlpha.toFixed(3)})`
    : `1px solid rgba(15,23,42,${borderAlpha.toFixed(3)})`;

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
        className={`${position === "fixed" ? "fixed" : position === "absolute" ? "absolute" : "sticky"} top-0 left-0 right-0 ${position === "absolute" ? "z-20" : "z-50"}`}
        style={{
          background: progress > 0 ? scrolledBg : transparentBg,
          backdropFilter: progress > 0 ? `blur(${blurPx.toFixed(1)}px) saturate(${satPct.toFixed(0)}%)` : "none",
          WebkitBackdropFilter: progress > 0 ? `blur(${blurPx.toFixed(1)}px) saturate(${satPct.toFixed(0)}%)` : "none",
          borderBottom: progress > 0 ? scrolledBorder : "1px solid transparent",
          boxShadow: progress > 0
            ? (isDark
              ? `0 1px 0 rgba(255,255,255,${(0.04 * progress).toFixed(3)}), 0 12px 32px -16px rgba(0,0,0,${(0.5 * progress).toFixed(3)})`
              : `0 1px 0 rgba(15,23,42,${(0.04 * progress).toFixed(3)}), 0 12px 32px -16px rgba(15,23,42,${(0.18 * progress).toFixed(3)})`)
            : "none",
          // Visual props now ramp per-frame from rAF; only height stays on a
          // CSS transition since `scrolled` is still a boolean for sizing.
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
            {!hideBrandLogo && (
              <BrandLogo
                brand={brand ?? DEFAULT_BRAND}
                url={logoUrl}
                tone={shouldInvertLogo ? "onDark" : "onLight"}
                alt={logoAlt}
                style={{ height: 24, display: "block" }}
              />
            )}
            {(companyLogoUrl || companyName) && (
              <>
                {!hideBrandLogo && (
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
                )}
                {companyLogoUrl ? (
                  <img
                    src={companyLogoUrl}
                    alt={companyLogoAlt || companyName || "Partner"}
                    style={{
                      height: 24,
                      width: "auto",
                      maxWidth: 160,
                      display: "block",
                      objectFit: "contain",
                      // Brighten dark logos when sitting on a dark hero so the
                      // partner mark reads cleanly against the navy background.
                      filter: isDark ? "brightness(0) invert(1)" : "none",
                    }}
                  />
                ) : (
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
                )}
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
              ctaStyle === "pass" ? (
                <a
                  href={primaryCtaUrl || "#"}
                  onClick={handleCta}
                  className="stky-hero-pass-cta hidden sm:inline-flex items-center justify-center gap-2.5"
                  style={{
                    background: accentColor,
                    color: accentTextColor,
                    minWidth: "200px",
                    padding: "0.85rem 1.75rem",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    borderRadius: "6px",
                    border: "1px solid transparent",
                    textDecoration: "none",
                    cursor: "pointer",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.35) inset, 0 12px 32px rgba(199,231,56,0.18)",
                    transition:
                      "transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  {primaryCtaText}
                  <ArrowRight className="w-3.5 h-3.5 stky-hero-pass-arrow" />
                </a>
              ) : (
                <a
                  href={primaryCtaUrl || "#"}
                  onClick={handleCta}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-90"
                  style={{
                    background: accentColor,
                    color: accentTextColor,
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
              )
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
            className={`${position === "absolute" ? "absolute" : "fixed"} inset-x-0 z-40 md:hidden`}
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
                  className={`inline-flex items-center justify-center gap-1.5 mt-2 ${ctaStyle === "pass" ? "stky-hero-pass-cta" : "rounded-full"}`}
                  style={
                    ctaStyle === "pass"
                      ? {
                          background: accentColor,
                          color: accentTextColor,
                          padding: "0.85rem 1.75rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          letterSpacing: "0.06em",
                          borderRadius: "6px",
                          boxShadow:
                            "0 1px 0 rgba(255,255,255,0.35) inset, 0 12px 32px rgba(199,231,56,0.18)",
                        }
                      : {
                          background: accentColor,
                          color: accentTextColor,
                          padding: "0.6rem 1.25rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                        }
                  }
                >
                  {primaryCtaText}
                  <ArrowRight className={`w-4 h-4 ${ctaStyle === "pass" ? "stky-hero-pass-arrow" : ""}`} />
                </a>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pass-style CTA: hover lift + arrow slide. Scoped to .stky-hero-pass-cta
          so it cannot bleed into the default pill button or any other anchor. */}
      {ctaStyle === "pass" && (
        <style>{`
          .stky-hero-pass-cta .stky-hero-pass-arrow {
            transform: translateX(0);
            transition: transform 280ms cubic-bezier(0.22,1,0.36,1);
            opacity: 0.9;
          }
          .stky-hero-pass-cta:hover {
            transform: translateY(-1px);
            box-shadow: 0 1px 0 rgba(255,255,255,0.4) inset, 0 18px 40px rgba(199,231,56,0.28) !important;
          }
          .stky-hero-pass-cta:hover .stky-hero-pass-arrow {
            transform: translateX(4px);
            opacity: 1;
          }
        `}</style>
      )}
    </>
  );
}
