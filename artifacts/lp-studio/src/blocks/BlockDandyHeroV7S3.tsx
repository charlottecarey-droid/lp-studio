import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, CheckCircle2, Calendar } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyHeroV7S3BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { pushMarketoSubmissionToDataLayer } from "@/lib/gtm-datalayer";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { CtaButton } from "@/components/CtaButton";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: DandyHeroV7S3BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyHeroV7S3BlockProps) => void;
  pageId?: number;
  variantId?: number;
}

type FormState = "idle" | "loading" | "success";

function buildCpUrl(base: string, email: string): string {
  try {
    const url = new URL(base);
    if (email) url.searchParams.set("email", email);
    return url.toString();
  } catch {
    return base;
  }
}

export function BlockDandyHeroV7S3({ props, brand, onFieldChange, pageId, variantId }: Props) {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [cpOpen, setCpOpen] = useState(false);
  const [cpUrl, setCpUrl] = useState("");

  const ctaAction = props.ctaAction ?? "inline-form";

  const bg = props.bgColor ?? "var(--brand-primary)";
  const bgImage = props.backgroundImageUrl;

  const field = (key: keyof DandyHeroV7S3BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setFormState("loading");
    try {
      if (pageId) {
        await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId,
            variantId,
            fields: { email: trimmed, source: "dandy-hero-v7-s3" },
          }),
        });
      }
    } catch {
      // silently continue — don't block UX
    }
    // GTM dataLayer push (marketing's "Marketo Form Submission" event).
    // Helper dedupes per page load and is safe to call after any submit.
    try {
      pushMarketoSubmissionToDataLayer();
    } catch (err) {
      console.error("[lp-studio] dataLayer push threw:", err);
    }
    setFormState("success");
    if (props.chilipiperUrl) {
      setCpUrl(buildCpUrl(props.chilipiperUrl, trimmed));
      setCpOpen(true);
    }
  };

  return (
    <section
      className="relative w-full overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: bg, minHeight: "min(85vh, 780px)" }}
    >
      {bgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})`, opacity: props.bgImageOpacity ?? 0.15 }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center text-center py-24 md:py-32 px-6 w-full max-w-4xl mx-auto">
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-accent)] mb-5" style={{ fontFamily: BODY }}>
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
          </p>
        )}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight mb-6"
          style={{ fontWeight: "var(--brand-heading-weight, 700)" as unknown as number, fontFamily: DISPLAY }}
        >
          <InlineText value={props.headline} onUpdate={field("headline")} style={{ fontFamily: DISPLAY }}/>
        </h1>
        {props.subheadline && (
          <p className="text-xl text-white/80 leading-relaxed mb-10 max-w-2xl" style={{ fontFamily: BODY }}>
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} style={{ fontFamily: BODY }}/>
          </p>
        )}

        {ctaAction !== "inline-form" ? (
          <CtaButton
            ctaAction={ctaAction}
            ctaUrl={props.ctaUrl}
            chilipiperUrl={props.chilipiperUrl}
            modalChilipiperUrl={props.modalChilipiperUrl}
            modalFormSource={props.modalFormSource}
            modalFormId={props.modalFormId}
            modalMarketoBaseUrl={props.modalMarketoBaseUrl}
            modalMarketoMunchkinId={props.modalMarketoMunchkinId}
            modalMarketoFormId={props.modalMarketoFormId}
            modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
            modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
            modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
            modalHeadline={props.modalHeadline}
            modalSubheadline={props.modalSubheadline}
            modalSubmitText={props.modalSubmitText}
            modalSuccessMessage={props.modalSuccessMessage}
            modalDisclaimer={props.modalDisclaimer}
            modalShowFirstName={props.modalShowFirstName}
            modalShowLastName={props.modalShowLastName}
            modalShowPhone={props.modalShowPhone}
            modalShowCompany={props.modalShowCompany}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            source="dandy-hero-v7-s3"
            className="bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold px-8 py-4 rounded-xl text-base whitespace-nowrap hover:brightness-105 transition-all shrink-0 flex items-center gap-2"
          >
            <InlineText value={props.ctaText ?? "Get Started"} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>
          </CtaButton>
        ) : formState === "success" ? (
          <div className="flex flex-col items-center gap-3 bg-white/10 border border-white/20 rounded-2xl px-8 py-6 max-w-md w-full">
            <CheckCircle2 className="w-8 h-8 text-[var(--brand-accent)]" />
            <p className="text-white font-bold text-lg" style={{ fontFamily: BODY }}>You're on the list!</p>
            <p className="text-white/70 text-sm" style={{ fontFamily: BODY }}>Check your inbox — we'll be in touch shortly.</p>
            {props.chilipiperUrl && (
              <button
                onClick={() => { setCpUrl(buildCpUrl(props.chilipiperUrl!, email.trim())); setCpOpen(true); }}
                className="mt-1 flex items-center gap-2 bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold px-5 py-2.5 rounded-full text-sm"
              >
                <Calendar className="w-3.5 h-3.5" /> Schedule a call
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col sm:flex-row gap-3 shadow-2xl">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={props.inputPlaceholder ?? "Enter your work email"}
              className="flex-1 px-6 py-4 rounded-xl text-slate-900 bg-white text-base font-medium outline-none border-2 border-transparent focus:border-[var(--brand-accent)] transition-colors"
              required
              disabled={formState === "loading"}
            />
            <button
              type="submit"
              disabled={formState === "loading"}
              className="bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold px-8 py-4 rounded-xl text-base whitespace-nowrap hover:brightness-105 transition-all shrink-0 flex items-center gap-2 disabled:opacity-70"
            >
              {formState === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <InlineText value={props.ctaText ?? "Get Started"} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>
              )}
            </button>
          </form>
        )}

        {props.formDisclaimer && ctaAction === "inline-form" && formState !== "success" && (
          <p className="mt-4 text-sm text-white/60" style={{ fontFamily: BODY }}>
            <InlineText value={props.formDisclaimer} onUpdate={field("formDisclaimer")} style={{ fontFamily: BODY }}/>
          </p>
        )}

        {(props.trustItems ?? []).length > 0 && (
          <div className="mt-14 flex flex-wrap justify-center gap-x-12 gap-y-4 pt-10 border-t border-white/10 w-full">
            {(props.trustItems ?? []).map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-3xl font-bold text-[var(--brand-accent)]" style={{ fontFamily: BODY }}>{item.value}</span>
                <span className="text-sm text-white/70" style={{ fontFamily: BODY }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {cpOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setCpOpen(false); }}
        >
          <div className="relative w-full max-w-3xl h-[min(90vh,720px)] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--brand-primary)]" />
                <span className="text-sm font-semibold text-[var(--brand-primary)]" style={{ fontFamily: BODY }}>Schedule a Meeting</span>
              </div>
              <button onClick={() => setCpOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe src={cpUrl} className="flex-1 w-full border-none" allow="camera; microphone; clipboard-write" title="Schedule" />
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
