import { motion } from "framer-motion";
import { Crown, SmilePlus, Stethoscope, Target, Scan, Sparkles, Moon, Shield } from "lucide-react";
import type { DsoProductsGridBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

import productPosteriorCrowns from "@/assets/dandy-product-posterior-crowns.webp";
import productAnteriorCrowns  from "@/assets/dandy-product-anterior-crowns.webp";
import productDentures        from "@/assets/dandy-product-dentures.webp";
import productImplants         from "@/assets/dandy-product-implants.webp";
import productGuidedSurgery   from "@/assets/dandy-product-guided-surgery.webp";
import productAligners         from "@/assets/dandy-product-aligners.webp";
import productGuards           from "@/assets/dandy-product-guards.webp";
import productSleep            from "@/assets/dandy-product-sleep.webp";

interface Props {
  props: DsoProductsGridBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

const PRODUCT_IMAGES: Record<string, string> = {
  "posterior-crowns":  productPosteriorCrowns,
  "anterior-crowns":   productAnteriorCrowns,
  dentures:            productDentures,
  implants:            productImplants,
  "guided-surgery":    productGuidedSurgery,
  aligners:            productAligners,
  guards:              productGuards,
  sleep:               productSleep,
  "Posterior Crowns":  productPosteriorCrowns,
  "Anterior Crowns":   productAnteriorCrowns,
  "Dentures":          productDentures,
  "Implant Restorations": productImplants,
  "Guided Surgery":    productGuidedSurgery,
  "Clear Aligners":    productAligners,
  "Night Guards & TMJ": productGuards,
  "Sleep Appliances":  productSleep,
};

const PRODUCT_ICONS: Record<string, React.ElementType> = {
  crown:       Crown,
  smile:       SmilePlus,
  stethoscope: Stethoscope,
  target:      Target,
  scan:        Scan,
  sparkles:    Sparkles,
  moon:        Moon,
  shield:      Shield,
};

export function BlockDsoProductsGrid({ props }: Props) {
  const { eyebrow, headline, subheadline, products = [], backgroundStyle = "muted" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid #e5e7eb";
  const nameC     = dark ? "#fff" : BRAND;
  const detailC   = dark ? "rgba(255,255,255,0.50)" : "#9ca3af";
  const priceC    = dark ? LIME : BRAND;

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "1.25rem" }}
            >
              {eyebrow}
            </motion.p>
          )}
          {headline && (
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", lineHeight: 1.15, fontWeight: 600, color: headlineC, letterSpacing: "-0.015em" }}
            >
              {headline}
            </motion.h2>
          )}
          {subheadline && (
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0" }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
          {products.map((product, i) => {
            const imgSrc = product.imageUrl || PRODUCT_IMAGES[product.imageKey ?? ""] || PRODUCT_IMAGES[product.name] || null;
            const iconKey = product.icon?.toLowerCase() ?? "";
            const Icon = PRODUCT_ICONS[iconKey] ?? Crown;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                style={{
                  background: cardBg,
                  border: cardBor,
                  borderRadius: "1rem",
                  overflow: "hidden",
                  backdropFilter: dark ? "blur(12px)" : "none",
                }}
              >
                {imgSrc ? (
                  <div style={{ height: 140, overflow: "hidden" }}>
                    <img src={imgSrc} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div
                    style={{
                      height: 100,
                      background: dark ? `${LIME}10` : `${BRAND}06`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon style={{ width: 36, height: 36, color: dark ? LIME : BRAND, opacity: 0.5 }} />
                  </div>
                )}

                <div style={{ padding: "1.25rem 1.5rem 1.5rem" }}>
                  <p style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: nameC, letterSpacing: "-0.01em" }}>{product.name}</p>
                  <p style={{ fontSize: "0.9375rem", color: detailC, marginTop: 4, lineHeight: 1.55 }}>{product.detail}</p>
                  <p style={{ fontSize: "1rem", fontWeight: 700, color: priceC, marginTop: "0.875rem" }}>{product.price}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
