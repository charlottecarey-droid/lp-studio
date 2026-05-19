import type { IdGridBlockProps, IdGridCard } from "@/lib/block-types";
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

  return (
    <section className="id-block id-grid">
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
                />
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
                    <span className="id-grid-cta">{ctaInner}</span>
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
