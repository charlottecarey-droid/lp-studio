import { useState } from "react";
import type { StickyHeaderBlockProps } from "@/lib/block-types";
import { StickyHeroNav } from "@/components/StickyHeroNav";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { ChiliPiperModal } from "./ChiliPiperModal";
import { useBrandConfig } from "@/components/BrandSwatches";
import { usePageContext } from "@/lib/page-context";
import { safeNavigate } from "@/lib/safe-url";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: StickyHeaderBlockProps;
  brand?: BrandConfig;
  onCtaClick?: () => void;
  /** When true (builder canvas), render in a contained variant so the header
   *  doesn't overlay the builder's top bar / control rails. */
  isBuilder?: boolean;
}

/**
 * Sticky hero header block. Wraps StickyHeroNav with the same CTA action
 * surface every other block has — "url" / "chilipiper" / "modal-form" /
 * "modal-chilipiper" — so the primary nav button can open a Chili Piper
 * scheduler popup, a global form modal, or a Marketo-then-Chili-Piper
 * handoff without bespoke per-page wiring. Modal config fields are spread
 * straight from CtaModalConfig and mirror BlockDandyProductHero so the
 * shared CtaButtonModalConfigSection editor works unchanged.
 */
export function BlockStickyHeader({ props: p, brand, onCtaClick, isBuilder }: Props) {
  const ctxBrand = useBrandConfig();
  const resolvedBrand = brand ?? ctxBrand ?? undefined;
  const ctx = usePageContext();

  const [formOpen, setFormOpen] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);

  const action = p.primaryCtaAction ?? "url";

  const handleCta = () => {
    // Host hook (analytics, builder preview) always fires first.
    onCtaClick?.();
    if (action === "modal-form" || action === "modal-chilipiper") {
      setFormOpen(true);
      return;
    }
    if (action === "chilipiper") {
      if (p.chilipiperUrl) setCpOpen(true);
      return;
    }
    // "url" — the anchor handler has preventDefault'd because we passed
    // an onPrimaryCtaClick; navigate explicitly so the link still works.
    const url = p.primaryCtaUrl;
    if (url && url !== "#") {
      const trimmed = url.trim();
      const isSameTab = trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("?");
      safeNavigate(url, isSameTab ? "_self" : "_blank");
    }
  };

  return (
    <>
      <StickyHeroNav
        brand={brand}
        logoUrl={p.logoUrl}
        logoAlt={p.logoAlt || "Logo"}
        companyName={p.companyName}
        navLinks={p.navLinks}
        primaryCtaText={p.primaryCtaText}
        primaryCtaUrl={p.primaryCtaUrl}
        onPrimaryCtaClick={handleCta}
        theme={p.theme ?? "dark"}
        accentColor={p.accentColor}
        ctaStyle={p.ctaStyle}
        position={isBuilder ? "absolute" : (p.position ?? "fixed")}
        invertLogo={p.invertLogo}
        scrollThreshold={p.scrollThreshold ?? 40}
      />
      {(action === "modal-form" || action === "modal-chilipiper") && (
        <EmailCaptureModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          email=""
          mode={action === "modal-chilipiper" ? "chilipiper" : "form"}
          chilipiperUrl={p.modalChilipiperUrl}
          formSource={p.modalFormSource ?? "simple"}
          linkedFormId={p.modalFormId}
          marketoBaseUrl={p.modalMarketoBaseUrl}
          marketoMunchkinId={p.modalMarketoMunchkinId}
          marketoFormId={p.modalMarketoFormId}
          chiliPiperConfig={
            p.modalFormSource === "marketo" && p.modalChiliPiperHandoffUrl
              ? {
                  url: p.modalChiliPiperHandoffUrl,
                  mode: p.modalChiliPiperHandoffMode ?? "modal",
                  fieldMap: p.modalChiliPiperHandoffFieldMap,
                }
              : null
          }
          formConfig={{
            headline: p.modalHeadline,
            subheadline: p.modalSubheadline,
            submitText: p.modalSubmitText,
            successMessage: p.modalSuccessMessage,
            disclaimer: p.modalDisclaimer,
            showFirstName: p.modalShowFirstName,
            showLastName: p.modalShowLastName,
            showPhone: p.modalShowPhone,
            showCompany: p.modalShowCompany,
          }}
          brand={resolvedBrand}
          pageId={ctx.pageId ?? undefined}
          variantId={ctx.variantId ?? undefined}
          source="sticky-header"
        />
      )}
      {action === "chilipiper" && cpOpen && p.chilipiperUrl && (
        <ChiliPiperModal url={p.chilipiperUrl} onClose={() => setCpOpen(false)} />
      )}
    </>
  );
}
