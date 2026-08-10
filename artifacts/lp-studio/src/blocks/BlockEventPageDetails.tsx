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
  const fgHex = p.theme?.fg || "#eeeae3";
  // Hairlines follow an explicit theme border; otherwise derive from the
  // body ink so they sit right on ANY surface — the fixed gray default was
  // tuned for the gold-on-charcoal theme and reads muddy on other palettes.
  const hairline = p.theme?.border ? rgba(p.theme.border, 0.5) : rgba(fgHex, 0.14);
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
        ["--epd-hairline" as string]: hairline,
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

        {/* Responsive columns live in classes, never inline style — an inline
            gridTemplateColumns outranks every responsive class, which is
            exactly the bug that stopped this stacking on phones. Editorial
            top/bottom hairlines + per-cell dividers echo the agenda block's
            hairline rows instead of the old boxed grid. */}
        <motion.div
          initial={staticRender ? false : "hidden"} whileInView="visible" viewport={{ once: true }} variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-3 border-y border-[color:var(--epd-hairline)]"
        >
          {p.details.map((detail, i) => (
            <motion.div
              key={i} variants={fadeUp}
              whileHover={{ backgroundColor: rgba(fgHex, 0.04) }}
              transition={{ duration: 0.4 }}
              style={{ textAlign: "center", padding: "3.25rem 1.5rem", cursor: "default" }}
              className="group border-t sm:border-t-0 sm:border-l first:border-t-0 sm:first:border-l-0 border-[color:var(--epd-hairline)]"
            >
              <div style={{ width: "2rem", height: "1px", backgroundColor: C.primaryFaint, margin: "0 auto 1.5rem" }} />
              <InlineText
                as="p"
                value={detail.label}
                onUpdate={onFieldChange ? (v) => updateDetail(i, "label", v) : undefined}
                style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted, marginBottom: "1rem", transition: "color 0.4s" }}
                className="group-hover:text-[color:var(--epd-primary)]"
              />
              <InlineText as="p" value={detail.value} onUpdate={onFieldChange ? (v) => updateDetail(i, "value", v) : undefined} style={{ fontFamily: displayFont, fontStyle: "italic", fontSize: "1.375rem", color: C.heading, marginBottom: "0.5rem" }} />
              <InlineText as="p" value={detail.sub} onUpdate={onFieldChange ? (v) => updateDetail(i, "sub", v) : undefined} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.75rem", color: C.muted }} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
