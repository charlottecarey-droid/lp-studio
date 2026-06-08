import type { BackgroundStyle } from "../bg-styles";
import type { CtaModalConfig, NavHeaderLink, PopupTrigger } from "./common";

export type NavCtaAction = "url" | "chilipiper" | "modal-form" | "modal-chilipiper";

export interface NavHeaderBlockProps extends CtaModalConfig {
  logoText: string;
  logoUrl: string;
  navLinks: NavHeaderLink[];
  phone: string;
  cta1: { label: string; url: string };
  cta2: { label: string; url: string };
  /** How CTA 1 (secondary) behaves on click. Defaults to "url". */
  cta1Action?: NavCtaAction;
  /** How CTA 2 (primary) behaves on click. Defaults to "url". */
  cta2Action?: NavCtaAction;
  /** Optional CSS background color for the header bar. Falls back to white
   *  when unset. Accepts any CSS color (`#hex`, `rgb()`, `var(--brand-…)`). */
  backgroundColor?: string;
  /** Optional background image URL layered behind the bar contents. Sized
   *  with `cover` and centered. Combine with `backgroundOverlay` to dim. */
  backgroundImage?: string;
  /** 0–1 dark overlay applied on top of `backgroundImage` so logo + text
   *  remain legible. Default 0 (no overlay). */
  backgroundOverlay?: number;
  /** Override for header text/logo/nav color. When unset, falls back to the
   *  historical slate-900 / slate-600 palette. */
  textColor?: string;
  /** Optional CSS `font-family` stack applied to header text (logo, nav
   *  links, CTAs). Accepts any valid CSS font stack. When unset, inherits
   *  from the page. */
  fontFamily?: string;
}

export interface CtaButtonBlockProps extends CtaModalConfig {
  label: string;
  url: string;
  style: "primary" | "secondary" | "outline";
  size: "small" | "medium" | "large";
  alignment: "left" | "center" | "right";
  bgColor: string;
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  chilipiperUrl?: string;
}

export interface PopupBlockProps {
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  ctaColor: string;
  imageUrl: string;
  trigger: PopupTrigger;
  triggerValue: number;
  showOnce: boolean;
  overlayOpacity: number;
  position: "center" | "bottom-left" | "bottom-right";
  backgroundStyle: BackgroundStyle;
  ctaType: "url" | "chilipiper";
  chilipiperUrl: string;
  chilipiperCaptureName: boolean;
}

export interface StickyHeaderNavLink {
  label: string;
  href: string;
}

export interface StickyHeaderBlockProps extends CtaModalConfig {
  logoUrl?: string;
  logoAlt?: string;
  /** Optional partner / company shown after logo as "× Company" */
  companyName?: string;
  /** Navigation links — if href starts with #, smooth-scrolls to that anchor */
  navLinks?: StickyHeaderNavLink[];
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  /** How the primary CTA behaves on click. Defaults to "url" so existing
   *  pages keep their plain-link behavior. */
  primaryCtaAction?: NavCtaAction;
  /** Used when primaryCtaAction === "chilipiper" (direct iframe popup). */
  chilipiperUrl?: string;
  /** Visual theme. "dark" uses blurred dark glass; "light" uses white glass. */
  theme?: "dark" | "light";
  /** CTA background color. Falls back to the brand accent when unset. */
  accentColor?: string;
  /** CTA button shape.
   *  - "pill" — fully rounded pill button.
   *  - "square" — squared / sharp-cornered button.
   *  - "default" — follows the brand's button shape from Brand Settings.
   *  - "pass" — legacy value kept so previously saved pages keep rendering;
   *    no longer offered in the picker (falls back to default rendering). */
  ctaStyle?: "pill" | "square" | "default" | "pass";
  /** "fixed" overlays the hero (premium feel). "sticky" stays in flow. */
  position?: "fixed" | "sticky";
  /** Force invert the logo to white (auto-true for dark theme). */
  invertLogo?: boolean;
  /** Pixels of scroll before fade-to-solid. */
  scrollThreshold?: number;
  /** Visual theme applied to the in-page modal opened by this header's
   *  primary CTA when `primaryCtaAction` is "modal-form" / "modal-chilipiper".
   *  "dark" matches dark cinematic templates (Inside Dandy) so the outer
   *  modal shell blends with the inner form card. Defaults to "light" so
   *  existing usages on other templates are unchanged. */
  modalTheme?: "light" | "dark";
}

export interface StickyBarBlockProps {
  text: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
  chilipiperUrl?: string;
  ctaColor: string;
  position: "top" | "bottom";
  backgroundStyle: BackgroundStyle | "brand";
  showAfterScroll: number;
  dismissible: boolean;
}
