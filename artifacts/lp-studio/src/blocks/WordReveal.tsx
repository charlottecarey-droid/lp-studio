import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { isLikelyHtml, sanitizeInlineHtml } from "../lib/sanitize-inline-html";

interface WordRevealProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  dimColor?: string;
  brightColor?: string;
}

export function WordReveal({
  text,
  className,
  style,
  dimColor = "rgba(255,255,255,0.2)",
  brightColor = "#ffffff",
}: WordRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.4"],
  });

  // When an editor recolors (or bolds/links) part of this text with the inline
  // toolbar, the field value becomes HTML (e.g. `<span style="color:#C7E738">`).
  // The per-word reveal below splits on whitespace and prints each token as
  // plain text, which would dump the raw markup onto the published page (the
  // builder looks fine because it renders through the HTML-aware InlineText).
  // Render the sanitized HTML faithfully instead — the chosen color/formatting
  // wins, with `brightColor` as the base for any untagged runs. The scroll
  // reveal only applies to plain text; this is the same builder-vs-published
  // fix already applied to StatCounter. Rendering statically also keeps a CSS
  // variable out of framer's useTransform (which cannot interpolate one).
  if (isLikelyHtml(text)) {
    return (
      <span
        ref={ref}
        className={className}
        style={{ display: "inline", color: brightColor, ...style }}
        dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(text) }}
      />
    );
  }

  const words = text.trim().split(/\s+/);
  const total = words.length;

  return (
    <span ref={ref} className={className} style={{ display: "inline", ...style }}>
      {words.map((word, i) => {
        const start = i / total;
        const end = Math.min((i + 2) / total, 1);
        return (
          <Word
            key={i}
            scrollYProgress={scrollYProgress}
            start={start}
            end={end}
            dimColor={dimColor}
            brightColor={brightColor}
          >
            {word}
          </Word>
        );
      })}
    </span>
  );
}

function Word({
  children,
  scrollYProgress,
  start,
  end,
  dimColor,
  brightColor,
}: {
  children: string;
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  dimColor: string;
  brightColor: string;
}) {
  const color = useTransform(scrollYProgress, [start, end], [dimColor, brightColor]);

  return (
    <motion.span style={{ color, display: "inline" }}>
      {children}{" "}
    </motion.span>
  );
}
