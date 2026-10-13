import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";
import { coerceSize } from "./BlockAbmIntegrationsRow";

/* ----------------------------------------------------------------------------
 * ABM Logo Strip — type "abm-logo-strip"
 *
 * "ENR leaders run on …": one short headline and a single row of customer
 * wordmarks. A logo without an image renders as a bold tracked wordmark so the
 * row never shows a broken image.
 * -------------------------------------------------------------------------- */

export interface AbmLogo {
  name: string;
  imageUrl?: string;
  imageAlt?: string;
  url?: string;
}

export interface AbmLogoStripBlockProps extends AbmStyleProps {
  headline?: string;
  logos: AbmLogo[];
  /** Render image logos in grayscale (quiet, like the reference page). Default off. */
  grayscale?: boolean;
  /** Logo height in px (16–120), or "small" | "medium" | "large". Default 32. */
  logoHeight?: number | string;
  /** Max logo width in px (80–400). Default = 5× the height, so wide wordmarks are not squeezed. */
  logoMaxWidth?: number | string;
  anchorId?: string;
}

interface Props {
  props: AbmLogoStripBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmLogoStripBlockProps) => void;
}

export const ABM_LOGO_STRIP_DEFAULT_PROPS: AbmLogoStripBlockProps = {
  headline: "Industry leaders run on one platform",
  logos: [{ name: "Northwind" }, { name: "Contoso" }, { name: "Fabrikam" }, { name: "Globex" }, { name: "Initech" }, { name: "Umbrella" }],
  grayscale: false,
  logoHeight: 32,
  backgroundStyle: "white",
};

export function BlockAbmLogoStrip({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const logos = props.logos ?? [];
  const h = Math.max(16, Math.min(120, coerceSize(props.logoHeight, { small: 24, medium: 32, large: 48 }, 32)));
  const maxW = Math.max(80, Math.min(400, coerceSize(props.logoMaxWidth, { small: h * 3, medium: h * 5, large: h * 8 }, h * 5)));

  const field = (key: keyof AbmLogoStripBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmLogoStripBlockProps[typeof key] }) : undefined;
  const updateLogo = onFieldChange
    ? (i: number, patch: Partial<AbmLogo>) => onFieldChange({ ...props, logos: logos.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) })
    : undefined;

  return (
    <section id={props.anchorId || undefined} className="abm-logo-strip relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-14 lg:py-16")}>
        {(props.headline || isEditor) && (
          <motion.h2
            initial={reduced ? false : anim({ opacity: 0, y: 12 })}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
            style={displayStyle("clamp(1.4rem, 2.4vw, 1.9rem)", pal.heading)}
          >
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} />
          </motion.h2>
        )}
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-8 lg:gap-x-16">
          {logos.map((l, i) => {
            const mark = l.imageUrl || isEditor ? (
              <InlineImage
                src={l.imageUrl ?? ""}
                alt={l.imageAlt || l.name}
                className="w-auto object-contain"
                style={{ height: h, maxWidth: maxW, filter: props.grayscale ? "grayscale(1)" : undefined, opacity: props.grayscale ? 0.75 : 1 }}
                loading="lazy"
                onUpdate={updateLogo ? (v) => updateLogo(i, { imageUrl: v }) : undefined}
                onAltUpdate={updateLogo ? (v) => updateLogo(i, { imageAlt: v }) : undefined}
              />
            ) : null;
            return (
              <motion.li
                key={i}
                initial={reduced ? false : anim({ opacity: 0, y: 10 })}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center"
              >
                {l.imageUrl ? (
                  l.url ? <a href={l.url} aria-label={l.name} className="flex items-center no-underline">{mark}</a> : mark
                ) : (
                  <span className="flex items-center gap-3">
                    {isEditor && mark}
                    <span className="text-[17px] font-extrabold uppercase tracking-[0.08em]" style={{ color: pal.heading, opacity: 0.85 }}>
                      <InlineText as="span" value={l.name} onUpdate={updateLogo ? (v) => updateLogo(i, { name: v }) : undefined} />
                    </span>
                  </span>
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
