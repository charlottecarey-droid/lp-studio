import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { DsoInsightsDashboardFrame } from "./BlockDsoInsightsDashboard";
import { Activity, BarChart3, Menu, Monitor, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { resolveLucideIcon, type IconComp } from "@/lib/icon-value";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { CtaButton } from "@/components/CtaButton";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_RING, MINT_SHADOW_1, MINT_SHADOW_2, MINT_WIDE,
  MintCheckDot, MintCtaButtons, MintEyebrow, MintNumber, MintSparkline, mintAnchorClick, mintCard, mintHighlight, mintStageDots, resolveMintButtonColors, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Hero — type "mint-hero"  (DSO Page (Light) family, Nov 2026)
 *
 * The page's opening, ported from the third "Dandy for DSOs" artifact: a
 * 60px glass top bar (logo, 13.5px links with a lime underline under the
 * active one, a small note, a green pill), then a 7/5 grid — eyebrow with a
 * lime dot, a 12ch display headline carrying a lime highlight, a 44ch sub,
 * a lime pill + chevron link — beside three small "mini" cards (icon tile,
 * title, caption, display-face value). Below: a 21:9 photo frame on a mint
 * plate with floating "UI" cards, a bordered four-cell stat strip (label +
 * index, big number, caption, sparkline) and a "Trusted by" names row.
 *
 * Self-nav hero: never stack a nav block above it. Reveal contract: fade-ups
 * through useMintReveal; the photo's slow settle is a CSS transition gated
 * on the reveal flag; static render paints the final frame.
 * -------------------------------------------------------------------------- */

export interface MintNavLink {
  label: string;
  href: string;
}

export interface MintHeroStat {
  value: string;
  label: string;
  /** Tiny uppercase label above the number ("Groups"); blank = none. */
  heading?: string;
  /** Sparkline points, left to right (any scale; normalised to the tallest). Blank = no sparkline. */
  spark?: number[];
}

/** A floating card over the hero photo. `kind` picks the artifact's three shapes. */
export interface MintFloatCard {
  kind: "metric" | "checklist" | "figure";
  /** Small uppercase label ("Remake rate · network"). */
  label: string;
  /** Big figure ("1.9%", "$270,141") for metric/figure cards. */
  value?: string;
  /** metric: bar fill 0–100; note beside it ("↓ 29%"). figure: note under the value. */
  bar?: number;
  note?: string;
  /** checklist: up to 4 check lines. */
  items?: string[];
}

/** One of the three small cards beside the headline. */
export interface MintMiniCard {
  /** Lucide icon name ("Activity", "Monitor", "BarChart3"); blank = a fixed default per slot. */
  icon?: string;
  title: string;
  caption: string;
  /** Display-face value at the right ("70%"). */
  value: string;
}

export interface MintHeroLogo {
  name: string;
  imageUrl?: string;
  imageAlt?: string;
  url?: string;
}

export const MINT_HERO_MAX_LOGOS = 8;

export interface MintHeroBlockProps extends MintStyleProps, MintCtaProps {
  showNav?: boolean;
  navLinks?: MintNavLink[];
  /** Nav pill label; blank = the primary CTA text. */
  navCtaText?: string;
  hideNavCta?: boolean;
  /** Small muted note left of the nav pill ("Enterprise team · Mon–Fri"); shown ≥1000px. */
  navNote?: string;
  /** Eyebrow above the headline ("For multi-location groups"). */
  cap?: string;
  /** Muted suffix after the eyebrow ("· Enterprise"). */
  eyebrowSuffix?: string;
  /** "\n" breaks a line. */
  headline: string;
  /** The phrase that gets the lime highlight; blank = none. Defaults to the last line of the headline. */
  highlight?: string;
  subheadline?: string;
  /** "pill-link" = lime pill + chevron link (the design); "link" = two chevron links; "pill" = two pills. */
  ctaStyle?: "link" | "pill" | "pill-link";
  /** Up to three small cards beside the headline. */
  miniCards?: MintMiniCard[];
  /** What sits in the media frame: the photo (default) or the interactive Insights dashboard. */
  mediaKind?: "photo" | "dashboard";
  /** Address-bar text in the dashboard's browser chrome ("app/dashboard"). */
  dashboardUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  showImage?: boolean;
  /** Up to three floating cards over the photo (hidden on phones except the first, and not shown over the dashboard). */
  floats?: MintFloatCard[];
  stats?: MintHeroStat[];
  /** Uppercase label in front of the names row ("Trusted by"). */
  namesLabel?: string;
  /** Customer names in the row under the numbers. */
  names?: string[];
  /** Customer logos (up to 8) shown in that row instead of the names when any has an image. */
  logos?: MintHeroLogo[];
  /** Logo image height in px (default 26). */
  logoHeight?: number;
  /** Render the logos in grayscale (default true) so a mixed set reads as one row. */
  logoGrayscale?: boolean;
  anchorId?: string;
}

interface Props {
  props: MintHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintHeroBlockProps) => void;
}

export const MINT_HERO_DEFAULT_PROPS: MintHeroBlockProps = {
  ...MINT_CTA_DEFAULTS,
  showNav: true,
  navLinks: [
    { label: "Lab services", href: "#" },
    { label: "Solutions", href: "#" },
    { label: "Groups", href: "#top" },
    { label: "Pricing", href: "#" },
    { label: "Learning", href: "#" },
  ],
  navCtaText: "Talk to the enterprise team",
  navNote: "Enterprise team · Mon–Fri",
  cap: "For multi-location groups",
  eyebrowSuffix: "· Enterprise",
  headline: "One lab system.\nEvery location.",
  highlight: "Every location.",
  subheadline: "One platform and one lab across every office, adopted doctor by doctor and measured location by location. Your clinicians get a lab they choose. Your leadership gets numbers they can see.",
  ctaText: "Talk to the enterprise team",
  ctaUrl: "#talk",
  ctaAction: "url",
  ctaSecondaryText: "See the proof",
  ctaSecondaryUrl: "#proof",
  ctaSecondaryAction: "url",
  ctaStyle: "pill-link",
  miniCards: [
    { icon: "Activity", title: "Adoption, not mandates", caption: "of practices activate on training day", value: "70%" },
    { icon: "Monitor", title: "A scanner in every operatory", caption: "CapEx per location", value: "$0" },
    { icon: "BarChart3", title: "Measured by location", caption: "average lab cost savings", value: "24%" },
  ],
  showImage: true,
  mediaKind: "photo",
  dashboardUrl: "",
  imageUrl: "",
  imageAlt: "",
  floats: [
    { kind: "metric", label: "Remake rate · network", value: "1.9%", bar: 38, note: "↓ 29%" },
    { kind: "checklist", label: "Scan review", items: ["Margins captured", "Occlusion clear", "Ready to submit"] },
    { kind: "figure", label: "Lab spend · July", value: "$270,141", note: "147 locations · one invoice" },
  ],
  stats: [
    { heading: "Groups", value: "150+", label: "groups on the platform", spark: [18, 14, 15, 9, 10, 5, 2].map((v) => 22 - v) },
    { heading: "Adoption", value: "70%", label: "of practices activate on training day", spark: [20, 19, 12, 10, 4, 3].map((v) => 22 - v) },
    { heading: "Savings", value: "24%", label: "average lab cost savings", spark: [6, 9, 8, 13, 15, 20].map((v) => 22 - v) },
    { heading: "CapEx", value: "$0", label: "scanner CapEx per location", spark: [4, 4, 12, 20, 20].map((v) => 22 - v) },
  ],
  namesLabel: "Trusted by",
  logos: [],
  logoHeight: 26,
  logoGrayscale: true,
  names: ["Northwind Dental Partners", "Harbor Smiles Group", "Summit Dental Alliance", "Meridian Oral Health", "Lakeside Dental Group", "Atlas Dental Partners"],
  anchorId: "top",
  backgroundStyle: "white",
};

/** Render the headline with the highlighted phrase wrapped (live page only; the builder edits the plain string). */
function Headline({ text, highlight, lime }: { text: string; highlight?: string; lime: string }) {
  const lines = text.split("\n");
  const hl = (highlight ?? "").trim();
  return (
    <>
      {lines.map((line, i) => {
        const idx = hl ? line.indexOf(hl) : -1;
        return (
          <span key={i} className="block">
            {idx === -1 ? line : (
              <>
                {line.slice(0, idx)}
                <span style={mintHighlight(lime)}>{hl}</span>
                {line.slice(idx + hl.length)}
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

type FloatPos = { left?: number | string; right?: number | string; top?: number | string; bottom?: number | string; width: number; delay: string };
const FLOAT_POS: FloatPos[] = [
  { left: "4%", bottom: "12%", width: 210, delay: "-2s" },
  { right: "4%", top: "12%", width: 200, delay: "-4.5s" },
  { right: "4%", bottom: "12%", width: 200, delay: "0s" },
];

/** Fixed icon per mini-card slot when no Lucide name is given. */
const MINI_ICONS: IconComp[] = [Activity, Monitor, BarChart3];

/** Sparkline points come in any scale; MintSparkline wants 0–1. */
function normaliseSpark(points?: number[]): number[] | null {
  const pts = (points ?? []).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (pts.length < 2) return null;
  const max = Math.max(...pts);
  if (max <= 1) return pts.map((v) => Math.max(0, v));
  return pts.map((v) => Math.max(0, v) / max);
}

const ArrowIcon = () => (
  <svg aria-hidden viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export function BlockMintHero({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...MINT_HERO_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, show } = useMintReveal<HTMLElement>("-40px");
  const settled = show || staticRender || reduced;
  // Fade-up for the copy: a CSS transition gated on the fail-open reveal flag.
  const riseStyle = (delay: number): React.CSSProperties => ({
    opacity: settled ? 1 : 0,
    transform: settled ? "none" : "translateY(18px)",
    transition: reduced ? "none" : `opacity 1s cubic-bezier(.16,1,.3,1) ${delay}s, transform 1.1s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (isEditor) return;
    const onScroll = () => setScrolled((window.scrollY || 0) > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isEditor]);

  const field = (key: keyof MintHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintHeroBlockProps[typeof key] }) : undefined;
  const stats = (p.stats ?? []).filter((s) => s.value?.trim() || isEditor).slice(0, 4);
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<MintHeroStat>) => onFieldChange({ ...props, stats: (p.stats ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;
  const updateLink = onFieldChange
    ? (i: number, label: string) => onFieldChange({ ...props, navLinks: (p.navLinks ?? []).map((l, idx) => (idx === i ? { ...l, label } : l)) })
    : undefined;
  const updateName = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, names: (p.names ?? []).map((n, idx) => (idx === i ? v : n)) })
    : undefined;
  const updateFloat = onFieldChange
    ? (i: number, patch: Partial<MintFloatCard>) => onFieldChange({ ...props, floats: (p.floats ?? []).map((f, idx) => (idx === i ? { ...f, ...patch } : f)) })
    : undefined;
  const updateMini = onFieldChange
    ? (i: number, patch: Partial<MintMiniCard>) => onFieldChange({ ...props, miniCards: (p.miniCards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  const dark = pal.dark;
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const links = p.navLinks ?? [];
  const navCtaText = (p.navCtaText ?? "").trim() || p.ctaText || "";
  const navBtn = resolveMintButtonColors(p, pal, "green");
  const floats = (p.floats ?? []).slice(0, 3);
  const miniCards = (p.miniCards ?? []).filter((c) => c.title?.trim() || c.value?.trim() || isEditor).slice(0, 3);
  const names = (p.names ?? []).filter((n) => n.trim() || isEditor);
  const logos = (p.logos ?? []).filter((l) => l.imageUrl || l.name?.trim() || isEditor).slice(0, MINT_HERO_MAX_LOGOS);
  const useLogos = logos.some((l) => !!l.imageUrl) || (isEditor && logos.length > 0);
  const updateLogo = onFieldChange
    ? (i: number, patch: Partial<MintHeroLogo>) => onFieldChange({ ...props, logos: (p.logos ?? []).map((l, idx) => (idx === i ? { ...l, ...patch } : l)) })
    : undefined;
  const logoHeight = Math.max(14, Math.min(56, Number(p.logoHeight) || 26));
  const anchorHref = p.anchorId ? `#${p.anchorId}` : undefined;
  const customSurface = !!p.bgColor || (!!p.backgroundStyle && p.backgroundStyle !== "white");
  const surface = dark || customSurface
    ? pal.bg
    : `radial-gradient(1200px 500px at 50% -10%, ${pal.mint} 0%, transparent 70%), #FFFFFF`;
  const hairline = dark ? "rgba(255,252,239,0.14)" : pal.line;
  const cardSurface = dark ? pal.card : "#FFFFFF";
  const ctaMode: "link" | "pill" | "pill-link" = p.ctaStyle === "link" || p.ctaStyle === "pill" ? p.ctaStyle : "pill-link";
  const limeBtn = resolveMintButtonColors(p, pal, "lime");
  const modalCfg = pickCtaModalConfig(p);
  const ctaCommon = { brand, pageId, variantId, modalTheme: (dark ? "dark" : "light") as "dark" | "light", ...modalCfg };

  const nav = p.showNav !== false && (
    <header
      className="relative z-20 w-full"
      style={{
        position: isEditor ? "relative" : "sticky",
        top: 0,
        background: dark ? `color-mix(in srgb, ${pal.deep} 82%, transparent)` : "rgba(255,255,255,0.82)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : scrolled ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.06)"}`,
      }}
    >
      <div className={cn(MINT_WIDE, "flex h-[60px] items-center justify-between gap-5")}>
        <a href={anchorHref ?? "#"} onClick={mintAnchorClick(anchorHref)} className="flex items-center no-underline" aria-label={brand.brandName || "Home"}>
          <BrandLogo brand={brand} tone={dark ? "onDark" : "onLight"} alt={brand.brandName || "Logo"} className="h-[22px] w-auto" />
        </a>
        {links.length > 0 && (
          <nav aria-label="Primary" className="hidden min-[1000px]:flex items-center gap-7 text-[13.5px] font-medium" style={{ color: ink, fontFamily: MINT_BODY }}>
            {links.map((l, i) => {
              const active = !!anchorHref && l.href === anchorHref;
              return (
                <a key={i} href={l.href || "#"} onClick={mintAnchorClick(l.href)} className={cn("relative py-1 no-underline transition-opacity hover:opacity-100", active ? "opacity-100" : "opacity-70")} style={{ color: "inherit" }} aria-current={active ? "page" : undefined}>
                  <InlineText as="span" value={l.label} onUpdate={updateLink ? (v) => updateLink(i, v) : undefined} />
                  {active && <span aria-hidden className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-sm" style={{ background: pal.lime }} />}
                </a>
              );
            })}
          </nav>
        )}
        <div className="flex items-center gap-[18px]">
          {(p.navNote || isEditor) && (
            <span className="hidden min-[1000px]:block text-[12.5px] tabular-nums" style={{ color: muted, fontFamily: MINT_BODY }}>
              <InlineText as="span" value={p.navNote ?? ""} onUpdate={field("navNote")} />
            </span>
          )}
          {!p.hideNavCta && navCtaText && (
            <MintCtaButtons
              props={{ ...p, ctaText: navCtaText }}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => { if (k === "ctaText") onFieldChange({ ...props, navCtaText: v }); } : undefined}
              source="mint-hero-nav"
              primaryOnly
              size="sm"
              className="hidden sm:flex"
            />
          )}
          {links.length > 0 && (
            <button type="button" onClick={() => setMenuOpen((o) => !o)} className="min-[1000px]:hidden inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ color: ink, border: `1px solid ${pal.line}`, background: "transparent" }} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      {menuOpen && links.length > 0 && (
        <div className="min-[1000px]:hidden" style={{ background: dark ? pal.deep : "#FFFFFF", borderTop: `1px solid ${pal.line}` }}>
          <div className={cn(MINT_WIDE, "flex flex-col gap-1 py-3")}>
            {links.map((l, i) => (
              <a key={i} href={l.href || "#"} onClick={(e) => { mintAnchorClick(l.href)(e); setMenuOpen(false); }} className="py-2 text-[15px] font-medium no-underline" style={{ color: ink, fontFamily: MINT_BODY }}>{l.label}</a>
            ))}
            {!p.hideNavCta && navCtaText && (
              <MintCtaButtons props={{ ...p, ctaText: navCtaText }} brand={brand} palette={pal} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} source="mint-hero-nav-mobile" primaryOnly size="sm" align="start" className="mt-2" />
            )}
          </div>
        </div>
      )}
      <span hidden data-nav-btn={navBtn.bg} />
    </header>
  );

  /** The design's CTA row: a lime pill with an arrow and a quiet chevron link beside it. */
  const pillLinkCtas = (
    <div className="flex flex-wrap items-center gap-3">
      {(p.ctaText || isEditor) && (
        <CtaButton
          {...ctaCommon}
          ctaAction={p.ctaAction || "url"}
          ctaUrl={p.ctaUrl}
          chilipiperUrl={p.chilipiperUrl}
          videoUrl={p.videoUrl}
          videoPosterUrl={p.videoPosterUrl}
          onClick={(p.ctaAction || "url") === "url" ? onCtaClick : undefined}
          source="mint-hero-primary"
          className="mint-btn inline-flex items-center justify-center gap-2.5 rounded-full whitespace-nowrap no-underline"
          style={{ background: limeBtn.bg, color: limeBtn.text, fontFamily: MINT_BODY, padding: "14px 24px", fontSize: 14, fontWeight: 500, lineHeight: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}
        >
          <InlineText as="span" value={p.ctaText || "Talk to the enterprise team"} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, ctaText: v }) : undefined} />
          <ArrowIcon />
        </CtaButton>
      )}
      {(p.ctaSecondaryText || isEditor) && (
        <CtaButton
          {...ctaCommon}
          ctaAction={p.ctaSecondaryAction || "url"}
          ctaUrl={p.ctaSecondaryUrl}
          chilipiperUrl={p.secondaryChilipiperUrl}
          videoUrl={p.secondaryVideoUrl}
          onClick={(p.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
          source="mint-hero-secondary"
          className="mint-link ml-2 text-[15px]"
          style={{ background: "transparent", color: dark ? pal.lime : pal.green, fontFamily: MINT_BODY, padding: 0 }}
        >
          <InlineText as="span" value={p.ctaSecondaryText || "See the proof"} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, ctaSecondaryText: v }) : undefined} />
        </CtaButton>
      )}
    </div>
  );

  const floatCard = (f: MintFloatCard, i: number) => {
    const pos = FLOAT_POS[i] ?? FLOAT_POS[0];
    const cardStyle: React.CSSProperties = {
      position: "absolute", zIndex: 2, left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, width: pos.width,
      background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      borderRadius: 14, boxShadow: `${MINT_RING}, 0 14px 40px rgba(0,38,31,.16)`, padding: "12px 14px",
      fontSize: 12.5, lineHeight: 1.35, color: "#1D1D1F", fontFamily: MINT_BODY,
      animation: reduced || staticRender ? "none" : `mint-float 7s ease-in-out infinite ${pos.delay}`,
    };
    return (
      <div key={i} className={cn("mint-float", i === 0 ? "" : "hidden md:block")} style={cardStyle} data-float-kind={f.kind}>
        <div className="flex items-start justify-between gap-3 text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#6E6E73" }}>
          <InlineText as="span" value={f.label} onUpdate={updateFloat ? (v) => updateFloat(i, { label: v }) : undefined} />
          <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pal.lime }} />
        </div>
        {f.kind !== "checklist" && (
          <div className="tabular-nums" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.5rem", letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 4 }}>
            <InlineText as="span" value={f.value ?? ""} onUpdate={updateFloat ? (v) => updateFloat(i, { value: v }) : undefined} />
          </div>
        )}
        {f.kind === "metric" && (
          <div className="mt-2 flex items-center gap-2" style={{ color: "#6E6E73" }}>
            <div className="h-[5px] flex-1 overflow-hidden rounded-[3px]" style={{ background: pal.mint2 }}>
              <i className="block h-full rounded-[3px]" style={{ background: pal.green, width: settled ? `${Math.max(0, Math.min(100, f.bar ?? 40))}%` : 0, transition: reduced ? "none" : "width 1.6s cubic-bezier(.16,1,.3,1)" }} />
            </div>
            {(f.note || isEditor) && <span><InlineText as="span" value={f.note ?? ""} onUpdate={updateFloat ? (v) => updateFloat(i, { note: v }) : undefined} /></span>}
          </div>
        )}
        {f.kind === "figure" && (f.note || isEditor) && (
          <div className="mt-1.5" style={{ color: "#6E6E73" }}>
            <InlineText as="span" value={f.note ?? ""} onUpdate={updateFloat ? (v) => updateFloat(i, { note: v }) : undefined} />
          </div>
        )}
        {f.kind === "checklist" && (
          <div className="mt-1.5 grid gap-1.5">
            {(f.items ?? []).slice(0, 4).map((it, j) => (
              <span key={j} className="inline-flex items-center gap-[7px] font-medium" style={{ color: "#1D1D1F" }}>
                <MintCheckDot palette={pal} lime />
                <InlineText as="span" value={it} onUpdate={updateFloat ? (v) => updateFloat(i, { items: (f.items ?? []).map((x, k) => (k === j ? v : x)) }) : undefined} />
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-hero"
      className="mint-hero relative"
      style={{ background: surface, color: ink, fontFamily: MINT_BODY }}
    >
      <style>{MINT_CSS}{`
        @keyframes mint-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @media (prefers-reduced-motion: reduce){.mint-float{animation:none!important}}
        .mint-stat{border-top:1px solid ${hairline}}
        .mint-stat:nth-child(-n+2){border-top:0}
        .mint-stat:nth-child(odd):not(:last-child){border-right:1px solid ${hairline}}
        @media (min-width: 800px){.mint-stat{border-top:0;border-right:1px solid ${hairline}}.mint-stat:last-child{border-right:0}}
      `}</style>
      {nav}
      <div className={MINT_WIDE} style={{ paddingTop: "clamp(56px, 7vw, 96px)" }}>
        <div className={cn("grid gap-9 min-[1000px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1000px]:items-end min-[1000px]:gap-12")}>
          <div className="min-w-0">
            {(p.cap || isEditor) && (
              <div style={riseStyle(0)}>
                <MintEyebrow
                  palette={pal}
                  suffix={(p.eyebrowSuffix || isEditor) ? <InlineText as="span" value={p.eyebrowSuffix ?? ""} onUpdate={field("eyebrowSuffix")} /> : undefined}
                  style={{ marginBottom: 16 }}
                >
                  <InlineText as="span" value={p.cap ?? ""} onUpdate={field("cap")} />
                </MintEyebrow>
              </div>
            )}
            <h1 style={{ ...riseStyle(0.1), fontFamily: MINT_DISPLAY, fontSize: "clamp(2.7rem, 6vw, 5rem)", letterSpacing: "-0.035em", lineHeight: 1.02, fontWeight: 400, margin: "4px 0 0", maxWidth: "12ch", color: ink, textWrap: "balance" } as React.CSSProperties}>
              {isEditor ? (
                <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
              ) : (
                <Headline text={p.headline} highlight={p.highlight} lime={pal.lime} />
              )}
            </h1>
            {(p.subheadline || isEditor) && (
              <p style={{ ...riseStyle(0.2), fontFamily: MINT_BODY, fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)", lineHeight: 1.5, color: muted, maxWidth: "44ch", margin: "16px 0 0", textWrap: "pretty" } as React.CSSProperties}>
                <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
            <div className="mt-7" style={riseStyle(0.3)}>
              {ctaMode === "pill-link" ? pillLinkCtas : (
                <MintCtaButtons
                  props={p}
                  brand={brand}
                  palette={pal}
                  pageId={pageId}
                  variantId={variantId}
                  onCtaClick={onCtaClick}
                  onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
                  source="mint-hero"
                  style={ctaMode}
                  align="start"
                  primaryPlaceholder="Talk to the enterprise team"
                  secondaryPlaceholder="See the proof"
                />
              )}
            </div>
          </div>

          {miniCards.length > 0 && (
            <div className="grid gap-3" style={riseStyle(0.2)}>
              {miniCards.map((c, i) => {
                const Icon = resolveLucideIcon(c.icon?.trim() || undefined, MINI_ICONS[i % MINI_ICONS.length]);
                return (
                  <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5" style={{ ...mintCard(pal), padding: "16px 18px" }}>
                    <span aria-hidden className="grid h-[38px] w-[38px] place-items-center rounded-[11px]" style={{ background: pal.mint, color: pal.green }}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <b className="block text-[14px] font-medium leading-[1.3]" style={{ color: ink }}>
                        <InlineText as="span" value={c.title} onUpdate={updateMini ? (v) => updateMini(i, { title: v }) : undefined} />
                      </b>
                      {(c.caption || isEditor) && (
                        <span className="block text-[12.5px] leading-[1.35]" style={{ color: muted }}>
                          <InlineText as="span" value={c.caption ?? ""} onUpdate={updateMini ? (v) => updateMini(i, { caption: v }) : undefined} />
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.5rem", letterSpacing: "-0.03em", lineHeight: 1, color: dark ? pal.lime : pal.green }}>
                      <InlineText as="span" value={c.value} onUpdate={updateMini ? (v) => updateMini(i, { value: v }) : undefined} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {p.showImage !== false && p.mediaKind === "dashboard" && (
          <div style={{ marginTop: "clamp(40px, 5vw, 64px)", ...riseStyle(0.3) }}>
            <DsoInsightsDashboardFrame
              variant={dark ? "dark" : "light"}
              browserUrl={p.dashboardUrl}
              className="!rounded-[20px] !border-0"
              tabsClassName="!rounded-full !border-0 !p-1.5 !gap-0.5"
              tabsStyle={{ background: dark ? pal.deep : "#FFFFFF", boxShadow: `${MINT_RING}, ${MINT_SHADOW_1}` }}
              shell={(frame, tabs) => (
                <>
                  {/* The window on the mint plate, edge to edge — no gutter around the dashboard. */}
                  <div className="relative">
                    <div aria-hidden className="absolute z-0 rounded-[24px]" style={{ inset: "14px -14px -14px 14px", background: pal.mint }} />
                    <div className="relative z-[1] overflow-hidden" style={{ borderRadius: 20, background: dark ? pal.deep : "#FFFFFF", boxShadow: `${MINT_RING}, ${MINT_SHADOW_2}` }}>
                      {frame}
                      <div aria-hidden className="pointer-events-none absolute inset-0 z-[5]" style={{ borderRadius: "inherit", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)" }} />
                    </div>
                  </div>
                  {/* The view switcher floats under the window. */}
                  {tabs && <div className="relative z-[2]" style={{ marginTop: 26 }}>{tabs}</div>}
                </>
              )}
            />
          </div>
        )}

        {p.showImage !== false && p.mediaKind !== "dashboard" && (
          <div className="relative" style={{ marginTop: "clamp(40px, 5vw, 64px)", ...riseStyle(0.3) }}>
            <div aria-hidden className="absolute z-0 rounded-[24px]" style={{ inset: "14px -14px -14px 14px", background: pal.mint }} />
            <div className="relative z-[1] overflow-hidden" style={{ borderRadius: 20, aspectRatio: "21 / 9", background: pal.grey, boxShadow: `${MINT_RING}, ${MINT_SHADOW_2}` }}>
              {(p.imageUrl || isEditor) ? (
                <InlineImage
                  src={p.imageUrl ?? ""}
                  alt={p.imageAlt ?? ""}
                  className="h-full w-full object-cover"
                  wrapperClassName="absolute inset-0"
                  style={{ filter: "saturate(.8)", transform: settled ? "scale(1)" : "scale(1.04)", transition: reduced ? "none" : "transform 2.4s cubic-bezier(.16,1,.3,1)" }}
                  focalPoint={p.imageFocal}
                  onUpdate={field("imageUrl")}
                  onAltUpdate={field("imageAlt")}
                  onFocalUpdate={field("imageFocal")}
                />
              ) : (
                <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${pal.mint} 0%, ${pal.mint2} 100%)` }}>
                  <div className="absolute inset-0" style={mintStageDots(pal)} />
                </div>
              )}
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ borderRadius: "inherit", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)" }} />
            </div>
            {floats.map(floatCard)}
          </div>
        )}

        {stats.length > 0 && (
          <div
            className={cn("grid grid-cols-2 overflow-hidden", stats.length >= 3 ? "min-[800px]:grid-cols-4" : "min-[800px]:grid-cols-2")}
            style={{ marginTop: "clamp(48px, 6vw, 72px)", borderRadius: 18, background: cardSurface, boxShadow: `${MINT_RING}, ${MINT_SHADOW_1}`, ...riseStyle(0.35) }}
          >
            {stats.map((s, i) => {
              const spark = normaliseSpark(s.spark);
              return (
                <div key={i} className="mint-stat relative min-w-0 p-[18px] pb-4 sm:px-[22px] sm:pt-[22px] sm:pb-5">
                  <div className="flex items-start justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: pal.inkSubtle, minHeight: 22 }}>
                    <span className="min-w-0 pt-[3px]">
                      <InlineText as="span" value={s.heading ?? ""} onUpdate={updateStat ? (v) => updateStat(i, { heading: v }) : undefined} />
                    </span>
                    <span className="flex shrink-0 items-start gap-2.5">
                      <span className="pt-[3px]">{String(i + 1).padStart(2, "0")}</span>
                      {spark && <MintSparkline palette={pal} points={spark} className="hidden sm:block" />}
                    </span>
                  </div>
                  <MintNumber value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} className="mt-2.5 block" style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(2rem, 3.2vw, 2.8rem)", letterSpacing: "-0.035em", lineHeight: 1, color: ink }} />
                  <span className="mt-2 block text-[13px] leading-[1.4]" style={{ color: muted }}>
                    <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {(useLogos || names.length > 0) && (
          <div className="grid items-center gap-3.5 min-[900px]:grid-cols-[auto_minmax(0,1fr)] min-[900px]:gap-7" style={{ marginTop: 36, ...riseStyle(0.45) }}>
            {(p.namesLabel || isEditor) && (
              <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: pal.inkSubtle }}>
                <InlineText as="span" value={p.namesLabel ?? ""} onUpdate={field("namesLabel")} />
              </span>
            )}
            {useLogos ? (
              <div className="flex flex-wrap items-center gap-x-7 gap-y-4 min-[900px]:gap-x-10" data-hero-logos>
                {logos.map((l, i) => {
                  if (!l.imageUrl && !isEditor) {
                    return <span key={i} className="text-[15px] min-[900px]:text-[17px]" style={{ fontFamily: MINT_DISPLAY, letterSpacing: "-0.01em", color: muted }}>{l.name}</span>;
                  }
                  const img = (
                    <InlineImage
                      src={l.imageUrl ?? ""}
                      alt={l.imageAlt || l.name || ""}
                      className="block w-auto object-contain"
                      wrapperClassName="inline-block"
                      style={{ height: logoHeight, maxWidth: logoHeight * 6, filter: p.logoGrayscale !== false && l.imageUrl ? "grayscale(1)" : undefined, opacity: p.logoGrayscale !== false && l.imageUrl ? (dark ? 0.78 : 0.64) : 1 }}
                      onUpdate={updateLogo ? (v) => updateLogo(i, { imageUrl: v }) : undefined}
                      onAltUpdate={updateLogo ? (v) => updateLogo(i, { imageAlt: v }) : undefined}
                    />
                  );
                  return l.url && !isEditor ? (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.name || l.imageAlt || "Customer"} className="inline-flex items-center">{img}</a>
                  ) : (
                    <span key={i} className="inline-flex items-center">{img}</span>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] min-[900px]:gap-x-[30px] min-[900px]:gap-y-2.5 min-[900px]:text-[17px]" style={{ fontFamily: MINT_DISPLAY, letterSpacing: "-0.01em", color: muted }}>
                {names.map((n, i) => (
                  <span key={i}><InlineText as="span" value={n} onUpdate={updateName ? (v) => updateName(i, v) : undefined} /></span>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ height: "clamp(56px, 7vw, 96px)" }} />
      </div>
    </section>
  );
}
