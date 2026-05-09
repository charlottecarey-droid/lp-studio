import type { IdParallaxShowcaseBlockProps, IdShowcaseFrame } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdParallaxShowcaseBlockProps;
  onFieldChange?: (next: IdParallaxShowcaseBlockProps) => void;
}

export function BlockIdParallaxShowcase({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const frames = props.frames ?? [];
  const f = (k: keyof IdParallaxShowcaseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;
  const updateFrame = (i: number, patch: Partial<IdShowcaseFrame>) => {
    if (!onFieldChange) return;
    const next = frames.map((fr, idx) => (idx === i ? { ...fr, ...patch } : fr));
    onFieldChange({ ...props, frames: next });
  };

  return (
    <section className="id-block id-showcase">
      <div className="id-head">
        <div>
          {(props.eyebrow || onFieldChange) && (
            <InlineText as="div" className="id-eyebrow" value={props.eyebrow ?? ""} onUpdate={f("eyebrow")} />
          )}
          <EditableEm
            as="h2"
            value={props.headline ?? ""}
            onUpdate={f("headline")}
           
          />
        </div>
        {(props.blurb || onFieldChange) && (
          <EditableEm as="p" multiline className="id-blurb" value={props.blurb ?? ""} onUpdate={f("blurb")} />
        )}
      </div>
      <div className="id-stack">
        {frames.slice(0, 3).map((fr, i) => (
          <div key={i} className={`id-frame id-f${i + 1}`}>
            {fr.imageUrl && (
              <div className="id-frame-img" style={{ backgroundImage: `url(${fr.imageUrl})` }} />
            )}
            <div className="id-frame-vignette" />
            <div className="id-frame-caption">
              <div>
                <InlineText as="div" className="id-frame-label" value={fr.label ?? ""} onUpdate={onFieldChange ? (v) => updateFrame(i, { label: v }) : undefined} />
                <EditableEm as="h4" value={fr.headline ?? ""} onUpdate={onFieldChange ? (v) => updateFrame(i, { headline: v }) : undefined} />
              </div>
              <InlineText as="div" className="id-frame-where" value={fr.where ?? ""} onUpdate={onFieldChange ? (v) => updateFrame(i, { where: v }) : undefined} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
