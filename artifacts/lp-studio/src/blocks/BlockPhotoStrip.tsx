import type { PhotoStripBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: PhotoStripBlockProps;
  brand: BrandConfig;
}

const SIZE_H: Record<string, number> = {
  xs: 64,
  sm: 100,
  md: 160,
  lg: 240,
  xl: 320,
};

const SPEED_S: Record<string, number> = {
  slow: 80,
  normal: 40,
  fast: 18,
};

export function BlockPhotoStrip({ props }: Props) {
  const size = props.imageSize ?? "lg";
  const heightPx = SIZE_H[size];
  const gap = props.gap ?? 0;
  const showGradient = props.showGradient !== false;
  const fit = props.objectFit ?? "cover";
  const speed = props.speed ?? "normal";
  const duration = SPEED_S[speed];

  const doubled = [...props.images, ...props.images];

  return (
    <section
      className="w-full overflow-hidden relative bg-white"
      style={{ height: `${heightPx}px` }}
    >
      {showGradient && (
        <>
          <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
        </>
      )}
      <div
        className="flex h-full animate-marquee w-max"
        style={{ animationDuration: `${duration}s`, columnGap: gap > 0 ? `${gap}px` : undefined }}
      >
        {doubled.map((img, i) => (
          <img
            key={i}
            src={img.src}
            alt={img.alt}
            loading="lazy"
            style={{
              height: "100%",
              width: size === "xs" || size === "sm" ? "auto" : `${heightPx * 1.2}px`,
              flexShrink: 0,
              objectFit: fit,
            }}
          />
        ))}
      </div>
    </section>
  );
}
