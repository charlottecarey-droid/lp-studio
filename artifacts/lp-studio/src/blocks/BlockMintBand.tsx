import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_WIDE,
  MintCtaButtons, MintEyebrow, mintDisplay, mintHighlight, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Band — type "mint-band"  (DSO Page (Light) family, Nov 2026)
 *
 * The one full-bleed photo band: a deep-green section with the photo behind
 * it (desaturated, darkened, 118% tall so it can drift ±30px with the
 * scroll, under a deep→deeper gradient scrim), laid out as a 7/5 grid —
 * left, an eyebrow with a lime dot, a 14ch cream display headline whose
 * last phrase carries a translucent lime highlight, and a muted sub whose
 * bold run reads full cream; right, a glass "ledger" card of hairline rows
 * (muted label, display-face number), with an uppercase lime arrow row
 * ("With us ———") before the highlighted last number. Parallax is off under
 * reduced motion, static render and in the builder; the reveal fades the
 * copy up through useMintReveal.
 * -------------------------------------------------------------------------- */

export interface MintLedgerRow {
  label: string;
  value: string;
  /** Lime number (the "after" row). The arrow row sits above the first highlighted row. */
  highlight?: boolean;
}

export interface MintBandBlockProps extends MintStyleProps, MintCtaProps {
  /** Eyebrow above the headline ("The thesis"). */
  eyebrow?: string;
  /** "\n" breaks a line. */
  headline: string;
  /** The phrase that gets the translucent lime bar; blank = none. */
  highlight?: string;
  /** Inline HTML is allowed: a <b> run reads full cream ("…<b>They standardize a system doctors prefer.</b>"). */
  subheadline?: string;
  /** The glass ledger card at the right: up to 6 rows. Blank = no card. */
  ledger?: MintLedgerRow[];
  /** Uppercase lime row with a fading line, placed before the first highlighted ledger row ("With us"). */
  ledgerArrowText?: string;
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
  eyebrow: "The thesis",
  headline: "From dozens of labs to one.",
  highlight: "one.",
  subheadline: "Most groups run eleven labs or more and call consolidation a priority. The ones that get there don't mandate a lab. <b>They standardize a system doctors prefer.</b>",
  ledger: [
    { label: "Labs across a typical emerging group", value: "11–25" },
    { label: "Call consolidation a priority or under consideration", value: "96%" },
    { label: "Actually executing a consolidation plan", value: "1%" },
    { label: "Labs, platforms and scanners to manage", value: "1", highlight: true },
  ],
  ledgerArrowText: "With us",
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
  const updateRow = onFieldChange
    ? (i: number, patch: Partial<MintLedgerRow>) => onFieldChange({ ...props, ledger: (p.ledger ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
    : undefined;

  // Default surface is the deep green behind the photo; a chosen preset or custom colour paints the band instead.
  const customSurface = !!p.bgColor || (!!p.backgroundStyle && p.backgroundStyle !== "dandy-green");
  const surface = customSurface ? pal.bg : pal.deep;
  const ink = pal.dark ? pal.cream : pal.ink;
  const muted = pal.dark ? pal.creamMuted : pal.inkMuted;
  const brightness = Math.max(0.2, Math.min(1, typeof p.tint === "number" && Number.isFinite(p.tint) ? p.tint : 0.72));
  const hasImage = !!(p.imageUrl ?? "").trim();
  const rows = (p.ledger ?? []).filter((r) => r.label?.trim() || r.value?.trim() || isEditor).slice(0, 6);
  const arrowAt = rows.findIndex((r) => r.highlight);
  const lineDark = "rgba(255,252,239,0.14)";
  const scrimTop = `color-mix(in srgb, ${pal.deep} 30%, transparent)`;
  const scrimBottom = `color-mix(in srgb, ${pal.deep} 75%, transparent)`;

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
          {hasImage && <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, ${scrimTop}, ${scrimBottom})` }} />}
        </div>
      )}

      <div className={cn(MINT_WIDE, "relative z-10 grid items-center gap-10 min-[1000px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]")} style={{ paddingBlock: "clamp(110px, 16vw, 200px)" }}>
        <div className="mint-band-copy min-w-0">
          {(p.eyebrow || isEditor) && (
            <motion.div {...rise(0, 18)}>
              <MintEyebrow palette={pal} style={{ marginBottom: 16 }}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </MintEyebrow>
            </motion.div>
          )}
          {(p.headline || isEditor) && (
            <motion.h2 {...rise(0.08, 18)} style={{ ...mintDisplay("clamp(2.2rem, 4.6vw, 3.8rem)", ink), maxWidth: "14ch" }}>
              {isEditor ? (
                <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
              ) : (
                <Headline text={p.headline} highlight={p.highlight} lime={pal.lime} />
              )}
            </motion.h2>
          )}
          {(p.subheadline || isEditor) && (
            <motion.p {...rise(0.16, 18)} className="mint-band-sub" style={{ fontFamily: MINT_BODY, fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: muted, maxWidth: "40ch", marginTop: 16, textWrap: "pretty" } as React.CSSProperties}>
              <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
          {(p.ctaText || p.ctaSecondaryText || isEditor) && (
            <motion.div {...rise(0.24, 18)} className="mt-[26px]">
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
                align="start"
                primaryPlaceholder="See how consolidation works"
                secondaryPlaceholder="Read the story"
              />
            </motion.div>
          )}
        </div>

        {rows.length > 0 && (
          <motion.div
            {...rise(0.16, 18)}
            className="grid gap-3.5 text-[13.5px]"
            style={{
              background: `color-mix(in srgb, ${pal.deep} 55%, transparent)`,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: `1px solid ${lineDark}`,
              borderRadius: 18,
              padding: "22px 24px",
              color: pal.cream,
              fontFamily: MINT_BODY,
            }}
          >
            {rows.map((r, i) => (
              <div key={i} className="contents">
                {i === arrowAt && (p.ledgerArrowText || isEditor) && (
                  <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: pal.lime }}>
                    <InlineText as="span" value={p.ledgerArrowText ?? ""} onUpdate={field("ledgerArrowText")} />
                    <i aria-hidden className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${pal.lime}, transparent)` }} />
                  </div>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5" style={{ paddingBottom: i === rows.length - 1 ? 0 : 12, borderBottom: i === rows.length - 1 ? 0 : `1px solid ${lineDark}` }}>
                  <span className="leading-[1.4]" style={{ color: pal.creamMuted }}>
                    <InlineText as="span" value={r.label ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { label: v }) : undefined} />
                  </span>
                  <b className="font-normal tabular-nums" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.5rem", letterSpacing: "-0.03em", lineHeight: 1, color: r.highlight ? pal.lime : pal.cream }}>
                    <InlineText as="span" value={r.value ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { value: v }) : undefined} />
                  </b>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
