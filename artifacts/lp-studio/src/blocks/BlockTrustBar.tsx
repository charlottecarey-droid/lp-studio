import { cn } from "@/lib/utils";
import type { TrustBarBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";

interface Props {
  props: TrustBarBlockProps;
  brand: BrandConfig;
}

export function BlockTrustBar({ props, brand }: Props) {
  const items = props.items ?? [];
  const bg = props.bgColor ?? "#F8FAF9";
  const statColor = props.statColor ?? "#003A30";
  const labelColor = props.labelColor ?? "#4A6358";
  const borderColor = props.borderColor ?? "#e2e8f0";

  return (
    <section
      className="w-full py-12"
      style={{ backgroundColor: bg, borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}
    >
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center text-center px-4">
            <span
              className={cn("text-3xl md:text-4xl font-display mb-1", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))}
              style={{ color: statColor }}
            >
              {item.value}
            </span>
            <span className="text-sm font-medium uppercase tracking-wider" style={{ color: labelColor }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
