import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const FLIP_CSS = `
  .gift-flip-back { opacity: 0; transition: opacity .55s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .gift-flip:hover .gift-flip-back { opacity: 1; } .gift-flip:hover .gift-flip-dot-a { opacity: .35; } .gift-flip:hover .gift-flip-dot-b { opacity: 1; } }
  .gift-flip[data-gift-flip="back"] .gift-flip-back { opacity: 1; }
  .gift-flip[data-gift-flip="back"] .gift-flip-dot-a { opacity: .35; }
  .gift-flip[data-gift-flip="back"] .gift-flip-dot-b { opacity: 1; }
  .gift-flip-dot-a { opacity: 1; } .gift-flip-dot-b { opacity: .35; }
  .gift-flip-dot-a, .gift-flip-dot-b { transition: opacity .35s ease; }
  @media (prefers-reduced-motion: reduce) { .gift-flip-back { transition: none; } }
`;

/**
 * A product tile with an optional second view (e.g. the back of a shirt).
 * `front` is the tile's main content, `back` (when given) fades in over it
 * on hover — or flips on tap / Enter on touch and keyboard — and two small
 * dots show there is a second view. `children` are overlays that stay on top
 * of both views (number badge, ribbon, tag). In the builder (`enabled`
 * false) only the front renders so it stays click-to-edit.
 */
export function GiftFlip({
  front,
  back,
  enabled,
  children,
  className,
  style,
  dotColor,
  label,
}: {
  front: ReactNode;
  back?: ReactNode;
  enabled: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  dotColor: string;
  label?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const on = enabled && !!back;
  if (!on) {
    return (
      <div className={className} style={style}>
        {front}
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn("gift-flip", className)}
      style={style}
      data-gift-flip={flipped ? "back" : "front"}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={label ? `Show the other view of ${label}` : "Show the other view"}
      onPointerUp={(e) => { if (e.pointerType !== "mouse") setFlipped((f) => !f); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
    >
      <style>{FLIP_CSS}</style>
      {front}
      <div className="gift-flip-back pointer-events-none absolute inset-0" data-gift-back="true">{back}</div>
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        <span className="gift-flip-dot-a block h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
        <span className="gift-flip-dot-b block h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
      </span>
    </div>
  );
}
