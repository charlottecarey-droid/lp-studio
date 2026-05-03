import { motion } from "framer-motion";
import { Quote, User } from "lucide-react";
import type { DsoTestimonialsBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { BlockDsoCta } from "@/components/BlockDsoCta";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: DsoTestimonialsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoTestimonialsBlockProps) => void;
}

const BRAND   = "var(--brand-primary, #003A30)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoTestimonials({ props, brand, onFieldChange }: Props) {
  const { eyebrow, headline, subheadline, testimonials = [], ctaText, ctaUrl, ctaMode = "link", ctaVariant = "link", backgroundStyle = "dark" } = props;
  const field = (key: keyof DsoTestimonialsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateT = (i: number, patch: Partial<typeof testimonials[number]>) => {
    if (!onFieldChange) return;
    const next = testimonials.slice();
    next[i] = { ...next[i], ...patch };
    onFieldChange({ ...props, testimonials: next });
  };
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid #e5e7eb";
  const quoteC    = dark ? "rgba(255,255,255,0.85)" : BRAND;
  const authorC   = dark ? "#fff" : BRAND;
  const locC      = dark ? LIME : "#6b7280";
  const divC      = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          {(eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={eyebrow ?? ""}
              onUpdate={field("eyebrow")}
              animate={{ y: 10 }}
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "1.25rem" }}
            />
          )}
          {(headline || onFieldChange) && (
            <InlineText
              as="h2"
              value={headline ?? ""}
              onUpdate={field("headline")}
              animate={{ y: 20, delay: 0.05 }}
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", lineHeight: 1.15, fontWeight: 600, color: headlineC, letterSpacing: "-0.015em" }}
            />
          )}
          {(subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={subheadline ?? ""}
              onUpdate={field("subheadline")}
              multiline
              animate={{ y: 15, delay: 0.12 }}
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0" }}
            />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.09, duration: 0.55 }}
              style={{
                background: cardBg,
                border: cardBor,
                borderRadius: "1.25rem",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                backdropFilter: dark ? "blur(12px)" : "none",
              }}
            >
              <Quote style={{ width: 24, height: 24, color: dark ? `rgb(var(--brand-accent-rgb, 199 231 56) / 0.502)` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.251)`, flexShrink: 0 }} />

              {/* Wrap with literal quote marks to match the prior render output;
                  InlineText edits only the quote body itself. */}
              <p
                style={{
                  fontSize: "0.9375rem",
                  color: quoteC,
                  lineHeight: 1.7,
                  fontStyle: "italic",
                  flex: 1,
                  margin: 0,
                }}
              >
                "
                <InlineText
                  as="span"
                  value={t.quote}
                  onUpdate={onFieldChange ? (v) => updateT(i, { quote: v }) : undefined}
                  multiline
                />
                "
              </p>

              <div style={{ borderTop: `1px solid ${divC}`, paddingTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: dark ? "rgba(255,255,255,0.10)" : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.063)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <User style={{ width: 16, height: 16, color: dark ? "rgba(255,255,255,0.5)" : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.439)` }} />
                </div>
                <div>
                  <InlineText
                    as="p"
                    value={t.author}
                    onUpdate={onFieldChange ? (v) => updateT(i, { author: v }) : undefined}
                    style={{ fontSize: "0.9375rem", fontWeight: 600, color: authorC, lineHeight: 1.2 }}
                  />
                  {(t.location || onFieldChange) && (
                    <InlineText
                      as="p"
                      value={t.location ?? ""}
                      onUpdate={onFieldChange ? (v) => updateT(i, { location: v }) : undefined}
                      style={{ fontSize: "0.8125rem", color: locC, marginTop: 2 }}
                    />
                  )}
                </div>
              </div>
            </motion.div>
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
