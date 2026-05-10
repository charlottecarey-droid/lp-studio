import { useEffect, useRef, useState } from "react";
import type { IdIntroBlockProps } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { renderEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdIntroBlockProps;
  onFieldChange?: (next: IdIntroBlockProps) => void;
}

type Token =
  | { kind: "space"; key: string }
  | { kind: "word"; key: string; isEm: boolean; letters: Array<{ key: string; ch: string }> };

/**
 * Tokenises the statement into words and spaces, with each word broken into
 * individual letters so each letter can fade up as the visitor scrolls.
 * <em>…</em> spans are preserved on the containing word so accent words stay
 * in the citron accent color and italic via the `.id-em-word` class.
 */
function tokenize(text: string): Token[] {
  if (!text) return [];
  const parts = text.split(/(<em>.*?<\/em>)/g);
  const out: Token[] = [];
  let n = 0;
  parts.forEach((part, pi) => {
    const m = part.match(/^<em>(.*?)<\/em>$/);
    const inner = m ? m[1] : part;
    const isEm = !!m;
    // Split on whitespace runs, keeping the runs as separate tokens so we
    // emit explicit space tokens between words.
    inner.split(/(\s+)/).forEach((segment, si) => {
      if (!segment) return;
      if (/^\s+$/.test(segment)) {
        out.push({ kind: "space", key: `s-${n++}` });
        return;
      }
      out.push({
        kind: "word",
        isEm,
        key: `w-${n++}`,
        letters: Array.from(segment).map((ch, ci) => ({ ch, key: `${pi}-${si}-${ci}` })),
      });
    });
  });
  return out;
}

export function BlockIdIntro({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const f = (k: keyof IdIntroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [progress, setProgress] = useState(0);
  const isEditor = !!onFieldChange;

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Track the <h2>, not the outer <section>. The section has 200px of
    // top padding, so if we measured its top edge the animation would
    // complete (raw → 1) while the h2 was still 200px below the fold —
    // visitors saw the statement already fully lit before they could read
    // it. Anchoring on the h2 means the letters light up exactly as the
    // headline scrolls from the bottom of the viewport up to the top.
    let raf = 0;
    const tick = () => {
      raf = 0;
      const node = headingRef.current ?? sectionRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Map [headline top hits 85% of viewport ➜ headline top hits 15%] to [0..1].
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
    // Listen in the CAPTURE phase on document so we catch scrolls from any
    // ancestor scroll container (the builder preview pane scrolls inside
    // <main overflow-y-auto>, not window). Plain window scroll listeners
    // miss those events, which is why the letter reveal sat frozen at the
    // initial dim state in the builder.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const letterReveal = props.letterReveal !== false;
  const tokens = tokenize(props.statement ?? "");
  const totalLetters = tokens.reduce((acc, t) => acc + (t.kind === "word" ? t.letters.length : 0), 0);
  // Each letter lights up over a small slice of total progress. The 1.15
  // multiplier ensures the last letter is fully lit slightly before scroll
  // exits, so the statement reads as "complete" before fading away.
  // When the reveal animation is disabled, treat every letter as lit.
  const litUntil = isEditor || !letterReveal ? totalLetters : Math.ceil(progress * totalLetters * 1.15);

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
          <h2 ref={headingRef} aria-label={(props.statement ?? "").replace(/<\/?em>/g, "")}>
            {totalLetters === 0 || !letterReveal
              ? renderEm(props.statement ?? "")
              : (() => {
                  let letterIdx = 0;
                  return tokens.map((t) => {
                    if (t.kind === "space") return <span key={t.key}> </span>;
                    return (
                      <span key={t.key} className={`id-word${t.isEm ? " id-em-word" : ""}`} aria-hidden>
                        {t.letters.map((l) => {
                          const lit = letterIdx < litUntil;
                          letterIdx += 1;
                          return (
                            <span key={l.key} className={`id-letter${lit ? " id-lit" : ""}`}>
                              {l.ch}
                            </span>
                          );
                        })}
                      </span>
                    );
                  });
                })()}
          </h2>
        )}
      </div>
    </section>
  );
}
