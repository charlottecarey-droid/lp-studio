import React from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Globe,
  Layers,
  LineChart,
  Lock,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import type { CaseMetricsBlockProps, CaseApproachCard } from "@/lib/block-types";
import {
  resolveSectionSpacingPx,
  resolveContentMaxWidthPx,
  resolveRadiusPx,
  resolveHeadingScale,
} from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

// ── Icon mapping for approach cards ─────────────────────────────────────────
const APPROACH_ICONS: Record<string, React.FC<{ className?: string }>> = {
  database: Database,
  zap: Zap,
  shield: Shield,
  globe: Globe,
  lock: Lock,
  "bar-chart": BarChart3,
  "line-chart": LineChart,
  layers: Layers,
  sparkles: Sparkles,
};

function iconFor(key?: string, index = 0): React.FC<{ className?: string }> {
  if (key && APPROACH_ICONS[key]) return APPROACH_ICONS[key];
  const fallbacks = [Database, Zap, Shield, Globe, BarChart3, Layers];
  return fallbacks[index % fallbacks.length];
}

// ── Color helpers ───────────────────────────────────────────────────────────
function hexToRgb(hex?: string | null): [number, number, number] {
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

// Split a metric value into the numeric/leading part and a trailing unit so the
// unit can be accent-colored (e.g. "99.99%" → ["99.99", "%"], "12x" → ["12","x"]).
function splitMetric(value: string): [string, string] {
  const m = value.match(/^([\s\S]*?)([%x×+]|ms|s|hrs?|min|k|m|b|bn)?$/i);
  if (!m) return [value, ""];
  const head = m[1] ?? value;
  const unit = m[2] ?? "";
  if (!unit) return [value, ""];
  return [head, unit];
}

interface Props {
  props: CaseMetricsBlockProps;
  /** Tenant brand config. Drives default colors / fonts / brand name.
   *  Per-block props always win. */
  brand?: BrandConfig;
}

export function BlockCaseMetrics({ props, brand }: Props) {
  // ── Style tokens: prop ?? brand ?? hardcoded editorial default ─────────────
  const bg = props.bgColor ?? brand?.pageBackground ?? "#ffffff";
  const ink = props.inkColor ?? brand?.textColor ?? "#0f172a";
  const muted = props.mutedColor ?? "#475569";
  const accent = props.accentColor ?? brand?.accentColor ?? "#06b6d4";
  const accentInk = props.accentInkColor ?? "#020617";
  const dark = props.darkColor ?? "#020617";
  const headline = props.headlineColor ?? brand?.headingOnLightColor ?? ink;
  const headlineOnDark = props.headlineOnDarkColor ?? "#ffffff";
  const cardBg = props.cardBgColor ?? brand?.cardBackground ?? "#ffffff";
  const border = props.borderColor ?? brand?.borderColor ?? "#e2e8f0";

  const displayFont = props.displayFontFamily || brand?.displayFont || "Space Grotesk";
  const bodyFont = props.bodyFontFamily || brand?.bodyFont || "Inter";
  const display = `'${displayFont}', sans-serif`;
  const body = `'${bodyFont}', sans-serif`;
  const mono = "'Space Mono', ui-monospace, monospace";

  // ── Sizing tokens ─────────────────────────────────────────────────────────
  const sectionPad = resolveSectionSpacingPx(props.sectionSpacing);
  const maxW = resolveContentMaxWidthPx(props.contentWidth);
  const radius = resolveRadiusPx(props.cornerRadius);
  const hScale = resolveHeadingScale(props.headingScale);

  // ── Visibility ────────────────────────────────────────────────────────────
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

  // ── Content + neutral fallbacks ───────────────────────────────────────────
  const brandName = (props.brandName || brand?.brandName || "Acme").trim();
  const logoAlt = props.logoAlt || brandName;

  const navLinks = props.navLinks?.length
    ? props.navLinks
    : [
        { label: "Products", href: "#" },
        { label: "Solutions", href: "#" },
        { label: "Customers", href: "#" },
        { label: "Resources", href: "#" },
      ];
  const navCtaLabel = props.navCtaLabel || "Get Started";
  const navCtaUrl = props.navCtaUrl || "#";

  const heroEyebrow = props.heroEyebrow || "Customer Story";
  const clientName = props.clientName || "";
  const heroHeadline = props.heroHeadline || "A data-led transformation, by the numbers.";
  const heroSummary =
    props.heroSummary ||
    "Faced with exponential growth and aging infrastructure, the team rebuilt their core systems from the ground up — unlocking unprecedented throughput, major cost savings, and a modern stack ready for the next decade.";

  const metrics = props.metrics?.length
    ? props.metrics
    : [
        { value: "99.99%", label: "Uptime Maintained" },
        { value: "12x", label: "Throughput Increase" },
        { value: "45%", label: "Reduction in Costs" },
        { value: "<5ms", label: "P99 Latency" },
      ];

  const profile = props.profile?.length
    ? props.profile
    : [
        { label: "Industry", value: "Technology" },
        { label: "Company Size", value: "2,500+ Employees" },
        { label: "Headquarters", value: "Global" },
        { label: "Products Used", value: "Platform Suite" },
      ];

  const approachCards: CaseApproachCard[] = props.approachCards?.length
    ? props.approachCards
    : [
        {
          title: "Event Sourcing",
          body: "Legacy database writes were tapped and streamed in, providing a single source of truth for new services.",
          icon: "database",
        },
        {
          title: "Edge Compute",
          body: "Heavy calculations were pushed to the edge, drastically reducing round-trip latency.",
          icon: "zap",
        },
        {
          title: "Zero-Downtime Cutover",
          body: "Traffic was gradually shifted using shadow reads, verifying exact parity before full cutover.",
          icon: "shield",
        },
      ];

  const resultStats = props.resultStats?.length
    ? props.resultStats
    : [
        { value: "50M+", label: "Daily Operations", caption: "Processed seamlessly with zero dropped events." },
        { value: "1.2ms", label: "Average Latency", caption: "For complex calculations, down from 85ms." },
        { value: "45%", label: "Cost Reduction", caption: "Achieved by shifting compute to the edge." },
      ];

  const galleryImages = props.galleryImages ?? [];
  const modules = props.modules ?? [];
  const takeaways = props.takeaways ?? [];

  const footerLinks = props.footerLinks ?? [];
  const footerTagline =
    props.footerTagline ||
    "The platform for modern, data-driven teams. Scale effortlessly, decide instantly.";
  const footerNote = props.footerNote || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;

  // ── Shared sub-styles ─────────────────────────────────────────────────────
  const eyebrowStyle: React.CSSProperties = {
    fontFamily: mono,
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: muted,
  };
  const sectionStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    paddingTop: sectionPad,
    paddingBottom: sectionPad,
    paddingLeft: "1.5rem",
    paddingRight: "1.5rem",
    ...extra,
  });
  const containerStyle: React.CSSProperties = { maxWidth: maxW, marginLeft: "auto", marginRight: "auto" };

  const Placeholder = ({ rounded = radius }: { rounded?: number }) => (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        borderRadius: rounded,
        background: `linear-gradient(135deg, ${rgba(accent, 0.18)}, ${rgba(dark, 0.12)})`,
      }}
    />
  );

  return (
    <div style={{ background: bg, color: ink, fontFamily: body }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=${displayFont.replace(
            /\s+/g,
            "+",
          )}:wght@400;500;600;700&family=${bodyFont.replace(
            /\s+/g,
            "+",
          )}:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');`,
        }}
      />

      {/* 1. Nav */}
      {showNav && (
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            width: "100%",
            background: rgba(dark, 0.85),
            color: headlineOnDark,
            borderBottom: `1px solid ${rgba("#ffffff", 0.1)}`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              ...containerStyle,
              maxWidth: 1280,
              height: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingLeft: "1.5rem",
              paddingRight: "1.5rem",
            }}
          >
            <a href="#top" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: headlineOnDark }}>
              {props.logoUrl ? (
                <img src={props.logoUrl} alt={logoAlt} style={{ height: 28, width: "auto" }} />
              ) : (
                <>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      background: accent,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Zap className="w-5 h-5" style={{ color: accentInk }} />
                  </span>
                  <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
                    {brandName}
                  </span>
                </>
              )}
            </a>
            <div className="hidden md:flex" style={{ alignItems: "center", gap: "2rem", fontSize: "0.875rem", fontWeight: 500 }}>
              {navLinks.map((l, i) => (
                <a
                  key={`${l.label}-${i}`}
                  href={l.href || "#"}
                  style={{ color: rgba("#ffffff", 0.72), textDecoration: "none" }}
                >
                  {l.label}
                </a>
              ))}
            </div>
            <a
              href={navCtaUrl}
              style={{
                background: accent,
                color: accentInk,
                padding: "0.625rem 1.25rem",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {navCtaLabel}
            </a>
          </div>
        </nav>
      )}

      {/* 2. Hero band + metric row */}
      {(showHero || showMetrics) && (
        <header
          id="top"
          style={{
            background: dark,
            color: headlineOnDark,
            paddingTop: sectionPad,
            paddingBottom: sectionPad + 32,
            paddingLeft: "1.5rem",
            paddingRight: "1.5rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 800,
              height: 800,
              background: rgba(accent, 0.1),
              borderRadius: 999,
              filter: "blur(120px)",
              transform: "translate(33%, -50%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ ...containerStyle, maxWidth: 1280, position: "relative", zIndex: 10 }}>
            {showHero && (
              <div style={{ maxWidth: 760, marginBottom: "5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem", flexWrap: "wrap" }}>
                  <span style={{ ...eyebrowStyle, color: accent }}>{heroEyebrow}</span>
                  {clientName && (
                    <>
                      <span style={{ width: 32, height: 1, background: rgba(accent, 0.5) }} />
                      <span style={{ ...eyebrowStyle, color: rgba("#ffffff", 0.6) }}>{clientName}</span>
                    </>
                  )}
                </div>
                <h1
                  style={{
                    fontFamily: display,
                    fontSize: `${3.25 * hScale}rem`,
                    fontWeight: 700,
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                    marginBottom: "2rem",
                    color: headlineOnDark,
                  }}
                >
                  {heroHeadline}
                </h1>
                <p style={{ fontSize: "1.25rem", color: rgba("#ffffff", 0.78), lineHeight: 1.6, maxWidth: 640 }}>
                  {heroSummary}
                </p>
                {props.heroCtaLabel && (
                  <a
                    href={props.heroCtaUrl || "#"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginTop: "2.5rem",
                      background: accent,
                      color: accentInk,
                      padding: "0.9rem 1.75rem",
                      borderRadius: 999,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {props.heroCtaLabel}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {showMetrics && (
              <>
                {props.metricsHeading && (
                  <h2 style={{ ...eyebrowStyle, color: rgba("#ffffff", 0.6), marginBottom: "1rem" }}>
                    {props.metricsHeading}
                  </h2>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 1,
                    background: rgba("#ffffff", 0.1),
                    borderRadius: Math.max(radius, 8),
                    overflow: "hidden",
                    border: `1px solid ${rgba("#ffffff", 0.1)}`,
                  }}
                  className="md:[grid-template-columns:repeat(4,minmax(0,1fr))]"
                >
                  {metrics.map((m, i) => {
                    const [head, unit] = splitMetric(m.value);
                    return (
                      <div key={`${m.label}-${i}`} style={{ background: rgba(dark, 0.85), padding: "2rem" }}>
                        <div style={{ fontFamily: mono, fontSize: "2.75rem", fontWeight: 700, color: headlineOnDark, marginBottom: "0.5rem", lineHeight: 1 }}>
                          {head}
                          {unit && <span style={{ color: accent }}>{unit}</span>}
                        </div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: rgba("#ffffff", 0.6), textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {m.label}
                        </div>
                        {m.caption && (
                          <div style={{ fontSize: "0.8rem", color: rgba("#ffffff", 0.45), marginTop: "0.5rem" }}>{m.caption}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </header>
      )}

      {/* 3. At-a-glance / customer profile */}
      {showAtAGlance && (
        <section style={{ borderBottom: `1px solid ${border}` }}>
          <div
            style={{
              ...containerStyle,
              maxWidth: 1280,
              paddingLeft: "1.5rem",
              paddingRight: "1.5rem",
              paddingTop: Math.round(sectionPad / 2),
              paddingBottom: Math.round(sectionPad / 2),
              display: "flex",
              flexWrap: "wrap",
              gap: "3rem",
            }}
          >
            <div style={{ flex: "1 1 240px" }}>
              <h3 style={{ ...eyebrowStyle, fontSize: "0.7rem", marginBottom: "1rem" }}>
                {props.atAGlanceHeading || "About the Company"}
              </h3>
              <p style={{ color: muted, lineHeight: 1.6 }}>
                {heroSummary}
              </p>
            </div>
            <div
              style={{
                flex: "2 1 480px",
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "2rem",
              }}
              className="md:[grid-template-columns:repeat(4,minmax(0,1fr))]"
            >
              {profile.map((row, i) => (
                <div key={`${row.label}-${i}`}>
                  <div style={{ ...eyebrowStyle, fontSize: "0.7rem", marginBottom: "0.5rem" }}>{row.label}</div>
                  <div style={{ fontWeight: 600, color: headline }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. The Challenge */}
      {showChallenge && (
        <section style={{ ...sectionStyle(), borderBottom: `1px solid ${border}` }}>
          <div
            style={{
              ...containerStyle,
              maxWidth: 1280,
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "4rem",
              alignItems: "center",
            }}
            className="lg:[grid-template-columns:5fr_7fr]"
          >
            <div>
              {props.challengeEyebrow && (
                <div style={{ ...eyebrowStyle, color: accent, marginBottom: "1rem" }}>{props.challengeEyebrow}</div>
              )}
              <h2
                style={{
                  fontFamily: display,
                  fontSize: `${2.25 * hScale}rem`,
                  fontWeight: 700,
                  marginBottom: "1.5rem",
                  color: headline,
                  lineHeight: 1.1,
                }}
              >
                {props.challengeHeading || "The Challenge"}
              </h2>
              <div style={{ fontSize: "1.125rem", color: muted, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {props.challengeBody ||
                  "Rapid growth pushed the existing infrastructure past its limits. The team needed a complete architectural shift without pausing feature delivery."}
              </div>
            </div>
            <div style={{ aspectRatio: "4 / 3", borderRadius: radius, overflow: "hidden", background: rgba(accent, 0.08) }}>
              {props.challengeImageUrl ? (
                <img
                  src={props.challengeImageUrl}
                  alt={props.challengeHeading || "Challenge"}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Placeholder />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. The Approach */}
      {showApproach && (
        <section style={{ ...sectionStyle({ background: rgba(ink, 0.03) }), borderBottom: `1px solid ${border}` }}>
          <div style={{ ...containerStyle, maxWidth: 1280 }}>
            <div style={{ maxWidth: 720, marginBottom: "4rem" }}>
              {props.approachEyebrow && (
                <div style={{ ...eyebrowStyle, color: accent, marginBottom: "1rem" }}>{props.approachEyebrow}</div>
              )}
              <h2
                style={{
                  fontFamily: display,
                  fontSize: `${2.25 * hScale}rem`,
                  fontWeight: 700,
                  marginBottom: "1.5rem",
                  color: headline,
                  lineHeight: 1.1,
                }}
              >
                {props.approachHeading || "The Approach"}
              </h2>
              {props.approachBody && (
                <p style={{ fontSize: "1.125rem", color: muted, lineHeight: 1.7 }}>{props.approachBody}</p>
              )}
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}
              className="md:[grid-template-columns:repeat(3,minmax(0,1fr))]"
            >
              {approachCards.map((card, i) => {
                const Icon = iconFor(card.icon, i);
                return (
                  <div
                    key={`${card.title}-${i}`}
                    style={{
                      background: cardBg,
                      padding: "2rem",
                      borderRadius: radius,
                      border: `1px solid ${border}`,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: Math.max(radius - 2, 8),
                        background: rgba(accent, 0.12),
                        color: accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 style={{ fontFamily: display, fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem", color: headline }}>
                      {card.title}
                    </h3>
                    <p style={{ color: muted, lineHeight: 1.6 }}>{card.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 6. The Results */}
      {showResults && (
        <section style={{ ...sectionStyle(), borderBottom: `1px solid ${border}` }}>
          <div style={{ ...containerStyle, maxWidth: 1280 }}>
            {props.resultsEyebrow && (
              <div style={{ ...eyebrowStyle, color: accent, marginBottom: "1rem", textAlign: "center" }}>
                {props.resultsEyebrow}
              </div>
            )}
            <h2
              style={{
                fontFamily: display,
                fontSize: `${2.25 * hScale}rem`,
                fontWeight: 700,
                marginBottom: props.resultsBody ? "1.25rem" : "4rem",
                textAlign: "center",
                color: headline,
              }}
            >
              {props.resultsHeading || "The Results"}
            </h2>
            {props.resultsBody && (
              <p style={{ fontSize: "1.125rem", color: muted, lineHeight: 1.7, textAlign: "center", maxWidth: 720, margin: "0 auto 4rem" }}>
                {props.resultsBody}
              </p>
            )}
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3rem", textAlign: "center" }}
              className="md:[grid-template-columns:repeat(3,minmax(0,1fr))]"
            >
              {resultStats.map((s, i) => (
                <div key={`${s.label}-${i}`}>
                  <div style={{ fontFamily: mono, fontSize: "3.5rem", fontWeight: 700, color: headline, marginBottom: "1rem", letterSpacing: "-0.03em", lineHeight: 1 }}>
                    {s.value}
                  </div>
                  <h3 style={{ fontFamily: display, fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem", color: headline }}>
                    {s.label}
                  </h3>
                  {s.caption && <p style={{ color: muted, lineHeight: 1.6 }}>{s.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. Pull quote / testimonial */}
      {showQuote && props.quoteText && (
        <section style={{ background: rgba(dark, 0.96), color: headlineOnDark, paddingTop: sectionPad, paddingBottom: sectionPad, paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <div
            style={{
              maxWidth: 960,
              marginLeft: "auto",
              marginRight: "auto",
              display: "flex",
              flexWrap: "wrap",
              gap: "3rem",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 192,
                height: 192,
                flexShrink: 0,
                borderRadius: 999,
                overflow: "hidden",
                border: `4px solid ${rgba(accent, 0.3)}`,
                background: rgba(accent, 0.12),
              }}
            >
              {props.quotePortraitUrl ? (
                <img
                  src={props.quotePortraitUrl}
                  alt={props.quoteAuthor || "Portrait"}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Placeholder rounded={999} />
              )}
            </div>
            <div style={{ flex: "1 1 360px" }}>
              <svg width="48" height="48" viewBox="0 0 32 32" fill={accent} style={{ marginBottom: "1.5rem", opacity: 0.5 }} aria-hidden>
                <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2h2V8h-2zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2h2V8h-2z" />
              </svg>
              <blockquote
                style={{
                  fontFamily: display,
                  fontSize: "1.75rem",
                  fontWeight: 500,
                  lineHeight: 1.45,
                  marginBottom: "2rem",
                  color: headlineOnDark,
                }}
              >
                {props.quoteText}
              </blockquote>
              {(props.quoteAuthor || props.quoteRole) && (
                <div>
                  {props.quoteAuthor && (
                    <div style={{ fontFamily: display, fontWeight: 700, fontSize: "1.125rem" }}>{props.quoteAuthor}</div>
                  )}
                  {props.quoteRole && (
                    <div style={{ fontFamily: mono, fontSize: "0.875rem", color: accent, marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {props.quoteRole}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 8. Image gallery */}
      {showGallery && galleryImages.length > 0 && (
        <section style={{ ...sectionStyle() }}>
          <div style={{ ...containerStyle, maxWidth: 1280 }}>
            {props.galleryHeading && (
              <h2 style={{ fontFamily: display, fontSize: `${2 * hScale}rem`, fontWeight: 700, marginBottom: "3rem", color: headline }}>
                {props.galleryHeading}
              </h2>
            )}
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}
              className="md:[grid-template-columns:repeat(3,minmax(0,1fr))]"
            >
              {galleryImages.map((img, i) => (
                <figure key={`${img.url}-${i}`} style={{ margin: 0 }}>
                  <div style={{ aspectRatio: "1 / 1", borderRadius: radius, overflow: "hidden", background: rgba(accent, 0.08) }}>
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.caption || "Gallery image"}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Placeholder />
                    )}
                  </div>
                  {img.caption && (
                    <figcaption style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: muted }}>{img.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 9. Repeatable deep-dive modules */}
      {showModules && modules.length > 0 && (
        <section style={{ ...sectionStyle({ background: rgba(ink, 0.03) }), borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
          <div style={{ ...containerStyle, maxWidth: 1280 }}>
            {props.modulesHeading && (
              <h2 style={{ fontFamily: display, fontSize: `${2 * hScale}rem`, fontWeight: 700, marginBottom: "3rem", color: headline, textAlign: "center" }}>
                {props.modulesHeading}
              </h2>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "5rem" }}>
              {modules.map((mod, i) => {
                const reverse = i % 2 === 1;
                return (
                  <div
                    key={`${mod.heading}-${i}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: "4rem",
                      alignItems: "center",
                    }}
                    className="lg:[grid-template-columns:repeat(2,minmax(0,1fr))]"
                  >
                    <div style={{ order: reverse ? 2 : 1 }}>
                      <h3 style={{ fontFamily: display, fontSize: `${1.75 * hScale}rem`, fontWeight: 700, marginBottom: "1.5rem", color: headline, lineHeight: 1.15 }}>
                        {mod.heading}
                      </h3>
                      <div style={{ color: muted, lineHeight: 1.7, whiteSpace: "pre-line" }}>{mod.body}</div>
                    </div>
                    <div style={{ order: reverse ? 1 : 2, aspectRatio: "4 / 3", borderRadius: radius, overflow: "hidden", background: rgba(accent, 0.08) }}>
                      {mod.imageUrl ? (
                        <img
                          src={mod.imageUrl}
                          alt={mod.heading}
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Placeholder />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 10. Key takeaways */}
      {showTakeaways && takeaways.length > 0 && (
        <section style={{ ...sectionStyle() }}>
          <div style={{ maxWidth: 880, marginLeft: "auto", marginRight: "auto" }}>
            <h2 style={{ fontFamily: display, fontSize: `${2 * hScale}rem`, fontWeight: 700, marginBottom: "3rem", textAlign: "center", color: headline }}>
              {props.takeawaysHeading || "Key Takeaways"}
            </h2>
            <div
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: Math.max(radius, 16),
                padding: "2.5rem",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {takeaways.map((t, i) => (
                  <li key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        borderRadius: 999,
                        background: rgba(accent, 0.12),
                        color: accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: mono,
                        fontWeight: 700,
                        fontSize: "0.85rem",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", color: ink, lineHeight: 1.6 }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
                      <span>{t.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* 11. CTA band */}
      {showCta && (
        <section style={{ background: accent, paddingTop: sectionPad, paddingBottom: sectionPad, paddingLeft: "1.5rem", paddingRight: "1.5rem", textAlign: "center" }}>
          <div style={{ maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
            <h2 style={{ fontFamily: display, fontSize: `${2.75 * hScale}rem`, fontWeight: 700, color: accentInk, marginBottom: "1.5rem", lineHeight: 1.1 }}>
              {props.ctaHeading || "Ready to see what's possible?"}
            </h2>
            <p style={{ fontSize: "1.25rem", color: rgba(accentInk, 0.8), marginBottom: "2.5rem", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
              {props.ctaBody || "Join the teams building the future on a faster, more reliable foundation."}
            </p>
            <a
              href={props.ctaUrl || "#"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                background: dark,
                color: headlineOnDark,
                padding: "1rem 2rem",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: "1.05rem",
                textDecoration: "none",
              }}
            >
              {props.ctaLabel || "Get Started"}
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </section>
      )}

      {/* 12. Footer */}
      {showFooter && (
        <footer style={{ background: dark, color: rgba("#ffffff", 0.6), paddingTop: Math.round(sectionPad * 0.66), paddingBottom: Math.round(sectionPad * 0.66), paddingLeft: "1.5rem", paddingRight: "1.5rem", borderTop: `1px solid ${rgba("#ffffff", 0.1)}` }}>
          <div style={{ ...containerStyle, maxWidth: 1280 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3rem", justifyContent: "space-between", marginBottom: "3rem" }}>
              <div style={{ maxWidth: 320 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                  {props.logoUrl ? (
                    <img src={props.logoUrl} alt={logoAlt} style={{ height: 24, width: "auto" }} />
                  ) : (
                    <>
                      <span style={{ width: 24, height: 24, background: accent, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Zap className="w-3 h-3" style={{ color: accentInk }} />
                      </span>
                      <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.125rem", color: headlineOnDark, letterSpacing: "-0.01em" }}>
                        {brandName}
                      </span>
                    </>
                  )}
                </div>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{footerTagline}</p>
              </div>
              {footerLinks.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "3rem" }}>
                  {footerLinks.map((l, i) => (
                    <a key={`${l.label}-${i}`} href={l.href || "#"} style={{ fontSize: "0.875rem", color: rgba("#ffffff", 0.6), textDecoration: "none" }}>
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${rgba("#ffffff", 0.1)}`, paddingTop: "2rem", fontSize: "0.8rem", color: rgba("#ffffff", 0.45) }}>
              {footerNote}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default BlockCaseMetrics;
