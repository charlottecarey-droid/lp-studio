import { useMemo } from "react";
import {
  ArrowRight,
  Quote,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
} from "lucide-react";
import type { CaseEditorialBlockProps } from "@/lib/block-types";
import {
  resolveSectionSpacingPx,
  resolveContentMaxWidthPx,
  resolveRadiusPx,
  resolveHeadingScale,
} from "@/lib/block-types";
import type { BrandConfig } from "../lib/brand-config";
import { toFontFamilyValue } from "../lib/font-catalog";
import { useBlockFonts } from "../lib/use-block-fonts";

// ── Editorial defaults (tenant-neutral) ─────────────────────────────────────
const ED = {
  bg: "#F9F8F6",
  ink: "#1A1A1A",
  muted: "#666666",
  border: "#E5E5E5",
  dark: "#1A1A1A",
  card: "#FFFFFF",
  display: "Playfair Display",
  body: "Inter",
};

interface Props {
  props: CaseEditorialBlockProps;
  /** Tenant brand config. Drives default colors/fonts; per-block props win. */
  brand?: BrandConfig;
  onFieldChange?: (updated: CaseEditorialBlockProps) => void;
}

/** Neutral gradient placeholder used when an image URL is absent. */
function Placeholder({
  ratio,
  radius,
  border,
}: {
  ratio: string;
  radius: number;
  border: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        aspectRatio: ratio,
        width: "100%",
        borderRadius: radius,
        border: `1px solid ${border}`,
        background:
          "linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 45%, rgba(0,0,0,0.07) 100%)",
      }}
    />
  );
}

function EditorialImage({
  url,
  alt,
  ratio,
  radius,
  border,
  lazy = true,
  className,
}: {
  url?: string;
  alt: string;
  ratio: string;
  radius: number;
  border: string;
  lazy?: boolean;
  className?: string;
}) {
  if (!url) return <Placeholder ratio={ratio} radius={radius} border={border} />;
  return (
    <div
      className={className}
      style={{
        aspectRatio: ratio,
        width: "100%",
        overflow: "hidden",
        borderRadius: radius,
      }}
    >
      <img
        src={url}
        alt={alt}
        loading={lazy ? "lazy" : undefined}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

export function BlockCaseEditorial({ props, brand }: Props) {
  // ── Style tokens: prop ?? brand ?? editorial default ──────────────────────
  const bg = props.bgColor ?? brand?.pageBackground ?? ED.bg;
  const ink = props.inkColor ?? brand?.textColor ?? ED.ink;
  const muted = props.mutedColor ?? ED.muted;
  const border = props.borderColor ?? brand?.borderColor ?? ED.border;
  const dark = props.darkColor ?? ED.dark;
  const card = props.cardBgColor ?? brand?.cardBackground ?? ED.card;
  const accent = props.accentColor ?? brand?.accentColor ?? ink;
  const headline = props.headlineColor ?? brand?.headingOnLightColor ?? ink;
  const headlineOnDark = props.headlineOnDarkColor ?? "#FFFFFF";

  const displayFamily =
    props.displayFontFamily?.trim() || brand?.displayFont?.trim() || ED.display;
  const bodyFamily =
    props.bodyFontFamily?.trim() || brand?.bodyFont?.trim() || ED.body;

  const fontSerif = toFontFamilyValue(displayFamily, "display") ?? `'${displayFamily}', serif`;
  const fontSans = toFontFamilyValue(bodyFamily, "sans") ?? `'${bodyFamily}', sans-serif`;
  useBlockFonts(fontSerif, fontSans);

  // ── Spacing / sizing tokens via resolve* helpers ──────────────────────────
  const sectionPx = resolveSectionSpacingPx(props.sectionSpacing);
  const maxW = resolveContentMaxWidthPx(props.contentWidth);
  const radius = resolveRadiusPx(props.cornerRadius);
  const hScale = resolveHeadingScale(props.headingScale);

  const sectionPadY = `${sectionPx}px`;
  const wideMax = Math.max(maxW, 1120);
  const narrowMax = Math.min(maxW, 768);

  // ── Section visibility (absent => visible) ────────────────────────────────
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

  // ── Content ───────────────────────────────────────────────────────────────
  const brandName = props.brandName?.trim() || "Studio";
  const navLinks = props.navLinks ?? [];
  const navCtaLabel = props.navCtaLabel;
  const navCtaUrl = props.navCtaUrl || "#";

  const metrics = props.metrics ?? [];
  const profile = props.profile ?? [];
  const approachCards = props.approachCards ?? [];
  const resultStats = props.resultStats ?? [];
  const galleryImages = props.galleryImages ?? [];
  const modules = props.modules ?? [];
  const takeaways = props.takeaways ?? [];
  const footerLinks = props.footerLinks ?? [];

  // Hero meta line (eyebrow already shown above headline)
  const heroMeta = useMemo(() => {
    const parts: string[] = [];
    if (props.clientName?.trim()) parts.push(props.clientName.trim());
    return parts;
  }, [props.clientName]);

  const year = new Date().getFullYear();

  return (
    <div
      style={{
        backgroundColor: bg,
        color: ink,
        fontFamily: fontSans,
        minHeight: "100vh",
      }}
      className="selection:bg-black selection:text-white"
    >
      {/* 1. Minimal Nav */}
      {showNav && (
        <nav style={{ borderBottom: `1px solid ${border}` }}>
          <div
            className="mx-auto px-6 h-20 flex items-center justify-between"
            style={{ maxWidth: wideMax }}
          >
            <div className="flex items-center gap-12">
              {props.logoUrl ? (
                <img
                  src={props.logoUrl}
                  alt={props.logoAlt || brandName}
                  style={{ height: "1.6rem", width: "auto" }}
                />
              ) : (
                <span
                  style={{ fontFamily: fontSerif, color: headline }}
                  className="text-2xl font-bold tracking-tight"
                >
                  {brandName}
                </span>
              )}
              {navLinks.length > 0 && (
                <div
                  className="hidden md:flex gap-8 text-sm uppercase tracking-widest"
                  style={{ color: muted }}
                >
                  {navLinks.map((l, i) => (
                    <a
                      key={`${l.label}-${i}`}
                      href={l.href || "#"}
                      className="transition-colors"
                      style={{ color: muted }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {navCtaLabel && (
              <a
                href={navCtaUrl}
                className="hidden md:flex items-center gap-2 text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
                style={{ color: ink }}
              >
                {navCtaLabel} <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </nav>
      )}

      {/* 2. Hero */}
      {showHero && (
        <header style={{ paddingTop: sectionPadY, paddingBottom: `${sectionPx * 0.66}px` }} className="px-6">
          <div className="mx-auto text-center mb-16" style={{ maxWidth: 896 }}>
            {props.heroEyebrow && (
              <div
                className="text-sm uppercase mb-8"
                style={{ color: muted, letterSpacing: "0.2em" }}
              >
                {props.heroEyebrow}
              </div>
            )}
            <h1
              style={{
                fontFamily: fontSerif,
                color: headline,
                lineHeight: 1.1,
                fontSize: `clamp(2.75rem, 6vw, ${5 * hScale}rem)`,
                marginBottom: "3rem",
              }}
            >
              {props.heroHeadline}
            </h1>
            {heroMeta.length > 0 && (
              <div
                className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm tracking-wider uppercase"
                style={{ color: muted }}
              >
                {heroMeta.map((m, i) => (
                  <span key={i}>{m}</span>
                ))}
              </div>
            )}
          </div>
          <div className="mx-auto" style={{ maxWidth: wideMax }}>
            <EditorialImage
              url={props.heroImageUrl}
              alt={props.heroHeadline}
              ratio="16 / 9"
              radius={radius}
              border={border}
              lazy={false}
            />
          </div>
        </header>
      )}

      {/* 3. Summary / Standfirst + 3b. Inline Metric Strip */}
      {showMetrics && (
        <section
          className="px-6 mx-auto"
          style={{ paddingTop: sectionPadY, paddingBottom: sectionPadY, maxWidth: narrowMax }}
        >
          {props.heroSummary && (
            <p
              style={{
                fontFamily: fontSerif,
                fontSize: "1.75rem",
                lineHeight: 1.6,
                color: ink,
                marginBottom: "4rem",
              }}
              className="first-letter:float-left first-letter:text-7xl first-letter:pr-4 first-letter:font-bold first-letter:leading-[0.8]"
            >
              {props.heroSummary}
            </p>
          )}
          {metrics.length > 0 && (
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10"
              style={{ borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}
            >
              {metrics.map((m, i) => (
                <div key={i}>
                  <div className="text-3xl mb-2" style={{ fontFamily: fontSerif, color: headline }}>
                    {m.value}
                  </div>
                  <div className="text-xs uppercase tracking-widest" style={{ color: muted }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. At a Glance (profile table) */}
      {showAtAGlance && profile.length > 0 && (
        <section
          className="px-6 mx-auto"
          style={{ paddingTop: sectionPadY, paddingBottom: sectionPadY, maxWidth: narrowMax }}
        >
          {props.atAGlanceHeading && (
            <h2
              style={{ fontFamily: fontSerif, color: headline }}
              className="text-3xl mb-10"
            >
              {props.atAGlanceHeading}
            </h2>
          )}
          <dl>
            {profile.map((row, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-8 py-5"
                style={{ borderTop: i === 0 ? `1px solid ${border}` : "none", borderBottom: `1px solid ${border}` }}
              >
                <dt
                  className="text-xs uppercase tracking-widest sm:w-48 shrink-0"
                  style={{ color: muted }}
                >
                  {row.label}
                </dt>
                <dd className="text-lg" style={{ color: ink }}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 5. The Challenge */}
      {showChallenge && (
        <section
          className="px-6 mx-auto grid grid-cols-1 md:grid-cols-12 gap-16 items-start"
          style={{ paddingTop: sectionPadY, paddingBottom: sectionPadY, maxWidth: wideMax }}
        >
          <div className="md:col-span-5 md:sticky" style={{ top: "2.5rem" }}>
            {props.challengeEyebrow && (
              <div
                className="text-sm uppercase tracking-widest mb-4 font-semibold"
                style={{ color: muted }}
              >
                {props.challengeEyebrow}
              </div>
            )}
            <h2 style={{ fontFamily: fontSerif, color: headline }} className="text-4xl mb-6">
              {props.challengeHeading || "The Challenge"}
            </h2>
            {props.challengeBody && (
              <p className="text-lg leading-relaxed" style={{ color: muted }}>
                {props.challengeBody}
              </p>
            )}
          </div>
          <div className="md:col-span-7">
            <EditorialImage
              url={props.challengeImageUrl}
              alt={props.challengeHeading || "The Challenge"}
              ratio="4 / 3"
              radius={radius}
              border={border}
            />
          </div>
        </section>
      )}

      {/* 6. The Approach */}
      {showApproach && (
        <section
          className="px-6 mx-auto"
          style={{ paddingTop: sectionPadY, paddingBottom: sectionPadY, maxWidth: narrowMax }}
        >
          <div className="text-center">
            {props.approachEyebrow && (
              <div
                className="text-sm uppercase tracking-widest mb-4 font-semibold"
                style={{ color: muted }}
              >
                {props.approachEyebrow}
              </div>
            )}
            <h2 style={{ fontFamily: fontSerif, color: headline }} className="text-4xl mb-12">
              {props.approachHeading || "The Approach"}
            </h2>
          </div>
          {props.approachBody && (
            <p className="text-lg leading-relaxed text-left mb-16" style={{ color: muted }}>
              {props.approachBody}
            </p>
          )}
          {approachCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {approachCards.map((c, i) => (
                <div key={i}>
                  <div
                    className="text-2xl mb-4"
                    style={{ fontFamily: fontSerif, color: accent, opacity: 0.6 }}
                  >
                    {String(i + 1).padStart(2, "0")}.
                  </div>
                  <h4 className="text-lg font-semibold mb-3" style={{ color: ink }}>
                    {c.title}
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: muted }}>
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 7. The Results / Impact */}
      {showResults && (
        <section
          className="px-6"
          style={{
            paddingTop: sectionPadY,
            paddingBottom: sectionPadY,
            backgroundColor: card,
            borderTop: `1px solid ${border}`,
            borderBottom: `1px solid ${border}`,
          }}
        >
          <div
            className="mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center"
            style={{ maxWidth: wideMax }}
          >
            <div>
              {props.resultsEyebrow && (
                <div
                  className="text-sm uppercase tracking-widest mb-4 font-semibold"
                  style={{ color: muted }}
                >
                  {props.resultsEyebrow}
                </div>
              )}
              <h2 style={{ fontFamily: fontSerif, color: headline }} className="text-4xl mb-6">
                {props.resultsHeading || "The Impact"}
              </h2>
              {props.resultsBody && (
                <p className="text-lg leading-relaxed" style={{ color: muted }}>
                  {props.resultsBody}
                </p>
              )}
            </div>
            {resultStats.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {resultStats.map((s, i) => (
                  <div key={i} className="p-8" style={{ backgroundColor: bg, borderRadius: radius }}>
                    <div className="text-4xl mb-4" style={{ fontFamily: fontSerif, color: headline }}>
                      {s.value}
                    </div>
                    <div
                      className="text-sm uppercase tracking-widest mb-2 font-semibold"
                      style={{ color: ink }}
                    >
                      {s.label}
                    </div>
                    {s.caption && (
                      <div className="text-sm" style={{ color: muted }}>
                        {s.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 8. Testimonial / Pull Quote */}
      {showQuote && props.quoteText && (
        <section className="flex flex-col md:flex-row" style={{ minHeight: "80vh" }}>
          <div
            className="w-full md:w-1/2 p-12 md:p-24 flex flex-col justify-center"
            style={{ backgroundColor: dark, color: headlineOnDark }}
          >
            <Quote className="w-10 h-10 mb-10" style={{ opacity: 0.3, color: headlineOnDark }} />
            <p
              style={{ fontFamily: fontSerif, lineHeight: 1.15, color: headlineOnDark }}
              className="text-3xl md:text-5xl mb-12"
            >
              {props.quoteText}
            </p>
            {(props.quoteAuthor || props.quoteRole) && (
              <div>
                {props.quoteAuthor && (
                  <div className="font-bold tracking-widest uppercase text-sm mb-1">
                    {props.quoteAuthor}
                  </div>
                )}
                {props.quoteRole && (
                  <div className="text-sm" style={{ opacity: 0.7 }}>
                    {props.quoteRole}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="w-full md:w-1/2 relative" style={{ minHeight: "50vh" }}>
            {props.quotePortraitUrl ? (
              <img
                src={props.quotePortraitUrl}
                alt={props.quoteAuthor || "Portrait"}
                loading="lazy"
                className="absolute inset-0"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.25) 100%)",
                  backgroundColor: dark,
                }}
              />
            )}
          </div>
        </section>
      )}

      {/* 9. Image Gallery */}
      {showGallery && galleryImages.length > 0 && (
        <section
          className="px-6 mx-auto"
          style={{ paddingTop: sectionPadY, paddingBottom: sectionPadY, maxWidth: wideMax }}
        >
          {props.galleryHeading && (
            <div className="text-center mb-16">
              <h2 style={{ fontFamily: fontSerif, color: headline }} className="text-3xl">
                {props.galleryHeading}
              </h2>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {galleryImages.map((g, i) => (
              <figure key={i} className="flex flex-col gap-4">
                <EditorialImage
                  url={g.url}
                  alt={g.caption || ""}
                  ratio={i % 3 === 1 ? "3 / 4" : "4 / 3"}
                  radius={radius}
                  border={border}
                />
                {g.caption && (
                  <figcaption className="text-sm italic" style={{ color: muted }}>
                    {g.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 10. Deep-dive Modules / Chapters */}
      {showModules && modules.length > 0 && (
        <section
          className="px-6 mx-auto"
          style={{ paddingTop: sectionPadY, paddingBottom: sectionPadY, maxWidth: 896 }}
        >
          {props.modulesHeading && (
            <h2
              style={{ fontFamily: fontSerif, color: headline }}
              className="text-4xl mb-16 text-center"
            >
              {props.modulesHeading}
            </h2>
          )}
          <div className="flex flex-col gap-20">
            {modules.map((m, i) => (
              <article
                key={i}
                style={{ borderTop: i > 0 ? `1px solid ${border}` : "none", paddingTop: i > 0 ? sectionPadY : 0 }}
              >
                <h3
                  className="text-sm uppercase tracking-widest mb-6 font-semibold"
                  style={{ color: muted }}
                >
                  {`Chapter ${String(i + 1).padStart(2, "0")}`}
                </h3>
                <h2 style={{ fontFamily: fontSerif, color: headline }} className="text-4xl mb-8">
                  {m.heading}
                </h2>
                <div className="mb-8">
                  <EditorialImage
                    url={m.imageUrl}
                    alt={m.heading}
                    ratio={i % 2 === 0 ? "16 / 9" : "4 / 3"}
                    radius={radius}
                    border={border}
                  />
                </div>
                <p className="text-lg leading-relaxed" style={{ color: muted }}>
                  {m.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 11. Key Takeaways */}
      {showTakeaways && takeaways.length > 0 && (
        <section
          className="px-6"
          style={{ paddingTop: sectionPadY, paddingBottom: sectionPadY, backgroundColor: dark, color: headlineOnDark }}
        >
          <div className="mx-auto" style={{ maxWidth: 896 }}>
            {props.takeawaysHeading && (
              <h2
                style={{ fontFamily: fontSerif, color: headlineOnDark }}
                className="text-4xl mb-16 text-center"
              >
                {props.takeawaysHeading}
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {takeaways.map((t, i) => (
                <div key={i}>
                  <div
                    className="text-2xl mb-4"
                    style={{ fontFamily: fontSerif, opacity: 0.5, color: headlineOnDark }}
                  >
                    {String(i + 1).padStart(2, "0")}.
                  </div>
                  <p className="text-sm leading-relaxed" style={{ opacity: 0.7 }}>
                    {t.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 12. CTA Band */}
      {showCta && (props.ctaHeading || props.ctaLabel) && (
        <section
          className="px-6 text-center"
          style={{ paddingTop: `${sectionPx * 1.3}px`, paddingBottom: `${sectionPx * 1.3}px` }}
        >
          {props.ctaHeading && (
            <h2 style={{ fontFamily: fontSerif, color: headline }} className="text-5xl mb-8">
              {props.ctaHeading}
            </h2>
          )}
          {props.ctaBody && (
            <p className="text-lg mb-10 mx-auto" style={{ color: muted, maxWidth: 576 }}>
              {props.ctaBody}
            </p>
          )}
          {props.ctaLabel && (
            <a
              href={props.ctaUrl || "#"}
              className="inline-block px-10 py-5 text-sm uppercase tracking-widest transition-opacity hover:opacity-90"
              style={{ backgroundColor: ink, color: bg, borderRadius: radius }}
            >
              {props.ctaLabel}
            </a>
          )}
        </section>
      )}

      {/* 13. Footer */}
      {showFooter && (
        <footer className="px-6" style={{ borderTop: `1px solid ${border}`, paddingTop: `${sectionPx * 0.66}px`, paddingBottom: `${sectionPx * 0.66}px` }}>
          <div
            className="mx-auto grid grid-cols-1 md:grid-cols-4 gap-12"
            style={{ maxWidth: wideMax }}
          >
            <div className="md:col-span-2">
              <div style={{ fontFamily: fontSerif, color: headline }} className="text-3xl font-bold mb-6">
                {brandName}
              </div>
              {props.footerTagline && (
                <p className="text-sm leading-relaxed" style={{ color: muted, maxWidth: "20rem" }}>
                  {props.footerTagline}
                </p>
              )}
            </div>
            {footerLinks.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: ink }}>
                  Links
                </h4>
                <ul className="space-y-4 text-sm" style={{ color: muted }}>
                  {footerLinks.map((l, i) => (
                    <li key={`${l.label}-${i}`}>
                      <a href={l.href || "#"} style={{ color: muted }}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: ink }}>
                Connect
              </h4>
              <div className="flex gap-4" style={{ color: muted }}>
                <Instagram className="w-5 h-5" />
                <Twitter className="w-5 h-5" />
                <Linkedin className="w-5 h-5" />
                <Facebook className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div
            className="mx-auto mt-16 pt-8 flex flex-col md:flex-row items-center justify-between text-xs uppercase tracking-widest"
            style={{ borderTop: `1px solid ${border}`, color: muted, maxWidth: wideMax }}
          >
            <div>
              {props.footerNote || `© ${year} ${brandName}. All rights reserved.`}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default BlockCaseEditorial;
