import type { CSSProperties, ReactNode } from "react";
import { InlineImage } from "@/components/InlineImage";
import type { InvitePalette } from "@/lib/invite-theme";
import { cn } from "@/lib/utils";

/**
 * Shared by the "Kit" block family (kit-hero, kit-contents): a light product
 * tile on the brand-dark surface. Product shots almost always arrive on a
 * white or pale-grey studio background, so:
 *
 *  - `fit: "contain"` multiplies the image onto the tile — the white studio
 *    background disappears into the tile colour and only the product stays,
 *    the same trick the Stack family uses for white-UI screen recordings;
 *  - `fit: "cover"` fills the tile edge to edge (for packshots whose own
 *    backdrop IS the picture, e.g. a box on a seamless grey sweep).
 *
 * Without an image (registry defaults, unconfigured block) the tile still
 * looks designed: a soft gradient and a glyph, never an empty rectangle or a
 * broken `<img src="">`.
 */

export type KitTileFit = "contain" | "cover";

export const KIT_TILE_DEFAULT = "#F4F3EF";

export function KitProductTile({
  src,
  alt,
  fit = "contain",
  tileColor,
  palette,
  fallback,
  className,
  style,
  imgClassName,
  onUpdate,
  onAltUpdate,
}: {
  src?: string;
  alt?: string;
  fit?: KitTileFit;
  tileColor: string;
  palette: InvitePalette;
  /** Glyph shown when there is no image. */
  fallback: ReactNode;
  className?: string;
  style?: CSSProperties;
  imgClassName?: string;
  onUpdate?: (url: string) => void;
  onAltUpdate?: (alt: string) => void;
}) {
  const hasSrc = !!src && src.trim().length > 0;
  const isEditor = !!onUpdate;
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 30% 10%, #FFFFFF 0%, ${tileColor} 60%, color-mix(in srgb, ${tileColor} 86%, #000) 100%)`,
        ...style,
      }}
    >
      {hasSrc || isEditor ? (
        <InlineImage
          src={src ?? ""}
          alt={alt ?? ""}
          onUpdate={onUpdate}
          onAltUpdate={onAltUpdate}
          wrapperClassName="absolute inset-0"
          className={cn("absolute inset-0 h-full w-full", fit === "cover" ? "object-cover" : "object-contain p-[7%]", imgClassName)}
          style={fit === "contain" ? { mixBlendMode: "multiply" } : undefined}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="flex h-[38%] w-[38%] items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${palette.accent} 18%, transparent)`, color: "#0B0B0F" }}>
            {fallback}
          </div>
        </div>
      )}
    </div>
  );
}
