import { useEffect, useRef, useState } from "react";
import type { IdGridBlockProps, IdGridCard } from "@/lib/block-types";
import { BRAND_BODY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm, renderEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdGridBlockProps;
  onFieldChange?: (next: IdGridBlockProps) => void;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function BlockIdGrid({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const isEditor = !!onFieldChange;
  const f = (k: keyof IdGridBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;
  const cards = (props.cards ?? []).slice(0, 4);
  const updateCard = (i: number, patch: Partial<IdGridCard>) => {
    if (!onFieldChange) return;
    const next = cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onFieldChange({ ...props, cards: next });
  };

  // Reveal-on-scroll. Fires once when the grid enters the viewport so the
  // intro + 4 cards stagger in (matches the existing hero h1 reveal). In
  // editor mode + reduced-motion we render fully visible from mount.
  const sectionRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(isEditor);
  useEffect(() => {
    if (isEditor || revealed) return;
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setRevealed(true); obs.disconnect(); break; }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isEditor, revealed]);

  return (
    <section ref={sectionRef} className={`id-block id-grid${revealed ? " id-grid-revealed" : ""}`}>
      <div className="id-inner">
        <div className="id-grid-intro">
          {(props.eyebrow || isEditor) && (
            <InlineText
              as="div"
              className="id-eyebrow"
              value={props.eyebrow ?? ""}
              onUpdate={f("eyebrow")}
            />
          )}
          <EditableEm as="h2" value={props.headline ?? ""} onUpdate={f("headline")} />
          {(props.subheading || isEditor) && (
            <EditableEm
              as="p"
              multiline
              className="id-grid-sub"
              value={props.subheading ?? ""}
              onUpdate={f("subheading")}
            />
          )}
        </div>
        <div className="id-grid-cards">
          {cards.map((card, i) => {
            const showCta = !!card.ctaText || isEditor;
            const ctaInner = (
              <>
                <InlineText
                  as="span"
                  value={card.ctaText ?? ""}
                  onUpdate={onFieldChange ? (v) => updateCard(i, { ctaText: v }) : undefined}
                style={{ fontFamily: BODY }}/>
              </>
            );
            return (
              <div key={i} className="id-grid-card">
                <div className="id-grid-num">{pad(i + 1)}</div>
                {(card.eyebrow || isEditor) && (
                  <InlineText
                    as="div"
                    className="id-grid-eyebrow"
                    value={card.eyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => updateCard(i, { eyebrow: v }) : undefined}
                  />
                )}
                <EditableEm
                  as="h3"
                  className="id-grid-headline"
                  value={card.headline ?? ""}
                  onUpdate={onFieldChange ? (v) => updateCard(i, { headline: v }) : undefined}
                />
                {(card.body || isEditor) && (
                  <EditableEm
                    as="p"
                    multiline
                    className="id-grid-body"
                    value={card.body ?? ""}
                    onUpdate={onFieldChange ? (v) => updateCard(i, { body: v }) : undefined}
                  />
                )}
                {showCta && (
                  isEditor ? (
                    <span className="id-grid-cta" style={{ fontFamily: BODY }}>{ctaInner}</span>
                  ) : (
                    <a className="id-grid-cta" href={card.ctaUrl || "#"}>
                      {renderEm(card.ctaText ?? "")}
                    </a>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
