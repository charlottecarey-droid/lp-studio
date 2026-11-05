import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_WRAP,
  MintCtaButtons, mintDisplay, mintHighlight, mintSub, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Band — type "mint-band"  (DSO Page (Light) family, Nov 2026)
 *
 * The artifact's one full-bleed photo band: a deep-green section with the
 * photo behind it (desaturated, darkened, 118% tall so it can drift ±30px
 * with the scroll), and centred cream copy — a 14ch display headline whose
 * last phrase carries a translucent lime highlight, and a muted sub whose
 * bold run reads full cream. Optional chevron links under the sub through
 * the CTA suite. Parallax is off under reduced motion, static render and in
 * the builder; the reveal fades the copy up through useMintReveal.
 * -------------------------------------------------------------------------- */

export interface MintBandBlockProps extends MintStyleProps, MintCtaProps {
  /** "\n" breaks a line. */
  headline: string;
  /** The phrase that gets the translucent lime bar; blank = none. */
  highlight?: string;
  /** Inline HTML is allowed: a <b> run reads full cream ("…<b>They standardize a system doctors prefer.</b>"). */
  subheadline?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  /** Photo brightness 0–1 (the artifact darkens it to .72). */
  tint?: number;
  anchorId?: string;
}

interface Props {
  props: MintBandBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintBandBlockProps) => void;
}

export const MINT_BAND_DEFAULT_PROPS: MintBandBlockProps = {
  ...MINT_CTA_DEFAULTS,
  headline: "From dozens of labs to one.",
  highlight: "one.",
  subheadline: "Most groups run eleven labs or more and call consolidation a priority. The ones that get there don't mandate a lab. <b>They standardize a system doctors prefer.</b>",
  imageUrl: "",
  imageAlt: "",
  tint: 0.72,
  anchorId: "thesis",
  backgroundStyle: "dandy-green",
};

/** Render the headline with the highlighted phrase wrapped (live page only; the builder edits the plain string). */
function Headline({ text, highlight, lime }: { text: string; highlight?: string; lime: string }) {
  const lines = text.split("\n");
  const hl = (highlight ?? "").trim();
  return (
    <>
      {lines.map((line, i) => {
        const idx = hl ? line.indexOf(hl) : -1;
        return (
          <span key={i} className="block">
            {idx === -1 ? line : (
              <>
                {line.slice(0, idx)}
                <span style={mintHighlight(lime, 0.55)}>{hl}</span>
                {line.slice(idx + hl.length)}
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

export function BlockMintBand({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...MINT_BAND_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#003A30");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useMintReveal<HTMLElement>("-40px");
  const [shift, setShift] = useState(0);

  // The band parallax from the artifact: the photo drifts up to ±30px as the band crosses the viewport.
  const parallax = !reduced && !staticRender && !isEditor;
  useEffect(() => {
    if (!parallax) { setShift(0); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        if (r.bottom < 0 || r.top > vh) return;
        const prog = (vh - r.top) / (vh + r.height);
        setShift((prog - 0.5) * -60);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [parallax, ref]);

  const field = (key: keyof MintBandBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintBandBlockProps[typeof key] }) : undefined;

  // Default surface is the deep green behind the photo; a chosen preset or custom colour paints the band instead.
  const customSurface = !!p.bgColor || (!!p.backgroundStyle && p.backgroundStyle !== "dandy-green");
  const surface = customSurface ? pal.bg : pal.deep;
  const ink = pal.dark ? pal.cream : pal.ink;
  const muted = pal.dark ? pal.creamMuted : pal.inkMuted;
  const brightness = Math.max(0.2, Math.min(1, typeof p.tint === "number" && Number.isFinite(p.tint) ? p.tint : 0.72));
  const hasImage = !!(p.imageUrl ?? "").trim();

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-band"
      className="mint-band relative isolate overflow-hidden"
      style={{ background: surface, color: ink, fontFamily: MINT_BODY }}
    >
      <style>{MINT_CSS}{`
        .mint-band-sub b, .mint-band-sub strong { color: ${ink}; font-weight: 500; }
        .mint-band-copy { pointer-events: none; }
        .mint-band-copy > * { pointer-events: auto; }
      `}</style>

      {(hasImage || isEditor) && (
        <div className="absolute inset-0 z-0" aria-hidden={!hasImage || undefined}>
          <InlineImage
            src={p.imageUrl ?? ""}
            alt={p.imageAlt ?? ""}
            className="h-full w-full object-cover"
            wrapperClassName="absolute inset-0"
            style={{
              height: "118%",
              filter: `saturate(.7) brightness(${brightness})`,
              transform: `translate3d(0, ${shift}px, 0)`,
              willChange: parallax ? "transform" : undefined,
            }}
            focalPoint={p.imageFocal}
            onUpdate={field("imageUrl")}
            onAltUpdate={field("imageAlt")}
            onFocalUpdate={field("imageFocal")}
          />
        </div>
      )}

      <div className={cn(MINT_WRAP, "mint-band-copy relative z-10 text-center")} style={{ paddingBlock: "clamp(120px, 18vw, 220px)" }}>
        {(p.headline || isEditor) && (
          <motion.h2 {...rise(0, 18)} className="mx-auto max-w-[14ch]" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", ink)}>
            {isEditor ? (
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            ) : (
              <Headline text={p.headline} highlight={p.highlight} lime={pal.lime} />
            )}
          </motion.h2>
        )}
        {(p.subheadline || isEditor) && (
          <motion.p {...rise(0.1, 18)} className="mint-band-sub mx-auto" style={mintSub(muted)}>
            <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
          </motion.p>
        )}
        {(p.ctaText || p.ctaSecondaryText || isEditor) && (
          <motion.div {...rise(0.18, 18)} className="mt-[26px]">
            <MintCtaButtons
              props={p}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
              source="mint-band"
              style="link"
              primaryPlaceholder="See how consolidation works"
              secondaryPlaceholder="Read the story"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
