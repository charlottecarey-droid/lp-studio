import { Clock } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { SocialUrgencyFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: SocialUrgencyFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: SocialUrgencyFinalCtaBlockProps) => void;
}

export function BlockSocialUrgencyFinalCta({ props, brand, onFieldChange }: Props) {
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const bg = props.bgColor ?? "#FFFFFF";
  const ink = props.textColor ?? pickContrastingColor(undefined, bg, ["#0F172A", "#FFFFFF"]);
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const avatars = props.avatarUrls ?? [];

  const update = <K extends keyof SocialUrgencyFinalCtaBlockProps>(key: K, value: SocialUrgencyFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="w-full px-6 py-20 sm:py-28" style={{ backgroundColor: bg, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto max-w-3xl text-center">
        {(props.urgencyText || onFieldChange) && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: `${accent}1A`, color: accent }}>
            <Clock className="h-4 w-4" />
            <InlineText as="span" value={props.urgencyText ?? ""} onUpdate={onFieldChange ? (v) => update("urgencyText", v) : undefined} />
          </div>
        )}
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
        )}
        <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }} />
        {(props.subheading || onFieldChange) && (
          <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: muted }} multiline />
        )}
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-10">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="social-urgency-final-cta"
              className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-semibold shadow-sm"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Claim your spot"}
            </CtaButton>
          </div>
        )}
        {(avatars.length > 0 || props.proofText || onFieldChange) && (
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {avatars.length > 0 && (
              <div className="flex -space-x-3">
                {avatars.slice(0, 6).map((src, i) => (
                  <img key={i} src={src} alt="" className="h-9 w-9 rounded-full border-2 object-cover" style={{ borderColor: bg }} />
                ))}
              </div>
            )}
            {(props.proofText || onFieldChange) && (
              <InlineText as="p" value={props.proofText ?? ""} onUpdate={onFieldChange ? (v) => update("proofText", v) : undefined} className="text-sm font-medium" style={{ color: muted }} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
