import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { IconOrImage } from "@/lib/icon-value";
import { InlineText } from "@/components/InlineText";
import {
  BlendMedia,
  GLOW_BODY,
  GLOW_DISPLAY,
  DISPLAY_TRACKING,
  glowBackground,
  resolveGlowPalette,
  type MediaBlend,
  type MediaPlayMode,
} from "@/lib/glow-media";
import { mixHex } from "@/lib/section-ink";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Video Card Trio — type "video-card-trio"
 *
 * "Auditable. Private. Secured." — a centered headline, then 3 (or 4) tall
 * cards each led by a looping product clip or illustration that blends into
 * the card's glow, with a title and one-line body underneath. Clips play in
 * view by default or on hover.
 * -------------------------------------------------------------------------- */

export interface VideoTrioCard {
  title: string;
  body?: string;
  /** Optional Lucide icon name / image shown beside the title. */
  icon?: string;
  videoUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  /** Optional per-card blend override. */
  mediaBlend?: MediaBlend;
}

export interface VideoCardTrioBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  cards: VideoTrioCard[];
  playMode?: MediaPlayMode;
  mediaBlend?: MediaBlend;
  mediaEdgeFade?: boolean;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
}

interface Props {
  props: VideoCardTrioBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: VideoCardTrioBlockProps) => void;
}

export const VIDEO_CARD_TRIO_DEFAULT_PROPS: VideoCardTrioBlockProps = {
  eyebrow: "",
  headline: "Auditable. Private. Secured.",
  subheadline: "Every action is traceable. Every byte is protected. Every output is yours.",
  playMode: "inview",
  mediaBlend: "auto",
  mediaEdgeFade: true,
  cards: [
    {
      title: "Your team's IP stays private.",
      body: "The workflows and expertise you build in are visible only to your organization — never shared with other customers or vendors.",
      videoUrl: "",
      imageUrl: "",
    },
    {
      title: "Audit-grade confidence.",
      body: "Every output ties back to its source data and the work behind it, so reviewers always have a permanent trail.",
      videoUrl: "",
      imageUrl: "",
    },
    {
      title: "Your data stays secure.",
      body: "Runs on infrastructure designed with SOC 2 controls, with data encrypted in transit and at rest.",
      videoUrl: "",
      imageUrl: "",
    },
  ],
};

export function BlockVideoCardTrio({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveGlowPalette(props, brand);
  const isEditor = !!onFieldChange;
  const cards = props.cards && props.cards.length > 0 ? props.cards : VIDEO_CARD_TRIO_DEFAULT_PROPS.cards;

  const field = (key: keyof VideoCardTrioBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as VideoCardTrioBlockProps[typeof key] })
      : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<VideoTrioCard>) =>
        onFieldChange({ ...props, cards: cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  const cardBase = pal.dark ? mixHex("#FFFFFF", pal.bg, 0.06) : mixHex("#000000", pal.bg, 0.03);
  const cols = cards.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : cards.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <section className="vct relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }}>
      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {(props.eyebrow || props.headline || props.subheadline || isEditor) && (
          <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16 flex flex-col items-center gap-4">
            {(props.eyebrow || isEditor) && (
              <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: pal.eyebrow }}>
                <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </p>
            )}
            {(props.headline || isEditor) && (
              <h2
                className="font-semibold leading-[1.05]"
                style={{ fontFamily: GLOW_DISPLAY, letterSpacing: DISPLAY_TRACKING, fontSize: "clamp(2.1rem, 4.6vw, 3.6rem)" }}
              >
                <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
              </h2>
            )}
            {(props.subheadline || isEditor) && (
              <p className="text-base lg:text-lg leading-relaxed max-w-[48ch]" style={{ color: pal.muted }}>
                <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
          </div>
        )}

        <div className={cn("grid grid-cols-1 gap-4 lg:gap-5", cols)}>
          {cards.map((card, i) => (
            <motion.article
              key={i}
              initial={reduced ? false : anim({ opacity: 0, y: 24 })}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: Math.min(i * 0.08, 0.4), ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-3xl flex flex-col"
              style={{ background: glowBackground({ glow: pal.glow, panel: cardBase, dark: pal.dark }, i % 2 === 0 ? "bottom-left" : "bottom-right", pal.dark ? 0.45 : 0.7) }}
            >
              <div className="px-5 pt-5 sm:px-6 sm:pt-6">
                <BlendMedia
                  videoUrl={card.videoUrl}
                  imageUrl={card.imageUrl}
                  imageAlt={card.imageAlt ?? card.title}
                  imageFocal={card.imageFocal}
                  blend={card.mediaBlend ?? props.mediaBlend}
                  edgeFade={props.mediaEdgeFade !== false}
                  aspect="4/3"
                  playMode={props.playMode ?? "inview"}
                  palette={pal}
                  placeholder={(["sheet", "list", "board", "chart"] as const)[i % 4]}
                  title={card.title}
                  className="rounded-xl"
                  onImageUpdate={updateCard ? (url) => updateCard(i, { imageUrl: url }) : undefined}
                  onAltUpdate={updateCard ? (alt) => updateCard(i, { imageAlt: alt }) : undefined}
                  onFocalUpdate={updateCard ? (f) => updateCard(i, { imageFocal: f }) : undefined}
                />
              </div>
              <div className="px-6 pb-7 pt-5 sm:px-7 sm:pb-8 flex flex-col gap-2">
                <h3 className="flex items-start gap-2 text-lg font-semibold leading-snug" style={{ fontFamily: GLOW_DISPLAY, letterSpacing: "-0.015em" }}>
                  {(card.icon || (isEditor && !card.title)) && (
                    <span className="mt-1 shrink-0" style={{ color: pal.accent }} aria-hidden="true">
                      <IconOrImage value={card.icon} fallback={Sparkles} className="w-4 h-4" />
                    </span>
                  )}
                  <InlineText as="span" value={card.title} onUpdate={updateCard ? (v) => updateCard(i, { title: v }) : undefined} multiline />
                </h3>
                {(card.body || isEditor) && (
                  <p className="text-sm leading-relaxed" style={{ color: pal.muted }}>
                    <InlineText as="span" value={card.body ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { body: v }) : undefined} multiline />
                  </p>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
