import type { BrandConfig } from "@/lib/brand-config";
import type { HoursLocationBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: HoursLocationBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HoursLocationBlockProps) => void;
  onCtaClick?: () => void;
}

export function BlockHoursLocation({ props, brand, onFieldChange, onCtaClick }: Props) {
  const bg = props.bgColor ?? "#0F0F10";
  const text = props.textColor ?? "#F5F2EC";
  const accent = props.accentColor ?? brand.primaryColor ?? "#C7A664";

  const updateField = <K extends keyof HoursLocationBlockProps>(
    key: K,
    value: HoursLocationBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  return (
    <section
      className="px-6 py-20 sm:py-28"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("eyebrow", v) : undefined}
              className="text-xs uppercase tracking-[0.3em] mb-3"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => updateField("headline", v) : undefined}
            className="text-4xl sm:text-5xl font-serif tracking-tight" style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("subheadline", v) : undefined}
              className="mt-3 opacity-70 max-w-xl mx-auto" style={{ fontFamily: BODY }} />
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Hours */}
          <div className="rounded-2xl p-8 md:p-10" style={{ backgroundColor: `${text}0a`, border: `1px solid ${text}1a` }}>
            <h3 className="text-xs uppercase tracking-[0.25em] mb-5 opacity-70" style={{ fontFamily: DISPLAY }}>Hours</h3>
            <ul className="space-y-3">
              {props.hours.map((row, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 text-base" style={{ ...(row.highlight ? { color: accent, fontWeight: 600 } : undefined), fontFamily: BODY }}>
                  <span style={{ fontFamily: BODY }}>{row.day}</span>
                  <span className="tabular-nums opacity-90" style={{ fontFamily: BODY }}>{row.hours}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Location */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: `${text}0a`, border: `1px solid ${text}1a` }}>
            <div className="p-8 md:p-10">
              <h3 className="text-xs uppercase tracking-[0.25em] mb-5 opacity-70" style={{ fontFamily: DISPLAY }}>Find us</h3>
              <p className="font-serif text-2xl mb-2" style={{ fontFamily: BODY }}>{props.businessName}</p>
              <p className="opacity-80" style={{ fontFamily: BODY }}>{props.addressLine1}</p>
              {props.addressLine2 && <p className="opacity-80" style={{ fontFamily: BODY }}>{props.addressLine2}</p>}
              {(props.phone || props.email) && (
                <div className="mt-4 space-y-1 text-sm opacity-80">
                  {props.phone && <p style={{ fontFamily: BODY }}>{props.phone}</p>}
                  {props.email && <p style={{ fontFamily: BODY }}>{props.email}</p>}
                </div>
              )}
              {props.ctaText && props.ctaUrl && (
                <button
                  onClick={onCtaClick}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent, color: "#0F0F10" }}
                >
                  {props.ctaText}
                </button>
              )}
            </div>
            {props.mapEmbedUrl && (
              <div className="aspect-[16/9] w-full">
                <iframe
                  src={props.mapEmbedUrl}
                  title="Map"
                  className="w-full h-full"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
