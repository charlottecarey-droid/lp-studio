import { motion } from "framer-motion";
import type { EventPageDetailsSectionBlockProps } from "@/lib/block-types";
import { useStaticRender } from "@/lib/reveal-fallback";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { InlineText } from "@/components/InlineText";
import { resolveTheme, rgba } from "./BlockEventPage";

/**
 * The Event Page block's Details ("What to Expect") section as a standalone
 * block — the centered lockup plus the 3-across hairline grid of
 * label / italic value / sub cells. Rendering copied 1:1 from BlockEventPage's
 * `#details` section, with the hardcoded gold hover ink and the fixed hover
 * card color derived from the theme instead, so a re-themed page carries its
 * palette. Default theme = the parent's gold-on-dark, byte-for-byte.
 */

interface Props {
  props: EventPageDetailsSectionBlockProps;
  onFieldChange?: (updated: EventPageDetailsSectionBlockProps) => void;
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};

export function BlockEventPageDetails({ props: p, onFieldChange }: Props) {
  const staticRender = useStaticRender();
  const C = resolveTheme(p.theme);
  const borderHex = p.theme?.border || "#262a2f";
  useBlockFonts(p.theme?.displayFontFamily ?? "EB Garamond", p.theme?.bodyFontFamily ?? "");
  const displayFont = C.displayFont;
  const bodyFont = C.bodyFont;

  const field = (key: "eyebrow" | "headline" | "subtitle") =>
    onFieldChange ? (v: string) => onFieldChange({ ...p, [key]: v }) : undefined;
  const updateDetail = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const details = p.details.map((d, idx) => (idx === i ? { ...d, [key]: value } : d));
    onFieldChange({ ...p, details });
  };

  return (
    <section
      style={{
        padding: "7rem 1.5rem",
        backgroundColor: C.card,
        color: C.fg,
        fontFamily: bodyFont,
        ["--epd-primary" as string]: C.primary,
      } as React.CSSProperties}
    >
      <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
        <motion.div
          initial={staticRender ? false : "hidden"} whileInView="visible" viewport={{ once: true, margin: "-50px" }}
          variants={stagger} style={{ textAlign: "center", marginBottom: "4rem" }}
        >
          <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.4em", textTransform: "uppercase", color: C.primary, marginBottom: "1.25rem" }}>
            <InlineText as="span" value={p.eyebrow} onUpdate={field("eyebrow")} />
          </motion.p>
          <motion.h2 variants={fadeUp} style={{ fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(1.875rem, 5vw, 3rem)", color: C.heading, marginBottom: "1.25rem" }}>
            <InlineText as="span" value={p.headline} onUpdate={field("headline")} />
          </motion.h2>
          <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, maxWidth: "32rem", margin: "0 auto", lineHeight: 1.7 }}>
            <InlineText as="span" value={p.subtitle} onUpdate={field("subtitle")} multiline />
          </motion.p>
        </motion.div>

        <motion.div
          initial={staticRender ? false : "hidden"} whileInView="visible" viewport={{ once: true }} variants={stagger}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", border: `1px solid ${rgba(borderHex, 0.3)}`, backgroundColor: rgba(borderHex, 0.3) }}
          className="max-sm:grid-cols-1"
        >
          {p.details.map((detail, i) => (
            <motion.div
              key={i} variants={fadeUp}
              whileHover={{ backgroundColor: C.bg }}
              transition={{ duration: 0.4 }}
              style={{ textAlign: "center", padding: "3rem 1.5rem", backgroundColor: C.card, cursor: "default" }}
              className="group"
            >
              <InlineText
                as="p"
                value={detail.label}
                onUpdate={onFieldChange ? (v) => updateDetail(i, "label", v) : undefined}
                style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted, marginBottom: "1rem", transition: "color 0.4s" }}
                className="group-hover:text-[color:var(--epd-primary)]"
              />
              <InlineText as="p" value={detail.value} onUpdate={onFieldChange ? (v) => updateDetail(i, "value", v) : undefined} style={{ fontFamily: displayFont, fontStyle: "italic", fontSize: "1.25rem", color: C.heading, marginBottom: "0.5rem" }} />
              <InlineText as="p" value={detail.sub} onUpdate={onFieldChange ? (v) => updateDetail(i, "sub", v) : undefined} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.75rem", color: C.muted }} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
