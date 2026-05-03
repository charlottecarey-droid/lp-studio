import type { ReactNode } from "react";
import type { SectionBlockProps } from "@/lib/block-types/container-blocks";
import { getBgStyle } from "@/lib/bg-styles";
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
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--brand-primary, #003A30)",
              alignSelf: align === "center" ? "center" : undefined,
            }}
          />
        )}
        {(headline || onFieldChange) && (
          <InlineText
            as="h2"
            value={headline ?? ""}
            onUpdate={field("headline")}
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              fontWeight: 600,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
              alignSelf: align === "center" ? "center" : undefined,
            }}
          />
        )}
        {childrenSlot}
      </div>
    </section>
  );
}
