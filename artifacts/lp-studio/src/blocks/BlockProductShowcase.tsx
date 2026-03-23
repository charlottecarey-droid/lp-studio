import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { ProductShowcaseBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: ProductShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ProductShowcaseBlockProps) => void;
}

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function BlockProductShowcase({ props, brand, onFieldChange }: Props) {
  const updateCard = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const cards = props.cards.map((c, idx) => idx === i ? { ...c, [key]: value } : c);
    onFieldChange({ ...props, cards });
  };

  return (
    <section className={cn("w-full bg-slate-50", SECTION_PY[brand.sectionPadding])}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12 space-y-3">
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined}
            className="text-3xl lg:text-4xl font-bold"
            style={{ color: brand.primaryColor }}
          />
          {props.subheadline && (
            <InlineText
              as="p"
              value={props.subheadline}
              onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, subheadline: v }) : undefined}
              className="text-lg text-slate-500 max-w-2xl mx-auto"
              multiline
            />
          )}
        </div>

        <div className={cn("grid grid-cols-1 gap-6", GRID_COLS[props.columns])}>
          {props.cards.map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <InlineText
                as="h3"
                value={card.name}
                onUpdate={onFieldChange ? (v) => updateCard(i, "name", v) : undefined}
                className="text-lg font-bold"
                style={{ color: brand.primaryColor }}
              />
              <InlineText
                as="p"
                value={card.description}
                onUpdate={onFieldChange ? (v) => updateCard(i, "description", v) : undefined}
                className="text-sm text-slate-500 leading-relaxed flex-1"
                multiline
              />
              {card.badge && (
                <div className="mt-2">
                  <span
                    className="inline-block text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
                  >
                    <InlineText
                      value={card.badge}
                      onUpdate={onFieldChange ? (v) => updateCard(i, "badge", v) : undefined}
                    />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
