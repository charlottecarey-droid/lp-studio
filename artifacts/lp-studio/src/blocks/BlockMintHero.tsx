import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_WIDE, MINT_WRAP,
  MintCheckDot, MintCtaButtons, MintNumber, mintAnchorClick, mintHighlight, mintSub, resolveMintButtonColors, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Hero — type "mint-hero"  (DSO Page (Light) family, Nov 2026)
 *
 * The artifact's opening: a slim white glass top bar (logo, links, green
 * pill), a centred cap line, a display headline whose last line carries a
 * lime highlight, a muted sub, two chevron links, then a wide 16:9 photo
 * card with three small floating "UI" cards (a metric with a bar, a
 * checklist, a figure with a note), a centred row of four count-up numbers
 * and a hairline row of customer names. White-to-mint gradient surface.
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

export interface MintHeroBlockProps extends MintStyleProps, MintCtaProps {
  showNav?: boolean;
  navLinks?: MintNavLink[];
  /** Nav pill label; blank = the primary CTA text. */
  navCtaText?: string;
  hideNavCta?: boolean;
  /** Small line above the headline ("Dandy for DSOs"). */
  cap?: string;
  /** "\n" breaks a line. */
  headline: string;
  /** The phrase that gets the lime highlight; blank = none. Defaults to the last line of the headline. */
  highlight?: string;
  subheadline?: string;
  /** "link" = the artifact's chevron links; "pill" = filled buttons. */
  ctaStyle?: "link" | "pill";
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  showImage?: boolean;
  /** Up to three floating cards over the photo (hidden on phones except the first). */
  floats?: MintFloatCard[];
  stats?: MintHeroStat[];
  /** Customer names in the hairline row under the numbers. */
  names?: string[];
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
  cap: "For multi-location groups",
  headline: "One lab system.\nEvery location.",
  highlight: "Every location.",
  subheadline: "One platform and one lab across every office, adopted doctor by doctor and measured location by location.",
  ctaText: "Talk to the enterprise team",
  ctaUrl: "#talk",
  ctaAction: "url",
  ctaSecondaryText: "See the proof",
  ctaSecondaryUrl: "#proof",
  ctaSecondaryAction: "url",
  ctaStyle: "link",
  showImage: true,
  imageUrl: "",
  imageAlt: "",
  floats: [
    { kind: "metric", label: "Remake rate · network", value: "1.9%", bar: 38, note: "↓ 29%" },
    { kind: "checklist", label: "Scan review", items: ["Margins captured", "Occlusion clear", "Ready to submit"] },
    { kind: "figure", label: "Lab spend · July", value: "$270,141", note: "147 locations · one invoice" },
  ],
  stats: [
    { value: "150+", label: "groups on the platform" },
    { value: "70%", label: "of practices activate on training day" },
    { value: "24%", label: "average lab cost savings" },
    { value: "$0", label: "scanner CapEx per location" },
  ],
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

const FLOAT_POS: CSSPositions = [
  { left: -14, bottom: "14%", width: 220, delay: "-2s" },
  { right: -14, top: "12%", width: 210, delay: "-4.5s" },
  { right: "8%", bottom: -18, width: 190, delay: "0s" },
];
type CSSPositions = Array<{ left?: number | string; right?: number | string; top?: number | string; bottom?: number | string; width: number; delay: string }>;

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

  const dark = pal.dark;
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const links = p.navLinks ?? [];
  const navCtaText = (p.navCtaText ?? "").trim() || p.ctaText || "";
  const navBtn = resolveMintButtonColors(p, pal, "green");
  const floats = (p.floats ?? []).slice(0, 3);
  const names = (p.names ?? []).filter((n) => n.trim() || isEditor);
  const surface = dark
    ? pal.bg
    : p.bgColor || (p.backgroundStyle && p.backgroundStyle !== "white")
      ? pal.bg
      : `linear-gradient(180deg, #FFFFFF 0%, ${pal.mint} 100%)`;

  const nav = p.showNav !== false && (
    <header
      className="relative z-20 w-full"
      style={{
        position: isEditor ? "relative" : "sticky",
        top: 0,
        height: 52,
        background: dark ? `color-mix(in srgb, ${pal.deep} 80%, transparent)` : "rgba(255,255,255,0.78)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : scrolled ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.06)"}`,
      }}
    >
      <div className={cn(MINT_WIDE, "flex h-[52px] items-center justify-between gap-5")}>
        <a href={p.anchorId ? `#${p.anchorId}` : "#"} onClick={mintAnchorClick(p.anchorId ? `#${p.anchorId}` : undefined)} className="flex items-center no-underline" aria-label={brand.brandName || "Home"}>
          <BrandLogo brand={brand} tone={dark ? "onDark" : "onLight"} alt={brand.brandName || "Logo"} className="h-[22px] w-auto" />
        </a>
        {links.length > 0 && (
          <nav aria-label="Primary" className="hidden md:flex items-center gap-7 text-[13px]" style={{ color: ink, fontFamily: MINT_BODY }}>
            {links.map((l, i) => (
              <a key={i} href={l.href || "#"} onClick={mintAnchorClick(l.href)} className="no-underline opacity-75 transition-opacity hover:opacity-100" style={{ color: "inherit" }}>
                <InlineText as="span" value={l.label} onUpdate={updateLink ? (v) => updateLink(i, v) : undefined} />
              </a>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
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
            <button type="button" onClick={() => setMenuOpen((o) => !o)} className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ color: ink, border: `1px solid ${pal.line}`, background: "transparent" }} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      {menuOpen && links.length > 0 && (
        <div className="md:hidden" style={{ background: dark ? pal.deep : "#FFFFFF", borderTop: `1px solid ${pal.line}` }}>
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

  const floatCard = (f: MintFloatCard, i: number) => {
    const pos = FLOAT_POS[i] ?? FLOAT_POS[0];
    const cardStyle: React.CSSProperties = {
      position: "absolute", left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, width: pos.width,
      background: "#FFFFFF", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,38,31,.14), 0 2px 6px rgba(0,0,0,.04)", padding: "14px 16px",
      fontSize: 13, lineHeight: 1.35, color: "#1D1D1F", fontFamily: MINT_BODY,
      animation: reduced || staticRender ? "none" : `mint-float 7s ease-in-out infinite ${pos.delay}`,
    };
    return (
      <div key={i} className={cn("mint-float", i === 0 ? "" : "hidden md:block")} style={cardStyle} data-float-kind={f.kind}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#6E6E73" }}>
          <InlineText as="span" value={f.label} onUpdate={updateFloat ? (v) => updateFloat(i, { label: v }) : undefined} />
        </div>
        {f.kind !== "checklist" && (
          <div style={{ fontFamily: MINT_DISPLAY, fontSize: "1.6rem", letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 4 }}>
            <InlineText as="span" value={f.value ?? ""} onUpdate={updateFloat ? (v) => updateFloat(i, { value: v }) : undefined} />
          </div>
        )}
        {f.kind === "metric" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-[3px]" style={{ background: pal.mint2 }}>
              <i className="block h-full rounded-[3px]" style={{ background: pal.green, width: settled ? `${Math.max(0, Math.min(100, f.bar ?? 40))}%` : 0, transition: reduced ? "none" : "width 1.6s cubic-bezier(.16,1,.3,1)" }} />
            </div>
            {(f.note || isEditor) && <span><InlineText as="span" value={f.note ?? ""} onUpdate={updateFloat ? (v) => updateFloat(i, { note: v }) : undefined} /></span>}
          </div>
        )}
        {f.kind === "figure" && (f.note || isEditor) && (
          <div className="mt-2" style={{ color: "#6E6E73" }}>
            <InlineText as="span" value={f.note ?? ""} onUpdate={updateFloat ? (v) => updateFloat(i, { note: v }) : undefined} />
          </div>
        )}
        {f.kind === "checklist" && (
          <div className="mt-1.5 grid gap-2">
            {(f.items ?? []).slice(0, 4).map((it, j) => (
              <span key={j} className="inline-flex items-center gap-1.5 font-medium" style={{ color: pal.green }}>
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
      <style>{MINT_CSS}{`@keyframes mint-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @media (prefers-reduced-motion: reduce){.mint-float{animation:none!important}}`}</style>
      {nav}
      <div style={{ paddingTop: "clamp(70px, 9vw, 120px)" }}>
        <div className={cn(MINT_WRAP, "text-center")}>
          {(p.cap || isEditor) && (
            <p className="mb-[18px] text-[14px] font-medium tracking-[0.01em]" style={{ color: muted, ...riseStyle(0) }}>
              <InlineText as="span" value={p.cap ?? ""} onUpdate={field("cap")} />
            </p>
          )}
          <h1 className="mx-auto" style={{ ...riseStyle(0.1), fontFamily: MINT_DISPLAY, fontSize: "clamp(2.6rem, 6vw, 5rem)", letterSpacing: "-0.035em", lineHeight: 1.02, fontWeight: 400, margin: 0, color: ink, textWrap: "balance" } as React.CSSProperties}>
            {isEditor ? (
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            ) : (
              <Headline text={p.headline} highlight={p.highlight} lime={pal.lime} />
            )}
          </h1>
          {(p.subheadline || isEditor) && (
            <p className="mx-auto" style={{ ...mintSub(muted), ...riseStyle(0.2) }}>
              <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
          <div className="mt-[26px]" style={riseStyle(0.3)}>
            <MintCtaButtons
              props={p}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
              source="mint-hero"
              style={p.ctaStyle === "pill" ? "pill" : "link"}
              primaryPlaceholder="Talk to the enterprise team"
              secondaryPlaceholder="See the proof"
            />
          </div>
        </div>

        {p.showImage !== false && (
          <div className={MINT_WIDE} style={{ marginTop: "clamp(44px, 6vw, 80px)" }}>
            <div className="relative" style={{ borderRadius: 22, aspectRatio: "16 / 9", background: pal.grey }}>
              <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 22 }}>
                {(p.imageUrl || isEditor) ? (
                  <InlineImage
                    src={p.imageUrl ?? ""}
                    alt={p.imageAlt ?? ""}
                    className="h-full w-full object-cover"
                    wrapperClassName="absolute inset-0"
                    style={{ filter: "saturate(.85)", transform: settled ? "scale(1)" : "scale(1.04)", transition: reduced ? "none" : "transform 2.2s cubic-bezier(.16,1,.3,1)" }}
                    focalPoint={p.imageFocal}
                    onUpdate={field("imageUrl")}
                    onAltUpdate={field("imageAlt")}
                    onFocalUpdate={field("imageFocal")}
                  />
                ) : (
                  <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${pal.mint} 0%, ${pal.mint2} 100%)` }} />
                )}
              </div>
              {floats.map(floatCard)}
            </div>
          </div>
        )}

        {stats.length > 0 && (
          <div className={cn(MINT_WRAP, "grid grid-cols-2 gap-x-5 gap-y-[34px] text-center", stats.length >= 3 ? "md:grid-cols-4" : "md:grid-cols-2")} style={{ marginTop: "clamp(48px, 6vw, 80px)" }}>
            {stats.map((s, i) => (
              <div key={i}>
                <MintNumber value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} className="block" style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(2.2rem, 4vw, 3.4rem)", letterSpacing: "-0.035em", color: ink }} />
                <span className="mx-auto mt-2.5 block max-w-[20ch] text-[14px] leading-[1.4]" style={{ color: muted }}>
                  <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} />
                </span>
              </div>
            ))}
          </div>
        )}

        {names.length > 0 && (
          <div className={MINT_WRAP}>
            <div className="flex flex-wrap justify-center gap-x-9 gap-y-3.5 text-[14px] font-medium" style={{ marginTop: "clamp(56px, 7vw, 88px)", paddingTop: 28, borderTop: `1px solid ${pal.line}`, color: muted }}>
              {names.map((n, i) => (
                <span key={i}><InlineText as="span" value={n} onUpdate={updateName ? (v) => updateName(i, v) : undefined} /></span>
              ))}
            </div>
          </div>
        )}
        <div style={{ height: "clamp(48px, 6vw, 80px)" }} />
      </div>
    </section>
  );
}
