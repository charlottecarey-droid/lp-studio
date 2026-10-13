import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, AbmArrowLink, anchorClick, displayStyle, initialsOf, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Integrations Row — type "abm-integrations-row"
 *
 * "Tap into 500+ integrations and apps you love working with": a centered
 * headline, a paragraph, an arrow link, then a row of app icons on white
 * rounded tiles with a caption under each. No icon → a tinted monogram tile.
 * Warm-stone surface by default.
 * -------------------------------------------------------------------------- */

export interface AbmIntegration {
  name: string;
  iconUrl?: string;
  iconAlt?: string;
  url?: string;
}

export interface AbmIntegrationsRowBlockProps extends AbmStyleProps {
  headline?: string;
  subheadline?: string;
  linkText?: string;
  linkUrl?: string;
  items: AbmIntegration[];
  /** Tile size in px. Default 96. */
  tileSize?: number;
  anchorId?: string;
}

interface Props {
  props: AbmIntegrationsRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmIntegrationsRowBlockProps) => void;
}

export const ABM_INTEGRATIONS_ROW_DEFAULT_PROPS: AbmIntegrationsRowBlockProps = {
  headline: "Tap into 500+ integrations and\napps you love working with",
  subheadline: "Work more efficiently, communicate better and move faster from a single source of truth. See how much more you can do on one connected platform.",
  linkText: "Explore all integrations",
  linkUrl: "#",
  items: [
    { name: "ERP" },
    { name: "Accounting" },
    { name: "CRM" },
    { name: "Microsoft Teams" },
    { name: "Microsoft 365" },
    { name: "Document control" },
    { name: "Analytics" },
  ],
  tileSize: 96,
  anchorId: "integrations",
  backgroundStyle: "muted",
};

export function BlockAbmIntegrationsRow({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#F5F1ED");
  const isEditor = !!onFieldChange;
  const items = props.items ?? [];
  const size = Math.max(56, Math.min(160, props.tileSize ?? 96));

  const field = (key: keyof AbmIntegrationsRowBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmIntegrationsRowBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<AbmIntegration>) => onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 14 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="abm-integrations relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-20 lg:py-24")}>
        <motion.div {...reveal(0)} className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="whitespace-pre-line" style={displayStyle("clamp(1.9rem, 3.6vw, 2.8rem)", pal.heading)}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </h2>
          {(props.subheadline || isEditor) && (
            <p className="mt-4 max-w-[64ch] text-[16px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
          {(props.linkText || isEditor) && (
            <AbmArrowLink href={props.linkUrl} onClick={anchorClick(props.linkUrl)} color={pal.accent} className="mt-5">
              <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
            </AbmArrowLink>
          )}
        </motion.div>

        <ul className="mt-12 flex flex-wrap items-start justify-center gap-x-8 gap-y-8 lg:gap-x-12">
          {items.map((it, i) => {
            const tile = (
              <div
                className="relative flex items-center justify-center overflow-hidden rounded-[22px]"
                style={{ width: size, height: size, background: pal.card, boxShadow: `0 10px 24px -14px rgba(0,0,0,0.35), 0 0 0 1px ${pal.hairline}` }}
              >
                {it.iconUrl || isEditor ? (
                  <InlineImage
                    src={it.iconUrl ?? ""}
                    alt={it.iconAlt || it.name}
                    className="h-full w-full object-contain p-[18%]"
                    wrapperClassName="absolute inset-0"
                    loading="lazy"
                    onUpdate={updateItem ? (v) => updateItem(i, { iconUrl: v }) : undefined}
                    onAltUpdate={updateItem ? (v) => updateItem(i, { iconAlt: v }) : undefined}
                  />
                ) : null}
                {!it.iconUrl && (
                  <span className="pointer-events-none text-[22px] font-bold tracking-tight" style={{ color: pal.accent }} aria-hidden>
                    {initialsOf(it.name)}
                  </span>
                )}
              </div>
            );
            return (
              <motion.li key={i} {...reveal(0.05 + Math.min(i, 8) * 0.04)} className="flex flex-col items-center gap-3" style={{ width: Math.max(size, 104) }}>
                {it.url ? <a href={it.url} className="block no-underline" aria-label={it.name}>{tile}</a> : tile}
                <span className="text-center text-[12px] leading-snug" style={{ color: pal.muted }}>
                  <InlineText as="span" value={it.name} onUpdate={updateItem ? (v) => updateItem(i, { name: v }) : undefined} />
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
