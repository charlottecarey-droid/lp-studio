import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { StoryHubBlockProps, StoryHubStory, StoryHubTheme } from "@/lib/block-types";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

// Customer Story Hub — premium magazine layout.
//
// The block is intentionally editorial: thin double rules, oversized
// italic display type, edition numbers on every card, decorative
// SVG ornaments at section transitions, and a masthead strip across
// the top. The data contract is unchanged from the previous version
// (StoryHubBlockProps), so existing pages keep rendering with their
// configured copy, theme, featured story, filters, stats, and CTA.
// The visual chrome is what we upgraded.

// Shape of pages returned by GET /lp/pages?tag=case-study. We only read the
// fields the Story Hub needs, so the type is intentionally narrow.
interface CaseStudyPage {
  id: number;
  title: string;
  slug: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
}

function deriveTagFromSlug(slug: string): string {
  const parts = slug.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() === "case-study" && parts.length > 1) {
    const seg = parts[1].replace(/[-_]+/g, " ").trim();
    if (seg) return seg.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const m = slug.match(/^case-study-([a-z0-9]+)/i);
  if (m) return m[1].replace(/\b\w/g, (c) => c.toUpperCase());
  return "Case Study";
}

function fallbackImageFor(title: string): string {
  const initial = (title.trim()[0] ?? "•").toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 800'>`
    + `<rect width='600' height='800' fill='#1a1a1a'/>`
    + `<text x='300' y='430' text-anchor='middle' font-family='Cormorant Garamond, Georgia, serif' font-size='280' fill='#8C6F3F' font-style='italic'>${initial}</text>`
    + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function pageToStory(page: CaseStudyPage): StoryHubStory {
  const headline = (page.metaTitle?.trim() || page.title || "Customer story").trim();
  const imageUrl = page.ogImage?.trim() || fallbackImageFor(page.title || headline);
  return {
    id: `lp-page-${page.id}`,
    practice: page.title || headline,
    location: "",
    headline,
    tag: deriveTagFromSlug(page.slug),
    imageUrl,
    href: `/${page.slug}`,
  };
}

// Deterministic read-time derived from the headline length, clamped to a
// pleasant 4–11 minute range so every card has a metadata signal without
// requiring a new field on the story type.
function deriveReadTime(s: StoryHubStory): number {
  const len = (s.headline?.length ?? 0) + (s.practice?.length ?? 0);
  return 4 + (len % 8);
}

const LIGHT_DEFAULTS: Required<StoryHubTheme> = {
  bg: "#F7F4ED",
  fg: "#0C0F12",
  muted: "rgba(12, 15, 18, 0.6)",
  accent: "#8C6F3F",
  divider: "rgba(12, 15, 18, 0.08)",
  onAccent: "#F7F4ED",
  displayFontFamily: "",
  bodyFontFamily: "",
};

const DARK_DEFAULTS: Required<StoryHubTheme> = {
  bg: "#0C0F12",
  fg: "#EAE4D6",
  muted: "rgba(234, 228, 214, 0.6)",
  accent: "#B59A6E",
  divider: "rgba(234, 228, 214, 0.08)",
  onAccent: "#0C0F12",
  displayFontFamily: "",
  bodyFontFamily: "",
};

function resolveTheme(mode: "light" | "dark", t: StoryHubTheme | undefined) {
  const base = mode === "light" ? LIGHT_DEFAULTS : DARK_DEFAULTS;
  return { ...base, ...(t ?? {}) };
}

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return dark;
}

// ── decorative primitives ───────────────────────────────────────────────

function DoubleRule({ color, width = "100%" }: { color: string; width?: string }) {
  // 1px line / 3px gap / 1px line — premium magazine divider.
  return (
    <div style={{ width }} aria-hidden>
      <div style={{ height: 1, background: color }} />
      <div style={{ height: 3 }} />
      <div style={{ height: 1, background: color }} />
    </div>
  );
}

function Ornament({ color, size = 36 }: { color: string; size?: number }) {
  // Compass-rose / star ornament; used at section transitions.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <g fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round">
        <path d="M24 4 L24 44" />
        <path d="M4 24 L44 24" />
        <path d="M10 10 L38 38" opacity="0.55" />
        <path d="M38 10 L10 38" opacity="0.55" />
        <circle cx="24" cy="24" r="6" />
        <circle cx="24" cy="24" r="1.6" fill={color} />
      </g>
    </svg>
  );
}

function CornerNotch({ color, position }: { color: string; position: "tl" | "tr" | "bl" | "br" }) {
  const size = 22;
  const stroke = 1.4;
  const path =
    position === "tl" ? `M 0 ${size} L 0 0 L ${size} 0`
      : position === "tr" ? `M ${size} ${size} L ${size} 0 L 0 0`
        : position === "bl" ? `M 0 0 L 0 ${size} L ${size} ${size}`
          : `M ${size} 0 L ${size} ${size} L 0 ${size}`;
  const styleByPos: Record<typeof position, React.CSSProperties> = {
    tl: { top: 14, left: 14 },
    tr: { top: 14, right: 14 },
    bl: { bottom: 14, left: 14 },
    br: { bottom: 14, right: 14 },
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      style={{ position: "absolute", pointerEvents: "none", color, opacity: 0.85, ...styleByPos[position] }}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="square" />
    </svg>
  );
}

interface Props {
  props: StoryHubBlockProps;
}

export function BlockStoryHub({ props }: Props) {
  const prefersDark = usePrefersDark();
  const mode: "light" | "dark" =
    props.colorScheme === "auto" ? (prefersDark ? "dark" : "light") : props.colorScheme;
  const theme = useMemo(
    () => resolveTheme(mode, mode === "light" ? props.lightTheme : props.darkTheme),
    [mode, props.lightTheme, props.darkTheme],
  );

  useBlockFonts(
    props.lightTheme?.displayFontFamily,
    props.lightTheme?.bodyFontFamily,
    props.darkTheme?.displayFontFamily,
    props.darkTheme?.bodyFontFamily,
  );

  const displayFont = theme.displayFontFamily
    ? `'${theme.displayFontFamily}', 'Cormorant Garamond', Georgia, serif`
    : "'Cormorant Garamond', Georgia, serif";
  const bodyFont = theme.bodyFontFamily
    ? `'${theme.bodyFontFamily}', 'Inter', system-ui, sans-serif`
    : "'Inter', system-ui, sans-serif";

  // Fetch published case-study pages (unchanged logic).
  const [apiStories, setApiStories] = useState<StoryHubStory[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/lp/public-pages?tag=case-study", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        if (cancelled) return;
        if (!Array.isArray(rows)) { setApiStories([]); return; }
        const mapped: StoryHubStory[] = [];
        for (const row of rows as CaseStudyPage[]) {
          const story = pageToStory(row);
          if (story) mapped.push(story);
        }
        setApiStories(mapped);
      })
      .catch(() => { if (!cancelled) setApiStories([]); });
    return () => { cancelled = true; };
  }, []);

  const sourceStories = apiStories && apiStories.length > 0 ? apiStories : props.stories;

  const filters = useMemo(() => {
    if (apiStories && apiStories.length > 0) {
      const head = props.filters[0] ?? "All Stories";
      const unique = Array.from(new Set(apiStories.map((s) => s.tag).filter(Boolean)));
      return [head, ...unique];
    }
    return props.filters;
  }, [apiStories, props.filters]);

  const defaultFilter = filters[0] ?? "All";
  const [activeFilter, setActiveFilter] = useState<string>(defaultFilter);

  useEffect(() => {
    if (!filters.includes(activeFilter)) setActiveFilter(defaultFilter);
  }, [filters, activeFilter, defaultFilter]);

  // Per-filter count for the chip badges.
  const filterCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sourceStories) map.set(s.tag, (map.get(s.tag) ?? 0) + 1);
    return map;
  }, [sourceStories]);

  const visibleStories = useMemo(() => {
    if (!activeFilter || activeFilter === defaultFilter) return sourceStories;
    return sourceStories.filter((s) => s.tag === activeFilter);
  }, [sourceStories, activeFilter, defaultFilter]);

  const [view, setView] = useState<"grid" | "list">("grid");

  const issueLabel = useMemo(() => {
    // Stable per-page so it doesn't change between renders.
    const d = new Date();
    const month = d.toLocaleString("en", { month: "short" }).toUpperCase();
    return `${month} ${d.getFullYear()}`;
  }, []);

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: bodyFont,
        minHeight: "100vh",
      }}
    >
      {/* ── Masthead strip ── */}
      <header
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "1.5rem 1.5rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: "0.6875rem",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: theme.muted,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span aria-hidden style={{ width: 28, height: 1, background: theme.divider, fontFamily: BODY }} />
          The Customer Stories
        </div>
        <div
          style={{
            fontSize: "0.6875rem",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: theme.muted,
            fontWeight: 600,
          }}
        >
          Vol. III · Issue 04 · {issueLabel}
        </div>
      </header>
      <div style={{ maxWidth: "80rem", margin: "0 auto", padding: "0 1.5rem" }}>
        <DoubleRule color={theme.divider} />
      </div>

      {/* ── Hero (editorial, asymmetric) ── */}
      <section
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "5rem 1.5rem 4rem",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "3rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)",
            gap: "clamp(2rem, 6vw, 5rem)",
            alignItems: "center",
          }}
        >
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              style={{
                fontSize: "0.6875rem",
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: "1.5rem",
                color: theme.accent,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent, boxShadow: `0 0 8px ${theme.accent}`, fontFamily: BODY }} />
              {props.eyebrow}
              <span aria-hidden style={{ width: 28, height: 1, background: theme.accent, opacity: 0.5, fontFamily: BODY }} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              style={{
                fontFamily: displayFont,
                fontSize: "clamp(3rem, 6.6vw, 5.25rem)",
                lineHeight: 1.0,
                letterSpacing: "-0.022em",
                marginBottom: "1.75rem",
                fontWeight: 500,
              }}
            >
              {props.heroTitle}{" "}
              <span style={{ fontStyle: "italic", color: theme.accent, fontFamily: DISPLAY }}>{props.heroAccent}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{ fontSize: "clamp(1rem, 1.35vw, 1.18rem)",
                fontWeight: 300,
                lineHeight: 1.62,
                color: theme.muted,
                maxWidth: "36rem", fontFamily: BODY }}
            >
              {props.subhead}
            </motion.p>

            {/* Reader stats line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              style={{
                marginTop: "2.5rem",
                display: "flex",
                alignItems: "center",
                gap: "2rem",
                flexWrap: "wrap",
              }}
            >
              {[
                { v: `${sourceStories.length}`, l: "Stories in this issue" },
                { v: `${Array.from(new Set(sourceStories.map((s) => s.tag))).length}`, l: "Categories" },
                { v: "All free", l: "to read" },
              ].map((m, i) => (
                <div key={m.l} style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", paddingLeft: i === 0 ? 0 : "2rem", borderLeft: i === 0 ? "none" : `1px solid ${theme.divider}` }}>
                  <span
                    style={{
                      fontFamily: displayFont,
                      fontSize: "1.5rem",
                      fontWeight: 500,
                      color: theme.fg,
                      letterSpacing: "-0.02em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {m.v}
                  </span>
                  <span style={{ fontSize: "0.6875rem", letterSpacing: "0.18em", textTransform: "uppercase", color: theme.muted, fontWeight: 600, fontFamily: BODY }}>
                    {m.l}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right-side tear sheet — "From this issue" mini panel */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            style={{
              position: "relative",
              padding: "2rem 1.5rem 1.75rem",
              border: `1px solid ${theme.divider}`,
              background: mode === "light" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.03)",
            }}
          >
            <CornerNotch color={theme.accent} position="tl" />
            <CornerNotch color={theme.accent} position="tr" />
            <CornerNotch color={theme.accent} position="bl" />
            <CornerNotch color={theme.accent} position="br" />

            <div
              style={{
                fontSize: "0.625rem",
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: theme.accent,
                marginBottom: "1rem",
              }}
            >
              From the editor
            </div>
            <div
              style={{
                fontFamily: displayFont,
                fontSize: "1.25rem",
                lineHeight: 1.3,
                color: theme.fg,
                fontStyle: "italic",
                fontWeight: 500,
                marginBottom: "1rem",
              }}
            >
              "A new generation of practices, written in their own words."
            </div>
            <DoubleRule color={theme.divider} />
            <div
              style={{
                marginTop: "1rem",
                fontSize: "0.6875rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: theme.muted,
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontFamily: BODY }}>Edited by Sasha L.</span>
              <span style={{ fontFamily: BODY }}>·</span>
              <span style={{ fontFamily: BODY }}>{issueLabel}</span>
            </div>
          </motion.aside>
        </div>
      </section>

      {/* ── Featured Story ── */}
      <section style={{ maxWidth: "80rem", margin: "0 auto", padding: "0 1.5rem 5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <span style={{ fontSize: "0.625rem", letterSpacing: "0.32em", textTransform: "uppercase", fontWeight: 700, color: theme.accent, fontFamily: BODY }}>
            ★ Editor's pick · No. 01
          </span>
          <span style={{ flex: 1, height: 1, background: theme.divider, fontFamily: BODY }} aria-hidden />
        </div>

        <motion.a
          href={props.featured.href || "#"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="lp-story-featured"
          style={{
            position: "relative",
            display: "block",
            height: "min(72vh, 640px)",
            width: "100%",
            overflow: "hidden",
            backgroundColor: theme.divider,
            cursor: "pointer",
            textDecoration: "none",
            color: "inherit",
            border: `1px solid ${theme.divider}`,
          }}
        >
          <div
            className="lp-story-featured-img"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${props.featured.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              transition: "transform 1.2s cubic-bezier(0.2, 0.7, 0, 1), filter 0.8s",
            }}
          />
          {/* Multi-stop gradient for proper text legibility */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.85) 100%)",
            }}
          />

          {/* Decorative corner notches over the image */}
          <CornerNotch color="rgba(255,255,255,0.55)" position="tl" />
          <CornerNotch color="rgba(255,255,255,0.55)" position="tr" />
          <CornerNotch color="rgba(255,255,255,0.55)" position="bl" />
          <CornerNotch color="rgba(255,255,255,0.55)" position="br" />

          {/* Top metadata strip */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.25rem clamp(1.5rem, 4vw, 3rem)",
              color: "rgba(255,255,255,0.85)",
              fontSize: "0.625rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", fontFamily: BODY }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#FFFFFF", boxShadow: "0 0 8px rgba(255,255,255,0.8)", fontFamily: BODY }} />
              Feature · {props.featured.tag}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontFamily: BODY }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span style={{ fontFamily: BODY }}>8 min read</span>
            </span>
          </div>

          {/* Bottom title + metadata */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "clamp(2rem, 4vw, 4rem) clamp(1.5rem, 4vw, 4rem) clamp(2rem, 4vw, 3.5rem)",
              color: "#FFFFFF",
              maxWidth: "60rem",
            }}
          >
            <h2
              style={{
                fontFamily: displayFont,
                fontSize: "clamp(1.875rem, 4.4vw, 3.5rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.022em",
                fontWeight: 500,
                marginBottom: "1.75rem",
                maxWidth: "44rem",
                textShadow: "0 2px 24px rgba(0,0,0,0.4)",
              }}
            >
              {props.featured.title}
            </h2>

            {/* Metadata + read CTA on one rule line */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.25)", paddingTop: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "1rem",
                  fontSize: "0.75rem",
                  opacity: 0.92,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                }}
              >
                <span style={{ fontFamily: BODY }}>{props.featured.doctor}</span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.55)", fontFamily: BODY }} />
                <span style={{ fontFamily: BODY }}>{props.featured.practice}</span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.55)", fontFamily: BODY }} />
                <span style={{ fontFamily: BODY }}>{props.featured.location}</span>
              </div>
              <span
                className="lp-story-featured-cta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.6rem 1.1rem",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.4)",
                  fontFamily: displayFont,
                  fontStyle: "italic",
                  fontSize: "1rem",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  transition: "background 240ms ease, border-color 240ms ease",
                }}
              >
                Read the feature
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </motion.a>
      </section>

      {/* ── Section divider ── */}
      <div
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "1rem 1.5rem 2.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
        }}
      >
        <span style={{ flex: 1, height: 1, background: theme.divider, fontFamily: BODY }} aria-hidden />
        <Ornament color={theme.accent} />
        <span style={{ flex: 1, height: 1, background: theme.divider, fontFamily: BODY }} aria-hidden />
      </div>

      {/* ── Browse bar (filters + sort + view toggle) ── */}
      <div
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              fontSize: "0.625rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: theme.muted,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span aria-hidden style={{ width: 28, height: 1, background: theme.divider, fontFamily: BODY }} />
            Browse the archive
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Sort */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: theme.muted, border: `1px solid ${theme.divider}`, padding: "0.4rem 0.8rem", borderRadius: 999, fontFamily: BODY }}>
              <span style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600, fontFamily: BODY }}>Sort</span>
              <span style={{ color: theme.fg, fontStyle: "italic", fontFamily: displayFont }}>Latest</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
            {/* View toggle */}
            <div
              role="group"
              aria-label="View"
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: `1px solid ${theme.divider}`,
                borderRadius: 999,
                padding: 3,
              }}
            >
              {(["grid", "list"] as const).map((v) => {
                const active = view === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={active}
                    style={{
                      padding: "0.3rem 0.7rem",
                      borderRadius: 999,
                      fontSize: "0.72rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      background: active ? theme.accent : "transparent",
                      color: active ? theme.onAccent : theme.muted,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
            padding: "0 0 0.75rem",
          }}
        >
          {filters.map((filter) => {
            const isActive = filter === activeFilter;
            const isHead = filter === defaultFilter;
            const count = isHead ? sourceStories.length : (filterCounts.get(filter) ?? 0);
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                style={{
                  padding: "0.5rem 1rem 0.5rem 1rem",
                  fontSize: "0.78rem",
                  borderRadius: "9999px",
                  border: `1px solid ${isActive ? theme.accent : theme.divider}`,
                  backgroundColor: isActive ? theme.accent : "transparent",
                  color: isActive ? theme.onAccent : theme.fg,
                  cursor: "pointer",
                  transition: "all 0.25s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                <span style={{ fontFamily: BODY }}>{filter}</span>
                <span style={{ fontSize: "0.65rem", fontVariantNumeric: "tabular-nums", padding: "0.05rem 0.4rem", borderRadius: 999, background: isActive ? "rgba(255,255,255,0.18)" : theme.divider, color: isActive ? theme.onAccent : theme.muted, fontWeight: 700, fontFamily: BODY }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            fontSize: "0.6875rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.muted,
            marginBottom: "2.5rem",
            fontWeight: 600,
          }}
        >
          Showing {visibleStories.length} of {sourceStories.length} {sourceStories.length === 1 ? "story" : "stories"}
          {activeFilter !== defaultFilter && (
            <>
              {" · "}
              <span style={{ color: theme.accent, fontFamily: BODY }}>{activeFilter}</span>
              <button
                type="button"
                onClick={() => setActiveFilter(defaultFilter)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "0 0.5rem",
                  color: theme.muted,
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Cards grid (or list) ── */}
      <section
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "0 1.5rem 6rem",
          display: "grid",
          gridTemplateColumns:
            view === "list"
              ? "minmax(0, 1fr)"
              : "repeat(auto-fill, minmax(300px, 1fr))",
          columnGap: view === "list" ? 0 : "3rem",
          rowGap: view === "list" ? 0 : "4rem",
        }}
      >
        {visibleStories.map((story, i) => (
          <StoryCard
            key={story.id || i}
            story={story}
            index={i}
            theme={theme}
            displayFont={displayFont}
            mode={mode}
            view={view}
          />
        ))}
      </section>

      <style>{`
        .lp-story-card:hover .lp-story-img { filter: grayscale(0%) !important; transform: scale(1.045); }
        .lp-story-card:hover .lp-story-excerpt { opacity: 1 !important; transform: translateY(0) !important; }
        .lp-story-card:hover .lp-story-readline { color: var(--accent-color, currentColor); }
        .lp-story-featured:hover .lp-story-featured-img { transform: scale(1.035); }
        .lp-story-featured:hover .lp-story-featured-cta { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.7); }
      `}</style>

      {/* ── Editorial pullquote band ── */}
      <section
        style={{
          maxWidth: "60rem",
          margin: "0 auto",
          padding: "4rem 1.5rem 6rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: theme.accent,
            marginBottom: "2rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span aria-hidden style={{ width: 28, height: 1, background: theme.accent, opacity: 0.6, fontFamily: BODY }} />
          From the archive
          <span aria-hidden style={{ width: 28, height: 1, background: theme.accent, opacity: 0.6, fontFamily: BODY }} />
        </div>
        <blockquote
          style={{
            fontFamily: displayFont,
            fontSize: "clamp(1.75rem, 3.4vw, 2.65rem)",
            lineHeight: 1.25,
            fontStyle: "italic",
            color: theme.fg,
            fontWeight: 500,
            letterSpacing: "-0.014em",
            marginBottom: "2rem",
          }}
        >
          "We stopped writing case studies the day we joined. Now our customers tell each other."
        </blockquote>
        <div
          style={{
            fontSize: "0.6875rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: theme.muted,
            fontWeight: 600,
          }}
        >
          — Quoted in {issueLabel}
        </div>
      </section>

      {/* ── Stats ── */}
      {props.stats.length > 0 && (
        <section
          style={{
            borderTop: `1px solid ${theme.divider}`,
            borderBottom: `1px solid ${theme.divider}`,
            background:
              mode === "light"
                ? "rgba(255,255,255,0.35)"
                : "rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              maxWidth: "80rem",
              margin: "0 auto",
              padding: "5rem 1.5rem",
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(4, props.stats.length)}, minmax(0, 1fr))`,
              gap: 0,
            }}
          >
            {props.stats.map((stat, i) => (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  padding: "1.5rem 1rem",
                  borderLeft: i === 0 ? "none" : `1px solid ${theme.divider}`,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontSize: "0.625rem",
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    color: theme.muted,
                    fontWeight: 700,
                    marginBottom: "1rem",
                  }}
                >
                  No. {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    fontFamily: displayFont,
                    fontStyle: "italic",
                    fontSize: "clamp(2.75rem, 5.4vw, 5rem)",
                    color: theme.accent,
                    fontWeight: 500,
                    lineHeight: 1.0,
                    letterSpacing: "-0.022em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {stat.number}
                </div>
                <div
                  style={{
                    marginTop: "1rem",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: theme.muted,
                    fontWeight: 600,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Closing CTA ── */}
      <section style={{ padding: "7rem 1.5rem 5rem", textAlign: "center" }}>
        <div style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "center" }}>
          <Ornament color={theme.accent} size={42} />
        </div>
        <h2
          style={{
            fontFamily: displayFont,
            fontSize: "clamp(2.5rem, 5.4vw, 4.25rem)",
            letterSpacing: "-0.024em",
            lineHeight: 1.05,
            marginBottom: "2.5rem",
            fontWeight: 500,
            maxWidth: "44rem",
            margin: "0 auto 2.5rem",
          }}
        >
          {props.ctaHeadline}
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {props.ctaPrimaryText && (
            <a
              href={props.ctaPrimaryUrl || "#"}
              className="lp-story-cta-primary"
              style={{
                position: "relative",
                padding: "1rem 2rem",
                fontSize: "0.78rem",
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                backgroundColor: theme.accent,
                color: theme.onAccent,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
                fontWeight: 700,
                overflow: "hidden",
                border: `1px solid ${theme.accent}`,
              }}
            >
              {props.ctaPrimaryText}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </a>
          )}
          {props.ctaSecondaryText && (
            <a
              href={props.ctaSecondaryUrl || "#"}
              style={{
                padding: "1rem 1.5rem",
                fontFamily: displayFont,
                fontStyle: "italic",
                fontSize: "1rem",
                color: theme.fg,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderBottom: `1px solid ${theme.divider}`,
              }}
            >
              {props.ctaSecondaryText}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </a>
          )}
        </div>

        {/* Subscribe microcopy */}
        <div
          style={{
            marginTop: "3rem",
            fontSize: "0.6875rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: theme.muted,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 6h16v12H4z" />
            <path d="M4 6l8 7 8-7" />
          </svg>
          Subscribe — one issue every month
        </div>
      </section>

      {/* Bottom colophon */}
      <div style={{ maxWidth: "80rem", margin: "0 auto", padding: "0 1.5rem" }}>
        <DoubleRule color={theme.divider} />
      </div>
      <footer
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "1.5rem 1.5rem 2.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          fontSize: "0.625rem",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: theme.muted,
          fontWeight: 600,
        }}
      >
        <span style={{ fontFamily: BODY }}>Customer Stories · Vol. III · Issue 04</span>
        <span style={{ fontFamily: BODY }}>Set in {(theme.displayFontFamily || "Cormorant Garamond").replace(/['"]/g, "")} & {(theme.bodyFontFamily || "Inter").replace(/['"]/g, "")}</span>
      </footer>
    </div>
  );
}

// ── Story card ──────────────────────────────────────────────────────────

function StoryCard({
  story,
  index,
  theme,
  displayFont,
  mode,
  view,
}: {
  story: StoryHubStory;
  index: number;
  theme: Required<StoryHubTheme>;
  displayFont: string;
  mode: "light" | "dark";
  view: "grid" | "list";
}) {
  const readTime = deriveReadTime(story);
  const editionNo = `No. ${String(index + 2).padStart(2, "0")}`; // featured is No. 01
  const accentStyle = { ["--accent-color" as never]: theme.accent } as React.CSSProperties;

  if (view === "list") {
    return (
      <motion.a
        href={story.href || "#"}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3) }}
        className="lp-story-card"
        style={{
          display: "grid",
          gridTemplateColumns: "200px minmax(0, 1fr) auto",
          gap: "1.5rem",
          alignItems: "center",
          padding: "1.5rem 0",
          textDecoration: "none",
          color: "inherit",
          borderBottom: `1px solid ${theme.divider}`,
          ...accentStyle,
        }}
      >
        <div
          style={{
            aspectRatio: "4 / 3",
            backgroundColor: theme.divider,
            overflow: "hidden",
          }}
        >
          <img
            src={story.imageUrl}
            alt={story.practice}
            className="lp-story-img"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(100%)",
              transition: "filter 0.7s, transform 0.7s",
            }}
            loading="lazy"
          />
        </div>
        <div>
          <div
            style={{
              fontSize: "0.625rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: theme.muted,
              fontWeight: 700,
              marginBottom: "0.5rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <span style={{ color: theme.accent, fontFamily: BODY }}>{editionNo}</span>
            <span style={{ fontFamily: BODY }}>·</span>
            <span style={{ fontFamily: BODY }}>{story.tag}</span>
            <span style={{ fontFamily: BODY }}>·</span>
            <span style={{ fontFamily: BODY }}>{readTime} min read</span>
          </div>
          <h3
            style={{
              fontFamily: displayFont,
              fontSize: "clamp(1.25rem, 1.7vw, 1.625rem)",
              lineHeight: 1.2,
              letterSpacing: "-0.012em",
              fontWeight: 500,
              marginBottom: "0.4rem",
            }}
          >
            {story.headline}
          </h3>
          <div
            style={{
              fontSize: "0.75rem",
              color: theme.muted,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <span style={{ fontFamily: BODY }}>{story.practice}</span>
            {story.location && (
              <>
                <span style={{ fontFamily: BODY }}>·</span>
                <span style={{ fontFamily: BODY }}>{story.location}</span>
              </>
            )}
          </div>
        </div>
        <span
          className="lp-story-readline"
          style={{
            fontFamily: displayFont,
            fontStyle: "italic",
            fontSize: "0.95rem",
            color: theme.muted,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "color 240ms ease",
          }}
        >
          Read story
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
          </svg>
        </span>
      </motion.a>
    );
  }

  return (
    <motion.a
      href={story.href || "#"}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.06, 0.4) }}
      className="lp-story-card"
      style={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        ...accentStyle,
      }}
    >
      {/* Edition number on top */}
      <div
        style={{
          fontSize: "0.625rem",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: theme.muted,
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <span style={{ color: theme.accent, fontFamily: BODY }}>{editionNo}</span>
        <span aria-hidden style={{ flex: 1, height: 1, background: theme.divider, fontFamily: BODY }} />
        <span style={{ fontFamily: BODY }}>{readTime} min read</span>
      </div>

      <div
        style={{
          position: "relative",
          aspectRatio: "3 / 4",
          marginBottom: "1.25rem",
          overflow: "hidden",
          backgroundColor: theme.divider,
          border: `1px solid ${theme.divider}`,
        }}
      >
        <img
          src={story.imageUrl}
          alt={story.practice}
          className="lp-story-img"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(100%)",
            transition: "filter 0.7s, transform 0.7s cubic-bezier(0.2,0.7,0,1)",
          }}
          loading="lazy"
        />
        {/* Bottom vignette so the tag chip reads on bright images */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Tag chip pinned over the image */}
        <span style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.32rem 0.7rem", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#0C0F12", fontSize: "0.625rem", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", fontFamily: BODY }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.accent, fontFamily: BODY }} />
          {story.tag}
        </span>
        {/* Hover overlay — short excerpt */}
        <div
          className="lp-story-excerpt"
          style={{
            position: "absolute",
            inset: "auto 0 0 0",
            padding: "1rem 1.25rem",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%)",
            color: "#FFFFFF",
            fontSize: "0.78rem",
            lineHeight: 1.5,
            opacity: 0,
            transform: "translateY(12px)",
            transition: "opacity 320ms ease, transform 320ms ease",
            pointerEvents: "none",
          }}
        >
          <span style={{ display: "block", fontSize: "0.625rem", letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.75, fontWeight: 700, marginBottom: "0.4rem", fontFamily: BODY }}>
            From {story.practice}
          </span>
          <span style={{ fontStyle: "italic", fontFamily: displayFont, fontSize: "1.05rem", lineHeight: 1.3 }}>
            "{story.headline}"
          </span>
        </div>
      </div>

      <DoubleRule color={theme.divider} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "1rem",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: theme.muted,
            fontWeight: 600,
          }}
        >
          <span style={{ fontFamily: BODY }}>{story.practice}</span>
          <span style={{ fontFamily: BODY }}>{story.location || "—"}</span>
        </div>
        <h3
          style={{
            fontFamily: displayFont,
            fontSize: "clamp(1.3rem, 1.8vw, 1.7rem)",
            lineHeight: 1.2,
            marginBottom: "1.5rem",
            fontWeight: 500,
            letterSpacing: "-0.012em",
          }}
        >
          {story.headline}
        </h3>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.2em", padding: "0.25rem 0.7rem", borderRadius: 999, border: `1px solid ${theme.divider}`, color: theme.muted, fontWeight: 700, fontFamily: BODY }}>
            {story.tag}
          </span>
          <span
            className="lp-story-readline"
            style={{
              fontFamily: displayFont,
              fontStyle: "italic",
              fontSize: "0.95rem",
              color: theme.muted,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "color 240ms ease",
            }}
          >
            Read story
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </motion.a>
  );
}

export default BlockStoryHub;
