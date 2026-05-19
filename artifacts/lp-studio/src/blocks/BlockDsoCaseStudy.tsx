import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoCaseStudyBlockProps, DsoCaseStudyBodySection, DsoCaseStudyResultItem } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

interface Props {
  props: DsoCaseStudyBlockProps;
  onFieldChange?: (updated: DsoCaseStudyBlockProps) => void;
}

const AW = "var(--brand-accent, hsl(68,60%,52%))";
const FG = "hsl(152,40%,13%)";
const MU = "hsl(152,8%,48%)";
import { BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const DISPLAY_FONT = BRAND_DISPLAY_STACK;

// Neutral component-level fallback. Catalog default_props (industry='generic')
// supplies the case-study content for catalog-added blocks; this fires only
// for isolated previews or when no catalog row matches.
const DEFAULT_STATS = [
  { value: "60%",   label: "Fewer manual touchpoints" },
  { value: "9,600", label: "Hours reclaimed annually" },
  { value: "$2.5M", label: "Hard cost savings" },
  { value: "$9.2M", label: "Total annualized value" },
];

const DEFAULT_CHALLENGE: DsoCaseStudyBodySection = {
  heading: "The Challenge",
  body: "A fast-growing 45-site organization was running a hybrid model — part manual, part digital — across their core workflow. Each request consumed multiple touchpoints, tying up time and staff. With rising labor costs and surging demand, the team needed a way to scale without proportionally scaling headcount.",
};

const DEFAULT_SOLUTION: DsoCaseStudyBodySection = {
  heading: "The Solution",
  body: "The team partnered with us to standardize the workflow across all 45 sites. We replaced manual handoffs with an automated, AI-assisted pipeline. A phased rollout starting with 10 pilot sites allowed the operations team to validate outcomes before scaling system-wide.",
};

const DEFAULT_QUOTE = "It didn't just improve our turnaround — it gave us our schedule back. We cut touchpoints by more than half and our team can't believe how fast and reliable the process is now.";

const DEFAULT_RESULTS: DsoCaseStudyResultItem[] = [
  {
    value: "1.6",
    label: "Avg. touchpoints per request",
    description: "Down from 4.0 in the prior workflow — a 60% reduction",
  },
  {
    value: "9,600",
    label: "Hours freed annually",
    description: "Time recaptured for higher-value work across all 45 sites",
  },
  {
    value: "$2.5M",
    label: "Hard cost savings",
    description: "From reduced rework, vendor consolidation, and lower COGS",
  },
  {
    value: "$9.2M",
    label: "Total annualized value",
    description: "Including reclaimed time valued at market rate across the network",
  },
];

const DEFAULT_WHY: DsoCaseStudyBodySection = {
  heading: "Why It Matters",
  body: "The biggest gains don't come from technology alone — they come from standardizing the workflow across every site, then letting the data compound. For a 45-site organization, recapturing thousands of hours per year isn't an operational win — it's a revenue transformation.",
};

export function BlockDsoCaseStudy({ props, onFieldChange }: Props) {
  const fallback = props.backgroundStyle ?? "white";
  const heroBg    = props.heroBackgroundStyle    ?? fallback;
  const bodyBg    = props.bodyBackgroundStyle    ?? fallback;
  const resultsBg = props.resultsBackgroundStyle ?? fallback;

  const heroDark    = isDarkBg(heroBg);
  const bodyDark    = isDarkBg(bodyBg);
  const resultsDark = isDarkBg(resultsBg);

  const eyebrow     = props.eyebrow     ?? "Customer Story";
  const headline    = props.headline    ?? "How a 45-site organization cut touchpoints in half and reclaimed 9,600 hours";
  const subheadline = props.subheadline ?? "A multi-site rollout that standardized the workflow, unlocking $9.2M in annualized value.";
  const stats       = props.stats       ?? DEFAULT_STATS;
  const challenge   = props.challenge   ?? DEFAULT_CHALLENGE;
  const solution    = props.solution    ?? DEFAULT_SOLUTION;
  const quote       = props.quote       ?? DEFAULT_QUOTE;
  const results     = props.results     ?? DEFAULT_RESULTS;
  const whyItMatters = props.whyItMatters ?? DEFAULT_WHY;
  const heroOnly    = props.heroOnly    ?? false;

  const upd = onFieldChange
    ? (patch: Partial<DsoCaseStudyBlockProps>) => onFieldChange({ ...props, ...patch })
    : undefined;

  const updSection = (key: "challenge" | "solution" | "whyItMatters", field: keyof DsoCaseStudyBodySection, val: string) => {
    if (!upd) return;
    const existing = props[key] ?? (key === "challenge" ? DEFAULT_CHALLENGE : key === "solution" ? DEFAULT_SOLUTION : DEFAULT_WHY);
    upd({ [key]: { ...existing, [field]: val } });
  };

  const updStat = (i: number, field: "value" | "label", val: string) => {
    if (!upd) return;
    const next = stats.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    upd({ stats: next });
  };

  const updResult = (i: number, field: keyof DsoCaseStudyResultItem, val: string) => {
    if (!upd) return;
    const next = results.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    upd({ results: next });
  };

  const heroStatDivider = heroDark ? "rgba(255,255,255,0.10)" : "rgb(var(--brand-primary-rgb, 0 58 48) / 0.10)";
  const bodyDivider     = bodyDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)";
  const resDivider      = resultsDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)";

  return (
    <>
      {/* ── Section 1: Hero ─────────────────────────────────────────── */}
      <section style={{ ...getBgStyle(heroBg), position: "relative" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "4rem 1.5rem 0" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: "3rem" }}
          >
            <InlineText
              as="p"
              value={eyebrow}
              onUpdate={upd ? (v) => upd({ eyebrow: v }) : undefined}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: heroDark ? AW : FG,
                marginBottom: "1rem",
                display: "block",
              }}
            />
            <InlineText
              as="h1"
              value={headline}
              onUpdate={upd ? (v) => upd({ headline: v }) : undefined}
              multiline
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(1.75rem,4vw,2.75rem)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                color: heroDark ? "#fff" : FG,
                marginBottom: "1.25rem",
                display: "block",
              }}
            />
            <InlineText
              as="p"
              value={subheadline}
              onUpdate={upd ? (v) => upd({ subheadline: v }) : undefined}
              multiline
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.7,
                color: heroDark ? "rgba(255,255,255,0.60)" : MU,
                maxWidth: 680,
                display: "block",
              }}
            />
          </motion.div>

          {/* Stat Bar */}
          <div
            style={{
              borderTop: `1px solid ${heroStatDivider}`,
              borderBottom: `1px solid ${heroStatDivider}`,
            }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {stats.map((stat, i) => (
                <StatCell
                  key={i}
                  stat={stat}
                  i={i}
                  dark={heroDark}
                  divider={heroStatDivider}
                  total={stats.length}
                  onUpdateValue={upd ? (v) => updStat(i, "value", v) : undefined}
                  onUpdateLabel={upd ? (v) => updStat(i, "label", v) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Body (Challenge + Solution + Quote) ──────────── */}
      {!heroOnly && <section style={{ ...getBgStyle(bodyBg), position: "relative" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
          <BodySection
            section={challenge}
            dark={bodyDark}
            onUpdateHeading={upd ? (v) => updSection("challenge", "heading", v) : undefined}
            onUpdateBody={upd ? (v) => updSection("challenge", "body", v) : undefined}
            onUpdateImage={upd ? (v) => updSection("challenge", "imageUrl", v) : undefined}
          />
          <BodySection
            section={solution}
            dark={bodyDark}
            onUpdateHeading={upd ? (v) => updSection("solution", "heading", v) : undefined}
            onUpdateBody={upd ? (v) => updSection("solution", "body", v) : undefined}
            onUpdateImage={upd ? (v) => updSection("solution", "imageUrl", v) : undefined}
          />
          <div style={{ height: 1, background: bodyDivider, marginBottom: "3rem" }} />
          <PullQuote
            quote={quote}
            dark={bodyDark}
            onUpdate={upd ? (v) => upd({ quote: v }) : undefined}
          />
        </div>
      </section>}

      {/* ── Section 3: Results + Why It Matters ─────────────────────── */}
      {!heroOnly && <section style={{ ...getBgStyle(resultsBg), position: "relative" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "3.5rem 1.5rem 5rem" }}>
          <ResultsGrid
            results={results}
            dark={resultsDark}
            imageUrl={props.resultsImageUrl}
            onUpdateResult={upd ? updResult : undefined}
            onUpdateImage={upd ? (v) => upd({ resultsImageUrl: v || undefined }) : undefined}
          />
          <div style={{ marginTop: "3.5rem" }}>
            <div style={{ height: 1, background: resDivider, marginBottom: "3rem" }} />
            <BodySection
              section={whyItMatters}
              dark={resultsDark}
              onUpdateHeading={upd ? (v) => updSection("whyItMatters", "heading", v) : undefined}
              onUpdateBody={upd ? (v) => updSection("whyItMatters", "body", v) : undefined}
              onUpdateImage={upd ? (v) => updSection("whyItMatters", "imageUrl", v) : undefined}
            />
          </div>

          {/* ── CTA ──────────────────────────────────────────────── */}
          {props.ctaText && props.ctaUrl && (() => {
            const variant = props.ctaVariant ?? "primary";
            const dark = resultsDark;
            const btnStyle: React.CSSProperties =
              variant === "primary"
                ? { display: "inline-flex", alignItems: "center", gap: "0.5rem", background: AW, color: FG, fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: "0.9375rem", padding: "0.75rem 2rem", borderRadius: "0.5rem", textDecoration: "none", cursor: "pointer", border: "none" }
                : variant === "secondary"
                ? { display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "transparent", color: dark ? "#fff" : FG, fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem 2rem", borderRadius: "0.5rem", textDecoration: "none", cursor: "pointer", border: `2px solid ${dark ? "rgba(255,255,255,0.4)" : FG}` }
                : { display: "inline-flex", alignItems: "center", gap: "0.375rem", background: "none", color: dark ? AW : FG, fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: "1rem", textDecoration: "none", cursor: "pointer", border: "none", padding: 0 };

            return (
              <div style={{ marginTop: "3rem", textAlign: "center" }}>
                {props.ctaMode === "chilipiper" ? (
                  <ChiliPiperButton url={props.ctaUrl!} style={btnStyle}>
                    {props.ctaText}{variant === "link" && " →"}
                  </ChiliPiperButton>
                ) : (
                  <motion.a
                    href={props.ctaUrl}
                    style={btnStyle}
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {props.ctaText}{variant === "link" && " →"}
                  </motion.a>
                )}
              </div>
            );
          })()}
        </div>
      </section>}
    </>
  );
}

function BodySection({
  section,
  dark,
  onUpdateHeading,
  onUpdateBody,
  onUpdateImage,
}: {
  section: DsoCaseStudyBodySection;
  dark: boolean;
  onUpdateHeading?: (v: string) => void;
  onUpdateBody?: (v: string) => void;
  onUpdateImage?: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginBottom: "3rem" }}
    >
      {section.imageUrl && (
        <div style={{ marginBottom: "1.5rem" }}>
          <img
            src={section.imageUrl}
            alt=""
            style={{
              width: "100%",
              maxHeight: 400,
              objectFit: "cover",
              borderRadius: "0.75rem",
              display: "block",
            }}
          />
        </div>
      )}
      {!section.imageUrl && onUpdateImage && (
        <div
          style={{
            marginBottom: "1.5rem",
            border: `2px dashed ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
            borderRadius: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
            cursor: "pointer",
            color: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
            fontSize: "0.8125rem",
          }}
        >
          Add image (optional)
        </div>
      )}
      <InlineText
        as="h3"
        value={section.heading}
        onUpdate={onUpdateHeading}
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(1.25rem,2.5vw,1.625rem)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: dark ? "#fff" : FG,
          marginBottom: "1rem",
          lineHeight: 1.2,
          display: "block",
        }}
      />
      <InlineText
        as="p"
        value={section.body}
        onUpdate={onUpdateBody}
        multiline
        style={{
          fontSize: "1rem",
          lineHeight: 1.75,
          color: dark ? "rgba(255,255,255,0.62)" : MU,
          maxWidth: 720,
          display: "block",
        }}
      />
    </motion.div>
  );
}

function StatCell({
  stat,
  i,
  dark,
  divider,
  total,
  onUpdateValue,
  onUpdateLabel,
}: {
  stat: { value: string; label: string };
  i: number;
  dark: boolean;
  divider: string;
  total: number;
  onUpdateValue?: (v: string) => void;
  onUpdateLabel?: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const showLeftBorder = i > 0 && i % 2 !== 0;
  const showRightBorderSm = i < total - 1;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`${showRightBorderSm ? "sm:border-r" : ""} ${showLeftBorder ? "border-l sm:border-l-0" : ""}`}
      style={{
        padding: "2rem 1.25rem",
        textAlign: "center",
        borderColor: divider,
      }}
    >
      <InlineText
        as="p"
        value={stat.value}
        onUpdate={onUpdateValue}
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(1.875rem,4vw,2.5rem)",
          fontWeight: 600,
          color: dark ? AW : FG,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          marginBottom: "0.625rem",
          display: "block",
        }}
      />
      <InlineText
        as="p"
        value={stat.label}
        onUpdate={onUpdateLabel}
        multiline
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: dark ? "rgba(255,255,255,0.45)" : MU,
          lineHeight: 1.5,
          display: "block",
        }}
      />
    </motion.div>
  );
}

function PullQuote({
  quote,
  dark,
  onUpdate,
}: {
  quote: string;
  dark: boolean;
  onUpdate?: (v: string) => void;
}) {
  const ref = useRef<HTMLQuoteElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.blockquote
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        marginBottom: "3rem",
        padding: "2rem 2.25rem",
        borderLeft: `3px solid ${dark ? AW : FG}`,
        background: dark ? "rgba(255,255,255,0.04)" : "rgb(var(--brand-primary-rgb, 0 58 48) / 0.03)",
        borderRadius: "0 0.75rem 0.75rem 0",
        position: "relative",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "-0.5rem",
          left: "1.5rem",
          fontFamily: "Georgia, serif",
          fontSize: "5rem",
          lineHeight: 1,
          color: dark ? AW : FG,
          opacity: 0.18,
          userSelect: "none",
        }}
      >
        &ldquo;
      </span>
      <InlineText
        as="p"
        value={quote}
        onUpdate={onUpdate}
        multiline
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(1.0625rem,2vw,1.25rem)",
          fontStyle: "italic",
          fontWeight: 500,
          lineHeight: 1.65,
          color: dark ? "rgba(255,255,255,0.85)" : FG,
          position: "relative",
          zIndex: 1,
          display: "block",
        }}
      />
    </motion.blockquote>
  );
}

function ResultsGrid({
  results,
  dark,
  imageUrl,
  onUpdateResult,
  onUpdateImage,
}: {
  results: DsoCaseStudyResultItem[];
  dark: boolean;
  imageUrl?: string;
  onUpdateResult?: (i: number, field: keyof DsoCaseStudyResultItem, val: string) => void;
  onUpdateImage?: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const gridDivider = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  return (
    <div ref={ref}>
      {imageUrl && (
        <div style={{ marginBottom: "1.5rem" }}>
          <img
            src={imageUrl}
            alt=""
            style={{
              width: "100%",
              maxHeight: 400,
              objectFit: "cover",
              borderRadius: "0.75rem",
              display: "block",
            }}
          />
        </div>
      )}
      {!imageUrl && onUpdateImage && (
        <div
          style={{
            marginBottom: "1.5rem",
            border: `2px dashed ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
            borderRadius: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
            color: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
            fontSize: "0.8125rem",
          }}
        >
          Add image (optional)
        </div>
      )}
      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(1.25rem,2.5vw,1.625rem)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: dark ? "#fff" : FG,
          marginBottom: "2rem",
          lineHeight: 1.2,
        }}
      >
        The Results
      </motion.h3>
      <div
        className="grid grid-cols-1 sm:grid-cols-2"
        style={{ gap: "1px", background: gridDivider, border: `1px solid ${gridDivider}`, borderRadius: "0.875rem", overflow: "hidden" }}
      >
        {results.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.09, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              padding: "2rem",
              background: dark ? "rgba(255,255,255,0.03)" : "#fff",
            }}
          >
            <InlineText
              as="p"
              value={r.value}
              onUpdate={onUpdateResult ? (v) => onUpdateResult(i, "value", v) : undefined}
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(1.75rem,3.5vw,2.5rem)",
                fontWeight: 600,
                color: dark ? AW : FG,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                marginBottom: "0.5rem",
                display: "block",
              }}
            />
            <InlineText
              as="p"
              value={r.label}
              onUpdate={onUpdateResult ? (v) => onUpdateResult(i, "label", v) : undefined}
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: dark ? "#fff" : FG,
                marginBottom: "0.5rem",
                lineHeight: 1.3,
                display: "block",
              }}
            />
            <InlineText
              as="p"
              value={r.description}
              onUpdate={onUpdateResult ? (v) => onUpdateResult(i, "description", v) : undefined}
              multiline
              style={{
                fontSize: "0.8125rem",
                color: dark ? "rgba(255,255,255,0.48)" : MU,
                lineHeight: 1.6,
                display: "block",
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
