import { cn } from "@/lib/utils";
import type { TrustBarBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";
import { useCountUp } from "@/hooks/use-count-up";
import { InlineImage } from "@/components/InlineImage";
import { InlineText } from "@/components/InlineText";
import { RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_NUMBERS_FONT } from "@/lib/brand-fonts";
const NUMBERS = BRAND_NUMBERS_FONT;

const BODY = BRAND_BODY_FONT;

interface Props {
  props: TrustBarBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: TrustBarBlockProps) => void;
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

  if (!parsed) return <span style={{ fontFamily: NUMBERS }}>{value}</span>;

  const display = enabled
    ? `${parsed.prefix}${count.toLocaleString()}${parsed.suffix}`
    : value;

  return <span ref={countRef} style={{ fontFamily: NUMBERS }}>{display}</span>;
}

export function BlockTrustBar({ props, brand, animationsEnabled = true, onFieldChange }: Props) {
  const items = props.items ?? [];
  const updateItem = (i: number, patch: Partial<{ value: string; label: string; image: string }>) => {
    if (!onFieldChange) return;
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    onFieldChange({ ...props, items: next });
  };
  const bg = props.bgColor ?? "#F8FAF9";
  // "logo" display mode renders every item image at a larger, centered size so
  // real company logos read legibly — mirroring the Case Study — Logo Results
  // Row block. The default "icon" mode keeps the compact, imageSize-driven band
  // so existing pages are unchanged.
  const isLogo = props.displayMode === "logo";
  // Per-item images share one global height so the row reads evenly. "md"
  // preserves the original h-12 md:h-14 band; larger steps suit logos/photos.
  const imageHeightClass = isLogo
    ? "h-16 md:h-24"
    : {
        sm: "h-10 md:h-12",
        md: "h-12 md:h-14",
        lg: "h-16 md:h-20",
        xl: "h-20 md:h-28",
      }[props.imageSize ?? "md"];
  // The trust bar always sits on a light surface, so the stat numbers must use
  // the contrast-guarded on-light heading token rather than raw brand-primary.
  // resolveHeadingColor keeps brand-primary when it clears WCAG AA on the page
  // background and otherwise steps down to a near-black ink — so a tenant whose
  // primary is light/near-white gets legible stats instead of white-on-white.
  const statColor = props.statColor ?? "var(--brand-heading-on-light)";
  const labelColor = props.labelColor ?? "#4A6358";
  const borderColor = props.borderColor ?? "#e2e8f0";
  const accent = props.statColor && props.statColor.startsWith("#") ? props.statColor : brand.primaryColor ?? "#4f46e5";
  const editing = !!onFieldChange;
  const gridClass = "max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-0";

  const renderItem = (item: TrustBarBlockProps["items"][number], i: number) => (
    <div
      className="flex flex-col items-center text-center px-8 py-2"
      style={i > 0 ? { borderLeft: `1px solid ${borderColor}` } : undefined}
    >
      {item.image ? (
        // A logo/photo-style trust item replaces the numeric stat with the
        // supplied image; the label still reads beneath it.
        <div className={cn(imageHeightClass, "mb-2 flex items-center justify-center")}>
          <InlineImage
            src={item.image}
            alt={item.imageAlt ?? item.label}
            loading="lazy"
            className="max-h-full w-auto object-contain"
            wrapperClassName="inline-flex h-full items-center justify-center"
            onUpdate={onFieldChange ? (url) => updateItem(i, { image: url }) : undefined}
          />
        </div>
      ) : (
        <span
          className={cn("text-3xl md:text-4xl font-display mb-1", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))}
          style={{ color: statColor, fontFamily: NUMBERS }}
        >
          {onFieldChange ? (
            <InlineText
              value={item.value}
              onUpdate={(v) => updateItem(i, { value: v })}
            style={{ fontFamily: NUMBERS }}/>
          ) : (
            <AnimatedStat value={item.value} enabled={(props.countUpEnabled ?? true) && animationsEnabled} />
          )}
        </span>
      )}
      <span
        className="mb-2 mt-0.5 h-0.5 w-7 rounded-full"
        style={{ background: `linear-gradient(to right, ${accent}, ${accent}33)` }}
        aria-hidden
      />
      <InlineText
        as="span"
        value={item.label}
        onUpdate={onFieldChange ? (v) => updateItem(i, { label: v }) : undefined}
        className="text-sm font-medium uppercase tracking-wider"
        style={{ color: labelColor, fontFamily: BRAND_BODY_FONT }}
      />
    </div>
  );

  return (
    <section
      className="relative w-full overflow-hidden py-12"
      style={{ backgroundColor: bg, borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[32rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}14, transparent 70%)` }}
      />
      {editing ? (
        <div className={`relative z-10 ${gridClass}`}>
          {items.map((item, i) => (
            <div key={i}>{renderItem(item, i)}</div>
          ))}
        </div>
      ) : (
        <RevealStagger className={`relative z-10 ${gridClass}`}>
          {items.map((item, i) => (
            <RevealItem key={i}>{renderItem(item, i)}</RevealItem>
          ))}
        </RevealStagger>
      )}
    </section>
  );
}
