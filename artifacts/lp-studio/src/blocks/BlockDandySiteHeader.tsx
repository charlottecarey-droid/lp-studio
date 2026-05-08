import type React from "react";
import { useState } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandySiteHeaderBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo } from "@/components/BrandLogo";
import { safeNavigate } from "@/lib/safe-url";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";

interface Props {
  props: DandySiteHeaderBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySiteHeaderBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

type CtaActionMode = "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
// Resolve with a legacy fallback. BuilderEditor.applyCtaToAll() writes the
// legacy `primaryCtaMode` field on every block with `primaryCtaUrl` (this
// block included) but does not write `primaryCtaAction`. Without the
// fallback, primary silently reverts to URL mode after Apply-to-all from a
// modal-mode source while secondary keeps its panel-set value.
function resolveAction(action: string | undefined, legacyMode: string | undefined): CtaActionMode {
  const v = action ?? legacyMode;
  return v === "chilipiper" || v === "modal-form" || v === "modal-chilipiper" ? v : "url";
}

export function BlockDandySiteHeader({ props, brand, onFieldChange, pageId, variantId }: Props) {
  useBlockFonts(props.fontFamily);
  const [modalOpen, setModalOpen] = useState<false | "form" | "chilipiper">(false);

  const field = (key: keyof DandySiteHeaderBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateNav = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    const navLinks = (props.navLinks ?? []).map((l, idx) => idx === i ? { ...l, [key]: v } : l);
    onFieldChange({ ...props, navLinks });
  };

  const headerBg = props.backgroundColor ?? `var(--brand-primary, ${brand.primaryColor})`;
  const headerFg = props.textColor ?? "#ffffff";
  const overlay = Math.max(0, Math.min(1, props.backgroundOverlay ?? 0));
  const headerStyle: React.CSSProperties = {
    background: props.backgroundImage
      ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${props.backgroundImage}") center/cover no-repeat, ${headerBg}`
      : headerBg,
    color: headerFg,
    fontFamily: props.fontFamily || undefined,
    ["--header-fg" as string]: headerFg,
  };
  const hasFgOverride = !!props.textColor;

  const legacy = props as unknown as Record<string, unknown>;
  const primaryAction = resolveAction(
    props.primaryCtaAction,
    legacy.primaryCtaMode as string | undefined,
  );
  const secondaryAction = resolveAction(
    props.secondaryCtaAction,
    legacy.secondaryCtaMode as string | undefined,
  );

  const handleClick = (action: CtaActionMode, url: string) => {
    if (action === "modal-form") return setModalOpen("form");
    if (action === "modal-chilipiper") return setModalOpen("chilipiper");
    safeNavigate(url);
  };

  const secondaryClass = cn(
    "hidden md:block text-sm font-semibold border rounded-xl px-5 py-2.5 transition-colors",
    hasFgOverride
      ? "border-current/30 hover:bg-black/5"
      : "text-white border-white/30 hover:bg-white/10",
  );
  const primaryClass = "bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold text-sm rounded-xl px-5 py-2.5 hover:brightness-110 transition-all";

  return (
    <header className="w-full shadow-sm" style={headerStyle}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center gap-8">
        <div className="shrink-0">
          <BrandLogo
            brand={brand}
            url={props.logoUrl}
            tone="onPrimary"
            alt={brand.brandName || "Logo"}
            className="h-9 w-auto"
          />
        </div>

        {(props.navLinks ?? []).length > 0 && (
          <nav className="hidden lg:flex items-center gap-8 flex-1">
            {(props.navLinks ?? []).map((link, i) => (
              <a
                key={i}
                href={link.url || "#"}
                className={cn(
                  "text-sm font-medium transition-colors whitespace-nowrap",
                  hasFgOverride ? "opacity-80 hover:opacity-100" : "text-white/75 hover:text-white",
                )}
              >
                <InlineText
                  value={link.label}
                  onUpdate={onFieldChange ? (v) => updateNav(i, "label", v) : undefined}
                />
              </a>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-4 shrink-0">
          {props.phoneNumber && (
            <a
              href={`tel:${props.phoneNumber}`}
              className={cn(
                "hidden md:flex items-center gap-2 text-sm transition-colors",
                hasFgOverride ? "opacity-70 hover:opacity-100" : "text-white/65 hover:text-white",
              )}
            >
              <Phone className="w-4 h-4" />
              <InlineText value={props.phoneLabel || props.phoneNumber} onUpdate={field("phoneLabel")} />
            </a>
          )}

          {props.secondaryCtaText && (
            secondaryAction === "chilipiper" ? (
              <ChiliPiperButton url={props.secondaryCtaUrl || brand.chilipiperUrl || "#"} className={secondaryClass}>
                <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
              </ChiliPiperButton>
            ) : (
              <button onClick={() => handleClick(secondaryAction, props.secondaryCtaUrl)} className={secondaryClass}>
                <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
              </button>
            )
          )}

          {props.primaryCtaText && (
            primaryAction === "chilipiper" ? (
              <ChiliPiperButton url={props.primaryCtaUrl || brand.chilipiperUrl || "#"} className={primaryClass}>
                <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
              </ChiliPiperButton>
            ) : (
              <button onClick={() => handleClick(primaryAction, props.primaryCtaUrl)} className={primaryClass}>
                <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
              </button>
            )
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
        source="dandy-site-header"
      />
    </header>
  );
}
