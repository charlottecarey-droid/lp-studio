import dandyLogoWhiteUrl from "@/assets/dandy-logo-white.svg?url";
import type { OnePagerHeroBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

const DARK_GREEN = "#003A30";
const LIME = "#C7E738";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

interface Props {
  props: OnePagerHeroBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: OnePagerHeroBlockProps) => void;
}

export function BlockOnePagerHero({ props, onFieldChange }: Props) {
  const { partnerName, subtitle, tagline, sideImageUrl, phone } = props;

  return (
    <section
      style={{
        width: "100%",
        minHeight: 340,
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: "0 0 55%",
          background: DARK_GREEN,
          display: "flex",
          flexDirection: "column",
          padding: "3rem 3.5rem 2.5rem",
        }}
      >
        <div style={{ marginBottom: "2.5rem" }}>
          <img src={dandyLogoWhiteUrl} alt="Dandy" style={{ height: 28, width: "auto" }} />
        </div>

        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {tagline && (
            <InlineText
              as="p"
              value={tagline}
              onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, tagline: v }) : undefined}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase" as const,
                color: LIME,
                marginBottom: "1.25rem",
                fontFamily: "sans-serif",
              }}
            />
          )}

          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(2rem,4vw,3.25rem)",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            <span style={{ color: LIME }}>& </span>
            <InlineText
              as="span"
              value={partnerName}
              onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, partnerName: v }) : undefined}
              style={{ color: "#fff" }}
            />
          </h1>

          {subtitle !== undefined && (
            <InlineText
              as="p"
              value={subtitle ?? ""}
              onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, subtitle: v }) : undefined}
              style={{
                marginTop: "1.5rem",
                fontSize: "1rem",
                color: "rgba(255,255,255,0.68)",
                lineHeight: 1.7,
                maxWidth: 400,
                fontFamily: "sans-serif",
              }}
              multiline
            />
          )}
        </div>

        {phone && (
          <InlineText
            as="p"
            value={phone}
            onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, phone: v }) : undefined}
            style={{
              marginTop: "2.5rem",
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.45)",
              fontFamily: "sans-serif",
            }}
          />
        )}
      </div>

      <div style={{ flex: "0 0 45%", overflow: "hidden", position: "relative" }}>
        {sideImageUrl ? (
          <img
            src={sideImageUrl}
            alt={partnerName}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 340,
              background: "linear-gradient(150deg,#005540 0%,#003A30 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.875rem", fontStyle: "italic" }}>
              Add a side image
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
