import { motion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_SECTION_PAD, MINT_WRAP,
  MintLink, MintNumber, mintAnchorClick, mintDisplay, mintSub, resolveMintPalette, useMintReveal,
  type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Proof — type "mint-proof"  (DSO Page (Light) family, Nov 2026)
 *
 * "The numbers groups ask for first": a centred display h2 (optional sub),
 * then three tinted rounded-20 cards — mint, soft lime, deep green — each
 * with a small muted `who` line, a big count-up number in the display face,
 * a short 28ch paragraph and a quiet chevron link. Cards lift 3px on hover.
 * The deep card flips to cream ink with a lime link. White band by default.
 * -------------------------------------------------------------------------- */

export type MintProofTint = "grey" | "mint" | "lime" | "deep";

export interface MintProofCard {
  /** Small muted line above the number ("Northwind Health"). */
  company: string;
  /** The big number; counts up on the live page. */
  value: string;
  /** Short paragraph under the number (max 28ch wide). */
  text: string;
  /** Card surface: pale grey, mint, soft lime, or the deep brand green with cream ink. */
  tint: MintProofTint;
  linkText?: string;
  linkUrl?: string;
}

export interface MintProofBlockProps extends MintStyleProps {
  headline: string;
  subheadline?: string;
  /** 2–4 cards. */
  cards: MintProofCard[];
  anchorId?: string;
}

interface Props {
  props: MintProofBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintProofBlockProps) => void;
}

export const MINT_PROOF_DEFAULT_PROPS: MintProofBlockProps = {
  headline: "The numbers groups ask for first.",
  subheadline: "",
  cards: [
    {
      company: "Northwind Dental Partners",
      value: "400+",
      text: "suppliers consolidated onto one platform, across tens of millions in lab spend. Doctors chose it; nobody mandated it.",
      tint: "mint",
      linkText: "Read the story",
      linkUrl: "#",
    },
    {
      company: "Summit Dental Alliance",
      value: "29%",
      text: "fewer remakes, 100+ labs reduced to about ten, denture appointments cut in half.",
      tint: "lime",
      linkText: "Read the story",
      linkUrl: "#",
    },
    {
      company: "Meridian Oral Health",
      value: "10K+",
      text: "appointments recaptured with two-appointment dentures across a mobile network.",
      tint: "deep",
      linkText: "Read the story",
      linkUrl: "#",
    },
  ],
  anchorId: "proof",
  backgroundStyle: "white",
};

/** The inks a card carries for its tint. The light tints are always light, so their ink is the light-surface pair even on a dark band. */
function cardInks(tint: MintProofTint, pal: MintPalette) {
  if (tint === "deep") {
    return { bg: pal.green, ink: pal.cream, muted: pal.creamMuted, link: pal.lime };
  }
  const bg = tint === "mint" ? pal.mint : tint === "lime" ? pal.limeSoft : pal.grey;
  return {
    bg,
    ink: pal.dark ? "#1D1D1F" : pal.ink,
    muted: pal.dark ? "#6E6E73" : pal.inkMuted,
    link: pal.green,
  };
}

export function BlockMintProof({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_PROOF_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useMintReveal<HTMLElement>();

  const cards = (p.cards ?? []).filter((c) => c.value?.trim() || c.company?.trim() || isEditor).slice(0, 4);
  const field = (key: keyof MintProofBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintProofBlockProps[typeof key] }) : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<MintProofCard>) => onFieldChange({ ...props, cards: (p.cards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  const gridCols = cards.length === 2
    ? "min-[800px]:grid-cols-2"
    : cards.length === 4
      ? "min-[800px]:grid-cols-2 min-[1100px]:grid-cols-4"
      : "min-[800px]:grid-cols-3";

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-proof"
      className="mint-proof relative"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <div className={MINT_WRAP}>
        <div className="text-center">
          {(p.headline || isEditor) && (
            <motion.h2 {...rise(0, 18)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", pal.ink)}>
              <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
            </motion.h2>
          )}
          {(p.subheadline || isEditor) && (
            <motion.p {...rise(0.08, 18)} className="mx-auto" style={mintSub(pal.inkMuted)}>
              <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
        </div>

        {cards.length > 0 && (
          <div className={cn("grid gap-11 min-[800px]:gap-10", gridCols)} style={{ marginTop: "clamp(40px, 5vw, 64px)" }}>
            {cards.map((c, i) => {
              const tint: MintProofTint = c.tint === "grey" || c.tint === "lime" || c.tint === "deep" ? c.tint : "mint";
              const ink = cardInks(tint, pal);
              return (
                <motion.div key={i} {...rise(0.1 + i * 0.08, 18)} className="flex min-w-0">
                  <div
                    className="mint-card w-full min-w-0 rounded-[20px]"
                    style={{ background: ink.bg, color: ink.ink, padding: "28px 26px 26px" }}
                    data-tint={tint}
                  >
                    {(c.company || isEditor) && (
                      <p className="m-0 text-[13px] font-medium" style={{ color: ink.muted }}>
                        <InlineText as="span" value={c.company ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { company: v }) : undefined} />
                      </p>
                    )}
                    <MintNumber
                      value={c.value}
                      onUpdate={updateCard ? (v) => updateCard(i, { value: v }) : undefined}
                      className="mt-[18px] block"
                      style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(3rem, 5.5vw, 4.6rem)", lineHeight: 0.95, letterSpacing: "-0.04em", color: ink.ink }}
                    />
                    {(c.text || isEditor) && (
                      <p className="mt-4 max-w-[28ch] text-[16px] leading-[1.45]" style={{ color: tint === "deep" ? ink.muted : ink.ink, margin: "16px 0 0" }}>
                        <InlineText as="span" value={c.text ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { text: v }) : undefined} multiline />
                      </p>
                    )}
                    {(c.linkText || isEditor) && (
                      <MintLink
                        href={c.linkUrl || "#"}
                        color={ink.link}
                        size={15}
                        style={{ marginTop: 14 }}
                        onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(c.linkUrl)}
                      >
                        <InlineText as="span" value={c.linkText ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { linkText: v }) : undefined} />
                      </MintLink>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
