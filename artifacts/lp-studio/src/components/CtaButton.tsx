import { useState } from "react";
import { motion } from "framer-motion";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { EmailCaptureModal, type EmailCaptureModalTheme } from "@/components/EmailCaptureModal";
import { VideoModal } from "@/components/VideoModal";
import { useBrandConfig } from "@/components/BrandSwatches";
import type { BrandConfig } from "@/lib/brand-config";
import type { CtaModalConfig } from "@/lib/block-types";
import { usePageContext } from "@/lib/page-context";
import { safeNavigate } from "@/lib/safe-url";
import {
  resolveCtaConfig,
  ctaConfigHasValue,
  type CtaConfig,
} from "@/lib/cta/ctaConfig";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

export type CtaActionMode =
  | "url"
  | "chilipiper"
  | "modal-form"
  | "modal-chilipiper"
  | "video-modal";

export interface CtaButtonProps extends CtaModalConfig {
  /** Behavior when the button is clicked. Defaults to "url". */
  ctaAction?: CtaActionMode;
  /** Used when ctaAction === "url". */
  ctaUrl?: string;
  /** Used when ctaAction === "chilipiper". */
  chilipiperUrl?: string;
  /** Used when ctaAction === "video-modal" — opens an in-page video overlay. */
  videoUrl?: string;
  /** Optional poster shown before the video (native video sources only). */
  videoPosterUrl?: string;
  /** Optional callback (analytics, builder preview) fired alongside default behavior. */
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  brand?: BrandConfig;
  pageId?: number;
  variantId?: number;
  /** Free-form source label saved with leads (e.g. "hero-cta"). */
  source?: string;
  /** Visual theme for the modal-form surface. "dark" suits dark
   *  cinematic blocks (Inside Dandy, Reservation Pass). Defaults to "light". */
  modalTheme?: EmailCaptureModalTheme;
  animationsEnabled?: boolean;
  children: React.ReactNode;
}

/**
 * Shared CTA button that supports four click behaviors:
 *   1. "url"              → call `onClick` (host wires navigation/analytics)
 *   2. "chilipiper"       → open Chili Piper iframe popup with `chilipiperUrl`
 *   3. "modal-form"       → open EmailCaptureModal in form mode (uses modal* config)
 *   4. "modal-chilipiper" → open EmailCaptureModal in chilipiper mode (uses modalChilipiperUrl)
 *
 * The modal modes mirror the BlockDandyProductHero email-pill flow so any
 * normal CTA button (no inline email input) can collect a lead and hand off
 * to Chili Piper without bespoke wiring per block.
 */
export function CtaButton({
  ctaAction = "url",
  ctaUrl,
  chilipiperUrl,
  videoUrl,
  videoPosterUrl,
  modalChilipiperUrl,
  modalFormSource = "simple",
  modalFormId,
  modalMarketoBaseUrl,
  modalMarketoMunchkinId,
  modalMarketoFormId,
  modalChiliPiperHandoffUrl,
  modalChiliPiperHandoffMode,
  modalChiliPiperHandoffFieldMap,
  modalHeadline,
  modalSubheadline,
  modalSubmitText,
  modalSuccessMessage,
  modalDisclaimer,
  modalShowFirstName,
  modalShowLastName,
  modalShowPhone,
  modalShowCompany,
  onClick,
  className,
  style,
  brand,
  pageId,
  variantId,
  source,
  modalTheme,
  animationsEnabled = true,
  children,
}: CtaButtonProps) {
  const [open, setOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  // Fall back to the shared brand config (used by every other modal-CTA in
  // the studio) when the host block doesn't pass `brand` explicitly. Without
  // this the EmailCaptureModal renders "Brand context is missing." for any
  // Inside-Dandy CTA that opens a form.
  const ctxBrand = useBrandConfig();
  const resolvedBrand = brand ?? ctxBrand ?? undefined;
  const ctx = usePageContext();
  const resolvedPageId = pageId ?? ctx.pageId ?? undefined;
  const resolvedVariantId = variantId ?? ctx.variantId ?? undefined;

  // ── Unified CTA inheritance (Phase 1, backward-compatible) ─────────────────
  // A button that ALREADY has its own action/destination keeps it verbatim
  // (block layer wins) — so every existing CTA renders byte-for-byte as today.
  // ONLY when this button supplies no action AND no destination do we inherit
  // the page CTA, then the tenant default, via the shared resolver. This is
  // strictly additive: today such a button renders a dead "#"; now it can
  // inherit a real action. Pages/tenants without a CTA in context (the common
  // case, and every pre-feature page) resolve to an empty config → unchanged.
  const blockCta: CtaConfig = {
    action: ctaAction,
    url: ctaUrl,
    chilipiper: chilipiperUrl,
    videoUrl,
    videoPosterUrl,
    modalChilipiperUrl, modalFormSource, modalFormId,
    modalMarketoBaseUrl, modalMarketoMunchkinId, modalMarketoFormId,
    modalChiliPiperHandoffUrl, modalChiliPiperHandoffMode, modalChiliPiperHandoffFieldMap,
    modalHeadline, modalSubheadline, modalSubmitText, modalSuccessMessage, modalDisclaimer,
    modalShowFirstName, modalShowLastName, modalShowPhone, modalShowCompany,
  };
  const shouldInherit =
    !ctaConfigHasValue(blockCta) &&
    (ctaConfigHasValue(ctx.pageCta) || ctaConfigHasValue(ctx.tenantDefaultCta));
  const eff = shouldInherit
    ? resolveCtaConfig({
        tenantDefault: ctx.tenantDefaultCta,
        pageOverride: ctx.pageCta,
        blockOverride: blockCta,
      })
    : blockCta;
  // Effective values (block-own when present; inherited only when the block had none).
  const effAction = eff.action ?? ctaAction;
  const effUrl = eff.url ?? ctaUrl;
  const effChilipiper = eff.chilipiper ?? chilipiperUrl;
  const effVideoUrl = eff.videoUrl ?? videoUrl;
  const effVideoPosterUrl = eff.videoPosterUrl ?? videoPosterUrl;
  const effModalChilipiperUrl = eff.modalChilipiperUrl ?? modalChilipiperUrl;

  // Chili Piper iframe popup (existing behavior).
  if (effAction === "chilipiper" && effChilipiper) {
    return (
      <ChiliPiperButton url={effChilipiper} className={className} style={style}>
        {children}
      </ChiliPiperButton>
    );
  }

  const isModal = effAction === "modal-form" || effAction === "modal-chilipiper";
  const isVideo = effAction === "video-modal";

  const button = (
    <motion.button
      type="button"
      onClick={() => {
        if (isModal) {
          // Modal IS the action — never fire host onClick (which typically
          // navigates to the brand-default URL) alongside the modal, or
          // every retrofitted CTA opens a tab AND the capture modal.
          setOpen(true);
          return;
        }
        if (isVideo && effVideoUrl && effVideoUrl.trim() !== "") {
          // Same reasoning for the inline video overlay.
          setVideoOpen(true);
          return;
        }
        onClick?.();
        // URL-mode fallback: if no host onClick wired navigation, navigate here.
        if (!onClick && effAction === "url" && effUrl && effUrl !== "#") {
          // Same-page anchors and relative paths navigate in the same tab so
          // anchor links scroll instead of opening a (popup-blocked) new tab.
          const trimmed = effUrl.trim();
          const isSameTab = trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("?");
          safeNavigate(effUrl, isSameTab ? "_self" : "_blank");
        }
      }}
      className={className}
      style={{ cursor: "pointer", ...style }}
      whileHover={animationsEnabled ? { scale: 1.04, y: -1 } : undefined}
      whileTap={animationsEnabled ? { scale: 0.96 } : undefined}
      transition={SPRING}
    >
      {children}
    </motion.button>
  );

  if (isVideo) {
    return (
      <>
        {button}
        <VideoModal
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          videoUrl={effVideoUrl}
          posterUrl={effVideoPosterUrl}
          ariaLabel="Video"
        />
      </>
    );
  }

  if (!isModal) return button;

  return (
    <>
      {button}
      <EmailCaptureModal
        open={open}
        onClose={() => setOpen(false)}
        email=""
        mode={effAction === "modal-chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={effModalChilipiperUrl}
        formSource={eff.modalFormSource ?? modalFormSource}
        linkedFormId={eff.modalFormId ?? modalFormId}
        marketoBaseUrl={eff.modalMarketoBaseUrl ?? modalMarketoBaseUrl}
        marketoMunchkinId={eff.modalMarketoMunchkinId ?? modalMarketoMunchkinId}
        marketoFormId={eff.modalMarketoFormId ?? modalMarketoFormId}
        chiliPiperConfig={
          (eff.modalChiliPiperHandoffUrl ?? modalChiliPiperHandoffUrl)
            ? {
                url: (eff.modalChiliPiperHandoffUrl ?? modalChiliPiperHandoffUrl)!,
                mode: (eff.modalChiliPiperHandoffMode ?? modalChiliPiperHandoffMode) ?? "modal",
                fieldMap: eff.modalChiliPiperHandoffFieldMap ?? modalChiliPiperHandoffFieldMap,
              }
            : null
        }
        formConfig={{
          headline: eff.modalHeadline ?? modalHeadline,
          subheadline: eff.modalSubheadline ?? modalSubheadline,
          submitText: eff.modalSubmitText ?? modalSubmitText,
          successMessage: eff.modalSuccessMessage ?? modalSuccessMessage,
          disclaimer: eff.modalDisclaimer ?? modalDisclaimer,
          showFirstName: eff.modalShowFirstName ?? modalShowFirstName,
          showLastName: eff.modalShowLastName ?? modalShowLastName,
          showPhone: eff.modalShowPhone ?? modalShowPhone,
          showCompany: eff.modalShowCompany ?? modalShowCompany,
        }}
        brand={resolvedBrand}
        pageId={resolvedPageId}
        variantId={resolvedVariantId}
        source={source}
        theme={modalTheme ?? resolvedBrand?.modalTheme ?? undefined}
      />
    </>
  );
}
