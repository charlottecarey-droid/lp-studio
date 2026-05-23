import { useRef, useState } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import type { ScrollAssemblyBlockProps, ScrollAssemblyPiece } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";
import { InlineEmailCapture } from "@/components/InlineEmailCapture";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { appendEmailToUrl } from "@/lib/append-email";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: ScrollAssemblyBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ScrollAssemblyBlockProps) => void;
  onCtaClick?: (url?: string) => void;
  pageId?: number;
  variantId?: number;
}

/* ------------------------------------------------------------------------- */
/*  Per-piece animation                                                      */
/* ------------------------------------------------------------------------- */

function fromOffset(from: ScrollAssemblyPiece["from"]): { x: number; y: number; rotate: number; scale: number; blur: number } {
  // Editorial entrance offsets — premium reveals are small in travel,
  // zero in rotation. Cinematic feel comes from the long ease curve
  // + a quick focus-pull, not the magnitude of motion. Blur amounts
  // halved from the previous pass (14/16/10/6) — the old values left
  // type smeared past the resolve point and slowed the visual rhythm.
  switch (from) {
    case "left":   return { x: -72,  y: 0,    rotate: 0, scale: 0.97, blur: 7 };
    case "right":  return { x: 72,   y: 0,    rotate: 0, scale: 0.97, blur: 7 };
    case "top":    return { x: 0,    y: -48,  rotate: 0, scale: 0.97, blur: 5 };
    case "bottom": return { x: 0,    y: 48,   rotate: 0, scale: 0.97, blur: 5 };
    case "scale":  return { x: 0,    y: 0,    rotate: 0, scale: 0.84, blur: 8 };
    case "fade":
    default:       return { x: 0,    y: 0,    rotate: 0, scale: 1,    blur: 3 };
  }
}

function PieceView({
  piece,
  scrollYProgress,
  index,
  total,
  theme,
  onTextChange,
}: {
  piece: ScrollAssemblyPiece;
  scrollYProgress: MotionValue<number>;
  index: number;
  total: number;
  theme: "light" | "dark";
  onTextChange?: (v: string) => void;
}) {
  const sliceSize = 1 / Math.max(total, 1);
  const start = piece.revealAt != null ? Math.max(0, Math.min(0.95, piece.revealAt)) : index * sliceSize * 0.85;
  const end = Math.min(1, start + Math.max(0.18, sliceSize * 1.4));

  const offset = fromOffset(piece.from ?? "fade");

  const opacity = useTransform(scrollYProgress, [start, start + 0.05, end - 0.05, end], [0, 0.9, 1, 1]);
  const x       = useTransform(scrollYProgress, [start, end], [offset.x, 0]);
  const y       = useTransform(scrollYProgress, [start, end], [offset.y, 0]);
  const rotate  = useTransform(scrollYProgress, [start, end], [offset.rotate, 0]);
  const scale   = useTransform(scrollYProgress, [start, end], [offset.scale, 1]);
  // Blur clears slightly faster than the translate completes so the piece
  // resolves into sharpness at ~75% of the reveal window — the focal lock
  // feels cinematic instead of stopping abruptly.
  const blurPx  = useTransform(scrollYProgress, [start, start + (end - start) * 0.75, end], [offset.blur, 0, 0]);
  const filter  = useTransform(blurPx, (b) => (b > 0.2 ? `blur(${b.toFixed(2)}px)` : "none"));

  if (piece.kind === "image") {
    // Premium image piece: object-contain + no rounded frame so PNGs
    // with transparent backgrounds (product shots, headset, etc.) sit
    // flat without a visible "card" around them. The old version
    // applied rounded-2xl + shadow-2xl + ring which manufactured a
    // dark rounded rectangle around any transparent image — exactly
    // the "weird shadow" reported on the hero. A very soft elliptical
    // floor shadow underneath gives weight without enclosing the cutout.
    return (
      <motion.div
        style={{ opacity, x, y, rotate, scale, filter, willChange: "transform, opacity, filter" }}
        className="relative flex flex-col items-center"
      >
        <img
          src={piece.content}
          alt=""
          className="relative object-contain w-full max-w-md max-h-[60vh]"
          style={{ filter: `drop-shadow(0 30px 40px ${theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.25)"})` }}
        />
      </motion.div>
    );
  }

  if (piece.kind === "shape") {
    const c = piece.color || "var(--brand-accent)";
    return (
      <motion.div
        style={{
          opacity, x, y, rotate, scale, filter,
          background: `radial-gradient(circle at 30% 30%, ${c} 0%, ${c} 60%, rgba(0,0,0,0.15) 100%)`,
          boxShadow: `0 20px 60px -10px ${c}55, 0 0 0 1px rgba(0,0,0,0.04) inset`,
          willChange: "transform, opacity, filter",
        }}
        className="w-28 h-28 rounded-3xl"
      />
    );
  }

  // text-display | text-headline | text-body
  // Tightened type scale: display dropped from text-[10rem] (160px) to
  // clamp(64–128px) so it never bursts out of the focal column on wide
  // screens; tracking goes hard-negative for editorial weight; leading
  // tight at 0.88 so two display lines stack as one composed wordmark.
  const sizeClass =
    piece.kind === "text-display"  ? "font-semibold" :
    piece.kind === "text-headline" ? "text-2xl md:text-4xl font-medium" :
                                     "text-base md:text-lg max-w-xl";

  const inlineSize =
    // Display: pushed harder on both ends — min raised 3.75→4rem so it
    // never looks timid on phones, max raised 8→9.5rem so it has real
    // editorial confidence on desktop, tracking tightened -0.045em →
    // -0.055em, leading from 0.88 → 0.86 so two display lines compose
    // as one wordmark instead of as two stacked sentences.
    piece.kind === "text-display"  ? { fontSize: "clamp(4rem, 10vw, 9.5rem)", letterSpacing: "-0.055em", lineHeight: 0.86 } :
    piece.kind === "text-headline" ? { letterSpacing: "-0.025em", lineHeight: 1.06 } :
                                     { lineHeight: 1.55, letterSpacing: "0.005em" };

  // Premium default colors on dark theme: display = soft white (not pure)
  // so it doesn't fight the citron accent piece; body = warmer grey for
  // legibility without harshness. The piece's own color always wins.
  const defaultColor =
    piece.kind === "text-body"
      ? (theme === "dark" ? "rgba(255,255,255,0.62)" : "rgb(71 85 105)")
      : (theme === "dark" ? "rgba(255,255,255,0.96)" : "var(--brand-primary)");

  return (
    <motion.div
      style={{
        opacity, x, y, rotate, scale, filter,
        color: piece.color || defaultColor,
        willChange: "transform, opacity, filter",
      }}
      className={sizeClass}
    >
      <InlineText
        value={piece.content}
        onUpdate={onTextChange}
        style={{
          fontFamily: piece.kind === "text-body" ? BODY : DISPLAY,
          fontFeatureSettings: '"ss01", "kern", "liga"',
          ...inlineSize,
        }}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Decorative layers                                                        */
/* ------------------------------------------------------------------------- */

function FloatingImage({
  src,
  index,
  total,
  scrollYProgress,
  isEditor,
  onRemove,
}: {
  src: string;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
  isEditor?: boolean;
  onRemove?: () => void;
}) {
  // Premium scatter: pulled out of the focal center band, smaller scales,
  // and pushed further into the corners so the focal text always has air.
  const positions: Array<{ top: string; left: string; rot: number; size: number; depth: number }> = [
    { top: "6%",  left: "5%",  rot: -5,  size: 170, depth: 0.55 },
    { top: "70%", left: "82%", rot: 4,   size: 190, depth: 0.85 },
    { top: "52%", left: "3%",  rot: -3,  size: 150, depth: 0.7  },
    { top: "10%", left: "80%", rot: 6,   size: 160, depth: 1.0  },
    { top: "82%", left: "12%", rot: -2,  size: 130, depth: 0.6  },
    { top: "62%", left: "58%", rot: 3,   size: 110, depth: 1.15 },
  ];
  const pos = positions[index % positions.length];

  // Drift + slight rotate as scroll advances. Items further "back" (smaller depth) move less.
  const y = useTransform(scrollYProgress, [0, 1], [60 * pos.depth, -120 * pos.depth]);
  const x = useTransform(scrollYProgress, [0, 1], [(index % 2 === 0 ? -1 : 1) * 30 * pos.depth, (index % 2 === 0 ? 1 : -1) * 30 * pos.depth]);
  const rotate = useTransform(scrollYProgress, [0, 1], [pos.rot, pos.rot + (index % 2 === 0 ? 2 : -2)]);
  // Bumped 0.22 → 0.35 max because the new clean treatment (no framing,
  // no saturation drop) lets them sit comfortably hotter without
  // competing with the focal copy.
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.85, 1], [0, 0.35, 0.35, 0.12]);

  // Lift larger items in front. Total used to keep keys stable.
  void total;

  // Editor gets a remove × on hover. Viewer mode stays fully passive
  // (pointer-events-none on the wrapper so floating tiles never block
  // clicks on the focal copy underneath).
  return (
    <motion.div
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        width: pos.size,
        height: pos.size * 0.72,
        x, y, rotate, opacity,
        zIndex: Math.round(pos.depth * 2),
        willChange: "transform, opacity",
      }}
      className={`group ${isEditor ? "" : "pointer-events-none"}`}
    >
      {/*
        No framing wrapper — previously the image sat inside a
        rounded-2xl + ring-1 + dark gradient overlay container, which
        drew a visible rounded-rectangle "shadow" around any PNG with a
        transparent background (the user's floating product shots).
        Letting the <img> render flat preserves alpha so transparent
        cutouts truly float.
      */}
      <img
        src={src}
        alt=""
        className="w-full h-full object-contain pointer-events-none select-none"
        loading="lazy"
        draggable={false}
      />
      {isEditor && onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
          aria-label="Remove floating image"
        >
          ×
        </button>
      )}
    </motion.div>
  );
}

function GradientOrbs({
  accentColor,
  brandPrimary,
  scrollYProgress,
}: {
  accentColor: string;
  brandPrimary: string;
  scrollYProgress: MotionValue<number>;
}) {
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  // Orb alphas dropped (55/40/33 → 30/22/14) so the ambient glows read
  // as atmosphere rather than as colored spotlights that fight with
  // the floating tiles and the citron headline accent for attention.
  return (
    <>
      <motion.div
        style={{ y: y1, background: `radial-gradient(circle, ${accentColor}30 0%, transparent 72%)` }}
        className="absolute -top-32 -right-32 w-[42rem] h-[42rem] rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        style={{ y: y2, background: `radial-gradient(circle, ${brandPrimary}22 0%, transparent 72%)` }}
        className="absolute -bottom-40 -left-32 w-[44rem] h-[44rem] rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        style={{ y: y3, background: `radial-gradient(circle, ${accentColor}14 0%, transparent 72%)` }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full blur-3xl pointer-events-none"
      />
    </>
  );
}

function DotGrid({ theme }: { theme: "light" | "dark" }) {
  const dot = theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `radial-gradient(${dot} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }}
    />
  );
}

function GrainOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.08]"
      style={{
        backgroundImage:
          // Tiny SVG noise tile encoded as data URI — keeps things self-contained.
          `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

function MarqueeTags({
  tags,
  theme,
  accentColor,
  scrollYProgress,
}: {
  tags: string[];
  theme: "light" | "dark";
  accentColor: string;
  scrollYProgress: MotionValue<number>;
}) {
  // Marquee speed couples to scroll: it always drifts, but speeds up as you scroll.
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0.4]);
  // Duplicate the list so the loop is seamless.
  const doubled = [...tags, ...tags];
  const tagBg = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const tagBorder = theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)";
  const tagText = theme === "dark" ? "rgba(255,255,255,0.9)" : "rgb(15 23 42)";
  return (
    <motion.div
      style={{ opacity }}
      className="absolute bottom-6 left-0 right-0 overflow-hidden pointer-events-none"
    >
      <motion.div style={{ x }} className="flex gap-3 whitespace-nowrap">
        {doubled.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest backdrop-blur" style={{ backgroundColor: tagBg, border: `1px solid ${tagBorder}`, color: tagText, fontFamily: BODY }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor, fontFamily: BODY }} />
            {tag}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Block                                                                    */
/* ------------------------------------------------------------------------- */

function isDarkColor(hex: string): boolean {
  // Accept #rgb / #rrggbb / non-hex (returns false safely)
  if (!hex.startsWith("#")) return false;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Luminance approx.
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

export function BlockScrollAssembly({ props, brand, onFieldChange, onCtaClick, pageId, variantId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const emailCfg = props.email ?? {};
  const submitMode = emailCfg.submitMode ?? "navigate";

  const handleSubmit = (submittedEmail: string) => {
    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setModalOpen(true);
      return;
    }
    const target = appendEmailToUrl(props.ctaUrl ?? "#", submittedEmail);
    if (onCtaClick) onCtaClick(target);
    else safeNavigate(target);
  };

  const handleButtonCta = () => {
    // Plain CTA button always navigates directly — modal logic is reserved for
    // the inline email-capture pill (matches the product-hero pattern).
    const target = props.ctaUrl ?? "#";
    if (onCtaClick) onCtaClick(target);
    else safeNavigate(target);
  };
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const pieces = props.pieces ?? [];
  const heightVh = Math.max(150, Math.min(600, (props.scrollLengthVh ?? 100) * Math.max(1, pieces.length)));
  const bg = props.bgColor || "#FDFCFA";
  const decor = props.decor ?? "all";
  const accentColor = props.accentColor || brand.accentColor || "var(--brand-accent, #C7E738)";
  const brandPrimary = brand.primaryColor || "var(--brand-primary, #003a30)";
  const showOrbs = decor === "orbs" || decor === "all";
  const showGrid = decor === "grid" || decor === "all";
  const showGrain = props.grain !== false;
  const theme: "light" | "dark" = props.theme ?? (isDarkColor(bg) ? "dark" : "light");

  const floatingImages = props.floatingImages ?? [];
  const marqueeTags = props.marqueeTags ?? [];

  // Hooks must run unconditionally — declare these once at the top regardless
  // of whether the CTA / scroll hint actually render, otherwise hook order
  // breaks when those props are toggled.
  const ctaOpacity = useTransform(scrollYProgress, [0.85, 0.95], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.85, 0.95], [12, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.06], [0.6, 0]);
  // Vignette + center spotlight that brightens as you scroll into the focal area.
  // Capped further (was 0.22) so the spotlight reads as a subtle halo
  // rather than a stage-lit beam that washes out the type on dark bgs.
  const spotlightOpacity = useTransform(scrollYProgress, [0, 0.4, 0.95], [0, 0.12, 0.06]);
  // Vignette fades IN as the scroll progresses — the surrounding area dims
  // to push focus onto the focal text. Subtle (max 0.35 alpha).
  const vignetteOpacity = useTransform(scrollYProgress, [0, 0.3, 0.85, 1], [0, 0.25, 0.35, 0.2]);

  const updatePieceText = (i: number, v: string) => {
    if (!onFieldChange) return;
    const next = pieces.map((p, idx) => idx === i ? { ...p, content: v } : p);
    onFieldChange({ ...props, pieces: next });
  };

  // Derived helpers for theme-aware UI bits
  const eyebrowColor = theme === "dark" ? "rgba(255,255,255,0.85)" : "var(--brand-primary)";
  const hintColor = theme === "dark" ? "rgba(255,255,255,0.5)" : "rgb(148 163 184)";
  const hintBar = theme === "dark" ? "rgba(255,255,255,0.4)" : "rgb(203 213 225)";
  const ctaBg = theme === "dark" ? accentColor : "var(--brand-accent)";
  const ctaText = theme === "dark" ? brandPrimary : "var(--brand-primary)";

  return (
    // Solid edge restored. Previously this wrapper used a transparent
    // top + linear-gradient fade-in to dissolve the seam with the
    // intro block above. That assumed the two blocks were adjacent —
    // when another block sits between them the transparent strip
    // showed through to the in-between block's bg as a visible
    // horizontal band. Reverted to a flat fill so the section always
    // owns its top edge regardless of what sits above it.
    <div
      ref={containerRef}
      style={{ height: `${heightVh}vh`, backgroundColor: bg }}
      className="relative w-full"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Layer: ambient gradient orbs */}
        {showOrbs && (
          <GradientOrbs
            accentColor={accentColor}
            brandPrimary={brandPrimary}
            scrollYProgress={scrollYProgress}
          />
        )}

        {/* Layer: dot grid texture */}
        {showGrid && <DotGrid theme={theme} />}

        {/* Layer: floating parallax images */}
        {floatingImages.map((src, i) => (
          <FloatingImage
            key={`${src}-${i}`}
            src={src}
            index={i}
            total={floatingImages.length}
            scrollYProgress={scrollYProgress}
            isEditor={!!onFieldChange}
            onRemove={onFieldChange ? () => {
              const next = floatingImages.filter((_, idx) => idx !== i);
              onFieldChange({ ...props, floatingImages: next });
            } : undefined}
          />
        ))}

        {/* Center spotlight — slight luminous wash behind focal copy */}
        <motion.div
          style={{
            opacity: spotlightOpacity,
            background: `radial-gradient(ellipse at center, ${theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.85)"} 0%, transparent 60%)`,
          }}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Edge vignette — darkens the outer ring as you scroll into the
            focal zone, focusing the eye on the wordmark. Required for the
            premium "cinema" framing: floating tiles dim, headline sharpens. */}
        <motion.div
          style={{
            opacity: vignetteOpacity,
            background: `radial-gradient(ellipse 90% 70% at center, transparent 45%, ${theme === "dark" ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.18)"} 100%)`,
          }}
          className="absolute inset-0 pointer-events-none z-20"
        />

        {/* Foreground: pieces */}
        <div className="relative z-30 h-full w-full flex items-center justify-center">
          <div className="relative w-full max-w-6xl mx-auto px-6 md:px-10 flex flex-col items-center gap-2 md:gap-3 text-center">
            {props.eyebrow && (
              // Refined eyebrow: dropped the heavy bordered pill in favour
              // of a quiet accented label with a 24px hairline. Reads as
              // an editorial section marker (Apple, Linear, Stripe) instead
              // of a billboard tag. Accent dot left + hairline right give
              // it presence without enclosing it in a chip.
              <div
                className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase"
                style={{ color: eyebrowColor, fontFamily: BODY, letterSpacing: "0.22em" }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <InlineText
                  as="span"
                  value={props.eyebrow}
                  onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined}
                  style={{ fontFamily: BODY }}
                />
                <span
                  aria-hidden
                  className="inline-block w-8 h-px"
                  style={{ backgroundColor: theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)" }}
                />
              </div>
            )}

            {pieces.map((piece, i) => (
              <PieceView
                key={i}
                piece={piece}
                scrollYProgress={scrollYProgress}
                index={i}
                total={pieces.length}
                theme={theme}
                onTextChange={onFieldChange && piece.kind.startsWith("text") ? (v) => updatePieceText(i, v) : undefined}
              />
            ))}

            {props.showEmailCapture ? (
              <motion.div
                style={{ opacity: ctaOpacity, y: ctaY, width: "100%", display: "flex", justifyContent: "center" }}
                className="mt-6"
              >
                <InlineEmailCapture
                  email={email}
                  onEmailChange={setEmail}
                  onSubmit={handleSubmit}
                  placeholder={props.emailPlaceholder ?? "Email address"}
                  buttonText={props.ctaText || "Get started"}
                  buttonBg={accentColor}
                  buttonColor={brandPrimary}
                  // On dark themes, drop the stark white Mailchimp-style pill
                  // for an editorial glass treatment — translucent fill,
                  // hairline mint border, white input text. Matches the
                  // muted "Watch the trailer" ghost button in the hero.
                  pillBg={theme === "dark" ? "rgba(255,255,255,0.04)" : "#ffffff"}
                  pillBorder={
                    theme === "dark"
                      ? `${accentColor}55`
                      : "rgba(0,0,0,0.08)"
                  }
                  inputColor={theme === "dark" ? "#ffffff" : "#0f172a"}
                  placeholderColor={
                    theme === "dark" ? "rgba(255,255,255,0.55)" : undefined
                  }
                  pillShadow={
                    theme === "dark"
                      ? "0 30px 80px -28px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset"
                      : "0 18px 40px -16px rgba(0,0,0,0.35)"
                  }
                  // Soft mint halo on the citron submit button — same
                  // shadow language as the hero primary CTA so the two
                  // sections read as one design system, not two.
                  buttonShadow={
                    theme === "dark"
                      ? `0 0 0 1px ${accentColor}66, 0 10px 28px -8px ${accentColor}66`
                      : `0 8px 22px -8px ${accentColor}80`
                  }
                  maxWidth="480px"
                />
              </motion.div>
            ) : props.ctaText ? (
              <motion.button
                onClick={handleButtonCta}
                style={{
                  opacity: ctaOpacity,
                  y: ctaY,
                  backgroundColor: ctaBg,
                  color: ctaText,
                  // Softer halo (50% → 35% alpha, larger blur, no
                  // downward bias) so the button glows rather than
                  // casting a heavy product-page drop shadow.
                  boxShadow: `0 8px 32px -8px ${accentColor}59, 0 1px 0 rgba(255,255,255,0.08) inset`,
                  letterSpacing: "-0.005em",
                }}
                className="mt-5 font-semibold px-7 py-3 rounded-full text-sm md:text-base hover:brightness-105 transition-all"
              >
                <InlineText
                  value={props.ctaText}
                  onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, ctaText: v }) : undefined}
                style={{ fontFamily: BODY }}/>
              </motion.button>
            ) : null}
          </div>

          {/* Scroll hint (only visible at the very start) */}
          <motion.div
            style={{ opacity: hintOpacity, color: hintColor }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs uppercase tracking-widest flex flex-col items-center gap-2"
          >
            <span style={{ fontFamily: BODY }}>Scroll</span>
            <span className="block w-px h-8" style={{ backgroundColor: hintBar, fontFamily: BODY }} />
          </motion.div>
        </div>

        {/* Marquee tag strip */}
        {marqueeTags.length > 0 && (
          <MarqueeTags
            tags={marqueeTags}
            theme={theme}
            accentColor={accentColor}
            scrollYProgress={scrollYProgress}
          />
        )}

        {/* Top-most: subtle film grain */}
        {showGrain && <GrainOverlay />}
      </div>

      <EmailCaptureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        email={email}
        mode={submitMode === "modal-chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={emailCfg.modalChilipiperUrl}
        primaryColor={brandPrimary}
        accentColor={accentColor}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="scroll-assembly"
        formSource={emailCfg.modalFormSource ?? "simple"}
        linkedFormId={emailCfg.modalFormId}
        marketoBaseUrl={emailCfg.modalMarketoBaseUrl}
        marketoMunchkinId={emailCfg.modalMarketoMunchkinId}
        marketoFormId={emailCfg.modalMarketoFormId}
        formConfig={{
          headline: emailCfg.modalHeadline,
          subheadline: emailCfg.modalSubheadline,
          submitText: emailCfg.modalSubmitText,
          successMessage: emailCfg.modalSuccessMessage,
          disclaimer: emailCfg.modalDisclaimer,
          showFirstName: emailCfg.modalShowFirstName,
          showLastName: emailCfg.modalShowLastName,
          showPhone: emailCfg.modalShowPhone,
          showCompany: emailCfg.modalShowCompany,
        }}
      />
    </div>
  );
}
