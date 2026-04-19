import type { BackgroundStyle } from "../bg-styles";
import type { NavHeaderLink, PopupTrigger } from "./common";

export interface NavHeaderBlockProps {
  logoText: string;
  logoUrl: string;
  navLinks: NavHeaderLink[];
  phone: string;
  cta1: { label: string; url: string };
  cta2: { label: string; url: string };
}

export interface CtaButtonBlockProps {
  label: string;
  url: string;
  style: "primary" | "secondary" | "outline";
  size: "small" | "medium" | "large";
  alignment: "left" | "center" | "right";
  bgColor: string;
  ctaAction?: "url" | "chilipiper";
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

export interface StickyHeaderBlockProps {
  logoUrl?: string;
  logoAlt?: string;
  /** Optional partner / company shown after logo as "× Company" */
  companyName?: string;
  /** Navigation links — if href starts with #, smooth-scrolls to that anchor */
  navLinks?: StickyHeaderNavLink[];
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  /** Visual theme. "dark" uses blurred dark glass; "light" uses white glass. */
  theme?: "dark" | "light";
  /** CTA pill background color (defaults to Dandy primary). */
  accentColor?: string;
  /** "fixed" overlays the hero (premium feel). "sticky" stays in flow. */
  position?: "fixed" | "sticky";
  /** Force invert the logo to white (auto-true for dark theme). */
  invertLogo?: boolean;
  /** Pixels of scroll before fade-to-solid. */
  scrollThreshold?: number;
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
