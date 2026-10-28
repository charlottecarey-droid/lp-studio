import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImageButton } from "@/components/InlineImageButton";
import { safeNavigate } from "@/lib/safe-url";
import { HUB_BODY, HUB_CSS, HUB_PILL_CLASS, HubKicker, hubDisplayStyle, hubPillStyle, resolveHubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Content Hub Paths — type "hub-paths"
 *
 * The front door of a multi-audience hub: two (or three) large path cards —
 * "I'm a dental professional" / "I'm a patient" — each with a kicker, a
 * title, a line, three bullets on what's inside and a button into its hub.
 * Sits under a hub-hero on the site's home page so the first screen sorts
 * visitors instead of guessing. Same preset / palette as the rest of the
 * family; an optional image per card.
 * -------------------------------------------------------------------------- */

export interface HubPath {
  kicker?: string;
  title: string;
  description?: string;
  bullets?: string[];
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export interface HubPathsBlockProps extends HubStyleProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  paths: HubPath[];
  anchorId?: string;
}

interface Props {
  props: HubPathsBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: HubPathsBlockProps) => void;
}

export const HUB_PATHS_DEFAULT_PROPS: HubPathsBlockProps = {
  kicker: "Choose your path",
  headline: "Who are you here for?",
  subheadline: "Two libraries, one for the team and one for the people they serve. Pick yours and everything is a click away.",
  anchorId: "paths",
  paths: [
    {
      kicker: "For teams",
      title: "I'm part of the team",
      description: "Set-up guides, how-to videos and the references you'll reach for every week.",
      bullets: ["Getting started, step by step", "Short how-to videos", "Pricing and reference sheets"],
      ctaText: "Open the team library",
      ctaUrl: "/teams",
    },
    {
      kicker: "For customers",
      title: "I'm a customer",
      description: "Plain-language guides on what to expect, written for people, not professionals.",
      bullets: ["What to expect, in short reads", "A two-minute explainer", "Who to contact with questions"],
      ctaText: "Open the customer library",
      ctaUrl: "/customers",
    },
  ],
};

export function BlockHubPaths({ props, brand, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "library");
  const t = pal.t;
  const isEditor = !!onFieldChange;
  const paths = (props.paths ?? []).slice(0, 3);
  const cols = paths.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  const field = (key: keyof HubPathsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as HubPathsBlockProps[typeof key] }) : undefined;
  const updatePath = onFieldChange
    ? (i: number, patch: Partial<HubPath>) => onFieldChange({ ...props, paths: paths.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 18 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const go = (url?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isEditor) {
      e.preventDefault();
      return;
    }
    onCtaClick?.();
    const u = (url ?? "").trim();
    if (!u) return;
    if (u.startsWith("#")) {
      const el = document.getElementById(u.slice(1));
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
      return;
    }
    e.preventDefault();
    safeNavigate(u, u.startsWith("/") ? "_self" : "_blank");
  };

  const cardStyle: React.CSSProperties =
    t.cardStyle === "flat"
      ? { background: pal.cardTint, borderRadius: t.cardRadius + 6 }
      : { background: pal.card, border: `1px solid ${pal.hairline}`, borderRadius: t.cardRadius + 6, boxShadow: pal.isDark ? "none" : "0 1px 2px rgba(11,11,15,0.04)" };

  return (
    <section id={props.anchorId || undefined} className="hub-paths relative" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
      <style>{HUB_CSS}</style>
      <div className="mx-auto w-full max-w-page px-6 py-16 lg:px-10 lg:py-24">
        {(props.kicker || props.headline || props.subheadline || isEditor) && (
          <div className="mb-10 max-w-[680px] lg:mb-14">
            {(props.kicker || isEditor) && (
              <div className="mb-4">
                <HubKicker palette={pal}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </HubKicker>
              </div>
            )}
            {(props.headline || isEditor) && (
              <h2 className="whitespace-pre-line" style={hubDisplayStyle(pal, "clamp(2rem, 4vw, 3.4rem)")}>
                <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
              </h2>
            )}
            {(props.subheadline || isEditor) && (
              <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed lg:text-[17px]" style={{ color: pal.muted }}>
                <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
          </div>
        )}

        <div className={cn("grid gap-5 lg:gap-6", cols)}>
          {paths.map((p, i) => {
            const image = (p.imageUrl ?? "").trim();
            return (
              <motion.article key={i} {...reveal(i * 0.08)} className="hub-card group relative flex flex-col overflow-hidden" style={cardStyle} data-hub-path>
                {(image || isEditor) && (
                  <div className="relative m-2 overflow-hidden" style={{ borderRadius: t.cardRadius, background: pal.cardTint, aspectRatio: "16 / 7" }}>
                    {image && <img src={image} alt={p.imageAlt ?? ""} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
                    {isEditor && (
                      <InlineImageButton value={image} onChange={(v) => updatePath?.(i, { imageUrl: v })} label="Path image" alt={p.imageAlt ?? ""} onAltChange={(v) => updatePath?.(i, { imageAlt: v })} />
                    )}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-7 lg:p-9">
                  {(p.kicker || isEditor) && (
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.accent }}>
                      <InlineText as="span" value={p.kicker ?? ""} onUpdate={updatePath ? (v) => updatePath(i, { kicker: v }) : undefined} />
                    </p>
                  )}
                  <h3 style={hubDisplayStyle(pal, "clamp(1.5rem, 2.4vw, 2.1rem)")}>
                    <InlineText as="span" value={p.title} onUpdate={updatePath ? (v) => updatePath(i, { title: v }) : undefined} />
                  </h3>
                  {(p.description || isEditor) && (
                    <p className="mt-3 text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                      <InlineText as="span" value={p.description ?? ""} onUpdate={updatePath ? (v) => updatePath(i, { description: v }) : undefined} multiline />
                    </p>
                  )}
                  {(p.bullets?.length || isEditor) && (
                    <ul className="mt-5 space-y-2 text-[14.5px]" style={{ color: pal.text }}>
                      {(p.bullets ?? []).map((b, bi) => (
                        <li key={bi} className="flex items-start gap-3">
                          <span aria-hidden="true" className="mt-[9px] block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pal.accentFill }} />
                          <InlineText as="span" value={b} onUpdate={updatePath ? (v) => updatePath(i, { bullets: (p.bullets ?? []).map((x, xi) => (xi === bi ? v : x)) }) : undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {(p.ctaText || isEditor) && (
                    <div className="mt-auto pt-7">
                      <a href={p.ctaUrl || "#"} onClick={go(p.ctaUrl)} className={HUB_PILL_CLASS} style={hubPillStyle(pal, i === 0 ? "solid" : "ghost")} data-hub-path-cta>
                        <InlineText as="span" value={p.ctaText ?? ""} onUpdate={updatePath ? (v) => updatePath(i, { ctaText: v }) : undefined} />
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </a>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
