import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, CheckCircle2, Calendar } from "lucide-react";
import { type BrandConfig, isValidHex, pickCtaButtonColors, pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import { resolveSectionInk } from "@/lib/section-ink";
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
  // Resolve the *effective* section background hex so the contrast guards work
  // even when `bg` is the `var(--brand-primary)` fallback (no explicit bgColor).
  // Previously the guard only ran for an AI/tenant-chosen hex; when the hero fell
  // back to the brand primary, the CTA (`var(--brand-accent)`) and the trust
  // stats (`var(--brand-accent)`) rendered accent-on-primary — i.e. blue button
  // and blue stats on a blue hero. Resolving the primary hex lets the same WCAG
  // guard pick contrasting colors in that case too.
  const bgHex = isValidHex(bg)
    ? bg
    : isValidHex(brand.primaryColor)
      ? brand.primaryColor
      : null;
  const ctaColors = bgHex ? pickCtaButtonColors(brand, bgHex) : null;
  const ctaBtnCls = ctaColors ? "" : "bg-[var(--brand-accent)] text-[var(--brand-cta-text)]";
  const ctaBtnStyle = ctaColors ? { backgroundColor: ctaColors.bg, color: ctaColors.text } : undefined;
  // Accent text (eyebrow + trust stats) must read on the hero bg. The brand
  // accent often equals/approximates the primary, so use it only when it
  // contrasts; otherwise fall back to white/near-black against the actual bg.
  const accentOnBg = bgHex
    ? pickContrastingColor(
        isValidHex(brand.accentColor) ? brand.accentColor : null,
        bgHex,
        ["#ffffff", "#0f172a"],
        4.5,
      )
    : null;
  // Derive text tone from the surface the hero ACTUALLY paints. The headline,
  // subheadline, trust stats and disclaimer used to be hard-coded white, so on
  // a light brand primary (e.g. a pale tenant) they rendered white-on-white —
  // invisible. Resolve inks from the real surface hex (same value the contrast
  // math uses) so light surfaces get dark text and the white email input gets a
  // visible border.
  const inkBase = bgHex ?? "#0f172a";
  const surfaceIsDark = relativeLuminance(inkBase) < 0.4;
  const ink = resolveSectionInk({}, { base: inkBase });
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
      style={{ backgroundColor: bgHex ?? bg, minHeight: "min(85vh, 780px)" }}
    >
      {bgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})`, opacity: props.bgImageOpacity ?? 0.15 }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center text-center py-24 md:py-32 px-6 w-full max-w-4xl mx-auto">
        {props.eyebrow && (
          <p
            className={`text-xs font-bold uppercase tracking-widest mb-5 ${accentOnBg ? "" : "text-[var(--brand-accent)]"}`}
            style={accentOnBg ? { fontFamily: BODY, color: accentOnBg } : { fontFamily: BODY }}
          >
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
          </p>
        )}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6"
          style={{ fontWeight: "var(--brand-heading-weight, 700)" as unknown as number, fontFamily: DISPLAY, color: ink.text }}
        >
          <InlineText value={props.headline} onUpdate={field("headline")} style={{ fontFamily: DISPLAY }}/>
        </h1>
        {props.subheadline && (
          <p className="text-xl leading-relaxed mb-10 max-w-2xl" style={{ fontFamily: BODY, color: ink.muted }}>
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
            className={`${ctaBtnCls} font-bold px-8 py-4 rounded-xl text-base whitespace-nowrap hover:brightness-105 transition-all shrink-0 flex items-center gap-2`}
            style={ctaBtnStyle}
          >
            <InlineText value={props.ctaText ?? "Get Started"} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>
          </CtaButton>
        ) : formState === "success" ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl px-8 py-6 max-w-md w-full" style={{ backgroundColor: ink.hairline, border: `1px solid ${ink.hairline}` }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: accentOnBg ?? "var(--brand-accent)" }} />
            <p className="font-bold text-lg" style={{ fontFamily: BODY, color: ink.text }}>You're on the list!</p>
            <p className="text-sm" style={{ fontFamily: BODY, color: ink.muted }}>Check your inbox — we'll be in touch shortly.</p>
            {props.chilipiperUrl && (
              <button
                onClick={() => { setCpUrl(buildCpUrl(props.chilipiperUrl!, email.trim())); setCpOpen(true); }}
                className={`mt-1 flex items-center gap-2 ${ctaBtnCls} font-bold px-5 py-2.5 rounded-full text-sm`}
                style={ctaBtnStyle}
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
              className={`flex-1 px-6 py-4 rounded-xl text-slate-900 bg-white text-base font-medium outline-none border-2 ${surfaceIsDark ? "border-transparent" : "border-slate-300"} focus:border-[var(--brand-accent)] transition-colors`}
              required
              disabled={formState === "loading"}
            />
            <button
              type="submit"
              disabled={formState === "loading"}
              className={`${ctaBtnCls} font-bold px-8 py-4 rounded-xl text-base whitespace-nowrap hover:brightness-105 transition-all shrink-0 flex items-center gap-2 disabled:opacity-70`}
              style={ctaBtnStyle}
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
          <p className="mt-4 text-sm" style={{ fontFamily: BODY, color: ink.muted }}>
            <InlineText value={props.formDisclaimer} onUpdate={field("formDisclaimer")} style={{ fontFamily: BODY }}/>
          </p>
        )}

        {(props.trustItems ?? []).length > 0 && (
          <div className="mt-14 flex flex-wrap justify-center gap-x-12 gap-y-4 pt-10 border-t w-full" style={{ borderColor: ink.hairline }}>
            {(props.trustItems ?? []).map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span
                  className={`text-3xl font-bold ${accentOnBg ? "" : "text-[var(--brand-accent)]"}`}
                  style={accentOnBg ? { fontFamily: BODY, color: accentOnBg } : { fontFamily: BODY }}
                >{item.value}</span>
                <span className="text-sm" style={{ fontFamily: BODY, color: ink.muted }}>{item.label}</span>
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
