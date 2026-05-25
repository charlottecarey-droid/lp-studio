import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses, getSecondaryButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { CtaButton as SharedCtaButton } from "@/components/CtaButton";
import type { CtaModalConfig } from "@/lib/block-types";

const BRAND     = "var(--brand-primary)";
const LIME      = "hsl(68,60%,52%)";
const OFF_WHITE = "hsl(42,18%,96%)";
const SPRING    = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props extends Partial<CtaModalConfig> {
  ctaText:     string;
  ctaUrl?:     string;
  ctaMode?:    "link" | "chilipiper" | "modal-form" | "modal-chilipiper";
  ctaVariant?: "primary" | "secondary" | "link";
  brand:       BrandConfig;
  dark?:       boolean;
  source?:     string;
}

export function BlockDsoCta({
  ctaText,
  ctaUrl,
  ctaMode    = "link",
  ctaVariant = "primary",
  brand,
  dark       = false,
  source,
  ...modal
}: Props) {
  const url = ctaUrl ?? "#";
  const isModalCta = ctaMode === "modal-form" || ctaMode === "modal-chilipiper";

  if (isModalCta) {
    // Style classes parallel the existing variant branches so the modal-aware
    // SharedCtaButton matches the original visual.
    let cls = "";
    let sty: React.CSSProperties = {};
    if (ctaVariant === "link") {
      const color = dark ? LIME : BRAND;
      cls = "inline-flex items-center gap-1.5 text-[15px] font-semibold";
      sty = { background: "none", border: "none", padding: 0, color };
    } else if (ctaVariant === "secondary") {
      const color       = dark ? OFF_WHITE : BRAND;
      const borderColor = dark ? "rgba(255,255,255,0.35)" : "rgba(0,58,48,0.35)";
      cls = getSecondaryButtonClasses(brand) + " inline-flex items-center gap-2";
      sty = { color, borderColor };
    } else {
      cls = getButtonClasses(brand, "inline-flex items-center gap-2");
      sty = { backgroundColor: brand.accentColor, color: brand.primaryColor };
    }
    return (
      <SharedCtaButton
        ctaAction={ctaMode}
        modalChilipiperUrl={modal.modalChilipiperUrl}
        modalFormSource={modal.modalFormSource}
        modalFormId={modal.modalFormId}
        modalMarketoBaseUrl={modal.modalMarketoBaseUrl}
        modalMarketoMunchkinId={modal.modalMarketoMunchkinId}
        modalMarketoFormId={modal.modalMarketoFormId}
        modalChiliPiperHandoffUrl={modal.modalChiliPiperHandoffUrl}
        modalChiliPiperHandoffMode={modal.modalChiliPiperHandoffMode}
        modalChiliPiperHandoffFieldMap={modal.modalChiliPiperHandoffFieldMap}
        modalHeadline={modal.modalHeadline}
        modalSubheadline={modal.modalSubheadline}
        modalSubmitText={modal.modalSubmitText}
        modalSuccessMessage={modal.modalSuccessMessage}
        modalDisclaimer={modal.modalDisclaimer}
        modalShowFirstName={modal.modalShowFirstName}
        modalShowLastName={modal.modalShowLastName}
        modalShowPhone={modal.modalShowPhone}
        modalShowCompany={modal.modalShowCompany}
        className={cls}
        style={sty}
        brand={brand}
        source={source}
      >
        {ctaText}
        {ctaVariant === "link" && <ArrowRight style={{ width: 15, height: 15 }} />}
      </SharedCtaButton>
    );
  }

  if (ctaVariant === "link") {
    const color = dark ? LIME : BRAND;
    const inner = (
      <>
        <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{ctaText}</span>
        <ArrowRight style={{ width: 15, height: 15 }} />
      </>
    );
    if (ctaMode === "chilipiper") {
      return (
        <ChiliPiperButton
          url={ctaUrl ?? ""}
          style={{ background: "none", border: "none", padding: 0, color, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
        >
          {inner}
        </ChiliPiperButton>
      );
    }
    return (
      <motion.a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color, textDecoration: "none" }}
        whileHover={{ x: 4 }}
        transition={SPRING}
      >
        {inner}
      </motion.a>
    );
  }

  if (ctaVariant === "secondary") {
    const color       = dark ? OFF_WHITE : BRAND;
    const borderColor = dark ? "rgba(255,255,255,0.35)" : "rgba(0,58,48,0.35)";
    const cls = getSecondaryButtonClasses(brand) + " inline-flex items-center gap-2";
    const sty = { color, borderColor };
    if (ctaMode === "chilipiper") {
      return (
        <ChiliPiperButton url={ctaUrl ?? ""} className={cls} style={sty}>
          {ctaText}
        </ChiliPiperButton>
      );
    }
    return (
      <motion.a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        style={{ ...sty, textDecoration: "none" }}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING}
      >
        {ctaText}
      </motion.a>
    );
  }

  const cls = getButtonClasses(brand, "inline-flex items-center gap-2");
  const sty = { backgroundColor: brand.accentColor, color: brand.primaryColor };
  if (ctaMode === "chilipiper") {
    return (
      <ChiliPiperButton url={ctaUrl ?? ""} className={cls} style={sty}>
        {ctaText}
      </ChiliPiperButton>
    );
  }
  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      style={{ ...sty, textDecoration: "none" }}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
    >
      {ctaText}
    </motion.a>
  );
}
