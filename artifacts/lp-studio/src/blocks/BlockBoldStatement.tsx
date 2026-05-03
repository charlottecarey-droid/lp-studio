import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { BoldStatementBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { WordReveal } from "./WordReveal";

interface Props {
  props: BoldStatementBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: BoldStatementBlockProps) => void;
}

/** Convert a 3- or 6-digit hex color to an `rgba(...)` string with the
 *  given alpha. Returns null when the input isn't a hex literal so callers
 *  can fall back to a safe default (Framer Motion's color interpolator
 *  needs hex/rgb/rgba/hsl — not CSS vars or color-mix). */
function hexToRgba(hex: string, alpha: number): string | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map(c => c + c).join("") : m[1];
  const num = parseInt(h, 16);
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
}

/** Split the statement into accent (em) vs plain segments and render each.
 *  When `scrollReveal` is true each segment is wrapped in a WordReveal so the
 *  whole sentence lights up word-by-word as the visitor scrolls — italic
 *  segments still resolve to the accent color when fully revealed. */
function renderStatement(
  html: string,
  accent: string,
  text: string,
  scrollReveal: boolean,
  dimColor: string,
): React.ReactNode {
  const parts = html.split(/(<em[^>]*>.*?<\/em>)/gi);
  return parts.map((part, i) => {
    const m = part.match(/^<em[^>]*>(.*)<\/em>$/i);
    const isAccent = !!m;
    const content = m ? m[1] : part;
    if (!content) return null;
    if (scrollReveal) {
      return (
        <WordReveal
          key={i}
          text={content}
          dimColor={dimColor}
          brightColor={isAccent ? accent : text}
          style={isAccent ? { fontStyle: "italic" } : undefined}
        />
      );
    }
    if (isAccent) {
      return (
        <span key={i} style={{ color: accent, fontStyle: "italic" }}>
          {content}
        </span>
      );
    }
    return <span key={i}>{content}</span>;
  });
}

export function BlockBoldStatement({ props, brand, onCtaClick, onFieldChange }: Props) {
  const bg = props.bgColor || "#0A0A0A";
  const text = props.textColor || "#FFFFFF";
  const accent = props.accentColor || brand.accentColor || "#C7E738";
  // Disable scroll-reveal in the editor (when onFieldChange is set) so the
  // author can always see the full statement while editing.
  const scrollReveal = !!props.scrollReveal && !onFieldChange;
  // Framer Motion's color interpolator only handles hex/rgb/rgba/hsl strings
  // — `color-mix(...)` and CSS variables aren't animatable — so derive the
  // default dim color as an rgba() literal from the text color when it's a
  // hex; otherwise fall back to white-at-20%.
  const dimColor = props.dimColor || hexToRgba(text, 0.2) || "rgba(255,255,255,0.2)";
  const field = (key: keyof BoldStatementBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  return (
    <section
      className="relative overflow-hidden font-sans"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-36">
        {(props.eyebrow || onFieldChange) && (
          <div
            className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] font-semibold mb-10"
            style={{ color: accent }}
          >
            <span
              className="inline-block w-10 h-px"
              style={{ backgroundColor: accent }}
            />
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={field("eyebrow")}
            />
          </div>
        )}

        <h2
          className="font-bold leading-[0.92] tracking-tight max-w-6xl"
          style={{
            fontSize: "clamp(3.5rem, 11vw, 10rem)",
            letterSpacing: "-0.04em",
          }}
        >
          {renderStatement(props.statement, accent, text, scrollReveal, dimColor)}
        </h2>

        {(props.footnote || props.ctaText) && (
          <div
            className="mt-14 lg:mt-20 flex flex-col lg:flex-row gap-6 lg:items-end lg:justify-between border-t pt-8"
            style={{ borderColor: `${text}1A` }}
          >
            {(props.footnote || onFieldChange) && (
              <InlineText
                as="p"
                multiline
                value={props.footnote ?? ""}
                onUpdate={field("footnote")}
                className="text-base lg:text-lg max-w-xl leading-relaxed"
                style={{ opacity: 0.7 }}
              />
            )}
            {(props.ctaText || onFieldChange) && (
              <button
                type="button"
                onClick={() => {
                  if (onCtaClick) return onCtaClick();
                  if (props.ctaUrl && props.ctaUrl !== "#") {
                    window.location.href = props.ctaUrl;
                  }
                }}
                className="inline-flex items-center gap-2 px-7 py-4 font-semibold rounded-full transition-transform hover:-translate-y-0.5 self-start lg:self-auto"
                style={{ backgroundColor: accent, color: bg }}
              >
                <InlineText
                  as="span"
                  value={props.ctaText ?? ""}
                  onUpdate={field("ctaText")}
                />
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Decorative oversized character in the corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-10 select-none"
        style={{
          fontSize: "28rem",
          lineHeight: 1,
          fontFamily: "'Playfair Display', Georgia, serif",
          color: accent,
          opacity: 0.06,
        }}
      >
        &
      </div>
    </section>
  );
}
