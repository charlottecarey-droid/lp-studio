import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import type { GiftOption, GiftPickerBlockProps } from "../BlockGiftPicker";
import { ATELIER_BODY, ATELIER_CSS, ATELIER_LINK_CLASS, ATELIER_SERIF, AtelierEyebrow, GiftBoxArt, LeatherTag, SatinBand, SatinBow, resolveAtelierPalette } from "./atelier-theme";
import { AtelierHeadline } from "./AtelierHeadline";
import { isGiftSoldOut, selectGift, useGiftSelection, liveFallbackOptions } from "./gift-selection";
import { DEFAULT_LIMITED_NOTE, SINGLE_GIFT_PICKER_COPY } from "@/lib/gift-copy";
import { useRegisterGiftOptions } from "./use-register-gift-options";
import { cn } from "@/lib/utils";
import { GiftFlip } from "./GiftFlip";

/**
 * gift-picker, layout "atelier": an editorial product grid. Split header
 * (eyebrow + serif headline / intro + count), then tall 4:5 tiles on warm
 * sand — the product photo multiplied onto the tile, or a single ribboned
 * box when there's no photo — with "No. 01", the name in serif, a caption
 * and an underlined "Select this gift". Choosing ties a satin ribbon, bow
 * and "Your selection" leather tag over that tile.
 */
/** The warm sand tile backdrop, shared by the front and back views. */
const TILE_BG = (pal: { ivory: string; sand: string }) => `radial-gradient(110% 80% at 40% 25%, ${pal.ivory} 0%, ${pal.sand} 62%, #E2D2C0 100%)`;

export function AtelierGiftPicker({ props, brand, onFieldChange }: { props: GiftPickerBlockProps; brand: BrandConfig; onFieldChange?: (u: GiftPickerBlockProps) => void }) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAtelierPalette(props, brand, "ivory");
  const isEditor = !!onFieldChange;
  const options: GiftOption[] = props.options ?? [];
  const selection = useGiftSelection();
  useRegisterGiftOptions(options);

  const field = (key: keyof GiftPickerBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftPickerBlockProps[typeof key] }) : undefined;
  const updateOption = onFieldChange
    ? (i: number, patch: Partial<GiftOption>) => onFieldChange({ ...props, options: options.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const outOfStock = (name: string) => !isEditor && isGiftSoldOut(selection.soldOut, name);
  const choose = (name: string) => {
    if (isEditor || outOfStock(name)) return;
    selectGift(name);
    const anchor = props.formAnchor || "#redeem";
    if (anchor.startsWith("#")) document.getElementById(anchor.slice(1))?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  // One gift is a featured gift, not a choice: no "choose one" framing, it is
  // selected for the visitor, and the card sits centred wearing its ribbon.
  // Sold-out gifts are hidden on the live page (the builder keeps showing them,
  // marked). One left is a featured gift, not a choice.
  const ownShown = isEditor ? options : options.filter((o) => !isGiftSoldOut(selection.soldOut, o.name));
  const ownGone = !isEditor && options.length > 0 && ownShown.length === 0;
  // All of the page's own gifts are gone: show the fallback the form fetched (same tier, then swag).
  const fallbackCards = ownGone ? (liveFallbackOptions(selection) as GiftOption[]) : [];
  const shown = fallbackCards.length ? fallbackCards : ownShown;
  const allGone = ownGone && fallbackCards.length === 0;
  const fallbackNote = fallbackCards.length ? selection.fallback?.note ?? "" : "";
  const single = shown.length === 1 && !isEditor;
  const narrowedToOne = single && options.length > 1;
  const limitedNote = props.limitedNote === undefined ? DEFAULT_LIMITED_NOTE : props.limitedNote.trim();
  useEffect(() => {
    if (single) selectGift(shown[0].name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single, shown[0]?.name]);
  const claimText = narrowedToOne ? SINGLE_GIFT_PICKER_COPY.chooseText : props.chooseText && props.chooseText !== "Choose this one" ? props.chooseText : "Claim this gift";

  const cols = shown.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : shown.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  const count = shown.length;

  return (
    <section id={props.anchorId || "gifts"} data-gift-layout="atelier" className="relative" style={{ background: pal.bg, color: pal.ink, fontFamily: ATELIER_BODY }}>
      <style>{ATELIER_CSS}</style>
      <div className="mx-auto w-full max-w-page px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 items-end gap-8 pb-10 lg:grid-cols-12" style={{ borderBottom: `1px solid ${pal.line}` }}>
          <div className="flex flex-col gap-5 lg:col-span-7">
            {(props.kicker || isEditor) && <AtelierEyebrow palette={pal}><InlineText as="span" value={narrowedToOne ? SINGLE_GIFT_PICKER_COPY.kicker : props.kicker ?? ""} onUpdate={field("kicker")} /></AtelierEyebrow>}
            {(props.headline || isEditor) && <AtelierHeadline value={narrowedToOne ? SINGLE_GIFT_PICKER_COPY.headline : props.headline ?? ""} size="clamp(2.6rem, 5vw, 4.4rem)" onUpdate={field("headline")} />}
          </div>
          <div className="flex flex-col gap-3 lg:col-span-5 lg:pb-2">
            {(props.subheadline || isEditor) && (
              <p className="max-w-[44ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                <InlineText as="span" value={narrowedToOne ? SINGLE_GIFT_PICKER_COPY.subheadline : props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
            {!single && (
              <p className="text-[11px] font-medium uppercase tracking-[0.28em]" style={{ color: pal.faint }}>
                {count} {count === 1 ? "gift" : "gifts"} · choose one
              </p>
            )}
          </div>
        </div>

        <div className={cn("mt-14 grid grid-cols-1 gap-x-8 gap-y-16", single ? "mx-auto max-w-[460px]" : cols)}>
          {allGone ? (
            <p className="col-span-full py-10 text-center text-[15px]" style={{ color: pal.muted }}>Every gift has been claimed. Thank you for stopping by.</p>
          ) : null}
          {fallbackNote ? (
            <p className="col-span-full text-center text-[15px]" style={{ color: pal.muted }}>{fallbackNote}</p>
          ) : null}
          {shown.map((it, i) => {
            const picked = !isEditor && selection.selected !== "" && selection.selected === it.name;
            const dressed = picked || single; // ribbon, bow and tag
            const markedPicked = picked && !single; // "Your pick" label state
            const out = outOfStock(it.name);
            return (
              <motion.article
                key={i}
                data-gift-option={it.name}
                data-gift-picked={picked ? "true" : "false"}
                initial={reduced ? false : anim({ opacity: 0, y: 18 })}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay: Math.min(i * 0.1, 0.3), ease: [0.16, 1, 0.3, 1] }}
                className={cn("atl-card flex flex-col", out && "opacity-60 grayscale")}
              >
                <GiftFlip
                  enabled={!isEditor}
                  onSelect={() => choose(it.name)}
                  label={it.name}
                  dotColor={pal.ink}
                  className="relative overflow-hidden rounded-[3px]"
                  style={{ aspectRatio: "4 / 5", background: TILE_BG(pal), boxShadow: dressed ? `inset 0 0 0 1.5px ${pal.ribbon}` : `inset 0 0 0 1px ${pal.line}` }}
                  back={it.hoverImageUrl ? (
                    <div className="absolute inset-0" style={{ background: TILE_BG(pal) }}>
                      <img
                        src={it.hoverImageUrl}
                        alt={it.hoverImageAlt || `${it.name}, second view`}
                        className={it.fit === "cover" ? "absolute inset-0 h-full w-full object-cover" : "absolute inset-0 h-full w-full object-contain p-[12%]"}
                        style={it.fit === "cover" ? undefined : { mixBlendMode: "multiply" }}
                        loading="lazy"
                      />
                    </div>
                  ) : undefined}
                  front={it.imageUrl || isEditor ? (
                    // The zoom wrapper is its own compositing layer, so it carries the
                    // sand backdrop too — otherwise the multiply-blended packshot has
                    // nothing to blend into and shows its white box while zoomed.
                    <div className="atl-zoom absolute inset-0" style={{ background: TILE_BG(pal) }}>
                      <InlineImage
                        src={it.imageUrl ?? ""}
                        alt={it.imageAlt ?? it.name}
                        onUpdate={updateOption ? (v) => updateOption(i, { imageUrl: v }) : undefined}
                        onAltUpdate={updateOption ? (v) => updateOption(i, { imageAlt: v }) : undefined}
                        wrapperClassName="absolute inset-0"
                        className={it.fit === "cover" ? "absolute inset-0 h-full w-full object-cover" : "absolute inset-0 h-full w-full object-contain p-[12%]"}
                        style={it.fit === "cover" ? undefined : { mixBlendMode: "multiply" }}
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <GiftBoxArt palette={pal} variant="single" className="atl-zoom absolute inset-x-[8%] top-[14%] w-[84%]" />
                  )}
                >
                  {out && (
                    <span className="absolute right-5 top-5 z-10 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ background: pal.ink, color: pal.ivory }}>Sold out</span>
                  )}
                  {(it.badge || !single) && (
                    <span className="absolute left-5 top-5 text-[11px] font-medium uppercase tracking-[0.28em]" style={{ color: pal.muted }}>
                      {it.badge || `No. ${String(i + 1).padStart(2, "0")}`}
                    </span>
                  )}
                  {dressed && (
                    <>
                      <SatinBand palette={pal} className="inset-y-0 left-[16%] w-[9%]" />
                      <SatinBow palette={pal} className="absolute left-[3%] top-[-2%] w-[36%]" />
                      <LeatherTag palette={pal} className="absolute right-[10%] top-0" line1="Your" line2={single ? "gift" : "selection"} />
                    </>
                  )}
                </GiftFlip>
                <div className="mt-6 flex flex-col gap-2">
                  <h3 className="text-[26px] leading-tight" style={{ fontFamily: ATELIER_SERIF, letterSpacing: "-0.01em" }}>
                    <InlineText as="span" value={it.name} onUpdate={updateOption ? (v) => updateOption(i, { name: v }) : undefined} />
                  </h3>
                  {(it.caption || isEditor) && (
                    <p className="max-w-[40ch] text-[14px] leading-relaxed" style={{ color: pal.muted }}>
                      <InlineText as="span" value={it.caption ?? ""} onUpdate={updateOption ? (v) => updateOption(i, { caption: v }) : undefined} multiline />
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => choose(it.name)}
                    disabled={out}
                    aria-pressed={markedPicked}
                    className={`${ATELIER_LINK_CLASS} mt-3 self-start${out ? " cursor-not-allowed" : ""}`}
                    style={{ color: markedPicked ? pal.ribbon : pal.ink }}
                  >
                    {markedPicked ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : null}
                    {out ? (
                      <span>Sold out</span>
                    ) : markedPicked ? (
                      <InlineText as="span" value={props.chosenText || "Your pick"} onUpdate={field("chosenText")} />
                    ) : single ? (
                      <span>{claimText}</span>
                    ) : (
                      <InlineText as="span" value={props.chooseText || "Choose this one"} onUpdate={field("chooseText")} />
                    )}
                    {!markedPicked && !out && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
        {limitedNote && (
          <p className="mt-12 text-center text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: pal.faint }} data-gift-limited-note="true">{limitedNote}</p>
        )}
      </div>
    </section>
  );
}
