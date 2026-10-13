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
  /** Tile size in px (48–160), or "small" | "medium" | "large". Default 96. */
  tileSize?: number | string;
  /** How much of the tile the icon fills, in % (40–100). Default 64. */
  iconScale?: number | string;
  anchorId?: string;
}

interface Props {
  props: AbmIntegrationsRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmIntegrationsRowBlockProps) => void;
}

/** Size props arrive as numbers from the panel but as strings from AI flows
 *  ("96", "medium"). Coerce defensively: a NaN here collapses the layout. */
export function coerceSize(raw: unknown, words: Record<"small" | "medium" | "large", number>, fallback: number): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const key = raw.trim().toLowerCase();
    if (key in words) return words[key as keyof typeof words];
    const n = parseFloat(key);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
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
  iconScale: 64,
  anchorId: "integrations",
  backgroundStyle: "muted",
};

export function BlockAbmIntegrationsRow({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#F5F1ED");
  const isEditor = !!onFieldChange;
  const items = props.items ?? [];
  const size = Math.max(48, Math.min(160, coerceSize(props.tileSize, { small: 72, medium: 96, large: 128 }, 96)));
  const iconScale = Math.max(40, Math.min(100, coerceSize(props.iconScale, { small: 48, medium: 64, large: 84 }, 64)));
  const iconPad = `${Math.round((100 - iconScale) / 2)}%`;

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
                    className="h-full w-full object-contain"
                    style={{ padding: iconPad }}
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
