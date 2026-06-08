import { cn } from "@/lib/utils";
import type { LogoWallBlockProps, SocialProofLogo } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { BRAND_DISPLAY_STACK, BRAND_BODY_STACK } from "@/lib/brand-fonts";
import { RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: LogoWallBlockProps;
  brand?: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: LogoWallBlockProps) => void;
}

const DEFAULT_LOGOS: SocialProofLogo[] = [
  { name: "Northwind" },
  { name: "Lumina" },
  { name: "Vertex" },
  { name: "Cobalt" },
  { name: "Mirador" },
];

function LogoMark({
  logo,
  grayscale,
  family,
  textColor,
}: {
  logo: SocialProofLogo;
  grayscale: boolean;
  family: string;
  textColor: string;
}) {
  if (logo.imageUrl) {
    return (
      <img
        src={logo.imageUrl}
        alt={logo.name}
        loading="lazy"
        className={cn(
          "h-7 md:h-8 w-auto object-contain transition-all duration-300",
          grayscale && "grayscale opacity-60 hover:opacity-100 hover:grayscale-0",
        )}
      />
    );
  }
  const initial = (logo.name || "").trim().charAt(0).toUpperCase() || "•";
  return (
    <div
      className="flex items-center gap-2.5 transition-opacity duration-300"
      style={{ color: textColor, opacity: grayscale ? 0.6 : 1 }}
      aria-label={logo.name}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
        style={{ backgroundColor: "rgba(100,116,139,0.12)" }}
      >
        {initial}
      </span>
      <span
        className="text-xl md:text-2xl font-semibold tracking-tight whitespace-nowrap"
        style={{ fontFamily: family }}
      >
        {logo.name}
      </span>
    </div>
  );
}

export function BlockLogoWall({ props, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const textColor = props.textColor || surface.color || "#334155";
  const accent = props.accentColor || "var(--brand-accent, #6366f1)";
  const grayscale = props.grayscale !== false;
  const logos = props.logos && props.logos.length > 0 ? props.logos : DEFAULT_LOGOS;

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_STACK
    : BRAND_DISPLAY_STACK;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_STACK
    : BRAND_BODY_STACK;

  return (
    <section className="relative w-full overflow-hidden" style={{ background: surface.background }}>
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 -bottom-24 h-64 w-64 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-14 md:py-20 flex flex-col items-center gap-10 md:gap-12">
        {props.eyebrow && (
          <h2
            className="text-xs md:text-sm font-medium uppercase tracking-[0.2em] text-center"
            style={{ color: "#94a3b8", fontFamily: bodyFamily }}
          >
            {props.eyebrow}
          </h2>
        )}
        {onFieldChange ? (
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 md:gap-x-20 md:gap-y-10">
            {logos.map((logo, i) => (
              <LogoMark
                key={i}
                logo={logo}
                grayscale={grayscale}
                family={headFamily}
                textColor={textColor}
              />
            ))}
          </div>
        ) : (
          <RevealStagger className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 md:gap-x-20 md:gap-y-10">
            {logos.map((logo, i) => (
              <RevealItem key={i}>
                <LogoMark
                  logo={logo}
                  grayscale={grayscale}
                  family={headFamily}
                  textColor={textColor}
                />
              </RevealItem>
            ))}
          </RevealStagger>
        )}
      </div>
    </section>
  );
}
