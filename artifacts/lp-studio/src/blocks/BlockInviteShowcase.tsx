import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { BlendMedia, type MediaAspect, type MediaBlend } from "@/lib/glow-media";
import { INVITE_BODY, Kicker, displayStyle, resolveInvitePalette } from "@/lib/invite-theme";
import { mixHex } from "@/lib/section-ink";

/* ----------------------------------------------------------------------------
 * Invite Showcase — type "invite-showcase"
 *
 * "INSIDE THE LAB / Where precision meets scale.": a left-aligned kicker, a
 * three-line display headline with ONE accent word, a short paragraph set to
 * the right, a large framed media panel (product clip or photo) and a row of
 * numbered 01 / 02 / 03 features beneath it. Shows the product instead of
 * describing it — the visitor gets confidence the call is worth taking.
 * -------------------------------------------------------------------------- */

export interface InviteShowcaseFeature {
  title: string;
  body: string;
}

export interface InviteShowcaseBlockProps {
  kicker?: string;
  headline?: string;
  /** A word or phrase inside the headline rendered in the accent color. */
  headlineAccent?: string;
  body?: string;
  videoUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  mediaAspect?: MediaAspect;
  mediaBlend?: MediaBlend;
  features: InviteShowcaseFeature[];
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: InviteShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: InviteShowcaseBlockProps) => void;
}

export const INVITE_SHOWCASE_DEFAULT_PROPS: InviteShowcaseBlockProps = {
  kicker: "Inside the platform",
  headline: "Where precision meets scale.",
  headlineAccent: "scale",
  body: "See the views your team would use every week — on a live account, not a mock-up.",
  videoUrl: "",
  imageUrl: "",
  mediaAspect: "16/9",
  mediaBlend: "none",
  features: [
    { title: "Every location, one view", body: "Performance by site, by team and by product, refreshed as the work happens." },
    { title: "Quality, caught early", body: "Issues flagged at the source, before they become rework and lost time." },
    { title: "Decisions with evidence", body: "Benchmarks and recommendations, so leaders manage by exception." },
  ],
  anchorId: "showcase",
};

export function BlockInviteShowcase({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const features = props.features && props.features.length > 0 ? props.features : INVITE_SHOWCASE_DEFAULT_PROPS.features;

  const field = (key: keyof InviteShowcaseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as InviteShowcaseBlockProps[typeof key] }) : undefined;
  const updateFeature = onFieldChange
    ? (i: number, patch: Partial<InviteShowcaseFeature>) => onFieldChange({ ...props, features: features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) })
    : undefined;

  // Headline with the accent phrase colored (falls back to plain when absent).
  const headline = props.headline ?? "";
  const accentPhrase = props.headlineAccent?.trim();
  const idx = accentPhrase ? headline.indexOf(accentPhrase) : -1;
  const headlineNode =
    isEditor || idx < 0 || !accentPhrase ? (
      <InlineText as="span" value={headline} onUpdate={field("headline")} multiline />
    ) : (
      <>
        {headline.slice(0, idx)}
        <span style={{ color: pal.accent }}>{accentPhrase}</span>
        {headline.slice(idx + accentPhrase.length)}
      </>
    );

  // The framed panel: a slightly raised surface with a hairline and a soft
  // accent halo, like the lab-tour video card.
  const glowPal = { glow: pal.accent, panel: pal.panel, dark: true, accent: pal.accent };

  return (
    <section id={props.anchorId || "showcase"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <div className="mx-auto w-full max-w-[1240px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7 flex flex-col gap-6">
            {(props.kicker || isEditor) && <Kicker palette={pal} align="left"><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>}
            <h2 className="max-w-[12ch]" style={displayStyle("clamp(2.6rem, 5.6vw, 4.6rem)")}>{headlineNode}</h2>
          </div>
          {(props.body || isEditor) && (
            <p className="lg:col-span-5 max-w-[44ch] text-[15px] leading-relaxed lg:pb-3" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.body ?? ""} onUpdate={field("body")} multiline />
            </p>
          )}
        </div>

        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 24 })}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-12 overflow-hidden rounded-[22px] lg:mt-16"
          style={{
            background: pal.panel,
            border: `1px solid ${pal.hairline}`,
            boxShadow: `0 40px 90px -50px color-mix(in srgb, ${pal.accent} 35%, transparent), 0 30px 60px -40px rgba(0,0,0,0.8)`,
          }}
        >
          <BlendMedia
            videoUrl={props.videoUrl}
            imageUrl={props.imageUrl}
            imageAlt={props.imageAlt}
            aspect={props.mediaAspect ?? "16/9"}
            blend={props.mediaBlend ?? "none"}
            edgeFade={false}
            playMode="inview"
            palette={glowPal}
            placeholder="chart"
            title={props.headline}
            onImageUpdate={field("imageUrl")}
            onAltUpdate={field("imageAlt")}
          />
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 lg:mt-16" style={{ borderTop: `1px solid ${pal.hairline}` }}>
          {features.map((f, i) => (
            <div key={i} className="flex flex-col gap-3 pt-8">
              <span className="text-[11px] font-semibold tracking-[0.22em]" style={{ color: pal.accent }}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-lg font-medium" style={{ letterSpacing: "-0.01em" }}>
                <InlineText as="span" value={f.title} onUpdate={updateFeature ? (v) => updateFeature(i, { title: v }) : undefined} />
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: mixHex("#FFFFFF", pal.bg, 0.66) }}>
                <InlineText as="span" value={f.body} onUpdate={updateFeature ? (v) => updateFeature(i, { body: v }) : undefined} multiline />
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
