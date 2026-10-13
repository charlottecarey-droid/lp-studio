import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, relativeLuminance } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, AbmArrowLink, anchorClick, displayStyle, inksOn, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Story Quote — type "abm-story-quote"
 *
 * The customer-story feature: a dark card (brand primary on a light section)
 * with a tracked "CUSTOMER STORY" kicker, a large quote, the speaker's name,
 * title and company wordmark and a "Read their story" arrow link, beside a
 * full-bleed photo. The two halves meet edge to edge like the reference page.
 * -------------------------------------------------------------------------- */

export interface AbmStoryQuoteBlockProps extends AbmStyleProps {
  kicker?: string;
  quote?: string;
  author?: string;
  role?: string;
  company?: string;
  /** Company wordmark shown in place of the company text (inverted to white on a dark card). */
  companyLogoUrl?: string;
  companyLogoAlt?: string;
  linkText?: string;
  linkUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  imageSide?: "left" | "right";
  /** The quote card's colour. Blank = brand primary (or a tinted light card on dark sections). */
  cardColor?: string;
  anchorId?: string;
}

interface Props {
  props: AbmStoryQuoteBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmStoryQuoteBlockProps) => void;
}

export const ABM_STORY_QUOTE_DEFAULT_PROPS: AbmStoryQuoteBlockProps = {
  kicker: "Customer story",
  quote: "I couldn't recommend it any more than I already have. It's clear what the status of something is, for everyone.",
  author: "Project manager",
  role: "Enterprise customer",
  company: "",
  companyLogoUrl: "",
  linkText: "Read their story",
  linkUrl: "#",
  imageUrl: "",
  imageAlt: "",
  imageSide: "right",
  anchorId: "proof",
  backgroundStyle: "white",
};

export function BlockAbmStoryQuote({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const card = props.cardColor && isValidHex(props.cardColor) ? props.cardColor : pal.contrastCard;
  const cardDark = isValidHex(card) ? relativeLuminance(card) < 0.4 : pal.contrastCardDark;
  const cardInk = inksOn(isValidHex(card) ? card : cardDark ? "#0B0B0F" : "#FFFFFF");
  const imageRight = (props.imageSide ?? "right") === "right";

  const field = (key: keyof AbmStoryQuoteBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmStoryQuoteBlockProps[typeof key] }) : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="abm-story-quote relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-12 lg:py-16")}>
        <motion.div {...reveal(0)} className="grid grid-cols-1 overflow-hidden lg:grid-cols-2" style={{ borderRadius: 4, boxShadow: "0 30px 60px -40px rgba(0,0,0,0.45)" }}>
          <div className={cn("flex flex-col justify-between gap-10 p-9 sm:p-12 lg:min-h-[520px] lg:p-14", imageRight ? "" : "lg:order-last")} style={{ background: card, color: cardInk.text }}>
            <div>
              {(props.kicker || isEditor) && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: cardInk.muted }}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </p>
              )}
              <blockquote className="mt-7">
                <p style={displayStyle("clamp(1.5rem, 2.4vw, 2rem)", cardInk.text, 600)}>
                  <InlineText as="span" value={props.quote ? `“${props.quote}”` : ""} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, quote: v.replace(/^[“"]/, "").replace(/[”"]$/, "") }) : undefined} multiline />
                </p>
              </blockquote>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                {(props.author || isEditor) && (
                  <p className="text-[16px] font-semibold" style={{ color: cardInk.text }}>
                    <InlineText as="span" value={props.author ?? ""} onUpdate={field("author")} />
                  </p>
                )}
                {(props.role || isEditor) && (
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: cardInk.muted }}>
                    <InlineText as="span" value={props.role ?? ""} onUpdate={field("role")} />
                  </p>
                )}
                {props.companyLogoUrl ? (
                  <img src={props.companyLogoUrl} alt={props.companyLogoAlt || props.company || "Company"} className="mt-4 h-5 w-auto max-w-[160px] object-contain object-left" style={{ filter: cardDark ? "brightness(0) invert(1)" : "none" }} loading="lazy" />
                ) : (props.company || isEditor) ? (
                  <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: cardInk.text }}>
                    <InlineText as="span" value={props.company ?? ""} onUpdate={field("company")} />
                  </p>
                ) : null}
              </div>
              {(props.linkText || isEditor) && (
                <AbmArrowLink href={props.linkUrl} onClick={anchorClick(props.linkUrl)} color={cardInk.text}>
                  <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
                </AbmArrowLink>
              )}
            </div>
          </div>
          <div className="relative min-h-[280px] lg:min-h-[520px]" style={{ background: pal.panel }}>
            {(props.imageUrl || isEditor) ? (
              <InlineImage
                src={props.imageUrl ?? ""}
                alt={props.imageAlt || props.company || "Customer story"}
                className="absolute inset-0 h-full w-full object-cover"
                wrapperClassName="absolute inset-0"
                loading="lazy"
                focalPoint={props.imageFocal}
                onUpdate={field("imageUrl")}
                onAltUpdate={field("imageAlt")}
                onFocalUpdate={field("imageFocal")}
              />
            ) : (
              <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${pal.panel} 0%, color-mix(in srgb, ${pal.accentDeco} 18%, ${pal.panel}) 100%)` }} />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
