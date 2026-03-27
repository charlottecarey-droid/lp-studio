import { motion } from "framer-motion";
import type { DsoBentoOutcomesBlockProps, DsoBentoTile } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const P   = "hsl(152,42%,12%)";
const PFG = "hsl(48,100%,96%)";
const AW  = "hsl(68,60%,52%)";
const MU  = "rgba(255,255,255,0.50)";
const FG  = "hsl(152,30%,10%)";
const FG_MU = "hsl(192,10%,42%)";
const LIGHT_BG = "hsl(0,0%,99%)";

const DEFAULT_TILES: DsoBentoTile[] = [
  {
    type: "stat",
    value: "96%",
    label: "First-time right rate",
    description: "Across all cases, all locations.",
  },
  {
    type: "photo",
    imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&h=700&fit=crop",
    caption: "U.S.-based manufacturing facilities",
  },
  {
    type: "feature",
    headline: "Enterprise-grade quality at independent-practice speed.",
    body: "Dandy's AI-driven manufacturing delivers the consistency your DSO demands — without the compromises.",
  },
  {
    type: "stat",
    value: "$0",
    label: "CAPEX required",
    description: "Premium scanners included in every office.",
  },
  {
    type: "quote",
    quote: "The efficiency gains were immediate. Our doctors noticed the difference from the very first case.",
    author: "VP of Clinical Operations, Smile Brands",
  },
  {
    type: "stat",
    value: "4.2 days",
    label: "Average turnaround",
    description: "Including AI scan review and QC.",
  },
  {
    type: "photo",
    imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=900&h=700&fit=crop",
    caption: "Expert technicians, every case",
  },
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
      {/* Subtle glow */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `rgba(154,184,54,0.07)`,
          pointerEvents: "none",
          transition: "transform 0.5s",
        }}
        className="group-hover:scale-125"
      />
      <p
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(2.75rem,5vw,4rem)",
          fontWeight: 700,
          color: PFG,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          marginBottom: "0.75rem",
          position: "relative",
        }}
      >
        {tile.value}
      </p>
      <div style={{ width: "1.75rem", height: 2, background: AW, borderRadius: 1, marginBottom: "0.875rem" }} />
      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: PFG, marginBottom: "0.375rem" }}>
        {tile.label}
      </p>
      {tile.description && (
        <p style={{ fontSize: "0.8rem", color: MU, lineHeight: 1.5 }}>
          {tile.description}
        </p>
      )}
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
      style={{
        borderRadius: "1.25rem",
        overflow: "hidden",
        position: "relative",
        height: "100%",
        minHeight: 220,
        cursor: "default",
      }}
      className="group"
    >
      <img
        src={tile.imageUrl}
        alt={tile.caption}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
        }}
        className="group-hover:scale-105"
        loading="lazy"
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.60) 100%)",
        }}
      />
      <p
        style={{
          position: "absolute",
          bottom: "1.25rem",
          left: "1.5rem",
          right: "1.5rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: "0.04em",
        }}
      >
        {tile.caption}
      </p>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${AW}00, ${AW}, ${AW}00)`,
        }}
      />
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
      <h3
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(1.25rem,2.5vw,1.75rem)",
          fontWeight: 600,
          color: FG,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          marginBottom: "1rem",
        }}
      >
        {tile.headline}
      </h3>
      <p style={{ fontSize: "0.9375rem", color: FG_MU, lineHeight: 1.65 }}>
        {tile.body}
      </p>
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
      {/* Decorative quote mark */}
      <span
        style={{
          position: "absolute",
          top: "1rem",
          left: "1.5rem",
          fontFamily: "Georgia, serif",
          fontSize: "5rem",
          lineHeight: 1,
          color: `${AW}18`,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {"\u201C"}
      </span>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: 1.7,
          color: FG,
          fontStyle: "italic",
          position: "relative",
          marginTop: "1.5rem",
        }}
      >
        {tile.quote}
      </p>
      <p style={{ marginTop: "1.5rem", fontSize: "0.8125rem", fontWeight: 600, color: AW }}>
        — {tile.author}
      </p>
    </motion.div>
  );
}

interface Props {
  props: DsoBentoOutcomesBlockProps;
}

export function BlockDsoBentoOutcomes({ props }: Props) {
  const {
    eyebrow = "Why Dandy",
    headline = "Every metric that matters. All in one platform.",
    tiles,
  } = props;

  const displayTiles = tiles && tiles.length > 0 ? tiles : DEFAULT_TILES;

  return (
    <section
      style={{ background: LIGHT_BG }}
      className="py-24 md:py-32"
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "3.5rem" }}>
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: AW,
                marginBottom: "1.25rem",
              }}
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

        {/* Bento grid — CSS Grid with template areas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gridTemplateRows: "auto",
            gap: "1rem",
          }}
        >
          {/* Tile 0: Stat (3 cols, 1 row) */}
          {displayTiles[0] && (
            <div style={{ gridColumn: "span 3" }}>
              <div style={{ height: 280 }}>
                {displayTiles[0].type === "stat" && <StatTile tile={displayTiles[0]} delay={0} />}
                {displayTiles[0].type === "photo" && <PhotoTile tile={displayTiles[0]} delay={0} />}
                {displayTiles[0].type === "feature" && <FeatureTile tile={displayTiles[0]} delay={0} />}
                {displayTiles[0].type === "quote" && <QuoteTile tile={displayTiles[0]} delay={0} />}
              </div>
            </div>
          )}

          {/* Tile 1: Photo (5 cols, 2 rows) */}
          {displayTiles[1] && (
            <div style={{ gridColumn: "span 5", gridRow: "span 2" }}>
              <div style={{ height: "100%", minHeight: 580 }}>
                {displayTiles[1].type === "photo" && <PhotoTile tile={displayTiles[1]} delay={0.06} />}
                {displayTiles[1].type === "stat" && <StatTile tile={displayTiles[1]} delay={0.06} />}
                {displayTiles[1].type === "feature" && <FeatureTile tile={displayTiles[1]} delay={0.06} />}
                {displayTiles[1].type === "quote" && <QuoteTile tile={displayTiles[1]} delay={0.06} />}
              </div>
            </div>
          )}

          {/* Tile 2: Feature (4 cols, 1 row) */}
          {displayTiles[2] && (
            <div style={{ gridColumn: "span 4" }}>
              <div style={{ height: 280 }}>
                {displayTiles[2].type === "feature" && <FeatureTile tile={displayTiles[2]} delay={0.1} />}
                {displayTiles[2].type === "stat" && <StatTile tile={displayTiles[2]} delay={0.1} />}
                {displayTiles[2].type === "photo" && <PhotoTile tile={displayTiles[2]} delay={0.1} />}
                {displayTiles[2].type === "quote" && <QuoteTile tile={displayTiles[2]} delay={0.1} />}
              </div>
            </div>
          )}

          {/* Tile 3: Stat (3 cols, 1 row) — second row left */}
          {displayTiles[3] && (
            <div style={{ gridColumn: "span 3" }}>
              <div style={{ height: 280 }}>
                {displayTiles[3].type === "stat" && <StatTile tile={displayTiles[3]} delay={0.14} />}
                {displayTiles[3].type === "photo" && <PhotoTile tile={displayTiles[3]} delay={0.14} />}
                {displayTiles[3].type === "feature" && <FeatureTile tile={displayTiles[3]} delay={0.14} />}
                {displayTiles[3].type === "quote" && <QuoteTile tile={displayTiles[3]} delay={0.14} />}
              </div>
            </div>
          )}

          {/* Tile 4: Quote (4 cols, 1 row) — second row right */}
          {displayTiles[4] && (
            <div style={{ gridColumn: "span 4" }}>
              <div style={{ height: 280 }}>
                {displayTiles[4].type === "quote" && <QuoteTile tile={displayTiles[4]} delay={0.18} />}
                {displayTiles[4].type === "stat" && <StatTile tile={displayTiles[4]} delay={0.18} />}
                {displayTiles[4].type === "photo" && <PhotoTile tile={displayTiles[4]} delay={0.18} />}
                {displayTiles[4].type === "feature" && <FeatureTile tile={displayTiles[4]} delay={0.18} />}
              </div>
            </div>
          )}

          {/* Tiles 5+ if provided: auto-placed in 4-col chunks */}
          {displayTiles.slice(5).map((tile, i) => (
            <div key={i + 5} style={{ gridColumn: "span 4" }}>
              <div style={{ height: 280 }}>
                {tile.type === "stat" && <StatTile tile={tile} delay={(i + 5) * 0.06} />}
                {tile.type === "photo" && <PhotoTile tile={tile} delay={(i + 5) * 0.06} />}
                {tile.type === "feature" && <FeatureTile tile={tile} delay={(i + 5) * 0.06} />}
                {tile.type === "quote" && <QuoteTile tile={tile} delay={(i + 5) * 0.06} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
