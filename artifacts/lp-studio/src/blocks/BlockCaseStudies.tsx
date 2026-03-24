import type { CaseStudiesBlockProps } from "../lib/block-types";
import type { BrandConfig } from "../lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "../lib/brand-config";
import { getHeadlineSizeClass } from "../lib/typography";
import { ImageIcon } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  props: CaseStudiesBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
}

function Placeholder({ className }: { className?: string }) {
  return (
    <div className={`bg-slate-200 flex items-center justify-center ${className ?? ""}`}>
      <ImageIcon className="w-10 h-10 text-slate-400" />
    </div>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function BlockCaseStudies({ props, brand, animationsEnabled = true }: Props) {
  const { headline, subheadline, items, backgroundStyle } = props;
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const bg = backgroundStyle === "light-gray" ? "bg-slate-50" : "bg-white";
  const featured = items[0];
  const rest = items.slice(1);

  return (
    <section className={`${bg} ${sectionPy}`}>
      <div className="max-w-7xl mx-auto px-6">
        {headline && (
          <h2 className={`${getHeadlineSizeClass(undefined, brand.h2Size ?? "lg")} ${getHeadingWeightClass(brand)} ${getHeadingLetterSpacingClass(brand)} font-display mb-2`}>{headline}</h2>
        )}
        {subheadline && (
          <p className={`${getBodySizeClass(brand)} text-slate-500 mb-10`}>{subheadline}</p>
        )}

        <div className={`grid grid-cols-1 gap-4 ${{
          2: "md:grid-cols-2",
          3: "md:grid-cols-3",
          4: "md:grid-cols-4",
        }[props.columns ?? 2]}`}>
          {featured && (
            <motion.a
              href={featured.url || "#"}
              className={`group relative ${(props.columns ?? 2) === 2 ? "row-span-2" : ""} rounded-xl overflow-hidden min-h-[400px] md:min-h-[520px] flex flex-col justify-end`}
              initial={animationsEnabled ? { opacity: 0, y: 24 } : undefined}
              whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, amount: 0.1 }}
              transition={animationsEnabled ? { duration: 0.6, ease: EASE } : undefined}
              whileHover={animationsEnabled ? { y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.14)" } : undefined}
            >
              {featured.image ? (
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Placeholder className="absolute inset-0 w-full h-full" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {featured.logoUrl && (
                <img
                  src={featured.logoUrl}
                  alt=""
                  className="absolute top-6 left-6 h-10 object-contain brightness-0 invert"
                />
              )}
              <div className="relative p-6 md:p-8">
                <h3 className={`${getHeadlineSizeClass(undefined, brand.h3Size ?? "md")} ${getHeadingWeightClass(brand)} text-white leading-snug mb-2`}>
                  {featured.title}
                </h3>
                {featured.categories && (
                  <p className="text-xs uppercase tracking-wider text-white/60">
                    {featured.categories}
                  </p>
                )}
              </div>
            </motion.a>
          )}

          {rest.map((item, i) => (
            <motion.a
              key={i}
              href={item.url || "#"}
              className="group relative rounded-xl overflow-hidden min-h-[250px] flex flex-col justify-end"
              initial={animationsEnabled ? { opacity: 0, y: 24 } : undefined}
              whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, amount: 0.1 }}
              transition={animationsEnabled ? { duration: 0.55, ease: EASE, delay: (i + 1) * 0.07 } : undefined}
              whileHover={animationsEnabled ? { y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.14)" } : undefined}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Placeholder className="absolute inset-0 w-full h-full" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              {item.logoUrl && (
                <img
                  src={item.logoUrl}
                  alt=""
                  className="absolute top-4 left-4 h-8 object-contain brightness-0 invert"
                />
              )}
              <div className="relative p-5">
                <h3 className={`${getHeadlineSizeClass(undefined, brand.h3Size ?? "sm")} ${getHeadingWeightClass(brand)} text-white leading-snug mb-1`}>
                  {item.title}
                </h3>
                {item.categories && (
                  <p className="text-[11px] uppercase tracking-wider text-white/60">
                    {item.categories}
                  </p>
                )}
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
