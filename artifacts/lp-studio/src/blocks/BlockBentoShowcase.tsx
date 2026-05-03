import * as Icons from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { BentoShowcaseBlockProps, BentoShowcaseTile } from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";

import type { ReactNode } from "react";

interface Props {
  props: BentoShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BentoShowcaseBlockProps) => void;
  /**
   * Optional nested children rendered below the tiles grid. Phase 2
   * back-compat for treating bento blocks as containers — when children are
   * present they appear as a secondary section under the existing tile grid.
   */
  childrenSlot?: ReactNode;
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
  onUpdate,
}: {
  tile: BentoShowcaseTile;
  sectionBg: string;
  sectionText: string;
  accent: string;
  onUpdate?: (patch: Partial<BentoShowcaseTile>) => void;
}) {
  const bg = tile.bgColor || sectionBg;
  const text = tile.textColor || sectionText;
  const setField = (key: keyof BentoShowcaseTile) =>
    onUpdate ? (v: string) => onUpdate({ [key]: v } as Partial<BentoShowcaseTile>) : undefined;

  if (tile.kind === "image") {
    return (
      <div
        className={cn(
          "relative rounded-3xl overflow-hidden min-h-[240px] group",
          SIZE_SPAN[tile.size],
        )}
        style={{ backgroundColor: bg }}
      >
        <InlineImage
          src={tile.primary}
          alt={tile.secondary || ""}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          wrapperClassName="absolute inset-0"
          onUpdate={onUpdate ? (url) => onUpdate({ primary: url }) : undefined}
        />
        {(tile.secondary || onUpdate) && (
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/70 to-transparent z-10">
            <div className="text-white font-medium text-base">
              <InlineText as="span" value={tile.secondary || ""} onUpdate={setField("secondary")} />
            </div>
            {(tile.tertiary || onUpdate) && (
              <div className="text-white/70 text-xs uppercase tracking-widest mt-1">
                <InlineText as="span" value={tile.tertiary || ""} onUpdate={setField("tertiary")} />
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
          <InlineText as="span" value={tile.primary || ""} onUpdate={setField("primary")} />
        </div>
        {(tile.secondary || onUpdate) && (
          <div className="text-base lg:text-lg font-medium mt-3" style={{ opacity: 0.9 }}>
            <InlineText as="span" value={tile.secondary || ""} onUpdate={setField("secondary")} />
          </div>
        )}
        {(tile.tertiary || onUpdate) && (
          <div className="text-xs uppercase tracking-widest mt-2" style={{ opacity: 0.55 }}>
            <InlineText as="span" value={tile.tertiary || ""} onUpdate={setField("tertiary")} />
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
          &ldquo;<InlineText as="span" value={tile.primary} onUpdate={setField("primary")} multiline />&rdquo;
        </div>
        <div className="mt-6">
          {(tile.secondary || onUpdate) && (
            <div className="font-semibold text-sm">
              <InlineText as="span" value={tile.secondary || ""} onUpdate={setField("secondary")} />
            </div>
          )}
          {(tile.tertiary || onUpdate) && (
            <div className="text-xs mt-0.5" style={{ opacity: 0.65 }}>
              <InlineText as="span" value={tile.tertiary || ""} onUpdate={setField("tertiary")} />
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
          <InlineText as="span" value={tile.primary} onUpdate={setField("primary")} multiline />
        </div>
        {(tile.secondary || onUpdate) && (
          <div className="text-sm lg:text-base mt-2" style={{ opacity: 0.75 }}>
            <InlineText as="span" value={tile.secondary || ""} onUpdate={setField("secondary")} multiline />
          </div>
        )}
      </div>
    </div>
  );
}

export function BlockBentoShowcase({ props, brand, onFieldChange, childrenSlot }: Props) {
  const bg = props.bgColor || "#F4F4F5";
  const text = props.textColor || "#0A0A0A";
  const accent = props.accentColor || brand.accentColor || "#3B82F6";
  const field = (key: keyof BentoShowcaseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as BentoShowcaseBlockProps[typeof key] }) : undefined;
  const updateTile = onFieldChange
    ? (i: number, patch: Partial<BentoShowcaseTile>) =>
        onFieldChange({
          ...props,
          tiles: props.tiles.map((t, idx) => (idx === i ? ({ ...t, ...patch } as BentoShowcaseTile) : t)),
        })
    : undefined;

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
                <InlineText as="span" value={props.eyebrow} onUpdate={field("eyebrow")} />
              </div>
            )}
            {props.headline && (
              <h2
                className="font-bold tracking-tight leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
              >
                <InlineText as="span" value={props.headline} onUpdate={field("headline")} multiline />
              </h2>
            )}
            {props.subheadline && (
              <p
                className="text-base lg:text-lg leading-relaxed mt-4 max-w-2xl"
                style={{ opacity: 0.7 }}
              >
                <InlineText as="span" value={props.subheadline} onUpdate={field("subheadline")} multiline />
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
              onUpdate={updateTile ? (patch) => updateTile(i, patch) : undefined}
            />
          ))}
        </div>
        {childrenSlot && (
          <div className="mt-12" data-bento-children onClick={(e) => e.stopPropagation()}>
            {childrenSlot}
          </div>
        )}
      </div>
    </section>
  );
}
