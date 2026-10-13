import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hexagon } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, anchorClick, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Feature Grid — type "abm-feature-grid"
 *
 * "Explore features available to {account}": a centered headline and a
 * three-column grid of features — a small accent icon, a bold title with an
 * arrow (linked when a URL is set) and a two-line description. No cards, no
 * borders: the reference page is a quiet text grid.
 * -------------------------------------------------------------------------- */

export interface AbmFeature {
  title: string;
  body?: string;
  iconUrl?: string;
  iconAlt?: string;
  linkUrl?: string;
}

export interface AbmFeatureGridBlockProps extends AbmStyleProps {
  headline?: string;
  subheadline?: string;
  items: AbmFeature[];
  columns?: 2 | 3 | 4;
  anchorId?: string;
}

interface Props {
  props: AbmFeatureGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmFeatureGridBlockProps) => void;
}

export const ABM_FEATURE_GRID_DEFAULT_PROPS: AbmFeatureGridBlockProps = {
  headline: "Explore features available to\nyour team",
  subheadline: "",
  items: [
    { title: "Project management", body: "Easy-to-use, mobile project management that connects field and office for real-time visibility.", linkUrl: "#" },
    { title: "Quality & safety", body: "Mitigate risk and make tough calls with real-time data from the field: daily logs, inspections and incidents in one place.", linkUrl: "#" },
    { title: "Invoice management", body: "Streamline billing across stakeholders so everyone works from the latest information on one organized platform.", linkUrl: "#" },
    { title: "Resource tracking", body: "Protect your labor budget and schedule with insights from real-time productivity tracking.", linkUrl: "#" },
    { title: "Analytics", body: "Power profitable work, identify risks and uncover inefficiencies with pre-built or custom reports on unified data.", linkUrl: "#" },
    { title: "Training center", body: "Keep teams up and running by tailoring support documentation to your own standard operating procedures.", linkUrl: "#" },
  ],
  columns: 3,
  anchorId: "features",
  backgroundStyle: "white",
};

const COL_CLASS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function BlockAbmFeatureGrid({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const items = props.items ?? [];
  const cols = COL_CLASS[props.columns ?? 3] ?? COL_CLASS[3];

  const field = (key: keyof AbmFeatureGridBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmFeatureGridBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<AbmFeature>) => onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 14 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="abm-feature-grid relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-20 lg:py-28")}>
        <motion.div {...reveal(0)} className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="whitespace-pre-line" style={displayStyle("clamp(1.9rem, 3.6vw, 2.8rem)", pal.heading)}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </h2>
          {(props.subheadline || isEditor) && (
            <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </motion.div>

        <ul className={cn("mt-14 grid grid-cols-1 gap-x-12 gap-y-12", cols)}>
          {items.map((it, i) => {
            const title = (
              <span className="inline-flex items-center gap-2 text-[19px] font-semibold leading-snug" style={{ color: pal.heading, letterSpacing: "-0.01em" }}>
                <InlineText as="span" value={it.title} onUpdate={updateItem ? (v) => updateItem(i, { title: v }) : undefined} />
                {it.linkUrl && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />}
              </span>
            );
            return (
              <motion.li key={i} {...reveal(0.04 + Math.min(i, 8) * 0.04)} className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden={!it.iconAlt}>
                    {it.iconUrl || isEditor ? (
                      <InlineImage
                        src={it.iconUrl ?? ""}
                        alt={it.iconAlt ?? ""}
                        className="h-7 w-7 object-contain"
                        wrapperClassName="absolute inset-0"
                        loading="lazy"
                        onUpdate={updateItem ? (v) => updateItem(i, { iconUrl: v }) : undefined}
                        onAltUpdate={updateItem ? (v) => updateItem(i, { iconAlt: v }) : undefined}
                      />
                    ) : null}
                    {!it.iconUrl && <Hexagon className="h-6 w-6" strokeWidth={2.5} style={{ color: pal.accent }} />}
                  </span>
                  {it.linkUrl ? (
                    <a href={it.linkUrl} onClick={anchorClick(it.linkUrl)} className="abm-link no-underline">{title}</a>
                  ) : (
                    <h3 className="m-0">{title}</h3>
                  )}
                </div>
                {(it.body || isEditor) && (
                  <p className="mt-3 text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                    <InlineText as="span" value={it.body ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { body: v }) : undefined} multiline />
                  </p>
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
