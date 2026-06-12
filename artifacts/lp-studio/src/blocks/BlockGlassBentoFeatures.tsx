import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import { resolveSectionInk } from "@/lib/section-ink";
import { IconOrImage } from "@/lib/icon-value";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/* ----------------------------------------------------------------------------
 * Glass Bento Features — type "glass-bento-features"
 *
 * A 12-column bento feature grid: one 2-row hero card with an image, wide
 * cards, and small icon cards. Light mode renders soft layered shadows on an
 * off-white section; dark mode renders frosted-glass cards (backdrop-blur,
 * white/5 borders) over a faint brand-accent gradient mesh. Cards get a
 * staggered scroll-reveal and a hover lift + border-glow, both fully disabled
 * under prefers-reduced-motion.
 * -------------------------------------------------------------------------- */

export type GlassBentoCardSpan = "hero" | "wide" | "third" | "quarter";

export interface GlassBentoCard {
  /** Grid footprint on desktop (12-col grid): hero = 6 cols × 2 rows with an
   *  image, wide = 6 cols, third = 4 cols, quarter = 3 cols. */
  span: GlassBentoCardSpan;
  /** Lucide icon name (e.g. "Zap") or an image URL — resolved by IconOrImage. */
  icon?: string;
  title: string;
  body?: string;
  /** Optional card image (the hero card is designed around one). */
  imageUrl?: string;
  imageAlt?: string;
  /** Optional CSS object-position focal point, e.g. "50% 30%". */
  imageFocal?: string;
  /** Optional big metric rendered above the title, e.g. "10×" or "99.9%". */
  stat?: string;
}

export interface GlassBentoFeaturesBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  /** "light" = off-white + layered shadows; "dark" = frosted glass over a
   *  brand-accent gradient mesh. Default "light". */
  theme?: "light" | "dark";
  /** Section background override (hex). Defaults per theme. */
  bgColor?: string;
  /** Body/heading text override (hex). Defaults per theme. */
  textColor?: string;
  /** Accent override (hex). Defaults to the brand accent. */
  accentColor?: string;
  cards: GlassBentoCard[];
}

interface Props {
  props: GlassBentoFeaturesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GlassBentoFeaturesBlockProps) => void;
}

const SPAN_CLASS: Record<GlassBentoCardSpan, string> = {
  hero: "lg:col-span-6 lg:row-span-2 order-first lg:order-none",
  wide: "lg:col-span-6",
  third: "lg:col-span-4",
  quarter: "lg:col-span-3",
};

export const GLASS_BENTO_DEFAULT_PROPS: GlassBentoFeaturesBlockProps = {
  eyebrow: "Platform",
  headline: "Everything your team ships with.",
  subheadline:
    "One workspace for the whole pipeline — built to stay fast at any scale, and beautiful by default.",
  theme: "light",
  cards: [
    {
      span: "hero",
      title: "One command from idea to production",
      body: "Connect a repo and ship the first deploy in under a minute — previews, rollbacks, and metrics included.",
      imageUrl:
        "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=1200&h=800&fit=crop",
      imageAlt: "Team collaborating around a laptop in a modern studio",
      icon: "Rocket",
    },
    {
      span: "wide",
      icon: "Zap",
      title: "Instant previews on every branch",
      body: "Each pull request gets a live, shareable environment — no staging queue, no waiting on ops.",
    },
    {
      span: "wide",
      icon: "ShieldCheck",
      title: "Security that audits itself",
      body: "SOC 2 Type II, SSO, and audit logs out of the box. Compliance reviews go from weeks to an afternoon.",
    },
    {
      span: "quarter",
      icon: "Gauge",
      stat: "99.99%",
      title: "Uptime SLA",
    },
    {
      span: "quarter",
      icon: "Globe",
      stat: "40ms",
      title: "Global edge latency",
    },
    {
      span: "wide",
      icon: "Users",
      title: "Built for the whole team",
      body: "Granular roles, shared workspaces, and review flows that keep design, eng, and marketing in one loop.",
    },
  ],
};

function CardInner({
  card,
  accentOnCard,
  muted,
  reduced,
  onUpdate,
}: {
  card: GlassBentoCard;
  accentOnCard: string;
  muted: string;
  reduced: boolean;
  onUpdate?: (patch: Partial<GlassBentoCard>) => void;
}) {
  const set = (key: keyof GlassBentoCard) =>
    onUpdate ? (v: string) => onUpdate({ [key]: v } as Partial<GlassBentoCard>) : undefined;
  const isHero = card.span === "hero";

  return (
    <>
      {(card.imageUrl || (isHero && onUpdate)) && (
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl",
            isHero ? "h-52 sm:h-64 lg:h-auto lg:flex-1 lg:min-h-[220px]" : "h-40",
          )}
        >
          <InlineImage
            src={card.imageUrl || ""}
            alt={card.imageAlt ?? ""}
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              !reduced && "transition-transform duration-700 group-hover:scale-[1.04]",
            )}
            wrapperClassName="absolute inset-0"
            loading="lazy"
            onUpdate={onUpdate ? (url) => onUpdate({ imageUrl: url }) : undefined}
            onAltUpdate={onUpdate ? (v) => onUpdate({ imageAlt: v }) : undefined}
            focalPoint={card.imageFocal}
            onFocalUpdate={onUpdate ? (v) => onUpdate({ imageFocal: v }) : undefined}
          />
        </div>
      )}

      <div className={cn("flex flex-col gap-2.5", (card.imageUrl || (isHero && onUpdate)) && "mt-5")}>
        {(card.icon || onUpdate) && !card.stat && (
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-1"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentOnCard} 13%, transparent)`,
              color: accentOnCard,
            }}
            aria-hidden="true"
          >
            <IconOrImage value={card.icon} fallback={Sparkles} className="w-5 h-5" />
          </div>
        )}

        {(card.stat || onUpdate) && (
          <div
            className="font-bold leading-none tabular-nums"
            style={{
              fontFamily: NUMBERS,
              fontSize: "clamp(2.25rem, 3.5vw, 3rem)",
              letterSpacing: "-0.03em",
              color: accentOnCard,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <InlineText as="span" value={card.stat ?? ""} onUpdate={set("stat")} />
          </div>
        )}

        <h3
          className={cn(
            "font-semibold leading-snug",
            isHero ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
          )}
          style={{ fontFamily: DISPLAY }}
        >
          <InlineText as="span" value={card.title} onUpdate={set("title")} multiline />
        </h3>

        {(card.body || onUpdate) && (
          <p
            className={cn("leading-relaxed", isHero ? "text-sm sm:text-base" : "text-sm")}
            style={{ color: muted }}
          >
            <InlineText as="span" value={card.body ?? ""} onUpdate={set("body")} multiline />
          </p>
        )}
      </div>
    </>
  );
}

export function BlockGlassBentoFeatures({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const theme = props.theme ?? "light";

  // ── Resolved surfaces. Custom bgColor can flip the effective darkness, so
  // derive "dark" from the actual surface, not just the theme prop. ──
  const sectionBg = props.bgColor || (theme === "dark" ? "#0A0A10" : "#F7F7F4");
  const dark = relativeLuminance(sectionBg) < 0.35;
  const ink = resolveSectionInk(props, { base: sectionBg });
  const text = ink.text;
  const accent = props.accentColor || brand.accentColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";

  // Card surface ≈ section surface (glass cards are translucent), so accent
  // legibility is judged against the section background per brand-config rules.
  const accentOnSection = pickContrastingColor(accent, sectionBg, [primary], 3.0);
  const eyebrowColor = pickContrastingColor(accent, sectionBg, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const muted = ink.muted;

  const cards = props.cards && props.cards.length > 0 ? props.cards : GLASS_BENTO_DEFAULT_PROPS.cards;

  const field = (key: keyof GlassBentoFeaturesBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as GlassBentoFeaturesBlockProps[typeof key] })
      : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<GlassBentoCard>) =>
        onFieldChange({
          ...props,
          cards: cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
        })
    : undefined;

  const cardSurface = dark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const cardBorder = dark ? "rgba(255,255,255,0.09)" : "rgba(11,11,15,0.07)";
  const restShadow = dark
    ? "0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -22px rgba(0,0,0,0.7)"
    : "0 1px 2px rgba(15,15,20,0.04), 0 10px 30px -12px rgba(15,15,20,0.10)";

  return (
    <section
      className="gbf-section relative overflow-hidden"
      style={{ backgroundColor: sectionBg, color: text, fontFamily: BODY }}
    >
      <style>{`
        .gbf-card {
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.35s ease;
          will-change: transform;
        }
        @media (hover: hover) {
          .gbf-card:hover {
            transform: translateY(-4px);
            border-color: color-mix(in srgb, ${accentOnSection} 45%, ${cardBorder});
            box-shadow:
              0 0 0 1px color-mix(in srgb, ${accentOnSection} 22%, transparent),
              0 0 32px -6px color-mix(in srgb, ${accentOnSection} 28%, transparent),
              ${dark
                ? "0 24px 48px -20px rgba(0,0,0,0.75)"
                : "0 18px 44px -14px rgba(15,15,20,0.16)"};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .gbf-card, .gbf-card:hover {
            transition: none;
            transform: none;
          }
        }
      `}</style>

      {/* Dark theme: faint brand-accent gradient mesh behind the glass. */}
      {dark && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(42% 38% at 18% 12%, color-mix(in srgb, ${accent} 16%, transparent) 0%, transparent 70%),
                radial-gradient(48% 42% at 85% 30%, color-mix(in srgb, ${primary} 22%, transparent) 0%, transparent 72%),
                radial-gradient(50% 44% at 50% 100%, color-mix(in srgb, ${accent} 10%, transparent) 0%, transparent 70%)
              `,
            }}
          />
        </div>
      )}

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {(props.eyebrow || props.headline || props.subheadline || onFieldChange) && (
          <div className="max-w-3xl mb-12 lg:mb-16">
            {(props.eyebrow || onFieldChange) && (
              <p
                className="text-[11px] uppercase tracking-[0.26em] font-semibold mb-4"
                style={{ color: eyebrowColor }}
              >
                <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </p>
            )}
            {(props.headline || onFieldChange) && (
              <h2
                className="font-bold tracking-tight leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", fontFamily: DISPLAY }}
              >
                <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
              </h2>
            )}
            {(props.subheadline || onFieldChange) && (
              <p className="text-base lg:text-lg leading-relaxed mt-4 max-w-2xl" style={{ color: muted }}>
                <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              className={cn(
                "gbf-card group relative rounded-3xl p-6 sm:p-7 flex flex-col border",
                dark && "backdrop-blur-xl",
                SPAN_CLASS[card.span] ?? SPAN_CLASS.third,
              )}
              style={{
                backgroundColor: cardSurface,
                borderColor: cardBorder,
                boxShadow: restShadow,
              }}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: Math.min(i * 0.08, 0.5), ease: [0.16, 1, 0.3, 1] }}
            >
              <CardInner
                card={card}
                accentOnCard={accentOnSection}
                muted={muted}
                reduced={reduced}
                onUpdate={updateCard ? (patch) => updateCard(i, patch) : undefined}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
