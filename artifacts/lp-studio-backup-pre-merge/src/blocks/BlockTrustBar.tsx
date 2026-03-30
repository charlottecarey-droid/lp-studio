import { cn } from "@/lib/utils";
import type { TrustBarBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";
import { useCountUp } from "@/hooks/use-count-up";

interface Props {
  props: TrustBarBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
}

function parseNumeric(value: string): { num: number; prefix: string; suffix: string } | null {
  const match = value.match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ""));
  return { num, prefix: match[1], suffix: match[3] };
}

function AnimatedStat({ value, enabled }: { value: string; enabled: boolean }) {
  const parsed = parseNumeric(value);
  const [count, countRef] = useCountUp(parsed?.num ?? 0, 1400, enabled && !!parsed);

  if (!parsed) return <span>{value}</span>;

  const display = enabled
    ? `${parsed.prefix}${count.toLocaleString()}${parsed.suffix}`
    : value;

  return <span ref={countRef}>{display}</span>;
}

export function BlockTrustBar({ props, brand, animationsEnabled = true }: Props) {
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
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-0">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center text-center px-8 py-2"
            style={i > 0 ? { borderLeft: `1px solid ${borderColor}` } : undefined}
          >
            <span
              className={cn("text-3xl md:text-4xl font-display mb-1", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))}
              style={{ color: statColor }}
            >
              <AnimatedStat value={item.value} enabled={(props.countUpEnabled ?? true) && animationsEnabled} />
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
