import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Clock, Mail, Phone } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_CSS, INVITE_DISPLAY, INVITE_PILL_CLASS, Kicker, displayStyle, pillStyle, resolveInvitePalette } from "@/lib/invite-theme";

/* ----------------------------------------------------------------------------
 * Kit Support — type "kit-support"
 *
 * The close of a kit page: "NEED A HAND?" with a headline, a sentence, one
 * pill CTA (usually mailto:) and the contact rows (email / phone / hours), and
 * beside it a hairline panel that asks the recipient to share the experience
 * — with a secondary link (book the live tour, talk to the team).
 *
 * `ctaText`/`ctaUrl` is the block's primary action and follows the Page CTA;
 * the share panel's `linkText`/`linkUrl` deliberately does not.
 * -------------------------------------------------------------------------- */

export interface KitSupportBlockProps {
  kicker?: string;
  headline?: string;
  body?: string;
  ctaText?: string;
  ctaUrl?: string;
  email?: string;
  phone?: string;
  hoursNote?: string;
  shareKicker?: string;
  shareHeadline?: string;
  shareBody?: string;
  linkText?: string;
  linkUrl?: string;
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: KitSupportBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: KitSupportBlockProps) => void;
}

export const KIT_SUPPORT_DEFAULT_PROPS: KitSupportBlockProps = {
  kicker: "Need a hand?",
  headline: "Stuck on a step?\nWe'll get you in.",
  body: "Reply to the email that came with your kit, or reach the team directly — a real person answers.",
  ctaText: "Email the team",
  ctaUrl: "",
  email: "",
  phone: "",
  hoursNote: "Weekdays, 9am–6pm ET",
  shareKicker: "Then",
  shareHeadline: "Share the experience.",
  shareBody: "Pass the headset around the office, then bring the whole team for the real thing.",
  linkText: "Book a live tour",
  linkUrl: "",
  anchorId: "help",
};

export function BlockKitSupport({ props, brand, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;

  const field = (key: keyof KitSupportBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as KitSupportBlockProps[typeof key] }) : undefined;

  const ctaHref = props.ctaUrl || (props.email ? `mailto:${props.email}` : "");
  const rows = [
    { Icon: Mail, value: props.email, href: props.email ? `mailto:${props.email}` : undefined, key: "email" as const },
    { Icon: Phone, value: props.phone, href: props.phone ? `tel:${props.phone.replace(/[^\d+]/g, "")}` : undefined, key: "phone" as const },
    { Icon: Clock, value: props.hoursNote, href: undefined, key: "hoursNote" as const },
  ].filter((r) => r.value || isEditor);

  return (
    <section id={props.anchorId || "help"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <style>{INVITE_CSS}</style>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: `radial-gradient(60% 50% at 20% 100%, color-mix(in srgb, ${pal.accent} 12%, transparent) 0%, transparent 70%)` }} />
      <div className="relative mx-auto w-full max-w-[1240px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <motion.div
            initial={reduced ? false : anim({ opacity: 0, y: 16 })}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6 lg:col-span-7"
          >
            {(props.kicker || isEditor) && <Kicker palette={pal} align="left"><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>}
            <h2 className="max-w-[14ch] whitespace-pre-line" style={displayStyle("clamp(2.4rem, 5vw, 4.2rem)")}>
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
            {(props.body || isEditor) && (
              <p className="max-w-[48ch] text-[15px] leading-relaxed lg:text-base" style={{ color: pal.muted }}>
                <InlineText as="span" value={props.body ?? ""} onUpdate={field("body")} multiline />
              </p>
            )}
            {(props.ctaText || isEditor) && (
              <div>
                <a href={ctaHref || "#"} onClick={() => onCtaClick?.()} className={INVITE_PILL_CLASS} style={pillStyle(pal)}>
                  <InlineText as="span" value={props.ctaText ?? ""} onUpdate={field("ctaText")} />
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            )}
            {rows.length > 0 && (
              <ul className="mt-2 flex flex-col divide-y" style={{ borderTop: `1px solid ${pal.hairline}`, borderBottom: `1px solid ${pal.hairline}`, borderColor: pal.hairline }}>
                {rows.map(({ Icon, value, href, key }) => (
                  <li key={key} className="flex items-center gap-4 py-3.5 text-[15px]" style={{ borderColor: pal.hairline }}>
                    <Icon className="h-4 w-4 shrink-0" style={{ color: pal.accent }} aria-hidden />
                    {href && !isEditor ? (
                      <a href={href} className="underline-offset-4 hover:underline">{value}</a>
                    ) : (
                      <InlineText as="span" value={value ?? ""} onUpdate={field(key)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          <motion.aside
            initial={reduced ? false : anim({ opacity: 0, y: 16 })}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-between gap-8 rounded-[24px] p-7 lg:col-span-5 lg:p-9"
            style={{ background: pal.panel, border: `1px solid ${pal.hairline}` }}
          >
            <div className="flex flex-col gap-4">
              {(props.shareKicker || isEditor) && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em]" style={{ color: pal.accent }}>
                  <InlineText as="span" value={props.shareKicker ?? ""} onUpdate={field("shareKicker")} />
                </p>
              )}
              {(props.shareHeadline || isEditor) && (
                <h3 className="text-2xl lg:text-[1.9rem]" style={{ fontFamily: INVITE_DISPLAY, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  <InlineText as="span" value={props.shareHeadline ?? ""} onUpdate={field("shareHeadline")} multiline />
                </h3>
              )}
              {(props.shareBody || isEditor) && (
                <p className="text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                  <InlineText as="span" value={props.shareBody ?? ""} onUpdate={field("shareBody")} multiline />
                </p>
              )}
            </div>
            {((props.linkText && props.linkUrl) || isEditor) && (
              <a
                href={props.linkUrl || "#"}
                target={props.linkUrl && !props.linkUrl.startsWith("#") ? "_blank" : undefined}
                rel={props.linkUrl && !props.linkUrl.startsWith("#") ? "noopener noreferrer" : undefined}
                className={INVITE_PILL_CLASS}
                style={pillStyle(pal, "ghost")}
              >
                <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            )}
          </motion.aside>
        </div>
      </div>
    </section>
  );
}
