import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, Loader2, X } from "lucide-react";
import { MarketoForm } from "@/components/MarketoForm";
import { BlockForm } from "@/blocks/BlockForm";
import type { BrandConfig } from "@/lib/brand-config";
import type { FormBlockProps, ChiliPiperHandoffConfig } from "@/lib/block-types";
import { buildChiliPiperHandoffUrl } from "@/lib/chili-piper-handoff";
import { ChiliPiperIframe, useChiliPiperBookingTracking } from "@/blocks/ChiliPiperModal";
import { safeNavigate } from "@/lib/safe-url";
import { useLinkedFormStyle } from "@/components/LinkedFormStyleContext";

export type EmailCaptureModalMode = "form" | "chilipiper";
export type EmailCaptureFormSource = "simple" | "linked" | "marketo";

const LINKED_FORM_DEFAULTS: Partial<FormBlockProps> = {
  headline: "",
  subheadline: "",
  multiStep: false,
  steps: [],
  submitButtonText: "Submit",
  successMessage: "Thanks! We'll be in touch shortly.",
  redirectUrl: "",
  backgroundStyle: "white",
  cardStyle: "minimal",
  cardRadius: "2xl",
  labelStyle: "uppercase",
};

export interface EmailCaptureFormConfig {
  showFirstName?: boolean;
  showLastName?: boolean;
  showPhone?: boolean;
  showCompany?: boolean;
  headline?: string;
  subheadline?: string;
  submitText?: string;
  successMessage?: string;
  disclaimer?: string;
}

export interface EmailCaptureModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  mode: EmailCaptureModalMode;
  /** Required when mode === "chilipiper". Email is appended as ?email=… */
  chilipiperUrl?: string;
  formConfig?: EmailCaptureFormConfig;
  /** Form source when mode === "form". "simple" (default) uses formConfig,
   *  "linked" renders a global form by id, "marketo" embeds a Marketo form. */
  formSource?: EmailCaptureFormSource;
  /** Linked global form id (required when formSource === "linked"). */
  linkedFormId?: number;
  /** Marketo config (required when formSource === "marketo"). */
  marketoBaseUrl?: string;
  marketoMunchkinId?: string;
  marketoFormId?: number;
  /**
   * Optional Chili Piper hand-off applied after a Marketo submission.
   * When set, the modal swaps the Marketo form for an inline Chili Piper
   * iframe with the submitted identity prefilled. Mirrors the BlockForm
   * Marketo branch so the same form opened from a CTA modal behaves
   * identically to the form rendered directly on the page.
   */
  chiliPiperConfig?: ChiliPiperHandoffConfig | null;
  /** Optional theme. Defaults to brand-primary / brand-accent CSS vars. */
  primaryColor?: string;
  accentColor?: string;
  /** Brand passed through to embedded BlockForm when formSource === "linked". */
  brand?: BrandConfig;
  /** Submit metadata. */
  pageId?: number;
  variantId?: number;
  source?: string;
}

function appendEmail(base: string, email: string): string {
  if (!base) return base;
  try {
    const url = new URL(base);
    if (email) url.searchParams.set("email", email);
    return url.toString();
  } catch {
    if (!email) return base;
    return `${base}${base.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`;
  }
}

export function EmailCaptureModal({
  open,
  onClose,
  email,
  mode,
  chilipiperUrl,
  formConfig,
  formSource = "simple",
  linkedFormId,
  marketoBaseUrl,
  marketoMunchkinId,
  marketoFormId,
  chiliPiperConfig,
  primaryColor,
  accentColor,
  brand,
  pageId,
  variantId,
  source,
}: EmailCaptureModalProps) {
  // Per-page color overrides for linked-form rendering inside the modal.
  // Provided by <LinkedFormStyleProvider> in landing-page-viewer; null on
  // pages without overrides configured.
  const linkedStyle = useLinkedFormStyle();
  const cfg: Required<EmailCaptureFormConfig> = {
    showFirstName: formConfig?.showFirstName ?? true,
    showLastName: formConfig?.showLastName ?? true,
    showPhone: formConfig?.showPhone ?? true,
    showCompany: formConfig?.showCompany ?? false,
    headline: formConfig?.headline ?? "Tell us a bit about you",
    subheadline: formConfig?.subheadline ?? "We'll be in touch shortly.",
    submitText: formConfig?.submitText ?? "Submit",
    successMessage: formConfig?.successMessage ?? "Thanks! We'll be in touch shortly.",
    disclaimer: formConfig?.disclaimer ?? "",
  };

  const primary = primaryColor ?? "var(--brand-primary, #003a30)";
  const accent = accentColor ?? "var(--brand-accent, #c7e738)";

  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: email || "",
    phone: "",
    company: "",
  });
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [chiliPiperHandoffUrl, setChiliPiperHandoffUrl] = useState<string | null>(null);
  // Record the second `chilipiper_booking` conversion when the iframe fires
  // its booking-confirmed postMessage. Hook is benign while the URL is empty.
  useChiliPiperBookingTracking({
    url: chiliPiperHandoffUrl ?? "",
    pageId,
    variantId,
  });

  useEffect(() => {
    if (open) {
      setData((d) => ({ ...d, email: email || "" }));
      setState("idle");
      setChiliPiperHandoffUrl(null);
    }
  }, [open, email]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const cpUrl = mode === "chilipiper" && chilipiperUrl ? appendEmail(chilipiperUrl, email) : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    try {
      if (pageId) {
        await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId,
            variantId,
            fields: {
              firstName: cfg.showFirstName ? data.firstName : undefined,
              lastName: cfg.showLastName ? data.lastName : undefined,
              email: data.email,
              phone: cfg.showPhone ? data.phone || undefined : undefined,
              company: cfg.showCompany ? data.company || undefined : undefined,
              source: source || "email-capture-modal",
            },
          }),
        });
      }
    } catch {
      // continue silently
    }
    setState("success");
  };

  const inputCls =
    "w-full border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900 outline-none transition-colors";
  const labelCls = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
      onClick={onBackdrop}
    >
      {mode === "chilipiper" ? (
        <div className="relative w-full max-w-3xl h-[min(90vh,720px)] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: primary }} />
              <span className="text-sm font-semibold" style={{ color: primary }}>
                Schedule a Meeting
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {cpUrl ? (
            <iframe
              src={cpUrl}
              className="flex-1 w-full border-none"
              allow="camera; microphone; clipboard-write"
              title="Schedule"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              Scheduling link not configured.
            </div>
          )}
        </div>
      ) : formSource === "marketo" ? (
        // Once the scheduler is showing, expand to the wider/taller chilipiper
        // shell (matches `mode === "chilipiper"` modal above) and drop the
        // form headline/subheadline + inner padding so the iframe fills the
        // modal instead of sitting in a small inner card.
        chiliPiperHandoffUrl ? (
          <div className="relative w-full max-w-3xl h-[min(90vh,720px)] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full bg-white/80 z-10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <ChiliPiperIframe
              url={chiliPiperHandoffUrl}
              className="flex-1 w-full border-0"
              onUnavailable={() => {
                safeNavigate(chiliPiperHandoffUrl, "_blank");
                setChiliPiperHandoffUrl(null);
                onClose();
              }}
            />
          </div>
        ) : (
        // `max-h-[90vh] overflow-y-auto` lets tall Marketo embeds (many
        // fields, e.g. the Trios DSO form) scroll inside the modal instead
        // of overflowing the viewport — without this the card grows past
        // the screen and the outer `items-center` flex clips both the top
        // fields and the submit button. The close button is `sticky` so it
        // stays reachable while the form scrolls.
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          {/* Sticky header row keeps the close button reachable while the
              form scrolls inside the modal, without the float/negative-margin
              coupling of an absolute-positioned button. */}
          <div className="sticky top-0 z-10 flex justify-end p-2 bg-white/85 backdrop-blur-sm">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-7 pb-7 sm:px-9 sm:pb-9 pt-1">
            {(cfg.headline || cfg.subheadline) && (
              <div className="mb-5">
                {cfg.headline && (
                  <h3 className="text-xl font-bold mb-1" style={{ color: primary }}>{cfg.headline}</h3>
                )}
                {cfg.subheadline && (
                  <p className="text-sm text-slate-500">{cfg.subheadline}</p>
                )}
              </div>
            )}
            {marketoBaseUrl && marketoMunchkinId && marketoFormId ? (
              <MarketoForm
                baseUrl={marketoBaseUrl}
                munchkinId={marketoMunchkinId}
                formId={marketoFormId}
                // Opt-in to the scoped brand restyle so the embedded Marketo
                // form visually matches the rest of the modal's chrome.
                // Inline (non-modal) MarketoForm renders deliberately leave
                // this off and keep Marketo's default look — see
                // MarketoForm `scopedStyles` doc-comment.
                scopedStyles
                prefill={email ? { Email: email } : undefined}
                onSuccess={(vals) => {
                  if (chiliPiperConfig?.url) {
                    const url = buildChiliPiperHandoffUrl(chiliPiperConfig, vals);
                    if (chiliPiperConfig.mode === "redirect") {
                      // Redirect mode: open the scheduler in a new tab and
                      // close the capture modal, mirroring BlockForm behaviour.
                      safeNavigate(url, "_blank");
                      onClose();
                      return;
                    }
                    // Modal mode (default): swap the Marketo form for the
                    // full-bleed scheduler iframe rendered by the outer
                    // ternary above so the iframe fills the modal.
                    setChiliPiperHandoffUrl(url);
                    return;
                  }
                  setState("success");
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">Marketo form is not configured.</p>
            )}
            {state === "success" && (
              <div className="mt-5 flex items-center gap-2 text-sm" style={{ color: primary }}>
                <Check className="w-4 h-4" /> {cfg.successMessage}
              </div>
            )}
          </div>
        </div>
        )
      ) : formSource === "linked" ? (
        // max-w-2xl gives the embedded BlockForm — and especially the
        // Chili Piper iframe it swaps to after submit — enough room to
        // breathe (the form itself was fine narrower, but the scheduler
        // looked cramped at max-w-lg).
        <div
          className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: linkedStyle?.cardBg ?? "#ffffff", color: linkedStyle?.text }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full bg-white/80 z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="p-2 sm:p-3">
            {linkedFormId != null && brand ? (
              <BlockForm
                props={{
                  ...(LINKED_FORM_DEFAULTS as FormBlockProps),
                  formId: linkedFormId,
                  headline: cfg.headline,
                  subheadline: cfg.subheadline,
                  submitButtonText: cfg.submitText,
                  successMessage: cfg.successMessage,
                  // Per-page color overrides flow through the existing
                  // BlockForm style props so the in-modal linked form
                  // matches the host page's chosen palette.
                  ...(linkedStyle?.cardBg ? { cardBgColor: linkedStyle.cardBg } : {}),
                  ...(linkedStyle?.border ? { inputAccentColor: linkedStyle.border } : {}),
                  ...(linkedStyle?.button ? { submitButtonColor: linkedStyle.button } : {}),
                  ...(linkedStyle?.buttonText ? { submitButtonTextColor: linkedStyle.buttonText } : {}),
                  ...(linkedStyle?.text ? { textColor: linkedStyle.text } : {}),
                }}
                brand={brand}
                pageId={pageId}
                variantId={variantId}
                prefill={email ? { email } : undefined}
              />
            ) : (
              <p className="p-6 text-sm text-slate-500">
                {!brand ? "Brand context is missing." : "No form linked. Pick one in the property panel."}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full bg-white/80 z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="p-7 sm:p-9">
            {state === "success" ? (
              <div className="py-6 text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: accent }}
                >
                  <Check className="w-7 h-7" style={{ color: primary }} />
                </div>
                <p className="text-lg font-bold mb-2" style={{ color: primary }}>
                  {cfg.successMessage}
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold mb-1" style={{ color: primary }}>
                  {cfg.headline}
                </h3>
                {cfg.subheadline && (
                  <p className="text-sm text-slate-500 mb-5">{cfg.subheadline}</p>
                )}
                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                  {(cfg.showFirstName || cfg.showLastName) && (
                    <div className={cfg.showFirstName && cfg.showLastName ? "grid grid-cols-2 gap-3" : ""}>
                      {cfg.showFirstName && (
                        <div>
                          <label className={labelCls}>First Name</label>
                          <input
                            type="text"
                            value={data.firstName}
                            onChange={(e) => setData({ ...data, firstName: e.target.value })}
                            placeholder="Jane"
                            className={inputCls}
                            style={{ borderColor: undefined }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = primary)}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                            required
                            disabled={state === "loading"}
                          />
                        </div>
                      )}
                      {cfg.showLastName && (
                        <div>
                          <label className={labelCls}>Last Name</label>
                          <input
                            type="text"
                            value={data.lastName}
                            onChange={(e) => setData({ ...data, lastName: e.target.value })}
                            placeholder="Smith"
                            className={inputCls}
                            onFocus={(e) => (e.currentTarget.style.borderColor = primary)}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                            required
                            disabled={state === "loading"}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Work Email</label>
                    <input
                      type="email"
                      value={data.email}
                      onChange={(e) => setData({ ...data, email: e.target.value })}
                      placeholder="jane@yourpractice.com"
                      className={inputCls}
                      onFocus={(e) => (e.currentTarget.style.borderColor = primary)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                      required
                      disabled={state === "loading"}
                    />
                  </div>
                  {cfg.showPhone && (
                    <div>
                      <label className={labelCls}>Phone Number</label>
                      <input
                        type="tel"
                        value={data.phone}
                        onChange={(e) => setData({ ...data, phone: e.target.value })}
                        placeholder="(555) 000-0000"
                        className={inputCls}
                        onFocus={(e) => (e.currentTarget.style.borderColor = primary)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                        disabled={state === "loading"}
                      />
                    </div>
                  )}
                  {cfg.showCompany && (
                    <div>
                      <label className={labelCls}>Company</label>
                      <input
                        type="text"
                        value={data.company}
                        onChange={(e) => setData({ ...data, company: e.target.value })}
                        placeholder="Acme Dental"
                        className={inputCls}
                        onFocus={(e) => (e.currentTarget.style.borderColor = primary)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                        disabled={state === "loading"}
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={state === "loading"}
                    className="w-full font-bold py-3.5 rounded-xl text-base hover:brightness-105 transition-all mt-1 flex items-center justify-center gap-2 disabled:opacity-70"
                    style={{ backgroundColor: accent, color: primary }}
                  >
                    {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : cfg.submitText}
                  </button>
                  {cfg.disclaimer && (
                    <p className="text-xs text-slate-400 text-center mt-1">{cfg.disclaimer}</p>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
