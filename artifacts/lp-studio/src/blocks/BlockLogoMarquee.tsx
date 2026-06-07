import { cn } from "@/lib/utils";
import type { LogoMarqueeBlockProps, SocialProofLogo } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { BRAND_DISPLAY_STACK, BRAND_BODY_STACK } from "@/lib/brand-fonts";

interface Props {
  props: LogoMarqueeBlockProps;
  brand?: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: LogoMarqueeBlockProps) => void;
}

const DEFAULT_LOGOS: SocialProofLogo[] = [
  { name: "Northwind" },
  { name: "Lumina" },
  { name: "Vertex" },
  { name: "Cobalt" },
  { name: "Mirador" },
  { name: "Solstice" },
  { name: "Equinox" },
  { name: "Zenith" },
];

const SPEED_SECONDS: Record<NonNullable<LogoMarqueeBlockProps["speed"]>, number> = {
  slow: 60,
  medium: 40,
  fast: 24,
};

function Logo({
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
        className={cn("h-9 w-auto object-contain px-8", grayscale && "grayscale opacity-60")}
      />
    );
  }
  const initial = (logo.name || "").trim().charAt(0).toUpperCase() || "•";
  return (
    <div
      className="flex items-center gap-3 px-8 whitespace-nowrap"
      style={{ color: textColor, opacity: grayscale ? 0.55 : 1 }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
        style={{ backgroundColor: "rgba(100,116,139,0.12)" }}
      >
        {initial}
      </span>
      <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: family }}>
        {logo.name}
      </span>
    </div>
  );
}

export function BlockLogoMarquee({ props }: Props) {
  const bg = props.bgColor || "#ffffff";
  const textColor = props.textColor || "#334155";
  const grayscale = props.grayscale !== false;
  const twoRows = props.twoRows !== false;
  const duration = SPEED_SECONDS[props.speed ?? "medium"];
  const logos = props.logos && props.logos.length > 0 ? props.logos : DEFAULT_LOGOS;

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_STACK
    : BRAND_DISPLAY_STACK;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_STACK
    : BRAND_BODY_STACK;

  const Track = ({ reverse }: { reverse?: boolean }) => (
    <div className="flex overflow-hidden">
      <div
        className="lmq-track flex min-w-full shrink-0 items-center gap-4"
        style={{ animationDuration: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {logos.map((logo, i) => (
          <Logo key={`a-${i}`} logo={logo} grayscale={grayscale} family={headFamily} textColor={textColor} />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="lmq-track flex min-w-full shrink-0 items-center gap-4"
        style={{ animationDuration: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {logos.map((logo, i) => (
          <Logo key={`b-${i}`} logo={logo} grayscale={grayscale} family={headFamily} textColor={textColor} />
        ))}
      </div>
    </div>
  );

  return (
    <section className="w-full overflow-hidden" style={{ backgroundColor: bg }}>
      <style>{`
        @keyframes lmqScrollX {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .lmq-track { animation-name: lmqScrollX; animation-timing-function: linear; animation-iteration-count: infinite; }
        @media (prefers-reduced-motion: reduce) { .lmq-track { animation: none; } }
      `}</style>
      <div className="py-14 md:py-16">
        {props.eyebrow && (
          <p
            className="mb-10 text-center text-xs md:text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: "#64748b", fontFamily: bodyFamily }}
          >
            {props.eyebrow}
          </p>
        )}
        <div className="relative flex w-full flex-col gap-7">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 md:w-48"
            style={{ background: `linear-gradient(to right, ${bg}, transparent)` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 md:w-48"
            style={{ background: `linear-gradient(to left, ${bg}, transparent)` }}
          />
          <Track />
          {twoRows && <Track reverse />}
        </div>
      </div>
    </section>
  );
}
