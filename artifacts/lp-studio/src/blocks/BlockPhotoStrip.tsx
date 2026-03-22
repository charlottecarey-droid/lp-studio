import type { PhotoStripBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: PhotoStripBlockProps;
  brand: BrandConfig;
}

export function BlockPhotoStrip({ props }: Props) {
  return (
    <section className="w-full h-64 md:h-80 overflow-hidden relative bg-white">
      <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
      <div className="flex h-full animate-marquee w-max">
        {[...props.images, ...props.images].map((img, i) => (
          <img
            key={i}
            src={img.src}
            alt={img.alt}
            loading="lazy"
            className="h-full aspect-square md:w-[280px] shrink-0 object-cover"
          />
        ))}
      </div>
    </section>
  );
}
