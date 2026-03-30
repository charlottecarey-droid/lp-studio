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
