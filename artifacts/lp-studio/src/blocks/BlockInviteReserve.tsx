import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_CSS, Kicker, displayStyle, resolveInvitePalette } from "@/lib/invite-theme";
import { InviteLeadForm, type InviteFormConfig } from "./invite/InviteLeadForm";

/* ----------------------------------------------------------------------------
 * Invite Reserve — type "invite-reserve"
 *
 * The reservation section: kicker + headline + sub on the left with a short
 * "what happens after you submit" checklist, the lead form in a hairline
 * panel on the right. Anchored at #reserve so every CTA on the page lands
 * here. Same lead pipeline / global-form shim as the hero's inline form.
 * -------------------------------------------------------------------------- */

export interface InviteReserveBlockProps extends InviteFormConfig {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  /** "What happens next" checklist, 2–4 lines. */
  nextSteps?: string[];
  formTitle?: string;
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: InviteReserveBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onFieldChange?: (updated: InviteReserveBlockProps) => void;
}

export const INVITE_RESERVE_DEFAULT_PROPS: InviteReserveBlockProps = {
  kicker: "Reserve",
  headline: "Reserve your working session",
  subheadline: "Tell us who you are and we'll come back within one business day with times.",
  nextSteps: [
    "We confirm a time that suits your team",
    "We ask for a rough sense of your scale so the session runs on your numbers",
    "You leave the call with a written plan",
  ],
  formTitle: "",
  fields: ["name", "email", "phone", "locations"],
  ctaText: "Reserve my session",
  riskLine: "30 minutes. No commitment.",
  successHeadline: "You're on the list.",
  successMessage: "Watch for a confirmation from the team within one business day.",
  chilipiperUrl: "",
  pickTimeText: "or pick a time now",
  consentText: "By submitting, you agree to be contacted about this request.",
  anchorId: "reserve",
};

export function BlockInviteReserve({ props, brand, pageId, variantId, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const steps = props.nextSteps ?? [];

  const field = (key: keyof InviteReserveBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as InviteReserveBlockProps[typeof key] }) : undefined;
  const updateStep = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, nextSteps: steps.map((s, idx) => (idx === i ? v : s)) })
    : undefined;

  return (
    <section id={props.anchorId || "reserve"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <style>{INVITE_CSS}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%]" style={{ background: `radial-gradient(60% 70% at 78% 100%, color-mix(in srgb, ${pal.accent} 12%, transparent) 0%, transparent 70%)` }} />
      <div className="relative mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-12 lg:gap-16 lg:px-10 lg:py-28">
        <div className="lg:col-span-6 flex flex-col gap-6">
          {(props.kicker || isEditor) && <Kicker palette={pal} align="left"><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>}
          {(props.headline || isEditor) && (
            <h2 className="max-w-[14ch]" style={displayStyle("clamp(2.4rem, 5vw, 4rem)")}>
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
          )}
          {(props.subheadline || isEditor) && (
            <p className="max-w-[46ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
          {steps.length > 0 && (
            <ul className="mt-2 flex flex-col gap-3" style={{ borderTop: `1px solid ${pal.hairline}`, paddingTop: "1.25rem" }}>
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: pal.accent, color: pal.onAccent }} aria-hidden="true">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <InlineText as="span" value={s} onUpdate={updateStep ? (v) => updateStep(i, v) : undefined} multiline />
                </li>
              ))}
            </ul>
          )}
        </div>

        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 20 })}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 rounded-[22px] p-6 sm:p-8"
          style={{ background: pal.panel, border: `1px solid ${pal.hairline}`, boxShadow: "0 40px 80px -50px rgba(0,0,0,0.8)" }}
        >
          {(props.formTitle || isEditor) && (
            <p className="mb-5 text-xl" style={{ fontFamily: "inherit", letterSpacing: "-0.01em" }}>
              <InlineText as="span" value={props.formTitle ?? ""} onUpdate={field("formTitle")} />
            </p>
          )}
          <InviteLeadForm
            config={props}
            palette={pal}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            source="invite-reserve"
            onConfigChange={onFieldChange ? (patch) => onFieldChange({ ...props, ...patch }) : undefined}
          />
        </motion.div>
      </div>
    </section>
  );
}
