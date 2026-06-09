import { useCallback, useMemo, useState, Component, type ReactNode, type ErrorInfo } from "react";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";

const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_FONT;

import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coffee,
  Heart,
  Leaf,
  Loader2,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import type {
  StorefrontBlockProps,
  StorefrontProduct,
  StorefrontCollection,
  StorefrontValueProp,
  StorefrontReview,
  StorefrontVariant,
  StorefrontNavLink,
  StorefrontFooterColumn,
} from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { pushMarketoSubmissionToDataLayer } from "@/lib/gtm-datalayer";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

/* ──────────────────────────────────────────────────────────────────────── */
/*  Error boundary                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

class StorefrontErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[Storefront] render error:", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fbf7f0", color: "#211a14", fontFamily: `${BRAND_BODY_FONT}, 'Inter', sans-serif`, padding: "2rem" }}>
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#c2603a", fontFamily: DISPLAY }}>Storefront — Render Error</h2>
            <p style={{ fontSize: "0.85rem", color: "#7a6f63", lineHeight: 1.6, fontFamily: BODY }}>
              {this.state.error?.message ?? "Unknown error"}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Theme resolution                                                         */
/* ──────────────────────────────────────────────────────────────────────── */

const FALLBACK_THEME = {
  bg: "#fbf7f0",
  altBg: "#f6f0e6",
  cardBg: "#ffffff",
  darkBg: "#211a14",
  fg: "#211a14",
  headingColor: "#211a14",
  primary: "#c2603a",
  muted: "#7a6f63",
  border: "#211a14",
  navBg: "#fbf7f0",
  navBgOpacity: 0.9,
  navText: "#211a14",
  displayFontFamily: "Fraunces",
  bodyFontFamily: "Inter",
};

function brandDefaults(brand?: BrandConfig): typeof FALLBACK_THEME {
  if (!brand) return FALLBACK_THEME;
  return {
    bg: brand.pageBackground || FALLBACK_THEME.bg,
    altBg: brand.cardBackground || FALLBACK_THEME.altBg,
    cardBg: brand.cardBackground || FALLBACK_THEME.cardBg,
    darkBg: FALLBACK_THEME.darkBg,
    fg: brand.textColor || FALLBACK_THEME.fg,
    headingColor: brand.textColor || FALLBACK_THEME.headingColor,
    primary: brand.primaryColor || FALLBACK_THEME.primary,
    muted: FALLBACK_THEME.muted,
    border: FALLBACK_THEME.border,
    navBg: brand.navBgColor || FALLBACK_THEME.navBg,
    navBgOpacity: FALLBACK_THEME.navBgOpacity,
    navText: brand.navText || FALLBACK_THEME.navText,
    displayFontFamily: brand.displayFont || FALLBACK_THEME.displayFontFamily,
    bodyFontFamily: brand.bodyFont || FALLBACK_THEME.bodyFontFamily,
  };
}

function hexToRgb(hex: string | undefined | null): [number, number, number] {
  if (!hex) return [0, 0, 0];
  const m = hex.replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface ResolvedTheme {
  bg: string;
  altBg: string;
  card: string;
  dark: string;
  fg: string;
  heading: string;
  primary: string;
  primaryFaint: string;
  primaryGhost: string;
  muted: string;
  border: string;
  borderDim: string;
  borderFaint: string;
  navBg: string;
  navText: string;
  bodyFont: string;
  displayFont: string;
}

function resolveTheme(t: StorefrontBlockProps["theme"], brand?: BrandConfig): ResolvedTheme {
  const base = brandDefaults(brand);
  const raw = t ?? {};
  const m = Object.fromEntries(
    Object.entries({ ...base, ...raw }).map(([k, v]) => [k, (typeof v === "string" && v.trim() === "") ? (base as Record<string, unknown>)[k] ?? v : v])
  ) as typeof base;
  const heading = m.headingColor || m.fg;
  const bodyFont = toFontFamilyValue(m.bodyFontFamily, "sans") ?? `${BRAND_BODY_FONT}, 'Inter', sans-serif`;
  const displayFont = toFontFamilyValue(m.displayFontFamily, "display") ?? "'Fraunces', serif";
  return {
    bg: m.bg,
    altBg: m.altBg,
    card: m.cardBg,
    dark: m.darkBg,
    fg: m.fg,
    heading,
    primary: m.primary,
    primaryFaint: rgba(m.primary, 0.4),
    primaryGhost: rgba(m.primary, 0.1),
    muted: m.muted,
    border: m.border,
    borderDim: rgba(m.border, 0.1),
    borderFaint: rgba(m.border, 0.06),
    navBg: rgba(m.navBg, m.navBgOpacity ?? 0.9),
    navText: m.navText,
    bodyFont,
    displayFont,
  };
}


/* ──────────────────────────────────────────────────────────────────────── */
/*  Small shared building blocks                                             */
/* ──────────────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function Stars({ value = 5, size = 14, C }: { value?: number; size?: number; C: ResolvedTheme }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.1rem" }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const on = i < Math.round(value);
        return (
          <Star
            key={i}
            style={{ width: size, height: size, color: on ? C.primary : rgba(C.border, 0.25) }}
            fill={on ? "currentColor" : "none"}
            strokeWidth={on ? 0 : 1.5}
          />
        );
      })}
    </div>
  );
}

const VALUE_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  leaf: Leaf,
  returns: RotateCcw,
  truck: Truck,
  coffee: Coffee,
  shield: ShieldCheck,
  star: Star,
};

function valueIcon(key?: string) {
  return VALUE_ICONS[(key ?? "").toLowerCase()] ?? Coffee;
}

function Wordmark({ p, C, onDark }: { p: StorefrontBlockProps; C: ResolvedTheme; onDark?: boolean }) {
  const name = p.brandName ?? "Meridian";
  const textColor = onDark ? "#f6f0e6" : C.navText;
  if (p.logoUrl) {
    return <img src={p.logoUrl} alt={name} style={{ height: "1.7rem", width: "auto" }} />;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem", textDecoration: "none" }}>
      <span style={{ display: "flex", height: "2.25rem", width: "2.25rem", alignItems: "center", justifyContent: "center", borderRadius: "999px", backgroundColor: C.primary }}>
        <Coffee size={20} style={{ color: "#fbf7f0" }} />
      </span>
      <span style={{ fontFamily: C.displayFont, fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.01em", color: textColor }}>
        {name}
      </span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Announcement bar                                                         */
/* ──────────────────────────────────────────────────────────────────────── */

function AnnouncementBar({ p, C }: { p: StorefrontBlockProps; C: ResolvedTheme }) {
  const primary = p.announcementText ?? "Free carbon-neutral shipping on orders over $50";
  const secondary = p.announcementSecondaryText ?? "Roasted to order, shipped within 24 hours";
  return (
    <div style={{ width: "100%", backgroundColor: C.dark, color: "#f6f0e6", fontFamily: C.bodyFont }}>
      <div style={{ maxWidth: "80rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", padding: "0.65rem 1rem", fontSize: "0.75rem", letterSpacing: "0.02em" }}>
        <Truck size={14} style={{ color: C.primary }} />
        <span style={{ fontWeight: 500 }}>{primary}</span>
        {secondary && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ opacity: 0.7 }}>{secondary}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Sticky nav                                                               */
/* ──────────────────────────────────────────────────────────────────────── */

function StickyNav({ p, C }: { p: StorefrontBlockProps; C: ResolvedTheme }) {
  const links: StorefrontNavLink[] = p.navLinks ?? [];
  const cartCount = p.cartCount ?? 3;
  const ctaLabel = p.navCtaText ?? "Shop coffee";
  const ctaUrl = p.navCtaUrl ?? "#shop";
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: `1px solid ${C.borderDim}`,
        backgroundColor: C.navBg,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        fontFamily: C.bodyFont,
      }}
    >
      <div style={{ maxWidth: "80rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", gap: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <a href="#top" style={{ textDecoration: "none" }}><Wordmark p={p} C={C} /></a>
          {links.length > 0 && (
            <nav className="bsf-nav-links" style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
              {links.map(link => (
                <a
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  style={{ fontSize: "0.875rem", fontWeight: 500, color: rgba(C.fg, 0.7), textDecoration: "none" }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button type="button" aria-label="Search" className="bsf-nav-search" style={iconButtonStyle(C)}>
            <Search size={20} />
          </button>
          <button type="button" aria-label="Cart" style={{ ...iconButtonStyle(C), position: "relative" }}>
            <ShoppingBag size={20} />
            <span style={{ position: "absolute", top: "-2px", right: "-2px", display: "flex", height: "1rem", width: "1rem", alignItems: "center", justifyContent: "center", borderRadius: "999px", backgroundColor: C.primary, color: "#fff", fontSize: "10px", fontWeight: 700 }}>
              {cartCount}
            </span>
          </button>
          <motion.a
            href={ctaUrl}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="bsf-nav-cta"
            style={{
              marginLeft: "0.25rem",
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "999px",
              padding: "0.55rem 1.25rem",
              backgroundColor: C.primary,
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {ctaLabel}
          </motion.a>
          <button type="button" aria-label="Menu" className="bsf-nav-menu" style={{ ...iconButtonStyle(C), display: "none" }}>
            <Menu size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

function iconButtonStyle(C: ResolvedTheme): React.CSSProperties {
  return {
    display: "inline-flex",
    height: "2.25rem",
    width: "2.25rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    border: "none",
    backgroundColor: "transparent",
    color: rgba(C.fg, 0.7),
    cursor: "pointer",
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Product hero                                                             */
/* ──────────────────────────────────────────────────────────────────────── */

function ProductHero({ p, C }: { p: StorefrontBlockProps; C: ResolvedTheme }) {
  const variants: StorefrontVariant[] = p.heroVariants ?? [];
  const [selected, setSelected] = useState(0);

  const eyebrow = p.heroEyebrow ?? "Flagship Roast";
  const title = p.heroTitle ?? "Midnight Reserve.";
  const description = p.heroDescription ?? "A slow, small-batch dark roast with notes of dark chocolate, fig, and toasted hazelnut. Roasted to order, never sitting on a shelf.";
  const rating = p.heroRating ?? 4.9;
  const reviewCount = p.heroReviewCount ?? 412;
  const price = p.heroPrice ?? "$22";
  const comparePrice = p.heroComparePrice ?? "$26";
  const addLabel = p.heroAddToCartLabel ?? "Add to cart";
  const buyLabel = p.heroBuyNowLabel ?? "Buy now";
  const imageUrl = p.heroImageUrl;
  const variantLabel = p.heroVariantLabel ?? "Grind";
  const cardLabel = p.heroCardLabel ?? "Roasted";
  const cardValue = p.heroCardValue ?? "Within 24 hours";
  const badges = p.heroTrustBadges ?? [
    { icon: "returns", text: "Free 30-day returns" },
    { icon: "shield", text: "Secure checkout" },
    { icon: "leaf", text: "Ethically sourced" },
  ];

  return (
    <section id="top" className="bsf-section" style={{ position: "relative", overflow: "hidden", backgroundColor: C.altBg, fontFamily: C.bodyFont }}>
      <div className="bsf-hero-grid" style={{ maxWidth: "80rem", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: "2.5rem", padding: "5rem 1.25rem" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="bsf-hero-copy">
          <motion.span variants={fadeUp} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", borderRadius: "999px", border: `1px solid ${C.primaryFaint}`, padding: "0.25rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: C.primary }}>
            <span style={{ height: "0.4rem", width: "0.4rem", borderRadius: "999px", backgroundColor: C.primary }} />
            {eyebrow}
          </motion.span>
          <motion.h1 variants={fadeUp} style={{ fontFamily: C.displayFont, marginTop: "1.25rem", fontSize: "clamp(2.75rem, 6vw, 4.2rem)", lineHeight: 1.02, letterSpacing: "-0.02em", color: C.heading }}>
            {title}
          </motion.h1>
          <motion.p variants={fadeUp} style={{ marginTop: "1.25rem", maxWidth: "28rem", fontSize: "1.125rem", lineHeight: 1.6, color: rgba(C.fg, 0.7) }}>
            {description}
          </motion.p>

          <motion.div variants={fadeUp} style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Stars value={rating} size={18} C={C} />
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: rgba(C.fg, 0.7) }}>{rating} · {reviewCount} reviews</span>
          </motion.div>

          {variants.length > 0 && (
            <motion.div variants={fadeUp} style={{ marginTop: "1.75rem" }}>
              <p style={{ marginBottom: "0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: rgba(C.fg, 0.5) }}>{variantLabel}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {variants.map((v, i) => {
                  const on = i === selected;
                  return (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => setSelected(i)}
                      style={{
                        borderRadius: "999px",
                        border: `1px solid ${on ? C.dark : rgba(C.border, 0.2)}`,
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        backgroundColor: on ? C.dark : "transparent",
                        color: on ? "#f6f0e6" : rgba(C.fg, 0.8),
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          <motion.div variants={fadeUp} style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontFamily: C.displayFont, fontSize: "1.875rem", fontWeight: 600, color: C.heading }}>{price}</span>
              {comparePrice && <span style={{ fontSize: "0.875rem", color: rgba(C.fg, 0.5), textDecoration: "line-through" }}>{comparePrice}</span>}
            </div>
            <motion.a
              href={p.heroAddToCartUrl ?? "#shop"}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ display: "inline-flex", height: "3rem", alignItems: "center", gap: "0.5rem", borderRadius: "999px", padding: "0 1.75rem", backgroundColor: C.primary, color: "#fff", fontSize: "1rem", fontWeight: 600, textDecoration: "none", boxShadow: `0 12px 30px ${rgba(C.primary, 0.3)}` }}
            >
              <ShoppingBag size={20} />
              {addLabel}
            </motion.a>
            <motion.a
              href={p.heroBuyNowUrl ?? "#shop"}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ display: "inline-flex", height: "3rem", alignItems: "center", borderRadius: "999px", border: `1px solid ${rgba(C.border, 0.25)}`, padding: "0 1.75rem", backgroundColor: "transparent", color: C.fg, fontSize: "1rem", fontWeight: 600, textDecoration: "none" }}
            >
              {buyLabel}
            </motion.a>
          </motion.div>

          {badges.length > 0 && (
            <motion.div variants={fadeUp} style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: "0.75rem 1.5rem", fontSize: "0.875rem", color: rgba(C.fg, 0.7) }}>
              {badges.map((b, i) => {
                const Icon = valueIcon(b.icon);
                return (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    <Icon size={16} style={{ color: C.primary }} /> {b.text}
                  </span>
                );
              })}
            </motion.div>
          )}
        </motion.div>

        <div style={{ position: "relative" }}>
          <div aria-hidden style={{ position: "absolute", right: "-2.5rem", top: "-2.5rem", height: "18rem", width: "18rem", borderRadius: "999px", opacity: 0.5, filter: "blur(60px)", backgroundColor: rgba(C.primary, 0.2) }} />
          <div style={{ position: "relative", overflow: "hidden", borderRadius: "2rem", backgroundColor: C.bg, boxShadow: "0 30px 70px rgba(33,26,20,0.15)", border: `1px solid ${C.borderFaint}` }}>
            {imageUrl ? (
              <img src={imageUrl} alt={title} style={{ height: "100%", width: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center", color: rgba(C.fg, 0.25) }}>
                <Coffee size={64} />
              </div>
            )}
          </div>
          <div style={{ position: "absolute", bottom: "-1.25rem", left: "2rem", display: "flex", alignItems: "center", gap: "0.75rem", borderRadius: "1rem", backgroundColor: rgba(C.card, 0.95), padding: "0.75rem 1rem", boxShadow: "0 12px 30px rgba(33,26,20,0.12)", backdropFilter: "blur(8px)" }}>
            <span style={{ display: "flex", height: "2.25rem", width: "2.25rem", alignItems: "center", justifyContent: "center", borderRadius: "999px", backgroundColor: rgba(C.primary, 0.1) }}>
              <Coffee size={18} style={{ color: C.primary }} />
            </span>
            <div style={{ lineHeight: 1.2 }}>
              <p style={{ fontSize: "0.75rem", color: rgba(C.fg, 0.55) }}>{cardLabel}</p>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: C.heading }}>{cardValue}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Value props row                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

function ValueProps({ p, C }: { p: StorefrontBlockProps; C: ResolvedTheme }) {
  const items: StorefrontValueProp[] = p.valueProps ?? [];
  if (!items.length) return null;
  return (
    <section style={{ borderTop: `1px solid ${C.borderDim}`, borderBottom: `1px solid ${C.borderDim}`, backgroundColor: C.bg, fontFamily: C.bodyFont }}>
      <div className="bsf-value-grid" style={{ maxWidth: "80rem", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", overflow: "hidden", backgroundColor: C.borderDim }}>
        {items.map((v, i) => {
          const Icon = valueIcon(v.icon);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0.75rem", backgroundColor: C.bg, padding: "2rem 1.5rem" }}>
              <span style={{ display: "flex", height: "2.75rem", width: "2.75rem", alignItems: "center", justifyContent: "center", borderRadius: "999px", backgroundColor: rgba(C.primary, 0.08) }}>
                <Icon size={20} style={{ color: C.primary }} />
              </span>
              <div>
                <p style={{ fontWeight: 600, color: C.heading }}>{v.title}</p>
                {v.description && <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: rgba(C.fg, 0.6) }}>{v.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Collections + product grid                                              */
/* ──────────────────────────────────────────────────────────────────────── */

function CollectionsSection({ p, C }: { p: StorefrontBlockProps; C: ResolvedTheme }) {
  const collections: StorefrontCollection[] = p.collections ?? [];
  const products: StorefrontProduct[] = p.products ?? [];
  const filters = p.productFilters ?? ["All", "Dark", "Medium", "Light", "Decaf", "Bundles"];
  const [activeFilter, setActiveFilter] = useState(0);
  const eyebrow = p.productsEyebrow ?? "Shop the catalog";
  const heading = p.productsHeadline ?? "Featured roasts";

  return (
    <>
      {collections.length > 0 && (
        <section id="collections" style={{ maxWidth: "80rem", margin: "0 auto", padding: "4rem 1.25rem 0", fontFamily: C.bodyFont }}>
          <div className="bsf-collections-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            {collections.map((col, i) => {
              const accent = (col.variant ?? (i % 2 === 0 ? "dark" : "accent")) === "accent";
              const bg = accent ? C.primary : C.dark;
              const fg = accent ? "#fff" : "#f6f0e6";
              return (
                <div key={i} style={{ position: "relative", overflow: "hidden", borderRadius: "1.5rem", padding: "2.5rem", backgroundColor: bg, color: fg }}>
                  <div style={{ position: "relative", zIndex: 10, maxWidth: "18rem" }}>
                    {col.eyebrow && <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: accent ? "rgba(255,255,255,0.8)" : C.primary }}>{col.eyebrow}</p>}
                    <h3 style={{ fontFamily: C.displayFont, marginTop: "0.75rem", fontSize: "1.875rem", lineHeight: 1.2 }}>{col.title}</h3>
                    {col.description && <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: accent ? "rgba(255,255,255,0.85)" : "rgba(246,240,230,0.7)" }}>{col.description}</p>}
                    <a
                      href={col.ctaUrl ?? "#shop"}
                      style={accent
                        ? { marginTop: "1.5rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", borderRadius: "999px", backgroundColor: "#fff", padding: "0.6rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: C.primary, textDecoration: "none" }
                        : { marginTop: "1.5rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#f6f0e6", textDecoration: "none" }}
                    >
                      {col.ctaLabel ?? "Explore collection"} <ArrowRight size={16} />
                    </a>
                  </div>
                  {col.imageUrl && (
                    <img src={col.imageUrl} alt="" style={{ position: "absolute", right: "-1.5rem", bottom: 0, height: "14rem", width: "14rem", borderRadius: "1rem", objectFit: "cover", opacity: 0.9 }} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section id="shop" style={{ maxWidth: "80rem", margin: "0 auto", padding: "4rem 1.25rem", fontFamily: C.bodyFont }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: C.primary }}>{eyebrow}</p>
              <h2 style={{ fontFamily: C.displayFont, marginTop: "0.5rem", fontSize: "clamp(2rem, 4vw, 2.5rem)", letterSpacing: "-0.01em", color: C.heading }}>{heading}</h2>
            </div>
            {filters.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {filters.map((f, i) => {
                  const on = i === activeFilter;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setActiveFilter(i)}
                      style={{ borderRadius: "999px", border: "none", padding: "0.4rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", backgroundColor: on ? C.dark : rgba(C.border, 0.05), color: on ? "#f6f0e6" : rgba(C.fg, 0.7), transition: "all 0.2s" }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bsf-product-grid" style={{ marginTop: "2.25rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem" }}>
            {products.map((prod, i) => (
              <ProductCard key={i} prod={prod} C={C} addLabel={p.productAddToCartLabel ?? "Add to cart"} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ProductCard({ prod, C, addLabel }: { prod: StorefrontProduct; C: ResolvedTheme; addLabel: string }) {
  const [hover, setHover] = useState(false);
  const tagDark = prod.tag === "Bestseller" || prod.tag === "Limited";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ borderRadius: "1rem", backgroundColor: C.card, padding: "0.75rem", border: `1px solid ${C.borderFaint}`, transition: "transform 0.2s, box-shadow 0.2s", transform: hover ? "translateY(-4px)" : "none", boxShadow: hover ? "0 18px 40px rgba(33,26,20,0.12)" : "none" }}
    >
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "0.75rem", backgroundColor: C.altBg }}>
        {prod.imageUrl ? (
          <img src={prod.imageUrl} alt={prod.name} style={{ aspectRatio: "1 / 1", width: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center", color: rgba(C.fg, 0.2) }}><Coffee size={40} /></div>
        )}
        {prod.tag && (
          <span style={{ position: "absolute", left: "0.75rem", top: "0.75rem", borderRadius: "999px", padding: "0.25rem 0.6rem", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#fff", backgroundColor: tagDark ? C.dark : C.primary }}>
            {prod.tag}
          </span>
        )}
        <button type="button" aria-label="Add to wishlist" style={{ position: "absolute", right: "0.75rem", top: "0.75rem", display: "flex", height: "2rem", width: "2rem", alignItems: "center", justifyContent: "center", borderRadius: "999px", border: "none", backgroundColor: "rgba(255,255,255,0.9)", color: rgba(C.fg, 0.6), cursor: "pointer", boxShadow: "0 2px 6px rgba(33,26,20,0.1)" }}>
          <Heart size={16} />
        </button>
        <div style={{ position: "absolute", left: "0.75rem", right: "0.75rem", bottom: "0.75rem", opacity: hover ? 1 : 0, transform: hover ? "translateY(0)" : "translateY(8px)", transition: "opacity 0.25s, transform 0.25s" }}>
          <a href={prod.href ?? "#"} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: "0.5rem", borderRadius: "999px", padding: "0.6rem", backgroundColor: C.primary, color: "#fff", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none", boxShadow: "0 8px 20px rgba(33,26,20,0.18)" }}>
            <Plus size={16} /> {addLabel}
          </a>
        </div>
      </div>
      <div style={{ padding: "0.75rem 0.25rem 0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <h3 style={{ fontFamily: C.displayFont, fontSize: "1rem", fontWeight: 600, lineHeight: 1.2, color: C.heading }}>{prod.name}</h3>
          {prod.price && <span style={{ fontWeight: 600, color: C.heading }}>{prod.price}</span>}
        </div>
        {prod.category && <p style={{ marginTop: "0.15rem", fontSize: "0.75rem", color: rgba(C.fg, 0.55) }}>{prod.category}</p>}
        {(prod.rating != null || prod.reviewCount != null) && (
          <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Stars value={prod.rating ?? 5} size={12} C={C} />
            {prod.reviewCount != null && <span style={{ fontSize: "0.75rem", color: rgba(C.fg, 0.5) }}>({prod.reviewCount})</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Social proof                                                             */
/* ──────────────────────────────────────────────────────────────────────── */

function SocialProof({ p, C }: { p: StorefrontBlockProps; C: ResolvedTheme }) {
  const logos = p.pressLogos ?? [];
  const reviews: StorefrontReview[] = p.reviews ?? [];
  const aggRating = p.reviewsAggregateRating ?? 4.9;
  const eyebrow = p.reviewsSummaryText ?? "Rated excellent by 11,400+ verified coffee drinkers";
  const heading = p.reviewsHeadline ?? "Loved cup after cup";

  return (
    <>
      {logos.length > 0 && (
        <section style={{ overflow: "hidden", borderTop: `1px solid ${C.borderDim}`, borderBottom: `1px solid ${C.borderDim}`, backgroundColor: C.altBg, padding: "1.5rem 0", fontFamily: C.bodyFont }}>
          <div className="bsf-marquee" style={{ display: "flex", width: "max-content", gap: "4rem", paddingLeft: "2rem", fontSize: "1.125rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: rgba(C.fg, 0.35) }}>
            {[0, 1].map(dup => (
              <div key={dup} style={{ display: "flex", flexShrink: 0, gap: "4rem" }}>
                {logos.map((logo, i) => (
                  <span key={`${dup}-${i}`} style={{ display: "inline-flex", gap: "4rem" }}>{logo}<span>·</span></span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section id="reviews" style={{ maxWidth: "80rem", margin: "0 auto", padding: "4rem 1.25rem", fontFamily: C.bodyFont }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Stars value={5} size={22} C={C} />
              <span style={{ fontFamily: C.displayFont, fontSize: "1.875rem", fontWeight: 600, color: C.heading }}>{aggRating}</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: rgba(C.fg, 0.6) }}>{eyebrow}</p>
            <h2 style={{ fontFamily: C.displayFont, marginTop: "0.5rem", fontSize: "clamp(2rem, 4vw, 2.5rem)", letterSpacing: "-0.01em", color: C.heading }}>{heading}</h2>
          </div>

          <div className="bsf-reviews-grid" style={{ marginTop: "2.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
            {reviews.map((r, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", borderRadius: "1rem", backgroundColor: C.card, padding: "1.5rem", border: `1px solid ${C.borderFaint}` }}>
                <Stars value={r.rating ?? 5} size={15} C={C} />
                <p style={{ marginTop: "1rem", flex: 1, fontSize: "0.9375rem", lineHeight: 1.6, color: rgba(C.fg, 0.8) }}>“{r.quote}”</p>
                <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", borderTop: `1px solid ${C.borderDim}`, paddingTop: "1rem" }}>
                  {r.avatarUrl ? (
                    <img src={r.avatarUrl} alt={r.name} style={{ height: "2.5rem", width: "2.5rem", borderRadius: "999px", objectFit: "cover" }} />
                  ) : (
                    <span style={{ display: "flex", height: "2.5rem", width: "2.5rem", alignItems: "center", justifyContent: "center", borderRadius: "999px", backgroundColor: rgba(C.primary, 0.12), color: C.primary, fontWeight: 600, fontSize: "0.875rem" }}>{(r.name || "?").charAt(0)}</span>
                  )}
                  <div style={{ lineHeight: 1.2 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: C.heading }}>{r.name}</p>
                    {r.location && <p style={{ fontSize: "0.75rem", color: rgba(C.fg, 0.5) }}>{r.location}</p>}
                  </div>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, color: C.primary }}>
                    <Check size={14} /> Verified
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Closing CTA / bundle                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

function ClosingCta({ p, C }: { p: StorefrontBlockProps; C: ResolvedTheme }) {
  const eyebrow = p.bundleEyebrow ?? "Best value";
  const title = p.bundleTitle ?? "The Morning Kit";
  const description = p.bundleDescription ?? "Two of our most-loved roasts plus a handmade stoneware mug. Everything you need for a better morning ritual — bundled and discounted.";
  const price = p.bundlePrice ?? "$48";
  const comparePrice = p.bundleComparePrice ?? "$64";
  const saveLabel = p.bundleSaveLabel ?? "Save 25%";
  const ctaLabel = p.bundleCtaLabel ?? "Add bundle to cart";
  const imageUrl = p.bundleImageUrl;
  const guarantees = p.bundleGuarantees ?? [
    { icon: "shield", text: "100% satisfaction guarantee" },
    { icon: "returns", text: "Free returns" },
  ];

  return (
    <section style={{ maxWidth: "80rem", margin: "0 auto", padding: "0 1.25rem 5rem", fontFamily: C.bodyFont }}>
      <div style={{ overflow: "hidden", borderRadius: "2.5rem", backgroundColor: C.dark, color: "#f6f0e6" }}>
        <div className="bsf-bundle-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: "2.5rem", padding: "4rem" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", borderRadius: "999px", padding: "0.25rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: "#fff", backgroundColor: C.primary }}>
              {eyebrow}
            </span>
            <h2 style={{ fontFamily: C.displayFont, marginTop: "1.25rem", fontSize: "clamp(2.25rem, 5vw, 3rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>{title}</h2>
            <p style={{ marginTop: "1rem", maxWidth: "28rem", color: "rgba(246,240,230,0.7)" }}>{description}</p>
            <div style={{ marginTop: "1.75rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontFamily: C.displayFont, fontSize: "2.25rem", fontWeight: 600 }}>{price}</span>
              {comparePrice && <span style={{ fontSize: "1.125rem", color: "rgba(246,240,230,0.4)", textDecoration: "line-through" }}>{comparePrice}</span>}
              {saveLabel && <span style={{ borderRadius: "999px", backgroundColor: "rgba(246,240,230,0.1)", padding: "0.25rem 0.75rem", fontSize: "0.75rem", fontWeight: 600 }}>{saveLabel}</span>}
            </div>
            <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <motion.a
                href={p.bundleCtaUrl ?? "#shop"}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ display: "inline-flex", height: "3rem", alignItems: "center", gap: "0.5rem", borderRadius: "999px", padding: "0 2rem", backgroundColor: C.primary, color: "#fff", fontSize: "1rem", fontWeight: 600, textDecoration: "none", boxShadow: `0 12px 30px ${rgba(C.primary, 0.3)}` }}
              >
                <ShoppingBag size={20} /> {ctaLabel}
              </motion.a>
            </div>
            {guarantees.length > 0 && (
              <div style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem", fontSize: "0.875rem", color: "rgba(246,240,230,0.7)" }}>
                {guarantees.map((g, i) => {
                  const Icon = valueIcon(g.icon);
                  return <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}><Icon size={16} style={{ color: C.primary }} /> {g.text}</span>;
                })}
              </div>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "1.5rem", opacity: 0.3, filter: "blur(60px)", backgroundColor: C.primary }} />
            {imageUrl ? (
              <img src={imageUrl} alt={title} style={{ position: "relative", width: "100%", borderRadius: "1.5rem", objectFit: "cover", boxShadow: "0 30px 70px rgba(0,0,0,0.4)" }} />
            ) : (
              <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: "1.5rem", backgroundColor: "rgba(246,240,230,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(246,240,230,0.3)" }}><ShoppingBag size={56} /></div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Newsletter (inline POST, mirrors ContentSeries subscribe)               */
/* ──────────────────────────────────────────────────────────────────────── */

function NewsletterForm({ p, C, pageId, sessionId }: { p: StorefrontBlockProps; C: ResolvedTheme; pageId?: number; sessionId?: string }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder = p.newsletterPlaceholder ?? "you@email.com";
  const buttonLabel = p.newsletterButtonLabel ?? "Subscribe";
  const submitUrl = p.newsletterSubmitUrl || "/api/lp/leads";
  const successMessage = p.newsletterSuccessMessage ?? "You're in. Watch your inbox.";

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const fields: Record<string, unknown> = {
        email: trimmed,
        _source: "storefront-newsletter",
        _brandName: p.brandName ?? "",
        _submittedAt: new Date().toISOString(),
      };
      const body: Record<string, unknown> = { fields };
      if (typeof pageId === "number") body.pageId = pageId;
      if (sessionId) body.sessionId = sessionId;
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json())?.error ?? ""; } catch { /* ignore */ }
        throw new Error(detail || `Submission failed (${res.status})`);
      }
      try { pushMarketoSubmissionToDataLayer(); } catch (err) { console.error("[storefront] dataLayer push threw:", err); }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [email, submitUrl, pageId, sessionId, p.brandName]);

  if (submitted) {
    return (
      <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", color: C.primary, fontFamily: C.bodyFont, fontSize: "0.875rem", fontWeight: 600 }}>
        <CheckCircle2 size={18} /> {successMessage}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "0.75rem", display: "flex", maxWidth: "24rem", gap: "0.5rem", fontFamily: C.bodyFont }}>
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder={placeholder}
        style={{ height: "2.75rem", flex: 1, minWidth: 0, borderRadius: "999px", border: `1px solid ${rgba(C.border, 0.15)}`, backgroundColor: C.card, padding: "0 1rem", color: C.fg, fontFamily: C.bodyFont, fontSize: "0.875rem", outline: "none" }}
      />
      <motion.button
        type="submit"
        disabled={submitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{ display: "inline-flex", height: "2.75rem", flexShrink: 0, alignItems: "center", gap: "0.4rem", borderRadius: "999px", border: "none", padding: "0 1.5rem", backgroundColor: C.primary, color: "#fff", fontFamily: C.bodyFont, fontWeight: 600, fontSize: "0.875rem", cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {buttonLabel}
      </motion.button>
      {error && <span style={{ display: "none" }}>{error}</span>}
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Footer                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

function FooterSection({ p, C, pageId, sessionId, showNewsletter }: { p: StorefrontBlockProps; C: ResolvedTheme; pageId?: number; sessionId?: string; showNewsletter: boolean }) {
  const columns: StorefrontFooterColumn[] = p.footerColumns ?? [];
  const tagline = p.footerTagline ?? "Small-batch coffee, roasted to order and shipped within 24 hours. Better mornings, one cup at a time.";
  const newsletterHeading = p.newsletterHeading ?? "Join the club";
  const newsletterSubtext = p.newsletterSubtext ?? "Get 10% off your first order + brewing tips.";
  const copyright = p.footerCopyright ?? `© ${new Date().getFullYear()} ${p.brandName ?? "Meridian Coffee Co."} All rights reserved.`;
  const paymentIcons = p.paymentIcons ?? ["VISA", "MC", "AMEX", "PAY", "GPay"];
  const legalLinks: StorefrontNavLink[] = p.footerLegalLinks ?? [{ label: "Privacy", href: "#" }, { label: "Terms", href: "#" }];

  return (
    <footer style={{ borderTop: `1px solid ${C.borderDim}`, backgroundColor: C.altBg, fontFamily: C.bodyFont }}>
      <div style={{ maxWidth: "80rem", margin: "0 auto", padding: "3.5rem 1.25rem" }}>
        <div className="bsf-footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "2.5rem" }}>
          <div>
            <Wordmark p={p} C={C} />
            <p style={{ marginTop: "1rem", maxWidth: "20rem", fontSize: "0.875rem", color: rgba(C.fg, 0.6) }}>{tagline}</p>
            {showNewsletter && (
              <div style={{ marginTop: "1.5rem" }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: C.heading }}>{newsletterHeading}</p>
                <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: rgba(C.fg, 0.55) }}>{newsletterSubtext}</p>
                <NewsletterForm p={p} C={C} pageId={pageId} sessionId={sessionId} />
              </div>
            )}
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: rgba(C.fg, 0.8) }}>{col.heading}</p>
              <ul style={{ marginTop: "1rem", listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.875rem" }}>
                {(col.links ?? []).map((l, li) => (
                  <li key={li}><a href={l.href} style={{ color: rgba(C.fg, 0.6), textDecoration: "none" }}>{l.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bsf-footer-bottom" style={{ marginTop: "3rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderTop: `1px solid ${C.borderDim}`, paddingTop: "1.5rem" }}>
          <p style={{ fontSize: "0.75rem", color: rgba(C.fg, 0.5) }}>{copyright}</p>
          {paymentIcons.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {paymentIcons.map((pi, i) => (
                <span key={i} style={{ display: "flex", height: "1.75rem", alignItems: "center", justifyContent: "center", borderRadius: "0.4rem", backgroundColor: C.card, padding: "0 0.6rem", fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", color: rgba(C.fg, 0.55), border: `1px solid ${C.borderDim}` }}>{pi}</span>
              ))}
            </div>
          )}
          {legalLinks.length > 0 && (
            <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.75rem" }}>
              {legalLinks.map((l, i) => <a key={i} href={l.href} style={{ color: rgba(C.fg, 0.5), textDecoration: "none" }}>{l.label}</a>)}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Main component                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

interface Props {
  props: StorefrontBlockProps;
  brand?: BrandConfig;
  onFieldChange?: (updated: StorefrontBlockProps) => void;
  pageId?: number;
  sessionId?: string;
}

export function BlockStorefront({ props: p, brand, onFieldChange: _onFieldChange, pageId, sessionId }: Props) {
  void _onFieldChange;
  const C = useMemo(() => resolveTheme(p?.theme, brand), [p?.theme, brand]);
  const base = brandDefaults(brand);
  useBlockFonts(
    p?.theme?.displayFontFamily ?? base.displayFontFamily,
    p?.theme?.bodyFontFamily ?? base.bodyFontFamily,
  );

  const safeProps = useMemo<StorefrontBlockProps>(() => {
    if (!p) return { brandName: "Storefront", products: [], collections: [], reviews: [], valueProps: [] } as unknown as StorefrontBlockProps;
    return { ...p, products: p.products ?? [], collections: p.collections ?? [], reviews: p.reviews ?? [], valueProps: p.valueProps ?? [] };
  }, [p]);

  const showNewsletter = safeProps.showNewsletter !== false;

  return (
    <StorefrontErrorBoundary>
      <style>{`
        @keyframes bsf-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .bsf-marquee { animation: bsf-marquee 30s linear infinite; }
        @media (max-width: 900px) {
          .bsf-hero-grid, .bsf-bundle-grid, .bsf-collections-grid { grid-template-columns: 1fr !important; }
          .bsf-product-grid { grid-template-columns: 1fr 1fr !important; }
          .bsf-value-grid { grid-template-columns: 1fr 1fr !important; }
          .bsf-reviews-grid { grid-template-columns: 1fr !important; }
          .bsf-footer-grid { grid-template-columns: 1fr 1fr !important; }
          .bsf-nav-links, .bsf-nav-search { display: none !important; }
          .bsf-nav-cta { display: none !important; }
          .bsf-nav-menu { display: inline-flex !important; }
        }
        @media (max-width: 560px) {
          .bsf-product-grid { grid-template-columns: 1fr !important; }
          .bsf-bundle-grid { padding: 2rem !important; }
        }
      `}</style>
      <div style={{ backgroundColor: C.bg, color: C.fg, fontFamily: C.bodyFont, minHeight: "100vh" }}>
        {(safeProps.showAnnouncement !== false) && <AnnouncementBar p={safeProps} C={C} />}
        {(safeProps.showNav !== false) && <StickyNav p={safeProps} C={C} />}
        {(safeProps.showHero !== false) && <ProductHero p={safeProps} C={C} />}
        {(safeProps.showValueProps !== false) && <ValueProps p={safeProps} C={C} />}
        {(safeProps.showCollections !== false) && <CollectionsSection p={safeProps} C={C} />}
        {(safeProps.showSocialProof !== false) && <SocialProof p={safeProps} C={C} />}
        {(safeProps.showClosingCta !== false) && <ClosingCta p={safeProps} C={C} />}
        {(safeProps.showFooter !== false) && <FooterSection p={safeProps} C={C} pageId={pageId} sessionId={sessionId} showNewsletter={showNewsletter} />}
      </div>
    </StorefrontErrorBoundary>
  );
}

export default BlockStorefront;
