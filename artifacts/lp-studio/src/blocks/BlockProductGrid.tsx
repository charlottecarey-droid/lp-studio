import { cn } from "@/lib/utils";
import type { ProductGridBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";

interface Props {
  props: ProductGridBlockProps;
  brand: BrandConfig;
}

export function BlockProductGrid({ props, brand }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  return (
    <section className={cn("w-full bg-white px-6", sectionPy)}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          {props.headline && (
            <h2 className="text-3xl md:text-5xl font-display font-bold text-[#003A30] mb-6">{props.headline}</h2>
          )}
          {props.subheadline && (
            <p className="text-lg md:text-xl text-[#4A6358] leading-relaxed">{props.subheadline}</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {props.items.map((item, i) => (
            <div key={i} className="group rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 bg-white flex flex-col">
              <div className="w-full h-52 overflow-hidden bg-slate-50">
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-[#003A30] mb-2">{item.title}</h3>
                <p className="text-[#4A6358] text-sm leading-relaxed flex-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
