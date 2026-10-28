/**
 * Content Hub — the gate modal. Thin wrapper over the shared
 * EmailCaptureModal so a gated resource asks with the same form every CTA
 * button can open (simple / linked global form / Marketo), then records the
 * unlock and lets the host finish the action the visitor started.
 */
import type { BrandConfig } from "@/lib/brand-config";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { usePageContext } from "@/lib/page-context";
import type { HubPalette } from "@/lib/hub-theme";
import { HUB_GATE_DEFAULTS, writeHubUnlock, type HubGateConfig } from "./hub-gate";

export interface HubGateModalProps {
  gate: HubGateConfig | undefined;
  open: boolean;
  onClose: () => void;
  /** The visitor submitted: the unlock is already stored. Finish the pending action here. */
  onUnlocked: () => void;
  palette: HubPalette;
  brand: BrandConfig;
}

export function HubGateModal({ gate, open, onClose, onUnlocked, palette, brand }: HubGateModalProps) {
  const { pageId, variantId, sessionId } = usePageContext();
  const cfg = { ...HUB_GATE_DEFAULTS, ...(gate ?? {}) };
  return (
    <EmailCaptureModal
      open={open}
      onClose={onClose}
      email=""
      mode="form"
      formSource={cfg.modalFormSource ?? "simple"}
      linkedFormId={cfg.modalFormId}
      marketoBaseUrl={cfg.modalMarketoBaseUrl}
      marketoMunchkinId={cfg.modalMarketoMunchkinId}
      marketoFormId={cfg.modalMarketoFormId}
      chiliPiperConfig={
        cfg.modalChiliPiperHandoffUrl
          ? { url: cfg.modalChiliPiperHandoffUrl, mode: cfg.modalChiliPiperHandoffMode ?? "modal", fieldMap: cfg.modalChiliPiperHandoffFieldMap }
          : null
      }
      formConfig={{
        headline: cfg.modalHeadline,
        subheadline: cfg.modalSubheadline,
        submitText: cfg.modalSubmitText,
        successMessage: cfg.modalSuccessMessage,
        disclaimer: cfg.modalDisclaimer,
        showFirstName: cfg.modalShowFirstName,
        showLastName: cfg.modalShowLastName,
        showPhone: cfg.modalShowPhone,
        showCompany: cfg.modalShowCompany,
      }}
      theme={palette.isDark ? "dark" : "light"}
      brand={brand}
      pageId={pageId}
      variantId={variantId}
      sessionId={sessionId}
      source="hub-gate"
      onSubmitted={(r) => {
        writeHubUnlock({ leadId: r.leadId, email: r.email });
        onUnlocked();
      }}
    />
  );
}
