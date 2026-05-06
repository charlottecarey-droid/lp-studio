import { useEffect, useMemo, useState, useCallback, Component, type ReactNode, type ErrorInfo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Headphones,
  Globe,
  Link2,
  Linkedin,
  Loader2,
  Mic,
  Play,
  PlayCircle,
  Podcast,
  Radio,
  Rss,
  Send,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";
import type {
  ContentSeriesBlockProps,
  ContentSeriesEpisode,
  ContentSeriesHost,
  ContentSeriesCta,
  ContentSeriesTheme,
  EpisodeStatus,
} from "@/lib/block-types";
import type { FormStep, FormField } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

class ContentSeriesErrorBoundary extends Component<
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
    console.error("[ContentSeries] render error:", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0c0f12", color: "#eeeae3", fontFamily: "'Inter', sans-serif", padding: "2rem" }}>
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#b59a6e" }}>Content Series — Render Error</h2>
            <p style={{ fontSize: "0.85rem", color: "#7a8088", lineHeight: 1.6 }}>
              {this.state.error?.message ?? "Unknown error"}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const FALLBACK_THEME = {
  bg: "#0c0f12",
  cardBg: "#141619",
  fg: "#eeeae3",
  headingColor: "#eeeae3",
  primary: "#b59a6e",
  muted: "#7a8088",
  border: "#262a2f",
  navBg: "#0c0f12",
  navBgOpacity: 0.65,
  navText: "#eeeae3",
  displayFontFamily: "EB Garamond",
  bodyFontFamily: "Inter",
};

function brandDefaults(brand?: BrandConfig): typeof FALLBACK_THEME {
  if (!brand) return FALLBACK_THEME;
  return {
    bg: brand.pageBackground || FALLBACK_THEME.bg,
    cardBg: brand.cardBackground || FALLBACK_THEME.cardBg,
    fg: brand.textColor || FALLBACK_THEME.fg,
    headingColor: brand.textColor || FALLBACK_THEME.headingColor,
    primary: brand.primaryColor || FALLBACK_THEME.primary,
    muted: FALLBACK_THEME.muted,
    border: brand.borderColor || FALLBACK_THEME.border,
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
  card: string;
  fg: string;
  heading: string;
  primary: string;
  primaryDim: string;
  primaryFaint: string;
  primaryGhost: string;
  muted: string;
  mutedDim: string;
  border: string;
  borderDim: string;
  navBg: string;
  navText: string;
  navTextDim: string;
  navTextSoft: string;
  bodyFont: string;
  displayFont: string;
}

function resolveTheme(t: ContentSeriesBlockProps["theme"], brand?: BrandConfig): ResolvedTheme {
  const base = brandDefaults(brand);
  const raw = t ?? {};
  const m = Object.fromEntries(
    Object.entries({ ...base, ...raw }).map(([k, v]) => [k, (typeof v === "string" && v.trim() === "") ? (base as Record<string, unknown>)[k] ?? v : v])
  ) as typeof base;
  const heading = m.headingColor || m.fg;
  const bodyFont = m.bodyFontFamily ? `'${m.bodyFontFamily}', sans-serif` : "'Inter', sans-serif";
  const displayFont = m.displayFontFamily ? `'${m.displayFontFamily}', serif` : "'EB Garamond', serif";
  return {
    bg: m.bg,
    card: m.cardBg,
    fg: m.fg,
    heading,
    primary: m.primary,
    primaryDim: rgba(m.primary, 0.8),
    primaryFaint: rgba(m.primary, 0.4),
    primaryGhost: rgba(m.primary, 0.06),
    muted: m.muted,
    mutedDim: rgba(m.muted, 0.5),
    border: m.border,
    borderDim: rgba(m.border, 0.5),
    navBg: rgba(m.navBg, m.navBgOpacity ?? 0.65),
    navText: m.navText,
    navTextDim: rgba(m.navText, 0.55),
    navTextSoft: rgba(m.navText, 0.78),
    bodyFont,
    displayFont,
  };
}

function defaultCtaForType(seriesType: ContentSeriesBlockProps["seriesType"]): string {
  if (seriesType === "webinar") return "Register";
  if (seriesType === "series") return "Watch";
  return "Listen Now";
}

function seriesIcon(seriesType: ContentSeriesBlockProps["seriesType"]) {
  if (seriesType === "webinar") return PlayCircle;
  if (seriesType === "series") return Play;
  return Mic;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function VideoModal({
  videoId,
  onClose,
  C,
  nextEpisode,
  onPlayNext,
}: {
  videoId: string;
  onClose: () => void;
  C: ResolvedTheme;
  nextEpisode?: { episode: ContentSeriesEpisode; videoId?: string } | null;
  onPlayNext?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const next = nextEpisode?.episode;
  const nextHasVideo = !!nextEpisode?.videoId;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          backgroundColor: "rgba(0,0,0,0.88)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "2rem",
          gap: "1rem",
          cursor: "pointer",
          overflowY: "auto",
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "960px",
            aspectRatio: "16 / 9",
            borderRadius: "0.75rem",
            overflow: "hidden",
            backgroundColor: "#000",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
            cursor: "default",
            flexShrink: 0,
          }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title="Video player"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          />
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 10,
              width: "2.25rem", height: "2.25rem", borderRadius: "999px",
              backgroundColor: "rgba(0,0,0,0.6)", border: "none",
              color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.85)"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.6)"; }}
          >
            <X size={16} />
          </button>
        </motion.div>

        {next && onPlayNext && (
          <motion.button
            type="button"
            onClick={e => { e.stopPropagation(); onPlayNext(); }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            whileHover={{ y: -2 }}
            style={{
              width: "100%",
              maxWidth: "960px",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.85rem 1.1rem",
              backgroundColor: "rgba(255,255,255,0.06)",
              border: `1px solid ${rgba(C.primary, 0.5)}`,
              borderRadius: "0.75rem",
              color: "#fff",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: C.bodyFont,
              transition: "background-color 0.2s, border-color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = rgba(C.primary, 0.5); }}
          >
            {next.thumbnailUrl && (
              <div style={{ position: "relative", flexShrink: 0, width: "5.5rem", aspectRatio: "16/9", borderRadius: "0.4rem", overflow: "hidden", backgroundColor: "#000" }}>
                <img src={next.thumbnailUrl} alt={next.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: C.primary, marginBottom: "0.25rem" }}>
                Next Up
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 500, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {next.title}
              </div>
              {next.guestName && (
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginTop: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {next.guestName}{next.guestTitle ? ` · ${next.guestTitle}` : ""}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0, color: C.primary, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {nextHasVideo ? "Watch" : "View"}
              <ArrowRight size={14} />
            </div>
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function PlayOverlay({ C, size = "md" }: { C: ResolvedTheme; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "2.25rem" : "3.5rem";
  const iconSize = size === "sm" ? 14 : 22;
  return (
    <div
      data-play-overlay
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.3)",
        opacity: 0,
        transition: "opacity 0.25s ease",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <div
        style={{
          width: dim, height: dim, borderRadius: "999px",
          backgroundColor: C.primary, color: C.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 20px ${rgba(C.primary, 0.4)}`,
        }}
      >
        <Play size={iconSize} fill="currentColor" />
      </div>
    </div>
  );
}

function showPlayOverlay(el: HTMLElement) {
  const overlay = el.querySelector("[data-play-overlay]") as HTMLElement | null;
  if (overlay) overlay.style.opacity = "1";
}
function hidePlayOverlay(el: HTMLElement) {
  const overlay = el.querySelector("[data-play-overlay]") as HTMLElement | null;
  if (overlay) overlay.style.opacity = "0";
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function useGoogleFonts(displayFamily: string, bodyFamily: string) {
  useEffect(() => {
    const families: string[] = [];
    if (displayFamily) {
      families.push(`${displayFamily.replace(/\s+/g, "+")}:ital,wght@0,400;0,500;0,600;1,400`);
    }
    if (bodyFamily && bodyFamily !== displayFamily) {
      families.push(`${bodyFamily.replace(/\s+/g, "+")}:wght@300;400;500;600`);
    }
    if (!families.length) return;
    const href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join("&")}&display=swap`;
    const id = `bcs-fonts-${href}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [displayFamily, bodyFamily]);
}

function StickyNav({
  p,
  C,
  onSubscribe,
}: {
  p: ContentSeriesBlockProps;
  C: ResolvedTheme;
  onSubscribe: (initial: Record<string, string>) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  // onSubscribe is intentionally unused here — the nav Subscribe button anchors to
  // #subscribe instead of opening the modal so visitors land in the bottom CTA section
  // where they can also see all the podcast platform links.
  void onSubscribe;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The nav now always shows a Subscribe button (when subscribeEnabled) that scrolls
  // to the #subscribe section so the email input can breathe in the CTA section.
  const subscribeOn = p.subscribeEnabled !== false;
  const navCtaLabel = subscribeOn
    ? (p.subscribeButtonLabel ?? "Subscribe")
    : (p.navCtaText ?? defaultCtaForType(p.seriesType));
  const navCtaHref = subscribeOn ? "#subscribe" : (p.navCtaUrl ?? "#subscribe");
  // De-dupe: when the Subscribe button is on, hide any nav link that points to the
  // same anchor or shares the same label so visitors don't see "Subscribe" twice.
  const links = (p.navLinks ?? []).filter(link => {
    if (!subscribeOn) return true;
    const href = (link.href || "").trim().toLowerCase();
    const label = (link.label || "").trim().toLowerCase();
    if (href === "#subscribe") return false;
    if (label === navCtaLabel.trim().toLowerCase()) return false;
    return true;
  });

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: scrolled ? "0.85rem 1rem" : "1.25rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1.5rem",
        backgroundColor: scrolled ? C.navBg : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.borderDim}` : "1px solid transparent",
        transition: "padding 0.3s ease, background-color 0.3s ease, border-color 0.3s ease",
        fontFamily: C.bodyFont,
      }}
    >
      <a
        href="#top"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          color: C.navText,
          textDecoration: "none",
        }}
      >
        {p.logoUrl ? (
          <img src={p.logoUrl} alt={p.seriesTitle} style={{ height: "1.4rem", width: "auto" }} />
        ) : (
          <>
            <Radio size={18} style={{ color: C.primary }} />
            <span
              style={{
                fontFamily: C.displayFont,
                fontSize: "1.05rem",
                letterSpacing: "0.02em",
              }}
            >
              {p.seriesTitle}
            </span>
          </>
        )}
      </a>

      {links.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "2rem",
            alignItems: "center",
          }}
          className="hidden md:flex"
        >
          {links.map(link => (
            <motion.a
              key={`${link.label}-${link.href}`}
              href={link.href}
              whileHover={{ color: C.navText }}
              transition={{ duration: 0.2 }}
              style={{
                fontWeight: 400,
                fontSize: "0.7rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: C.navTextDim,
                textDecoration: "none",
              }}
            >
              {link.label}
            </motion.a>
          ))}
        </div>
      )}

      <motion.a
        href={navCtaHref}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.6rem 1.25rem",
          backgroundColor: C.primary,
          color: C.bg,
          fontFamily: C.bodyFont,
          fontWeight: 500,
          fontSize: "0.7rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          textDecoration: "none",
          borderRadius: "999px",
          whiteSpace: "nowrap",
        }}
      >
        {subscribeOn ? <Send size={13} /> : null}
        {navCtaLabel}
        {!subscribeOn && <ArrowRight size={14} />}
      </motion.a>
    </motion.nav>
  );
}

function platformIconFor(cta: ContentSeriesCta): { icon: React.ReactNode; label: string } {
  const url = (cta.url || "").toLowerCase();
  const label = (cta.label || "").toLowerCase();
  const text = `${url} ${label}`;
  if (text.includes("spotify")) {
    return {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      ),
      label: cta.label || "Spotify",
    };
  }
  if (text.includes("apple") || text.includes("podcasts.apple") || text.includes("itunes")) {
    return { icon: <Podcast size={18} />, label: cta.label || "Apple Podcasts" };
  }
  if (text.includes("youtube") || text.includes("youtu.be")) {
    return { icon: <Youtube size={18} />, label: cta.label || "YouTube" };
  }
  if (text.includes("rss") || url.endsWith(".xml")) {
    return { icon: <Rss size={18} />, label: cta.label || "RSS" };
  }
  if (text.includes("overcast") || text.includes("pocket") || text.includes("castbox")) {
    return { icon: <Headphones size={18} />, label: cta.label || "Podcast" };
  }
  if (text.includes("amazon") || text.includes("audible")) {
    return { icon: <Headphones size={18} />, label: cta.label || "Amazon" };
  }
  return { icon: <Link2 size={18} />, label: cta.label || "Link" };
}

function HeroFullBleed({ p, C }: { p: ContentSeriesBlockProps; C: ResolvedTheme }) {
  const Icon = seriesIcon(p.seriesType);
  const ctaText = p.heroCtaText ?? defaultCtaForType(p.seriesType);
  const ctaUrl = p.heroCtaUrl ?? "#episodes";
  const eyebrow = p.heroEyebrow ?? "Latest Episode";

  return (
    <section
      id="top"
      className="bcs-section"
      style={{
        position: "relative",
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {(p.heroBackgroundImageUrl || p.heroImageUrl) && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${p.heroBackgroundImageUrl || p.heroImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: (() => { const o = Math.max(0, Math.min(p.heroOverlayOpacity ?? 0.7, 1)); return `linear-gradient(180deg, ${rgba(C.bg, o)} 0%, ${rgba(C.bg, Math.min(o + 0.15, 1))} 60%, ${C.bg} 100%)`; })(),
              pointerEvents: "none",
            }}
          />
        </>
      )}
      {!p.heroBackgroundImageUrl && !p.heroImageUrl && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 20% 0%, ${rgba(C.primary, 0.12)} 0%, transparent 55%), radial-gradient(circle at 90% 80%, ${rgba(C.primary, 0.06)} 0%, transparent 50%)`,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          maxWidth: "56rem",
          margin: "0 auto",
          padding: "8rem 1.5rem 7rem",
          textAlign: "center",
        }}
      >
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.p
            variants={fadeUp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              fontFamily: C.bodyFont,
              fontWeight: 400,
              fontSize: "0.7rem",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: C.primary,
              marginBottom: "1.75rem",
            }}
          >
            <Sparkles size={14} />
            {eyebrow}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            style={{
              fontFamily: C.displayFont,
              fontWeight: 400,
              fontSize: "clamp(2.6rem, 6vw, 4.6rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: C.heading,
              marginBottom: "1.25rem",
            }}
          >
            {p.seriesTitle}
          </motion.h1>

          {p.seriesSubtitle && (
            <motion.p
              variants={fadeUp}
              style={{
                fontFamily: C.bodyFont,
                fontWeight: 300,
                fontSize: "1.15rem",
                color: C.muted,
                lineHeight: 1.7,
                maxWidth: "40rem",
                margin: "0 auto 2.75rem",
              }}
            >
              {p.seriesSubtitle}
            </motion.p>
          )}

          {!p.heroBackgroundImageUrl && (
          <motion.div
            variants={fadeUp}
            style={{
              padding: "1.75rem",
              backgroundColor: rgba(C.card, 0.85),
              backdropFilter: "blur(12px)",
              border: `1px solid ${C.border}`,
              borderRadius: "1rem",
              maxWidth: "36rem",
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem", color: C.primary }}>
              <Icon size={16} />
              <span style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.24em", textTransform: "uppercase" }}>Featured</span>
            </div>
            <h2 style={{ fontFamily: C.displayFont, fontWeight: 500, fontSize: "clamp(1.4rem, 2.4vw, 1.8rem)", lineHeight: 1.25, color: C.heading, marginBottom: "0.75rem" }}>
              {p.heroEpisodeTitle}
            </h2>
            {(p.heroGuestName || p.heroGuestTitle) && (
              <p style={{ fontFamily: C.bodyFont, fontSize: "0.82rem", color: C.fg, marginBottom: "0.85rem", letterSpacing: "0.02em" }}>
                {p.heroGuestName && <span style={{ fontWeight: 500 }}>{p.heroGuestName}</span>}
                {p.heroGuestName && p.heroGuestTitle && <span style={{ color: C.muted }}> · </span>}
                {p.heroGuestTitle && <span style={{ color: C.muted }}>{p.heroGuestTitle}</span>}
              </p>
            )}
            {p.heroEpisodeDescription && (
              <p style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "0.92rem", color: C.muted, lineHeight: 1.65, marginBottom: "1.5rem", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.heroEpisodeDescription}
              </p>
            )}
            <motion.a
              href={ctaUrl}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.85rem 1.5rem",
                backgroundColor: C.primary,
                color: C.bg,
                fontFamily: C.bodyFont,
                fontWeight: 500,
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textDecoration: "none",
                borderRadius: "999px",
              }}
            >
              <Play size={14} />
              {ctaText}
            </motion.a>
          </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function HeroHalfBleed({ p, C }: { p: ContentSeriesBlockProps; C: ResolvedTheme }) {
  const Icon = seriesIcon(p.seriesType);
  const ctaText = p.heroCtaText ?? defaultCtaForType(p.seriesType);
  const ctaUrl = p.heroCtaUrl ?? "#episodes";
  const eyebrow = p.heroEyebrow ?? "Latest Episode";

  return (
    <section
      id="top"
      className="bcs-section"
      style={{
        position: "relative",
        padding: "6rem 1.5rem 7rem",
        overflow: "hidden",
        borderBottom: `1px solid ${C.borderDim}`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 20% 0%, ${rgba(C.primary, 0.12)} 0%, transparent 55%), radial-gradient(circle at 90% 80%, ${rgba(C.primary, 0.06)} 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: "78rem",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: p.heroImageUrl ? "minmax(0, 1.2fr) minmax(0, 0.8fr)" : "minmax(0, 1fr)",
          gap: "4rem",
          alignItems: "center",
        }}
        className="bcs-hero-grid"
      >
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.p
            variants={fadeUp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              fontFamily: C.bodyFont,
              fontWeight: 400,
              fontSize: "0.7rem",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: C.primary,
              marginBottom: "1.75rem",
            }}
          >
            <Sparkles size={14} />
            {eyebrow}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            style={{
              fontFamily: C.displayFont,
              fontWeight: 400,
              fontSize: "clamp(2.6rem, 6vw, 4.6rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: C.heading,
              marginBottom: "1.25rem",
            }}
          >
            {p.seriesTitle}
          </motion.h1>

          {p.seriesSubtitle && (
            <motion.p
              variants={fadeUp}
              style={{
                fontFamily: C.bodyFont,
                fontWeight: 300,
                fontSize: "1.05rem",
                color: C.muted,
                lineHeight: 1.7,
                maxWidth: "32rem",
                marginBottom: "2.75rem",
              }}
            >
              {p.seriesSubtitle}
            </motion.p>
          )}

          <motion.div
            variants={fadeUp}
            style={{
              padding: "1.75rem",
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: "1rem",
              maxWidth: "34rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem", color: C.primary }}>
              <Icon size={16} />
              <span style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.24em", textTransform: "uppercase" }}>Featured</span>
            </div>
            <h2 style={{ fontFamily: C.displayFont, fontWeight: 500, fontSize: "clamp(1.4rem, 2.4vw, 1.8rem)", lineHeight: 1.25, color: C.heading, marginBottom: "0.75rem" }}>
              {p.heroEpisodeTitle}
            </h2>
            {(p.heroGuestName || p.heroGuestTitle) && (
              <p style={{ fontFamily: C.bodyFont, fontSize: "0.82rem", color: C.fg, marginBottom: "0.85rem", letterSpacing: "0.02em" }}>
                {p.heroGuestName && <span style={{ fontWeight: 500 }}>{p.heroGuestName}</span>}
                {p.heroGuestName && p.heroGuestTitle && <span style={{ color: C.muted }}> · </span>}
                {p.heroGuestTitle && <span style={{ color: C.muted }}>{p.heroGuestTitle}</span>}
              </p>
            )}
            {p.heroEpisodeDescription && (
              <p style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "0.92rem", color: C.muted, lineHeight: 1.65, marginBottom: "1.5rem", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.heroEpisodeDescription}
              </p>
            )}
            <motion.a
              href={ctaUrl}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.85rem 1.5rem",
                backgroundColor: C.primary,
                color: C.bg,
                fontFamily: C.bodyFont,
                fontWeight: 500,
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textDecoration: "none",
                borderRadius: "999px",
              }}
            >
              <Play size={14} />
              {ctaText}
            </motion.a>
          </motion.div>
        </motion.div>

        {p.heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{
              position: "relative",
              borderRadius: "1.25rem",
              overflow: "hidden",
              border: `1px solid ${C.border}`,
              backgroundColor: C.card,
              maxWidth: "28rem",
              marginLeft: "auto",
            }}
          >
            <img
              src={p.heroImageUrl}
              alt={p.heroEpisodeTitle}
              style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, transparent 60%, ${rgba(C.bg, 0.45)} 100%)`,
                pointerEvents: "none",
              }}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function HeroTextOnly({ p, C }: { p: ContentSeriesBlockProps; C: ResolvedTheme }) {
  const Icon = seriesIcon(p.seriesType);
  const ctaText = p.heroCtaText ?? defaultCtaForType(p.seriesType);
  const ctaUrl = p.heroCtaUrl ?? "#episodes";
  const eyebrow = p.heroEyebrow ?? "Latest Episode";

  return (
    <section
      id="top"
      className="bcs-section"
      style={{
        position: "relative",
        padding: "8rem 1.5rem 7rem",
        overflow: "hidden",
        borderBottom: `1px solid ${C.borderDim}`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 0%, ${rgba(C.primary, 0.1)} 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: "52rem", margin: "0 auto", textAlign: "center" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.p
            variants={fadeUp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              fontFamily: C.bodyFont,
              fontWeight: 400,
              fontSize: "0.7rem",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: C.primary,
              marginBottom: "1.75rem",
            }}
          >
            <Sparkles size={14} />
            {eyebrow}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            style={{
              fontFamily: C.displayFont,
              fontWeight: 400,
              fontSize: "clamp(2.6rem, 6vw, 4.6rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: C.heading,
              marginBottom: "1.25rem",
            }}
          >
            {p.seriesTitle}
          </motion.h1>

          {p.seriesSubtitle && (
            <motion.p
              variants={fadeUp}
              style={{
                fontFamily: C.bodyFont,
                fontWeight: 300,
                fontSize: "1.15rem",
                color: C.muted,
                lineHeight: 1.7,
                maxWidth: "40rem",
                margin: "0 auto 2.75rem",
              }}
            >
              {p.seriesSubtitle}
            </motion.p>
          )}

          <motion.div
            variants={fadeUp}
            style={{
              padding: "2rem",
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: "1rem",
              maxWidth: "36rem",
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem", color: C.primary }}>
              <Icon size={16} />
              <span style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.24em", textTransform: "uppercase" }}>Featured</span>
            </div>
            <h2 style={{ fontFamily: C.displayFont, fontWeight: 500, fontSize: "clamp(1.4rem, 2.4vw, 1.8rem)", lineHeight: 1.25, color: C.heading, marginBottom: "0.75rem" }}>
              {p.heroEpisodeTitle}
            </h2>
            {(p.heroGuestName || p.heroGuestTitle) && (
              <p style={{ fontFamily: C.bodyFont, fontSize: "0.82rem", color: C.fg, marginBottom: "0.85rem", letterSpacing: "0.02em" }}>
                {p.heroGuestName && <span style={{ fontWeight: 500 }}>{p.heroGuestName}</span>}
                {p.heroGuestName && p.heroGuestTitle && <span style={{ color: C.muted }}> · </span>}
                {p.heroGuestTitle && <span style={{ color: C.muted }}>{p.heroGuestTitle}</span>}
              </p>
            )}
            {p.heroEpisodeDescription && (
              <p style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "0.92rem", color: C.muted, lineHeight: 1.65, marginBottom: "1.5rem", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.heroEpisodeDescription}
              </p>
            )}
            <motion.a
              href={ctaUrl}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.85rem 1.5rem",
                backgroundColor: C.primary,
                color: C.bg,
                fontFamily: C.bodyFont,
                fontWeight: 500,
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textDecoration: "none",
                borderRadius: "999px",
              }}
            >
              <Play size={14} />
              {ctaText}
            </motion.a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Hero({ p, C }: { p: ContentSeriesBlockProps; C: ResolvedTheme }) {
  const layout = p.heroLayout ?? "half-bleed";
  if (layout === "full-bleed") return <HeroFullBleed p={p} C={C} />;
  if (layout === "text-only") return <HeroTextOnly p={p} C={C} />;
  return <HeroHalfBleed p={p} C={C} />;
}

const STATUS_CONFIG: Record<EpisodeStatus, { label: string; color: string; dotColor: string }> = {
  upcoming: { label: "Upcoming", color: "#6d9eeb", dotColor: "#6d9eeb" },
  live: { label: "Live", color: "#e06060", dotColor: "#e06060" },
  "on-demand": { label: "On Demand", color: "#7cc47c", dotColor: "#7cc47c" },
};

function StatusBadge({ status, C }: { status: EpisodeStatus; C: ResolvedTheme }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["on-demand"];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      padding: "0.25rem 0.6rem",
      backgroundColor: rgba(cfg.color, 0.15),
      border: `1px solid ${rgba(cfg.color, 0.3)}`,
      borderRadius: "999px",
      fontFamily: C.bodyFont, fontWeight: 600, fontSize: "0.55rem",
      letterSpacing: "0.16em", textTransform: "uppercase", color: cfg.color,
    }}>
      <Circle size={6} fill={cfg.dotColor} stroke="none" />
      {cfg.label}
    </div>
  );
}

function ApplePodcastsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 3.17 1.481 5.994 3.785 7.82-.07-.54-.156-1.372-.156-2.77 0-1.396.636-2.478 1.28-3.36-.236-.614-.37-1.28-.37-1.98C6.54 8.7 8.958 6.28 12 6.28s5.46 2.42 5.46 5.43c0 .7-.134 1.366-.37 1.98.644.882 1.28 1.964 1.28 3.36 0 1.398-.086 2.23-.156 2.77A9.963 9.963 0 0022 12c0-5.523-4.477-10-10-10zm0 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 6.5c-.96 0-1.6.56-1.92 1.24-.32.68-.58 2.06-.58 3.26 0 .56.06 1.08.18 1.5h4.64c.12-.42.18-.94.18-1.5 0-1.2-.26-2.58-.58-3.26-.32-.68-.96-1.24-1.92-1.24z"/>
    </svg>
  );
}

function SpotifyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.81-.87 7.076-.495 9.712 1.115a.622.622 0 01.207.857zm1.224-2.719a.78.78 0 01-1.072.257c-2.687-1.652-6.786-2.131-9.965-1.166a.78.78 0 01-.453-1.494c3.628-1.102 8.143-.568 11.233 1.331a.78.78 0 01.257 1.072zm.105-2.835C14.693 8.952 9.375 8.775 6.297 9.71a.935.935 0 11-.543-1.79c3.533-1.073 9.404-.866 13.115 1.338a.935.935 0 01-1.054 1.612z"/>
    </svg>
  );
}

function YouTubeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function PlatformLinks({ episode, C }: { episode: ContentSeriesEpisode; C: ResolvedTheme }) {
  const links = [
    { url: episode.applePodcastsUrl, icon: <ApplePodcastsIcon size={13} />, label: "Apple" },
    { url: episode.spotifyUrl, icon: <SpotifyIcon size={13} />, label: "Spotify" },
    { url: episode.youtubeUrl, icon: <YouTubeIcon size={13} />, label: "YouTube" },
  ].filter(l => l.url);

  if (!links.length) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
      {links.map(l => (
        <a
          key={l.label}
          href={l.url!}
          target="_blank"
          rel="noopener noreferrer"
          title={l.label}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "1.75rem", height: "1.75rem", borderRadius: "999px",
            backgroundColor: rgba(C.primary, 0.12), color: C.fg,
            transition: "background-color 0.2s, color 0.2s",
            textDecoration: "none",
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.primary; e.currentTarget.style.color = C.bg; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = rgba(C.primary, 0.12); e.currentTarget.style.color = C.fg; }}
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}

function EpisodeCard({
  episode,
  C,
  defaultCta,
  isFeatured,
  onPlayVideo,
}: {
  episode: ContentSeriesEpisode;
  C: ResolvedTheme;
  defaultCta: string;
  isFeatured: boolean;
  onPlayVideo?: (videoId: string, episode: ContentSeriesEpisode) => void;
}) {
  const ctaText = episode.ctaText ?? defaultCta;
  const date = formatDate(episode.publishDate);
  const status = episode.status ?? "on-demand";
  const ytId = extractYouTubeId(episode.youtubeUrl);
  const hasVideo = !!ytId;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (hasVideo && onPlayVideo) {
      e.preventDefault();
      onPlayVideo(ytId!, episode);
    }
  }, [hasVideo, onPlayVideo, ytId, episode]);

  return (
    <motion.a
      href={hasVideo ? "#" : episode.ctaUrl}
      onClick={handleClick}
      variants={fadeUp}
      whileHover={{ y: -6, scale: 1.005 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "1rem",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = C.primaryFaint;
        e.currentTarget.style.boxShadow = `0 18px 48px -24px ${rgba(C.primary, 0.4)}`;
        showPlayOverlay(e.currentTarget);
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "none";
        hidePlayOverlay(e.currentTarget);
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          background: episode.thumbnailUrl
            ? undefined
            : `linear-gradient(135deg, ${rgba(C.primary, 0.35)} 0%, ${rgba(C.primary, 0.05)} 60%, ${C.card} 100%)`,
          overflow: "hidden",
          width: "100%",
        }}
      >
        {episode.thumbnailUrl ? (
          <img src={episode.thumbnailUrl} alt={episode.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: rgba(C.fg, 0.4) }}>
            <Headphones size={42} strokeWidth={1.2} />
          </div>
        )}
        {hasVideo && <PlayOverlay C={C} />}
        <div style={{ position: "absolute", top: "0.85rem", left: "0.85rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", zIndex: 3 }}>
          {isFeatured && (
            <div style={{ padding: "0.3rem 0.7rem", backgroundColor: C.primary, color: C.bg, fontFamily: C.bodyFont, fontWeight: 600, fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", borderRadius: "999px" }}>
              Featured
            </div>
          )}
          {status !== "on-demand" && <StatusBadge status={status} C={C} />}
        </div>
      </div>

      <div style={{ padding: "1.5rem 1.5rem 1.65rem", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          {date && (
            <p style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", color: C.primary, margin: 0 }}>
              {date}
            </p>
          )}
          {status === "on-demand" && <StatusBadge status={status} C={C} />}
        </div>
        <h3 style={{ fontFamily: C.displayFont, fontWeight: 500, fontSize: "1.3rem", lineHeight: 1.25, color: C.heading, marginBottom: "0.65rem", overflowWrap: "anywhere", wordBreak: "break-word", hyphens: "auto" }}>
          {episode.title}
        </h3>
        {(episode.guestName || episode.guestTitle || episode.guestCompany) && (
          <p style={{ fontFamily: C.bodyFont, fontSize: "0.78rem", color: C.fg, marginBottom: "0.7rem" }}>
            {episode.guestName && <span style={{ fontWeight: 500 }}>{episode.guestName}</span>}
            {(episode.guestTitle || episode.guestCompany) && (
              <span style={{ color: C.muted }}>
                {episode.guestName ? " · " : ""}
                {[episode.guestTitle, episode.guestCompany].filter(Boolean).join(", ")}
              </span>
            )}
          </p>
        )}
        {episode.description && (
          <p style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "0.88rem", color: C.muted, lineHeight: 1.6, marginBottom: "1.4rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {episode.description}
          </p>
        )}
        <PlatformLinks episode={episode} C={C} />
        <div style={{ marginTop: "auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontFamily: C.bodyFont, fontWeight: 500, fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: C.primary }}>
            {hasVideo ? "Watch Now" : ctaText}
            {hasVideo ? <Play size={14} fill="currentColor" /> : <ArrowRight size={14} />}
          </span>
        </div>
      </div>
    </motion.a>
  );
}

function CarouselArrow({ direction, onClick, C, disabled }: { direction: "left" | "right"; onClick: () => void; C: ResolvedTheme; disabled?: boolean }) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      style={{
        width: "2.75rem",
        height: "2.75rem",
        borderRadius: "999px",
        border: `1px solid ${disabled ? C.borderDim : C.border}`,
        backgroundColor: disabled ? "transparent" : C.card,
        color: disabled ? C.borderDim : C.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        transition: "border-color 0.2s, color 0.2s, background-color 0.2s",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.fg; } }}
    >
      <Icon size={20} strokeWidth={1.5} />
    </motion.button>
  );
}

function EpisodeRow({ episode, C, defaultCta, onPlayVideo }: { episode: ContentSeriesEpisode; C: ResolvedTheme; defaultCta: string; onPlayVideo?: (videoId: string, episode: ContentSeriesEpisode) => void }) {
  const date = formatDate(episode.publishDate);
  const ctaText = episode.ctaText ?? defaultCta;
  const status = episode.status ?? "on-demand";
  const ytId = extractYouTubeId(episode.youtubeUrl);
  const hasVideo = !!ytId;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (hasVideo && onPlayVideo) {
      e.preventDefault();
      onPlayVideo(ytId!, episode);
    }
  }, [hasVideo, onPlayVideo, ytId, episode]);

  return (
    <motion.a
      className="bcs-episode-row"
      href={hasVideo ? "#" : episode.ctaUrl}
      onClick={handleClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.25rem",
        padding: "1rem 1.25rem",
        backgroundColor: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "0.75rem",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = C.primaryFaint;
        e.currentTarget.style.boxShadow = `0 8px 24px -12px ${rgba(C.primary, 0.3)}`;
        showPlayOverlay(e.currentTarget);
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "none";
        hidePlayOverlay(e.currentTarget);
      }}
    >
      <div style={{
        position: "relative",
        width: "4.5rem", height: "4.5rem", borderRadius: "0.5rem", overflow: "hidden", flexShrink: 0,
        background: episode.thumbnailUrl ? undefined : `linear-gradient(135deg, ${rgba(C.primary, 0.3)} 0%, ${C.card} 100%)`,
      }}>
        {episode.thumbnailUrl ? (
          <img src={episode.thumbnailUrl} alt={episode.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: rgba(C.fg, 0.35) }}>
            <Headphones size={22} strokeWidth={1.2} />
          </div>
        )}
        {hasVideo && <PlayOverlay C={C} size="sm" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
          {date && (
            <span style={{ fontFamily: C.bodyFont, fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>
              {date}
            </span>
          )}
          <StatusBadge status={status} C={C} />
          {episode.isFeatured && (
            <span style={{ padding: "0.15rem 0.5rem", backgroundColor: C.primary, color: C.bg, fontFamily: C.bodyFont, fontWeight: 600, fontSize: "0.5rem", letterSpacing: "0.16em", textTransform: "uppercase", borderRadius: "999px" }}>
              Featured
            </span>
          )}
        </div>
        <h4 style={{ fontFamily: C.displayFont, fontWeight: 500, fontSize: "1.05rem", lineHeight: 1.3, color: C.heading, marginBottom: "0.2rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {episode.title}
        </h4>
        {(episode.guestName || episode.guestCompany) && (
          <p style={{ fontFamily: C.bodyFont, fontSize: "0.75rem", color: C.muted, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {episode.guestName}{episode.guestName && episode.guestCompany ? " · " : ""}{episode.guestCompany}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        <PlatformLinks episode={episode} C={C} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontFamily: C.bodyFont, fontWeight: 500, fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase", color: C.primary, whiteSpace: "nowrap" }}>
          {hasVideo ? "Watch" : ctaText}
          {hasVideo ? <Play size={13} fill="currentColor" /> : <ArrowRight size={13} />}
        </span>
      </div>
    </motion.a>
  );
}

const CAROUSEL_PAGE_SIZE = 3;
const LIST_PAGE_SIZE = 10;

function EpisodeLibrary({ p, C }: { p: ContentSeriesBlockProps; C: ResolvedTheme }) {
  const defaultCta = defaultCtaForType(p.seriesType);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [showFullList, setShowFullList] = useState(false);
  const [listPage, setListPage] = useState(0);
  const [playing, setPlaying] = useState<{ videoId: string; episode: ContentSeriesEpisode } | null>(null);
  const closeVideo = useCallback(() => setPlaying(null), []);
  const playEpisode = useCallback((videoId: string, episode: ContentSeriesEpisode) => {
    setPlaying({ videoId, episode });
  }, []);

  // Live RSS sync: when enabled, fetch the feed and merge new items into the
  // displayed list. Manual edits (existing episodes) are never overwritten.
  const [rssEpisodes, setRssEpisodes] = useState<ContentSeriesEpisode[]>([]);
  useEffect(() => {
    if (!p.rssAutoSync || !p.rssFeedUrl) {
      setRssEpisodes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/lp/rss/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: p.rssFeedUrl }),
        });
        if (!resp.ok) return;
        const feed = await resp.json() as { episodes?: Array<{
          guid?: string; title: string; description: string; publishDate?: string;
          audioUrl?: string; thumbnailUrl?: string;
        }> };
        if (cancelled || !feed.episodes) return;
        const manual = p.episodes ?? [];
        const manualKeys = new Set<string>();
        for (const ep of manual) {
          if (ep.rssGuid) manualKeys.add(`g:${ep.rssGuid}`);
          if (ep.ctaUrl) manualKeys.add(`u:${ep.ctaUrl}`);
        }
        const newOnes: ContentSeriesEpisode[] = [];
        for (const item of feed.episodes) {
          const guidKey = item.guid ? `g:${item.guid}` : null;
          const urlKey = item.audioUrl ? `u:${item.audioUrl}` : null;
          if ((guidKey && manualKeys.has(guidKey)) || (urlKey && manualKeys.has(urlKey))) continue;
          newOnes.push({
            title: item.title,
            description: item.description,
            publishDate: item.publishDate ?? new Date().toISOString(),
            thumbnailUrl: item.thumbnailUrl,
            ctaUrl: item.audioUrl ?? p.rssFeedUrl ?? "#",
            ctaText: "Listen Now",
            rssGuid: item.guid,
            status: "on-demand",
          });
        }
        setRssEpisodes(newOnes);
      } catch {
        // silent — fall back to manual episodes only
      }
    })();
    return () => { cancelled = true; };
  }, [p.rssAutoSync, p.rssFeedUrl, p.episodes]);

  const episodes = useMemo(() => {
    const merged: ContentSeriesEpisode[] = [...(p.episodes ?? []), ...rssEpisodes];
    const list = merged.filter(ep => !ep.hidden);
    list.sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured));
    return list;
  }, [p.episodes, rssEpisodes]);

  if (!episodes.length) return null;

  const totalCarouselPages = Math.ceil(episodes.length / CAROUSEL_PAGE_SIZE);
  const carouselEpisodes = episodes.slice(carouselIdx * CAROUSEL_PAGE_SIZE, (carouselIdx + 1) * CAROUSEL_PAGE_SIZE);
  const canPrev = carouselIdx > 0;
  const canNext = carouselIdx < totalCarouselPages - 1;

  const totalListPages = Math.ceil(episodes.length / LIST_PAGE_SIZE);
  const listEpisodes = episodes.slice(listPage * LIST_PAGE_SIZE, (listPage + 1) * LIST_PAGE_SIZE);

  return (
    <section
      id="episodes"
      className="bcs-section"
      style={{ padding: "7rem 1.5rem", backgroundColor: C.bg, borderBottom: `1px solid ${C.borderDim}` }}
    >
      <div style={{ maxWidth: "78rem", margin: "0 auto" }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          style={{ marginBottom: "3.5rem" }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.36em", textTransform: "uppercase", color: C.primary, marginBottom: "1rem" }}>
                The Library
              </motion.p>
              <motion.h2 variants={fadeUp} style={{ fontFamily: C.displayFont, fontWeight: 400, fontSize: "clamp(2rem, 4vw, 3rem)", color: C.heading, letterSpacing: "-0.01em" }}>
                All Episodes
              </motion.h2>
            </div>
          </div>
        </motion.div>

        {!showFullList && (
          <>
            <div
              className="bcs-episode-grid"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(carouselEpisodes.length, CAROUSEL_PAGE_SIZE)}, minmax(0, 1fr))`,
                gap: "1.75rem",
              }}
            >
              <AnimatePresence mode="wait">
                {carouselEpisodes.map((ep, idx) => (
                  <motion.div
                    key={`${carouselIdx}-${idx}`}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.35, delay: idx * 0.08 }}
                  >
                    <EpisodeCard episode={ep} C={C} defaultCta={defaultCta} isFeatured={!!ep.isFeatured} onPlayVideo={playEpisode} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {episodes.length > CAROUSEL_PAGE_SIZE && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.75rem", marginTop: "2.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                  <CarouselArrow direction="left" onClick={() => setCarouselIdx(i => Math.max(0, i - 1))} C={C} disabled={!canPrev} />
                  <span style={{ fontFamily: C.bodyFont, fontSize: "0.75rem", color: C.muted, letterSpacing: "0.12em", minWidth: "3rem", textAlign: "center" }}>
                    {carouselIdx + 1} / {totalCarouselPages}
                  </span>
                  <CarouselArrow direction="right" onClick={() => setCarouselIdx(i => Math.min(totalCarouselPages - 1, i + 1))} C={C} disabled={!canNext} />
                </div>
                <motion.button
                  type="button"
                  onClick={() => { setShowFullList(true); setListPage(0); }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: "0.85rem 2rem",
                    backgroundColor: "transparent",
                    color: C.fg,
                    fontFamily: C.bodyFont,
                    fontWeight: 500,
                    fontSize: "0.7rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    border: `1px solid ${C.border}`,
                    borderRadius: "999px",
                    cursor: "pointer",
                    transition: "border-color 0.25s, color 0.25s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.fg; }}
                >
                  See Full List
                </motion.button>
              </div>
            )}
          </>
        )}

        {showFullList && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {listEpisodes.map((ep, idx) => (
                <EpisodeRow key={`list-${listPage}-${idx}`} episode={ep} C={C} defaultCta={defaultCta} onPlayVideo={playEpisode} />
              ))}
            </div>

            {totalListPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "2.5rem" }}>
                <CarouselArrow direction="left" onClick={() => setListPage(pg => pg - 1)} C={C} disabled={listPage === 0} />
                {Array.from({ length: totalListPages }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setListPage(i)}
                    style={{
                      width: "2rem",
                      height: "2rem",
                      borderRadius: "999px",
                      border: `1px solid ${i === listPage ? C.primary : C.border}`,
                      backgroundColor: i === listPage ? C.primary : "transparent",
                      color: i === listPage ? C.bg : C.muted,
                      fontFamily: C.bodyFont,
                      fontWeight: 500,
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <CarouselArrow direction="right" onClick={() => setListPage(pg => pg + 1)} C={C} disabled={listPage === totalListPages - 1} />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
              <motion.button
                type="button"
                onClick={() => setShowFullList(false)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.75rem",
                  backgroundColor: "transparent",
                  color: C.muted,
                  fontFamily: C.bodyFont,
                  fontWeight: 500,
                  fontSize: "0.65rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  border: `1px solid ${C.borderDim}`,
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "border-color 0.25s, color 0.25s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDim; e.currentTarget.style.color = C.muted; }}
              >
                <X size={13} />
                Back to Carousel
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
      {playing && (() => {
        const idx = episodes.indexOf(playing.episode);
        const nextEp = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;
        const nextVideoId = nextEp ? extractYouTubeId(nextEp.youtubeUrl) : null;
        const nextEpisode = nextEp ? { episode: nextEp, videoId: nextVideoId ?? undefined } : null;
        const handlePlayNext = nextEp
          ? () => {
              if (nextVideoId) {
                setPlaying({ videoId: nextVideoId, episode: nextEp });
              } else {
                window.open(nextEp.ctaUrl, "_blank", "noopener");
                closeVideo();
              }
            }
          : undefined;
        return (
          <VideoModal
            videoId={playing.videoId}
            onClose={closeVideo}
            C={C}
            nextEpisode={nextEpisode}
            onPlayNext={handlePlayNext}
          />
        );
      })()}
    </section>
  );
}

function HostCard({ host, C }: { host: ContentSeriesHost; C: ResolvedTheme }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: "1rem", padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {host.photoUrl ? (
          <img src={host.photoUrl} alt={host.name} style={{ width: "3.75rem", height: "3.75rem", borderRadius: "999px", objectFit: "cover", border: `1px solid ${C.borderDim}` }} />
        ) : (
          <div style={{ width: "3.75rem", height: "3.75rem", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: rgba(C.primary, 0.12), color: C.primary, fontFamily: C.displayFont, fontWeight: 500, fontSize: "1.15rem", border: `1px solid ${C.borderDim}` }}>
            {initials(host.name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ fontFamily: C.displayFont, fontWeight: 500, fontSize: "1.15rem", color: C.heading, marginBottom: "0.2rem" }}>
            {host.name}
          </h4>
          <p style={{ fontFamily: C.bodyFont, fontSize: "0.8rem", color: C.muted, lineHeight: 1.4 }}>
            {host.title}
            {host.company && <span style={{ color: C.mutedDim }}> · {host.company}</span>}
          </p>
        </div>
      </div>
      {host.bio && (
        <p style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "0.88rem", color: C.muted, lineHeight: 1.65 }}>
          {host.bio}
        </p>
      )}
      {host.linkedinUrl && (
        <div>
          <motion.a
            href={host.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.08 }}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2.25rem", height: "2.25rem", borderRadius: "999px", border: `1px solid ${C.border}`, color: C.muted, textDecoration: "none", transition: "color 0.2s, border-color 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.borderColor = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
          >
            <Linkedin size={16} />
          </motion.a>
        </div>
      )}
    </motion.div>
  );
}

function SingleHostSpotlight({ host, C }: { host: ContentSeriesHost; C: ResolvedTheme }) {
  return (
    <section id="guests" className="bcs-section" style={{ padding: "7rem 1.5rem", backgroundColor: C.bg, borderBottom: `1px solid ${C.borderDim}` }}>
      <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
          <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.36em", textTransform: "uppercase", color: C.primary, marginBottom: "1.25rem", textAlign: "center" }}>
            Your Host
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
            {host.photoUrl ? (
              <img src={host.photoUrl} alt={host.name} style={{ width: "10rem", height: "10rem", borderRadius: "999px", objectFit: "cover", border: `3px solid ${C.borderDim}`, boxShadow: `0 8px 30px ${rgba(C.primary, 0.1)}` }} />
            ) : (
              <div style={{ width: "10rem", height: "10rem", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: rgba(C.primary, 0.1), color: C.primary, fontFamily: C.displayFont, fontWeight: 500, fontSize: "2.5rem", border: `3px solid ${C.borderDim}` }}>
                {initials(host.name)}
              </div>
            )}
            <div style={{ textAlign: "center", maxWidth: "36rem" }}>
              <h3 style={{ fontFamily: C.displayFont, fontWeight: 400, fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", color: C.heading, letterSpacing: "-0.01em", marginBottom: "0.4rem" }}>
                {host.name}
              </h3>
              <p style={{ fontFamily: C.bodyFont, fontSize: "0.9rem", color: C.muted, marginBottom: host.bio ? "1.5rem" : "0.5rem" }}>
                {host.title}{host.company && <span style={{ color: C.mutedDim }}> · {host.company}</span>}
              </p>
              {host.bio && (
                <p style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "1rem", lineHeight: 1.75, color: C.muted }}>
                  {host.bio}
                </p>
              )}
              {(host.linkedinUrl || host.websiteUrl) && (
                <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
                  {host.linkedinUrl && (
                    <motion.a href={host.linkedinUrl} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.08 }}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2.5rem", height: "2.5rem", borderRadius: "999px", border: `1px solid ${C.border}`, color: C.muted, textDecoration: "none", transition: "color 0.2s, border-color 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.borderColor = C.primary; }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                    >
                      <Linkedin size={18} />
                    </motion.a>
                  )}
                  {host.websiteUrl && (
                    <motion.a href={host.websiteUrl} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.08 }}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2.5rem", height: "2.5rem", borderRadius: "999px", border: `1px solid ${C.border}`, color: C.muted, textDecoration: "none", transition: "color 0.2s, border-color 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.borderColor = C.primary; }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                    >
                      <Globe size={18} />
                    </motion.a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function HostsSection({ p, C }: { p: ContentSeriesBlockProps; C: ResolvedTheme }) {
  const hosts = p.hosts ?? [];
  if (!hosts.length) return null;

  if (hosts.length === 1) {
    return <SingleHostSpotlight host={hosts[0]} C={C} />;
  }

  return (
    <section id="guests" className="bcs-section" style={{ padding: "7rem 1.5rem", backgroundColor: C.bg, borderBottom: `1px solid ${C.borderDim}` }}>
      <div style={{ maxWidth: "78rem", margin: "0 auto" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} style={{ marginBottom: "3.5rem", textAlign: "center" }}>
          <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.36em", textTransform: "uppercase", color: C.primary, marginBottom: "1rem" }}>
            Voices on the Show
          </motion.p>
          <motion.h2 variants={fadeUp} style={{ fontFamily: C.displayFont, fontWeight: 400, fontSize: "clamp(2rem, 4vw, 3rem)", color: C.heading, letterSpacing: "-0.01em" }}>
            Hosts &amp; Recurring Guests
          </motion.h2>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 18rem), 1fr))", gap: "1.5rem" }}>
          {hosts.map((h, idx) => (
            <HostCard key={`${h.name}-${idx}`} host={h} C={C} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function AboutSection({ p, C }: { p: ContentSeriesBlockProps; C: ResolvedTheme }) {
  const headline = p.aboutHeadline;
  const description = p.aboutDescription;
  const audience = p.aboutAudience;
  const topics = p.aboutTopics ?? [];

  if (!headline && !description && !audience && !topics.length) return null;

  return (
    <section id="about" className="bcs-section" style={{ padding: "7rem 1.5rem", backgroundColor: C.bg, borderBottom: `1px solid ${C.borderDim}` }}>
      <div style={{ maxWidth: "62rem", margin: "0 auto" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
          <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.36em", textTransform: "uppercase", color: C.primary, marginBottom: "1.25rem" }}>
            About the Series
          </motion.p>

          {headline && (
            <motion.h2 variants={fadeUp} style={{ fontFamily: C.displayFont, fontWeight: 400, fontSize: "clamp(2rem, 4.2vw, 3.2rem)", lineHeight: 1.15, color: C.heading, letterSpacing: "-0.01em", marginBottom: "1.75rem", maxWidth: "44rem" }}>
              {headline}
            </motion.h2>
          )}

          {description && (
            <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "1.05rem", lineHeight: 1.75, color: C.muted, maxWidth: "48rem", marginBottom: audience || topics.length ? "2.5rem" : 0 }}>
              {description}
            </motion.p>
          )}

          {audience && (
            <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: topics.length ? "2.5rem" : 0, paddingTop: "1.75rem", borderTop: `1px solid ${C.borderDim}` }}>
              <span style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: C.primary, whiteSpace: "nowrap" }}>
                Who it's for
              </span>
              <span style={{ fontFamily: C.bodyFont, fontSize: "0.95rem", color: C.fg, lineHeight: 1.55 }}>
                {audience}
              </span>
            </motion.div>
          )}

          {topics.length > 0 && (
            <motion.div variants={fadeUp}>
              <p style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: C.primary, marginBottom: "1rem" }}>
                Topics we cover
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                {topics.map((topic, idx) => (
                  <span key={`${topic}-${idx}`} style={{ padding: "0.5rem 1rem", backgroundColor: C.primaryGhost, border: `1px solid ${C.borderDim}`, borderRadius: "999px", fontFamily: C.bodyFont, fontSize: "0.78rem", color: C.fg, letterSpacing: "0.02em" }}>
                    {topic}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

interface FormModalConfig {
  eyebrow: string;
  headline: string;
  subtitle?: string;
  steps: FormStep[];
  submitUrl: string;
  successMessage: string;
  successTitle?: string;
  source: string;
}

function FormModal({
  config,
  p,
  C,
  onClose,
  initialFormData,
}: {
  config: FormModalConfig;
  p: ContentSeriesBlockProps;
  C: ResolvedTheme;
  onClose: () => void;
  initialFormData?: Record<string, string>;
}) {
  const steps = config.steps ?? [];

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>(() => initialFormData ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const isLastStep = currentStep >= steps.length - 1;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLastStep) {
      setCurrentStep(s => s + 1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(config.submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          source: config.source,
          seriesTitle: p.seriesTitle,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [isLastStep, formData, config.submitUrl, config.source, p.seriesTitle]);

  if (!steps.length) return null;

  const step = steps[currentStep];
  const eyebrow = config.eyebrow;
  const headline = config.headline;
  const subtitle = config.subtitle ?? "";
  const successMessage = config.successMessage;
  const successTitle = config.successTitle ?? "Thanks!";

  const renderField = (field: FormField) => {
    const val = formData[field.id] ?? "";
    const baseInputStyle: React.CSSProperties = {
      width: "100%",
      padding: "0.85rem 1rem",
      backgroundColor: rgba(C.bg, 0.6),
      border: `1px solid ${C.border}`,
      borderRadius: "0.5rem",
      color: C.fg,
      fontFamily: C.bodyFont,
      fontSize: "0.9rem",
      outline: "none",
      transition: "border-color 0.2s",
    };

    if (field.type === "textarea") {
      return (
        <textarea
          value={val}
          onChange={e => handleFieldChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
          style={{ ...baseInputStyle, resize: "vertical", minHeight: "6rem" }}
          onFocus={e => { e.currentTarget.style.borderColor = C.primary; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        />
      );
    }
    if (field.type === "select") {
      return (
        <select
          value={val}
          onChange={e => handleFieldChange(field.id, e.target.value)}
          required={field.required}
          style={{ ...baseInputStyle, cursor: "pointer" }}
          onFocus={e => { e.currentTarget.style.borderColor = C.primary; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          <option value="">{field.placeholder || "Select..."}</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (field.type === "hidden") return null;

    return (
      <input
        type={field.type === "phone" ? "tel" : field.type}
        value={val}
        onChange={e => handleFieldChange(field.id, e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        style={baseInputStyle}
        onFocus={e => { e.currentTarget.style.borderColor = C.primary; }}
        onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
      />
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backgroundColor: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "5vh 1.5rem",
          overflowY: "auto",
        }}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "38rem",
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "1rem",
            padding: "2.25rem",
            boxShadow: "0 30px 70px rgba(0,0,0,0.55)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "0.85rem",
              right: "0.85rem",
              width: "2rem",
              height: "2rem",
              borderRadius: "999px",
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.2s, border-color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = C.fg; e.currentTarget.style.borderColor = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
          >
            <X size={14} />
          </button>

          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <p style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.32em", textTransform: "uppercase", color: C.primary, marginBottom: "0.65rem" }}>
              {eyebrow}
            </p>
            <h2 style={{ fontFamily: C.displayFont, fontWeight: 400, fontSize: "clamp(1.5rem, 3vw, 2rem)", color: C.heading, letterSpacing: "-0.01em", marginBottom: subtitle ? "0.65rem" : 0, lineHeight: 1.2 }}>
              {headline}
            </h2>
            {subtitle && (
              <p style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "0.92rem", color: C.muted, lineHeight: 1.6 }}>
                {subtitle}
              </p>
            )}
          </div>

          {submitted ? (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <CheckCircle2 size={42} style={{ color: C.primary, marginBottom: "1rem" }} />
              <h3 style={{ fontFamily: C.displayFont, fontWeight: 500, fontSize: "1.4rem", color: C.heading, marginBottom: "0.6rem" }}>
                {successTitle}
              </h3>
              <p style={{ fontFamily: C.bodyFont, fontSize: "0.92rem", color: C.muted, lineHeight: 1.6 }}>
                {successMessage}
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  marginTop: "1.5rem",
                  padding: "0.7rem 1.5rem",
                  backgroundColor: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: "999px",
                  color: C.fg,
                  fontFamily: C.bodyFont,
                  fontWeight: 500,
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {steps.length > 1 && (
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
                  {steps.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: "3px",
                        borderRadius: "2px",
                        backgroundColor: i <= currentStep ? C.primary : C.border,
                        transition: "background-color 0.3s",
                      }}
                    />
                  ))}
                </div>
              )}

              {step && (
                <>
                  {steps.length > 1 && step.title && (
                    <p style={{ fontFamily: C.bodyFont, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, marginBottom: "1.5rem" }}>
                      {step.title}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {(step.fields ?? []).filter(f => f.type !== "hidden").map(field => (
                      <div key={field.id}>
                        <label style={{ display: "block", fontFamily: C.bodyFont, fontSize: "0.78rem", fontWeight: 500, color: C.fg, marginBottom: "0.4rem", letterSpacing: "0.02em" }}>
                          {field.label}
                          {field.required && <span style={{ color: C.primary, marginLeft: "0.25rem" }}>*</span>}
                        </label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <p style={{ fontFamily: C.bodyFont, fontSize: "0.85rem", color: "#ef4444", marginTop: "1rem" }}>
                  {error}
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", gap: "1rem" }}>
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(s => s - 1)}
                    style={{
                      padding: "0.85rem 1.5rem",
                      backgroundColor: "transparent",
                      border: `1px solid ${C.border}`,
                      borderRadius: "999px",
                      color: C.fg,
                      fontFamily: C.bodyFont,
                      fontWeight: 500,
                      fontSize: "0.7rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Back
                  </button>
                )}
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.55rem",
                    padding: "0.85rem 1.75rem",
                    backgroundColor: C.primary,
                    color: C.bg,
                    fontFamily: C.bodyFont,
                    fontWeight: 500,
                    fontSize: "0.7rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    border: "none",
                    borderRadius: "999px",
                    cursor: submitting ? "wait" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {isLastStep ? "Submit" : "Next"}
                </motion.button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function FormSection({ p, C, onOpenForm }: { p: ContentSeriesBlockProps; C: ResolvedTheme; onOpenForm: () => void }) {
  const steps = p.formSteps ?? [];
  if (!steps.length) return null;

  const eyebrow = p.formEyebrow ?? "Be a Guest";
  const headline = p.formHeadline ?? "Share Your Story";
  const subtitle = p.formSubheadline ?? "";
  const buttonLabel = p.formButtonLabel ?? "Apply to be a Guest";

  return (
    <>
      <section
        id="apply"
        className="bcs-section"
        style={{
          padding: "7rem 1.5rem",
          backgroundColor: C.bg,
          borderBottom: `1px solid ${C.borderDim}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 100%, ${rgba(C.primary, 0.08)} 0%, transparent 50%)`,
            pointerEvents: "none",
          }}
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          style={{ position: "relative", maxWidth: "40rem", margin: "0 auto", textAlign: "center" }}
        >
          <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.36em", textTransform: "uppercase", color: C.primary, marginBottom: "1rem" }}>
            {eyebrow}
          </motion.p>
          <motion.h2 variants={fadeUp} style={{ fontFamily: C.displayFont, fontWeight: 400, fontSize: "clamp(2rem, 4vw, 3rem)", color: C.heading, letterSpacing: "-0.01em", marginBottom: subtitle ? "1.25rem" : "2rem", lineHeight: 1.15 }}>
            {headline}
          </motion.h2>
          {subtitle && (
            <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "1.05rem", color: C.muted, lineHeight: 1.7, marginBottom: "2.25rem" }}>
              {subtitle}
            </motion.p>
          )}
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={onOpenForm}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "1rem 2rem",
              backgroundColor: C.primary,
              color: C.bg,
              border: "none",
              borderRadius: "999px",
              fontFamily: C.bodyFont,
              fontWeight: 500,
              fontSize: "0.72rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: `0 12px 30px ${rgba(C.primary, 0.28)}`,
            }}
          >
            {buttonLabel}
            <ArrowRight size={14} />
          </motion.button>
        </motion.div>
      </section>
    </>
  );
}

function SubscribeForm({ p, C, onOpenForm }: { p: ContentSeriesBlockProps; C: ResolvedTheme; onOpenForm: (initial: Record<string, string>) => void }) {
  const [email, setEmail] = useState("");

  const placeholder = p.subscribePlaceholder ?? "your@email.com";
  const buttonLabel = p.subscribeButtonLabel ?? "Subscribe";

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    onOpenForm({ email: trimmed });
  }, [email, onOpenForm]);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        width: "100%",
        maxWidth: "30rem",
        margin: "0 auto",
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: "12rem",
          padding: "0.95rem 1.25rem",
          backgroundColor: rgba(C.bg, 0.6),
          border: `1px solid ${C.border}`,
          borderRadius: "999px",
          color: C.fg,
          fontFamily: C.bodyFont,
          fontSize: "0.9rem",
          outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = C.primary; }}
        onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
      />
      <motion.button
        type="submit"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.95rem 1.65rem",
          backgroundColor: C.primary,
          color: C.bg,
          border: "none",
          borderRadius: "999px",
          fontFamily: C.bodyFont,
          fontWeight: 500,
          fontSize: "0.72rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        <Send size={14} />
        {buttonLabel}
      </motion.button>
    </form>
  );
}

function CtaSection({ p, C, onSubscribe }: { p: ContentSeriesBlockProps; C: ResolvedTheme; onSubscribe: (initial: Record<string, string>) => void }) {
  const headline = p.ctaSectionHeadline;
  const sub = p.ctaSectionSubheadline;
  const ctas: ContentSeriesCta[] = p.ctas ?? [];
  // Subscribe input lives in the CTA section so it has room to breathe.
  // The nav has a Subscribe button that anchors here.
  const showSubscribe = p.subscribeEnabled !== false;
  if (!headline && !sub && !ctas.length && !p.rssFeedUrl && !showSubscribe) return null;

  return (
    <section
      id="subscribe"
      className="bcs-section"
      style={{ padding: "8rem 1.5rem", position: "relative", backgroundColor: C.bg, overflow: "hidden" }}
    >
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 50%, ${rgba(C.primary, 0.18)} 0%, transparent 60%)`, pointerEvents: "none" }}
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        style={{ position: "relative", maxWidth: "48rem", margin: "0 auto", textAlign: "center" }}
      >
        {headline && (
          <motion.h2 variants={fadeUp} style={{ fontFamily: C.displayFont, fontWeight: 400, fontSize: "clamp(2.2rem, 5vw, 3.6rem)", lineHeight: 1.1, color: C.heading, letterSpacing: "-0.01em", marginBottom: sub ? "1.25rem" : "2.5rem" }}>
            {headline}
          </motion.h2>
        )}
        {sub && (
          <motion.p variants={fadeUp} style={{ fontFamily: C.bodyFont, fontWeight: 300, fontSize: "1.05rem", lineHeight: 1.7, color: C.muted, maxWidth: "36rem", margin: "0 auto 2.75rem" }}>
            {sub}
          </motion.p>
        )}
        {showSubscribe && (
          <motion.div variants={fadeUp} style={{ marginBottom: (ctas.length > 0 || p.rssFeedUrl) ? "4rem" : 0, display: "flex", justifyContent: "center" }}>
            <SubscribeForm p={p} C={C} onOpenForm={onSubscribe} />
          </motion.div>
        )}
        {(ctas.length > 0 || p.rssFeedUrl) && (
          <motion.div variants={fadeUp} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontFamily: C.bodyFont, fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: C.muted, opacity: 0.75 }}>
              Or listen on
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.85rem" }}>
            {ctas.map((cta, idx) => {
              const { icon, label } = platformIconFor(cta);
              return (
                <motion.a
                  key={`${cta.label}-${idx}`}
                  href={cta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={label}
                  title={label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "3rem",
                    height: "3rem",
                    backgroundColor: "transparent",
                    color: C.muted,
                    border: `1px solid ${C.border}`,
                    borderRadius: "999px",
                    textDecoration: "none",
                    transition: "background-color 0.25s, border-color 0.25s, color 0.25s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
                >
                  {icon}
                </motion.a>
              );
            })}
            {p.rssFeedUrl && (
              <motion.a
                href={p.rssFeedUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                aria-label="RSS"
                title="RSS"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "3rem",
                  height: "3rem",
                  border: `1px solid ${C.border}`,
                  borderRadius: "999px",
                  color: C.muted,
                  textDecoration: "none",
                  transition: "background-color 0.25s, border-color 0.25s, color 0.25s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
              >
                <Rss size={18} />
              </motion.a>
            )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}

interface Props {
  props: ContentSeriesBlockProps;
  brand?: BrandConfig;
  onFieldChange?: (updated: ContentSeriesBlockProps) => void;
}

function resolveHeroFromEpisodes(p: ContentSeriesBlockProps): ContentSeriesBlockProps {
  const mode = p.heroSourceMode ?? "auto";
  if (mode === "manual") return p;

  const pinned = (p.episodes ?? []).find(ep => ep.pinHero && !ep.hidden);
  if (pinned) {
    return {
      ...p,
      heroEpisodeTitle: pinned.title,
      heroEpisodeDescription: pinned.description,
      heroGuestName: pinned.guestName ?? p.heroGuestName,
      heroGuestTitle: [pinned.guestTitle, pinned.guestCompany].filter(Boolean).join(", ") || p.heroGuestTitle,
      heroImageUrl: pinned.thumbnailUrl ?? p.heroImageUrl,
      heroCtaUrl: pinned.ctaUrl ?? p.heroCtaUrl,
      heroCtaText: pinned.ctaText ?? p.heroCtaText,
    };
  }

  const visible = (p.episodes ?? []).filter(ep => !ep.hidden);
  if (!visible.length) return p;

  const newest = [...visible].sort((a, b) => {
    const da = new Date(a.publishDate).getTime() || 0;
    const db = new Date(b.publishDate).getTime() || 0;
    return db - da;
  })[0];

  return {
    ...p,
    heroEpisodeTitle: newest.title,
    heroEpisodeDescription: newest.description,
    heroGuestName: newest.guestName ?? p.heroGuestName,
    heroGuestTitle: [newest.guestTitle, newest.guestCompany].filter(Boolean).join(", ") || p.heroGuestTitle,
    heroImageUrl: newest.thumbnailUrl ?? p.heroImageUrl,
    heroCtaUrl: newest.ctaUrl ?? p.heroCtaUrl,
    heroCtaText: newest.ctaText ?? p.heroCtaText,
  };
}

export function BlockContentSeries({ props: p, brand, onFieldChange }: Props) {
  const C = useMemo(() => resolveTheme(p?.theme, brand), [p?.theme, brand]);
  const base = brandDefaults(brand);
  useGoogleFonts(
    p?.theme?.displayFontFamily ?? base.displayFontFamily,
    p?.theme?.bodyFontFamily ?? base.bodyFontFamily,
  );

  const safeProps = useMemo<ContentSeriesBlockProps>(() => {
    if (!p) return { seriesType: "podcast", seriesTitle: "Untitled Series", seriesSubtitle: "", heroEpisodeTitle: "", episodes: [] } as ContentSeriesBlockProps;
    return { ...p, episodes: p.episodes ?? [], hosts: p.hosts ?? [], ctas: p.ctas ?? [], formSteps: p.formSteps ?? [] };
  }, [p]);

  const effective = useMemo(() => resolveHeroFromEpisodes(safeProps), [safeProps]);

  const [formModalState, setFormModalState] = useState<{ open: boolean; kind: "guest" | "subscribe"; initial: Record<string, string> }>({ open: false, kind: "guest", initial: {} });
  const openGuestForm = useCallback((initial: Record<string, string> = {}) => {
    setFormModalState({ open: true, kind: "guest", initial });
  }, []);
  const openSubscribeForm = useCallback((initial: Record<string, string> = {}) => {
    setFormModalState({ open: true, kind: "subscribe", initial });
  }, []);
  const closeForm = useCallback(() => {
    setFormModalState(s => ({ ...s, open: false }));
  }, []);

  const subscribeFormSteps: FormStep[] = (effective.subscribeFormSteps && effective.subscribeFormSteps.length)
    ? effective.subscribeFormSteps
    : [{
        title: "Subscribe",
        fields: [
          { id: "email", type: "email", label: "Email", placeholder: "your@email.com", required: true },
        ],
      }];

  const modalConfig: FormModalConfig = formModalState.kind === "subscribe"
    ? {
        eyebrow: effective.subscribeFormEyebrow ?? "Stay in the Loop",
        headline: effective.subscribeFormHeadline ?? "Never Miss an Episode",
        subtitle: effective.subscribeFormSubheadline ?? "Get new episodes delivered to your inbox.",
        steps: subscribeFormSteps,
        submitUrl: effective.subscribeFormSubmitUrl || effective.subscribeSubmitUrl || effective.formSubmitUrl || "/api/lp/leads",
        successMessage: effective.subscribeSuccessMessage ?? "You're in. Watch your inbox.",
        successTitle: "You're Subscribed",
        source: "content-series-subscribe",
      }
    : {
        eyebrow: effective.formEyebrow ?? "Be a Guest",
        headline: effective.formHeadline ?? "Share Your Story",
        subtitle: effective.formSubheadline ?? "",
        steps: effective.formSteps ?? [],
        submitUrl: effective.formSubmitUrl || "/api/lp/leads",
        successMessage: effective.formSuccessMessage ?? "Thank you! We'll be in touch.",
        successTitle: "Application Received",
        source: "content-series-guest",
      };

  return (
    <ContentSeriesErrorBoundary>
      <style>{`
        @media (max-width: 768px) {
          .bcs-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
          .bcs-section {
            padding: 3rem 1rem !important;
          }
          .bcs-section#top {
            padding: 3.5rem 1rem 3rem !important;
          }
          .bcs-episode-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 1.25rem !important;
          }
          .bcs-episode-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.85rem !important;
          }
          .bcs-episode-row > div:last-child {
            width: 100% !important;
            justify-content: space-between !important;
          }
        }
      `}</style>
      <div
        style={{
          backgroundColor: C.bg,
          color: C.fg,
          fontFamily: C.bodyFont,
          minHeight: "100vh",
        }}
      >
        {(safeProps.showNav !== false) && <StickyNav p={effective} C={C} onSubscribe={openSubscribeForm} />}
        {(safeProps.showHero !== false) && <Hero p={effective} C={C} />}
        {(safeProps.showEpisodes !== false) && <EpisodeLibrary p={effective} C={C} />}
        {(safeProps.showHosts !== false) && <HostsSection p={effective} C={C} />}
        {(safeProps.showAbout !== false) && <AboutSection p={effective} C={C} />}
        {(safeProps.showForm !== false) && <FormSection p={effective} C={C} onOpenForm={() => openGuestForm()} />}
        {(safeProps.showCta !== false) && <CtaSection p={effective} C={C} onSubscribe={openSubscribeForm} />}
      </div>
      {formModalState.open && (
        <FormModal config={modalConfig} p={effective} C={C} onClose={closeForm} initialFormData={formModalState.initial} />
      )}
    </ContentSeriesErrorBoundary>
  );
}

export default BlockContentSeries;
