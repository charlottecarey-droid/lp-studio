import { motion } from "framer-motion";
import type { EventPageAgendaSectionBlockProps } from "@/lib/block-types";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { InlineText } from "@/components/InlineText";
import { resolveTheme, rgba } from "./BlockEventPage";

/**
 * The Event Page block's Agenda section as a standalone block, for pages that
 * need this treatment composed with other blocks instead of the full-page
 * takeover. Rendering is copied 1:1 from BlockEventPage's `#agenda` section,
 * with one deliberate upgrade: the accents that were hardcoded to the default
 * gold there (value-prop pills, hairlines, hover ink) derive from
 * `theme.primary` here, so a re-themed page carries its palette into every
 * detail. Default theme = the same gold, so the default render matches the
 * parent byte-for-byte.
 */

interface Props {
  props: EventPageAgendaSectionBlockProps;
  onFieldChange?: (updated: EventPageAgendaSectionBlockProps) => void;
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};

export function BlockEventPageAgenda({ props: p, onFieldChange }: Props) {
  const anim = useAnimInitial();
  const staticRender = useStaticRender();
  const C = resolveTheme(p.theme);
  // Raw theme hexes for the two alphas the parent hardcodes (pill dot at 0.6,
  // highlight copy at 0.8) — resolveTheme only exposes other alpha steps.
  const primaryHex = p.theme?.primary || "#b59a6e";
  const mutedHex = p.theme?.muted || "#7a8088";
  useBlockFonts(p.theme?.displayFontFamily ?? "EB Garamond", p.theme?.bodyFontFamily ?? "");
  const displayFont = C.displayFont;
  const bodyFont = C.bodyFont;

  const field = (key: "eyebrow" | "headline" | "subtitle") =>
    onFieldChange ? (v: string) => onFieldChange({ ...p, [key]: v }) : undefined;
  const updateDay = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const days = p.days.map((d, idx) => (idx === i ? { ...d, [key]: value } : d));
    onFieldChange({ ...p, days });
  };
  const updateValueProp = (i: number, value: string) => {
    if (!onFieldChange) return;
    const valueProps = p.valueProps.map((v, idx) => (idx === i ? value : v));
    onFieldChange({ ...p, valueProps });
  };

  return (
    <section
      style={{
        padding: "7rem 1.5rem",
        backgroundColor: C.bg,
        color: C.fg,
        fontFamily: bodyFont,
        // Theme-derived hover ink for day titles (see group-hover class below).
        ["--epa-primary" as string]: C.primary,
      } as React.CSSProperties}
    >
      <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
        <motion.div
          initial={staticRender ? false : "hidden"} whileInView="visible" viewport={{ once: true, margin: "-50px" }}
          variants={stagger} style={{ textAlign: "center", marginBottom: "5rem" }}
        >
          <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.4em", textTransform: "uppercase", color: C.primary, marginBottom: "1.25rem" }}>
            <InlineText as="span" value={p.eyebrow} onUpdate={field("eyebrow")} />
          </motion.p>
          <motion.h2 variants={fadeUp} style={{ fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(1.875rem, 5vw, 3rem)", color: C.heading, marginBottom: "1.5rem" }}>
            <InlineText as="span" value={p.headline} onUpdate={field("headline")} />
          </motion.h2>
          <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, maxWidth: "32rem", margin: "0 auto", lineHeight: 1.7 }}>
            <InlineText as="span" value={p.subtitle} onUpdate={field("subtitle")} multiline />
          </motion.p>
        </motion.div>

        {/* Value props */}
        {p.valueProps && p.valueProps.length > 0 && (
          <motion.div
            initial={staticRender ? false : "hidden"} whileInView="visible" viewport={{ once: true }} variants={stagger}
            style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem 2rem", marginBottom: "4rem" }}
          >
            {p.valueProps.map((vp, i) => (
              <motion.span
                key={i} variants={fadeUp}
                whileHover={{ scale: 1.05, color: C.heading }}
                style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: C.primaryDim, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "default" }}
              >
                <motion.span style={{ width: "0.25rem", height: "0.25rem", borderRadius: "50%", backgroundColor: rgba(primaryHex, 0.6), display: "inline-block" }} whileHover={{ scale: 2 }} />
                <InlineText as="span" value={vp} onUpdate={onFieldChange ? (v) => updateValueProp(i, v) : undefined} />
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* Days */}
        <div style={{ borderTop: `1px solid ${C.borderDim}` }}>
          {p.days.map((day, i) => (
            <motion.div
              key={i}
              initial={anim({ opacity: 0, x: i % 2 === 0 ? -30 : 30 })}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, delay: i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ padding: "3rem 0", borderBottom: `1px solid ${C.borderDim}` }}
              className="group grid grid-cols-[200px_1fr] gap-12 max-sm:grid-cols-1 max-sm:gap-4"
            >
              <div>
                <motion.p
                  whileHover={{ letterSpacing: "0.4em" }}
                  transition={{ duration: 0.3 }}
                  style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: C.primary, marginBottom: "0.25rem" }}
                >
                  <InlineText as="span" value={day.day} onUpdate={onFieldChange ? (v) => updateDay(i, "day", v) : undefined} />
                </motion.p>
              </div>
              <div>
                <InlineText
                  as="h3"
                  value={day.title}
                  onUpdate={onFieldChange ? (v) => updateDay(i, "title", v) : undefined}
                  style={{ fontFamily: displayFont, fontWeight: 400, fontStyle: "italic", fontSize: "1.5rem", color: C.heading, marginBottom: "1rem", transition: "color 0.5s" }}
                  className="group-hover:text-[color:var(--epa-primary)]"
                />
                <InlineText as="p" value={day.description} onUpdate={onFieldChange ? (v) => updateDay(i, "description", v) : undefined} multiline style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, lineHeight: 1.7, marginBottom: "1rem" }} />
                <motion.div
                  initial={anim({ width: 0 })} whileInView={{ width: "3rem" }} viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }}
                  style={{ height: "1px", backgroundColor: C.primaryFaint, marginBottom: "1rem" }}
                />
                {day.highlight && (
                  <InlineText as="p" value={day.highlight} onUpdate={onFieldChange ? (v) => updateDay(i, "highlight", v) : undefined} multiline style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: rgba(mutedHex, 0.8), lineHeight: 1.7 }} />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
