import { motion } from "framer-motion";
import type { DsoBentoOutcomesBlockProps, DsoBentoTile } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BlockDsoCta } from "@/components/BlockDsoCta";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const P     = "#003A30";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const MU    = "rgba(255,255,255,0.50)";
const FG    = "#002922";
const FG_MU = "hsl(192,10%,42%)";
const LIGHT_BG = "hsl(0,0%,99%)";

const DEFAULT_TILES: DsoBentoTile[] = [
  { type: "stat",    value: "96%",    label: "First-time right rate", description: "Across all cases, all locations." },
  { type: "photo",   imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&h=700&fit=crop", caption: "U.S.-based manufacturing" },
  { type: "feature", headline: "Enterprise-grade quality at independent-practice speed.", body: "Dandy's AI-driven manufacturing delivers the consistency your DSO demands — without the compromises." },
  { type: "stat",    value: "$0",     label: "CAPEX required",        description: "Premium scanners included at no upfront cost." },
  { type: "quote",   quote: "The efficiency gains were immediate. Our doctors noticed the difference from the very first case.", author: "VP of Clinical Operations, Smile Brands" },
  { type: "stat",    value: "4.2 days", label: "Average turnaround",  description: "Including AI scan review and QC." },
  { type: "photo",   imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=900&h=700&fit=crop", caption: "Expert technicians, every case" },
];

function StatTile({ tile, delay }: { tile: Extract<DsoBentoTile, { type: "stat" }>; delay: number }) {
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
        {tile.value}
      </p>
      <div style={{ width: "1.75rem", height: 2, background: AW, borderRadius: 1, marginBottom: "0.875rem" }} />
      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: PFG, marginBottom: "0.375rem" }}>{tile.label}</p>
      {tile.description && <p style={{ fontSize: "0.8rem", color: MU, lineHeight: 1.5 }}>{tile.description}</p>}
    </motion.div>
  );
}

function PhotoTile({ tile, delay }: { tile: Extract<DsoBentoTile, { type: "photo" }>; delay: number }) {
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
        {tile.caption}
      </p>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${AW}00, ${AW}, ${AW}00)` }} />
    </motion.div>
  );
}

function FeatureTile({ tile, delay }: { tile: Extract<DsoBentoTile, { type: "feature" }>; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: `linear-gradient(135deg, ${AW}18 0%, ${AW}06 100%)`,
        border: `1px solid ${AW}30`,
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
        {tile.headline}
      </h3>
      <p style={{ fontSize: "0.9375rem", color: FG_MU, lineHeight: 1.65 }}>{tile.body}</p>
    </motion.div>
  );
}

function QuoteTile({ tile, delay }: { tile: Extract<DsoBentoTile, { type: "quote" }>; delay: number }) {
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
        color: `${AW}18`, userSelect: "none", pointerEvents: "none",
      }}>
        {"\u201C"}
      </span>
      <p style={{ fontSize: "1rem", lineHeight: 1.7, color: FG, fontStyle: "italic", position: "relative", marginTop: "1.5rem" }}>
        {tile.quote}
      </p>
      <p style={{ marginTop: "1.5rem", fontSize: "0.8125rem", fontWeight: 600, color: AW }}>
        — {tile.author}
      </p>
    </motion.div>
  );
}

function TileSwitch({ tile, delay }: { tile: DsoBentoTile; delay: number }) {
  switch (tile.type) {
    case "stat":     return <StatTile tile={tile} delay={delay} />;
    case "photo":    return <PhotoTile tile={tile} delay={delay} />;
    case "feature":  return <FeatureTile tile={tile} delay={delay} />;
    case "quote":    return <QuoteTile tile={tile} delay={delay} />;
  }
}

interface Props {
  props: DsoBentoOutcomesBlockProps;
  brand: BrandConfig;
}

export function BlockDsoBentoOutcomes({ props, brand }: Props) {
  const {
    eyebrow = "Why Dandy",
    headline = "Every metric that matters. All in one platform.",
    tiles,
    ctaText, ctaUrl, ctaMode = "link", ctaVariant = "primary",
    backgroundStyle = "white",
  } = props;
  const dark = isDarkBg(backgroundStyle ?? "white");
  const displayTiles = tiles && tiles.length > 0 ? tiles : DEFAULT_TILES;

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
              {eyebrow}
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
            {headline}
          </motion.h2>
        </div>

        {/* ── Desktop bento (md+) ── */}
        <div className="hidden md:block">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1rem" }}>
            {displayTiles[0] && (
              <div style={{ gridColumn: "span 3" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[0]} delay={0} /></div>
              </div>
            )}
            {displayTiles[1] && (
              <div style={{ gridColumn: "span 5", gridRow: "span 2" }}>
                <div style={{ height: "100%", minHeight: 580 }}><TileSwitch tile={displayTiles[1]} delay={0.06} /></div>
              </div>
            )}
            {displayTiles[2] && (
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[2]} delay={0.1} /></div>
              </div>
            )}
            {displayTiles[3] && (
              <div style={{ gridColumn: "span 3" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[3]} delay={0.14} /></div>
              </div>
            )}
            {displayTiles[4] && (
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ height: 280 }}><TileSwitch tile={displayTiles[4]} delay={0.18} /></div>
              </div>
            )}
            {displayTiles.slice(5).map((tile, i) => (
              <div key={i + 5} style={{ gridColumn: "span 4" }}>
                <div style={{ height: 280 }}><TileSwitch tile={tile} delay={(i + 5) * 0.06} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mobile: 1-col stack, tablet: 2-col grid ── */}
        <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayTiles.slice(0, 6).map((tile, i) => (
            <div key={i} style={{ height: 260 }}>
              <TileSwitch tile={tile} delay={i * 0.06} />
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
            <BlockDsoCta ctaText={ctaText} ctaUrl={ctaUrl} ctaMode={ctaMode} ctaVariant={ctaVariant} brand={brand} dark={dark} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
