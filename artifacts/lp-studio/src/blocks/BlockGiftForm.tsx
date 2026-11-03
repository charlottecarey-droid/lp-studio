import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Gift, Loader2, MapPin, Sparkles, User } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_PILL_CLASS, displayStyle, pillStyle } from "@/lib/invite-theme";
import { GIFT_CSS, GiftKicker, SparkleField, resolveGiftPalette, type GiftPalette } from "./gift/gift-theme";
import { useGiftForm, type GiftFormStatus, type GiftFormValues } from "./gift/use-gift-form";
import { cn } from "@/lib/utils";
import { AtelierGiftForm } from "./gift/AtelierGiftForm";
import type { GiftLayout } from "./gift/atelier-theme";

/* ----------------------------------------------------------------------------
 * Gift Form — type "gift-form"
 *
 * The three-step claim form of the holiday gift page, on a cream card:
 *   1. Your pick — radio tiles of the gifts (names come from the gift picker
 *      on the same page, or from `options` here), plus an optional size.
 *   2. About you — name, work email, company, role, phone.
 *   3. Where to send it — street, suite, city, state, ZIP, delivery notes.
 * A gold ribbon progress bar, Back/Next, per-step validation, and a sparkly
 * success state. Posts to the shared /api/lp/leads pipeline with label-keyed
 * fields (so the lead's name/email/company land in their columns) and the
 * page's UTM attribution, so a rep's `?utm_content=<rep>` link tags the lead.
 * -------------------------------------------------------------------------- */

export interface GiftFormBlockProps {
  /** Classic (dark, snow, gold) or Atelier (light luxury retail). */
  layout?: GiftLayout;
  /** Atelier: "Label: value" lines under the selection summary. */
  summaryLines?: string[];
  kicker?: string;
  headline?: string;
  subheadline?: string;
  /** "What happens next" lines beside the card (0–4). */
  nextSteps?: string[];
  /** Gift names. Blank = use the names the gift picker on this page registered. */
  options?: string[];
  giftLabel?: string;
  /** Size choices; blank = no size question. */
  sizeLabel?: string;
  sizeOptions?: string[];
  askPhone?: boolean;
  askRole?: boolean;
  askCompany?: boolean;
  companyLabel?: string;
  stepOneTitle?: string;
  stepTwoTitle?: string;
  stepThreeTitle?: string;
  submitText?: string;
  successHeadline?: string;
  successMessage?: string;
  consentText?: string;
  /** Pre-fill step two (e.g. "{{first_name}}" filled per page). Values still containing "{{" are ignored. */
  prefillFirstName?: string;
  prefillLastName?: string;
  prefillEmail?: string;
  prefillCompany?: string;
  /** Saved on the lead as "Sent by" (e.g. "{{rep_name}}"). */
  sentBy?: string;
  /** Route leads through this global form (lp_forms id): its notifications, CRM sync, Sheets, webhook, follow-up and redirect apply; the gift form keeps its own design. */
  formId?: number;
  /** Lead source label saved with the lead. */
  source?: string;
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: GiftFormBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onFieldChange?: (updated: GiftFormBlockProps) => void;
}

export const GIFT_FORM_DEFAULT_PROPS: GiftFormBlockProps = {
  kicker: "Claim your gift",
  headline: "Tell us where\nto send it.",
  subheadline: "Three quick steps. We'll confirm once it ships.",
  nextSteps: ["Pick your gift", "Tell us who you are", "Give us a shipping address"],
  options: [],
  giftLabel: "Which gift would you like?",
  sizeLabel: "",
  sizeOptions: [],
  askPhone: true,
  askRole: true,
  askCompany: true,
  companyLabel: "Company",
  stepOneTitle: "Your pick",
  stepTwoTitle: "About you",
  stepThreeTitle: "Where to send it",
  submitText: "Send my gift",
  successHeadline: "It's on its way.",
  successMessage: "Thank you! We'll follow up with tracking once your gift ships.",
  consentText: "We'll only use these details to ship your gift and to follow up about it.",
  source: "holiday-gift",
  anchorId: "redeem",
  layout: "classic",
  summaryLines: ["Delivery: Complimentary", "Arrives: Before the holidays"],
};

type Values = GiftFormValues;
type Status = GiftFormStatus;

const STEP_ICONS = [Gift, User, MapPin] as const;

export function BlockGiftForm(p: Props) {
  return p.props.layout === "atelier" ? <AtelierGiftForm {...p} /> : <ClassicGiftForm {...p} />;
}

function ClassicGiftForm({ props, brand, pageId, variantId, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const anim = useAnimInitial();
  const pal = resolveGiftPalette(props, brand);
  const isEditor = !!onFieldChange;
  const { options, sizes, askSize, step, values, errors, status, gift, set, chooseGift, goNext, goBack, submit } = useGiftForm(props, { pageId, variantId, isEditor });
  const nextSteps = (props.nextSteps ?? []).filter(Boolean).slice(0, 4);
  const stepTitles = [props.stepOneTitle || "Your pick", props.stepTwoTitle || "About you", props.stepThreeTitle || "Where to send it"];

  const field = (key: keyof GiftFormBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftFormBlockProps[typeof key] }) : undefined;
  const updateNextStep = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, nextSteps: nextSteps.map((s, idx) => (idx === i ? v : s)) })
    : undefined;

  const inputStyle: React.CSSProperties = { background: "#FFFFFF", border: `1px solid ${pal.creamLine}`, color: pal.creamInk, fontFamily: INVITE_BODY };
  const inputCls = "gift-field w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-shadow";
  const labelCls = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em]";
  const errCls = "mt-1 block text-[12px]";

  const ctl = { values, errors, set, pal, status };

  const stepOne = (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className={labelCls} style={{ color: pal.creamMuted }}>
          <InlineText as="span" value={props.giftLabel || "Which gift would you like?"} onUpdate={field("giftLabel")} />
          <span aria-hidden="true" style={{ color: pal.gold }}> *</span>
        </legend>
        {options.length === 0 ? (
          <p className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "#FFFFFF", color: pal.creamMuted, border: `1px dashed ${pal.creamLine}` }}>
            Add a gift picker above this form, or list the gift names in this block's settings.
          </p>
        ) : (
          <div className={cn("grid gap-3", options.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {options.map((name) => {
              const on = gift === name;
              return (
                <label
                  key={name}
                  data-gift-choice={name}
                  data-gift-on={on ? "true" : "false"}
                  className="relative flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3.5 text-[14px] font-medium transition-shadow"
                  style={{ background: "#FFFFFF", color: pal.creamInk, boxShadow: on ? `0 0 0 2px ${pal.accent}` : `0 0 0 1px ${pal.creamLine}` }}
                >
                  <input type="radio" name="gift" value={name} checked={on} onChange={() => chooseGift(name)} className="sr-only" disabled={isEditor} />
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: on ? pal.accent : "transparent", color: pal.onAccent, boxShadow: on ? "none" : `inset 0 0 0 1.5px ${pal.creamLine}` }}>
                    {on && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                  </span>
                  <span>{name}</span>
                </label>
              );
            })}
          </div>
        )}
        {errors.gift && <span className={errCls} style={{ color: "#B23B3B" }}>{errors.gift}</span>}
      </fieldset>
      {askSize && (
        <div>
          <label htmlFor="gift-size" className={labelCls} style={{ color: pal.creamMuted }}>{props.sizeLabel || "Size"}</label>
          <select id="gift-size" name="size" value={values.size ?? ""} onChange={(e) => set("size", e.target.value)} className={inputCls} style={inputStyle} disabled={status === "loading"}>
            <option value="">Choose a size</option>
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  );

  const stepTwo = (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <GiftInput {...ctl} id="firstName" label="First name" autoComplete="given-name" placeholder="Jane" required />
        <GiftInput {...ctl} id="lastName" label="Last name" autoComplete="family-name" placeholder="Smith" required />
      </div>
      <GiftInput {...ctl} id="email" label="Work email" type="email" autoComplete="email" placeholder="jane@company.com" required />
      {(props.askCompany ?? true) && <GiftInput {...ctl} id="company" label={props.companyLabel || "Company"} autoComplete="organization" placeholder="Your organization" required />}
      <div className="grid gap-4 sm:grid-cols-2">
        {(props.askRole ?? true) && <GiftInput {...ctl} id="role" label="Role" autoComplete="organization-title" placeholder="Chief Operating Officer" />}
        {(props.askPhone ?? true) && <GiftInput {...ctl} id="phone" label="Phone" type="tel" autoComplete="tel" placeholder="(555) 000-0000" />}
      </div>
    </div>
  );

  const stepThree = (
    <div className="flex flex-col gap-4">
      <GiftInput {...ctl} id="address" label="Shipping address" autoComplete="street-address" placeholder="123 Main St" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <GiftInput {...ctl} id="address2" label="Suite / unit" placeholder="Suite 400" />
        <GiftInput {...ctl} id="city" label="City" autoComplete="address-level2" placeholder="Austin" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <GiftInput {...ctl} id="state" label="State" autoComplete="address-level1" placeholder="TX" required />
        <GiftInput {...ctl} id="zip" label="ZIP" autoComplete="postal-code" placeholder="78701" required />
      </div>
      <div>
        <label htmlFor="gift-notes" className={labelCls} style={{ color: pal.creamMuted }}>Delivery notes</label>
        <textarea id="gift-notes" name="notes" rows={2} value={values.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Front desk, business hours only, etc." className={inputCls} style={inputStyle} disabled={status === "loading"} />
      </div>
    </div>
  );

  const steps = [stepOne, stepTwo, stepThree];

  return (
    <section id={props.anchorId || "redeem"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <style>{`${GIFT_CSS} .gift-field::placeholder{color:${pal.creamMuted};opacity:.6} .gift-field:focus{box-shadow:0 0 0 2px ${pal.accent}}`}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 70% at 85% 100%, ${pal.goldSoft} 0%, transparent 70%)` }} />
      {!reduced && !staticRender && <SparkleField palette={pal} count={5} />}
      <div className="relative mx-auto grid w-full max-w-page grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-12 lg:gap-16 lg:px-10 lg:py-28">
        <div className="flex flex-col gap-6 lg:col-span-5">
          {(props.kicker || isEditor) && <GiftKicker palette={pal} align="left"><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></GiftKicker>}
          {(props.headline || isEditor) && (
            <h2 className="whitespace-pre-line" style={displayStyle("clamp(2.2rem, 4.4vw, 3.6rem)")}>
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
          )}
          {(props.subheadline || isEditor) && (
            <p className="max-w-[44ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
          {nextSteps.length > 0 && (
            <ol className="mt-2 flex flex-col gap-3">
              {nextSteps.map((s, i) => {
                const Icon = STEP_ICONS[Math.min(i, STEP_ICONS.length - 1)];
                return (
                  <li key={i} className="flex items-center gap-4 text-[14px]" style={{ color: i <= step ? pal.text : pal.muted }}>
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: i <= step ? pal.gold : "transparent", color: i <= step ? pal.creamInk : pal.gold, boxShadow: i <= step ? "none" : `inset 0 0 0 1px ${pal.goldSoft}` }}>
                      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </span>
                    <InlineText as="span" value={s} onUpdate={updateNextStep ? (v) => updateNextStep(i, v) : undefined} />
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 24 })}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-[26px] p-6 sm:p-8 lg:col-span-7"
          style={{ background: pal.cream, color: pal.creamInk, boxShadow: `0 60px 120px -50px rgba(0,0,0,0.9), 0 0 0 1px ${pal.creamLine}` }}
        >
          {status === "success" ? (
            <SuccessState palette={pal} headline={props.successHeadline || "It's on its way."} message={props.successMessage || ""} gift={gift} reduced={reduced} />
          ) : (
            <form onSubmit={(e) => void submit(e)} noValidate data-gift-step={step + 1} className="flex flex-col gap-6">
              {/* Step header + ribbon progress */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.creamMuted }}>
                  <span>Step {step + 1} of 3</span>
                  <span style={{ color: pal.creamInk }}>
                    <InlineText as="span" value={stepTitles[step]} onUpdate={field(step === 0 ? "stepOneTitle" : step === 1 ? "stepTwoTitle" : "stepThreeTitle")} />
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 rounded-full" style={{ background: i <= step ? `linear-gradient(90deg, ${pal.gold}, #F3E2B4)` : pal.creamLine }} />
                  ))}
                </div>
              </div>

              {steps[step]}

              {status === "error" && (
                <p className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "#FBE9E9", color: "#8A2B2B" }}>Something went wrong sending that. Please try again.</p>
              )}

              <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                {step > 0 ? (
                  <button type="button" onClick={goBack} className={cn(INVITE_PILL_CLASS, "!min-h-[44px]")} style={{ background: "transparent", color: pal.creamInk, border: `1px solid ${pal.creamLine}` }}>
                    <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                  </button>
                ) : <span />}
                {step < 2 ? (
                  <button type="button" onClick={goNext} className={cn(INVITE_PILL_CLASS, "!min-h-[48px] sm:min-w-[180px]")} style={pillStyle(pal)}>
                    Next <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <button type="submit" disabled={status === "loading"} className={cn(INVITE_PILL_CLASS, "!min-h-[48px] disabled:opacity-70 sm:min-w-[180px]")} style={pillStyle(pal)}>
                    {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
                    <InlineText as="span" value={props.submitText || "Send my gift"} onUpdate={field("submitText")} />
                  </button>
                )}
              </div>

              {(props.consentText || isEditor) && (
                <p className="text-[11px] leading-relaxed" style={{ color: pal.creamMuted }}>
                  <InlineText as="span" value={props.consentText ?? ""} onUpdate={field("consentText")} multiline />
                </p>
              )}
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}

interface GiftInputProps {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  values: Values;
  errors: Record<string, string>;
  set: (key: string, v: string) => void;
  pal: GiftPalette;
  status: Status;
}

/** Module-level so React keeps the <input> mounted (and focused) across keystrokes. */
function GiftInput({ id, label, type = "text", autoComplete, placeholder, required, values, errors, set, pal, status }: GiftInputProps) {
  const inputStyle: React.CSSProperties = { background: "#FFFFFF", border: `1px solid ${pal.creamLine}`, color: pal.creamInk, fontFamily: INVITE_BODY };
  return (
    <div>
      <label htmlFor={`gift-${id}`} className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.creamMuted }}>
        {label}{required && <span aria-hidden="true" style={{ color: pal.gold }}> *</span>}
      </label>
      <input
        id={`gift-${id}`}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        disabled={status === "loading"}
        value={values[id] ?? ""}
        onChange={(e) => set(id, e.target.value)}
        className="gift-field w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-shadow"
        style={{ ...inputStyle, ...(errors[id] ? { boxShadow: "0 0 0 2px #D64545" } : null) }}
        aria-invalid={!!errors[id]}
      />
      {errors[id] && <span className="mt-1 block text-[12px]" style={{ color: "#B23B3B" }}>{errors[id]}</span>}
    </div>
  );
}

function SuccessState({ palette, headline, message, gift, reduced }: { palette: GiftPalette; headline: string; message: string; gift: string; reduced: boolean }) {
  return (
    <div className="relative flex flex-col items-center gap-4 py-8 text-center" role="status" data-gift-success="true">
      {!reduced && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {Array.from({ length: 8 }, (_, i) => (
            <Sparkles key={i} className="gift-sparkle absolute" strokeWidth={1.5} style={{ left: `${(i * 37 + 8) % 92}%`, top: `${(i * 29 + 6) % 80}%`, width: 12 + (i % 3) * 5, height: 12 + (i % 3) * 5, color: palette.gold, animationDelay: `${(i * 0.4) % 2.4}s` }} />
          ))}
        </div>
      )}
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full" style={{ background: palette.accent, color: palette.onAccent, boxShadow: `0 20px 40px -20px ${palette.accent}` }}>
        <Check className="h-7 w-7" strokeWidth={3} aria-hidden />
      </span>
      <p className="whitespace-pre-line" style={displayStyle("clamp(1.8rem, 3.4vw, 2.6rem)", { color: palette.creamInk })}>{headline}</p>
      {gift && (
        <p className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold" style={{ background: palette.bg, color: palette.gold }}>
          <Gift className="h-3.5 w-3.5" aria-hidden /> {gift}
        </p>
      )}
      {message && <p className="max-w-[40ch] text-[15px] leading-relaxed" style={{ color: palette.creamMuted }}>{message}</p>}
    </div>
  );
}
