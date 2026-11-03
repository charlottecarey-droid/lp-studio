import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Snowflake } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { INVITE_BODY, INVITE_DISPLAY, displayStyle } from "@/lib/invite-theme";
import { GIFT_CSS, GiftKicker, Snowfall, resolveGiftPalette } from "./gift/gift-theme";
import { cn } from "@/lib/utils";
import { AtelierGiftNote } from "./gift/AtelierGiftNote";
import { RepSignoff } from "./gift/RepSignoff";
import { useGiftNoteStore, useRegisterGiftNote } from "./gift/note-store";
import type { GiftLayout } from "./gift/atelier-theme";

/* ----------------------------------------------------------------------------
 * Gift Note — type "gift-note"
 *
 * The close of the holiday gift page: a cream holiday card, set at a slight
 * tilt on the dark surface, with a snowflake ornament, a kicker, a short
 * headline, the note itself and a hand-written-feeling sign-off. An optional
 * photo sits inside the card like a tucked-in print, and an optional text
 * link under the card points somewhere useful. A little snow, no CTA pill —
 * the form above already did the asking.
 * -------------------------------------------------------------------------- */

export interface GiftNoteBlockProps {
  /** Classic (dark, snow, gold) or Atelier (light luxury retail). */
  layout?: GiftLayout;
  kicker?: string;
  headline?: string;
  body?: string;
  /** Greeting above the note, e.g. "Hi {{first_name|there}}," (fills from ?first_name=). Blank hides it. */
  greeting?: string;
  /** A short personal line from the rep, shown under the note (blank hides it). E.g. "{{personal_note}}" filled per page. */
  personalNote?: string;
  signoff?: string;
  signature?: string;
  /** The rep sending the gift (filled by the panel's "From" picker from Content Library team members). */
  repTitle?: string;
  repPhotoUrl?: string;
  /** The rep's own booking link (Chili Piper / Calendly / any URL); blank hides the link. */
  calendarUrl?: string;
  calendarText?: string;
  imageUrl?: string;
  imageAlt?: string;
  linkText?: string;
  linkUrl?: string;
  snow?: number;
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: GiftNoteBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: GiftNoteBlockProps) => void;
}

export const GIFT_NOTE_DEFAULT_PROPS: GiftNoteBlockProps = {
  kicker: "A note from the team",
  headline: "Thank you for a great year.",
  body: "Working with you this year has been a highlight for all of us. Whatever you pick, we hope it brings a little joy to the season, and we're looking forward to what's next.",
  greeting: "",
  personalNote: "",
  signoff: "With thanks,",
  signature: "The team",
  repTitle: "",
  repPhotoUrl: "",
  calendarUrl: "",
  calendarText: "Grab time on my calendar",
  imageUrl: "",
  imageAlt: "",
  linkText: "",
  linkUrl: "",
  snow: 14,
  anchorId: "note",
  layout: "classic",
};

export function BlockGiftNote(p: Props) {
  const { kicker, headline, greeting, body, personalNote, signoff, signature, repTitle, repPhotoUrl, calendarUrl, calendarText } = p.props;
  useRegisterGiftNote({ kicker, headline, greeting, body, personalNote, signoff, signature, repTitle, repPhotoUrl, calendarUrl, calendarText });
  const { envelopeActive } = useGiftNoteStore();
  // When the hero opens on an envelope, the card that slides out IS this
  // note — hide it on the live page so the letter doesn't appear twice.
  if (envelopeActive && !p.onFieldChange) return null;
  return p.props.layout === "atelier" ? <AtelierGiftNote {...p} /> : <ClassicGiftNote {...p} />;
}

function ClassicGiftNote({ props, brand, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveGiftPalette(props, brand);
  const isEditor = !!onFieldChange;
  const hasImage = !!props.imageUrl;
  const hasLink = !!(props.linkText && props.linkUrl);

  const field = (key: keyof GiftNoteBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftNoteBlockProps[typeof key] }) : undefined;

  return (
    <section id={props.anchorId || "note"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <style>{GIFT_CSS}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(50% 45% at 50% 60%, ${pal.goldSoft} 0%, transparent 70%)` }} />
      <Snowfall count={Math.max(0, Math.min(40, props.snow ?? 14))} />
      <div className="relative mx-auto w-full max-w-page px-6 py-20 lg:px-10 lg:py-28">
        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 24, rotate: -3 })}
          whileInView={reduced ? undefined : { opacity: 1, y: 0, rotate: -1.5 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={cn("relative mx-auto w-full max-w-[720px] rounded-[26px] p-8 sm:p-12", hasImage && "lg:max-w-[880px]")}
          style={{ background: pal.cream, color: pal.creamInk, rotate: reduced ? "-1.5deg" : undefined, boxShadow: `0 60px 120px -50px rgba(0,0,0,0.9), 0 0 0 1px ${pal.creamLine}` }}
        >
          {/* Inner gold hairline, like a printed card border. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-4 rounded-[18px]" style={{ border: `1px solid ${pal.gold}`, opacity: 0.7 }} />
          <div className={cn("relative grid gap-8", hasImage || isEditor ? "lg:grid-cols-12" : "")}>
            <div className={cn("flex flex-col items-start gap-5", (hasImage || isEditor) && "lg:col-span-7")}>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full" style={{ background: pal.bg, color: pal.gold }}>
                <Snowflake className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              {(props.kicker || isEditor) && (
                <GiftKicker palette={pal} align="left" style={{ color: pal.creamMuted }}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </GiftKicker>
              )}
              {(props.headline || isEditor) && (
                <h2 className="whitespace-pre-line" style={displayStyle("clamp(1.9rem, 3.6vw, 2.8rem)")}>
                  <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
                </h2>
              )}
              {(props.greeting || isEditor) && (
                <p className="text-[17px] font-medium" style={{ color: pal.creamInk }} data-gift-greeting="true">
                  <InlineText as="span" value={props.greeting ?? ""} onUpdate={field("greeting")} />
                </p>
              )}
              {(props.body || isEditor) && (
                <p className="max-w-[52ch] whitespace-pre-line text-[16px] leading-relaxed" style={{ color: pal.creamMuted }}>
                  <InlineText as="span" value={props.body ?? ""} onUpdate={field("body")} multiline />
                </p>
              )}
              {(props.personalNote || isEditor) && (
                <p className="max-w-[52ch] whitespace-pre-line text-[16px] leading-relaxed" style={{ color: pal.creamInk }} data-gift-personal-note="true">
                  <InlineText as="span" value={props.personalNote ?? ""} onUpdate={field("personalNote")} multiline />
                </p>
              )}
              {(props.signoff || props.signature || isEditor) && (
                <div className="mt-2 flex flex-col gap-1">
                  {(props.signoff || isEditor) && (
                    <p className="text-[14px]" style={{ color: pal.creamMuted }}>
                      <InlineText as="span" value={props.signoff ?? ""} onUpdate={field("signoff")} />
                    </p>
                  )}
                  {(props.signature || isEditor) && (
                    <p className="text-[26px]" style={{ fontFamily: INVITE_DISPLAY, letterSpacing: "-0.02em", color: pal.creamInk }}>
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
                ink={pal.creamInk}
                muted={pal.creamMuted}
                line={pal.creamLine}
                accent={pal.bg}
                isEditor={isEditor}
                onTitle={field("repTitle")}
                onCalendarText={field("calendarText")}
              />
            </div>
            {(hasImage || isEditor) && (
              <div className="lg:col-span-5">
                <div className="relative mx-auto w-full max-w-[300px] rotate-[3deg] rounded-md bg-white p-3 pb-8" style={{ boxShadow: "0 24px 40px -24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.05)" }}>
                  <div className="overflow-hidden rounded-sm" style={{ aspectRatio: "4 / 5", background: pal.creamLine }}>
                    {hasImage || isEditor ? (
                      <InlineImage src={props.imageUrl ?? ""} alt={props.imageAlt ?? ""} className="h-full w-full object-cover" wrapperClassName="block h-full w-full" onUpdate={field("imageUrl")} onAltUpdate={field("imageAlt")} loading="lazy" />
                    ) : null}
                  </div>
                  <span aria-hidden="true" className="absolute -top-2 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-2deg] rounded-sm" style={{ background: pal.goldSoft, border: `1px solid ${pal.gold}` }} />
                </div>
              </div>
            )}
          </div>
        </motion.div>
        {(hasLink || isEditor) && (
          <p className="mt-10 text-center text-[14px]">
            <a
              href={props.linkUrl || "#"}
              onClick={() => onCtaClick?.()}
              target={props.linkUrl && /^https?:/i.test(props.linkUrl) ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
              style={{ color: pal.text }}
            >
              <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
              <ArrowUpRight className="h-4 w-4" aria-hidden style={{ color: pal.gold }} />
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
