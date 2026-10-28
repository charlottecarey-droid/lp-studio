import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Mail } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import type { CtaModalConfig, HeroCtaActionMode } from "@/lib/block-types";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { safeNavigate } from "@/lib/safe-url";
import { HUB_BODY, HUB_CSS, HUB_PILL_CLASS, HubKicker, hubDisplayStyle, hubPillStyle, resolveHubPalette, type HubStyleProps } from "@/lib/hub-theme";

/* ----------------------------------------------------------------------------
 * Content Hub Support — type "hub-support"
 *
 * The close: "Questions?" — a kicker, a short display headline, one line of
 * body, a mailto pill and an optional arrow link (help center), then a small
 * disclaimer line ("Educational information only. Not medical advice.").
 * Surface from the preset (brand-dark for the editorial idiom, tinted paper
 * for the brand-site / gallery idioms). The link keys are `linkText` /
 * `linkUrl` on purpose — `ctaText` / `ctaUrl` are the Page-CTA aliases and
 * a support close must never be hijacked by a page-level CTA.
 * -------------------------------------------------------------------------- */

export interface HubSupportBlockProps extends HubStyleProps, CtaModalConfig {
  kicker?: string;
  headline?: string;
  body?: string;
  /** Renders a mailto pill ("Email support@…"). */
  email?: string;
  /** Pill label. Blank = "Email <address>". */
  emailLabel?: string;
  /** The second button: a link by default, or any shared CTA action (form modal, Chili Piper, video). */
  linkText?: string;
  linkUrl?: string;
  linkAction?: HeroCtaActionMode;
  linkChilipiperUrl?: string;
  linkVideoUrl?: string;
  disclaimer?: string;
  anchorId?: string;
}

interface Props {
  props: HubSupportBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HubSupportBlockProps) => void;
}

export const HUB_SUPPORT_DEFAULT_PROPS: HubSupportBlockProps = {
  kicker: "Questions?",
  headline: "Can't find what you need?\nJust ask.",
  body: "Our team answers every message — usually within a business day.",
  email: "",
  emailLabel: "",
  linkText: "Visit the help center",
  linkUrl: "",
  disclaimer: "",
  anchorId: "support",
};

export function BlockHubSupport({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "support");
  const t = pal.t;
  const isEditor = !!onFieldChange;
  const email = (props.email ?? "").trim();
  const link = (props.linkUrl ?? "").trim();
  const linkAction = props.linkAction ?? "url";
  // A link needs a destination; the other actions carry their own.
  const hasLinkButton = !!(props.linkText ?? "").trim() && (linkAction !== "url" || !!link);
  const emailLabel = (props.emailLabel ?? "").trim() || (email ? `Email ${email}` : "");
  const navigateLink = () => {
    if (isEditor || !link) return;
    safeNavigate(link, link.startsWith("http") ? "_blank" : "_self");
  };

  const field = (key: keyof HubSupportBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as HubSupportBlockProps[typeof key] }) : undefined;

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="hub-support relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY, borderTop: t.theme === "mono" ? `1px solid ${pal.hairline}` : undefined }}>
      <style>{HUB_CSS}</style>
      {pal.isDark && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: `radial-gradient(50% 70% at 50% 110%, color-mix(in srgb, ${pal.accentFill} 16%, transparent), transparent 70%)` }} />
      )}
      <div className="relative mx-auto flex w-full max-w-page flex-col items-center px-6 py-20 text-center lg:px-10 lg:py-28">
        {(props.kicker || isEditor) && (
          <motion.div {...rise(0)} className="mb-6">
            <HubKicker palette={pal} align="center">
              <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
            </HubKicker>
          </motion.div>
        )}
        <motion.h2 {...rise(0.06)} className="max-w-[18ch] whitespace-pre-line" style={hubDisplayStyle(pal, "clamp(2rem, 4.4vw, 3.6rem)")}>
          <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
        </motion.h2>
        {(props.body || isEditor) && (
          <motion.p {...rise(0.12)} className="mt-5 max-w-[52ch] text-[15px] leading-relaxed lg:text-[17px]" style={{ color: pal.muted }}>
            <InlineText as="span" value={props.body ?? ""} onUpdate={field("body")} multiline />
          </motion.p>
        )}
        {(email || hasLinkButton || isEditor) && (
          <motion.div {...rise(0.18)} className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            {(email || isEditor) && (
              <a href={email ? `mailto:${email}` : "#"} className={HUB_PILL_CLASS} style={hubPillStyle(pal)} data-hub-email>
                <Mail className="h-4 w-4" aria-hidden />
                <InlineText as="span" value={emailLabel || (isEditor ? "Email us" : "")} onUpdate={field("emailLabel")} />
              </a>
            )}
            {(hasLinkButton || isEditor) && (
              <CtaButton
                ctaAction={linkAction}
                ctaUrl={link}
                chilipiperUrl={props.linkChilipiperUrl}
                videoUrl={props.linkVideoUrl}
                {...pickCtaModalConfig(props)}
                onClick={linkAction === "url" ? navigateLink : undefined}
                className={HUB_PILL_CLASS}
                style={hubPillStyle(pal, "ghost")}
                brand={brand}
                source="hub-support-link"
                modalTheme={pal.isDark ? "dark" : "light"}
                animationsEnabled={!reduced}
              >
                <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
                {linkAction === "url" && <ArrowUpRight className="h-4 w-4" aria-hidden />}
              </CtaButton>
            )}
          </motion.div>
        )}
        {(props.disclaimer || isEditor) && (
          <motion.p {...rise(0.24)} className="mt-12 max-w-[64ch] text-[12px] leading-relaxed" style={{ color: pal.faint }}>
            <InlineText as="span" value={props.disclaimer ?? ""} onUpdate={field("disclaimer")} multiline />
          </motion.p>
        )}
      </div>
    </section>
  );
}
