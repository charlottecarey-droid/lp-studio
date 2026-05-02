import * as Icons from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { BentoShowcaseBlockProps, BentoShowcaseTile } from "@/lib/block-types";
import { cn } from "@/lib/utils";

interface Props {
  props: BentoShowcaseBlockProps;
  brand: BrandConfig;
}

const SIZE_SPAN: Record<BentoShowcaseTile["size"], string> = {
  sm: "md:col-span-2 md:row-span-1",
  md: "md:col-span-2 md:row-span-2",
  lg: "md:col-span-3 md:row-span-2",
  xl: "md:col-span-4 md:row-span-2",
};

function Tile({
  tile,
  sectionBg,
  sectionText,
  accent,
}: {
  tile: BentoShowcaseTile;
  sectionBg: string;
  sectionText: string;
  accent: string;
}) {
  const bg = tile.bgColor || sectionBg;
  const text = tile.textColor || sectionText;

  if (tile.kind === "image") {
    return (
      <div
        className={cn(
          "relative rounded-3xl overflow-hidden min-h-[240px] group",
          SIZE_SPAN[tile.size],
        )}
        style={{ backgroundColor: bg }}
      >
        <img
          src={tile.primary}
          alt={tile.secondary || ""}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {tile.secondary && (
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
            <div className="text-white font-medium text-base">{tile.secondary}</div>
            {tile.tertiary && (
              <div className="text-white/70 text-xs uppercase tracking-widest mt-1">
                {tile.tertiary}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (tile.kind === "stat") {
    return (
      <div
        className={cn(
          "rounded-3xl p-8 lg:p-10 flex flex-col justify-end min-h-[240px]",
          SIZE_SPAN[tile.size],
        )}
        style={{ backgroundColor: bg, color: text }}
      >
        <div
          className="font-bold leading-none"
          style={{
            fontSize: "clamp(3.5rem, 7vw, 6.5rem)",
            color: accent,
            letterSpacing: "-0.04em",
          }}
        >
          {tile.primary}
        </div>
        {tile.secondary && (
          <div className="text-base lg:text-lg font-medium mt-3" style={{ opacity: 0.9 }}>
            {tile.secondary}
          </div>
        )}
        {tile.tertiary && (
          <div className="text-xs uppercase tracking-widest mt-2" style={{ opacity: 0.55 }}>
            {tile.tertiary}
          </div>
        )}
      </div>
    );
  }

  if (tile.kind === "quote") {
    return (
      <div
        className={cn(
          "rounded-3xl p-8 lg:p-10 flex flex-col justify-between min-h-[240px]",
          SIZE_SPAN[tile.size],
        )}
        style={{ backgroundColor: bg, color: text }}
      >
        <div
          className="font-serif text-2xl lg:text-3xl leading-snug"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          &ldquo;{tile.primary}&rdquo;
        </div>
        <div className="mt-6">
          {tile.secondary && (
            <div className="font-semibold text-sm">{tile.secondary}</div>
          )}
          {tile.tertiary && (
            <div className="text-xs mt-0.5" style={{ opacity: 0.65 }}>
              {tile.tertiary}
            </div>
          )}
        </div>
      </div>
    );
  }

  // feature
  const Icon = (tile.icon && (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[tile.icon]) || Icons.Sparkles;
  return (
    <div
      className={cn(
        "rounded-3xl p-8 lg:p-10 flex flex-col justify-between min-h-[240px]",
        SIZE_SPAN[tile.size],
      )}
      style={{ backgroundColor: bg, color: text }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: `${accent}1F`, color: accent }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="mt-6">
        <div className="font-semibold text-xl lg:text-2xl leading-tight">
          {tile.primary}
        </div>
        {tile.secondary && (
          <div className="text-sm lg:text-base mt-2" style={{ opacity: 0.75 }}>
            {tile.secondary}
          </div>
        )}
      </div>
    </div>
  );
}

export function BlockBentoShowcase({ props, brand }: Props) {
  const bg = props.bgColor || "#F4F4F5";
  const text = props.textColor || "#0A0A0A";
  const accent = props.accentColor || brand.accentColor || "#3B82F6";

  return (
    <section
      className="relative font-sans"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {(props.eyebrow || props.headline || props.subheadline) && (
          <div className="max-w-3xl mb-12 lg:mb-16">
            {props.eyebrow && (
              <div
                className="text-[11px] uppercase tracking-[0.28em] font-semibold mb-4"
                style={{ color: accent }}
              >
                {props.eyebrow}
              </div>
            )}
            {props.headline && (
              <h2
                className="font-bold tracking-tight leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
              >
                {props.headline}
              </h2>
            )}
            {props.subheadline && (
              <p
                className="text-base lg:text-lg leading-relaxed mt-4 max-w-2xl"
                style={{ opacity: 0.7 }}
              >
                {props.subheadline}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 lg:gap-5 auto-rows-[180px] md:auto-rows-[200px]">
          {props.tiles.map((tile, i) => (
            <Tile
              key={i}
              tile={tile}
              sectionBg="#FFFFFF"
              sectionText={text}
              accent={accent}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
