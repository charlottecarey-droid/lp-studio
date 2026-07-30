import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useAnimInitial } from "@/lib/reveal-fallback";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickContrastingColor } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { safeNavigate } from "@/lib/safe-url";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BlockForm } from "./BlockForm";
import type { FormBlockProps } from "@/lib/block-types";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import {
  MicrositeNavbar,
  heroChromeInk,
  resolveDarkHeroSurface,
  resolveHeroLayout,
  type HeroLayout,
  type MicrositeNavLink,
} from "./microsite-chrome";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Event Activations — type "event-activations"
 *
 * Full-page conference-presence template modeled on the "visit us at the
 * show" pages sponsors publish per event (hero lockup with booth number, a
 * tinted band listing every activation — breakout session, lounge, social,
 * booth demo — and a book-a-meeting close). Renders its own navbar (shared
 * MicrositeNavbar chrome), so it composes like the other full-page Events
 * templates rather than pairing with a separate nav block.
 *
 * Feature parity with the "Premium Events Page" (event-landing-hero):
 *   - CTA options: bg/text/hover colors, premium drop shadow, animated shine
 *   - inline image editing (hover-replace, alt text, focal point)
 *   - per-section show/hide toggles; every optional field render-guarded
 *   - booking close is a big CTA button (external scheduler link) OR an
 *     embedded form — linked global form (formId) or a raw Marketo embed
 *
 * `ctaText`/`ctaUrl` are the block's PRIMARY (page-CTA-followed) button — the
 * book-a-meeting action. The hero/nav/per-activation links use non-alias key
 * names on purpose so the Page CTA never rewrites them.
 * -------------------------------------------------------------------------- */

export interface EventActivationItem {
  /** Small chip above the title, e.g. "Breakout session | Day 2 · 4:45 PM". */
  kicker?: string;
  title: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** CSS object-position for the image, e.g. "50% 30%". */
  imageFocalPoint?: string;
  /** Optional link under the body, e.g. "RSVP here" → external RSVP or #book. */
  linkText?: string;
  linkUrl?: string;
}

export interface EventActivationsBlockProps {
  // ── Navbar ────────────────────────────────────────────────────────────────
  /** Show the top navbar. Default true. */
  showNav?: boolean;
  /** Tenant-logo override URL; falls back to the brand logo / wordmark. */
  logoUrl?: string;
  logoAlt?: string;
  /** 0–4 anchor links between the lockup and the nav CTA. */
  navLinks?: MicrositeNavLink[];
  /** Nav CTA label; falls back to `ctaText`. Hidden when both are empty. */
  navCtaText?: string;
  /** Nav CTA href; falls back to the booking anchor. */
  navCtaUrl?: string;

  // ── Hero ──────────────────────────────────────────────────────────────────
  /** "split" (copy left, image right — default), "image-overlay" (full-bleed
   *  photo behind the copy) or "dark" (headline-only brand band). A layout
   *  that needs an image falls back to "dark" when no image is set. */
  heroLayout?: HeroLayout;
  /** Pill above the headline, e.g. "Summit 2026 • July 15 – 17". */
  badgeText?: string;
  /** First headline line, e.g. "Visit us at". */
  headline: string;
  /** Accent-tinted second headline line, e.g. "Booth #21". */
  headlineAccent?: string;
  /** Optional supporting paragraph under the headline. */
  heroBody?: string;
  heroImage?: string;
  heroImageAlt?: string;
  /** CSS object-position focal point for the hero image. */
  heroImageFocalPoint?: string;
  /** Overlay color on the full-bleed hero image. Default #000000. */
  overlayColor?: string;
  /** 0–1 overlay opacity on the full-bleed hero image. Default 0.45. */
  backgroundOverlay?: number;
  /** Headline font-size multiplier (1 = default). Range ~0.6–1.8. */
  headlineFontScale?: number;
  /** Optional hero button (quieter than the booking CTA). Hidden when empty. */
  heroCtaText?: string;
  heroCtaUrl?: string;

  // ── Intro + activations band ──────────────────────────────────────────────
  /** Show the intro lockup above the activation list. Default true. */
  showIntroSection?: boolean;
  introKicker?: string;
  introHeadline?: string;
  introBody?: string;
  /** Show the activation list. Default true. */
  showActivations?: boolean;
  /** Anchor id for the activations band (without `#`). Default "activations". */
  activationsAnchorId?: string;
  activations?: EventActivationItem[];

  // ── Booking close ─────────────────────────────────────────────────────────
  /** Show the book-a-meeting section. Default true. */
  showBookingSection?: boolean;
  /** Anchor id for the booking section (without `#`). Default "book". */
  bookingAnchorId?: string;
  bookingKicker?: string;
  bookingHeading?: string;
  bookingBody?: string;
  /** "button" (default) renders the big booking CTA; "form" embeds the
   *  configured global/Marketo form instead. */
  bookingMode?: "button" | "form";
  /** Show the meeting-host lockup (headshot + name/title/bio) above the
   *  button/form. Default true; also hidden when no host fields are set. */
  showBookingHost?: boolean;
  /** Headshot of the person the visitor will meet. Falls back to an
   *  initials disc when empty but a name is set. */
  hostImageUrl?: string;
  hostImageAlt?: string;
  /** CSS object-position focal point for the headshot. */
  hostImageFocalPoint?: string;
  hostName?: string;
  /** Role line under the name, e.g. "VP, Enterprise Partnerships". */
  hostTitle?: string;
  /** Short bio shown under the name/title. */
  hostBio?: string;
  /** PRIMARY CTA — the book-a-meeting button label/destination. */
  ctaText?: string;
  ctaUrl?: string;

  // ── CTA styling (parity with the Premium Events Page) ────────────────────
  /** CTA pill background (resting). Defaults to the tenant brand primary. */
  ctaBgColor?: string;
  ctaTextColor?: string;
  /** CTA pill background on hover. Defaults to the tenant brand accent. */
  ctaHoverBgColor?: string;
  ctaHoverTextColor?: string;
  /** Stronger layered drop shadow lifting the CTA off the page. Default false. */
  ctaDropShadow?: boolean;
  ctaDropShadowColor?: string;
  /** Shadow alpha multiplier: 1 = original look, 0 = none, up to 2. */
  ctaDropShadowIntensity?: number;
  /** Animated shine sweep across the CTA every few seconds. Default false. */
  ctaShine?: boolean;
  ctaShineColor?: string;
  /** Shine opacity multiplier, 0–1. */
  ctaShineIntensity?: number;

  // ── Embedded booking form ─────────────────────────────────────────────────
  formHeading?: string;
  formSubheading?: string;
  /** Id of a global form (from /api/lp/forms) to embed. */
  formId?: number;
  /** "native" (default) uses the global form picked via `formId`; "marketo"
   *  embeds a Marketo form using the marketo* fields below. */
  formMode?: "native" | "marketo";
  marketoBaseUrl?: string;
  marketoMunchkinId?: string;
  marketoFormId?: number;

  /** Slim centered footer line. Hidden when empty. */
  footerText?: string;
}

export const EVENT_ACTIVATIONS_DEFAULT_PROPS: EventActivationsBlockProps = {
  showNav: true,
  navLinks: [
    { label: "What's happening", href: "#activations" },
    { label: "Book a meeting", href: "#book" },
  ],
  navCtaText: "Book a meeting",
  navCtaUrl: "#book",

  heroLayout: "split",
  badgeText: "Summit 2026 • July 15 – 17, 2026",
  headline: "Visit us at",
  headlineAccent: "Booth #21",
  heroBody:
    "Three days, one booth, every conversation that matters. See everything we're hosting at this year's show — and reserve time with our team while you're there.",
  heroImage:
    "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2000&auto=format&fit=crop",
  heroImageAlt: "Host-city skyline at dusk",
  overlayColor: "#000000",
  backgroundOverlay: 0.45,
  heroCtaText: "See what's happening",
  heroCtaUrl: "#activations",

  showIntroSection: true,
  introKicker: "At the show",
  introHeadline: "Everything we're hosting on the floor",
  introBody:
    "From breakout sessions to after-hours socials — here's where to find us all week.",
  showActivations: true,
  activationsAnchorId: "activations",
  activations: [
    {
      kicker: "Breakout session | Day 2 • 4:45 PM",
      title: "A look at the decade ahead",
      body: "Join our leadership team for a forward look at how AI, consolidation, and changing labor models will reshape the industry — with predictions you can act on now. Seats fill fast; arrive early.",
      imageUrl:
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Speaker on a conference stage",
      linkText: "Save your seat",
      linkUrl: "#book",
    },
    {
      kicker: "Lounge | Day 2 • 1:30 PM",
      title: "Roundtable + afternoon social",
      body: "Swing by our lounge for an interactive operator roundtable — real talk on what's working, what isn't, and what to watch — followed by refreshments and time with peers.",
      imageUrl:
        "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Attendees talking around a table",
      linkText: "RSVP here",
      linkUrl: "#book",
    },
    {
      kicker: "Booth #21 | All three days",
      title: "See the platform in action",
      body: "Stop by for a hands-on demo with our product team, meet executive leadership, and see what's shipping next. Book ahead to guarantee a time that fits your schedule.",
      imageUrl:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Team demoing a product at a booth",
      linkText: "Book your meeting",
      linkUrl: "#book",
    },
  ],

  showBookingSection: true,
  bookingAnchorId: "book",
  bookingKicker: "On-site meetings",
  bookingHeading: "Book a meeting at the show",
  bookingBody:
    "Grab 30 minutes with our team on the floor — pick a time that works and we'll take care of the rest.",
  bookingMode: "button",
  showBookingHost: true,
  hostImageUrl:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop",
  hostImageAlt: "Headshot of your meeting host",
  hostName: "Alex Morgan",
  hostTitle: "VP, Enterprise Partnerships",
  hostBio:
    "Alex has spent a decade helping multi-location groups roll out new platforms — bring your hardest questions.",
  ctaText: "Book a meeting onsite",
  ctaUrl: "#",
  formHeading: "Request a time",
  formSubheading: "Tell us when you're free — we'll confirm within the day.",

  footerText: "© 2026 · See you at the show",
};

/** Pick a readable foreground color for the CTA pill given its background. */
function readableOn(hex: string): string {
  const m = (hex || "").replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return "#ffffff";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0f172a" : "#ffffff";
}

/** `#rrggbb` → `rgba()` at the given alpha (shadow/shine tinting). */
function hexToRgba(hex: string, alpha: number): string {
  const m = (hex || "#000000").replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return `rgba(0,0,0,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Clamp a font-scale multiplier so users can't blow up the layout. */
function clampScale(v: unknown, fallback = 1): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.6, Math.min(1.8, n));
}

interface Props {
  props: EventActivationsBlockProps;
  brand: BrandConfig;
  pageId?: number;
  testId?: number;
  variantId?: number;
  sessionId?: string;
  onCtaClick?: () => void;
  onFieldChange?: (updated: EventActivationsBlockProps) => void;
}

export function BlockEventActivations({
  props,
  brand,
  pageId,
  testId,
  variantId,
  sessionId,
  onCtaClick,
  onFieldChange,
}: Props) {
  const anim = useAnimInitial();
  const isEditor = !!onFieldChange;
  const field = (key: keyof EventActivationsBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as EventActivationsBlockProps[typeof key] })
      : undefined;
  const activations = props.activations ?? [];
  const editItem = (i: number, key: keyof EventActivationItem) =>
    onFieldChange
      ? (v: string) =>
          onFieldChange({
            ...props,
            activations: activations.map((a, idx) => (idx === i ? { ...a, [key]: v } : a)),
          })
      : undefined;

  // ── palette: brand-derived light editorial page ───────────────────────────
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : "#0f4c46";
  const paper = "#ffffff";
  const ink = "#101828";
  const muted = "#475467";
  const hairline = "rgba(16, 24, 40, 0.10)";
  const band = mixHex(primary, "#ffffff", 0.08);
  const chipBg = mixHex(primary, "#ffffff", 0.14);
  const chipInk = pickContrastingColor(mixHex(primary, "#000000", 0.82), chipBg, [primary, ink]);
  // Two-tone headline accent: a soft tint of the primary, contrast-guarded so
  // very light brands never render an invisible second line.
  const accentOnLight = pickContrastingColor(
    mixHex(primary, "#ffffff", 0.62),
    paper,
    [primary, ink],
    2.4,
  );
  const linkInk = pickContrastingColor(primary, paper, [mixHex(primary, "#000000", 0.7), ink]);

  // ── hero layout + dark-surface chrome ─────────────────────────────────────
  const heroLayout = resolveHeroLayout(props.heroLayout, Boolean(props.heroImage), "split");
  const darkSurface = resolveDarkHeroSurface(brand, undefined, (h) => !!h && isValidHex(h));
  const heroIsDark = heroLayout !== "split";
  const darkInk = heroChromeInk(darkSurface);
  // Near-white before accent on dark surfaces (dark-headline rule).
  const accentOnDark = mixHex("#ffffff", primary, 0.72);
  const overlayRaw = props.backgroundOverlay;
  const backgroundOverlay =
    typeof overlayRaw === "number" ? Math.max(0, Math.min(1, overlayRaw)) : 0.45;
  const headlineScale = clampScale(props.headlineFontScale);

  // ── CTA palette (parity with event-landing-hero): explicit prop wins, else
  //    tenant brand vars so the rest of the brand system still applies. ──────
  const P = props.ctaBgColor ?? `var(--brand-primary, ${brand.primaryColor})`;
  const A = props.ctaHoverBgColor ?? `var(--brand-accent, ${brand.accentColor})`;
  const ctaFg = props.ctaTextColor ?? readableOn(props.ctaBgColor ?? brand.primaryColor);
  const hoverFg = props.ctaHoverTextColor ?? readableOn(props.ctaHoverBgColor ?? brand.accentColor);
  const ctaDropShadow = props.ctaDropShadow === true;
  const ctaDropShadowColor = props.ctaDropShadowColor ?? "#000000";
  const ctaDropShadowIntensity = props.ctaDropShadowIntensity ?? 1;
  const ctaShine = props.ctaShine === true;
  const ctaShineColor = props.ctaShineColor ?? "#ffffff";
  const ctaShineIntensity = props.ctaShineIntensity ?? 1;

  const ctaBoxShadow = (() => {
    const k = Math.max(0, Math.min(2, ctaDropShadowIntensity));
    if (k === 0) return "none";
    return ctaDropShadow
      ? `0 2px 6px ${hexToRgba(ctaDropShadowColor, 0.25 * k)}, 0 18px 42px ${hexToRgba(ctaDropShadowColor, 0.55 * k)}`
      : `0 8px 28px ${hexToRgba(ctaDropShadowColor, 0.18 * k)}`;
  })();

  const handleAnchor = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href.length < 2) return;
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activationsAnchor = (props.activationsAnchorId ?? "activations").trim() || "activations";
  const bookingAnchor = (props.bookingAnchorId ?? "book").trim() || "book";

  /** Shared premium pill used by the hero CTA and the booking CTA. */
  const CtaPill = ({
    label,
    onUpdate,
    onClick,
    large,
  }: {
    label: string;
    onUpdate?: (v: string) => void;
    onClick: () => void;
    large?: boolean;
  }) => (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 9999,
        background: P,
        color: ctaFg,
        padding: large ? "1.05rem 2.4rem" : "0.85rem 1.9rem",
        fontSize: large ? "clamp(0.875rem, 1.5vw, 1rem)" : "clamp(0.8125rem, 1.4vw, 0.9375rem)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        border: "none",
        cursor: "pointer",
        boxShadow: ctaBoxShadow,
        transition: "background-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease",
        fontFamily: BODY,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = A;
        e.currentTarget.style.color = hoverFg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = P;
        e.currentTarget.style.color = ctaFg;
      }}
    >
      <InlineText as="span" value={label} onUpdate={onUpdate} style={{ fontFamily: BODY }} />
      {ctaShine && (
        <motion.span
          aria-hidden
          initial={{ x: "-120%" }}
          animate={{ x: "220%" }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "55%",
            height: "100%",
            pointerEvents: "none",
            background: `linear-gradient(115deg, ${hexToRgba(ctaShineColor, 0)} 0%, ${hexToRgba(ctaShineColor, 0.55)} 50%, ${hexToRgba(ctaShineColor, 0)} 100%)`,
            opacity: Math.max(0, Math.min(1, ctaShineIntensity)),
            mixBlendMode: "screen",
            transform: "skewX(-20deg)",
          }}
        />
      )}
    </motion.button>
  );

  const navigateCta = (url: string | undefined) => {
    if (url && url.startsWith("#") && url.length > 1) {
      const el = document.getElementById(url.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    if (url && url !== "#") safeNavigate(url, "_blank");
  };

  // ── booking form shim: reuse <BlockForm> for the global/Marketo embed, the
  //    same contract as the Premium Events Page. ─────────────────────────────
  const formMode = props.formMode === "marketo" ? "marketo" : "native";
  const embeddedForm: FormBlockProps = {
    headline: "",
    subheadline: "",
    multiStep: false,
    steps: [],
    submitButtonText: "Submit",
    successMessage: "Thanks — we'll be in touch to confirm your meeting!",
    redirectUrl: "",
    backgroundStyle: "white",
    formId: props.formId,
    cardStyle: "flat",
    formMode,
    marketoBaseUrl: props.marketoBaseUrl,
    marketoMunchkinId: props.marketoMunchkinId,
    marketoFormId: props.marketoFormId,
  };
  const hasMarketo =
    formMode === "marketo" &&
    Boolean(props.marketoBaseUrl) &&
    Boolean(props.marketoMunchkinId) &&
    Boolean(props.marketoFormId);
  const hasForm = hasMarketo || (formMode === "native" && Boolean(props.formId));

  // ── hero content (shared across the three layouts) ────────────────────────
  const heroContent = (dark: boolean, center: boolean) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        gap: "clamp(1.1rem, 2.5vh, 1.6rem)",
      }}
    >
      {(props.badgeText || isEditor) && (
        <motion.p
          initial={anim({ opacity: 0, y: 10 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          style={{
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            borderRadius: 9999,
            padding: "0.45rem 1rem",
            background: dark ? "rgba(255,255,255,0.14)" : chipBg,
            color: dark ? "#ffffff" : chipInk,
            fontSize: "clamp(0.75rem, 1.3vw, 0.875rem)",
            fontWeight: 600,
            letterSpacing: "0.02em",
            fontFamily: BODY,
            backdropFilter: dark ? "blur(6px)" : undefined,
          }}
        >
          <InlineText as="span" value={props.badgeText ?? ""} onUpdate={field("badgeText")} style={{ fontFamily: BODY }} />
        </motion.p>
      )}

      <motion.h1
        initial={anim({ opacity: 0, y: 26 })}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        style={{
          margin: 0,
          fontFamily: DISPLAY,
          fontSize: `clamp(${(2.4 * headlineScale).toFixed(2)}rem, ${(5.6 * headlineScale).toFixed(2)}vw, ${(4.4 * headlineScale).toFixed(2)}rem)`,
          lineHeight: 1.04,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: dark ? darkInk.ink : ink,
          textShadow: dark ? "0 2px 24px rgba(0,0,0,0.35)" : undefined,
          maxWidth: "16ch",
        }}
      >
        <InlineText as="span" value={props.headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }} />
        {(props.headlineAccent || isEditor) && (
          <span style={{ display: "block", color: dark ? accentOnDark : accentOnLight }}>
            <InlineText as="span" value={props.headlineAccent ?? ""} onUpdate={field("headlineAccent")} style={{ fontFamily: DISPLAY }} />
          </span>
        )}
      </motion.h1>

      {(props.heroBody || isEditor) && (
        <motion.p
          initial={anim({ opacity: 0, y: 16 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          style={{
            margin: 0,
            maxWidth: "46ch",
            fontSize: "clamp(1rem, 1.7vw, 1.125rem)",
            lineHeight: 1.6,
            color: dark ? darkInk.muted : muted,
            textShadow: dark ? "0 1px 8px rgba(0,0,0,0.4)" : undefined,
            fontFamily: BODY,
          }}
        >
          <InlineText as="span" value={props.heroBody ?? ""} onUpdate={field("heroBody")} multiline style={{ fontFamily: BODY }} />
        </motion.p>
      )}

      {props.heroCtaText && (
        <motion.div
          initial={anim({ opacity: 0, y: 14 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24 }}
        >
          <CtaPill
            label={props.heroCtaText}
            onUpdate={field("heroCtaText")}
            onClick={() => navigateCta(props.heroCtaUrl || `#${activationsAnchor}`)}
          />
        </motion.div>
      )}
    </div>
  );

  const navSurface = heroIsDark ? darkSurface : paper;
  const navInk = heroIsDark ? darkInk.ink : ink;
  const navMuted = heroIsDark ? darkInk.muted : muted;
  const navCtaLabel = props.navCtaText ?? props.ctaText;
  const navbar =
    props.showNav !== false ? (
      <MicrositeNavbar
        brand={brand}
        logoUrl={props.logoUrl}
        logoAlt={props.logoAlt}
        links={props.navLinks ?? []}
        ctaText={navCtaLabel}
        ctaUrl={props.navCtaUrl || `#${bookingAnchor}`}
        ctaBg={P}
        ctaText_color={ctaFg}
        heroSurface={navSurface}
        isDark={heroIsDark}
        ink={navInk}
        inkMuted={navMuted}
        accent={primary}
        onAnchor={handleAnchor}
      />
    ) : null;

  return (
    <div style={{ background: paper, color: ink, fontFamily: BODY, overflowX: "clip" }}>
      {/* ── HERO ── */}
      {heroLayout === "image-overlay" ? (
        <header style={{ position: "relative", background: darkSurface }}>
          {props.heroImage && (
            <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
              <InlineImage
                src={props.heroImage}
                alt={props.heroImageAlt ?? ""}
                onUpdate={field("heroImage")}
                onAltUpdate={field("heroImageAlt")}
                focalPoint={props.heroImageFocalPoint}
                onFocalUpdate={field("heroImageFocalPoint")}
                wrapperClassName="block w-full h-full"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="eager"
                decoding="async"
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: props.overlayColor ?? "#000000",
                  opacity: backgroundOverlay,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
          <div style={{ position: "relative", zIndex: 1 }}>
            {navbar}
            <div
              style={{
                maxWidth: 1180,
                margin: "0 auto",
                padding: "clamp(5rem, 13vh, 8.5rem) clamp(1.25rem, 5vw, 3rem) clamp(5.5rem, 14vh, 9rem)",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {heroContent(true, true)}
            </div>
          </div>
        </header>
      ) : heroLayout === "dark" ? (
        <header style={{ background: darkSurface }}>
          {navbar}
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              padding: "clamp(4rem, 10vh, 7rem) clamp(1.25rem, 5vw, 3rem) clamp(4.5rem, 11vh, 7.5rem)",
            }}
          >
            {heroContent(true, false)}
          </div>
        </header>
      ) : (
        <header style={{ background: paper }}>
          {navbar}
          <div
            className="evact-hero-grid"
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              padding: "clamp(3rem, 8vh, 5.5rem) clamp(1.25rem, 5vw, 3rem)",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
              gap: "clamp(2rem, 5vw, 4rem)",
              alignItems: "center",
            }}
          >
            {heroContent(false, false)}
            {props.heroImage && (
              <motion.div
                initial={anim({ opacity: 0, scale: 0.98 })}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 24px 60px rgba(16,24,40,0.16)",
                  aspectRatio: "4 / 3",
                }}
              >
                <InlineImage
                  src={props.heroImage}
                  alt={props.heroImageAlt ?? ""}
                  onUpdate={field("heroImage")}
                  onAltUpdate={field("heroImageAlt")}
                  focalPoint={props.heroImageFocalPoint}
                  onFocalUpdate={field("heroImageFocalPoint")}
                  wrapperClassName="block w-full h-full"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="eager"
                  decoding="async"
                />
              </motion.div>
            )}
          </div>
        </header>
      )}

      {/* ── ACTIVATIONS BAND ── */}
      {(props.showIntroSection !== false || (props.showActivations !== false && activations.length > 0)) && (
        <section
          id={activationsAnchor}
          style={{
            background: band,
            padding: "clamp(3.5rem, 9vh, 6.5rem) clamp(1.25rem, 5vw, 3rem)",
          }}
        >
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            {props.showIntroSection !== false && (
              <div style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 6vh, 4rem)" }}>
                {(props.introKicker || isEditor) && (
                  <p
                    style={{
                      margin: "0 0 0.85rem 0",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: chipInk,
                      fontFamily: BODY,
                    }}
                  >
                    <InlineText as="span" value={props.introKicker ?? ""} onUpdate={field("introKicker")} style={{ fontFamily: BODY }} />
                  </p>
                )}
                {(props.introHeadline || isEditor) && (
                  <h2
                    style={{
                      margin: "0 auto",
                      maxWidth: "26ch",
                      fontFamily: DISPLAY,
                      fontSize: "clamp(1.75rem, 3.8vw, 2.75rem)",
                      lineHeight: 1.12,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: ink,
                    }}
                  >
                    <InlineText as="span" value={props.introHeadline ?? ""} onUpdate={field("introHeadline")} multiline style={{ fontFamily: DISPLAY }} />
                  </h2>
                )}
                {(props.introBody || isEditor) && (
                  <p
                    style={{
                      margin: "1rem auto 0",
                      maxWidth: "56ch",
                      fontSize: "clamp(0.9375rem, 1.6vw, 1.0625rem)",
                      lineHeight: 1.6,
                      color: muted,
                      fontFamily: BODY,
                    }}
                  >
                    <InlineText as="span" value={props.introBody ?? ""} onUpdate={field("introBody")} multiline style={{ fontFamily: BODY }} />
                  </p>
                )}
              </div>
            )}

            {props.showActivations !== false && activations.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.25rem, 3vh, 2rem)" }}>
                {activations.map((a, i) => {
                  const hasImage = Boolean(a.imageUrl);
                  const imageLeft = hasImage && i % 2 === 1;
                  return (
                    <article
                      key={i}
                      className="evact-card"
                      style={{
                        background: paper,
                        border: `1px solid ${hairline}`,
                        borderRadius: 20,
                        padding: "clamp(1.5rem, 3.5vw, 2.5rem)",
                        display: "grid",
                        gridTemplateColumns: hasImage
                          ? imageLeft
                            ? "minmax(0, 0.85fr) minmax(0, 1.15fr)"
                            : "minmax(0, 1.15fr) minmax(0, 0.85fr)"
                          : "minmax(0, 1fr)",
                        gap: "clamp(1.5rem, 3.5vw, 2.75rem)",
                        alignItems: "center",
                        boxShadow: "0 4px 20px rgba(16,24,40,0.05)",
                      }}
                    >
                      <div style={{ order: imageLeft ? 2 : 1 }}>
                        {(a.kicker || isEditor) && (
                          <p
                            style={{
                              margin: "0 0 0.9rem 0",
                              display: "inline-flex",
                              borderRadius: 8,
                              padding: "0.3rem 0.7rem",
                              background: chipBg,
                              color: chipInk,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              fontFamily: BODY,
                            }}
                          >
                            <InlineText as="span" value={a.kicker ?? ""} onUpdate={editItem(i, "kicker")} style={{ fontFamily: BODY }} />
                          </p>
                        )}
                        <h3
                          style={{
                            margin: "0 0 0.75rem 0",
                            fontFamily: DISPLAY,
                            fontSize: "clamp(1.35rem, 2.6vw, 1.75rem)",
                            lineHeight: 1.18,
                            fontWeight: 700,
                            letterSpacing: "-0.015em",
                            color: ink,
                          }}
                        >
                          <InlineText as="span" value={a.title} onUpdate={editItem(i, "title")} multiline style={{ fontFamily: DISPLAY }} />
                        </h3>
                        {(a.body || isEditor) && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: "clamp(0.9375rem, 1.5vw, 1rem)",
                              lineHeight: 1.65,
                              color: muted,
                              fontFamily: BODY,
                            }}
                          >
                            <InlineText as="span" value={a.body ?? ""} onUpdate={editItem(i, "body")} multiline style={{ fontFamily: BODY }} />
                          </p>
                        )}
                        {a.linkText && (
                          <a
                            href={a.linkUrl || `#${bookingAnchor}`}
                            onClick={(e) => handleAnchor(e, a.linkUrl || `#${bookingAnchor}`)}
                            style={{
                              marginTop: "1.1rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              color: linkInk,
                              fontWeight: 700,
                              fontSize: "0.9375rem",
                              textDecoration: "none",
                              fontFamily: BODY,
                            }}
                          >
                            <InlineText as="span" value={a.linkText} onUpdate={editItem(i, "linkText")} style={{ fontFamily: BODY }} />
                            <ArrowRight aria-hidden style={{ width: 16, height: 16 }} />
                          </a>
                        )}
                      </div>
                      {hasImage && (
                        <div
                          style={{
                            order: imageLeft ? 1 : 2,
                            borderRadius: 14,
                            overflow: "hidden",
                            aspectRatio: "16 / 10",
                          }}
                        >
                          <InlineImage
                            src={a.imageUrl!}
                            alt={a.imageAlt ?? a.title}
                            onUpdate={editItem(i, "imageUrl")}
                            onAltUpdate={editItem(i, "imageAlt")}
                            focalPoint={a.imageFocalPoint}
                            onFocalUpdate={editItem(i, "imageFocalPoint")}
                            wrapperClassName="block w-full h-full"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── BOOKING CLOSE ── */}
      {props.showBookingSection !== false && (
        <section
          id={bookingAnchor}
          style={{
            background: paper,
            padding: "clamp(3.5rem, 10vh, 7rem) clamp(1.25rem, 5vw, 3rem)",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            {(props.bookingKicker || isEditor) && (
              <p
                style={{
                  margin: "0 0 0.85rem 0",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: chipInk,
                  fontFamily: BODY,
                }}
              >
                <InlineText as="span" value={props.bookingKicker ?? ""} onUpdate={field("bookingKicker")} style={{ fontFamily: BODY }} />
              </p>
            )}
            {(props.bookingHeading || isEditor) && (
              <h2
                style={{
                  margin: "0 auto",
                  maxWidth: "24ch",
                  fontFamily: DISPLAY,
                  fontSize: "clamp(1.75rem, 3.8vw, 2.75rem)",
                  lineHeight: 1.12,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: ink,
                }}
              >
                <InlineText as="span" value={props.bookingHeading ?? ""} onUpdate={field("bookingHeading")} multiline style={{ fontFamily: DISPLAY }} />
              </h2>
            )}
            {(props.bookingBody || isEditor) && (
              <p
                style={{
                  margin: "1rem auto 0",
                  maxWidth: "52ch",
                  fontSize: "clamp(0.9375rem, 1.6vw, 1.0625rem)",
                  lineHeight: 1.6,
                  color: muted,
                  fontFamily: BODY,
                }}
              >
                <InlineText as="span" value={props.bookingBody ?? ""} onUpdate={field("bookingBody")} multiline style={{ fontFamily: BODY }} />
              </p>
            )}

            {/* Meeting-host lockup — who the visitor is actually booking time
                with. Headshot falls back to an initials disc so a rep without
                a photo still gets a face-like anchor. Hidden via the toggle or
                when every host field is empty. */}
            {props.showBookingHost !== false &&
              (props.hostName || props.hostTitle || props.hostBio || props.hostImageUrl || isEditor) && (
              <div
                style={{
                  marginTop: "clamp(1.75rem, 4vh, 2.5rem)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.85rem",
                }}
              >
                {props.hostImageUrl ? (
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 9999,
                      overflow: "hidden",
                      boxShadow: "0 8px 24px rgba(16,24,40,0.14)",
                      border: `3px solid ${paper}`,
                      outline: `1px solid ${hairline}`,
                    }}
                  >
                    <InlineImage
                      src={props.hostImageUrl}
                      alt={props.hostImageAlt ?? props.hostName ?? "Meeting host"}
                      onUpdate={field("hostImageUrl")}
                      onAltUpdate={field("hostImageAlt")}
                      focalPoint={props.hostImageFocalPoint}
                      onFocalUpdate={field("hostImageFocalPoint")}
                      wrapperClassName="block w-full h-full"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : props.hostName ? (
                  <div
                    aria-hidden
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 9999,
                      background: chipBg,
                      color: chipInk,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: DISPLAY,
                      fontSize: "1.75rem",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {props.hostName
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                ) : null}
                {(props.hostName || isEditor) && (
                  <p
                    style={{
                      margin: 0,
                      fontFamily: DISPLAY,
                      fontSize: "clamp(1.0625rem, 1.8vw, 1.1875rem)",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: ink,
                    }}
                  >
                    <InlineText as="span" value={props.hostName ?? ""} onUpdate={field("hostName")} style={{ fontFamily: DISPLAY }} />
                  </p>
                )}
                {(props.hostTitle || isEditor) && (
                  <p
                    style={{
                      margin: "-0.35rem 0 0 0",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: chipInk,
                      fontFamily: BODY,
                    }}
                  >
                    <InlineText as="span" value={props.hostTitle ?? ""} onUpdate={field("hostTitle")} style={{ fontFamily: BODY }} />
                  </p>
                )}
                {(props.hostBio || isEditor) && (
                  <p
                    style={{
                      margin: 0,
                      maxWidth: "44ch",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                      color: muted,
                      fontFamily: BODY,
                    }}
                  >
                    <InlineText as="span" value={props.hostBio ?? ""} onUpdate={field("hostBio")} multiline style={{ fontFamily: BODY }} />
                  </p>
                )}
              </div>
            )}

            {(props.bookingMode ?? "button") === "button" ? (
              props.ctaText && (
                <div style={{ marginTop: "clamp(1.75rem, 4vh, 2.5rem)" }}>
                  <CtaPill
                    large
                    label={props.ctaText}
                    onUpdate={field("ctaText")}
                    onClick={() => {
                      if (onCtaClick) {
                        onCtaClick();
                        return;
                      }
                      navigateCta(props.ctaUrl);
                    }}
                  />
                </div>
              )
            ) : (
              <div
                style={{
                  marginTop: "clamp(1.75rem, 4vh, 2.5rem)",
                  textAlign: "left",
                  background: paper,
                  border: `1px solid ${hairline}`,
                  borderRadius: 20,
                  boxShadow: "0 12px 40px rgba(16,24,40,0.08)",
                  padding: "clamp(1.5rem, 3.5vw, 2.5rem)",
                }}
              >
                {(props.formHeading || isEditor) && (
                  <h3
                    style={{
                      margin: "0 0 0.5rem 0",
                      fontFamily: DISPLAY,
                      fontSize: "clamp(1.25rem, 2.4vw, 1.5rem)",
                      lineHeight: 1.2,
                      fontWeight: 700,
                      color: ink,
                    }}
                  >
                    <InlineText as="span" value={props.formHeading ?? ""} onUpdate={field("formHeading")} style={{ fontFamily: DISPLAY }} />
                  </h3>
                )}
                {(props.formSubheading || isEditor) && (
                  <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.9375rem", lineHeight: 1.5, color: muted, fontFamily: BODY }}>
                    <InlineText as="span" value={props.formSubheading ?? ""} onUpdate={field("formSubheading")} multiline style={{ fontFamily: BODY }} />
                  </p>
                )}
                {hasForm ? (
                  <div className="evact-form-slot">
                    <BlockForm
                      props={embeddedForm}
                      brand={brand}
                      pageId={pageId}
                      testId={testId}
                      variantId={variantId}
                      sessionId={sessionId}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      border: `1px dashed ${hairline}`,
                      borderRadius: 14,
                      padding: "1.25rem 1.5rem",
                      fontSize: 13,
                      color: muted,
                      fontFamily: BODY,
                    }}
                  >
                    {formMode === "marketo"
                      ? "Add your Marketo instance URL, Munchkin ID, and Form ID in the right panel to embed the form here."
                      : "Pick a form in the right panel to embed your booking form here."}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── FOOTER LINE ── */}
      {(props.footerText || isEditor) && (
        <footer
          style={{
            borderTop: `1px solid ${hairline}`,
            padding: "1.75rem clamp(1.25rem, 5vw, 3rem)",
            textAlign: "center",
            fontSize: "0.8125rem",
            color: muted,
            fontFamily: BODY,
          }}
        >
          <InlineText as="span" value={props.footerText ?? ""} onUpdate={field("footerText")} style={{ fontFamily: BODY }} />
        </footer>
      )}

      {/* Stack the hero + activation grids on narrow viewports, and trim
          BlockForm's outer section padding when nested in the booking card. */}
      <style>{`
        @media (max-width: 860px) {
          .evact-hero-grid { grid-template-columns: 1fr !important; }
          .evact-card { grid-template-columns: 1fr !important; }
          .evact-card > div { order: initial !important; }
        }
        .evact-form-slot > section { padding: 0 !important; background: transparent !important; }
      `}</style>
    </div>
  );
}

export default BlockEventActivations;
