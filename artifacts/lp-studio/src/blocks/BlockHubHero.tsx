import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImageButton } from "@/components/InlineImageButton";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig, type CtaSecondaryFields, type CtaSuiteFields } from "@/lib/cta-modal";
import { safeNavigate } from "@/lib/safe-url";
import { usePageContext } from "@/lib/page-context";
import { trackHubInteraction } from "./hub/hub-assets";
import { HUB_BODY, HUB_CSS, HUB_PILL_CLASS, HUB_PILL_SM_CLASS, HubKicker, hubDisplayStyle, hubPillStyle, resolveHubPalette, type HubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Content Hub Hero — type "hub-hero"
 *
 * The top of an ungated resource library: the hub's own sticky top bar
 * (logo · an AUDIENCE SWITCH — e.g. "For dentists" / "For patients" — · a
 * contact pill), a kicker, a large display headline, a short paragraph, a
 * pill CTA that jumps to the library and a ghost secondary, then a row of
 * micro-facts ("18 resources · PDFs & videos · No login"). Renders its OWN
 * top bar — never precede it with a nav block. The audience switch
 * highlights the link whose path matches the current page, so two hub pages
 * cross-link with one shared block config.
 *
 * The `theme` preset picks the layout (see lib/hub-theme):
 *   site      brand-dark solid bar · light hero · copy left, photo right
 *   midnight  glass bar on a brand-dark hero · halo + grid · photo dimmed behind
 *   gallery   paper bar · centered oversized title · photo as a wide panel below
 *   mono      paper bar · compact left-aligned hero
 * -------------------------------------------------------------------------- */

export interface HubNavLink {
  label: string;
  url: string;
}

export interface HubFact {
  label: string;
}

/**
 * Both hero buttons use the shared CTA suite: `ctaAction` (link · Chili Piper
 * · form modal · Chili Piper modal · video modal) + the per-action
 * destinations + the shared `modal*` form config (simple / linked global form
 * / Marketo). The secondary button uses the canonical `ctaSecondary*` keys;
 * `secondaryText` / `secondaryUrl` are the pre-suite names, still read.
 */
export interface HubHeroBlockProps extends HubStyleProps, CtaSuiteFields, CtaSecondaryFields {
  logoText?: string;
  logoUrl?: string;
  /** The audience switch. Two or three short links; the one matching the current path is highlighted. */
  navLinks?: HubNavLink[];
  navCtaText?: string;
  navCtaUrl?: string;
  kicker?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  /** @deprecated use ctaSecondaryText */
  secondaryText?: string;
  /** @deprecated use ctaSecondaryUrl */
  secondaryUrl?: string;
  facts?: HubFact[];
  /** Optional photo. Beside the copy (site), dimmed behind it (midnight), a panel below (gallery). NOT `videoUrl` — that is the Page-CTA video-modal slot on a hero. */
  mediaImageUrl?: string;
  mediaImageAlt?: string;
  /** Viewport height in vh (backdrop layout only). Default 64 (capped at 760px). */
  minHeightVh?: number;
}

interface Props {
  props: HubHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: HubHeroBlockProps) => void;
}

export const HUB_HERO_DEFAULT_PROPS: HubHeroBlockProps = {
  logoText: "",
  logoUrl: "",
  navLinks: [
    { label: "For teams", url: "/teams" },
    { label: "For customers", url: "/customers" },
  ],
  navCtaText: "Email support",
  navCtaUrl: "mailto:support@example.com",
  kicker: "Resource hub",
  headline: "Everything you need,\nright when you need it.",
  subheadline: "Guides, videos and reference sheets for every stage — open anything in a click, download what you want to keep. No login required.",
  ctaText: "Browse the library",
  ctaAction: "url",
  ctaUrl: "#library",
  ctaSecondaryText: "Start here",
  ctaSecondaryAction: "url",
  ctaSecondaryUrl: "#featured",
  facts: [{ label: "PDFs & videos" }, { label: "No login" }, { label: "Always up to date" }],
  mediaImageUrl: "",
  mediaImageAlt: "",
  minHeightVh: 64,
};

/** Which audience link is "current": the one whose path equals the page path (trailing slashes ignored). Falls back to the first link. */
export function activeNavIndex(links: HubNavLink[], pathname: string | null): number {
  if (!links.length) return -1;
  if (pathname) {
    const norm = (p: string) => {
      try {
        const u = p.startsWith("http") ? new URL(p).pathname : p.split("?")[0].split("#")[0];
        return (u || "/").replace(/\/+$/, "").toLowerCase() || "/";
      } catch {
        return p.toLowerCase();
      }
    };
    const cur = norm(pathname);
    const i = links.findIndex((l) => l.url && norm(l.url) === cur);
    if (i >= 0) return i;
  }
  return 0;
}

/** The top bar's own palette: the preset's "solid" bar is brand-dark whatever the hero surface. */
function barPalette(pal: HubPalette): HubPalette {
  if (pal.t.topBar !== "solid" || pal.isDark) return pal;
  const d = pal.dark;
  return { ...pal, isDark: true, bg: d.bg, card: d.panel, cardRaised: d.panelRaised, text: d.text, heading: d.text, muted: d.muted, faint: d.faint, hairline: d.hairline, accent: d.accent, accentFill: d.accent, onAccentFill: pal.onAccentFill };
}

export function BlockHubHero({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "hero");
  const t = pal.t;
  const bar = barPalette(pal);
  const isEditor = !!onFieldChange;
  const facts = props.facts ?? [];
  const links = (props.navLinks ?? []).filter((l) => l && (l.label || isEditor));
  const logo = props.logoUrl || (bar.isDark ? brand.logoUrlDark || brand.logoUrl : brand.logoUrl || brand.logoUrlDark) || "";
  const logoText = props.logoText || brand.brandName || "";
  const pathname = typeof window !== "undefined" ? window.location.pathname : null;
  const active = activeNavIndex(links, pathname);
  const pageCtx = usePageContext();
  const trackCtx = { pageId: pageId ?? pageCtx.pageId, sessionId: pageCtx.sessionId };
  const image = (props.mediaImageUrl ?? "").trim();
  const layout = t.heroLayout;
  const centered = layout === "centered";

  const field = (key: keyof HubHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as HubHeroBlockProps[typeof key] }) : undefined;
  const updateFact = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, facts: facts.map((f, idx) => (idx === i ? { label: v } : f)) })
    : undefined;
  const updateLink = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, navLinks: links.map((l, idx) => (idx === i ? { ...l, label: v } : l)) })
    : undefined;

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const go = (url?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    onCtaClick?.();
    if (url && url.startsWith("#")) {
      const el = document.getElementById(url.slice(1));
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    }
  };
  // URL-mode CTA buttons (the CtaButton owns modal / Chili Piper / video actions).
  const navigate = (url?: string) => () => {
    if (isEditor) return;
    onCtaClick?.();
    const u = (url ?? "").trim();
    if (!u || u === "#") return;
    if (u.startsWith("#")) {
      const el = document.getElementById(u.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        return;
      }
    }
    const sameTab = u.startsWith("#") || u.startsWith("/") || u.startsWith("?") || u.startsWith("mailto:");
    safeNavigate(u, sameTab ? "_self" : "_blank");
  };
  const modalCfg = pickCtaModalConfig(props);
  const primaryAction = props.ctaAction ?? "url";
  const secondaryText = props.ctaSecondaryText ?? props.secondaryText ?? "";
  const secondaryUrl = props.ctaSecondaryUrl ?? props.secondaryUrl ?? "";
  const secondaryAction = props.ctaSecondaryAction ?? "url";
  const secondaryKey: keyof HubHeroBlockProps = props.ctaSecondaryText !== undefined || props.secondaryText === undefined ? "ctaSecondaryText" : "secondaryText";

  /* ── Top bar ─────────────────────────────────────────────────────────── */
  const barStyle: React.CSSProperties =
    t.topBar === "glass"
      ? { background: `linear-gradient(180deg, ${pal.bg}f2, ${pal.bg}00)`, backdropFilter: "blur(8px)" }
      : t.topBar === "solid"
        ? { background: bar.bg, color: bar.text }
        : { background: pal.bg, color: pal.text, borderBottom: `1px solid ${pal.hairline}` };
  const switchBg = bar.isDark ? `color-mix(in srgb, ${bar.text} 7%, transparent)` : pal.cardTint;
  const topBar = (
    <div className="sticky top-0 z-30" style={barStyle}>
      <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-4 md:flex-nowrap md:px-8">
        <a href="/" className="flex shrink-0 items-center no-underline" aria-label={logoText || "Home"} style={{ color: bar.text }}>
          {logo ? (
            <img src={logo} alt={logoText || "Logo"} className="h-6 w-auto" />
          ) : (
            <span className="text-lg font-semibold tracking-tight">
              <InlineText as="span" value={logoText || "Brand"} onUpdate={field("logoText")} />
            </span>
          )}
        </a>

        {links.length > 0 && (
          <nav aria-label="Audience" className="order-3 w-full md:order-none md:w-auto">
            <div className="mx-auto inline-flex max-w-full items-center gap-1 rounded-full p-1" style={{ border: `1px solid ${bar.hairline}`, background: switchBg }}>
              {links.map((l, i) => {
                const isActive = i === active;
                return (
                  <a
                    key={i}
                    href={l.url || "#"}
                    aria-current={isActive ? "page" : undefined}
                    className="inline-flex min-h-[34px] items-center whitespace-nowrap rounded-full px-4 text-[13px] font-semibold no-underline transition-colors"
                    style={isActive ? { background: bar.accentFill, color: bar.onAccentFill } : { color: bar.muted }}
                    data-hub-audience={isActive ? "active" : "inactive"}
                    onClick={() => {
                      if (!isActive && !isEditor) trackHubInteraction(trackCtx, "audience", { detail: l.url || l.label });
                    }}
                  >
                    <InlineText as="span" value={l.label} onUpdate={updateLink ? (v) => updateLink(i, v) : undefined} />
                  </a>
                );
              })}
            </div>
          </nav>
        )}

        {(props.navCtaText || isEditor) && (
          <a href={props.navCtaUrl || "#support"} onClick={go(props.navCtaUrl || "#support")} className={cn(HUB_PILL_SM_CLASS, "shrink-0")} style={hubPillStyle(bar, "ghost", "sm")}>
            <InlineText as="span" value={props.navCtaText ?? ""} onUpdate={field("navCtaText")} />
          </a>
        )}
      </div>
    </div>
  );

  /* ── Copy ─────────────────────────────────────────────────────────────── */
  const h1Size = layout === "compact" ? "clamp(2rem, 3.6vw, 3rem)" : centered ? "clamp(2.4rem, 5vw, 4.5rem)" : layout === "split" ? "clamp(2.4rem, 4.6vw, 4.25rem)" : "clamp(2.4rem, 5.2vw, 4.5rem)";
  const copy = (
    <div className={cn("flex flex-col", centered ? "items-center text-center" : "items-start")}>
      {(props.kicker || isEditor) && (
        <motion.div {...rise(0)} className={layout === "compact" ? "mb-4" : "mb-6"}>
          <HubKicker palette={pal} align={centered ? "center" : "left"}>
            <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
          </HubKicker>
        </motion.div>
      )}
      <motion.h1 {...rise(0.08)} className={cn("whitespace-pre-line", centered ? "max-w-none" : "max-w-[16ch]")} style={hubDisplayStyle(pal, h1Size)}>
        <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
      </motion.h1>
      {(props.subheadline || isEditor) && (
        <motion.p {...rise(0.16)} className={cn("max-w-[56ch] leading-relaxed", layout === "compact" ? "mt-4 text-[15px] lg:text-[17px]" : "mt-6 text-[16px] lg:text-[18px]")} style={{ color: pal.muted }}>
          <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
        </motion.p>
      )}
      {(props.ctaText || secondaryText || isEditor) && (
        <motion.div {...rise(0.22)} className={cn("flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center", layout === "compact" ? "mt-6" : "mt-8")}>
          {(props.ctaText || isEditor) && (
            <CtaButton
              ctaAction={primaryAction}
              ctaUrl={props.ctaUrl || "#library"}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              {...modalCfg}
              onClick={primaryAction === "url" ? navigate(props.ctaUrl || "#library") : undefined}
              className={HUB_PILL_CLASS}
              style={hubPillStyle(pal)}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="hub-hero-primary"
              modalTheme={pal.isDark ? "dark" : "light"}
              animationsEnabled={!reduced}
            >
              <InlineText as="span" value={props.ctaText ?? ""} onUpdate={field("ctaText")} />
              <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaButton>
          )}
          {(secondaryText || isEditor) && (
            <CtaButton
              ctaAction={secondaryAction}
              ctaUrl={secondaryUrl || "#featured"}
              chilipiperUrl={props.secondaryChilipiperUrl}
              videoUrl={props.secondaryVideoUrl}
              {...modalCfg}
              onClick={secondaryAction === "url" ? navigate(secondaryUrl || "#featured") : undefined}
              className={HUB_PILL_CLASS}
              style={hubPillStyle(pal, "ghost")}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="hub-hero-secondary"
              modalTheme={pal.isDark ? "dark" : "light"}
              animationsEnabled={!reduced}
            >
              <InlineText as="span" value={secondaryText} onUpdate={field(secondaryKey)} />
            </CtaButton>
          )}
        </motion.div>
      )}
      {facts.length > 0 && (
        <motion.ul {...rise(0.3)} className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.22em]", centered && "justify-center", layout === "compact" ? "mt-7" : "mt-9")} style={{ color: pal.faint }}>
          {facts.map((f, i) => (
            <li key={i} className="flex items-center gap-5">
              {i > 0 && <span aria-hidden="true" className="block h-1 w-1 rounded-full" style={{ background: pal.accentFill }} />}
              <InlineText as="span" value={f.label} onUpdate={updateFact ? (v) => updateFact(i, v) : undefined} />
            </li>
          ))}
        </motion.ul>
      )}
    </div>
  );

  const photoButton = isEditor ? (
    <InlineImageButton value={image} onChange={(v) => onFieldChange?.({ ...props, mediaImageUrl: v })} label="Hero photo" alt={props.mediaImageAlt ?? ""} onAltChange={(v) => onFieldChange?.({ ...props, mediaImageAlt: v })} />
  ) : null;
  // The photo slot. Live: nothing without a photo. Builder: a dashed slot with the Add-image pill so the slot is discoverable.
  const photo = (cls: string, radius: number) =>
    image ? (
      <motion.div {...rise(0.12)} className={cn("relative overflow-hidden", cls)} style={{ borderRadius: radius, background: pal.cardTint, boxShadow: pal.isDark ? "none" : "0 40px 80px -48px rgba(0,0,0,0.35)" }}>
        <img src={image} alt={props.mediaImageAlt ?? ""} className="absolute inset-0 h-full w-full object-cover" />
        {photoButton}
      </motion.div>
    ) : isEditor ? (
      <div className={cn("relative flex items-center justify-center overflow-hidden", cls)} style={{ borderRadius: radius, border: `2px dashed ${pal.hairline}`, color: pal.faint }} data-hub-photo-slot>
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em]">Photo slot</span>
        {photoButton}
      </div>
    ) : null;

  /* ── Layouts ──────────────────────────────────────────────────────────── */
  if (layout === "backdrop") {
    return (
      <section className="hub-hero relative flex flex-col overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY, minHeight: `min(${props.minHeightVh ?? 64}vh, 760px)` }}>
        <style>{HUB_CSS}</style>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {image && <img src={image} alt={props.mediaImageAlt ?? ""} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.28 }} />}
          <div className="absolute inset-0" style={{ background: `radial-gradient(60% 70% at 85% 30%, color-mix(in srgb, ${pal.accentFill} 18%, transparent) 0%, transparent 70%)` }} />
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `linear-gradient(${pal.text} 1px, transparent 1px), linear-gradient(90deg, ${pal.text} 1px, transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(80% 80% at 70% 40%, #000 20%, transparent 100%)" }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${pal.bg}00 55%, ${pal.bg} 100%)` }} />
        </div>
        {topBar}
        <div className="relative z-10 mx-auto flex w-full max-w-page flex-1 flex-col justify-center px-6 pb-16 pt-10 lg:px-10 lg:pb-24 lg:pt-14">
          <div className="max-w-[760px]">{copy}</div>
          {isEditor && (
            <div className="absolute right-6 top-4 lg:right-10">
              <InlineImageButton value={image} onChange={(v) => onFieldChange?.({ ...props, mediaImageUrl: v })} label="Backdrop photo" inline alt={props.mediaImageAlt ?? ""} onAltChange={(v) => onFieldChange?.({ ...props, mediaImageAlt: v })} />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (layout === "centered") {
    return (
      <section className="hub-hero relative flex flex-col" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
        <style>{HUB_CSS}</style>
        {topBar}
        <div className="relative z-10 mx-auto flex w-full max-w-page flex-col items-center px-6 pb-14 pt-14 lg:px-10 lg:pb-20 lg:pt-24">
          <div className="flex w-full max-w-[1040px] flex-col items-center">{copy}</div>
          {photo("mt-12 w-full max-w-[1100px] aspect-[21/9] lg:mt-16", 28)}
        </div>
      </section>
    );
  }

  if (layout === "compact") {
    return (
      <section className="hub-hero relative flex flex-col" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
        <style>{HUB_CSS}</style>
        {topBar}
        <div className="relative z-10 mx-auto grid w-full max-w-page items-center gap-10 px-6 pb-12 pt-12 lg:grid-cols-12 lg:px-10 lg:pb-16 lg:pt-16">
          <div className={image || isEditor ? "lg:col-span-7" : "max-w-[720px] lg:col-span-12"}>{copy}</div>
          {photo("aspect-[4/3] lg:col-span-5", 16)}
        </div>
        <div className="mx-auto w-full max-w-page px-6 lg:px-10" aria-hidden="true">
          <div className="h-px w-full" style={{ background: pal.hairline }} />
        </div>
      </section>
    );
  }

  // "split" — the brand-site idiom: copy left, photo right.
  return (
    <section className="hub-hero relative flex flex-col" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
      <style>{HUB_CSS}</style>
      {topBar}
      <div className="relative z-10 mx-auto grid w-full max-w-page items-center gap-10 px-6 pb-16 pt-12 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24 lg:pt-20">
        <div className={image || isEditor ? "lg:col-span-6" : "max-w-[760px] lg:col-span-12"}>{copy}</div>
        {photo("aspect-[4/3] w-full lg:col-span-6", 24)}
      </div>
    </section>
  );
}
