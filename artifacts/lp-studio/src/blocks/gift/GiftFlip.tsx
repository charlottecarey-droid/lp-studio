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
 * A product tile that (a) selects its gift when clicked and (b) can carry a
 * second view (e.g. the back of a shirt): `back` fades in over `front` on
 * hover; on touch the two dots under the photo are the flip control, so a
 * tap on the photo still selects. `children` are overlays that stay on top
 * of both views (number badge, ribbon, tag). In the builder (`enabled`
 * false) it is a plain tile so the image stays click-to-edit.
 */
export function GiftFlip({
  front,
  back,
  enabled,
  onSelect,
  children,
  className,
  style,
  dotColor,
  label,
}: {
  front: ReactNode;
  back?: ReactNode;
  enabled: boolean;
  /** Click / Enter on the tile chooses this gift. */
  onSelect?: () => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  dotColor: string;
  label?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const hasBack = enabled && !!back;
  const selectable = enabled && !!onSelect;
  if (!hasBack && !selectable) {
    return (
      <div className={className} style={style}>
        {front}
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(hasBack && "gift-flip", selectable && "cursor-pointer", className)}
      style={style}
      data-gift-flip={hasBack ? (flipped ? "back" : "front") : undefined}
      data-gift-select={selectable ? "true" : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-label={selectable ? (label ? `Choose ${label}` : "Choose this gift") : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={selectable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(); } } : undefined}
    >
      {hasBack && <style>{FLIP_CSS}</style>}
      {front}
      {hasBack && <div className="gift-flip-back pointer-events-none absolute inset-0" data-gift-back="true">{back}</div>}
      {children}
      {hasBack && (
        <button
          type="button"
          aria-label={flipped ? "Show the front" : "Show the other view"}
          aria-pressed={flipped}
          className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 px-4 pb-3 pt-4"
          onClick={(e) => { e.stopPropagation(); setFlipped((f) => !f); }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <span className="gift-flip-dot-a block h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
          <span className="gift-flip-dot-b block h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
        </button>
      )}
    </div>
  );
}
