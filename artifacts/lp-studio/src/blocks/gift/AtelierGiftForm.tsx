import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import type { GiftFormBlockProps } from "../BlockGiftForm";
import { ATELIER_BODY, ATELIER_BUTTON_CLASS, ATELIER_CSS, ATELIER_LINK_CLASS, ATELIER_SERIF, AtelierEyebrow, GiftBoxArt, LeatherTag, SatinBow, resolveAtelierPalette, type AtelierPalette } from "./atelier-theme";
import { AtelierHeadline } from "./AtelierHeadline";
import { useGiftForm, type GiftFormStatus, type GiftFormValues } from "./use-gift-form";
import { cn } from "@/lib/utils";

/**
 * gift-form, layout "atelier": a quiet checkout. Centred serif header, then
 * one ivory panel split in two — "Your selection" on the left (the chosen
 * gift's photo or a ribboned box, its name and the delivery lines, like an
 * order summary) and the three steps on the right as numbered tabs with
 * underline-only fields, an underlined Back and a solid Next / Send.
 * Same state + submission as the Classic layout (useGiftForm).
 */
export function AtelierGiftForm({ props, brand, pageId, variantId, onFieldChange }: { props: GiftFormBlockProps; brand: BrandConfig; pageId?: number; variantId?: number; onFieldChange?: (u: GiftFormBlockProps) => void }) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAtelierPalette(props, brand, "sand");
  const isEditor = !!onFieldChange;
  const f = useGiftForm(props, { pageId, variantId, isEditor });
  const stepTitles = [props.stepOneTitle || "Your pick", props.stepTwoTitle || "About you", props.stepThreeTitle || "Where to send it"];
  const summary = (props.summaryLines ?? []).filter(Boolean).map((l) => {
    const at = l.indexOf(":");
    return at > 0 ? { label: l.slice(0, at).trim(), value: l.slice(at + 1).trim() } : { label: l.trim(), value: "" };
  });
  const chosen = f.gift ? f.details[f.gift] : undefined;
  const ctl = { values: f.values, errors: f.errors, set: f.set, pal, status: f.status };

  const field = (key: keyof GiftFormBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftFormBlockProps[typeof key] }) : undefined;
  const stepKey: Array<keyof GiftFormBlockProps> = ["stepOneTitle", "stepTwoTitle", "stepThreeTitle"];

  const stepOne = (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-4 block text-[11px] font-medium uppercase tracking-[0.26em]" style={{ color: pal.muted }}>
          <InlineText as="span" value={props.giftLabel || "Which gift would you like?"} onUpdate={field("giftLabel")} />
        </legend>
        {f.options.length === 0 ? (
          <p className="py-3 text-[13px]" style={{ color: pal.muted, borderBottom: `1px dashed ${pal.line}` }}>
            Add a gift picker above this form, or list the gift names in this block's settings.
          </p>
        ) : (
          <div className="flex flex-col" style={{ borderTop: `1px solid ${pal.line}` }}>
            {f.options.map((name, i) => {
              const on = f.gift === name;
              const d = f.details[name];
              return (
                <label key={name} data-gift-choice={name} data-gift-on={on ? "true" : "false"} className="flex cursor-pointer items-center gap-4 py-4" style={{ borderBottom: `1px solid ${pal.line}` }}>
                  <input type="radio" name="gift" value={name} checked={on} onChange={() => f.chooseGift(name)} className="sr-only" disabled={isEditor} />
                  <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[2px]" style={{ background: pal.sand }}>
                    {d?.imageUrl ? (
                      <img src={d.imageUrl} alt="" className={d.fit === "cover" ? "h-full w-full object-cover" : "h-full w-full object-contain p-1"} style={d.fit === "cover" ? undefined : { mixBlendMode: "multiply" }} />
                    ) : (
                      <GiftBoxArt palette={pal} variant="single" className="absolute inset-0 h-full w-full" />
                    )}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: pal.faint }}>No. {String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[21px] leading-tight" style={{ fontFamily: ATELIER_SERIF }}>{name}</span>
                  </span>
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: on ? pal.ribbon : "transparent", color: pal.ivory, boxShadow: on ? "none" : `inset 0 0 0 1px ${pal.faint}` }}>
                    {on && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {f.errors.gift && <span className="mt-2 block text-[12px]" style={{ color: "#9A3A2E" }}>{f.errors.gift}</span>}
      </fieldset>
      {f.askSize && (
        <div>
          <label htmlFor="atl-size" className="block text-[11px] font-medium uppercase tracking-[0.26em]" style={{ color: pal.muted }}>{props.sizeLabel || "Size"}</label>
          <select id="atl-size" name="size" value={f.values.size ?? ""} onChange={(e) => f.set("size", e.target.value)} className="atl-field" style={{ color: pal.ink, fontFamily: ATELIER_BODY }} disabled={f.status === "loading"}>
            <option value="">Choose a size</option>
            {f.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  );

  const stepTwo = (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <AtelierInput {...ctl} id="firstName" label="First name" autoComplete="given-name" required />
        <AtelierInput {...ctl} id="lastName" label="Last name" autoComplete="family-name" required />
      </div>
      <AtelierInput {...ctl} id="email" label="Work email" type="email" autoComplete="email" required />
      {(props.askCompany ?? true) && <AtelierInput {...ctl} id="company" label={props.companyLabel || "Company"} autoComplete="organization" required />}
      <div className="grid gap-6 sm:grid-cols-2">
        {(props.askRole ?? true) && <AtelierInput {...ctl} id="role" label="Role" autoComplete="organization-title" />}
        {(props.askPhone ?? true) && <AtelierInput {...ctl} id="phone" label="Phone" type="tel" autoComplete="tel" />}
      </div>
    </div>
  );

  const stepThree = (
    <div className="flex flex-col gap-6">
      <AtelierInput {...ctl} id="address" label="Shipping address" autoComplete="street-address" required />
      <div className="grid gap-6 sm:grid-cols-2">
        <AtelierInput {...ctl} id="address2" label="Suite / unit" />
        <AtelierInput {...ctl} id="city" label="City" autoComplete="address-level2" required />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <AtelierInput {...ctl} id="state" label="State" autoComplete="address-level1" required />
        <AtelierInput {...ctl} id="zip" label="ZIP" autoComplete="postal-code" required />
      </div>
      <div>
        <label htmlFor="atl-notes" className="block text-[11px] font-medium uppercase tracking-[0.26em]" style={{ color: pal.muted }}>Delivery notes</label>
        <textarea id="atl-notes" name="notes" rows={2} value={f.values.notes ?? ""} onChange={(e) => f.set("notes", e.target.value)} className="atl-field resize-none" style={{ color: pal.ink, fontFamily: ATELIER_BODY }} disabled={f.status === "loading"} />
      </div>
    </div>
  );

  return (
    <section id={props.anchorId || "redeem"} data-gift-layout="atelier" className="relative" style={{ background: pal.bg, color: pal.ink, fontFamily: ATELIER_BODY }}>
      <style>{`${ATELIER_CSS} .atl-field:focus { border-bottom-color: ${pal.ribbon}; } .atl-summary { border-top: 1px solid ${pal.line}; } @media (min-width: 1024px) { .atl-summary { border-top: 0; border-right: 1px solid ${pal.line}; } }`}</style>
      <div className="mx-auto w-full max-w-page px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          {(props.kicker || isEditor) && <AtelierEyebrow palette={pal} align="center"><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></AtelierEyebrow>}
          {(props.headline || isEditor) && <AtelierHeadline value={props.headline ?? ""} size="clamp(2.6rem, 5vw, 4.2rem)" className="items-center" onUpdate={field("headline")} />}
          {(props.subheadline || isEditor) && (
            <p className="max-w-[46ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </div>

        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 22 })}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-14 grid max-w-[1120px] grid-cols-1 overflow-hidden rounded-[4px] lg:grid-cols-12"
          style={{ background: pal.ivory, boxShadow: `0 50px 100px -60px rgba(43,31,23,0.55), 0 0 0 1px ${pal.line}` }}
        >
          {/* Your selection */}
          <aside className="atl-summary order-2 flex flex-col gap-6 p-8 lg:order-1 lg:col-span-5 lg:p-10" style={{ background: pal.paper }}>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em]" style={{ color: pal.muted }}>Your selection</p>
            <div className="relative overflow-hidden rounded-[3px]" style={{ aspectRatio: "4 / 3", background: `radial-gradient(110% 80% at 40% 25%, ${pal.ivory} 0%, ${pal.sand} 62%, #E2D2C0 100%)` }} data-atl-summary={f.gift || "none"}>
              {chosen?.imageUrl ? (
                <img src={chosen.imageUrl} alt={chosen.imageAlt ?? f.gift} className={chosen.fit === "cover" ? "absolute inset-0 h-full w-full object-cover" : "absolute inset-0 h-full w-full object-contain p-[10%]"} style={chosen.fit === "cover" ? undefined : { mixBlendMode: "multiply" }} />
              ) : (
                <GiftBoxArt palette={pal} variant="single" className="absolute inset-x-[10%] top-[6%] w-[80%]" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[28px] leading-tight" style={{ fontFamily: ATELIER_SERIF, color: f.gift ? pal.ink : pal.muted }}>
                {f.gift || "Choose a gift to begin"}
              </p>
              {chosen?.caption && <p className="text-[13px] leading-relaxed" style={{ color: pal.muted }}>{chosen.caption}</p>}
            </div>
            {summary.length > 0 && (
              <dl className="mt-auto flex flex-col">
                {summary.map((s, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-4 py-3 text-[13px]" style={{ borderTop: `1px solid ${pal.line}` }}>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: pal.muted }}>{s.label}</dt>
                    <dd style={{ color: pal.ink }}>{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </aside>

          {/* Steps */}
          <div className="order-1 p-8 lg:order-2 lg:col-span-7 lg:p-12">
            {f.status === "success" ? (
              <AtelierSuccess palette={pal} headline={props.successHeadline || "It's on its way."} message={props.successMessage || ""} gift={f.gift} />
            ) : (
              <form onSubmit={(e) => void f.submit(e)} noValidate data-gift-step={f.step + 1} className="flex flex-col gap-8">
                <nav aria-label="Steps" className="grid grid-cols-3" style={{ borderBottom: `1px solid ${pal.line}` }}>
                  {stepTitles.map((t, i) => {
                    const active = i === f.step;
                    return (
                      <button key={i} type="button" onClick={() => f.goTo(i)} aria-current={active ? "step" : undefined} className="relative flex flex-col items-start gap-1 pb-4 text-left">
                        <span className="text-[16px] leading-none" style={{ fontFamily: ATELIER_SERIF, color: i <= f.step ? pal.ribbon : pal.faint }}>{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: active ? pal.ink : pal.faint }}>
                          <InlineText as="span" value={t} onUpdate={field(stepKey[i])} />
                        </span>
                        <span aria-hidden="true" className="absolute -bottom-px left-0 h-[2px] transition-all duration-500" style={{ width: active ? "100%" : "0%", background: pal.ribbon }} />
                      </button>
                    );
                  })}
                </nav>

                {[stepOne, stepTwo, stepThree][f.step]}

                {f.status === "error" && <p className="text-[13px]" style={{ color: "#9A3A2E" }}>Something went wrong sending that. Please try again.</p>}

                <div className="flex flex-col-reverse items-stretch gap-5 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  {f.step > 0 ? (
                    <button type="button" onClick={f.goBack} className={`${ATELIER_LINK_CLASS} self-center sm:self-auto`} style={{ color: pal.ink }}>
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
                    </button>
                  ) : <span />}
                  {f.step < 2 ? (
                    <button type="button" onClick={f.goNext} className={cn(ATELIER_BUTTON_CLASS, "sm:min-w-[220px]")} style={{ background: pal.button, color: pal.onButton }}>
                      Continue <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : (
                    <button type="submit" disabled={f.status === "loading"} className={cn(ATELIER_BUTTON_CLASS, "disabled:opacity-70 sm:min-w-[220px]")} style={{ background: pal.button, color: pal.onButton }}>
                      {f.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      <InlineText as="span" value={props.submitText || "Send my gift"} onUpdate={field("submitText")} />
                    </button>
                  )}
                </div>

                {(props.consentText || isEditor) && (
                  <p className="text-[11px] leading-relaxed" style={{ color: pal.faint }}>
                    <InlineText as="span" value={props.consentText ?? ""} onUpdate={field("consentText")} multiline />
                  </p>
                )}
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

interface AtelierInputProps {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  values: GiftFormValues;
  errors: Record<string, string>;
  set: (key: string, v: string) => void;
  pal: AtelierPalette;
  status: GiftFormStatus;
}

/** Module-level so React keeps the <input> mounted (and focused) across keystrokes. */
function AtelierInput({ id, label, type = "text", autoComplete, required, values, errors, set, pal, status }: AtelierInputProps) {
  return (
    <div>
      <label htmlFor={`atl-${id}`} className="block text-[11px] font-medium uppercase tracking-[0.26em]" style={{ color: pal.muted }}>
        {label}{required && <span aria-hidden="true" style={{ color: pal.ribbon }}> *</span>}
      </label>
      <input
        id={`atl-${id}`}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        disabled={status === "loading"}
        value={values[id] ?? ""}
        onChange={(e) => set(id, e.target.value)}
        className="atl-field"
        style={{ color: pal.ink, fontFamily: ATELIER_BODY, ...(errors[id] ? { borderBottomColor: "#9A3A2E" } : null) }}
        aria-invalid={!!errors[id]}
      />
      {errors[id] && <span className="mt-1.5 block text-[12px]" style={{ color: "#9A3A2E" }}>{errors[id]}</span>}
    </div>
  );
}

function AtelierSuccess({ palette, headline, message, gift }: { palette: AtelierPalette; headline: string; message: string; gift: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center" role="status" data-gift-success="true">
      <SatinBow palette={palette} className="w-40" />
      <p style={{ fontFamily: ATELIER_SERIF, fontSize: "clamp(2.2rem, 4vw, 3.2rem)", lineHeight: 1.02, letterSpacing: "-0.03em" }}>{headline}</p>
      {gift && <LeatherTag palette={palette} line1="Your selection" line2={gift} sway={false} />}
      {message && <p className="max-w-[40ch] text-[15px] leading-relaxed" style={{ color: palette.muted }}>{message}</p>}
    </div>
  );
}
