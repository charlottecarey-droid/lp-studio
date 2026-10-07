import { motion, useReducedMotion } from "framer-motion";
import { Box } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, Kicker, displayStyle, resolveInvitePalette } from "@/lib/invite-theme";
import { KIT_TILE_DEFAULT, KitProductTile, type KitTileFit } from "./kit/KitProductTile";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Kit Contents — type "kit-contents"
 *
 * "WHAT'S IN THE BOX": a centered header and a row of 2–4 item cards, each a
 * light product tile (studio shot multiplied onto the tile, or a cover
 * photo), a two-digit index, the item's name and a one-line caption. Tells
 * the recipient what they are holding before the setup steps ask them to
 * use it.
 * -------------------------------------------------------------------------- */

export interface KitContentsItem {
  name: string;
  caption?: string;
  imageUrl?: string;
  imageAlt?: string;
  fit?: KitTileFit;
}

export interface KitContentsBlockProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  items: KitContentsItem[];
  tileColor?: string;
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: KitContentsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: KitContentsBlockProps) => void;
}

export const KIT_CONTENTS_DEFAULT_PROPS: KitContentsBlockProps = {
  kicker: "What's in the box",
  headline: "Everything you need to get started.",
  subheadline: "Unpack it all before you begin — the setup steps use each item.",
  items: [
    { name: "The headset", caption: "Charged and ready to go, controllers included.", imageUrl: "", imageAlt: "", fit: "contain" },
    { name: "A sample of the work", caption: "A real example of what the experience shows. Pass it around.", imageUrl: "", imageAlt: "", fit: "cover" },
    { name: "Your access card", caption: "The six-digit code you'll enter in step three, and the link to this page.", imageUrl: "", imageAlt: "", fit: "cover" },
  ],
  tileColor: KIT_TILE_DEFAULT,
  anchorId: "inside",
};

export function BlockKitContents({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const items = props.items && props.items.length > 0 ? props.items : KIT_CONTENTS_DEFAULT_PROPS.items;
  const tile = props.tileColor && /^#[0-9a-f]{6}$/i.test(props.tileColor) ? props.tileColor : KIT_TILE_DEFAULT;

  const field = (key: keyof KitContentsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as KitContentsBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<KitContentsItem>) => onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const cols = items.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section id={props.anchorId || "inside"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <div className="mx-auto w-full max-w-[1240px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          {(props.kicker || isEditor) && <Kicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>}
          {(props.headline || isEditor) && (
            <h2 style={displayStyle("clamp(2.2rem, 4.6vw, 3.6rem)")}>
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
          {items.map((it, i) => (
            <motion.article
              key={i}
              initial={reduced ? false : anim({ opacity: 0, y: 18 })}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: Math.min(i * 0.08, 0.32), ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-4"
            >
              <KitProductTile
                src={it.imageUrl}
                alt={it.imageAlt ?? it.name}
                fit={it.fit ?? "contain"}
                tileColor={tile}
                palette={pal}
                fallback={<Box className="h-1/2 w-1/2" strokeWidth={1.25} />}
                className="w-full rounded-[22px]"
                style={{ aspectRatio: "4 / 3", boxShadow: `0 30px 60px -36px rgba(0,0,0,0.8), 0 0 0 1px ${pal.hairline}` }}
                onUpdate={updateItem ? (v) => updateItem(i, { imageUrl: v }) : undefined}
                onAltUpdate={updateItem ? (v) => updateItem(i, { imageAlt: v }) : undefined}
              />
              <div className="flex items-start gap-4 px-1">
                <span className="mt-1 text-[11px] font-semibold tracking-[0.22em]" style={{ color: pal.accent }}>{String(i + 1).padStart(2, "0")}</span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-medium" style={{ letterSpacing: "-0.01em" }}>
                    <InlineText as="span" value={it.name} onUpdate={updateItem ? (v) => updateItem(i, { name: v }) : undefined} />
                  </h3>
                  {(it.caption || isEditor) && (
                    <p className="text-sm leading-relaxed" style={{ color: pal.muted }}>
                      <InlineText as="span" value={it.caption ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { caption: v }) : undefined} multiline />
                    </p>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
