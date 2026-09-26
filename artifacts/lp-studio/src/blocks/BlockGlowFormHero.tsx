import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Calendar, Check, Loader2, Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { FormBlockProps, SocialProofLogo } from "@/lib/block-types/generic-blocks";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { usePageContext } from "@/lib/page-context";
import { safeNavigate } from "@/lib/safe-url";
import { IconOrImage } from "@/lib/icon-value";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BlockForm } from "./BlockForm";
import {
  GlowPanel,
  GLOW_BODY,
  GLOW_DISPLAY,
  DISPLAY_TRACKING,
  resolveGlowPalette,
} from "@/lib/glow-media";
import { mixHex } from "@/lib/section-ink";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Glow Form Hero — type "glow-form-hero"
 *
 * The Stack family's conversion hero: copy on the left (eyebrow, display
 * headline, subheadline, "what you get" checklist, named-customer proof and
 * wordmarks), a lead form on the right inside a glow panel. The form is a
 * compact native 3–6 field form posting to the shared /api/lp/leads pipeline,
 * or — when `formId` / Marketo fields are set — the tenant's global form via
 * <BlockForm> (which carries its own Chili Piper hand-off). Below the button:
 * a risk-reversal line and an optional "or pick a time now" link straight to
 * a Chili Piper booking URL. Renders no nav.
 *
 * CRO notes baked in (Sept 2026 research): one dominant action, ≤5 fields,
 * proof adjacent to the form, expectation-setting ("30 minutes"), risk
 * reversal next to the CTA, a direct-to-calendar escape hatch.
 * -------------------------------------------------------------------------- */

export type GlowFormField = "firstName" | "lastName" | "email" | "phone" | "company" | "locations" | "role";

export interface GlowFormHeroBlockProps {
  eyebrow?: string;
  eyebrowIcon?: string;
  headline?: string;
  subheadline?: string;
  /** Checklist under the subheadline — what the visitor gets from the call. */
  bullets?: string[];
  /** Proof line beside the wordmarks, e.g. "Trusted by 80+ DSOs". */
  proofText?: string;
  logos?: SocialProofLogo[];

  formTitle?: string;
  formSubtitle?: string;
  /** Which native fields render, in order. Default: firstName, lastName, email, company, locations. */
  fields?: GlowFormField[];
  /** Options for the "locations" select. */
  locationOptions?: string[];
  /** Options for the "role" select. */
  roleOptions?: string[];
  /** Primary submit — the block's `ctaText` so the Page CTA can follow it. */
  ctaText?: string;
  /** Risk-reversal line under the button, e.g. "30 minutes. No CapEx, no commitment." */
  riskLine?: string;
  successHeadline?: string;
  successMessage?: string;
  /** Chili Piper round-robin URL: "pick a time now" link + post-submit booking button. */
  chilipiperUrl?: string;
  pickTimeText?: string;
  /** Small incentive chip on the form card, e.g. "$250 gift card after your demo". */
  incentiveText?: string;
  /** Legal consent line under the form. */
  consentText?: string;

  /** Global form / Marketo embed instead of the native fields. */
  formId?: number;
  formMode?: "native" | "marketo";
  marketoBaseUrl?: string;
  marketoMunchkinId?: string;
  marketoFormId?: number;

  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
  ctaButtonColor?: string;
  ctaButtonTextColor?: string;
}

interface Props {
  props: GlowFormHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onFieldChange?: (updated: GlowFormHeroBlockProps) => void;
}

export const GLOW_FORM_HERO_DEFAULT_PROPS: GlowFormHeroBlockProps = {
  eyebrow: "Book a working session",
  eyebrowIcon: "CalendarCheck",
  headline: "See what your numbers are hiding.",
  subheadline: "Thirty minutes with a specialist, on your own data. You leave with a sized opportunity and a plan to prove it in a handful of locations.",
  bullets: [
    "A baseline of where you stand today",
    "The platform, shown on your kind of workflow",
    "A pilot scoped to 5–10 locations, with success criteria",
  ],
  proofText: "Trusted by teams at",
  logos: [{ name: "Northwind" }, { name: "Lumina" }, { name: "Vertex" }],
  formTitle: "Book your session",
  formSubtitle: "",
  fields: ["firstName", "lastName", "email", "company", "locations"],
  locationOptions: ["1–3", "4–9", "10–19", "20–49", "50+"],
  roleOptions: ["Executive / C-suite", "Operations", "Clinical leadership", "Finance", "Procurement", "IT", "Other"],
  ctaText: "Book my session",
  riskLine: "30 minutes. No commitment.",
  successHeadline: "You're booked in.",
  successMessage: "Check your inbox for a confirmation and a two-minute overview to watch before we meet.",
  chilipiperUrl: "",
  pickTimeText: "or pick a time now",
  incentiveText: "",
  consentText: "By submitting, you agree to be contacted about this request.",
};

const FIELD_LABEL: Record<GlowFormField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Work email",
  phone: "Phone",
  company: "Company",
  locations: "Number of locations",
  role: "Your role",
};

type FormState = "idle" | "loading" | "success";

export function BlockGlowFormHero({ props, brand, pageId, variantId, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const ctx = usePageContext();
  const pal = resolveGlowPalette(props, brand);
  const isEditor = !!onFieldChange;
  const bullets = props.bullets ?? [];
  const logos = props.logos ?? [];
  const fields = props.fields && props.fields.length > 0 ? props.fields : (GLOW_FORM_HERO_DEFAULT_PROPS.fields as GlowFormField[]);
  const locationOptions = props.locationOptions ?? GLOW_FORM_HERO_DEFAULT_PROPS.locationOptions ?? [];
  const roleOptions = props.roleOptions ?? GLOW_FORM_HERO_DEFAULT_PROPS.roleOptions ?? [];

  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>("idle");

  const field = (key: keyof GlowFormHeroBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as GlowFormHeroBlockProps[typeof key] })
      : undefined;
  const updateBullet = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, bullets: bullets.map((b, idx) => (idx === i ? v : b)) })
    : undefined;
  const updateLogo = onFieldChange
    ? (i: number, patch: Partial<SocialProofLogo>) =>
        onFieldChange({ ...props, logos: logos.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) })
    : undefined;

  // ── Global / Marketo form shim (same contract as the Event Activations page). ──
  const formMode = props.formMode === "marketo" ? "marketo" : "native";
  const hasMarketo = formMode === "marketo" && !!props.marketoBaseUrl && !!props.marketoMunchkinId && !!props.marketoFormId;
  const usesEmbeddedForm = hasMarketo || (formMode === "native" && !!props.formId);
  const embeddedForm: FormBlockProps = {
    headline: "",
    subheadline: "",
    multiStep: false,
    steps: [],
    submitButtonText: props.ctaText || "Book my session",
    successMessage: props.successMessage || "Thanks — we'll be in touch shortly.",
    redirectUrl: "",
    backgroundStyle: "white",
    formId: props.formId,
    cardStyle: "flat",
    formMode,
    marketoBaseUrl: props.marketoBaseUrl,
    marketoMunchkinId: props.marketoMunchkinId,
    marketoFormId: props.marketoFormId,
  };

  const openBooking = () => {
    if (!props.chilipiperUrl) return;
    try {
      const url = new URL(props.chilipiperUrl);
      if (values.email) url.searchParams.set("email", values.email);
      if (values.firstName) url.searchParams.set("firstname", values.firstName);
      if (values.lastName) url.searchParams.set("lastname", values.lastName);
      safeNavigate(url.toString(), "_blank");
    } catch {
      safeNavigate(props.chilipiperUrl, "_blank");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isEditor) return;
    setState("loading");
    const pid = pageId ?? ctx.pageId;
    try {
      if (pid) {
        await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId: pid,
            variantId: variantId ?? ctx.variantId,
            fields: {
              firstName: values.firstName || undefined,
              lastName: values.lastName || undefined,
              email: values.email,
              phone: values.phone || undefined,
              company: values.company || undefined,
              locations: values.locations || undefined,
              role: values.role || undefined,
              source: "glow-form-hero",
            },
          }),
        });
      }
    } catch {
      // Lead capture is best-effort; the visitor still sees the success state.
    }
    setState("success");
  };

  // ── Form card surface: paper card on the glow panel; inputs are AA on it. ──
  const cardBg = pal.dark ? mixHex("#FFFFFF", pal.bg, 0.08) : "#FFFFFF";
  const cardInk = pal.dark ? "#F6F7F9" : "#0B0B0F";
  const cardMuted = pal.dark ? "rgba(246,247,249,0.66)" : "rgba(11,11,15,0.6)";
  const inputBorder = pal.dark ? "rgba(255,255,255,0.16)" : "rgba(11,11,15,0.14)";
  const inputBg = pal.dark ? "rgba(255,255,255,0.04)" : "#FFFFFF";
  const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:ring-2";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em]";

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 18 }),
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const renderInput = (f: GlowFormField) => {
    const id = `gfh-${f}`;
    const common = {
      id,
      name: f,
      className: inputCls,
      style: { border: `1px solid ${inputBorder}`, background: inputBg, color: cardInk, ["--tw-ring-color" as string]: `color-mix(in srgb, ${pal.accent} 40%, transparent)` } as React.CSSProperties,
      disabled: state === "loading",
      required: f === "email" || f === "firstName",
    };
    if (f === "locations" || f === "role") {
      const opts = f === "locations" ? locationOptions : roleOptions;
      return (
        <select {...common} value={values[f] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}>
          <option value="" disabled>Select…</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        {...common}
        type={f === "email" ? "email" : f === "phone" ? "tel" : "text"}
        autoComplete={f === "email" ? "email" : f === "phone" ? "tel" : f === "company" ? "organization" : f === "firstName" ? "given-name" : f === "lastName" ? "family-name" : "off"}
        placeholder={f === "email" ? "you@company.com" : undefined}
        value={values[f] ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
      />
    );
  };

  // Pair first/last name on one row when both are present and adjacent.
  const rows: GlowFormField[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f === "firstName" && fields[i + 1] === "lastName") {
      rows.push(["firstName", "lastName"]);
      i++;
    } else {
      rows.push([f]);
    }
  }

  return (
    <section className="gfh relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }} id="book">
      <style>{`
        .gfh-cta { transition: transform .25s cubic-bezier(.16,1,.3,1), filter .25s ease; }
        @media (hover: hover) { .gfh-cta:hover { transform: translateY(-1px); filter: brightness(1.04); } }
        @media (prefers-reduced-motion: reduce) { .gfh-cta, .gfh-cta:hover { transition: none; transform: none; } }
      `}</style>

      {/* Ambient glow behind the form card. */}
      <div className="absolute inset-y-0 right-0 w-[60%] pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(55% 60% at 70% 55%, color-mix(in srgb, ${pal.glow} ${pal.dark ? 22 : 40}%, transparent) 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-16 lg:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
        {/* Copy */}
        <div className="lg:col-span-6 flex flex-col gap-5">
          {(props.eyebrow || isEditor) && (
            <motion.p {...rise(0)} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: pal.muted }}>
              <span className="inline-flex" style={{ color: pal.accent }} aria-hidden="true">
                <IconOrImage value={props.eyebrowIcon} fallback={Sparkles} className="w-4 h-4" />
              </span>
              <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </motion.p>
          )}
          <motion.h1
            {...rise(0.06)}
            className="font-semibold leading-[1.04] max-w-[16ch]"
            style={{ fontFamily: GLOW_DISPLAY, letterSpacing: DISPLAY_TRACKING, fontSize: "clamp(2.4rem, 5vw, 4.25rem)" }}
          >
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h1>
          {(props.subheadline || isEditor) && (
            <motion.p {...rise(0.12)} className="text-lg leading-relaxed max-w-[50ch]" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
          {bullets.length > 0 && (
            <motion.ul {...rise(0.18)} className="mt-1 flex flex-col gap-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${pal.glow} 55%, transparent)`, color: pal.dark ? "#F6F7F9" : "#0B0B0F" }} aria-hidden="true">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <InlineText as="span" value={b} onUpdate={updateBullet ? (v) => updateBullet(i, v) : undefined} multiline />
                </li>
              ))}
            </motion.ul>
          )}
          {(props.proofText || logos.length > 0 || isEditor) && (
            <motion.div {...rise(0.24)} className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 pt-5" style={{ borderTop: `1px solid ${pal.hairline}` }}>
              {(props.proofText || isEditor) && (
                <p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: pal.muted }}>
                  <InlineText as="span" value={props.proofText ?? ""} onUpdate={field("proofText")} />
                </p>
              )}
              {logos.map((logo, i) => (
                <span key={i} className="flex items-center h-7" style={{ opacity: 0.7 }}>
                  {logo.imageUrl || updateLogo ? (
                    <InlineImage
                      src={logo.imageUrl || ""}
                      alt={logo.name}
                      className={cn("h-6 w-auto max-w-[120px] object-contain", pal.dark ? "invert brightness-200" : "grayscale")}
                      loading="lazy"
                      onUpdate={updateLogo ? (url) => updateLogo(i, { imageUrl: url }) : undefined}
                    />
                  ) : (
                    <span className="text-sm font-semibold tracking-tight" style={{ fontFamily: GLOW_DISPLAY }}>{logo.name}</span>
                  )}
                </span>
              ))}
            </motion.div>
          )}
        </div>

        {/* Form */}
        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 24 })}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 lg:pl-6"
        >
          <GlowPanel palette={pal} glowFrom="bottom-right" radius={28} intensity={pal.dark ? 0.55 : 1}>
            <div className="p-3 sm:p-4">
              <div className="rounded-[20px] p-6 sm:p-8" style={{ background: cardBg, color: cardInk, boxShadow: pal.dark ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "0 24px 60px -32px rgba(15,15,20,0.35), 0 1px 2px rgba(15,15,20,0.05)" }}>
                {(props.incentiveText || isEditor) && (
                  <p className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${pal.glow} 40%, transparent)`, color: pal.dark ? "#F6F7F9" : "#0B0B0F" }}>
                    <Sparkles className="h-3 w-3" aria-hidden />
                    <InlineText as="span" value={props.incentiveText ?? ""} onUpdate={field("incentiveText")} />
                  </p>
                )}
                {(props.formTitle || isEditor) && (
                  <h2 className="text-xl font-semibold leading-snug" style={{ fontFamily: GLOW_DISPLAY, letterSpacing: "-0.02em" }}>
                    <InlineText as="span" value={props.formTitle ?? ""} onUpdate={field("formTitle")} />
                  </h2>
                )}
                {(props.formSubtitle || isEditor) && (
                  <p className="mt-1 text-sm" style={{ color: cardMuted }}>
                    <InlineText as="span" value={props.formSubtitle ?? ""} onUpdate={field("formSubtitle")} multiline />
                  </p>
                )}

                <div className="mt-5">
                  {usesEmbeddedForm ? (
                    <BlockForm props={embeddedForm} brand={brand} pageId={pageId ?? ctx.pageId} variantId={variantId ?? ctx.variantId} />
                  ) : state === "success" ? (
                    <div className="flex flex-col items-start gap-3 py-4" role="status">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${pal.glow} 55%, transparent)` }}>
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </span>
                      <p className="text-lg font-semibold" style={{ fontFamily: GLOW_DISPLAY }}>{props.successHeadline || "You're booked in."}</p>
                      <p className="text-sm leading-relaxed" style={{ color: cardMuted }}>{props.successMessage || "Thanks — we'll be in touch shortly."}</p>
                      {props.chilipiperUrl && (
                        <button type="button" onClick={openBooking} className="gfh-cta mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ background: pal.cta.bg, color: pal.cta.text }}>
                          <Calendar className="h-4 w-4" aria-hidden /> Pick a time now
                        </button>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3.5">
                      {rows.map((row, i) => (
                        <div key={i} className={cn("grid gap-3", row.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
                          {row.map((f) => (
                            <div key={f}>
                              <label htmlFor={`gfh-${f}`} className={labelCls} style={{ color: cardMuted }}>{FIELD_LABEL[f]}</label>
                              {renderInput(f)}
                            </div>
                          ))}
                        </div>
                      ))}
                      <button
                        type="submit"
                        disabled={state === "loading"}
                        className="gfh-cta mt-1 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold disabled:opacity-70"
                        style={{ background: pal.cta.bg, color: pal.cta.text, boxShadow: `0 12px 30px -14px color-mix(in srgb, ${pal.cta.bg} 70%, transparent)` }}
                      >
                        {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                        <InlineText as="span" value={props.ctaText || "Book my session"} onUpdate={field("ctaText")} />
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </button>
                      {(props.riskLine || props.chilipiperUrl || isEditor) && (
                        <p className="text-center text-xs" style={{ color: cardMuted }}>
                          {(props.riskLine || isEditor) && (
                            <InlineText as="span" value={props.riskLine ?? ""} onUpdate={field("riskLine")} />
                          )}
                          {props.chilipiperUrl && (
                            <>
                              {props.riskLine ? " " : ""}
                              <button type="button" onClick={openBooking} className="font-semibold underline underline-offset-2" style={{ color: cardInk }}>
                                <InlineText as="span" value={props.pickTimeText || "or pick a time now"} onUpdate={field("pickTimeText")} />
                              </button>
                            </>
                          )}
                        </p>
                      )}
                      {(props.consentText || isEditor) && (
                        <p className="text-[11px] leading-relaxed" style={{ color: cardMuted }}>
                          <InlineText as="span" value={props.consentText ?? ""} onUpdate={field("consentText")} multiline />
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </div>
            </div>
          </GlowPanel>
        </motion.div>
      </div>
    </section>
  );
}
