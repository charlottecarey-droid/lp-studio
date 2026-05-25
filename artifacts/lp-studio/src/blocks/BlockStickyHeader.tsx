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
    if (action === "modal-form" || action === "modal-chilipiper") {
      // Modal actions handle themselves locally — do NOT call the host
      // onCtaClick callback because on the published viewer it always
      // navigates to primaryCtaUrl (or brand.defaultCtaUrl) in a new tab,
      // which would double-fire alongside the modal. The viewer's
      // document-level click listener still records the CTA click for
      // engagement tracking.
      setFormOpen(true);
      return;
    }
    if (action === "chilipiper") {
      // Same as above — don't invoke the host nav callback for ChiliPiper
      // popups; just open the scheduler.
      if (p.chilipiperUrl) setCpOpen(true);
      return;
    }
    // "url" — let the host hook handle navigation when present (builder
    // preview swallows it; viewer navigates + tracks). When no host hook
    // is wired (e.g. design sandbox), fall back to navigating ourselves
    // since the anchor's default was preventDefault'd.
    if (onCtaClick) {
      onCtaClick();
      return;
    }
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
          // Per-block override → brand-default → EmailCaptureModal's
          // own "light" fallback. Unlike BlockIdHero we render
          // EmailCaptureModal directly here, so the brand fallback has
          // to happen at the callsite — the modal itself doesn't know
          // about BrandConfig.
          theme={p.modalTheme ?? resolvedBrand?.modalTheme ?? undefined}
        />
      )}
      {action === "chilipiper" && cpOpen && p.chilipiperUrl && (
        <ChiliPiperModal url={p.chilipiperUrl} onClose={() => setCpOpen(false)} />
      )}
    </>
  );
}
