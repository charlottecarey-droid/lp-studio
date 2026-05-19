import type { BrandConfig } from "@/lib/brand-config";
import type { MenuSectionBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: MenuSectionBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MenuSectionBlockProps) => void;
}

export function BlockMenuSection({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FAF7F2";
  const text = props.textColor ?? "#1A1A1A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#8B0000";

  const updateField = <K extends keyof MenuSectionBlockProps>(
    key: K,
    value: MenuSectionBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  return (
    <section
      className="px-6 py-20 sm:py-28"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("eyebrow", v) : undefined}
              className="text-xs uppercase tracking-[0.3em] mb-4 opacity-70"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => updateField("headline", v) : undefined}
            className="text-4xl sm:text-5xl font-serif tracking-tight" style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("subheadline", v) : undefined}
              className="mt-4 text-base sm:text-lg opacity-75 max-w-2xl mx-auto" style={{ fontFamily: BODY }} />
          )}
        </div>

        <div className="space-y-14">
          {props.courses.map((course, ci) => (
            <div key={ci}>
              <div className="flex items-end justify-between gap-4 border-b pb-3 mb-6"
                   style={{ borderColor: `${text}22` }}>
                <h3 className="text-2xl font-serif" style={{ color: accent, fontFamily: DISPLAY }}>
                  {course.title}
                </h3>
                {course.description && (
                  <p className="text-xs opacity-60 italic max-w-xs text-right" style={{ fontFamily: BODY }}>
                    {course.description}
                  </p>
                )}
              </div>
              <ul className="space-y-5">
                {course.dishes.map((dish, di) => (
                  <li key={di} className="flex items-baseline gap-4" style={{ fontFamily: BODY }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-lg" style={{ fontFamily: BODY }}>{dish.name}</span>
                        {dish.tags?.map((t, ti) => (
                          <span key={ti} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ ...{backgroundColor: `${accent}22`, color: accent}, ...{fontFamily: BODY} }}>
                            {t}
                          </span>
                        ))}
                      </div>
                      {dish.description && (
                        <p className="text-sm opacity-70 mt-1" style={{ fontFamily: BODY }}>{dish.description}</p>
                      )}
                    </div>
                    <div
                      className="font-serif tabular-nums"
                      style={{ color: accent }}
                      aria-label="price"
                    >
                      {dish.price}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {props.footnote && (
          <p className="text-xs italic text-center opacity-60 mt-12" style={{ fontFamily: BODY }}>
            {props.footnote}
          </p>
        )}
      </div>
    </section>
  );
}
