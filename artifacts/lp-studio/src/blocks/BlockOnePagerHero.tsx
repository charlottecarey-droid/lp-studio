import dandyLogoWhiteUrl from "@/assets/dandy-logo-white.svg?url";
import type { OnePagerHeroBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

const DARK_GREEN = "#003A30";
const LIME = "#C7E738";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

const MOBILE_STYLES = `
  .one-pager-hero {
    flex-direction: row;
  }
  .one-pager-hero__left {
    flex: 0 0 55%;
    padding: 3rem 3.5rem 2.5rem;
  }
  .one-pager-hero__right {
    flex: 0 0 45%;
    min-height: unset;
  }
  .one-pager-hero__right-img-placeholder {
    min-height: 340px;
  }
  .one-pager-hero h1 {
    font-size: clamp(2rem, 4vw, 3.25rem);
  }
  @media (max-width: 768px) {
    .one-pager-hero {
      flex-direction: column;
    }
    .one-pager-hero__left {
      flex: none;
      width: 100%;
      padding: 2.25rem 1.75rem 2rem;
    }
    .one-pager-hero__right {
      flex: none;
      width: 100%;
      min-height: 52vw;
    }
    .one-pager-hero__right-img-placeholder {
      min-height: 52vw;
    }
    .one-pager-hero h1 {
      font-size: clamp(1.75rem, 7vw, 2.75rem);
    }
  }
`;

interface Props {
  props: OnePagerHeroBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: OnePagerHeroBlockProps) => void;
}

function getPanelBackground(variant: string, accent: string): string {
  const accentRgb = hexToRgb(accent) ?? { r: 199, g: 231, b: 56 };
  switch (variant) {
    case "mesh":
      return [
        `radial-gradient(ellipse 90% 70% at 10% 10%, rgba(0,102,81,0.85) 0%, transparent 60%)`,
        `radial-gradient(ellipse 60% 60% at 90% 90%, rgba(0,22,15,0.9) 0%, transparent 55%)`,
        `radial-gradient(ellipse 55% 40% at 50% 115%, rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.10) 0%, transparent 55%)`,
        DARK_GREEN,
      ].join(", ");
    case "diagonal":
      return `linear-gradient(135deg, #005B44 0%, #003A30 45%, #001E18 100%)`;
    case "solid":
    default:
      return [
        `radial-gradient(ellipse 75% 60% at 15% 15%, rgba(0,102,81,0.65) 0%, transparent 60%)`,
        `radial-gradient(ellipse 50% 45% at 88% 88%, rgba(0,18,12,0.80) 0%, transparent 55%)`,
        `radial-gradient(ellipse 80% 55% at 50% 120%, rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.07) 0%, transparent 50%)`,
        DARK_GREEN,
      ].join(", ");
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function BlockOnePagerHero({ props, onFieldChange }: Props) {
  const { partnerName, headline, subtitle, tagline, sideImageUrl, phone } = props;
  const accent = props.accentColor ?? LIME;
  const panelVariant = props.panelVariant ?? "solid";
  const displayHeadline = headline ?? partnerName;

  return (
    <>
      <style>{MOBILE_STYLES}</style>
      <section
        className="one-pager-hero"
        style={{
          width: "100%",
          minHeight: 340,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* ── Left panel ── */}
        <div
          className="one-pager-hero__left"
          style={{
            background: getPanelBackground(panelVariant, accent),
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative orb — top right corner */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-60px",
              right: "-60px",
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(0,120,90,0.35) 0%, transparent 70%)`,
              filter: "blur(32px)",
              pointerEvents: "none",
            }}
          />
          {/* Decorative orb — bottom left */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "-40px",
              left: "-40px",
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(0,60,40,0.4) 0%, transparent 70%)`,
              filter: "blur(24px)",
              pointerEvents: "none",
            }}
          />

          {/* Logo */}
          <div style={{ marginBottom: "2.5rem", position: "relative", zIndex: 1 }}>
            <img src={dandyLogoWhiteUrl} alt="Dandy" style={{ height: 28, width: "auto" }} />
          </div>

          {/* Content */}
          <div
            style={{
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
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
                  color: accent,
                  marginBottom: "1.25rem",
                  fontFamily: "sans-serif",
                }}
              />
            )}

            <h1
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              <InlineText
                as="span"
                value={displayHeadline}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined}
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

          {/* Phone */}
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
                position: "relative",
                zIndex: 1,
              }}
            />
          )}
        </div>

        {/* ── Right panel ── */}
        <div
          className="one-pager-hero__right"
          style={{ overflow: "hidden", position: "relative" }}
        >
          {sideImageUrl ? (
            <img
              src={sideImageUrl}
              alt={partnerName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
              }}
            />
          ) : (
            <div
              className="one-pager-hero__right-img-placeholder"
              style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(150deg, #005540 0%, #003A30 60%, #001E18 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.22)",
                  fontSize: "0.875rem",
                  fontStyle: "italic",
                }}
              >
                Add a side image
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
