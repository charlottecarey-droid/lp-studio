import type { ResourcesBlockProps } from "../lib/block-types";
import type { BrandConfig } from "../lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "../lib/brand-config";
import { getHeadlineSizeClass } from "../lib/typography";
import { ImageIcon, ArrowRight } from "lucide-react";

interface Props {
  props: ResourcesBlockProps;
  brand: BrandConfig;
}

export default function BlockResources({ props, brand }: Props) {
  const { headline, subheadline, columns, items, backgroundStyle } = props;
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const bgClass =
    backgroundStyle === "dark"
      ? "bg-slate-900 text-white"
      : backgroundStyle === "light-gray"
        ? "bg-slate-50 text-slate-900"
        : "bg-white text-slate-900";

  const cardBg =
    backgroundStyle === "dark" ? "bg-slate-800" : "bg-white";

  const gridCols =
    columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <section className={`${bgClass} ${sectionPy}`}>
      <div className="max-w-7xl mx-auto px-6">
        {headline && (
          <h2 className={`${getHeadlineSizeClass(undefined, brand.h2Size ?? "lg")} ${getHeadingWeightClass(brand)} ${getHeadingLetterSpacingClass(brand)} font-display mb-2`}>
            {headline}
          </h2>
        )}
        {subheadline && (
          <p className={`${getBodySizeClass(brand)} mb-10 ${backgroundStyle === "dark" ? "text-slate-400" : "text-slate-500"}`}>
            {subheadline}
          </p>
        )}

        <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
          {items.map((item, i) => (
            <a
              key={i}
              href={item.url || "#"}
              className={`group rounded-xl overflow-hidden ${cardBg} shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col`}
              style={backgroundStyle === "dark" ? { borderColor: "rgba(255,255,255,0.08)" } : undefined}
            >
              <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                {item.category && (
                  <span
                    className="text-xs uppercase tracking-wider font-medium mb-2"
                    style={{ color: brand.primaryColor }}
                  >
                    {item.category}
                  </span>
                )}
                <h3 className={`${getHeadlineSizeClass(undefined, brand.h3Size ?? "sm")} ${getHeadingWeightClass(brand)} leading-snug mb-2 ${backgroundStyle === "dark" ? "text-white" : "text-slate-900"}`}>
                  {item.title}
                </h3>
                {item.description && (
                  <p className={`text-sm leading-relaxed flex-1 ${backgroundStyle === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    {item.description}
                  </p>
                )}
                <div
                  className="mt-4 flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all"
                  style={{ color: brand.primaryColor }}
                >
                  Read more
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
