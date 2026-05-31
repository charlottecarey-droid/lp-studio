import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";

const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_FONT;

import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Globe,
  Linkedin,
  Loader2,
  Mail,
  Menu,
  Twitter,
} from "lucide-react";
import type {
  BlogSeriesBlockProps,
  BlogSeriesArticle,
  BlogSeriesAuthor,
  BlogSeriesTopic,
  BlogSeriesNavLink,
  BlogSeriesFooterColumn,
} from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { pushMarketoSubmissionToDataLayer } from "@/lib/gtm-datalayer";

// ─────────────────────────────────────────────────────────────────────────────
// Error boundary (mirrors ContentSeries)
// ─────────────────────────────────────────────────────────────────────────────
class BlogSeriesErrorBoundary extends Component<
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
    console.error("[BlogSeries] render error:", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f6f3ec",
            color: "#1c1a16",
            fontFamily: `${BODY}, 'Inter', sans-serif`,
            padding: "2rem",
          }}
        >
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#b5491f", fontFamily: DISPLAY }}>
              Blog Series — Render Error
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#8b857a", lineHeight: 1.6, fontFamily: BODY }}>
              {this.state.error?.message ?? "Unknown error"}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme resolution
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_THEME = {
  paper: "#f6f3ec",
  paper2: "#efeae0",
  ink: "#1c1a16",
  inkSoft: "#4a463f",
  muted: "#8b857a",
  line: "#d9d3c6",
  accent: "#b5491f",
  accentSoft: "#cf6a3e",
  displayFontFamily: "Fraunces",
  bodyFontFamily: "Inter",
};

function brandDefaults(brand?: BrandConfig): typeof FALLBACK_THEME {
  if (!brand) return FALLBACK_THEME;
  return {
    paper: brand.pageBackground || FALLBACK_THEME.paper,
    paper2: brand.cardBackground || FALLBACK_THEME.paper2,
    ink: brand.textColor || FALLBACK_THEME.ink,
    inkSoft: FALLBACK_THEME.inkSoft,
    muted: FALLBACK_THEME.muted,
    line: brand.borderColor || FALLBACK_THEME.line,
    accent: brand.primaryColor || FALLBACK_THEME.accent,
    accentSoft: brand.primaryColor || FALLBACK_THEME.accentSoft,
    displayFontFamily: brand.displayFont || FALLBACK_THEME.displayFontFamily,
    bodyFontFamily: brand.bodyFont || FALLBACK_THEME.bodyFontFamily,
  };
}

function hexToRgb(hex: string | undefined | null): [number, number, number] {
  if (!hex) return [0, 0, 0];
  const m = hex.replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface ResolvedTheme {
  paper: string;
  paper2: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  accent: string;
  accentSoft: string;
  bodyFont: string;
  displayFont: string;
}

function resolveTheme(t: BlogSeriesBlockProps["theme"], brand?: BrandConfig): ResolvedTheme {
  const base = brandDefaults(brand);
  const raw = t ?? {};
  const m = Object.fromEntries(
    Object.entries({ ...base, ...raw }).map(([k, v]) => [
      k,
      typeof v === "string" && v.trim() === "" ? (base as Record<string, unknown>)[k] ?? v : v,
    ]),
  ) as typeof base;
  const bodyFont = m.bodyFontFamily
    ? `'${m.bodyFontFamily}', 'Inter', system-ui, sans-serif`
    : `${BODY}, 'Inter', system-ui, sans-serif`;
  const displayFont = m.displayFontFamily
    ? `'${m.displayFontFamily}', Georgia, serif`
    : `${DISPLAY}, 'Fraunces', Georgia, serif`;
  return {
    paper: m.paper,
    paper2: m.paper2,
    ink: m.ink,
    inkSoft: m.inkSoft,
    muted: m.muted,
    line: m.line,
    accent: m.accent,
    accentSoft: m.accentSoft,
    bodyFont,
    displayFont,
  };
}

function useGoogleFonts(displayFamily: string, bodyFamily: string) {
  useEffect(() => {
    const families: string[] = [];
    if (displayFamily) {
      families.push(`${displayFamily.replace(/\s+/g, "+")}:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500`);
    }
    if (bodyFamily && bodyFamily !== displayFamily) {
      families.push(`${bodyFamily.replace(/\s+/g, "+")}:wght@300;400;500;600;700`);
    }
    if (!families.length) return;
    const href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
    const id = `bbs-fonts-${href}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [displayFamily, bodyFamily]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wordmark
// ─────────────────────────────────────────────────────────────────────────────
function Wordmark({ p, C, size = "1.25rem" }: { p: BlogSeriesBlockProps; C: ResolvedTheme; size?: string }) {
  if (p.logoUrl) {
    return <img src={p.logoUrl} alt={p.wordmark ?? "Logo"} style={{ height: "1.6rem", width: "auto" }} />;
  }
  const text = p.wordmark ?? "The Margin";
  return (
    <span
      style={{
        fontFamily: C.displayFont,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        fontSize: size,
        color: C.ink,
      }}
    >
      {text}
      <span style={{ color: C.accent }}>.</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky Nav
// ─────────────────────────────────────────────────────────────────────────────
function StickyNav({ p, C }: { p: BlogSeriesBlockProps; C: ResolvedTheme }) {
  const links = p.navLinks ?? [];
  const ctaText = p.navCtaText ?? "Subscribe";
  const ctaUrl = p.navCtaUrl ?? "#subscribe";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        backgroundColor: rgba(C.paper, 0.82),
        borderBottom: `1px solid ${C.line}`,
        fontFamily: C.bodyFont,
      }}
    >
      <nav
        className="bbs-nav"
        style={{
          margin: "0 auto",
          maxWidth: "1240px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
        }}
      >
        <a href="#top" style={{ textDecoration: "none" }}>
          <Wordmark p={p} C={C} />
        </a>
        {links.length > 0 && (
          <div className="bbs-nav-links" style={{ display: "flex", alignItems: "center", gap: "2.25rem" }}>
            {links.map((l, i) => (
              <a
                key={`${l.label}-${i}`}
                href={l.href || "#"}
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  color: C.inkSoft,
                  textDecoration: "none",
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <motion.a
            href={ctaUrl}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="bbs-nav-cta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderRadius: "999px",
              padding: "0.65rem 1.25rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#fff",
              backgroundColor: C.ink,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {ctaText}
            <ArrowRight size={14} />
          </motion.a>
          <button
            type="button"
            aria-label="Menu"
            className="bbs-nav-burger"
            style={{
              display: "none",
              height: "2.25rem",
              width: "2.25rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              border: `1px solid ${C.line}`,
              backgroundColor: "transparent",
              color: C.ink,
              cursor: "pointer",
            }}
          >
            <Menu size={16} />
          </button>
        </div>
      </nav>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────
function Hero({ p, C }: { p: BlogSeriesBlockProps; C: ResolvedTheme }) {
  const eyebrow = p.heroEyebrow ?? "A Series on Attention";
  const headline = p.heroHeadline ?? "Writing for people who";
  const accent = p.heroHeadlineAccent ?? "still read closely.";
  const deck = p.heroDeck ?? "";
  const ctaText = p.heroCtaText ?? "Start reading";
  const ctaUrl = p.heroCtaUrl ?? "#archive";
  const metaLeft = p.heroMetaLeft ?? "";
  const metaRight = p.heroMetaRight ?? "";
  const captionLabel = p.heroCaptionLabel ?? "";
  const captionText = p.heroCaptionText ?? "";

  return (
    <section
      id="top"
      style={{
        margin: "0 auto",
        maxWidth: "1240px",
        padding: "3.5rem 1.5rem 4rem",
      }}
    >
      <div
        className="bbs-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          gap: "4rem",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {eyebrow && (
            <div
              style={{
                marginBottom: "1.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.28em",
                color: C.accent,
              }}
            >
              <span style={{ height: "1px", width: "2rem", backgroundColor: C.accent }} />
              {eyebrow}
            </div>
          )}
          <h1
            style={{
              fontFamily: C.displayFont,
              fontWeight: 300,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              fontSize: "clamp(2.6rem, 5.2vw, 4.6rem)",
              color: C.ink,
              margin: 0,
            }}
          >
            {headline}
            {accent && (
              <>
                <br />
                <span style={{ fontStyle: "italic", fontWeight: 500 }}>{accent}</span>
              </>
            )}
          </h1>
          {deck && (
            <p
              style={{
                marginTop: "1.75rem",
                maxWidth: "32rem",
                fontSize: "1.0625rem",
                lineHeight: 1.65,
                color: C.inkSoft,
              }}
            >
              {deck}
            </p>
          )}
          <div
            style={{
              marginTop: "2.25rem",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "1.5rem",
            }}
          >
            {ctaText && (
              <motion.a
                href={ctaUrl}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  borderRadius: "999px",
                  padding: "0.875rem 1.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#fff",
                  backgroundColor: C.accent,
                  textDecoration: "none",
                }}
              >
                {ctaText}
                <ArrowUpRight size={16} />
              </motion.a>
            )}
            {(metaLeft || metaRight) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: C.muted,
                }}
              >
                {metaLeft && <span>{metaLeft}</span>}
                {metaLeft && metaRight && (
                  <span style={{ height: "0.25rem", width: "0.25rem", borderRadius: "999px", backgroundColor: C.muted }} />
                )}
                {metaRight && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                    <Clock size={14} /> {metaRight}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {p.heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ position: "relative" }}
          >
            <div style={{ overflow: "hidden", borderRadius: "2px" }}>
              <img
                src={p.heroImageUrl}
                alt={headline}
                style={{ height: "clamp(360px, 40vw, 540px)", width: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            {(captionLabel || captionText) && (
              <div
                className="bbs-hero-caption"
                style={{
                  position: "absolute",
                  bottom: "-1.25rem",
                  left: "-1.25rem",
                  padding: "1rem 1.25rem",
                  backgroundColor: C.paper,
                  border: `1px solid ${C.line}`,
                }}
              >
                {captionLabel && (
                  <p
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.24em",
                      color: C.muted,
                      margin: 0,
                    }}
                  >
                    {captionLabel}
                  </p>
                )}
                {captionText && (
                  <p style={{ fontFamily: C.displayFont, marginTop: "0.25rem", fontSize: "1.125rem", color: C.ink }}>
                    {captionText}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Article archive (featured lead + grid)
// ─────────────────────────────────────────────────────────────────────────────
function ArticleCard({ a, C }: { a: BlogSeriesArticle; C: ResolvedTheme }) {
  return (
    <article className="bbs-card" style={{ cursor: "pointer" }}>
      <a href={a.href || "#"} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {a.imageUrl && (
          <div style={{ overflow: "hidden", borderRadius: "2px" }}>
            <img
              src={a.imageUrl}
              alt={a.title}
              className="bbs-card-img"
              style={{ height: "230px", width: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}
        <div style={{ marginTop: "1.25rem" }}>
          {a.category && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: C.accent,
              }}
            >
              {a.category}
            </span>
          )}
          <h3
            style={{
              fontFamily: C.displayFont,
              marginTop: "0.75rem",
              fontSize: "1.45rem",
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              color: C.ink,
            }}
          >
            {a.title}
          </h3>
          {a.excerpt && (
            <p style={{ marginTop: "0.75rem", fontSize: "0.9375rem", lineHeight: 1.6, color: C.inkSoft }}>
              {a.excerpt}
            </p>
          )}
          <div
            style={{
              marginTop: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${C.line}`,
              paddingTop: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              {a.avatarUrl && (
                <img
                  src={a.avatarUrl}
                  alt={a.author ?? ""}
                  style={{ height: "1.75rem", width: "1.75rem", borderRadius: "999px", objectFit: "cover" }}
                />
              )}
              {a.author && <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: C.ink }}>{a.author}</span>}
            </div>
            {(a.date || a.readTime) && (
              <span style={{ fontSize: "0.75rem", color: C.muted }}>
                {[a.date, a.readTime].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}

function ArchiveSection({ p, C }: { p: BlogSeriesBlockProps; C: ResolvedTheme }) {
  const eyebrow = p.archiveEyebrow ?? "Latest from the archive";
  const linkText = p.archiveLinkText ?? "";
  const linkUrl = p.archiveLinkUrl ?? "#";
  const featured = p.featuredArticle;
  const featuredBadge = p.featuredBadge ?? "Featured Essay";
  const articles = (p.articles ?? []).filter((a) => !a.hidden);

  if (!featured && articles.length === 0 && !eyebrow) return null;

  return (
    <section id="archive" style={{ margin: "0 auto", maxWidth: "1240px", padding: "0 1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${C.line}`,
          paddingBottom: "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            color: C.inkSoft,
            margin: 0,
          }}
        >
          {eyebrow}
        </h2>
        {linkText && (
          <a
            href={linkUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: C.accent,
              textDecoration: "none",
            }}
          >
            {linkText} <ArrowRight size={14} />
          </a>
        )}
      </div>

      {featured && (
        <motion.article
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="bbs-card bbs-featured"
          style={{
            marginTop: "2.5rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "3rem",
            cursor: "pointer",
          }}
        >
          {featured.imageUrl && (
            <a href={featured.href || "#"} style={{ overflow: "hidden", borderRadius: "2px", display: "block" }}>
              <img
                src={featured.imageUrl}
                alt={featured.title}
                className="bbs-card-img"
                style={{ height: "clamp(300px, 32vw, 400px)", width: "100%", objectFit: "cover", display: "block" }}
              />
            </a>
          )}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {featured.category && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: C.accent,
                  }}
                >
                  {featured.category}
                </span>
              )}
              {featuredBadge && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: C.muted,
                  }}
                >
                  {featuredBadge}
                </span>
              )}
            </div>
            <h3
              style={{
                fontFamily: C.displayFont,
                fontWeight: 300,
                lineHeight: 1.08,
                letterSpacing: "-0.01em",
                fontSize: "clamp(1.9rem, 3.4vw, 2.9rem)",
                color: C.ink,
                margin: 0,
              }}
            >
              {featured.title}
            </h3>
            {featured.excerpt && (
              <p style={{ marginTop: "1.25rem", maxWidth: "36rem", fontSize: "1rem", lineHeight: 1.65, color: C.inkSoft }}>
                {featured.excerpt}
              </p>
            )}
            <div style={{ marginTop: "2rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {featured.avatarUrl && (
                <img
                  src={featured.avatarUrl}
                  alt={featured.author ?? ""}
                  style={{ height: "2.5rem", width: "2.5rem", borderRadius: "999px", objectFit: "cover" }}
                />
              )}
              <div style={{ fontSize: "0.8125rem" }}>
                {featured.author && <p style={{ fontWeight: 600, color: C.ink, margin: 0 }}>{featured.author}</p>}
                {(featured.date || featured.readTime) && (
                  <p style={{ color: C.muted, margin: 0 }}>
                    {[featured.date, featured.readTime ? `${featured.readTime} read` : ""].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.article>
      )}

      {articles.length > 0 && (
        <div
          className="bbs-grid"
          style={{
            marginTop: featured ? "4rem" : "2.5rem",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            columnGap: "2rem",
            rowGap: "3.5rem",
          }}
        >
          {articles.map((a, i) => (
            <ArticleCard key={`${a.title}-${i}`} a={a} C={C} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Topics
// ─────────────────────────────────────────────────────────────────────────────
function TopicsSection({ p, C }: { p: BlogSeriesBlockProps; C: ResolvedTheme }) {
  const topics = p.topics ?? [];
  if (!topics.length) return null;
  const eyebrow = p.topicsEyebrow ?? "Browse";
  const headline = p.topicsHeadline ?? "Read by topic";
  const description = p.topicsDescription ?? "";

  return (
    <section id="topics" style={{ margin: "0 auto", maxWidth: "1240px", padding: "5rem 1.5rem 0" }}>
      <div style={{ borderRadius: "4px", backgroundColor: C.paper2, padding: "3rem 2rem" }}>
        <div
          className="bbs-topics-head"
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem", justifyContent: "space-between" }}
        >
          <div>
            {eyebrow && (
              <p
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                  color: C.accent,
                  margin: 0,
                }}
              >
                {eyebrow}
              </p>
            )}
            {headline && (
              <h2
                style={{
                  fontFamily: C.displayFont,
                  marginTop: "0.5rem",
                  fontSize: "clamp(1.75rem, 3vw, 2.25rem)",
                  fontWeight: 300,
                  letterSpacing: "-0.01em",
                  color: C.ink,
                }}
              >
                {headline}
              </h2>
            )}
          </div>
          {description && (
            <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: C.inkSoft }}>{description}</p>
          )}
        </div>
        <div style={{ marginTop: "2.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {topics.map((t, i) => (
            <a
              key={`${t.label}-${i}`}
              href={t.href || "#"}
              className="bbs-pill"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: "999px",
                border: `1px solid ${C.line}`,
                backgroundColor: C.paper,
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: C.ink,
                textDecoration: "none",
              }}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: C.muted }}>{t.count}</span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contributors
// ─────────────────────────────────────────────────────────────────────────────
function ContributorsSection({ p, C }: { p: BlogSeriesBlockProps; C: ResolvedTheme }) {
  const contributors = p.contributors ?? [];
  if (!contributors.length) return null;
  const eyebrow = p.contributorsEyebrow ?? "The contributors";

  return (
    <section id="contributors" style={{ margin: "0 auto", maxWidth: "1240px", padding: "5rem 1.5rem 0" }}>
      <div style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: "1rem" }}>
        <h2
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            color: C.inkSoft,
            margin: 0,
          }}
        >
          {eyebrow}
        </h2>
      </div>
      <div
        className="bbs-contributors"
        style={{
          marginTop: "3rem",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          columnGap: "2.5rem",
          rowGap: "3rem",
        }}
      >
        {contributors.map((a, i) => (
          <motion.div
            key={`${a.name}-${i}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
          >
            {a.avatarUrl && (
              <img
                src={a.avatarUrl}
                alt={a.name}
                style={{ height: "5rem", width: "5rem", borderRadius: "999px", objectFit: "cover" }}
              />
            )}
            <h3 style={{ fontFamily: C.displayFont, marginTop: "1.25rem", fontSize: "1.5rem", fontWeight: 400, color: C.ink }}>
              {a.name}
            </h3>
            {a.role && (
              <p
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: C.accent,
                }}
              >
                {a.role}
              </p>
            )}
            {a.bio && (
              <p style={{ marginTop: "1rem", fontSize: "0.9375rem", lineHeight: 1.6, color: C.inkSoft }}>{a.bio}</p>
            )}
            {(a.twitterUrl || a.linkedinUrl || a.websiteUrl) && (
              <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", color: C.muted }}>
                {a.twitterUrl && (
                  <a href={a.twitterUrl} aria-label="Twitter" style={{ color: "inherit" }}>
                    <Twitter size={16} />
                  </a>
                )}
                {a.linkedinUrl && (
                  <a href={a.linkedinUrl} aria-label="LinkedIn" style={{ color: "inherit" }}>
                    <Linkedin size={16} />
                  </a>
                )}
                {a.websiteUrl && (
                  <a href={a.websiteUrl} aria-label="Website" style={{ color: "inherit" }}>
                    <Globe size={16} />
                  </a>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscribe (dark newsletter block w/ inline POST)
// ─────────────────────────────────────────────────────────────────────────────
function SubscribeSection({
  p,
  C,
  pageId,
  sessionId,
}: {
  p: BlogSeriesBlockProps;
  C: ResolvedTheme;
  pageId?: number;
  sessionId?: string;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eyebrow = p.subscribeEyebrow ?? "The Margin Letter";
  const headline = p.subscribeHeadline ?? "One considered essay,";
  const accent = p.subscribeHeadlineAccent ?? "every other Sunday.";
  const description = p.subscribeDescription ?? "";
  const placeholder = p.subscribePlaceholder ?? "you@example.com";
  const buttonLabel = p.subscribeButtonLabel ?? "Subscribe free";
  const disclaimer = p.subscribeDisclaimer ?? "Unsubscribe in one click. We'll never share your address.";
  const successMessage = p.subscribeSuccessMessage ?? "You're in. Watch your inbox.";
  const submitUrl = p.subscribeSubmitUrl || "/api/lp/leads";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;
      setSubmitting(true);
      setError(null);
      try {
        const fields: Record<string, unknown> = {
          email: trimmed,
          _source: "blog-series-subscribe",
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
          try {
            detail = (await res.json())?.error ?? "";
          } catch {
            /* ignore */
          }
          throw new Error(detail || `Subscription failed (${res.status})`);
        }
        try {
          pushMarketoSubmissionToDataLayer();
        } catch (err) {
          console.error("[lp-studio] dataLayer push threw:", err);
        }
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, submitUrl, pageId, sessionId],
  );

  return (
    <section id="subscribe" style={{ margin: "6rem auto 0", maxWidth: "1240px", padding: "0 1.5rem" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "4px",
          backgroundColor: C.ink,
          color: C.paper,
          padding: "clamp(3rem, 6vw, 6rem) clamp(2rem, 5vw, 4rem)",
          textAlign: "center",
        }}
      >
        {eyebrow && (
          <div
            style={{
              margin: "0 auto 1.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "0.6875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.28em",
              color: C.accentSoft,
            }}
          >
            <Mail size={14} />
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontFamily: C.displayFont,
            margin: "0 auto",
            maxWidth: "42rem",
            fontWeight: 300,
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            fontSize: "clamp(2rem, 4vw, 3.4rem)",
            color: C.paper,
          }}
        >
          {headline}
          {accent && (
            <>
              <br />
              <span style={{ fontStyle: "italic" }}>{accent}</span>
            </>
          )}
        </h2>
        {description && (
          <p
            style={{
              margin: "1.5rem auto 0",
              maxWidth: "28rem",
              fontSize: "1rem",
              lineHeight: 1.65,
              color: rgba(C.paper, 0.7),
            }}
          >
            {description}
          </p>
        )}

        {submitted ? (
          <p
            style={{
              margin: "2.5rem auto 0",
              maxWidth: "28rem",
              fontSize: "1rem",
              fontWeight: 500,
              color: C.accentSoft,
            }}
          >
            {successMessage}
          </p>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="bbs-subscribe-form"
              style={{
                margin: "2.5rem auto 0",
                display: "flex",
                maxWidth: "28rem",
                gap: "0.75rem",
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                style={{
                  height: "3rem",
                  flex: 1,
                  minWidth: 0,
                  borderRadius: "999px",
                  padding: "0 1.25rem",
                  fontSize: "0.875rem",
                  color: "#fff",
                  outline: "none",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  fontFamily: C.bodyFont,
                }}
              />
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.03 }}
                whileTap={{ scale: submitting ? 1 : 0.97 }}
                style={{
                  height: "3rem",
                  whiteSpace: "nowrap",
                  borderRadius: "999px",
                  padding: "0 1.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#fff",
                  backgroundColor: C.accent,
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontFamily: C.bodyFont,
                }}
              >
                {submitting && <Loader2 size={14} className="bbs-spin" />}
                {buttonLabel}
              </motion.button>
            </form>
            {error && (
              <p style={{ marginTop: "1rem", fontSize: "0.8125rem", color: C.accentSoft }}>{error}</p>
            )}
            {disclaimer && (
              <p style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: rgba(C.paper, 0.45) }}>{disclaimer}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────
function Footer({ p, C }: { p: BlogSeriesBlockProps; C: ResolvedTheme }) {
  const tagline = p.footerTagline ?? "";
  const columns = p.footerColumns ?? [];
  const copyright = p.footerCopyright ?? "";
  const legalLinks = p.footerLegalLinks ?? [];

  return (
    <footer style={{ margin: "0 auto", maxWidth: "1240px", padding: "5rem 1.5rem 3rem" }}>
      <div
        className="bbs-footer-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(3, 1fr)",
          gap: "2.5rem",
          borderTop: `1px solid ${C.line}`,
          padding: "3rem 0",
        }}
      >
        <div>
          <Wordmark p={p} C={C} />
          {tagline && (
            <p style={{ marginTop: "1rem", maxWidth: "14rem", fontSize: "0.84rem", lineHeight: 1.6, color: C.inkSoft }}>
              {tagline}
            </p>
          )}
        </div>
        {columns.map((col, ci) => (
          <div key={`${col.heading}-${ci}`}>
            <h4
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: C.muted,
                margin: 0,
              }}
            >
              {col.heading}
            </h4>
            <ul style={{ listStyle: "none", margin: "1rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {(col.links ?? []).map((it, li) => (
                <li key={`${it.label}-${li}`}>
                  <a href={it.href || "#"} style={{ fontSize: "0.875rem", color: C.inkSoft, textDecoration: "none" }}>
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="bbs-footer-bottom"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
          borderTop: `1px solid ${C.line}`,
          paddingTop: "1.5rem",
          fontSize: "0.78rem",
          color: C.muted,
        }}
      >
        {copyright && <p style={{ margin: 0 }}>{copyright}</p>}
        {legalLinks.length > 0 && (
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {legalLinks.map((l, i) => (
              <a key={`${l.label}-${i}`} href={l.href || "#"} style={{ color: "inherit", textDecoration: "none" }}>
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props + root component
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  props: BlogSeriesBlockProps;
  brand?: BrandConfig;
  onFieldChange?: (updated: BlogSeriesBlockProps) => void;
  pageId?: number;
  sessionId?: string;
}

export function BlockBlogSeries({ props: p, brand, onFieldChange: _onFieldChange, pageId, sessionId }: Props) {
  void _onFieldChange;
  const C = useMemo(() => resolveTheme(p?.theme, brand), [p?.theme, brand]);
  const base = brandDefaults(brand);
  useGoogleFonts(
    p?.theme?.displayFontFamily ?? base.displayFontFamily,
    p?.theme?.bodyFontFamily ?? base.bodyFontFamily,
  );

  const safeProps = useMemo<BlogSeriesBlockProps>(() => {
    if (!p) return { wordmark: "The Margin" } as BlogSeriesBlockProps;
    return {
      ...p,
      navLinks: p.navLinks ?? [],
      articles: p.articles ?? [],
      topics: p.topics ?? [],
      contributors: p.contributors ?? [],
      footerColumns: p.footerColumns ?? [],
    };
  }, [p]);

  return (
    <BlogSeriesErrorBoundary>
      <style>{`
        @keyframes bbs-spin { to { transform: rotate(360deg); } }
        .bbs-spin { animation: bbs-spin 0.8s linear infinite; }
        .bbs-card-img { transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
        .bbs-card:hover .bbs-card-img { transform: scale(1.04); }
        .bbs-pill { transition: all 0.3s ease; }
        .bbs-pill:hover { background-color: ${C.ink} !important; color: ${C.paper} !important; border-color: ${C.ink} !important; }
        @media (max-width: 900px) {
          .bbs-hero-grid { grid-template-columns: 1fr !important; gap: 2.5rem !important; }
          .bbs-featured { grid-template-columns: 1fr !important; gap: 2rem !important; }
          .bbs-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bbs-contributors { grid-template-columns: 1fr !important; }
          .bbs-footer-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .bbs-nav-links { display: none !important; }
          .bbs-nav-cta { display: none !important; }
          .bbs-nav-burger { display: flex !important; }
          .bbs-grid { grid-template-columns: 1fr !important; }
          .bbs-hero-caption { display: none !important; }
          .bbs-subscribe-form { flex-direction: column !important; }
          .bbs-footer-grid { grid-template-columns: 1fr !important; }
          .bbs-footer-bottom { flex-direction: column !important; align-items: flex-start !important; }
        }
        @media (min-width: 641px) {
          .bbs-topics-head { flex-direction: row !important; align-items: flex-end !important; }
          .bbs-footer-bottom { flex-direction: row !important; align-items: center !important; }
        }
      `}</style>
      <div
        style={{
          backgroundColor: C.paper,
          color: C.ink,
          fontFamily: C.bodyFont,
          minHeight: "100vh",
        }}
      >
        {safeProps.showNav !== false && <StickyNav p={safeProps} C={C} />}
        {safeProps.showHero !== false && <Hero p={safeProps} C={C} />}
        {safeProps.showArchive !== false && <ArchiveSection p={safeProps} C={C} />}
        {safeProps.showTopics !== false && <TopicsSection p={safeProps} C={C} />}
        {safeProps.showContributors !== false && <ContributorsSection p={safeProps} C={C} />}
        {safeProps.showSubscribe !== false && (
          <SubscribeSection p={safeProps} C={C} pageId={pageId} sessionId={sessionId} />
        )}
        {safeProps.showFooter !== false && <Footer p={safeProps} C={C} />}
      </div>
    </BlogSeriesErrorBoundary>
  );
}

export default BlockBlogSeries;
