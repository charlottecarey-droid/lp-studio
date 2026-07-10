import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Quote,
} from "lucide-react";
import type { CaseModularBlockProps } from "@/lib/block-types";
import {
  resolveSectionSpacingPx,
  resolveContentMaxWidthPx,
  resolveRadiusPx,
  resolveHeadingScale,
} from "@/lib/block-types";
import { useBrandConfig } from "@/components/BrandSwatches";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: CaseModularBlockProps;
  onFieldChange?: (updated: CaseModularBlockProps) => void;
}

interface ResolvedTokens {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  dark: string;
  cardBg: string;
  border: string;
  headline: string;
  headlineOnDark: string;
  panelBg: string;
  accentSoftBg: string;
  displayFont: string;
  bodyFont: string;
  spacing: number;
  maxWidth: number;
  radius: number;
  headingScale: number;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (full.length < 6) return null;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** A tasteful neutral gradient placeholder when no image is supplied. */
function imageBg(tokens: ResolvedTokens): string {
  return `linear-gradient(135deg, ${rgba(tokens.accent, 0.16)} 0%, ${rgba(
    tokens.ink,
    0.08,
  )} 100%)`;
}

function num2(n: number): string {
  return String(n).padStart(2, "0");
}

export function BlockCaseModular({ props, onFieldChange }: Props) {
  const brand = useBrandConfig();

  const t: ResolvedTokens = useMemo(() => {
    const bg = props.bgColor || brand?.pageBackground || "#F7F7F5";
    const ink = props.inkColor || brand?.textColor || "#111111";
    const muted = props.mutedColor || "#666666";
    const accent = props.accentColor || brand?.accentColor || "#0055FF";
    const accentInk = props.accentInkColor || "#FFFFFF";
    const dark = props.darkColor || "#111111";
    const cardBg = props.cardBgColor || brand?.cardBackground || "#FFFFFF";
    const border = props.borderColor || brand?.borderColor || "#E5E5E5";
    const headline = props.headlineColor || brand?.headingOnLightColor || ink;
    const headlineOnDark =
      props.headlineOnDarkColor || brand?.headingOnDarkColor || "#FFFFFF";
    const displayFont = props.displayFontFamily
      ? `'${props.displayFontFamily}', sans-serif`
      : brand?.displayFont
        ? `'${brand.displayFont}', sans-serif`
        : "'Inter', system-ui, sans-serif";
    const bodyFont = props.bodyFontFamily
      ? `'${props.bodyFontFamily}', sans-serif`
      : brand?.bodyFont
        ? `'${brand.bodyFont}', sans-serif`
        : "'Inter', system-ui, sans-serif";
    return {
      bg,
      ink,
      muted,
      accent,
      accentInk,
      dark,
      cardBg,
      border,
      headline,
      headlineOnDark,
      panelBg: rgba(ink, 0.025),
      accentSoftBg: rgba(accent, 0.08),
      displayFont,
      bodyFont,
      spacing: resolveSectionSpacingPx(props.sectionSpacing),
      maxWidth: resolveContentMaxWidthPx(props.contentWidth),
      radius: resolveRadiusPx(props.cornerRadius),
      headingScale: resolveHeadingScale(props.headingScale),
    };
  }, [props, brand]);

  // ── Section visibility — absent === visible ──────────────────────────────
  const showNav = props.showNav !== false;
  const showHero = props.showHero !== false;
  const showMetrics = props.showMetrics !== false;
  const showAtAGlance = props.showAtAGlance !== false;
  const showChallenge = props.showChallenge !== false;
  const showApproach = props.showApproach !== false;
  const showResults = props.showResults !== false;
  const showQuote = props.showQuote !== false;
  const showGallery = props.showGallery !== false;
  const showModules = props.showModules !== false;
  const showTakeaways = props.showTakeaways !== false;
  const showCta = props.showCta !== false;
  const showFooter = props.showFooter !== false;

  const brandName = props.brandName?.trim() || "Case Study";
  const modules = props.modules ?? [];
  const hasModules = showModules && modules.length > 0;

  // ── Build the TOC + section numbering ─────────────────────────────────────
  interface NavEntry {
    id: string;
    label: string;
    number?: string;
  }
  const navEntries = useMemo<NavEntry[]>(() => {
    const entries: NavEntry[] = [];
    let counter = 0;
    const numbered = (label: string): string => {
      counter += 1;
      return num2(counter);
    };
    if (showHero) entries.push({ id: "hero", label: "Overview" });
    if (showChallenge)
      entries.push({
        id: "challenge",
        label: props.challengeHeading || "The Challenge",
        number: numbered("challenge"),
      });
    if (showApproach)
      entries.push({
        id: "approach",
        label: props.approachHeading || "The Approach",
        number: numbered("approach"),
      });
    if (showResults)
      entries.push({
        id: "results",
        label: props.resultsHeading || "Results",
        number: numbered("results"),
      });
    if (showQuote)
      entries.push({
        id: "testimonial",
        label: "Testimonial",
        number: numbered("testimonial"),
      });
    if (hasModules) {
      modules.forEach((m, i) => {
        entries.push({
          id: `module-${i + 1}`,
          label: m.heading || `Module ${i + 1}`,
          number: numbered(`module-${i}`),
        });
      });
    }
    if (showGallery)
      entries.push({
        id: "gallery",
        label: props.galleryHeading || "Gallery",
        number: numbered("gallery"),
      });
    if (showTakeaways)
      entries.push({
        id: "takeaways",
        label: props.takeawaysHeading || "Key Takeaways",
        number: numbered("takeaways"),
      });
    return entries;
  }, [
    showHero,
    showChallenge,
    showApproach,
    showResults,
    showQuote,
    showGallery,
    showTakeaways,
    hasModules,
    modules,
    props.challengeHeading,
    props.approachHeading,
    props.resultsHeading,
    props.galleryHeading,
    props.takeawaysHeading,
  ]);

  const numberFor = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    navEntries.forEach((e) => {
      if (e.number) map[e.id] = e.number;
    });
    return map;
  }, [navEntries]);

  const [activeSection, setActiveSection] = useState<string>(
    navEntries[0]?.id ?? "hero",
  );

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("section[data-case-section]");
      let current = navEntries[0]?.id ?? "hero";
      sections.forEach((section) => {
        const top = (section as HTMLElement).offsetTop;
        if (window.scrollY >= top - 200) {
          current = section.getAttribute("id") || current;
        }
      });
      setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navEntries]);

  const sectionPadX = "clamp(1.5rem, 5vw, 6rem)";
  const sectionStyle: React.CSSProperties = {
    paddingTop: t.spacing,
    paddingBottom: t.spacing,
    paddingLeft: sectionPadX,
    paddingRight: sectionPadX,
    borderBottom: `1px solid ${t.border}`,
    position: "relative",
  };

  const eyebrowStyle: React.CSSProperties = {
    fontSize: "0.625rem",
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: t.muted,
  };

  const heroImg = props.heroImageUrl;
  const challengeImg = props.challengeImageUrl;
  const portraitImg = props.quotePortraitUrl;

  const metrics = props.metrics ?? [];
  const profile = props.profile ?? [];
  const approachCards = props.approachCards ?? [];
  const resultStats = props.resultStats ?? [];
  const galleryImages = props.galleryImages ?? [];
  const takeaways = props.takeaways ?? [];

  const field = (key: keyof CaseModularBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateMetric = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, metrics: metrics.map((m, idx) => (idx === i ? { ...m, [key]: v } : m)) });
  };
  const updateProfileRow = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, profile: profile.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)) });
  };
  const updateApproachCard = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, approachCards: approachCards.map((c, idx) => (idx === i ? { ...c, [key]: v } : c)) });
  };
  const updateResultStat = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, resultStats: resultStats.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)) });
  };
  const updateModule = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, modules: modules.map((m, idx) => (idx === i ? { ...m, [key]: v } : m)) });
  };
  const updateTakeaway = (i: number, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, takeaways: takeaways.map((tk, idx) => (idx === i ? { ...tk, text: v } : tk)) });
  };

  return (
    <div
      id="top"
      style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.ink,
        fontFamily: t.bodyFont,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          maxWidth: 1600,
          margin: "0 auto",
        }}
        className="bcm-shell"
      >
        {/* LEFT RAIL: Sticky TOC */}
        {showNav && navEntries.length > 0 && (
          <aside
            className="bcm-rail"
            style={{
              width: 300,
              flexShrink: 0,
              height: "100vh",
              position: "sticky",
              top: 0,
              borderRight: `1px solid ${t.border}`,
              background: t.bg,
              zIndex: 40,
            }}
          >
            <div
              style={{
                padding: "1.75rem 2rem",
                borderBottom: `1px solid ${t.border}`,
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              {props.logoUrl ? (
                <img
                  src={props.logoUrl}
                  alt={props.logoAlt || brandName}
                  style={{ height: "1.75rem", width: "auto" }}
                />
              ) : (
                <>
                  <div
                    style={{
                      width: "2rem",
                      height: "2rem",
                      background: t.ink,
                      borderRadius: Math.min(t.radius, 6),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Layers size={16} color={t.bg} />
                  </div>
                  <InlineText
                    as="span"
                    value={brandName}
                    onUpdate={field("brandName")}
                    style={{
                      fontFamily: t.displayFont,
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  />
                </>
              )}
            </div>

            <div
              style={{
                padding: "2rem",
                flex: 1,
                overflowY: "auto",
              }}
            >
              <div style={{ ...eyebrowStyle, marginBottom: "1.5rem" }}>
                Case Study Dossier
              </div>
              <nav
                style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
              >
                {navEntries.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: Math.min(t.radius, 8),
                        fontSize: "0.8rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        background: active ? t.cardBg : "transparent",
                        boxShadow: active
                          ? "0 1px 3px rgba(0,0,0,0.08)"
                          : "none",
                        fontWeight: active ? 500 : 400,
                        color: active ? t.ink : t.muted,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "999px",
                          flexShrink: 0,
                          background: active ? t.accent : "transparent",
                        }}
                      />
                      {item.number ? `${item.number} ` : ""}
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            </div>

            {showCta && (props.ctaLabel || props.ctaUrl) && (
              <div
                style={{
                  padding: "1.5rem 2rem",
                  borderTop: `1px solid ${t.border}`,
                }}
              >
                <a
                  href={props.ctaUrl || "#cta"}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: t.ink,
                    color: t.bg,
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    borderRadius: Math.min(t.radius, 8),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    textDecoration: "none",
                  }}
                >
                  <Download size={15} /> {props.ctaLabel || "Download PDF"}
                </a>
              </div>
            )}
          </aside>
        )}

        {/* MOBILE NAV */}
        {showNav && navEntries.length > 0 && (
          <div
            className="bcm-mobile-nav"
            style={{
              position: "sticky",
              top: 0,
              background: t.cardBg,
              borderBottom: `1px solid ${t.border}`,
              zIndex: 50,
              padding: "0.85rem 1rem",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Layers size={18} color={t.ink} />
              <InlineText as="span" value={brandName} onUpdate={field("brandName")} style={{ fontWeight: 600, fontSize: "0.85rem" }} />
            </div>
            <select
              value={activeSection}
              onChange={(e) =>
                document.getElementById(e.target.value)?.scrollIntoView({
                  behavior: "smooth",
                })
              }
              style={{
                fontSize: "0.8rem",
                border: `1px solid ${t.border}`,
                borderRadius: Math.min(t.radius, 6),
                padding: "0.5rem",
                background: t.bg,
                color: t.ink,
                maxWidth: "55%",
              }}
            >
              {navEntries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number ? `${item.number} ` : ""}
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, background: t.cardBg, minWidth: 0 }}>
          {/* Hero / Overview */}
          {showHero && (
            <section id="hero" data-case-section style={sectionStyle}>
              <div style={{ maxWidth: t.maxWidth }}>
                {(props.heroEyebrow || onFieldChange) && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.3rem 0.75rem",
                      background: t.accentSoftBg,
                      color: t.accent,
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: "2rem",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "999px",
                        background: t.accent,
                      }}
                    />
                    <InlineText as="span" value={props.heroEyebrow ?? ""} onUpdate={field("heroEyebrow")} />
                  </div>
                )}

                <InlineText
                  as="h1"
                  value={props.heroHeadline}
                  onUpdate={field("heroHeadline")}
                  style={{
                    fontFamily: t.displayFont,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.05,
                    marginBottom: "2rem",
                    color: t.headline,
                    fontSize: `clamp(2.25rem, 5vw, ${4.25 * t.headingScale}rem)`,
                  }}
                />

                {(props.heroSummary || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.heroSummary ?? ""}
                    onUpdate={field("heroSummary")}
                    multiline
                    style={{
                      fontSize: "clamp(1.1rem, 2vw, 1.4rem)",
                      color: t.muted,
                      fontWeight: 300,
                      lineHeight: 1.55,
                      marginBottom: "3rem",
                      maxWidth: 720,
                    }}
                  />
                )}

                {showMetrics && metrics.length > 0 && (
                  <div
                    className="bcm-metrics-grid"
                    style={{
                      display: "grid",
                      gap: "1.5rem",
                      padding: "1.5rem",
                      background: t.bg,
                      borderRadius: t.radius,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    {metrics.map((m, i) => (
                      <div key={i}>
                        <InlineText
                          as="div"
                          value={m.value}
                          onUpdate={onFieldChange ? (v) => updateMetric(i, "value", v) : undefined}
                          style={{
                            fontFamily: t.displayFont,
                            fontSize: "1.85rem",
                            fontWeight: 700,
                            marginBottom: "0.25rem",
                            color: t.headline,
                          }}
                        />
                        <InlineText as="div" value={m.label} onUpdate={onFieldChange ? (v) => updateMetric(i, "label", v) : undefined} style={{ fontSize: "0.85rem", color: t.muted }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "3rem",
                  borderRadius: t.radius,
                  overflow: "hidden",
                  aspectRatio: "21 / 9",
                  background: heroImg ? t.border : imageBg(t),
                }}
              >
                {heroImg && (
                  <img
                    src={heroImg}
                    alt={props.clientName || props.heroHeadline}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
              </div>
            </section>
          )}

          {/* At a glance — client fact panel */}
          {showAtAGlance && (props.clientName || profile.length > 0 || onFieldChange) && (
            <section
              data-case-section
              id="at-a-glance"
              style={{ ...sectionStyle, background: t.panelBg }}
            >
              <div
                className="bcm-glance"
                style={{
                  maxWidth: t.maxWidth,
                  display: "flex",
                  gap: "3rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                  <InlineText as="h3" value={props.atAGlanceHeading || "The Client"} onUpdate={field("atAGlanceHeading")} style={{ ...eyebrowStyle, marginBottom: "1rem" }} />
                  {(props.clientName || onFieldChange) && (
                    <InlineText
                      as="div"
                      value={props.clientName ?? ""}
                      onUpdate={field("clientName")}
                      style={{
                        fontFamily: t.displayFont,
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        marginBottom: "0.5rem",
                        color: t.headline,
                      }}
                    />
                  )}
                  {(props.heroSummary || onFieldChange) && (
                    <InlineText as="p" value={props.heroSummary ?? ""} onUpdate={field("heroSummary")} multiline style={{ color: t.muted, fontSize: "0.85rem", lineHeight: 1.5 }} />
                  )}
                </div>
                {profile.length > 0 && (
                  <div
                    className="bcm-profile-grid"
                    style={{
                      flex: "2 1 360px",
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "1.75rem",
                    }}
                  >
                    {profile.map((row, i) => (
                      <div key={i}>
                        <InlineText as="h4" value={row.label} onUpdate={onFieldChange ? (v) => updateProfileRow(i, "label", v) : undefined} style={{ ...eyebrowStyle, marginBottom: "0.4rem" }} />
                        <InlineText as="p" value={row.value} onUpdate={onFieldChange ? (v) => updateProfileRow(i, "value", v) : undefined} style={{ fontWeight: 500, color: t.ink }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Challenge */}
          {showChallenge && (
            <section id="challenge" data-case-section style={sectionStyle}>
              <div style={{ maxWidth: Math.min(t.maxWidth, 880) }}>
                <SectionTitle
                  t={t}
                  number={numberFor["challenge"]}
                  title={props.challengeHeading || "The Challenge"}
                  eyebrow={props.challengeEyebrow}
                  onTitleChange={field("challengeHeading")}
                  onEyebrowChange={field("challengeEyebrow")}
                />
                {(props.challengeBody || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.challengeBody ?? ""}
                    onUpdate={field("challengeBody")}
                    multiline
                    style={{
                      fontSize: "1.15rem",
                      lineHeight: 1.7,
                      color: t.ink,
                      whiteSpace: "pre-line",
                    }}
                  />
                )}
                {challengeImg && (
                  <div
                    style={{
                      marginTop: "2.5rem",
                      borderRadius: t.radius,
                      overflow: "hidden",
                      aspectRatio: "16 / 9",
                      background: t.border,
                    }}
                  >
                    <img
                      src={challengeImg}
                      alt={props.challengeHeading || "The Challenge"}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Approach — dark slab */}
          {showApproach && (
            <section
              id="approach"
              data-case-section
              style={{ ...sectionStyle, background: t.dark, color: t.headlineOnDark }}
            >
              <div style={{ maxWidth: t.maxWidth }}>
                <SectionTitle
                  t={t}
                  number={numberFor["approach"]}
                  title={props.approachHeading || "The Approach"}
                  eyebrow={props.approachEyebrow}
                  onDark
                  onTitleChange={field("approachHeading")}
                  onEyebrowChange={field("approachEyebrow")}
                />
                {(props.approachBody || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.approachBody ?? ""}
                    onUpdate={field("approachBody")}
                    multiline
                    style={{
                      fontSize: "1.1rem",
                      lineHeight: 1.7,
                      color: rgba(t.headlineOnDark, 0.7),
                      marginBottom: approachCards.length > 0 ? "3rem" : 0,
                      maxWidth: 760,
                    }}
                  />
                )}
                {approachCards.length > 0 && (
                  <div
                    className="bcm-approach-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                      gap: "2rem",
                    }}
                  >
                    {approachCards.map((card, i) => (
                      <div
                        key={i}
                        style={{
                          borderTop: `1px solid ${rgba(t.headlineOnDark, 0.2)}`,
                          paddingTop: "1.5rem",
                        }}
                      >
                        <div
                          style={{
                            width: "2rem",
                            height: "2rem",
                            borderRadius: Math.min(t.radius, 8),
                            background: t.accent,
                            color: t.accentInk,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            marginBottom: "1rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          {i + 1}
                        </div>
                        <InlineText
                          as="h3"
                          value={card.title}
                          onUpdate={onFieldChange ? (v) => updateApproachCard(i, "title", v) : undefined}
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            marginBottom: "0.75rem",
                            color: t.headlineOnDark,
                          }}
                        />
                        <InlineText
                          as="p"
                          value={card.body}
                          onUpdate={onFieldChange ? (v) => updateApproachCard(i, "body", v) : undefined}
                          multiline
                          style={{
                            fontSize: "0.9rem",
                            lineHeight: 1.6,
                            color: rgba(t.headlineOnDark, 0.6),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Results */}
          {showResults && (
            <section id="results" data-case-section style={sectionStyle}>
              <div style={{ maxWidth: t.maxWidth }}>
                <SectionTitle
                  t={t}
                  number={numberFor["results"]}
                  title={props.resultsHeading || "The Impact"}
                  eyebrow={props.resultsEyebrow}
                  onTitleChange={field("resultsHeading")}
                  onEyebrowChange={field("resultsEyebrow")}
                />
                {(props.resultsBody || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.resultsBody ?? ""}
                    onUpdate={field("resultsBody")}
                    multiline
                    style={{
                      fontSize: "1.1rem",
                      lineHeight: 1.7,
                      color: t.muted,
                      marginBottom: resultStats.length > 0 ? "2.5rem" : 0,
                      maxWidth: 760,
                    }}
                  />
                )}
                {resultStats.length > 0 && (
                  <div
                    className="bcm-results-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                      gap: "1.5rem",
                    }}
                  >
                    {resultStats.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "2rem",
                          background: t.cardBg,
                          border: `1px solid ${t.border}`,
                          borderRadius: t.radius,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        <InlineText
                          as="div"
                          value={s.value}
                          onUpdate={onFieldChange ? (v) => updateResultStat(i, "value", v) : undefined}
                          style={{
                            fontFamily: t.displayFont,
                            fontSize: "2.75rem",
                            fontWeight: 700,
                            color: t.accent,
                            marginBottom: "0.5rem",
                            lineHeight: 1,
                          }}
                        />
                        <InlineText
                          as="h4"
                          value={s.label}
                          onUpdate={onFieldChange ? (v) => updateResultStat(i, "label", v) : undefined}
                          style={{
                            fontSize: "1.05rem",
                            fontWeight: 600,
                            marginBottom: "0.5rem",
                            color: t.headline,
                          }}
                        />
                        {s.caption && (
                          <p style={{ color: t.muted, fontSize: "0.85rem", lineHeight: 1.5 }}>
                            {s.caption}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Testimonial / Quote */}
          {showQuote && (props.quoteText || onFieldChange) && (
            <section
              id="testimonial"
              data-case-section
              style={{ ...sectionStyle, background: t.accentSoftBg }}
            >
              <div
                style={{
                  maxWidth: Math.min(t.maxWidth, 880),
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    margin: "0 auto 2rem",
                    width: "3.5rem",
                    height: "3.5rem",
                    borderRadius: "999px",
                    background: t.accent,
                    color: t.accentInk,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Quote size={22} fill="currentColor" />
                </div>
                <blockquote
                  style={{
                    fontFamily: t.displayFont,
                    fontSize: "clamp(1.4rem, 3vw, 2.25rem)",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                    color: t.headline,
                    margin: "0 0 2rem",
                  }}
                >
                  &ldquo;<InlineText as="span" value={props.quoteText ?? ""} onUpdate={field("quoteText")} multiline />&rdquo;
                </blockquote>
                {(props.quoteAuthor || portraitImg || onFieldChange) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        width: "3rem",
                        height: "3rem",
                        borderRadius: "999px",
                        overflow: "hidden",
                        background: portraitImg ? t.border : imageBg(t),
                        flexShrink: 0,
                      }}
                    >
                      {portraitImg && (
                        <img
                          src={portraitImg}
                          alt={props.quoteAuthor || "Author"}
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      {(props.quoteAuthor || onFieldChange) && (
                        <InlineText as="div" value={props.quoteAuthor ?? ""} onUpdate={field("quoteAuthor")} style={{ fontWeight: 700, color: t.ink }} />
                      )}
                      {(props.quoteRole || onFieldChange) && (
                        <InlineText as="div" value={props.quoteRole ?? ""} onUpdate={field("quoteRole")} style={{ fontSize: "0.85rem", color: t.muted }} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Deep-dive modules */}
          {hasModules && (
            <div style={{ background: t.panelBg }}>
              {(props.modulesHeading || true) && (
                <div
                  style={{
                    paddingTop: t.spacing * 0.6,
                    paddingBottom: t.spacing * 0.35,
                    paddingLeft: sectionPadX,
                    paddingRight: sectionPadX,
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      ...eyebrowStyle,
                    }}
                  >
                    <FileText size={15} />{" "}
                    <InlineText as="span" value={props.modulesHeading || "Deep Dive Modules"} onUpdate={field("modulesHeading")} />
                  </div>
                </div>
              )}

              {modules.map((m, i) => {
                const reverse = i % 2 === 1;
                return (
                  <section
                    key={i}
                    id={`module-${i + 1}`}
                    data-case-section
                    style={{ ...sectionStyle, background: t.cardBg }}
                  >
                    <div
                      className="bcm-module"
                      style={{
                        maxWidth: t.maxWidth,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: reverse ? "row-reverse" : "row",
                        gap: "4rem",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                        <SectionTitle
                          t={t}
                          number={numberFor[`module-${i + 1}`]}
                          title={m.heading || `Module ${i + 1}`}
                          small
                          onTitleChange={onFieldChange ? (v) => updateModule(i, "heading", v) : undefined}
                        />
                        {m.body && (
                          <InlineText
                            as="p"
                            value={m.body}
                            onUpdate={onFieldChange ? (v) => updateModule(i, "body", v) : undefined}
                            multiline
                            style={{
                              fontSize: "1.05rem",
                              lineHeight: 1.7,
                              color: t.muted,
                              whiteSpace: "pre-line",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ flex: "1 1 320px", minWidth: 0, width: "100%" }}>
                        <div
                          style={{
                            aspectRatio: "4 / 3",
                            borderRadius: t.radius,
                            overflow: "hidden",
                            background: m.imageUrl ? t.border : imageBg(t),
                          }}
                        >
                          {m.imageUrl && (
                            <img
                              src={m.imageUrl}
                              alt={m.heading || `Module ${i + 1}`}
                              loading="lazy"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* Gallery — dark */}
          {showGallery && galleryImages.length > 0 && (
            <section
              id="gallery"
              data-case-section
              style={{ ...sectionStyle, background: t.dark, color: t.headlineOnDark }}
            >
              <SectionTitle
                t={t}
                number={numberFor["gallery"]}
                title={props.galleryHeading || "Visual Artifacts"}
                onDark
                onTitleChange={field("galleryHeading")}
              />
              <div
                className="bcm-gallery-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  gap: "1.5rem",
                  maxWidth: t.maxWidth,
                }}
              >
                {galleryImages.map((img, i) => (
                  <figure key={i} style={{ margin: 0 }}>
                    <div
                      style={{
                        aspectRatio: "1 / 1",
                        borderRadius: t.radius,
                        overflow: "hidden",
                        background: img.url ? rgba(t.headlineOnDark, 0.1) : imageBg(t),
                        position: "relative",
                      }}
                    >
                      {img.url && (
                        <img
                          src={img.url}
                          alt={img.caption || ""}
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      )}
                    </div>
                    {img.caption && (
                      <figcaption
                        style={{
                          marginTop: "0.65rem",
                          fontSize: "0.8rem",
                          color: rgba(t.headlineOnDark, 0.6),
                        }}
                      >
                        {img.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* Key takeaways */}
          {showTakeaways && takeaways.length > 0 && (
            <section id="takeaways" data-case-section style={sectionStyle}>
              <SectionTitle
                t={t}
                number={numberFor["takeaways"]}
                title={props.takeawaysHeading || "Key Takeaways"}
                onTitleChange={field("takeawaysHeading")}
              />
              <div
                className="bcm-takeaways-grid"
                style={{
                  maxWidth: t.maxWidth,
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                  columnGap: "3rem",
                  rowGap: "2rem",
                }}
              >
                {takeaways.map((tk, i) => (
                  <div key={i} style={{ display: "flex", gap: "1rem" }}>
                    <div
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        flexShrink: 0,
                        background: t.accentSoftBg,
                        borderRadius: Math.min(t.radius, 10),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: t.accent,
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 size={18} />
                    </div>
                    <InlineText
                      as="p"
                      value={tk.text}
                      onUpdate={onFieldChange ? (v) => updateTakeaway(i, v) : undefined}
                      style={{
                        color: t.ink,
                        fontSize: "0.95rem",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Closing CTA band */}
          {showCta && (props.ctaHeading || props.ctaBody || props.ctaLabel || onFieldChange) && (
            <section
              id="cta"
              style={{
                paddingTop: t.spacing,
                paddingBottom: t.spacing,
                paddingLeft: sectionPadX,
                paddingRight: sectionPadX,
                background: t.accent,
                color: t.accentInk,
                textAlign: "center",
              }}
            >
              {(props.ctaHeading || onFieldChange) && (
                <InlineText
                  as="h2"
                  value={props.ctaHeading ?? ""}
                  onUpdate={field("ctaHeading")}
                  style={{
                    fontFamily: t.displayFont,
                    fontSize: "clamp(1.75rem, 4vw, 3rem)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    marginBottom: "1.5rem",
                    color: t.accentInk,
                  }}
                />
              )}
              {(props.ctaBody || onFieldChange) && (
                <InlineText
                  as="p"
                  value={props.ctaBody ?? ""}
                  onUpdate={field("ctaBody")}
                  multiline
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 300,
                    lineHeight: 1.6,
                    color: rgba(t.accentInk, 0.85),
                    maxWidth: 640,
                    margin: "0 auto 2.5rem",
                  }}
                />
              )}
              {props.ctaLabel && (
                <a
                  href={props.ctaUrl || "#top"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "1rem 2rem",
                    background: t.cardBg,
                    color: t.accent,
                    fontWeight: 600,
                    borderRadius: t.radius,
                    textDecoration: "none",
                  }}
                >
                  {props.ctaLabel} <ArrowRight size={18} />
                </a>
              )}
            </section>
          )}

          {/* Footer */}
          {showFooter && (
            <footer
              style={{
                paddingTop: t.spacing * 0.6,
                paddingBottom: t.spacing * 0.6,
                paddingLeft: sectionPadX,
                paddingRight: sectionPadX,
                background: t.dark,
                color: rgba(t.headlineOnDark, 0.5),
                borderTop: `1px solid ${rgba(t.headlineOnDark, 0.15)}`,
                fontSize: "0.85rem",
              }}
            >
              <div
                className="bcm-footer"
                style={{
                  maxWidth: t.maxWidth,
                  margin: "0 auto",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: t.headlineOnDark,
                  }}
                >
                  <Layers size={18} />
                  <InlineText as="span" value={brandName} onUpdate={field("brandName")} style={{ fontWeight: 600, letterSpacing: "0.04em" }} />
                </div>
                {(props.footerLinks ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                    {(props.footerLinks ?? []).map((link, i) => (
                      <a
                        key={i}
                        href={link.href}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
                <div>
                  {props.footerNote ||
                    `© ${new Date().getFullYear()} ${brandName}.`}
                </div>
              </div>
              {props.footerTagline && (
                <div
                  style={{
                    maxWidth: t.maxWidth,
                    margin: "1.25rem auto 0",
                    fontSize: "0.8rem",
                  }}
                >
                  {props.footerTagline}
                </div>
              )}
            </footer>
          )}
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .bcm-rail { display: none; }
        .bcm-mobile-nav { display: flex; }
        .bcm-metrics-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        @media (min-width: 768px) {
          .bcm-rail { display: flex; flex-direction: column; }
          .bcm-mobile-nav { display: none; }
          .bcm-metrics-grid { grid-template-columns: repeat(4, minmax(0,1fr)); }
        }
      `,
        }}
      />
    </div>
  );
}

function SectionTitle({
  t,
  number,
  title,
  eyebrow,
  onDark,
  small,
  onTitleChange,
  onEyebrowChange,
}: {
  t: ResolvedTokens;
  number?: string;
  title: string;
  eyebrow?: string;
  onDark?: boolean;
  small?: boolean;
  onTitleChange?: (v: string) => void;
  onEyebrowChange?: (v: string) => void;
}) {
  const headColor = onDark ? t.headlineOnDark : t.headline;
  return (
    <div style={{ marginBottom: small ? "1.5rem" : "2.5rem" }}>
      {(eyebrow || onEyebrowChange) && (
        <InlineText
          as="div"
          value={eyebrow ?? ""}
          onUpdate={onEyebrowChange}
          style={{
            fontSize: "0.625rem",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: t.accent,
            marginBottom: "0.75rem",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {number && (
          <span
            style={{
              fontFamily: t.displayFont,
              fontSize: small ? "1.5rem" : "2.25rem",
              fontWeight: 300,
              color: onDark ? rgba(t.headlineOnDark, 0.35) : rgba(t.ink, 0.25),
            }}
          >
            {number}
          </span>
        )}
        <InlineText
          as="h2"
          value={title}
          onUpdate={onTitleChange}
          style={{
            fontFamily: t.displayFont,
            fontSize: small ? "1.5rem" : `${1.85 * t.headingScale}rem`,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: headColor,
            margin: 0,
          }}
        />
      </div>
    </div>
  );
}

export default BlockCaseModular;
