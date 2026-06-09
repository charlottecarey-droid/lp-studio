import { useState } from "react";
import { BRAND_BODY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DsoPracticeNavBlockProps } from "@/lib/block-types";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";

const DEFAULT_NAV_LINKS = [
  { label: "How it works", anchor: "#steps" },
  { label: "Products", anchor: "#products" },
  { label: "Partnership perks", anchor: "#perks" },
  { label: "Meet your rep", anchor: "#team" },
];

const BG = "var(--brand-primary)";
const BG_ALT = "#002B24";
const LIME = "var(--brand-accent, #C7E738)"; /* alpha-concat literal */
const BORDER = "rgb(var(--brand-accent-rgb, 199 231 56) / 0.15)";

interface Props {
  props: DsoPracticeNavBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoPracticeNavBlockProps) => void;
  pageId?: number;
  variantId?: number;
  /** When true (builder canvas), render in-flow (relative, no sticky/high
   *  z-index) so the nav doesn't pin over the builder chrome while scrolling.
   *  Published/preview keeps the sticky behaviour. */
  isBuilder?: boolean;
}

export function BlockDsoPracticeNav({ props, brand, onFieldChange, pageId, variantId, isBuilder }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<false | "form" | "chilipiper">(false);

  const ctaUrl = props.ctaUrl || brand.chilipiperUrl || "#";
  const ctaMode = props.ctaMode || (brand.chilipiperUrl ? "chilipiper" : "link");
  const ctaText = props.ctaText || "Book a Demo";
  const links = props.links?.length ? props.links : DEFAULT_NAV_LINKS;

  const field = (key: keyof DsoPracticeNavBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoPracticeNavBlockProps[typeof key] }) : undefined;
  const updateLink = onFieldChange
    ? (idx: number, patch: Partial<DsoPracticeNavBlockProps["links"][number]>) => {
        const list = props.links?.length ? props.links : DEFAULT_NAV_LINKS;
        onFieldChange({ ...props, links: list.map((l, i) => i === idx ? { ...l, ...patch } : l) });
      }
    : undefined;

  const ctaBtnStyle: React.CSSProperties = {
    backgroundColor: LIME,
    color: BG,
  };

  const CtaButton = ({ className, onClick }: { className?: string; onClick?: () => void }) => {
    const cls = cn(
      "inline-flex items-center justify-center shrink-0",
      "px-4 py-2 rounded-full text-sm font-bold tracking-wide",
      "transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-95",
      className
    );
    const inner = <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>;
    if (ctaMode === "chilipiper") {
      return (
        <ChiliPiperButton url={ctaUrl} className={cls} style={ctaBtnStyle}>
          {inner}
        </ChiliPiperButton>
      );
    }
    if (ctaMode === "modal-form" || ctaMode === "modal-chilipiper") {
      return (
        <button
          type="button"
          className={cls}
          style={ctaBtnStyle}
          onClick={() => {
            setModalOpen(ctaMode === "modal-chilipiper" ? "chilipiper" : "form");
            onClick?.();
          }}
        >
          {inner}
        </button>
      );
    }
    return (
      <a href={ctaUrl} className={cls} style={ctaBtnStyle} onClick={onClick}>
        {inner}
      </a>
    );
  };

  return (
    <header
      className={cn("w-full", isBuilder ? "relative z-auto" : "sticky top-0 z-50")}
      style={{ backgroundColor: BG, borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="w-full px-5 sm:px-6 md:px-10 lg:px-12 h-16 flex items-center gap-6">

        {/* Logo + co-brand */}
        <div className="flex items-center gap-2 shrink-0">
          {props.dsoName && (
            <>
              <span className="text-white/80 text-sm font-semibold tracking-wide whitespace-nowrap" style={{ fontFamily: BODY }}>
                <InlineText as="span" value={props.dsoName} onUpdate={field("dsoName")} style={{ fontFamily: BODY }}/>
              </span>
              <span className="text-white/30 text-sm font-light" style={{ fontFamily: BODY }}>×</span>
            </>
          )}
          <BrandLogo brand={brand} tone="onPrimary" alt={brand.brandName || "Logo"} className="h-6 w-auto" />
        </div>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 ml-3">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.anchor}
              className="px-3 py-1.5 text-sm font-medium text-white/65 hover:text-white rounded-lg transition-colors whitespace-nowrap"
              style={{ "--tw-bg-opacity": "0.08" } as React.CSSProperties}
            >
              <InlineText as="span" value={link.label} onUpdate={updateLink ? (v) => updateLink(i, { label: v }) : undefined} style={{ fontFamily: BODY }}/>
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block ml-auto">
          <CtaButton />
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto p-2 rounded-lg transition-colors"
          style={{ color: "rgba(255,255,255,0.7)" }}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
        source="dso-practice-nav"
      />

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="md:hidden border-t px-4 py-4 space-y-1"
          style={{ backgroundColor: BG_ALT, borderColor: BORDER }}
        >
          {links.map((link, i) => (
            <a
              key={i}
              href={link.anchor}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-white/75 hover:text-white rounded-lg transition-colors"
            >
              <InlineText as="span" value={link.label} onUpdate={updateLink ? (v) => updateLink(i, { label: v }) : undefined} style={{ fontFamily: BODY }}/>
            </a>
          ))}
          <div className="pt-2">
            <CtaButton className="w-full" onClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
