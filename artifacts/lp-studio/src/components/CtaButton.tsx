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

  // Chili Piper iframe popup (existing behavior).
  if (ctaAction === "chilipiper" && chilipiperUrl) {
    return (
      <ChiliPiperButton url={chilipiperUrl} className={className} style={style}>
        {children}
      </ChiliPiperButton>
    );
  }

  const isModal = ctaAction === "modal-form" || ctaAction === "modal-chilipiper";
  const isVideo = ctaAction === "video-modal";

  const button = (
    <motion.button
      type="button"
      onClick={() => {
        onClick?.();
        if (isModal) setOpen(true);
        if (isVideo && videoUrl && videoUrl.trim() !== "") setVideoOpen(true);
        // URL-mode fallback: if no host onClick wired navigation, navigate here.
        if (!isModal && !isVideo && !onClick && ctaAction === "url" && ctaUrl && ctaUrl !== "#") {
          // Same-page anchors and relative paths navigate in the same tab so
          // anchor links scroll instead of opening a (popup-blocked) new tab.
          const trimmed = ctaUrl.trim();
          const isSameTab = trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("?");
          safeNavigate(ctaUrl, isSameTab ? "_self" : "_blank");
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
          videoUrl={videoUrl}
          posterUrl={videoPosterUrl}
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
        mode={ctaAction === "modal-chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={modalChilipiperUrl}
        formSource={modalFormSource}
        linkedFormId={modalFormId}
        marketoBaseUrl={modalMarketoBaseUrl}
        marketoMunchkinId={modalMarketoMunchkinId}
        marketoFormId={modalMarketoFormId}
        chiliPiperConfig={
          modalFormSource === "marketo" && modalChiliPiperHandoffUrl
            ? {
                url: modalChiliPiperHandoffUrl,
                mode: modalChiliPiperHandoffMode ?? "modal",
                fieldMap: modalChiliPiperHandoffFieldMap,
              }
            : null
        }
        formConfig={{
          headline: modalHeadline,
          subheadline: modalSubheadline,
          submitText: modalSubmitText,
          successMessage: modalSuccessMessage,
          disclaimer: modalDisclaimer,
          showFirstName: modalShowFirstName,
          showLastName: modalShowLastName,
          showPhone: modalShowPhone,
          showCompany: modalShowCompany,
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
