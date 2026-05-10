import { useEffect, useRef, useState } from "react";
import type { IdIntroBlockProps } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { renderEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdIntroBlockProps;
  onFieldChange?: (next: IdIntroBlockProps) => void;
}

/**
 * Splits the statement on whitespace, keeping any <em>…</em> spans intact so
 * each visible word can be individually opacity-faded as the section scrolls
 * into view. Inside <em>…</em> blocks we still split words so each word
 * lights up sequentially (and stays in the accent color via `renderEm`).
 */
function splitWords(text: string): Array<{ key: string; node: React.ReactNode }> {
  if (!text) return [];
  const parts = text.split(/(<em>.*?<\/em>)/g);
  const out: Array<{ key: string; node: React.ReactNode }> = [];
  parts.forEach((part, pi) => {
    const m = part.match(/^<em>(.*?)<\/em>$/);
    if (m) {
      const inner = m[1];
      inner.split(/\s+/).filter(Boolean).forEach((w, wi) => {
        out.push({ key: `${pi}-em-${wi}`, node: <em>{w}</em> });
      });
    } else {
      part.split(/\s+/).forEach((w, wi) => {
        if (!w) return;
        out.push({ key: `${pi}-${wi}`, node: w });
      });
    }
  });
  return out;
}

export function BlockIdIntro({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const f = (k: keyof IdIntroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const isEditor = !!onFieldChange;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = sectionRef.current;
    if (!node) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Map [section bottom hits 80% of viewport ➜ section top hits 20%] to [0..1].
      const enter = vh * 0.85;
      const exit = vh * 0.15;
      const raw = (enter - rect.top) / (enter - exit);
      const clamped = Math.max(0, Math.min(1, raw));
      setProgress(clamped);
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const words = splitWords(props.statement ?? "");
  // Each word lights up over a small slice of total progress.
  const litUntil = isEditor ? words.length : Math.ceil(progress * words.length * 1.15);

  return (
    <section ref={sectionRef} className="id-block id-intro">
      <div className="id-inner">
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="div" className="id-eyebrow" value={props.eyebrow ?? ""} onUpdate={f("eyebrow")} />
        )}
        {isEditor ? (
          // Editor: plain editable textarea so the user can edit without the
          // scroll-fade interfering with their cursor.
          <InlineText
            as="h2"
            multiline
            value={props.statement ?? ""}
            onUpdate={f("statement")}
          />
        ) : (
          <h2 aria-label={(props.statement ?? "").replace(/<\/?em>/g, "")}>
            {words.length === 0
              ? renderEm(props.statement ?? "")
              : words.map((w, i) => (
                  <span key={w.key}>
                    <span
                      className={`id-word${i < litUntil ? " id-lit" : ""}`}
                      aria-hidden
                    >
                      {w.node}
                    </span>
                    {i < words.length - 1 ? " " : ""}
                  </span>
                ))}
          </h2>
        )}
      </div>
    </section>
  );
}
