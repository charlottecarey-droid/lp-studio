import { cn } from "@/lib/utils";
import {
  type BrandConfig,
  DEFAULT_BRAND,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
  pickOutlineButtonColors,
  relativeLuminance,
} from "@/lib/brand-config";
import type { DandyConversionPanel1BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/** Darken a hex toward black by `amount` (0-1). Used to resolve the "medium"
 *  preset (a darkened primary) to a concrete hex for contrast math. */
function darkenHex(hex: string, amount: number): string {
  if (!isValidHex(hex)) return hex;
  const f = Math.max(0, Math.min(1, 1 - amount));
  const c = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * f)
      .toString(16)
      .padStart(2, "0");
  return `#${c(1)}${c(3)}${c(5)}`;
}

interface Props {
  props: DandyConversionPanel1BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyConversionPanel1BlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockDandyConversionPanel1({ props, brand, onFieldChange, pageId, variantId }: Props) {
  const style = props.style ?? "teal";

  const field = (key: keyof DandyConversionPanel1BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  // Resolve the section background to a concrete hex so the WCAG contrast
  // guards below run for the preset CSS-var styles too — not just when the
  // tenant/AI sets a literal `bgColor`. Pairing two brand vars (heading =
  // --brand-primary on a --brand-accent section, or button bg=primary /
  // text=accent) goes invisible when a brand's primary and accent are the
  // same hue. Deriving every color from the actual background hex keeps the
  // panel legible on any palette.
  const primaryHex = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const accentHex = isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor;
  const styleBg: Record<string, string> = {
    teal: primaryHex,
    lime: accentHex,
    medium: darkenHex(primaryHex, 0.2),
    white: "#FFFFFF",
  };
  const bg = props.bgColor && isValidHex(props.bgColor) ? props.bgColor : styleBg[style] ?? primaryHex;

  const onDark = relativeLuminance(bg) < 0.4;
  const headingColor = onDark ? "#ffffff" : pickContrastingColor(primaryHex, bg, ["#0f172a"], 4.5);
  const eyebrowColor = pickContrastingColor(
    accentHex,
    bg,
    onDark ? ["#ffffff"] : [primaryHex, "#0f172a"],
    4.5,
  );
  const subColor = onDark ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.70)";
  const dividerColor = onDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.12)";

  // Buttons always resolve through the contrast guards now that `bg` is a
  // concrete hex, so a brand-colored section can never hide the CTA fill or
  // its label.
  const ctaColors = pickCtaButtonColors(brand, bg);
  const outlineColors = pickOutlineButtonColors(brand, bg);
  const primaryBtnCls = "hover:brightness-105";
  const secondaryBtnCls = "border-2 hover:opacity-80";

  // Resolve the runtime CTA mode with a legacy fallback. The current panel
  // writes `{primary,secondary}CtaAction`, but the "Apply CTA to All Sections"
  // helper in BuilderEditor still writes the legacy `primaryCtaMode` field on
  // every block that has a `primaryCtaUrl` — including this one. Without the
  // fallback, primary silently reverts to URL mode (and the modal never
  // opens) after the user runs Apply-to-all from a modal-mode source block,
  // while secondary keeps working because Apply-to-all only touches primary.
  const resolveAction = (
    action: string | undefined,
    legacyMode: string | undefined,
  ): "url" | "chilipiper" | "modal-form" | "modal-chilipiper" => {
    const v = action ?? legacyMode;
    return v === "chilipiper" || v === "modal-form" || v === "modal-chilipiper" ? v : "url";
  };

  const modalCfg = {
    modalChilipiperUrl: props.modalChilipiperUrl,
    modalFormSource: props.modalFormSource,
    modalFormId: props.modalFormId,
    modalMarketoBaseUrl: props.modalMarketoBaseUrl,
    modalMarketoMunchkinId: props.modalMarketoMunchkinId,
    modalMarketoFormId: props.modalMarketoFormId,
    modalChiliPiperHandoffUrl: props.modalChiliPiperHandoffUrl,
    modalChiliPiperHandoffMode: props.modalChiliPiperHandoffMode,
    modalChiliPiperHandoffFieldMap: props.modalChiliPiperHandoffFieldMap,
    modalHeadline: props.modalHeadline,
    modalSubheadline: props.modalSubheadline,
    modalSubmitText: props.modalSubmitText,
    modalSuccessMessage: props.modalSuccessMessage,
    modalDisclaimer: props.modalDisclaimer,
    modalShowFirstName: props.modalShowFirstName,
    modalShowLastName: props.modalShowLastName,
    modalShowPhone: props.modalShowPhone,
    modalShowCompany: props.modalShowCompany,
  };

  return (
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className="max-w-4xl mx-auto px-6 md:px-10 text-center flex flex-col items-center gap-6">
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: BODY, color: eyebrowColor }}>
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
          </p>
        )}
        <h2 className="text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight" style={{ fontFamily: DISPLAY, color: headingColor }}>
          <InlineText value={props.headline} onUpdate={field("headline")} style={{ fontFamily: DISPLAY }}/>
        </h2>
        {props.subheadline && (
          <p className="text-lg leading-relaxed max-w-2xl" style={{ fontFamily: BODY, color: subColor }}>
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} style={{ fontFamily: BODY }}/>
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {props.primaryCtaText && (
            <CtaButton
              ctaAction={resolveAction(
                props.primaryCtaAction,
                (props as unknown as Record<string, unknown>).primaryCtaMode as string | undefined,
              )}
              ctaUrl={props.primaryCtaUrl}
              chilipiperUrl={props.primaryChilipiperUrl}
              {...modalCfg}
              className={cn("font-bold px-10 py-4 rounded-xl text-base transition-all", primaryBtnCls)}
              style={{ backgroundColor: ctaColors.bg, color: ctaColors.text }}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dandy-conversion-panel-primary"
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} style={{ fontFamily: BODY }}/>
            </CtaButton>
          )}
          {props.secondaryCtaText && (
            <CtaButton
              ctaAction={resolveAction(
                props.secondaryCtaAction,
                (props as unknown as Record<string, unknown>).secondaryCtaMode as string | undefined,
              )}
              ctaUrl={props.secondaryCtaUrl}
              chilipiperUrl={props.secondaryChilipiperUrl}
              {...modalCfg}
              className={cn("font-semibold px-10 py-4 rounded-xl text-base transition-all", secondaryBtnCls)}
              style={{ borderColor: outlineColors.border, color: outlineColors.text }}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dandy-conversion-panel-secondary"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} style={{ fontFamily: BODY }}/>
            </CtaButton>
          )}
        </div>

        {(props.stats ?? []).length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-14 gap-y-5 mt-8 pt-10 border-t w-full" style={{ borderColor: dividerColor }}>
            {(props.stats ?? []).map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold" style={{ color: headingColor }}>{s.value}</div>
                <div className="text-sm mt-0.5" style={{ color: subColor }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
