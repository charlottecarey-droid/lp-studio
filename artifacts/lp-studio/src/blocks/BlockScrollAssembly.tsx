import { useRef, useState } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import type { ScrollAssemblyBlockProps, ScrollAssemblyPiece } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";
import { InlineEmailCapture } from "@/components/InlineEmailCapture";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { appendEmailToUrl } from "@/lib/append-email";

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

function fromOffset(from: ScrollAssemblyPiece["from"]): { x: number; y: number; rotate: number; scale: number } {
  switch (from) {
    case "left":   return { x: -260, y: 0,    rotate: -8,  scale: 0.9 };
    case "right":  return { x: 260,  y: 0,    rotate: 8,   scale: 0.9 };
    case "top":    return { x: 0,    y: -180, rotate: 0,   scale: 0.85 };
    case "bottom": return { x: 0,    y: 180,  rotate: 0,   scale: 0.85 };
    case "scale":  return { x: 0,    y: 0,    rotate: 0,   scale: 0.4 };
    case "fade":
    default:       return { x: 0,    y: 0,    rotate: 0,   scale: 1 };
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

  if (piece.kind === "image") {
    return (
      <motion.div
        style={{ opacity, x, y, rotate, scale, willChange: "transform, opacity" }}
        className="relative"
      >
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-white/10 to-white/0 blur-xl" />
        <img
          src={piece.content}
          alt=""
          className="relative rounded-2xl shadow-2xl object-cover w-full max-w-md aspect-[4/3] ring-1 ring-black/5"
        />
      </motion.div>
    );
  }

  if (piece.kind === "shape") {
    const c = piece.color || "var(--brand-accent)";
    return (
      <motion.div
        style={{
          opacity, x, y, rotate, scale,
          background: `radial-gradient(circle at 30% 30%, ${c} 0%, ${c} 60%, rgba(0,0,0,0.15) 100%)`,
          boxShadow: `0 20px 60px -10px ${c}55, 0 0 0 1px rgba(0,0,0,0.04) inset`,
          willChange: "transform, opacity",
        }}
        className="w-28 h-28 rounded-3xl"
      />
    );
  }

  // text-display | text-headline | text-body
  const sizeClass =
    piece.kind === "text-display"  ? "text-6xl md:text-8xl lg:text-[10rem] font-bold tracking-tight leading-[0.92]" :
    piece.kind === "text-headline" ? "text-3xl md:text-5xl font-bold tracking-tight leading-tight" :
                                     "text-base md:text-lg max-w-xl leading-relaxed";

  const defaultColor =
    piece.kind === "text-body"
      ? (theme === "dark" ? "rgba(255,255,255,0.75)" : "rgb(71 85 105)")
      : (theme === "dark" ? "#fff" : "var(--brand-primary)");

  return (
    <motion.div
      style={{
        opacity, x, y, rotate, scale,
        color: piece.color || defaultColor,
        willChange: "transform, opacity",
      }}
      className={sizeClass}
    >
      <InlineText value={piece.content} onUpdate={onTextChange} />
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
}: {
  src: string;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
}) {
  // Scatter images deterministically across the viewport with varying parallax.
  const positions: Array<{ top: string; left: string; rot: number; size: number; depth: number }> = [
    { top: "8%",  left: "4%",  rot: -8,  size: 220, depth: 0.6 },
    { top: "62%", left: "78%", rot: 6,   size: 260, depth: 1.0 },
    { top: "48%", left: "2%",  rot: -4,  size: 180, depth: 0.8 },
    { top: "14%", left: "76%", rot: 9,   size: 200, depth: 1.2 },
    { top: "78%", left: "30%", rot: -3,  size: 160, depth: 0.7 },
    { top: "30%", left: "50%", rot: 4,   size: 140, depth: 1.4 },
  ];
  const pos = positions[index % positions.length];

  // Drift + slight rotate as scroll advances. Items further "back" (smaller depth) move less.
  const y = useTransform(scrollYProgress, [0, 1], [60 * pos.depth, -120 * pos.depth]);
  const x = useTransform(scrollYProgress, [0, 1], [(index % 2 === 0 ? -1 : 1) * 30 * pos.depth, (index % 2 === 0 ? 1 : -1) * 30 * pos.depth]);
  const rotate = useTransform(scrollYProgress, [0, 1], [pos.rot, pos.rot + (index % 2 === 0 ? 4 : -4)]);
  // Fade at very start and very end so they don't compete with focal pieces.
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.85, 1], [0, 0.55, 0.55, 0.2]);

  // Lift larger items in front. Total used to keep keys stable.
  void total;

  return (
    <motion.div
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        width: pos.size,
        height: pos.size * 0.75,
        x, y, rotate, opacity,
        zIndex: Math.round(pos.depth * 2),
        willChange: "transform, opacity",
      }}
      className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10 pointer-events-none"
    >
      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20" />
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
  return (
    <>
      <motion.div
        style={{ y: y1, background: `radial-gradient(circle, ${accentColor}55 0%, transparent 70%)` }}
        className="absolute -top-32 -right-32 w-[42rem] h-[42rem] rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        style={{ y: y2, background: `radial-gradient(circle, ${brandPrimary}40 0%, transparent 70%)` }}
        className="absolute -bottom-40 -left-32 w-[44rem] h-[44rem] rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        style={{ y: y3, background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)` }}
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
          <span
            key={i}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest backdrop-blur"
            style={{
              backgroundColor: tagBg,
              border: `1px solid ${tagBorder}`,
              color: tagText,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
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
  const accentColor = props.accentColor || brand.accentColor || "#C7E738";
  const brandPrimary = brand.primaryColor || "#003a30";
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
  const spotlightOpacity = useTransform(scrollYProgress, [0, 0.4, 0.95], [0, 0.45, 0.2]);

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

        {/* Foreground: pieces */}
        <div className="relative z-30 h-full w-full flex items-center justify-center">
          <div className="relative w-full max-w-6xl mx-auto px-6 md:px-10 flex flex-col items-center gap-6 md:gap-8 text-center">
            {props.eyebrow && (
              <p
                className="text-xs font-bold uppercase tracking-[0.25em] mb-1 px-4 py-1.5 rounded-full"
                style={{
                  color: eyebrowColor,
                  border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,58,48,0.2)"}`,
                  backgroundColor: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <InlineText
                  value={props.eyebrow}
                  onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined}
                />
              </p>
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
                className="mt-4"
              >
                <InlineEmailCapture
                  email={email}
                  onEmailChange={setEmail}
                  onSubmit={handleSubmit}
                  placeholder={props.emailPlaceholder ?? "Email address"}
                  buttonText={props.ctaText || "Get started"}
                  buttonBg={accentColor}
                  buttonColor={brandPrimary}
                  pillBg={theme === "dark" ? "rgba(255,255,255,0.95)" : "#ffffff"}
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
                  boxShadow: `0 20px 50px -12px ${accentColor}80`,
                }}
                className="mt-4 font-bold px-10 py-4 rounded-xl text-base hover:brightness-105 transition-all"
              >
                <InlineText
                  value={props.ctaText}
                  onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, ctaText: v }) : undefined}
                />
              </motion.button>
            ) : null}
          </div>

          {/* Scroll hint (only visible at the very start) */}
          <motion.div
            style={{ opacity: hintOpacity, color: hintColor }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs uppercase tracking-widest flex flex-col items-center gap-2"
          >
            <span>Scroll</span>
            <span className="block w-px h-8" style={{ backgroundColor: hintBar }} />
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
