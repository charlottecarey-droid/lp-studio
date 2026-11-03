import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import type { GiftNoteBlockProps } from "../BlockGiftNote";
import { ATELIER_BODY, ATELIER_CSS, ATELIER_LINK_CLASS, ATELIER_SERIF, AtelierEyebrow, LeatherTag, SatinBand, SatinBow, resolveAtelierPalette } from "./atelier-theme";
import { AtelierHeadline } from "./AtelierHeadline";
import { cn } from "@/lib/utils";
import { RepSignoff } from "./RepSignoff";

/**
 * gift-note, layout "atelier": a letter on ivory card stock, tied with a
 * satin ribbon down its left side, a bow at the top edge and a leather tag,
 * on warm sand. Two-tone brand-display headline, the note, a sign-off and
 * a large display-font signature; optional photo as a framed print and an
 * underlined link beneath.
 */
export function AtelierGiftNote({ props, brand, onCtaClick, onFieldChange }: { props: GiftNoteBlockProps; brand: BrandConfig; onCtaClick?: () => void; onFieldChange?: (u: GiftNoteBlockProps) => void }) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAtelierPalette(props, brand, "sand");
  const isEditor = !!onFieldChange;
  const hasImage = !!props.imageUrl;
  const hasLink = !!(props.linkText && props.linkUrl);

  const field = (key: keyof GiftNoteBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftNoteBlockProps[typeof key] }) : undefined;

  return (
    <section id={props.anchorId || "note"} data-gift-layout="atelier" className="relative overflow-hidden" style={{ background: pal.bg, color: pal.ink, fontFamily: ATELIER_BODY }}>
      <style>{ATELIER_CSS}</style>
      <div className="mx-auto w-full max-w-page px-6 py-24 lg:px-10 lg:py-32">
        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 24 })}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className={cn("relative mx-auto w-full max-w-[820px] rounded-[4px] py-12 pl-[22%] pr-8 sm:py-16 sm:pr-14", (hasImage || isEditor) && "lg:max-w-[980px]")}
          style={{ background: pal.ivory, boxShadow: `0 60px 120px -70px rgba(43,31,23,0.6), 0 0 0 1px ${pal.line}` }}
        >
          <SatinBand palette={pal} className="inset-y-0 left-[8%] w-[34px]" />
          <SatinBow palette={pal} className="absolute left-[calc(8%-58px)] top-[-46px] w-[150px]" />
          <LeatherTag palette={pal} className="absolute left-[calc(8%+30px)] top-[60px] hidden sm:flex" line1="With" line2="thanks" />
          <div className={cn("grid gap-10", (hasImage || isEditor) && "lg:grid-cols-12")}>
            <div className={cn("flex flex-col items-start gap-6", (hasImage || isEditor) && "lg:col-span-8")}>
              {(props.kicker || isEditor) && <AtelierEyebrow palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></AtelierEyebrow>}
              {(props.headline || isEditor) && <AtelierHeadline value={props.headline ?? ""} size="clamp(2.4rem, 4.4vw, 3.6rem)" onUpdate={field("headline")} />}
              {(props.greeting || isEditor) && (
                <p className="text-[18px]" style={{ color: pal.ink }} data-gift-greeting="true">
                  <InlineText as="span" value={props.greeting ?? ""} onUpdate={field("greeting")} />
                </p>
              )}
              {(props.body || isEditor) && (
                <p className="max-w-[50ch] whitespace-pre-line text-[16px] leading-[1.75]" style={{ color: pal.muted }}>
                  <InlineText as="span" value={props.body ?? ""} onUpdate={field("body")} multiline />
                </p>
              )}
              {(props.signoff || props.signature || isEditor) && (
                <div className="mt-2 flex flex-col gap-1">
                  {(props.signoff || isEditor) && (
                    <p className="text-[12px] font-medium uppercase tracking-[0.26em]" style={{ color: pal.muted }}>
                      <InlineText as="span" value={props.signoff ?? ""} onUpdate={field("signoff")} />
                    </p>
                  )}
                  {(props.signature || isEditor) && (
                    <p className="text-[40px] leading-none" style={{ fontFamily: ATELIER_SERIF, letterSpacing: "-0.03em", color: pal.ink }}>
                      <InlineText as="span" value={props.signature ?? ""} onUpdate={field("signature")} />
                    </p>
                  )}
                </div>
              )}
              <RepSignoff
                repTitle={props.repTitle}
                repPhotoUrl={props.repPhotoUrl}
                signature={props.signature}
                calendarText={props.calendarText}
                calendarUrl={props.calendarUrl}
                ink={pal.ink}
                muted={pal.muted}
                line={pal.line}
                accent={pal.ribbon}
                isEditor={isEditor}
                onTitle={field("repTitle")}
                onCalendarText={field("calendarText")}
                className="mt-2"
              />
            </div>
            {(hasImage || isEditor) && (
              <div className="lg:col-span-4">
                <div className="relative mx-auto w-full max-w-[240px] p-3 pb-10" style={{ background: "#FFFFFF", boxShadow: "0 24px 40px -26px rgba(43,31,23,0.6), 0 0 0 1px rgba(43,31,23,0.06)" }}>
                  <div className="overflow-hidden" style={{ aspectRatio: "4 / 5", background: pal.sand }}>
                    <InlineImage src={props.imageUrl ?? ""} alt={props.imageAlt ?? ""} className="h-full w-full object-cover" wrapperClassName="block h-full w-full" onUpdate={field("imageUrl")} onAltUpdate={field("imageAlt")} loading="lazy" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        {(hasLink || isEditor) && (
          <p className="mt-12 text-center">
            <a
              href={props.linkUrl || "#"}
              onClick={() => onCtaClick?.()}
              target={props.linkUrl && /^https?:/i.test(props.linkUrl) ? "_blank" : undefined}
              rel="noreferrer"
              className={ATELIER_LINK_CLASS}
              style={{ color: pal.ink }}
            >
              <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
