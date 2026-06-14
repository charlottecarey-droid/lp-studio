import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { BRAND_BODY_STACK } from "@/lib/brand-fonts";

/* ----------------------------------------------------------------------------
 * Microsite chrome — shared full-page-template design-system primitives.
 *
 * Born from the "long white document" complaint: generated microsites had no
 * distinct header, no navbar, and stacked white text sections. These helpers
 * give every full-page template block (Exec Decision Brief, Deal Room,
 * Onboarding Hub, Value/Renewal Review, Storybrand Journey, Challenger Insight)
 * the same polished web-page chrome — a slim brand navbar that sits over a
 * dark/split hero, plus a `heroLayout` contract so a block never defaults to a
 * plain-white hero.
 *
 * Everything here is brand-derived and contrast-resolved; nothing is
 * Dandy-specific. All props are additive/optional with strong visual defaults.
 * -------------------------------------------------------------------------- */

const BODY = BRAND_BODY_STACK;

/** Hero presentation. Defaults across blocks lean to "split" or
 *  "image-overlay" — never "plain-white". `dark` is the headline-only dark
 *  band (used when a block has no hero image). */
export type HeroLayout = "split" | "image-overlay" | "dark";

/** Resolve a hero layout, honoring the prop but never returning a layout that
 *  needs an image when none is present. A block with no hero image and a
 *  requested image-overlay/split falls back to a dark headline band. */
export function resolveHeroLayout(
  requested: HeroLayout | undefined,
  hasImage: boolean,
  fallback: HeroLayout = "split",
): HeroLayout {
  const layout = requested ?? fallback;
  if (!hasImage && (layout === "split" || layout === "image-overlay")) return "dark";
  return layout;
}

export interface MicrositeNavLink {
  /** Visible label, e.g. "How it works". */
  label: string;
  /** In-page anchor (e.g. "#plan") or absolute URL. Empty links are dropped. */
  href: string;
}

interface NavbarProps {
  brand?: BrandConfig;
  /** Tenant-logo override URL; falls back to the brand logo. */
  logoUrl?: string;
  logoAlt?: string;
  /** Optional co-brand / account logo shown left of the tenant mark. */
  accountLogoUrl?: string;
  accountLogoAlt?: string;
  /** 0–4 anchor links rendered between the lockup and the CTA. */
  links?: MicrositeNavLink[];
  /** Primary CTA label. Hidden when empty. */
  ctaText?: string;
  /** Primary CTA href / anchor. */
  ctaUrl?: string;
  /** CTA fill + label colors, pre-resolved against the hero surface by the
   *  caller (so a brand whose accent ≈ hero stays legible). */
  ctaBg: string;
  ctaText_color: string;
  /** Surface the navbar sits on (the hero) — drives the logo tone + ink. */
  heroSurface: string;
  /** Whether the hero surface is dark (light ink + white logo). */
  isDark: boolean;
  /** Primary ink for links/lockup text (AA-resolved by the caller). */
  ink: string;
  /** Muted ink for the divider / inactive links. */
  inkMuted: string;
  /** Accent for the thin divider under the bar. */
  accent: string;
  /** Smooth-scroll handler for in-page anchors (honors reduced motion). */
  onAnchor?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
  /** Optional click handler for the CTA (modal-open path). */
  onCtaClick?: () => void;
}

/**
 * Slim top navbar that sits transparently over a (dark) hero: a logo lockup
 * (optional account/co-brand logo + tenant logo, NO hardcoded brand), optional
 * 2–4 anchor links, a primary CTA button, and a thin accent divider beneath.
 * Renders a brandName wordmark when no logo asset resolves. Focus-visible and
 * reduced-motion safe (anchor scroll handled by the caller).
 */
export function MicrositeNavbar({
  brand,
  logoUrl,
  logoAlt,
  accountLogoUrl,
  accountLogoAlt,
  links = [],
  ctaText,
  ctaUrl = "#",
  ctaBg,
  ctaText_color,
  heroSurface,
  isDark,
  ink,
  inkMuted,
  accent,
  onAnchor,
  onCtaClick,
}: NavbarProps) {
  const hasTenantLogo = !!brand && brandHasLogo(brand, logoUrl);
  const wordmark = brand?.brandName?.trim();
  const cleanLinks = links.filter((l) => l.label?.trim() && l.href?.trim()).slice(0, 4);
  const divider = mixHex(accent, heroSurface, isDark ? 0.45 : 0.65);

  const handle = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (onAnchor) onAnchor(e, href);
  };

  return (
    <div
      className="ms-navbar relative z-20"
      style={{ fontFamily: BODY }}
      role="navigation"
      aria-label="Page navigation"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-4 sm:px-8 sm:py-5 lg:px-10">
        {/* Logo lockup — optional account/co-brand logo + tenant logo / wordmark. */}
        <div className="flex min-w-0 items-center gap-3">
          {accountLogoUrl && (
            <>
              <img
                src={accountLogoUrl}
                alt={accountLogoAlt || "Account logo"}
                className={`h-7 w-auto shrink-0 ${isDark ? "brightness-0 invert" : ""}`}
                loading="eager"
              />
              <span aria-hidden className="h-5 w-px shrink-0" style={{ background: inkMuted }} />
            </>
          )}
          {hasTenantLogo && brand ? (
            <BrandLogo
              brand={brand}
              url={logoUrl}
              alt={logoAlt || brand.brandName || "Logo"}
              tone={isDark ? "onDark" : "onLight"}
              autoContrast
              className="h-7 w-auto shrink-0"
            />
          ) : wordmark ? (
            <span
              className="truncate text-base font-bold tracking-tight"
              style={{ color: ink, fontFamily: BODY }}
            >
              {wordmark}
            </span>
          ) : null}
        </div>

        {/* Anchor links — hidden on small screens, the CTA stays. */}
        {cleanLinks.length > 0 && (
          <div className="ml-auto hidden items-center gap-7 md:flex">
            {cleanLinks.map((l, i) => (
              <a
                key={i}
                href={l.href}
                onClick={(e) => handle(e, l.href)}
                className="text-sm font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
                style={{ color: inkMuted }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        {/* Primary CTA button. */}
        {ctaText && (
          <a
            href={ctaUrl}
            onClick={(e) => {
              if (ctaUrl.startsWith("#") && ctaUrl.length > 1) {
                handle(e, ctaUrl);
                return;
              }
              if (onCtaClick && (!ctaUrl || ctaUrl === "#")) {
                e.preventDefault();
                onCtaClick();
              }
            }}
            className={`inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2 text-sm font-semibold tracking-wide transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
              cleanLinks.length > 0 ? "" : "ml-auto"
            }`}
            style={{ background: ctaBg, color: ctaText_color }}
          >
            {ctaText}
          </a>
        )}
      </div>
      {/* Thin accent divider, like the approved DSO example. */}
      <div aria-hidden className="h-px w-full" style={{ background: divider }} />
    </div>
  );
}

interface DarkHeroBackdropProps {
  /** Hero surface base. */
  surface: string;
  /** Brand accent used for the top glow + aurora orbs. */
  accent: string;
  /** Brand primary, folded into the secondary aurora orb. */
  primary: string;
  /** Suppress animation (builder / reduced motion). */
  isStatic?: boolean;
  /** Unique class prefix so multiple instances don't collide. */
  idPrefix: string;
  children?: ReactNode;
}

/**
 * Layered dark-hero backdrop: a top accent glow + corner vignette + two
 * slow-drifting aurora orbs (paused under reduced motion / in builder). Keeps a
 * dark hero surface from reading flat. Mirrors the BlockChallengerInsight
 * treatment so every full-page block hits the same quality bar.
 */
export function DarkHeroBackdrop({
  surface,
  accent,
  primary,
  isStatic,
  idPrefix,
  children,
}: DarkHeroBackdropProps) {
  return (
    <>
      <style>{`
        .${idPrefix}-aurora { will-change: transform; }
        .${idPrefix}-aurora-1 { animation: ${idPrefix}-drift-1 28s ease-in-out infinite alternate; }
        .${idPrefix}-aurora-2 { animation: ${idPrefix}-drift-2 34s ease-in-out infinite alternate; }
        @keyframes ${idPrefix}-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(6%, 8%, 0) scale(1.1); }
        }
        @keyframes ${idPrefix}-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.06); }
          to   { transform: translate3d(-7%, -6%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .${idPrefix}-aurora { animation: none !important; }
        }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(80% 55% at 18% -10%, ${mixHex(accent, surface, 0.16)} 0%, transparent 60%), radial-gradient(120% 80% at 50% 120%, rgba(0,0,0,0.5) 0%, transparent 55%)`,
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span
          className={`${idPrefix}-aurora ${isStatic ? "" : `${idPrefix}-aurora-1`} absolute rounded-full`}
          style={
            {
              width: "46rem",
              height: "46rem",
              top: "-20rem",
              left: "-14rem",
              background: `radial-gradient(closest-side, ${mixHex(accent, surface, 0.28)} 0%, transparent 70%)`,
              filter: "blur(20px)",
              opacity: 0.5,
            } as CSSProperties
          }
        />
        <span
          className={`${idPrefix}-aurora ${isStatic ? "" : `${idPrefix}-aurora-2`} absolute rounded-full`}
          style={
            {
              width: "40rem",
              height: "40rem",
              bottom: "-18rem",
              right: "-12rem",
              background: `radial-gradient(closest-side, ${mixHex(primary, surface, 0.4)} 0%, transparent 70%)`,
              filter: "blur(26px)",
              opacity: 0.42,
            } as CSSProperties
          }
        />
      </div>
      {children}
    </>
  );
}

/**
 * Resolve a dark hero surface from the brand primary, mixed into near-black so
 * the hero leans the tenant's hue. Used by blocks whose body surface is light
 * but whose hero must be dark/brand-colored. `nearBlack` lets a block keep its
 * own deep-tone identity (indigo vs. navy vs. forest).
 */
export function resolveDarkHeroSurface(
  brand: BrandConfig | undefined,
  override: string | undefined,
  isValidHexFn: (h?: string) => boolean,
  nearBlack = "#0B0B12",
  primaryFallback = "#16263F",
): string {
  if (override && isValidHexFn(override)) return override;
  const primary =
    brand?.primaryColor && isValidHexFn(brand.primaryColor) ? brand.primaryColor : primaryFallback;
  return mixHex(primary, nearBlack, 0.42);
}

/** Convenience: AA-aware ink picks for hero chrome over a dark surface. */
export function heroChromeInk(surface: string): { ink: string; muted: string } {
  const ink = pickContrastingColor("#F6F7F9", surface, ["#FFFFFF"], 4.5);
  const muted = mixHex(ink, surface, 0.72);
  return { ink, muted };
}
