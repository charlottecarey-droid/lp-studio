import { useState } from "react";
import { Check } from "lucide-react";
import { type BrandConfig, pickContrastingColor, pickCtaButtonColors, pickOutlineButtonColors } from "@/lib/brand-config";
import type { DandySideImageV6BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { InlineEmailCapture } from "@/components/InlineEmailCapture";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { useBlockFonts } from "@/lib/use-block-fonts";

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1200&h=900&fit=crop";

interface Props {
  props: DandySideImageV6BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySideImageV6BlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockDandySideImageV6({ props, brand, onFieldChange, pageId, variantId }: Props) {
  useBlockFonts(props.headlineFont, props.bodyFont);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const reversed = props.imagePosition === "left";
  const surface = resolveSectionSurface(props, "#FDFCFA");
  // Heading: an explicit override wins; otherwise keep the branded near-black on
  // light surfaces and fall back to a light foreground on dark/gradient surfaces
  // (presets expose surface.color; a custom dark hex only reports isDark, so
  // handle that too).
  const heading = props.textColor ?? surface.color ?? (surface.isDark ? "#FFFFFF" : "var(--brand-heading-on-light, #0F172A)");
  const muted = props.textColor ?? pickContrastingColor(undefined, surface.base, ["#475569", "#94A3B8"]);
  // Eyebrow reads as the accent override (or brand accent) but must stay legible
  // on the section bg.
  const eyebrow = pickContrastingColor(props.accentColor ?? brand.accentColor, surface.base, [brand.primaryColor, "#006651"], 3.0);
  // CTA colors guard against "brand button on brand-colored section" by
  // resolving against the actual section surface.
  const ctaColors = pickCtaButtonColors(brand, surface.base);
  const outlineColors = pickOutlineButtonColors(brand, surface.base);
  const ctaBg = props.ctaButtonColor || ctaColors.bg;
  const ctaInk = props.ctaButtonTextColor || (props.ctaButtonColor ? pickContrastingColor(undefined, props.ctaButtonColor, ["#FFFFFF", "#0F172A"]) : ctaColors.text);
  const ctaStyle = props.ctaStyle ?? "buttons";
  const submitMode = props.submitMode ?? "navigate";

  // ── Inline email-capture pill state + submit routing (mirrors the hero family) ──
  const [email, setEmail] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const handleEmailSubmit = (value: string) => {
    const trimmed = value.trim();
    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setEmailModalOpen(true);
      return;
    }
    if (!trimmed) return;
    const ctaUrl = props.ctaUrl?.trim() ?? "";
    if (ctaUrl.startsWith("#") && ctaUrl.length > 1) {
      const target = document.getElementById(ctaUrl.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    const brandDefault = brand.defaultCtaUrl?.trim() ?? "";
    const real = (u: string) => !!u && u !== "#" && !u.startsWith("#");
    const dest = real(ctaUrl) ? ctaUrl : real(brandDefault) ? brandDefault : "";
    if (dest) {
      try {
        const url = new URL(dest, window.location.origin);
        url.searchParams.set("email", trimmed);
        window.location.assign(url.toString());
        return;
      } catch {
        // fall through to the modal
      }
    }
    setEmailModalOpen(true);
  };
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#006651";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const glow = accent;

  const field = (key: keyof DandySideImageV6BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    const bullets = [...(props.bullets ?? [])];
    bullets[i] = v;
    onFieldChange({ ...props, bullets });
  };

  const textCol = (
    <div className="flex flex-col justify-center gap-6 py-4">
      {props.eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: eyebrow, fontFamily: BODY }}>
          <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }} />
        </p>
      )}
      <h2 className="text-balance text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight" style={{ color: heading, fontFamily: DISPLAY }}>
        <InlineText value={props.headline} onUpdate={field("headline")} style={{ fontFamily: DISPLAY }} />
      </h2>
      {props.subheadline && (
        <p className="text-lg leading-relaxed" style={{ color: muted, fontFamily: BODY }}>
          <InlineText value={props.subheadline} onUpdate={field("subheadline")} style={{ fontFamily: BODY }} />
        </p>
      )}
      {(props.bullets ?? []).length > 0 && (
        <ul className="mt-1 space-y-4">
          {(props.bullets ?? []).map((b, i) => (
            <li key={i} className="flex items-start gap-4 text-base" style={{ color: muted, fontFamily: BODY }}>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: accent, fontFamily: BODY }}>
                <Check className="h-3.5 w-3.5" style={{ color: onAccent }} />
              </span>
              <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} style={{ fontFamily: BODY }} />
            </li>
          ))}
        </ul>
      )}
      {ctaStyle === "email-capture" ? (
        <div className="mt-3" style={{ fontFamily: BODY }}>
          <InlineEmailCapture
            email={email}
            onEmailChange={setEmail}
            onSubmit={handleEmailSubmit}
            placeholder={props.emailCapturePlaceholder || "Email address"}
            buttonText={props.emailCaptureButtonText || props.ctaText || "Get started"}
            buttonBg={ctaBg}
            buttonColor={ctaInk}
            pillBg={surface.isDark ? "rgba(255,255,255,0.96)" : "#FFFFFF"}
            pillBorder={surface.isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)"}
            pillShadow="0 18px 40px -20px rgba(15,23,42,0.35)"
            maxWidth="460px"
            className="dandy-side-image-v6-pill"
          />
        </div>
      ) : props.ctaText && (
        <div className="mt-3 flex flex-wrap gap-4">
          <CtaButton
            ctaAction={props.ctaAction ?? "url"}
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
            source="dandy-side-image-v6-primary"
            className="rounded-xl px-8 py-4 text-base font-bold shadow-sm transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: ctaBg, color: ctaInk }}
          >
            <InlineText value={props.ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
          </CtaButton>
          {props.secondaryCtaText && (
            <CtaButton
              ctaAction={props.secondaryCtaAction ?? "url"}
              ctaUrl={props.secondaryCtaUrl}
              chilipiperUrl={props.secondaryChilipiperUrl}
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
              source="dandy-side-image-v6-secondary"
              className="rounded-xl border-2 px-8 py-4 text-base font-semibold transition-transform hover:-translate-y-0.5"
              style={{ borderColor: outlineColors.border, color: outlineColors.text }}
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} style={{ fontFamily: BODY }} />
            </CtaButton>
          )}
        </div>
      )}
    </div>
  );

  const imageCol = (
    <div className="relative h-full">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 shadow-2xl">
        <img
          src={props.imageUrl || PLACEHOLDER}
          alt={props.headline}
          className="h-full w-full object-cover"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/10" />
      </div>
      {props.badgeText && (
        <div className="absolute -bottom-5 -right-5 rounded-2xl px-6 py-3.5 text-base font-bold shadow-lg" style={{ backgroundColor: accent, color: onAccent }}>
          <InlineText value={props.badgeText} onUpdate={field("badgeText")} style={{ fontFamily: BODY }} />
        </div>
      )}
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden py-20 md:py-28" style={{ background: surface.background }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
      />
      <div className="relative z-10 mx-auto max-w-page px-6 md:px-10">
        <div className="grid items-center gap-14 md:grid-cols-2 md:gap-20">
          {reversed ? (
            <>
              <div className="order-2 md:order-1">{imageCol}</div>
              <div className="order-1 md:order-2">{textCol}</div>
            </>
          ) : (
            <>
              <div>{textCol}</div>
              <div>{imageCol}</div>
            </>
          )}
        </div>
      </div>
      {ctaStyle === "email-capture" && (
        <EmailCaptureModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          email={email}
          mode={submitMode === "modal-chilipiper" ? "chilipiper" : "form"}
          chilipiperUrl={props.modalChilipiperUrl}
          primaryColor={brand.primaryColor}
          accentColor={brand.accentColor}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="dandy-side-image-v6"
          formSource={props.modalFormSource ?? "simple"}
          linkedFormId={props.modalFormId}
          marketoBaseUrl={props.modalMarketoBaseUrl}
          marketoMunchkinId={props.modalMarketoMunchkinId}
          marketoFormId={props.modalMarketoFormId}
          chiliPiperConfig={
            props.modalChiliPiperHandoffUrl
              ? { url: props.modalChiliPiperHandoffUrl, mode: props.modalChiliPiperHandoffMode ?? "modal", fieldMap: props.modalChiliPiperHandoffFieldMap }
              : null
          }
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
        />
      )}
    </section>
  );
}
