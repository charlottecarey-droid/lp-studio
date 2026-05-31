import type { OnePagerHeroBlockProps } from "@/lib/block-types";
import { resolveOnePagerAssets, type BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { BrandLogo } from "@/components/BrandLogo";

const LIME = "#C7E738";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = `${BRAND_BODY_FONT}, system-ui, sans-serif`;

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

// Mix a hex color toward black (amount < 0) or white (amount > 0) by `amount`
// in [-1, 1]. Used to derive the darker/lighter shades of the brand primary
// that build the hero band gradient, so the band tracks whatever primary the
// tenant chose (one-pager override or brand default) instead of hardcoded green.
function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (c: number) => Math.round((t - c) * p + c);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPanelBackground(variant: string, primary: string, accent: string): string {
  const lighter = shade(primary, 0.18);
  const darker = shade(primary, -0.55);
  const darkest = shade(primary, -0.82);
  switch (variant) {
    case "mesh":
      return [
        `radial-gradient(ellipse 90% 70% at 10% 10%, ${rgba(lighter, 0.85)} 0%, transparent 60%)`,
        `radial-gradient(ellipse 60% 60% at 90% 90%, ${rgba(darkest, 0.9)} 0%, transparent 55%)`,
        `radial-gradient(ellipse 55% 40% at 50% 115%, ${rgba(accent, 0.1)} 0%, transparent 55%)`,
        primary,
      ].join(", ");
    case "diagonal":
      return `linear-gradient(135deg, ${lighter} 0%, ${primary} 45%, ${darkest} 100%)`;
    case "solid":
    default:
      return [
        `radial-gradient(ellipse 75% 60% at 15% 15%, ${rgba(lighter, 0.65)} 0%, transparent 60%)`,
        `radial-gradient(ellipse 50% 45% at 88% 88%, ${rgba(darker, 0.8)} 0%, transparent 55%)`,
        `radial-gradient(ellipse 80% 55% at 50% 120%, ${rgba(accent, 0.07)} 0%, transparent 50%)`,
        primary,
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

export function BlockOnePagerHero({ props, brand, onFieldChange }: Props) {
  const { partnerName, headline, subtitle, tagline, sideImageUrl, phone } = props;
  const primary = brand?.primaryColor || "#003B2D";
  const accent = props.accentColor ?? brand?.accentColor ?? LIME;
  const panelVariant = props.panelVariant ?? "solid";
  const headingWeight = props.boldHeading === false ? 400 : 700;
  const displayHeadline = headline ?? partnerName;
  const logoUrl = resolveOnePagerAssets(brand).logoUrl;

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
            background: getPanelBackground(panelVariant, primary, accent),
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
              background: `radial-gradient(circle, ${rgba(shade(primary, 0.25), 0.35)} 0%, transparent 70%)`,
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
              background: `radial-gradient(circle, ${rgba(shade(primary, -0.45), 0.4)} 0%, transparent 70%)`,
              filter: "blur(24px)",
              pointerEvents: "none",
            }}
          />

          {/* Logo — prefer the resolved one-pager logo image; fall back to a
              styled brand-name wordmark only when no logo asset exists. */}
          <div style={{ marginBottom: "2.5rem", position: "relative", zIndex: 1 }}>
            {logoUrl ? (
              <BrandLogo brand={brand} url={logoUrl} tone="onPrimary" alt={brand?.brandName || "Logo"} className="h-7 w-auto" />
            ) : brand?.brandName ? (
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: "1.25rem",
                  letterSpacing: "-0.01em",
                  color: "#fff",
                }}
              >
                {brand.brandName}
              </span>
            ) : null}
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
                  fontFamily: BODY,
                }}
              />
            )}

            <h1
              style={{
                fontFamily: DISPLAY,
                fontWeight: headingWeight,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              <InlineText as="span" value={displayHeadline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: headingWeight }} />
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
                  fontFamily: BODY,
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
                fontFamily: BODY,
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
                background: `linear-gradient(150deg, ${shade(primary, 0.12)} 0%, ${primary} 60%, ${shade(primary, -0.82)} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.875rem", fontStyle: "italic", fontFamily: BODY }}>
                Add a side image
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
