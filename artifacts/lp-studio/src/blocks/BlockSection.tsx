import type { ReactNode } from "react";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_FONT;
import type { SectionBlockProps } from "@/lib/block-types/container-blocks";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: SectionBlockProps;
  onFieldChange?: (updated: SectionBlockProps) => void;
  /** Pre-rendered children (the recursive renderer fills this in). */
  childrenSlot?: ReactNode;
  isBuilder?: boolean;
}

const PAD_Y: Record<NonNullable<SectionBlockProps["paddingY"]>, string> = {
  compact: "2rem",
  default: "4rem",
  spacious: "6rem",
};

const MAX_W: Record<NonNullable<SectionBlockProps["maxWidth"]>, string> = {
  narrow: "640px",
  default: "1100px",
  wide: "1280px",
  full: "100%",
};

const ALIGN: Record<NonNullable<SectionBlockProps["align"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

export function BlockSection({ props, onFieldChange, childrenSlot, isBuilder }: Props) {
  void isBuilder;
  const {
    eyebrow,
    headline,
    backgroundStyle = "white",
    maxWidth = "default",
    paddingY = "default",
    align = "stretch",
    backgroundImage,
  } = props;

  const field = (key: keyof SectionBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const sectionBg = getBgStyle(backgroundStyle);
  // Eyebrow color is contrast-aware: on light sections we lean on
  // `--brand-eyebrow-on-light` (brand-primary stepped down to a near-black
  // ink when primary ≈ page bg), on dark sections we use
  // `--brand-eyebrow-on-dark` (a tint that contrasts with brand-primary).
  // Both vars are emitted by getBrandStyleVars on the page wrapper.
  const eyebrowColor = isDarkBg(backgroundStyle)
    ? "var(--brand-eyebrow-on-dark, #ffffff)"
    : "var(--brand-eyebrow-on-light, #003A30)";
  const padY = PAD_Y[paddingY];

  return (
    <section
      style={{
        ...sectionBg,
        paddingTop: padY,
        paddingBottom: padY,
        ...(backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
    >
      <div
        style={{
          maxWidth: MAX_W[maxWidth],
          margin: "0 auto",
          padding: "0 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: ALIGN[align],
          gap: "1.5rem",
        }}
      >
        {(eyebrow || onFieldChange) && (
          <InlineText
            as="p"
            value={eyebrow ?? ""}
            onUpdate={field("eyebrow")}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: eyebrowColor,
              alignSelf: align === "center" ? "center" : undefined,
              fontFamily: BODY,
            }}/>
        )}
        {(headline || onFieldChange) && (
          <InlineText
            as="h2"
            value={headline ?? ""}
            onUpdate={field("headline")}
            style={{
              fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)",
              fontWeight: "var(--brand-heading-weight, 700)" as unknown as number,
              letterSpacing: "-0.02em",
              lineHeight: 1.12,
              alignSelf: align === "center" ? "center" : undefined,
              fontFamily: DISPLAY,
            }}/>
        )}
        {childrenSlot}
      </div>
    </section>
  );
}
