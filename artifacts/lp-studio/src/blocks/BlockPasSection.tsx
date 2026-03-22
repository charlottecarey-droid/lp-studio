import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PasSectionBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";

interface Props {
  props: PasSectionBlockProps;
  brand: BrandConfig;
}

export function BlockPasSection({ props, brand }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  return (
    <section className={cn("w-full bg-[#003A30] text-white px-6", sectionPy)}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
        <div className="md:w-1/2 space-y-6">
          <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight">{props.headline}</h2>
          <p className="text-lg text-white/80 leading-relaxed">{props.body}</p>
        </div>
        <div className="md:w-1/2">
          <ul className="space-y-4">
            {props.bullets?.map((bullet, i) => (
              <li key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <AlertTriangle className="w-6 h-6 text-[#C7E738] shrink-0 mt-0.5" />
                <span className="text-white/90 font-medium leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
