import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { StoryHubBlockProps, StoryHubStory, StoryHubTheme } from "@/lib/block-types";
import { useBlockFonts } from "@/lib/use-block-fonts";

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

// Map an api-server page row into the StoryHubStory shape the renderer uses.
// We never drop a case-study page just because it lacks an OG image — the
// renderer falls back to a deterministic neutral tile so every published
// case-study page reliably appears in the hub. The tag is derived from the
// slug segment that follows the case-study prefix when present (e.g.
// "case-study/growth/acme" → "Growth"); otherwise we default to "Case Study".
// That gives the filter chips a meaningful taxonomy that always matches at
// least one chip.
function deriveTagFromSlug(slug: string): string {
  const parts = slug.split("/").filter(Boolean);
  // Drop the leading "case-study" segment if present.
  if (parts[0]?.toLowerCase() === "case-study" && parts.length > 1) {
    const seg = parts[1].replace(/[-_]+/g, " ").trim();
    if (seg) return seg.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // Slug like "case-study-growth-acme" → "Growth".
  const m = slug.match(/^case-study-([a-z0-9]+)/i);
  if (m) return m[1].replace(/\b\w/g, (c) => c.toUpperCase());
  return "Case Study";
}
// Deterministic neutral SVG used when a page has no ogImage. Inlined so the
// hub never needs an extra network round-trip and so the fallback survives
// in air-gapped/offline previews. Subtle off-white card with the practice
// initial centered — readable in both light and dark themes.
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

  useBlockFonts(theme.displayFontFamily, theme.bodyFontFamily);

  const displayFont = theme.displayFontFamily
    ? `'${theme.displayFontFamily}', 'Cormorant Garamond', Georgia, serif`
    : "'Cormorant Garamond', Georgia, serif";
  const bodyFont = theme.bodyFontFamily
    ? `'${theme.bodyFontFamily}', 'Inter', system-ui, sans-serif`
    : "'Inter', system-ui, sans-serif";

  // Fetch published case-study pages for the request host's tenant. Uses the
  // public, host-resolved /lp/public-pages endpoint so anonymous visitors on
  // a tenant landing page can see the live list without authenticating. When
  // the API returns at least one story we use that list; otherwise we fall
  // back to the static stories baked into the block so the builder preview
  // and brand-new tenants still see something meaningful.
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

  // Filter chips. When stories are sourced from the API, derive the chip list
  // from the actual tags present on those stories so every chip resolves to
  // at least one card. Otherwise keep the configured chips from props (which
  // are tuned to the static placeholder content). In both cases the first
  // chip ("All Stories" by convention) is a no-op pass-through.
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

  // Reset the active filter if it disappears from the chip list (builder
  // edits or the API returning a different set of tags than was last shown).
  useEffect(() => {
    if (!filters.includes(activeFilter)) setActiveFilter(defaultFilter);
  }, [filters, activeFilter, defaultFilter]);

  const visibleStories = useMemo(() => {
    if (!activeFilter || activeFilter === defaultFilter) return sourceStories;
    return sourceStories.filter((s) => s.tag === activeFilter);
  }, [sourceStories, activeFilter, defaultFilter]);

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: bodyFont,
        minHeight: "100vh",
      }}
    >
      {/* Top spacer */}
      <div style={{ height: "6rem" }} />

      {/* Hero */}
      <section
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "0 1.5rem 5rem",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: "2rem",
            color: theme.muted,
          }}
        >
          {props.eyebrow}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          style={{
            fontFamily: displayFont,
            fontSize: "clamp(2.75rem, 6vw, 4.5rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            marginBottom: "1.5rem",
          }}
        >
          {props.heroTitle}{" "}
          <span style={{ fontStyle: "italic", color: theme.accent }}>{props.heroAccent}</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
            fontWeight: 300,
            lineHeight: 1.6,
            color: theme.muted,
            maxWidth: "42rem",
            margin: "0 auto",
          }}
        >
          {props.subhead}
        </motion.p>
      </section>

      {/* Featured Story */}
      <section style={{ maxWidth: "80rem", margin: "0 auto", padding: "0 1.5rem 6rem" }}>
        <motion.a
          href={props.featured.href || "#"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            height: "min(70vh, 600px)",
            width: "100%",
            borderRadius: "0.125rem",
            overflow: "hidden",
            backgroundColor: theme.divider,
            cursor: "pointer",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${props.featured.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4) 50%, transparent)",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 10,
              padding: "clamp(1.5rem, 4vw, 4rem)",
              maxWidth: "48rem",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "inline-block",
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: "1rem",
                opacity: 0.85,
                padding: "0.25rem 0.75rem",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "9999px",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              {props.featured.tag}
            </div>
            <h2
              style={{
                fontFamily: displayFont,
                fontSize: "clamp(1.75rem, 4vw, 3rem)",
                lineHeight: 1.15,
                marginBottom: "1.5rem",
              }}
            >
              {props.featured.title}
            </h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "1rem",
                fontSize: "0.85rem",
                opacity: 0.85,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
              }}
            >
              <span>{props.featured.doctor}</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.5)" }} />
              <span>{props.featured.practice}</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.5)" }} />
              <span>{props.featured.location}</span>
            </div>
          </div>
        </motion.a>
      </section>

      {/* Filters */}
      <div
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "0 1.5rem 4rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        {filters.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.875rem",
                borderRadius: "9999px",
                border: `1px solid ${isActive ? theme.accent : theme.divider}`,
                backgroundColor: isActive ? theme.accent : "transparent",
                color: isActive ? theme.onAccent : theme.fg,
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <section
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "0 1.5rem 8rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          columnGap: "3rem",
          rowGap: "4rem",
        }}
      >
        {visibleStories.map((story, i) => (
          <motion.a
            key={story.id || i}
            href={story.href || "#"}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: Math.min(i * 0.08, 0.4) }}
            style={{
              display: "flex",
              flexDirection: "column",
              textDecoration: "none",
              color: "inherit",
            }}
            className="story-hub-card"
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "3 / 4",
                marginBottom: "1.5rem",
                overflow: "hidden",
                borderRadius: "0.125rem",
                backgroundColor: theme.divider,
              }}
            >
              <img
                src={story.imageUrl}
                alt={story.practice}
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
            <div style={{ height: 1, width: "100%", marginBottom: "1.5rem", backgroundColor: theme.divider }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: theme.muted,
                }}
              >
                <span>{story.practice}</span>
                <span>{story.location}</span>
              </div>
              <h3
                style={{
                  fontFamily: displayFont,
                  fontSize: "clamp(1.25rem, 1.8vw, 1.75rem)",
                  lineHeight: 1.25,
                  marginBottom: "1.5rem",
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
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "9999px",
                    border: `1px solid ${theme.divider}`,
                    color: theme.muted,
                  }}
                >
                  {story.tag}
                </span>
                <span
                  style={{
                    fontFamily: displayFont,
                    fontStyle: "italic",
                    fontSize: "0.95rem",
                    color: theme.accent,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  Read story <span style={{ fontSize: "1.1rem" }}>→</span>
                </span>
              </div>
            </div>
          </motion.a>
        ))}
      </section>
      <style>{`
        .story-hub-card:hover img { filter: grayscale(0%); transform: scale(1.04); }
      `}</style>

      {/* Stats */}
      {props.stats.length > 0 && (
        <section style={{ borderTop: `1px solid ${theme.divider}`, borderBottom: `1px solid ${theme.divider}` }}>
          <div
            style={{
              maxWidth: "80rem",
              margin: "0 auto",
              padding: "6rem 1.5rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "3rem",
              justifyContent: "space-around",
            }}
          >
            {props.stats.map((stat, i) => (
              <div key={i} style={{ flex: "1 1 200px", textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: displayFont,
                    fontStyle: "italic",
                    fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                    color: theme.accent,
                    marginBottom: "1rem",
                  }}
                >
                  {stat.number}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: theme.muted,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ padding: "8rem 1.5rem", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: displayFont,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
            letterSpacing: "-0.02em",
            marginBottom: "3rem",
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
            gap: "1.5rem",
          }}
        >
          {props.ctaPrimaryText && (
            <a
              href={props.ctaPrimaryUrl || "#"}
              style={{
                padding: "1rem 2rem",
                fontSize: "0.875rem",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                backgroundColor: theme.accent,
                color: theme.onAccent,
                borderRadius: "0.125rem",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {props.ctaPrimaryText}
            </a>
          )}
          {props.ctaSecondaryText && (
            <a
              href={props.ctaSecondaryUrl || "#"}
              style={{
                padding: "1rem 2rem",
                fontFamily: displayFont,
                fontStyle: "italic",
                fontSize: "0.875rem",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: theme.muted,
                textDecoration: "none",
              }}
            >
              {props.ctaSecondaryText}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

export default BlockStoryHub;
