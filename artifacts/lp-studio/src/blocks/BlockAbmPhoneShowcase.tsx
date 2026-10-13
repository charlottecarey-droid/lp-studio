import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { BlendMedia, type MediaPlayMode } from "@/lib/glow-media";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, AbmKicker, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { PhoneFrame } from "./abm/PhoneFrame";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Phone Showcase — type "abm-phone-showcase"
 *
 * "The foundation for enterprise success": a phone mockup playing a portrait
 * product clip (or showing a screenshot) beside a headline, an intro paragraph
 * and a checklist of four outcome pillars (bold title + one-sentence body).
 * -------------------------------------------------------------------------- */

export interface AbmPillar {
  title: string;
  body: string;
}

export interface AbmPhoneShowcaseBlockProps extends AbmStyleProps {
  kicker?: string;
  headline?: string;
  intro?: string;
  items: AbmPillar[];
  /** Portrait clip inside the phone (mp4 / webm or an embed link); the image is its poster. */
  mediaVideoUrl?: string;
  mediaImageUrl?: string;
  mediaImageAlt?: string;
  mediaPlayMode?: MediaPlayMode;
  phoneSide?: "left" | "right";
  /** Device shell colour. Default near-black. */
  phoneColor?: string;
  anchorId?: string;
}

interface Props {
  props: AbmPhoneShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmPhoneShowcaseBlockProps) => void;
}

export const ABM_PHONE_SHOWCASE_DEFAULT_PROPS: AbmPhoneShowcaseBlockProps = {
  kicker: "",
  headline: "The foundation for enterprise success",
  intro: "The operational foundation that drives next-level consistency and predictable performance across your most complex programs.",
  items: [
    { title: "Gain enterprise-wide financial clarity", body: "Integrate disparate workflows into a single source of truth for real-time cost certainty and a unified view of profit performance across every segment." },
    { title: "Master complex project controls", body: "Manage large programs with the process adherence needed to keep teams productive, from the first plan to the final handover." },
    { title: "Use AI for proactive foresight", body: "Surface risks early, optimize schedules and identify the most efficient path forward for a growing backlog." },
    { title: "Scale without additional overhead", body: "Digitize manual methods and give every employee back hours of administrative time each week." },
  ],
  mediaVideoUrl: "",
  mediaImageUrl: "",
  mediaImageAlt: "",
  mediaPlayMode: "inview",
  phoneSide: "left",
  anchorId: "platform",
  backgroundStyle: "white",
};

export function BlockAbmPhoneShowcase({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const items = props.items ?? [];
  const phoneLeft = (props.phoneSide ?? "left") === "left";

  const field = (key: keyof AbmPhoneShowcaseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmPhoneShowcaseBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<AbmPillar>) => onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 18 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="abm-phone-showcase relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-12 lg:gap-16 lg:py-28")}>
        <motion.div {...reveal(0.05)} className={cn("lg:col-span-5", phoneLeft ? "" : "lg:order-last")}>
          <PhoneFrame shellColor={props.phoneColor && /^#[0-9a-f]{6}$/i.test(props.phoneColor) ? props.phoneColor : undefined}>
            <BlendMedia
              videoUrl={props.mediaVideoUrl}
              imageUrl={props.mediaImageUrl}
              imageAlt={props.mediaImageAlt}
              blend="none"
              edgeFade={false}
              fit="cover"
              playMode={props.mediaPlayMode ?? "inview"}
              palette={{ dark: false, accent: pal.accentDeco, glow: pal.accentDeco }}
              placeholder="list"
              className="h-full w-full"
              style={{ aspectRatio: "auto", height: "100%" }}
              title={props.mediaImageAlt || "Product walkthrough"}
              onImageUpdate={onFieldChange ? (v) => onFieldChange({ ...props, mediaImageUrl: v }) : undefined}
              onAltUpdate={onFieldChange ? (v) => onFieldChange({ ...props, mediaImageAlt: v }) : undefined}
            />
          </PhoneFrame>
        </motion.div>

        <div className="lg:col-span-7">
          {(props.kicker || isEditor) && (
            <motion.div {...reveal(0)} className="mb-5">
              <AbmKicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></AbmKicker>
            </motion.div>
          )}
          <motion.h2 {...reveal(0.04)} className="max-w-[20ch] whitespace-pre-line" style={displayStyle("clamp(2rem, 3.6vw, 2.9rem)", pal.heading)}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h2>
          {(props.intro || isEditor) && (
            <motion.p {...reveal(0.08)} className="mt-5 max-w-[60ch] text-[17px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.intro ?? ""} onUpdate={field("intro")} multiline />
            </motion.p>
          )}
          <ul className="mt-10 flex flex-col gap-7">
            {items.map((it, i) => (
              <motion.li key={i} {...reveal(0.1 + Math.min(i, 5) * 0.06)} className="flex items-start gap-5">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
                  <Check className="h-7 w-7" strokeWidth={2.75} style={{ color: pal.accent }} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[19px] font-semibold leading-snug" style={{ color: pal.heading, letterSpacing: "-0.01em" }}>
                    <InlineText as="span" value={it.title} onUpdate={updateItem ? (v) => updateItem(i, { title: v }) : undefined} />
                  </h3>
                  {(it.body || isEditor) && (
                    <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                      <InlineText as="span" value={it.body ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
