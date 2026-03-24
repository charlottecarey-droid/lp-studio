import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TrustBarBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";

interface Props {
  props: TrustBarBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
}

function parseNumeric(value: string): number | null {
  const match = value.match(/[\d,]+(\.\d+)?/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ""));
}

function formatWithSuffix(original: string, count: number): string {
  return original.replace(/[\d,]+(\.\d+)?/, count.toLocaleString());
}

function AnimatedStat({ value, enabled }: { value: string; enabled: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState<number | null>(null);
  const triggered = useRef(false);
  const numeric = parseNumeric(value);

  useEffect(() => {
    if (!enabled || numeric === null) return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || triggered.current) return;
      triggered.current = true;
      obs.disconnect();

      const duration = 1400;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setCount(Math.round(eased * numeric));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });

    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, numeric]);

  const display = (enabled && count !== null && numeric !== null)
    ? formatWithSuffix(value, count)
    : value;

  return <span ref={ref}>{display}</span>;
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
              <AnimatedStat value={item.value} enabled={animationsEnabled} />
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
