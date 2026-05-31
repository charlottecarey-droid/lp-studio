import { useState } from "react";
import { BRAND_BODY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses, getLogoLinkUrl } from "@/lib/brand-config";
import type { BrandConfig } from "@/lib/brand-config";
import type { NavHeaderBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo } from "@/components/BrandLogo";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { motion } from "framer-motion";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: NavHeaderBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: NavHeaderBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

type CtaActionMode = "url" | "chilipiper" | "modal-form" | "modal-chilipiper";

function normalizeAction(a: NavHeaderBlockProps["cta1Action"]): CtaActionMode {
  return a === "chilipiper" || a === "modal-form" || a === "modal-chilipiper" ? a : "url";
}

export function BlockNavHeader({ props, brand, onFieldChange, pageId, variantId }: Props) {
  // Load any catalog Google Font referenced by the per-header font override.
  useBlockFonts(props.fontFamily);
  const [modalOpen, setModalOpen] = useState<false | "form" | "chilipiper">(false);

  const updateLink = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const navLinks = (props.navLinks ?? []).map((l, idx) => idx === i ? { ...l, [key]: value } : l);
    onFieldChange({ ...props, navLinks });
  };

  const headerBg = props.backgroundColor ?? "#ffffff";
  const headerFg = props.textColor;
  const overlay = Math.max(0, Math.min(1, props.backgroundOverlay ?? 0));
  const headerStyle: React.CSSProperties = {
    background: props.backgroundImage
      ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${props.backgroundImage}") center/cover no-repeat, ${headerBg}`
      : headerBg,
    color: headerFg || undefined,
    fontFamily: props.fontFamily || undefined,
  };
  const hasBgOverride = !!(props.backgroundColor || props.backgroundImage);
  const hasFgOverride = !!props.textColor;

  const cta1Action = normalizeAction(props.cta1Action);
  const cta2Action = normalizeAction(props.cta2Action);

  // Renders a CTA button with the right behaviour for its action mode.
  // - url        → <motion.a href>
  // - chilipiper → wrapped in ChiliPiperButton
  // - modal-*    → <motion.button> that opens the shared EmailCaptureModal
  const renderCta = (
    cta: { label: string; url: string },
    action: CtaActionMode,
    onLabelEdit: ((v: string) => void) | undefined,
    btnClassName: string,
    btnStyle?: React.CSSProperties,
  ) => {
    if (!cta?.label) return null;
    const inner = <InlineText value={cta.label} onUpdate={onLabelEdit} style={{ fontFamily: BODY }}/>;
    if (action === "modal-form" || action === "modal-chilipiper") {
      return (
        <motion.button
          type="button"
          onClick={() => setModalOpen(action === "modal-chilipiper" ? "chilipiper" : "form")}
          className={btnClassName}
          style={btnStyle}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
        >
          {inner}
        </motion.button>
      );
    }
    if (action === "chilipiper") {
      return (
        <ChiliPiperButton url={cta.url || brand.chilipiperUrl || "#"} className={btnClassName} style={btnStyle}>
          {inner}
        </ChiliPiperButton>
      );
    }
    return (
      <motion.a
        href={cta.url || "#"}
        className={btnClassName}
        style={btnStyle}
        whileHover={{ scale: 1.04, y: -1 }}
        whileTap={{ scale: 0.96 }}
        transition={SPRING}
      >
        {inner}
      </motion.a>
    );
  };

  return (
    <header
      className={cn(
        "w-full border-b border-slate-200 shadow-sm sticky top-0 z-50",
        !hasBgOverride && "bg-white",
      )}
      style={headerStyle}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
        <div className="shrink-0">
          {(() => {
            const logo = (
              <BrandLogo
                brand={brand}
                url={props.logoUrl}
                tone="onLight"
                alt={props.logoText || brand.brandName || "Logo"}
                className="h-8 w-auto"
              />
            );
            const logoLink = getLogoLinkUrl(brand);
            return logoLink ? (
              <a href={logoLink} target="_blank" rel="noopener noreferrer" className="inline-block">
                {logo}
              </a>
            ) : logo;
          })()}
        </div>

        {(props.navLinks ?? []).length > 0 && (
          <nav className="hidden md:flex items-center gap-6 flex-1">
            {(props.navLinks ?? []).map((link, i) => (
              <a
                key={i}
                href={link.url || "#"}
                className={cn(
                  "text-sm font-medium transition-colors whitespace-nowrap",
                  hasFgOverride ? "hover:opacity-80" : "text-slate-600 hover:text-slate-900",
                )}
              >
                <InlineText
                  value={link.label}
                  onUpdate={onFieldChange ? (v) => updateLink(i, "label", v) : undefined}
                style={{ fontFamily: BODY }}/>
              </a>
            ))}
          </nav>
        )}

        <div className={cn("flex items-center gap-3 ml-auto shrink-0")}>
          {props.phone && (
            <a
              href={`tel:${props.phone.replace(/\s/g, "")}`}
              className={cn(
                "hidden lg:flex items-center gap-1.5 text-sm font-medium transition-colors",
                hasFgOverride ? "hover:opacity-80" : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Phone className="w-4 h-4" />
              <InlineText
                value={props.phone}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, phone: v }) : undefined}
              style={{ fontFamily: BODY }}/>
            </a>
          )}
          {renderCta(
            props.cta1,
            cta1Action,
            onFieldChange ? (v) => onFieldChange({ ...props, cta1: { ...props.cta1, label: v } }) : undefined,
            cn(getButtonClasses(brand), "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"),
          )}
          {renderCta(
            props.cta2,
            cta2Action,
            onFieldChange ? (v) => onFieldChange({ ...props, cta2: { ...props.cta2, label: v } }) : undefined,
            getButtonClasses(brand),
            { backgroundColor: brand.accentColor, color: brand.primaryColor },
          )}
        </div>
      </div>

      <EmailCaptureModal
        open={!!modalOpen}
        onClose={() => setModalOpen(false)}
        email=""
        mode={modalOpen === "chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={props.modalChilipiperUrl ?? brand.chilipiperUrl ?? ""}
        formSource={props.modalFormSource}
        linkedFormId={props.modalFormId}
        marketoBaseUrl={props.modalMarketoBaseUrl}
        marketoMunchkinId={props.modalMarketoMunchkinId}
        marketoFormId={props.modalMarketoFormId}
        chiliPiperConfig={props.modalChiliPiperHandoffUrl ? { url: props.modalChiliPiperHandoffUrl, mode: props.modalChiliPiperHandoffMode ?? "modal", fieldMap: props.modalChiliPiperHandoffFieldMap } : null}
        formConfig={{
          headline: props.modalHeadline,
          subheadline: props.modalSubheadline,
          submitText: props.modalSubmitText,
          successMessage: props.modalSuccessMessage,
          disclaimer: props.modalDisclaimer,
          showFirstName: props.modalShowFirstName,
          showLastName: props.modalShowLastName,
          showPhone: props.modalShowPhone,
          showCompany: props.modalShowCompany,
        }}
        primaryColor={brand.primaryColor}
        accentColor={brand.accentColor}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="nav-header"
      />
    </header>
  );
}
