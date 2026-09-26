import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  BlendMedia,
  GlowPanel,
  GLOW_BODY,
  GLOW_DISPLAY,
  DISPLAY_TRACKING,
  resolveGlowPalette,
  type MediaAspect,
  type MediaBlend,
} from "@/lib/glow-media";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Video Zigzag — type "video-zigzag"
 *
 * "Your work. Your way." — a centered header, then alternating rows: a large
 * product video in a gradient-glow panel on one side, a compact text lockup
 * (title, body, optional arrow link) on the other. Every row's video blends
 * into its panel and plays only while on screen.
 * -------------------------------------------------------------------------- */

export interface VideoZigzagRow {
  title: string;
  body?: string;
  videoUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  /** Per-row link — deliberately NOT ctaText/ctaUrl so the Page CTA never rewrites it. */
  linkText?: string;
  linkUrl?: string;
}

export interface VideoZigzagBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  rows: VideoZigzagRow[];
  /** Which side the FIRST row's media sits on. */
  startSide?: "left" | "right";
  mediaBlend?: MediaBlend;
  mediaEdgeFade?: boolean;
  mediaAspect?: MediaAspect;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
}

interface Props {
  props: VideoZigzagBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: VideoZigzagBlockProps) => void;
}

export const VIDEO_ZIGZAG_DEFAULT_PROPS: VideoZigzagBlockProps = {
  eyebrow: "",
  headline: "Your work. Your way.",
  subheadline: "Access the most capable system for doing real work, exactly how you need it done.",
  startSide: "left",
  mediaBlend: "auto",
  mediaEdgeFade: true,
  mediaAspect: "4/3",
  rows: [
    {
      title: "Connect your systems.",
      body: "Push, pull, read, and write across every tool your team already works in — no rip-and-replace, no migration project.",
      videoUrl: "",
      imageUrl: "",
    },
    {
      title: "Assign real work on day one.",
      body: "Run recurring workflows end to end, from source data to finished output, with the expertise for your domain built in.",
      videoUrl: "",
      imageUrl: "",
    },
    {
      title: "Learns how you work.",
      body: "Every team has its own rules. State a preference once and every run after that follows it.",
      videoUrl: "",
      imageUrl: "",
    },
    {
      title: "Stay in control.",
      body: "See every step and every source in real time. Set guardrails, step in when needed, and approve what needs judgment.",
      videoUrl: "",
      imageUrl: "",
    },
  ],
};

export function BlockVideoZigzag({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveGlowPalette(props, brand);
  const isEditor = !!onFieldChange;
  const rows = props.rows && props.rows.length > 0 ? props.rows : VIDEO_ZIGZAG_DEFAULT_PROPS.rows;
  const startLeft = (props.startSide ?? "left") === "left";

  const field = (key: keyof VideoZigzagBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as VideoZigzagBlockProps[typeof key] })
      : undefined;
  const updateRow = onFieldChange
    ? (i: number, patch: Partial<VideoZigzagRow>) =>
        onFieldChange({ ...props, rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
    : undefined;

  return (
    <section className="vzz relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }}>
      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {(props.eyebrow || props.headline || props.subheadline || isEditor) && (
          <div className="max-w-3xl mx-auto text-center mb-16 lg:mb-24 flex flex-col items-center gap-4">
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

        <div className="flex flex-col gap-20 lg:gap-32">
          {rows.map((row, i) => {
            const mediaLeft = startLeft ? i % 2 === 0 : i % 2 === 1;
            return (
              <motion.div
                key={i}
                initial={reduced ? false : anim({ opacity: 0, y: 28 })}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center"
              >
                <div className={cn("lg:col-span-7", mediaLeft ? "lg:order-1" : "lg:order-2")}>
                  <GlowPanel palette={pal} glowFrom={mediaLeft ? "bottom-left" : "bottom-right"} radius={28}>
                    <div className={cn("pt-4 sm:pt-7 lg:pt-9", mediaLeft ? "pl-4 sm:pl-7 lg:pl-9 pr-0" : "pr-4 sm:pr-7 lg:pr-9 pl-0")}>
                      <BlendMedia
                        videoUrl={row.videoUrl}
                        imageUrl={row.imageUrl}
                        imageAlt={row.imageAlt ?? row.title}
                        imageFocal={row.imageFocal}
                        blend={props.mediaBlend}
                        edgeFade={props.mediaEdgeFade !== false}
                        aspect={props.mediaAspect ?? "4/3"}
                        playMode="inview"
                        palette={pal}
                        placeholder={(["list", "sheet", "board", "chart"] as const)[i % 4]}
                        title={row.title}
                        className={mediaLeft ? "rounded-tl-xl" : "rounded-tr-xl"}
                        onImageUpdate={updateRow ? (url) => updateRow(i, { imageUrl: url }) : undefined}
                        onAltUpdate={updateRow ? (alt) => updateRow(i, { imageAlt: alt }) : undefined}
                        onFocalUpdate={updateRow ? (f) => updateRow(i, { imageFocal: f }) : undefined}
                      />
                    </div>
                  </GlowPanel>
                </div>

                <div className={cn("lg:col-span-5 flex flex-col gap-3", mediaLeft ? "lg:order-2 lg:pl-4" : "lg:order-1 lg:pr-4")}>
                  <h3
                    className="font-semibold leading-tight"
                    style={{ fontFamily: GLOW_DISPLAY, letterSpacing: "-0.02em", fontSize: "clamp(1.5rem, 2.4vw, 2rem)" }}
                  >
                    <InlineText as="span" value={row.title} onUpdate={updateRow ? (v) => updateRow(i, { title: v }) : undefined} multiline />
                  </h3>
                  {(row.body || isEditor) && (
                    <p className="text-[15px] lg:text-base leading-relaxed max-w-[46ch]" style={{ color: pal.muted }}>
                      <InlineText as="span" value={row.body ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {(row.linkText || isEditor) && (
                    <a
                      href={row.linkUrl || "#"}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold w-fit"
                      style={{ color: pal.accent }}
                    >
                      <InlineText as="span" value={row.linkText ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { linkText: v }) : undefined} />
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
