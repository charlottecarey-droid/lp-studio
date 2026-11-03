import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Gift } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_PILL_CLASS, displayStyle, pillStyle } from "@/lib/invite-theme";
import { KitProductTile, type KitTileFit } from "./kit/KitProductTile";
import { GIFT_CSS, GIFT_TILE, GiftKicker, SparkleField, resolveGiftPalette } from "./gift/gift-theme";
import { registerGiftOptions, selectGift, useGiftSelection } from "./gift/gift-selection";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Gift Picker — type "gift-picker"
 *
 * "CHOOSE ONE": a centered header and 2–4 cream gift cards, each a product
 * tile under a gold corner ribbon with its number, the gift's name, a
 * one-line caption and a "Choose this one" pill. Choosing marks the card
 * (gold ring + "Your pick" chip), records the choice for the gift form on
 * the same page and scrolls to it. The names registered here are the ONE
 * source of the form's options.
 * -------------------------------------------------------------------------- */

export interface GiftOption {
  name: string;
  caption?: string;
  imageUrl?: string;
  imageAlt?: string;
  fit?: KitTileFit;
  /** Small label on the ribbon instead of the number, e.g. "Most popular". */
  badge?: string;
}

export interface GiftPickerBlockProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  options: GiftOption[];
  chooseText?: string;
  chosenText?: string;
  /** Where "Choose" scrolls to — the gift form's anchor. */
  formAnchor?: string;
  anchorId?: string;
  tileColor?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: GiftPickerBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GiftPickerBlockProps) => void;
}

export const GIFT_PICKER_DEFAULT_PROPS: GiftPickerBlockProps = {
  kicker: "Choose one",
  headline: "Three gifts.\nOne is yours.",
  subheadline: "Each one ships straight to you. Pick your favorite, then tell us where to send it.",
  options: [
    { name: "Gift one", caption: "A short line on why they'll love it.", imageUrl: "", imageAlt: "", fit: "contain" },
    { name: "Gift two", caption: "A short line on why they'll love it.", imageUrl: "", imageAlt: "", fit: "contain" },
    { name: "Gift three", caption: "A short line on why they'll love it.", imageUrl: "", imageAlt: "", fit: "contain" },
  ],
  chooseText: "Choose this one",
  chosenText: "Your pick",
  formAnchor: "#redeem",
  anchorId: "gifts",
  tileColor: GIFT_TILE,
};

export function BlockGiftPicker({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveGiftPalette(props, brand);
  const isEditor = !!onFieldChange;
  const options = props.options && props.options.length > 0 ? props.options : GIFT_PICKER_DEFAULT_PROPS.options;
  const tile = props.tileColor && /^#[0-9a-f]{6}$/i.test(props.tileColor) ? props.tileColor : GIFT_TILE;
  const selection = useGiftSelection();
  const names = options.map((o) => o.name);
  const namesKey = names.join("\u0000");

  useEffect(() => {
    registerGiftOptions(namesKey.split("\u0000"));
  }, [namesKey]);

  const field = (key: keyof GiftPickerBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftPickerBlockProps[typeof key] }) : undefined;
  const updateOption = onFieldChange
    ? (i: number, patch: Partial<GiftOption>) => onFieldChange({ ...props, options: options.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const choose = (name: string) => {
    if (isEditor) return;
    selectGift(name);
    const anchor = props.formAnchor || "#redeem";
    if (anchor.startsWith("#")) {
      const el = document.getElementById(anchor.slice(1));
      el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  };

  const cols = options.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : options.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section id={props.anchorId || "gifts"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <style>{GIFT_CSS}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(55% 40% at 50% 0%, ${pal.goldSoft} 0%, transparent 70%)` }} />
      {!reduced && <SparkleField palette={pal} count={5} />}
      <div className="relative mx-auto w-full max-w-page px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          {(props.kicker || isEditor) && <GiftKicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></GiftKicker>}
          {(props.headline || isEditor) && (
            <h2 className="whitespace-pre-line" style={displayStyle("clamp(2.2rem, 4.6vw, 3.6rem)")}>
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
          )}
          {(props.subheadline || isEditor) && (
            <p className="max-w-[48ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </div>

        <div className={cn("mt-14 grid grid-cols-1 gap-6 lg:mt-20", cols)}>
          {options.map((it, i) => {
            const picked = !isEditor && selection.selected !== "" && selection.selected === it.name;
            return (
              <motion.article
                key={i}
                data-gift-option={it.name}
                data-gift-picked={picked ? "true" : "false"}
                initial={reduced ? false : anim({ opacity: 0, y: 18 })}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: Math.min(i * 0.08, 0.32), ease: [0.16, 1, 0.3, 1] }}
                className="relative flex flex-col overflow-hidden rounded-[26px] p-4 pb-6 transition-shadow"
                style={{
                  background: pal.cream,
                  color: pal.creamInk,
                  boxShadow: picked
                    ? `0 0 0 2px ${pal.accent}, 0 40px 80px -40px rgba(0,0,0,0.85)`
                    : `0 0 0 1px ${pal.creamLine}, 0 40px 80px -40px rgba(0,0,0,0.85)`,
                }}
              >
                {/* Corner ribbon */}
                <div aria-hidden="true" className="pointer-events-none absolute -left-12 top-5 w-44 rotate-[-35deg] py-1 text-center text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ background: `linear-gradient(90deg, ${pal.gold}, #F3E2B4)`, color: pal.creamInk, boxShadow: "0 4px 10px -6px rgba(0,0,0,0.4)" }}>
                  {it.badge || String(i + 1).padStart(2, "0")}
                </div>
                <KitProductTile
                  src={it.imageUrl}
                  alt={it.imageAlt ?? it.name}
                  fit={it.fit ?? "contain"}
                  tileColor={tile}
                  palette={pal}
                  fallback={<Gift className="h-1/2 w-1/2" strokeWidth={1.25} style={{ color: pal.gold }} />}
                  className="w-full rounded-[20px]"
                  style={{ aspectRatio: "4 / 3", boxShadow: `inset 0 0 0 1px ${pal.creamLine}` }}
                  onUpdate={updateOption ? (v) => updateOption(i, { imageUrl: v }) : undefined}
                  onAltUpdate={updateOption ? (v) => updateOption(i, { imageAlt: v }) : undefined}
                />
                <div className="mt-5 flex flex-1 flex-col gap-2 px-2">
                  <h3 className="text-[20px] font-medium" style={{ letterSpacing: "-0.015em" }}>
                    <InlineText as="span" value={it.name} onUpdate={updateOption ? (v) => updateOption(i, { name: v }) : undefined} />
                  </h3>
                  {(it.caption || isEditor) && (
                    <p className="text-[14px] leading-relaxed" style={{ color: pal.creamMuted }}>
                      <InlineText as="span" value={it.caption ?? ""} onUpdate={updateOption ? (v) => updateOption(i, { caption: v }) : undefined} multiline />
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => choose(it.name)}
                      aria-pressed={picked}
                      className={cn(INVITE_PILL_CLASS, "!min-h-[42px] !px-5 !text-[13px]")}
                      style={picked ? { background: pal.creamInk, color: pal.cream } : { background: pal.accent, color: pal.onAccent, boxShadow: `0 10px 30px -14px ${pal.accent}` }}
                    >
                      {picked ? <Check className="h-4 w-4" aria-hidden strokeWidth={3} /> : <Gift className="h-4 w-4" aria-hidden />}
                      {picked ? (
                        <InlineText as="span" value={props.chosenText || "Your pick"} onUpdate={field("chosenText")} />
                      ) : (
                        <InlineText as="span" value={props.chooseText || "Choose this one"} onUpdate={field("chooseText")} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
