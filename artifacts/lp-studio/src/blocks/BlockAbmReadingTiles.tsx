import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, anchorClick, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Reading Tiles — type "abm-reading-tiles"
 *
 * "Recommended reading": a centered headline and three resource tiles — a
 * 16:9 image, a tracked kicker ("CUSTOMER STORY", "BLOG"), a bold title and a
 * clamped excerpt. The whole tile links when a URL is set. Warm-stone surface.
 * -------------------------------------------------------------------------- */

export interface AbmReadingItem {
  kicker?: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  linkUrl?: string;
}

export interface AbmReadingTilesBlockProps extends AbmStyleProps {
  headline?: string;
  items: AbmReadingItem[];
  anchorId?: string;
}

interface Props {
  props: AbmReadingTilesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmReadingTilesBlockProps) => void;
}

export const ABM_READING_TILES_DEFAULT_PROPS: AbmReadingTilesBlockProps = {
  headline: "Recommended reading",
  items: [
    { kicker: "Customer story", title: "How a global operator standardized 140 sites on one platform", excerpt: "From disconnected spreadsheets to one source of truth across every region.", imageUrl: "", imageAlt: "", linkUrl: "#" },
    { kicker: "Blog", title: "Making smarter workforce decisions through data", excerpt: "Data is the lifeblood of operations, yet it is often scattered across the organization, unable to support the decisions that matter.", imageUrl: "", imageAlt: "", linkUrl: "#" },
    { kicker: "Customer story", title: "Fixing the inputs so AI can deliver the output", excerpt: "Why clean field data came first, and what it unlocked.", imageUrl: "", imageAlt: "", linkUrl: "#" },
  ],
  anchorId: "resources",
  backgroundStyle: "muted",
};

export function BlockAbmReadingTiles({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#F5F1ED");
  const isEditor = !!onFieldChange;
  const items = props.items ?? [];

  const field = (key: keyof AbmReadingTilesBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmReadingTilesBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<AbmReadingItem>) => onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const cols = items.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section id={props.anchorId || undefined} className="abm-reading-tiles relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-20 lg:py-24")}>
        <motion.h2 {...reveal(0)} className="text-center" style={displayStyle("clamp(1.9rem, 3.4vw, 2.6rem)", pal.heading)}>
          <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} />
        </motion.h2>

        <ul className={cn("mt-12 grid grid-cols-1 gap-8", cols)}>
          {items.map((it, i) => {
            const image = (
              <div className="relative w-full overflow-hidden rounded-[4px]" style={{ aspectRatio: "16 / 9", background: pal.panel, boxShadow: `0 0 0 1px ${pal.hairline}` }}>
                {(it.imageUrl || isEditor) ? (
                  <InlineImage
                    src={it.imageUrl ?? ""}
                    alt={it.imageAlt || it.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    wrapperClassName="absolute inset-0"
                    loading="lazy"
                    focalPoint={it.imageFocal}
                    onUpdate={updateItem ? (v) => updateItem(i, { imageUrl: v }) : undefined}
                    onAltUpdate={updateItem ? (v) => updateItem(i, { imageAlt: v }) : undefined}
                    onFocalUpdate={updateItem ? (v) => updateItem(i, { imageFocal: v }) : undefined}
                  />
                ) : (
                  <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${pal.panel} 0%, color-mix(in srgb, ${pal.accentDeco} 22%, ${pal.panel}) 100%)` }} />
                )}
              </div>
            );
            const body = (
              <>
                {it.linkUrl && !isEditor ? <a href={it.linkUrl} onClick={anchorClick(it.linkUrl)} className="block no-underline" aria-label={it.title}>{image}</a> : image}
                <div className="mt-5 flex flex-col gap-2.5">
                  {(it.kicker || isEditor) && (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: pal.muted }}>
                      <InlineText as="span" value={it.kicker ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { kicker: v }) : undefined} />
                    </p>
                  )}
                  <h3 className="text-[18px] font-semibold leading-snug" style={{ color: pal.heading, letterSpacing: "-0.01em" }}>
                    {it.linkUrl && !isEditor ? (
                      <a href={it.linkUrl} onClick={anchorClick(it.linkUrl)} className="no-underline" style={{ color: "inherit" }}>{it.title}</a>
                    ) : (
                      <InlineText as="span" value={it.title} onUpdate={updateItem ? (v) => updateItem(i, { title: v }) : undefined} />
                    )}
                  </h3>
                  {(it.excerpt || isEditor) && (
                    <p className="line-clamp-3 text-[14px] leading-relaxed" style={{ color: pal.muted }}>
                      <InlineText as="span" value={it.excerpt ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { excerpt: v }) : undefined} multiline />
                    </p>
                  )}
                </div>
              </>
            );
            return (
              <motion.li key={i} {...reveal(0.05 + i * 0.06)} className="group flex flex-col">
                {body}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
