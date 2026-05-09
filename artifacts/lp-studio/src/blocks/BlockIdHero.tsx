import type { IdHeroBlockProps } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdHeroBlockProps;
  onFieldChange?: (next: IdHeroBlockProps) => void;
  onCtaClick?: (url: string) => void;
}

export function BlockIdHero({ props, onFieldChange, onCtaClick }: Props) {
  useInsideDandyStyles();
  const f = (k: keyof IdHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;

  const handleCta = (url?: string) => (e: React.MouseEvent) => {
    if (!url) return;
    if (onCtaClick) { e.preventDefault(); onCtaClick(url); }
  };

  return (
    <section className="id-block id-hero">
      {props.bgImage && (
        <div className="id-hero-bg" style={{ backgroundImage: `url(${props.bgImage})` }} />
      )}
      <div className="id-hero-overlay" />
      <div className="id-hero-grid" />
      <div className="id-hero-orb" />
      <div className="id-hero-content">
        {(props.eyebrow || onFieldChange) && (
          <InlineText
            as="div"
            className="id-hero-eyebrow"
            value={props.eyebrow ?? ""}
            onUpdate={f("eyebrow")}
           
          />
        )}
        <h1>
          <EditableEm as="span" className="id-line" value={props.line1 ?? ""} onUpdate={f("line1")} />
          <EditableEm as="span" className="id-line" value={props.line2 ?? ""} onUpdate={f("line2")} />
          <EditableEm as="span" className="id-line" value={props.line3 ?? ""} onUpdate={f("line3")} />
        </h1>
        {(props.lead || onFieldChange) && (
          <EditableEm as="p" className="id-lead" multiline value={props.lead ?? ""} onUpdate={f("lead")} />
        )}
        <div className="id-ctas">
          {(props.cta1Text || onFieldChange) && (
            <a className="id-btn id-btn-primary" href={props.cta1Url || "#"} onClick={handleCta(props.cta1Url)}>
              <InlineText as="span" value={props.cta1Text ?? ""} onUpdate={f("cta1Text")} />
              <span aria-hidden>→</span>
            </a>
          )}
          {(props.cta2Text || onFieldChange) && (
            <a className="id-btn id-btn-ghost" href={props.cta2Url || "#"} onClick={handleCta(props.cta2Url)}>
              <InlineText as="span" value={props.cta2Text ?? ""} onUpdate={f("cta2Text")} />
            </a>
          )}
        </div>
      </div>
      <div className="id-scroll-hint">
        <span>Scroll</span>
        <div className="id-scroll-line" />
      </div>
    </section>
  );
}
