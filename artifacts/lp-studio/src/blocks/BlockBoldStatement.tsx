import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { BoldStatementBlockProps } from "@/lib/block-types";

interface Props {
  props: BoldStatementBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

function renderStatement(html: string, accent: string): React.ReactNode {
  const parts = html.split(/(<em[^>]*>.*?<\/em>)/gi);
  return parts.map((part, i) => {
    const m = part.match(/^<em[^>]*>(.*)<\/em>$/i);
    if (m) {
      return (
        <span key={i} style={{ color: accent, fontStyle: "italic" }}>
          {m[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function BlockBoldStatement({ props, brand, onCtaClick }: Props) {
  const bg = props.bgColor || "#0A0A0A";
  const text = props.textColor || "#FFFFFF";
  const accent = props.accentColor || brand.accentColor || "#C7E738";

  return (
    <section
      className="relative overflow-hidden font-sans"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-36">
        {props.eyebrow && (
          <div
            className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] font-semibold mb-10"
            style={{ color: accent }}
          >
            <span
              className="inline-block w-10 h-px"
              style={{ backgroundColor: accent }}
            />
            {props.eyebrow}
          </div>
        )}

        <h2
          className="font-bold leading-[0.92] tracking-tight max-w-6xl"
          style={{
            fontSize: "clamp(3.5rem, 11vw, 10rem)",
            letterSpacing: "-0.04em",
          }}
        >
          {renderStatement(props.statement, accent)}
        </h2>

        {(props.footnote || props.ctaText) && (
          <div
            className="mt-14 lg:mt-20 flex flex-col lg:flex-row gap-6 lg:items-end lg:justify-between border-t pt-8"
            style={{ borderColor: `${text}1A` }}
          >
            {props.footnote && (
              <p
                className="text-base lg:text-lg max-w-xl leading-relaxed"
                style={{ opacity: 0.7 }}
              >
                {props.footnote}
              </p>
            )}
            {props.ctaText && (
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
                {props.ctaText}
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
