import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { HUB_BODY, HUB_CSS, HUB_PILL_CLASS, HUB_PILL_SM_CLASS, HubKicker, hubDisplayStyle, hubPillStyle, resolveHubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Content Hub Hero — type "hub-hero"
 *
 * The top of an ungated resource library: a brand-dark surface, the hub's
 * own sticky top bar (logo · an AUDIENCE SWITCH — e.g. "For dentists" /
 * "For patients" — · a contact pill), a letter-spaced kicker, a large light
 * display headline, a short paragraph, a pill CTA that jumps to the library
 * and a ghost secondary, then a row of micro-facts ("18 resources · PDFs &
 * videos · No login"). Renders its OWN top bar — never precede it with a nav
 * block. The audience switch highlights the link whose path matches the
 * current page, so two hub pages cross-link with one shared block config.
 * -------------------------------------------------------------------------- */

export interface HubNavLink {
  label: string;
  url: string;
}

export interface HubFact {
  label: string;
}

export interface HubHeroBlockProps extends HubStyleProps {
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
  ctaUrl?: string;
  secondaryText?: string;
  secondaryUrl?: string;
  facts?: HubFact[];
  /** Optional photo behind the copy (dimmed). NOT `videoUrl` — that is the Page-CTA video-modal slot on a hero. */
  mediaImageUrl?: string;
  mediaImageAlt?: string;
  /** Viewport height in vh. Default 64 (capped at 760px). */
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
  surface: "dark",
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
  ctaUrl: "#library",
  secondaryText: "Start here",
  secondaryUrl: "#featured",
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

export function BlockHubHero({ props, brand, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "dark");
  const isEditor = !!onFieldChange;
  const facts = props.facts ?? [];
  const links = (props.navLinks ?? []).filter((l) => l && (l.label || isEditor));
  const logo = props.logoUrl || (pal.isDark ? brand.logoUrlDark || brand.logoUrl : brand.logoUrl || brand.logoUrlDark) || "";
  const logoText = props.logoText || brand.brandName || "";
  const pathname = typeof window !== "undefined" ? window.location.pathname : null;
  const active = activeNavIndex(links, pathname);
  const bgImage = (props.mediaImageUrl ?? "").trim();

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

  return (
    <section
      className="hub-hero relative flex flex-col overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY, minHeight: `min(${props.minHeightVh ?? 64}vh, 760px)` }}
    >
      <style>{HUB_CSS}</style>

      {/* Backdrop: optional photo (dimmed) + an accent halo + a faint grid. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {bgImage && <img src={bgImage} alt={props.mediaImageAlt ?? ""} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.28 }} />}
        <div className="absolute inset-0" style={{ background: `radial-gradient(60% 70% at 85% 30%, color-mix(in srgb, ${pal.accentFill} 18%, transparent) 0%, transparent 70%)` }} />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `linear-gradient(${pal.text} 1px, transparent 1px), linear-gradient(90deg, ${pal.text} 1px, transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(80% 80% at 70% 40%, #000 20%, transparent 100%)" }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${pal.bg}00 55%, ${pal.bg} 100%)` }} />
      </div>

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30" style={{ background: `linear-gradient(180deg, ${pal.bg}f2, ${pal.bg}00)`, backdropFilter: "blur(8px)" }}>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-4 md:flex-nowrap md:px-8">
          <a href="/" className="flex shrink-0 items-center no-underline" aria-label={logoText || "Home"} style={{ color: pal.text }}>
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
              <div className="mx-auto inline-flex max-w-full items-center gap-1 rounded-full p-1" style={{ border: `1px solid ${pal.hairline}`, background: `color-mix(in srgb, ${pal.text} 5%, transparent)` }}>
                {links.map((l, i) => {
                  const isActive = i === active;
                  return (
                    <a
                      key={i}
                      href={l.url || "#"}
                      aria-current={isActive ? "page" : undefined}
                      className="inline-flex min-h-[34px] items-center whitespace-nowrap rounded-full px-4 text-[13px] font-semibold no-underline transition-colors"
                      style={isActive ? { background: pal.accentFill, color: pal.onAccentFill } : { color: pal.muted }}
                      data-hub-audience={isActive ? "active" : "inactive"}
                    >
                      <InlineText as="span" value={l.label} onUpdate={updateLink ? (v) => updateLink(i, v) : undefined} />
                    </a>
                  );
                })}
              </div>
            </nav>
          )}

          {(props.navCtaText || isEditor) && (
            <a href={props.navCtaUrl || "#support"} onClick={go(props.navCtaUrl || "#support")} className={cn(HUB_PILL_SM_CLASS, "shrink-0")} style={hubPillStyle(pal, "ghost")}>
              <InlineText as="span" value={props.navCtaText ?? ""} onUpdate={field("navCtaText")} />
            </a>
          )}
        </div>
      </div>

      {/* Copy */}
      <div className="relative z-10 mx-auto flex w-full max-w-page flex-1 flex-col justify-center px-6 pb-16 pt-10 lg:px-10 lg:pb-24 lg:pt-14">
        <div className="max-w-[760px]">
          {(props.kicker || isEditor) && (
            <motion.div {...rise(0)} className="mb-6">
              <HubKicker palette={pal}>
                <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
              </HubKicker>
            </motion.div>
          )}
          <motion.h1 {...rise(0.08)} className="max-w-[16ch] whitespace-pre-line" style={hubDisplayStyle("clamp(2.4rem, 5.2vw, 4.5rem)")}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h1>
          {(props.subheadline || isEditor) && (
            <motion.p {...rise(0.16)} className="mt-6 max-w-[56ch] text-[16px] leading-relaxed lg:text-[18px]" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
          {(props.ctaText || props.secondaryText || isEditor) && (
            <motion.div {...rise(0.22)} className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              {(props.ctaText || isEditor) && (
                <a href={props.ctaUrl || "#library"} onClick={go(props.ctaUrl || "#library")} className={HUB_PILL_CLASS} style={hubPillStyle(pal)}>
                  <InlineText as="span" value={props.ctaText ?? ""} onUpdate={field("ctaText")} />
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              )}
              {(props.secondaryText || isEditor) && (
                <a href={props.secondaryUrl || "#featured"} onClick={go(props.secondaryUrl || "#featured")} className={HUB_PILL_CLASS} style={hubPillStyle(pal, "ghost")}>
                  <InlineText as="span" value={props.secondaryText ?? ""} onUpdate={field("secondaryText")} />
                </a>
              )}
            </motion.div>
          )}
          {facts.length > 0 && (
            <motion.ul {...rise(0.3)} className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.faint }}>
              {facts.map((f, i) => (
                <li key={i} className="flex items-center gap-5">
                  {i > 0 && <span aria-hidden="true" className="block h-1 w-1 rounded-full" style={{ background: pal.accentFill }} />}
                  <InlineText as="span" value={f.label} onUpdate={updateFact ? (v) => updateFact(i, v) : undefined} />
                </li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </section>
  );
}
