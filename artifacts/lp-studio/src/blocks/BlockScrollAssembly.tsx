import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import type { ScrollAssemblyBlockProps, ScrollAssemblyPiece } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: ScrollAssemblyBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ScrollAssemblyBlockProps) => void;
  onCtaClick?: () => void;
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
  onTextChange,
}: {
  piece: ScrollAssemblyPiece;
  scrollYProgress: MotionValue<number>;
  index: number;
  total: number;
  onTextChange?: (v: string) => void;
}) {
  // Each piece animates across a slice of the overall scroll. By default we
  // distribute slices evenly; `revealAt` lets you bias one piece's slice.
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
      <motion.img
        src={piece.content}
        alt=""
        style={{ opacity, x, y, rotate, scale, willChange: "transform, opacity" }}
        className="rounded-2xl shadow-2xl object-cover w-full max-w-md aspect-[4/3]"
      />
    );
  }

  if (piece.kind === "shape") {
    return (
      <motion.div
        style={{
          opacity, x, y, rotate, scale,
          backgroundColor: piece.color || "var(--brand-accent)",
          willChange: "transform, opacity",
        }}
        className="w-24 h-24 rounded-3xl shadow-xl"
      />
    );
  }

  // text-display | text-headline | text-body
  const sizeClass =
    piece.kind === "text-display"  ? "text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight leading-[0.95]" :
    piece.kind === "text-headline" ? "text-3xl md:text-5xl font-bold tracking-tight leading-tight" :
                                     "text-base md:text-lg text-slate-600 max-w-xl leading-relaxed";

  return (
    <motion.div
      style={{
        opacity, x, y, rotate, scale,
        color: piece.color || (piece.kind === "text-body" ? undefined : "var(--brand-primary)"),
        willChange: "transform, opacity",
      }}
      className={sizeClass}
    >
      <InlineText value={piece.content} onUpdate={onTextChange} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Block                                                                    */
/* ------------------------------------------------------------------------- */

export function BlockScrollAssembly({ props, onFieldChange, onCtaClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const pieces = props.pieces ?? [];
  const heightVh = Math.max(150, Math.min(600, (props.scrollLengthVh ?? 100) * Math.max(1, pieces.length)));
  const bg = props.bgColor || "#FDFCFA";

  // Hooks must run unconditionally — declare these once at the top regardless
  // of whether the CTA / scroll hint actually render, otherwise hook order
  // breaks when those props are toggled.
  const ctaOpacity = useTransform(scrollYProgress, [0.85, 0.95], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.85, 0.95], [12, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.06], [0.6, 0]);

  const updatePieceText = (i: number, v: string) => {
    if (!onFieldChange) return;
    const next = pieces.map((p, idx) => idx === i ? { ...p, content: v } : p);
    onFieldChange({ ...props, pieces: next });
  };

  return (
    <div
      ref={containerRef}
      style={{ height: `${heightVh}vh`, backgroundColor: bg }}
      className="relative w-full"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        <div className="relative w-full max-w-6xl mx-auto px-6 md:px-10 flex flex-col items-center gap-6 md:gap-8 text-center">
          {props.eyebrow && (
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-primary)] mb-1">
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
              onTextChange={onFieldChange && piece.kind.startsWith("text") ? (v) => updatePieceText(i, v) : undefined}
            />
          ))}

          {props.ctaText && (
            <motion.button
              onClick={() => (onCtaClick ? onCtaClick() : safeNavigate(props.ctaUrl ?? "#"))}
              style={{ opacity: ctaOpacity, y: ctaY }}
              className="mt-4 bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold px-10 py-4 rounded-xl text-base hover:brightness-105 transition-all"
            >
              <InlineText
                value={props.ctaText}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, ctaText: v }) : undefined}
              />
            </motion.button>
          )}

          {/* Scroll hint (only visible at the very start) */}
          <motion.div
            style={{ opacity: hintOpacity }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs uppercase tracking-widest text-slate-400 flex flex-col items-center gap-2"
          >
            <span>Scroll</span>
            <span className="block w-px h-8 bg-slate-300" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
