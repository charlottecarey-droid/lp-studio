import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS, FOREST_DISPLAY, FOREST_EASE,
  ForestCtaButtons, ForestEyebrow, ForestGrain, ForestNumber, forestAnchorClick, resolveForestPalette,
  type ForestCtaProps, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Hero — type "forest-hero"  (DSO Page family, Nov 2026)
 *
 * The artifact's opening: the page's own top bar (logo, links, phone, pill),
 * a deep-forest band with a dimmed photo behind, an eyebrow, a two-line
 * display headline whose words rise in one by one, a muted third line, a
 * lede, a lime pill + ghost pill, a glass "scan card" (photo, sweep, title,
 * badge) at the right, and a hairline row of up to four count-up numbers.
 *
 * Self-nav hero: never stack a nav block above it. Reveal contract: the word
 * rise and the card use CSS transitions gated on a mounted flag; the static
 * render (templates, thumbnails) paints the final frame.
 * -------------------------------------------------------------------------- */

export interface ForestNavLink {
  label: string;
  href: string;
}

export interface ForestHeroStat {
  value: string;
  label: string;
}

export interface ForestHeroBlockProps extends ForestStyleProps, ForestCtaProps {
  showNav?: boolean;
  navLinks?: ForestNavLink[];
  /** Small text right of the links ("DSO team · 1-800-000-0000"). */
  navNote?: string;
  /** Nav pill label; blank = the primary CTA text. */
  navCtaText?: string;
  hideNavCta?: boolean;
  eyebrow?: string;
  /** Big lines; "\n" breaks a line. Each word rises in on load. */
  headline: string;
  /** Smaller muted line under the headline. */
  headlineMuted?: string;
  subheadline?: string;
  backgroundImageUrl?: string;
  backgroundImageAlt?: string;
  backgroundFocal?: string;
  /** 0–1: how much the forest tint covers the photo (default 0.75). */
  backgroundDim?: number;
  showCard?: boolean;
  cardImageUrl?: string;
  cardImageAlt?: string;
  cardImageFocal?: string;
  cardTitle?: string;
  cardSub?: string;
  cardBadge?: string;
  /** Animated scan sweep over the card photo. */
  cardSweep?: boolean;
  stats?: ForestHeroStat[];
  anchorId?: string;
}

interface Props {
  props: ForestHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestHeroBlockProps) => void;
}

export const FOREST_HERO_DEFAULT_PROPS: ForestHeroBlockProps = {
  ...FOREST_CTA_DEFAULTS,
  showNav: true,
  navLinks: [
    { label: "Lab services", href: "#" },
    { label: "Solutions", href: "#" },
    { label: "Groups", href: "#top" },
    { label: "Pricing", href: "#" },
  ],
  navNote: "Enterprise team · 1-800-000-0000",
  navCtaText: "",
  eyebrow: "For multi-location groups",
  headline: "One lab system.\nEvery location.",
  headlineMuted: "Standardize the system, not the clinician.",
  subheadline: "One platform and one lab across every office, adopted doctor by doctor and measured location by location. Your clinicians get a lab they choose. Your leadership gets numbers they can see.",
  ctaText: "Talk to the enterprise team",
  ctaUrl: "#talk",
  ctaAction: "url",
  ctaSecondaryText: "See the proof",
  ctaSecondaryUrl: "#proof",
  ctaSecondaryAction: "url",
  backgroundImageUrl: "",
  backgroundImageAlt: "",
  backgroundDim: 0.75,
  showCard: true,
  cardImageUrl: "",
  cardImageAlt: "",
  cardTitle: "AI scan review",
  cardSub: "Checked before the patient leaves the chair",
  cardBadge: "Live",
  cardSweep: true,
  stats: [
    { value: "150+", label: "groups on the platform" },
    { value: "70%", label: "of practices activate on training day" },
    { value: "24%", label: "average lab cost savings" },
    { value: "$0", label: "scanner CapEx per location" },
  ],
  anchorId: "top",
  backgroundStyle: "dandy-green",
};

function Words({ text, mounted, reduced, delayStart = 0.12 }: { text: string; mounted: boolean; reduced: boolean; delayStart?: number }) {
  let i = 0;
  return (
    <>
      {text.split("\n").map((line, li) => (
        <span key={li} className="block">
          {line.split(/\s+/).filter(Boolean).map((w, wi) => {
            const idx = i++;
            return (
              <span key={wi} className="inline-block overflow-hidden align-bottom mr-[0.22em]">
                <span
                  className="inline-block"
                  style={{
                    transform: mounted || reduced ? "translateY(0)" : "translateY(110%)",
                    transition: reduced ? "none" : `transform 1.1s cubic-bezier(.16,1,.3,1) ${delayStart + idx * 0.055}s`,
                  }}
                >
                  {w}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}

export function BlockForestHero({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...FOREST_HERO_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#003A30");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const [mounted, setMounted] = useState(staticRender);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 80);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (isEditor) return;
    const onScroll = () => setScrolled((window.scrollY || 0) > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isEditor]);

  const field = (key: keyof ForestHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestHeroBlockProps[typeof key] }) : undefined;
  const stats = (p.stats ?? []).filter((s) => s.value?.trim() || isEditor).slice(0, 4);
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<ForestHeroStat>) => onFieldChange({ ...props, stats: (p.stats ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;
  const updateLink = onFieldChange
    ? (i: number, label: string) => onFieldChange({ ...props, navLinks: (p.navLinks ?? []).map((l, idx) => (idx === i ? { ...l, label } : l)) })
    : undefined;

  const dark = pal.dark;
  const cream = pal.cream;
  const onDarkMuted = dark ? "rgba(255,252,239,0.66)" : pal.muted;
  const hairline = dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const navCtaText = (p.navCtaText ?? "").trim() || p.ctaText || "";
  const dim = Math.max(0, Math.min(1, Number(p.backgroundDim ?? 0.75)));
  const links = p.navLinks ?? [];
  const revealed = mounted || reduced;
  const rise = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "none" : "translateY(26px)",
    transition: reduced ? "none" : `opacity 1s cubic-bezier(.16,1,.3,1) ${delay}s, transform 1.1s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const nav = p.showNav !== false && (
    <header
      className="relative z-20 w-full"
      style={{
        position: isEditor ? "relative" : "sticky",
        top: 0,
        background: scrolled ? `color-mix(in srgb, ${pal.deep} 92%, transparent)` : "transparent",
        backdropFilter: scrolled ? "blur(18px)" : undefined,
        WebkitBackdropFilter: scrolled ? "blur(18px)" : undefined,
        borderBottom: `1px solid ${scrolled ? hairline : "transparent"}`,
        transition: "background .6s cubic-bezier(.16,1,.3,1), border-color .6s",
      }}
    >
      <div className={cn(FOREST_CONTAINER, "flex h-[68px] items-center justify-between gap-6")}>
        <a href={p.anchorId ? `#${p.anchorId}` : "#"} className="flex items-center no-underline" aria-label={`${brand.brandName || "Home"}`} onClick={forestAnchorClick(p.anchorId ? `#${p.anchorId}` : undefined)}>
          <BrandLogo brand={brand} tone={dark ? "onDark" : "onLight"} alt={brand.brandName || "Logo"} className="h-[26px] w-auto" />
        </a>
        {links.length > 0 && (
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-[30px] text-[14px] font-medium" style={{ color: onDarkMuted, fontFamily: FOREST_BODY }}>
            {links.map((l, i) => (
              <a key={i} href={l.href || "#"} onClick={forestAnchorClick(l.href)} className="forest-link relative py-1.5 no-underline" style={{ color: "inherit" }}>
                <InlineText as="span" value={l.label} onUpdate={updateLink ? (v) => updateLink(i, v) : undefined} />
              </a>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-[22px]">
          {(p.navNote || isEditor) && (
            <span className="hidden lg:block text-[13px] tabular-nums" style={{ color: onDarkMuted, fontFamily: FOREST_BODY }}>
              <InlineText as="span" value={p.navNote ?? ""} onUpdate={field("navNote")} />
            </span>
          )}
          {!p.hideNavCta && navCtaText && (
            <ForestCtaButtons
              props={{ ...p, ctaText: navCtaText }}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => { if (k === "ctaText") onFieldChange({ ...props, navCtaText: v }); } : undefined}
              source="forest-hero-nav"
              primaryOnly
              size="sm"
              arrow={false}
              className="hidden sm:flex"
            />
          )}
          {links.length > 0 && (
            <button type="button" onClick={() => setMenuOpen((o) => !o)} className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ color: cream, border: `1px solid ${hairline}`, background: "transparent" }} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>
      {menuOpen && links.length > 0 && (
        <div className="lg:hidden" style={{ background: pal.deep, borderTop: `1px solid ${hairline}` }}>
          <div className={cn(FOREST_CONTAINER, "flex flex-col gap-1 py-4")}>
            {links.map((l, i) => (
              <a key={i} href={l.href || "#"} onClick={(e) => { forestAnchorClick(l.href)(e); setMenuOpen(false); }} className="py-2.5 text-[16px] font-medium no-underline" style={{ color: cream, fontFamily: FOREST_BODY }}>{l.label}</a>
            ))}
            {!p.hideNavCta && navCtaText && (
              <ForestCtaButtons props={{ ...p, ctaText: navCtaText }} brand={brand} palette={pal} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} source="forest-hero-nav-mobile" primaryOnly size="sm" arrow={false} className="mt-2" />
            )}
          </div>
        </div>
      )}
    </header>
  );

  return (
    <section
      id={p.anchorId || undefined}
      data-block="forest-hero"
      className="forest-hero relative overflow-hidden"
      style={{ background: dark ? pal.deep : pal.bg, color: cream, fontFamily: FOREST_BODY, isolation: "isolate" }}
    >
      <style>{FOREST_CSS}</style>
      {/* Photo + tint */}
      {(p.backgroundImageUrl || isEditor) && (
        <div className="absolute inset-0" style={{ zIndex: 0 }} aria-hidden={!p.backgroundImageAlt}>
          <InlineImage
            src={p.backgroundImageUrl ?? ""}
            alt={p.backgroundImageAlt ?? ""}
            className="h-full w-full object-cover"
            wrapperClassName="absolute inset-0"
            style={{ filter: "saturate(.72) brightness(.9)" }}
            focalPoint={p.backgroundFocal}
            onUpdate={field("backgroundImageUrl")}
            onAltUpdate={field("backgroundImageAlt")}
            onFocalUpdate={field("backgroundFocal")}
          />
          {p.backgroundImageUrl && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${pal.deep} ${Math.round(dim * 73)}%, transparent) 0%, color-mix(in srgb, ${pal.deep} ${Math.round(dim * 100)}%, transparent) 45%, color-mix(in srgb, ${pal.base} ${Math.round(Math.min(100, dim * 128))}%, transparent) 100%)` }} />
          )}
        </div>
      )}
      {dark && <ForestGrain />}
      <div className="relative" style={{ zIndex: 1 }}>
        {nav}
        <div className={cn(FOREST_CONTAINER)} style={{ paddingTop: "clamp(72px, 10vw, 140px)", paddingBottom: "clamp(56px, 7vw, 96px)" }}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,7.2fr)_minmax(0,4.8fr)] lg:items-end lg:gap-16">
            <div>
              {(p.eyebrow || isEditor) && (
                <ForestEyebrow palette={pal} style={{ color: dark ? pal.accent : pal.accent }}>
                  <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
                </ForestEyebrow>
              )}
              <h1
                className="mt-[26px]"
                style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(2.75rem, 6.4vw, 5.6rem)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 400, color: cream, maxWidth: "12ch", margin: "26px 0 0", textWrap: "balance" } as React.CSSProperties}
              >
                {isEditor ? (
                  <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
                ) : (
                  <Words text={p.headline} mounted={mounted} reduced={reduced} />
                )}
                {(p.headlineMuted || isEditor) && (
                  <span className="block" style={{ color: onDarkMuted, fontSize: "0.56em", letterSpacing: "-0.025em", marginTop: "0.35em", lineHeight: 1.1 }}>
                    {isEditor ? (
                      <InlineText as="span" value={p.headlineMuted ?? ""} onUpdate={field("headlineMuted")} multiline />
                    ) : (
                      <Words text={p.headlineMuted ?? ""} mounted={mounted} reduced={reduced} delayStart={0.12 + p.headline.split(/\s+/).length * 0.055} />
                    )}
                  </span>
                )}
              </h1>
              {(p.subheadline || isEditor) && (
                <p className="mt-7 max-w-[52ch]" style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.6, color: onDarkMuted, ...rise(0.25) }}>
                  <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
                </p>
              )}
              <div className="mt-[38px]" style={rise(0.33)}>
                <ForestCtaButtons
                  props={p}
                  brand={brand}
                  palette={pal}
                  pageId={pageId}
                  variantId={variantId}
                  onCtaClick={onCtaClick}
                  onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
                  source="forest-hero"
                  primaryPlaceholder="Talk to the enterprise team"
                  secondaryPlaceholder="See the proof"
                />
              </div>
            </div>

            {p.showCard !== false && (
              <div className="relative" style={rise(0.41)}>
                <div
                  className="relative overflow-hidden rounded-[28px] p-[22px]"
                  style={{ background: dark ? "rgba(255,252,239,0.06)" : "rgba(0,0,0,0.04)", border: `1px solid ${hairline}`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: pal.shadowElev }}
                >
                  <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: "4 / 3", background: dark ? "rgba(0,0,0,0.25)" : pal.panel }}>
                    {(p.cardImageUrl || isEditor) ? (
                      <InlineImage
                        src={p.cardImageUrl ?? ""}
                        alt={p.cardImageAlt || p.cardTitle || ""}
                        className="absolute inset-0 h-full w-full object-cover"
                        wrapperClassName="absolute inset-0"
                        focalPoint={p.cardImageFocal}
                        onUpdate={field("cardImageUrl")}
                        onAltUpdate={field("cardImageAlt")}
                        onFocalUpdate={field("cardImageFocal")}
                      />
                    ) : (
                      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 20%, color-mix(in srgb, ${pal.accentDeco} 18%, transparent), transparent 55%), linear-gradient(160deg, ${pal.base} 0%, ${pal.deep} 100%)` }} />
                    )}
                    {p.cardSweep !== false && !reduced && !staticRender && (
                      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                        <motion.div
                          className="absolute left-0 right-0"
                          style={{ height: "40%", background: `linear-gradient(180deg, transparent, color-mix(in srgb, ${pal.accentDeco} 35%, transparent))` }}
                          initial={{ top: "-40%" }}
                          animate={{ top: ["-40%", "110%", "110%"] }}
                          transition={{ duration: 4.5, times: [0, 0.6, 1], ease: FOREST_EASE, repeat: Infinity }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="mt-[18px] flex items-center justify-between gap-4 text-[13px]">
                    <div className="min-w-0">
                      {(p.cardTitle || isEditor) && (
                        <b className="block font-semibold" style={{ color: cream }}>
                          <InlineText as="span" value={p.cardTitle ?? ""} onUpdate={field("cardTitle")} />
                        </b>
                      )}
                      {(p.cardSub || isEditor) && (
                        <span className="block" style={{ color: onDarkMuted }}>
                          <InlineText as="span" value={p.cardSub ?? ""} onUpdate={field("cardSub")} />
                        </span>
                      )}
                    </div>
                    {(p.cardBadge || isEditor) && (
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-[7px] text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ background: pal.accentTint, color: pal.accent }}>
                        <span aria-hidden className="inline-block h-[7px] w-[7px] rounded-full forest-pulse" style={{ background: pal.accentDeco, boxShadow: `0 0 0 0 ${pal.accentDeco}` }} />
                        <InlineText as="span" value={p.cardBadge ?? ""} onUpdate={field("cardBadge")} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {stats.length > 0 && (
            <div
              className={cn("grid grid-cols-2 gap-x-6 gap-y-7", stats.length >= 3 ? "md:grid-cols-4" : "md:grid-cols-2")}
              style={{ marginTop: "clamp(56px, 7vw, 88px)", paddingTop: 32, borderTop: `1px solid ${hairline}`, ...rise(0.5) }}
            >
              {stats.map((s, i) => (
                <div key={i}>
                  <ForestNumber value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} className="block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(2rem, 3.4vw, 3rem)", color: cream }} />
                  <span className="mt-2.5 block max-w-[22ch] text-[13px] leading-[1.45]" style={{ color: onDarkMuted }}>
                    <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes forest-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb, ${pal.accentDeco} 55%, transparent)}70%{box-shadow:0 0 0 9px transparent}100%{box-shadow:0 0 0 0 transparent}} .forest-pulse{animation:forest-pulse 2.2s infinite} @media (prefers-reduced-motion: reduce){.forest-pulse{animation:none}}`}</style>
    </section>
  );
}
