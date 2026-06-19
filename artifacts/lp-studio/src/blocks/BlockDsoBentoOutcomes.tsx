import { motion } from "framer-motion";
import type { DsoBentoOutcomesBlockProps, DsoBentoTile } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BlockDsoCta } from "@/components/BlockDsoCta";
import { InlineText } from "@/components/InlineText";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

import { BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const DISPLAY_FONT = BRAND_DISPLAY_STACK;

const P     = "var(--brand-primary, #0f172a)";
const PFG   = "hsl(48,100%,96%)";
const AW    = "var(--brand-accent, hsl(68,60%,52%))";
const MU    = "rgba(255,255,255,0.50)";
const FG    = "#002922";
const FG_MU = "hsl(192,10%,42%)";
const LIGHT_BG = "hsl(0,0%,99%)";

// Neutral component-level fallback. Catalog default_props (industry='generic')
// supplies tiles for catalog-added blocks; this fallback only fires for
// isolated previews or when no catalog row matches.
const DEFAULT_TILES: DsoBentoTile[] = [
  { type: "stat",    value: "73%",    label: "Less manual work",      description: "Across teams and locations." },
  { type: "feature", headline: "Native integrations",                 body: "Works with the tools you already use." },
  { type: "stat",    value: "10x",    label: "Faster onboarding",     description: "From multi-week rollouts to same-day." },
  { type: "quote",   quote: "Best ROI we've ever booked.",            author: "Priya, VP Ops" },
  { type: "feature", headline: "Audit-ready",                         body: "SOC 2, HIPAA, GDPR — all out of the box." },
  { type: "stat",    value: "4.9★",   label: "G2 rating",             description: "From 800+ verified reviews." },
];

function StatTile({ tile, delay, onUpdate }: { tile: Extract<DsoBentoTile, { type: "stat" }>; delay: number; onUpdate?: (patch: Partial<Extract<DsoBentoTile, { type: "stat" }>>) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: P,
        borderRadius: "1.25rem",
        padding: "2.25rem 2rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        position: "relative",
        overflow: "hidden",
        height: "100%",
        cursor: "default",
      }}
      className="group"
    >
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: "rgba(154,184,54,0.07)",
        pointerEvents: "none", transition: "transform 0.5s",
      }} className="group-hover:scale-125" />
      <p style={{
        fontFamily: DISPLAY_FONT,
        fontSize: "clamp(2.5rem,5vw,3.75rem)",
        fontWeight: 700,
        color: PFG,
        letterSpacing: "-0.05em",
        lineHeight: 1,
        marginBottom: "0.75rem",
        position: "relative",
      }}>
        <InlineText as="span" value={tile.value} onUpdate={onUpdate ? (v) => onUpdate({ value: v }) : undefined} />
      </p>
      <div style={{ width: "1.75rem", height: 2, background: AW, borderRadius: 1, marginBottom: "0.875rem" }} />
      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: PFG, marginBottom: "0.375rem" }}>
        <InlineText as="span" value={tile.label} onUpdate={onUpdate ? (v) => onUpdate({ label: v }) : undefined} />
      </p>
      {(tile.description || onUpdate) && (
        <p style={{ fontSize: "0.8rem", color: MU, lineHeight: 1.5 }}>
          <InlineText as="span" value={tile.description ?? ""} onUpdate={onUpdate ? (v) => onUpdate({ description: v }) : undefined} multiline />
        </p>
      )}
    </motion.div>
  );
}

function PhotoTile({ tile, delay, onUpdate }: { tile: Extract<DsoBentoTile, { type: "photo" }>; delay: number; onUpdate?: (patch: Partial<Extract<DsoBentoTile, { type: "photo" }>>) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ borderRadius: "1.25rem", overflow: "hidden", position: "relative", height: "100%", minHeight: 220, cursor: "default" }}
      className="group"
    >
      <img
        src={tile.imageUrl}
        alt={tile.caption}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)" }}
        className="group-hover:scale-105"
        loading="lazy"
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.60) 100%)" }} />
      <p style={{ position: "absolute", bottom: "1.25rem", left: "1.5rem", right: "1.5rem", fontSize: "0.8125rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>
        <InlineText as="span" value={tile.caption} onUpdate={onUpdate ? (v) => onUpdate({ caption: v }) : undefined} />
      </p>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, rgb(var(--brand-accent-rgb, 59 130 246) / 0), ${AW}, rgb(var(--brand-accent-rgb, 59 130 246) / 0))` }} />
    </motion.div>
  );
}

function FeatureTile({ tile, delay, onUpdate }: { tile: Extract<DsoBentoTile, { type: "feature" }>; delay: number; onUpdate?: (patch: Partial<Extract<DsoBentoTile, { type: "feature" }>>) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: `linear-gradient(135deg, rgb(var(--brand-accent-rgb, 59 130 246) / 0.094) 0%, rgb(var(--brand-accent-rgb, 59 130 246) / 0.024) 100%)`,
        border: `1px solid rgb(var(--brand-accent-rgb, 59 130 246) / 0.188)`,
        borderRadius: "1.25rem",
        padding: "2.5rem 2.25rem",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        cursor: "default",
      }}
    >
      <div style={{ width: "2rem", height: 3, background: AW, borderRadius: 1, marginBottom: "1.75rem" }} />
      <h3 style={{
        fontFamily: DISPLAY_FONT,
        fontSize: "clamp(1.125rem,2.5vw,1.625rem)",
        fontWeight: 600,
        color: FG,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        marginBottom: "1rem",
      }}>
        <InlineText as="span" value={tile.headline} onUpdate={onUpdate ? (v) => onUpdate({ headline: v }) : undefined} multiline />
      </h3>
      <p style={{ fontSize: "0.9375rem", color: FG_MU, lineHeight: 1.65 }}>
        <InlineText as="span" value={tile.body} onUpdate={onUpdate ? (v) => onUpdate({ body: v }) : undefined} multiline />
      </p>
    </motion.div>
  );
}

function QuoteTile({ tile, delay, onUpdate }: { tile: Extract<DsoBentoTile, { type: "quote" }>; delay: number; onUpdate?: (patch: Partial<Extract<DsoBentoTile, { type: "quote" }>>) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: "white",
        border: "1px solid rgba(0,0,0,0.06)",
        borderBottom: `3px solid ${AW}`,
        borderRadius: "1.25rem",
        padding: "2.5rem 2rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.04), 0 20px 48px rgba(0,0,0,0.07)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "default",
        position: "relative",
      }}
    >
      <span style={{
        position: "absolute", top: "1rem", left: "1.5rem",
        fontFamily: "Georgia, serif", fontSize: "5rem", lineHeight: 1,
        color: `rgb(var(--brand-accent-rgb, 59 130 246) / 0.094)`, userSelect: "none", pointerEvents: "none",
      }}>
        {"\u201C"}
      </span>
      <p style={{ fontSize: "1rem", lineHeight: 1.7, color: FG, fontStyle: "italic", position: "relative", marginTop: "1.5rem" }}>
        <InlineText as="span" value={tile.quote} onUpdate={onUpdate ? (v) => onUpdate({ quote: v }) : undefined} multiline />
      </p>
      <p style={{ marginTop: "1.5rem", fontSize: "0.8125rem", fontWeight: 600, color: AW }}>
        — <InlineText as="span" value={tile.author} onUpdate={onUpdate ? (v) => onUpdate({ author: v }) : undefined} />
      </p>
    </motion.div>
  );
}

function TileSwitch({ tile, delay, onUpdate }: { tile: DsoBentoTile; delay: number; onUpdate?: (patch: Partial<DsoBentoTile>) => void }) {
  switch (tile.type) {
    case "stat":     return <StatTile tile={tile} delay={delay} onUpdate={onUpdate as ((patch: Partial<Extract<DsoBentoTile, { type: "stat" }>>) => void) | undefined} />;
    case "photo":    return <PhotoTile tile={tile} delay={delay} onUpdate={onUpdate as ((patch: Partial<Extract<DsoBentoTile, { type: "photo" }>>) => void) | undefined} />;
    case "feature":  return <FeatureTile tile={tile} delay={delay} onUpdate={onUpdate as ((patch: Partial<Extract<DsoBentoTile, { type: "feature" }>>) => void) | undefined} />;
    case "quote":    return <QuoteTile tile={tile} delay={delay} onUpdate={onUpdate as ((patch: Partial<Extract<DsoBentoTile, { type: "quote" }>>) => void) | undefined} />;
  }
}

interface Props {
  props: DsoBentoOutcomesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoBentoOutcomesBlockProps) => void;
}

export function BlockDsoBentoOutcomes({ props, brand, onFieldChange }: Props) {
  const {
    eyebrow = "Outcomes",
    headline = "Every metric that matters. All in one platform.",
    tiles,
    ctaText, ctaUrl, ctaMode = "link", ctaVariant = "primary",
    backgroundStyle = "white",
  } = props;
  const field = (key: keyof DsoBentoOutcomesBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoBentoOutcomesBlockProps[typeof key] }) : undefined;
  const dark = resolveSectionSurface({ backgroundStyle: backgroundStyle ?? "white" }, "#ffffff", brand).isDark;
  const displayTiles: DsoBentoTile[] = tiles && tiles.length > 0 ? tiles : DEFAULT_TILES;
  const updateTile = onFieldChange
    ? (idx: number, patch: Partial<DsoBentoTile>) => {
        const next = displayTiles.slice();
        next[idx] = { ...next[idx], ...patch } as DsoBentoTile;
        onFieldChange({ ...props, tiles: next });
      }
    : undefined;

  return (
    <section style={{ ...getBgStyle(backgroundStyle) }} className="py-24 md:py-32">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "3.5rem" }}>
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: AW, marginBottom: "1.25rem" }}
            >
              <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} />
            </motion.p>
          )}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2rem,4vw,3.25rem)",
              lineHeight: 1.1,
              fontWeight: 600,
              color: FG,
              letterSpacing: "-0.02em",
              maxWidth: 640,
            }}
          >
            <InlineText as="span" value={headline} onUpdate={field("headline")} multiline />
          </motion.h2>
        </div>

        {/* ── Desktop bento (md+) ── */}
        <div className="hidden md:block">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1rem" }}>
            {displayTiles[0] && (
              <div style={{ gridColumn: "span 3" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[0]} delay={0} onUpdate={updateTile ? (p) => updateTile(0, p) : undefined} /></div>
              </div>
            )}
            {displayTiles[1] && (
              <div style={{ gridColumn: "span 5", gridRow: "span 2" }}>
                <div style={{ height: "100%", minHeight: 580 }}><TileSwitch tile={displayTiles[1]} delay={0.06} onUpdate={updateTile ? (p) => updateTile(1, p) : undefined} /></div>
              </div>
            )}
            {displayTiles[2] && (
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[2]} delay={0.1} onUpdate={updateTile ? (p) => updateTile(2, p) : undefined} /></div>
              </div>
            )}
            {displayTiles[3] && (
              <div style={{ gridColumn: "span 3" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[3]} delay={0.14} onUpdate={updateTile ? (p) => updateTile(3, p) : undefined} /></div>
              </div>
            )}
            {displayTiles[4] && (
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[4]} delay={0.18} onUpdate={updateTile ? (p) => updateTile(4, p) : undefined} /></div>
              </div>
            )}
            {displayTiles.slice(5).map((tile, i) => (
              <div key={i + 5} style={{ gridColumn: "span 4" }}>
                <div style={{ height: 280 }}><TileSwitch tile={tile} delay={(i + 5) * 0.06} onUpdate={updateTile ? (p) => updateTile(i + 5, p) : undefined} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mobile: 1-col stack, tablet: 2-col grid ── */}
        <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayTiles.slice(0, 6).map((tile, i) => (
            <div key={i} style={{ height: 260 }}>
              <TileSwitch tile={tile} delay={i * 0.06} onUpdate={updateTile ? (p) => updateTile(i, p) : undefined} />
            </div>
          ))}
        </div>

        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center", marginTop: "3rem" }}
          >
            <BlockDsoCta
              ctaText={ctaText}
              ctaUrl={ctaUrl}
              ctaMode={ctaMode}
              ctaVariant={ctaVariant}
              brand={brand}
              dark={dark}
              source="dso-bento-outcomes"
              modalChilipiperUrl={props.modalChilipiperUrl}
              modalFormSource={props.modalFormSource}
              modalFormId={props.modalFormId}
              modalMarketoBaseUrl={props.modalMarketoBaseUrl}
              modalMarketoMunchkinId={props.modalMarketoMunchkinId}
              modalMarketoFormId={props.modalMarketoFormId}
              modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
              modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
              modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
              modalHeadline={props.modalHeadline}
              modalSubheadline={props.modalSubheadline}
              modalSubmitText={props.modalSubmitText}
              modalSuccessMessage={props.modalSuccessMessage}
              modalDisclaimer={props.modalDisclaimer}
              modalShowFirstName={props.modalShowFirstName}
              modalShowLastName={props.modalShowLastName}
              modalShowPhone={props.modalShowPhone}
              modalShowCompany={props.modalShowCompany}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
