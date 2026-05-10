import { useRef } from "react";
import type { IdParallaxShowcaseBlockProps, IdShowcaseFrame } from "@/lib/block-types";
import { useInsideDandyStyles, useIdInView } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdParallaxShowcaseBlockProps;
  onFieldChange?: (next: IdParallaxShowcaseBlockProps) => void;
}

interface FrameProps {
  frame: IdShowcaseFrame;
  index: number;
  onUpdate?: (patch: Partial<IdShowcaseFrame>) => void;
  isEditor: boolean;
}

function Frame({ frame, index, onUpdate, isEditor }: FrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  useIdInView(ref, { threshold: isEditor ? 0 : 0.2 });
  return (
    <div ref={ref} className={`id-frame id-f${index + 1}${isEditor ? " id-in-view" : ""}`}>
      {frame.imageUrl && (
        <div
          className="id-frame-img"
          style={{
            backgroundImage: `url(${frame.imageUrl})`,
            backgroundPosition: frame.imagePosition || "center",
          }}
        />
      )}
      <div className="id-frame-vignette" />
      <div className="id-frame-caption">
        <div>
          <InlineText as="div" className="id-frame-label" value={frame.label ?? ""} onUpdate={onUpdate ? (v) => onUpdate({ label: v }) : undefined} />
          <EditableEm as="h4" value={frame.headline ?? ""} onUpdate={onUpdate ? (v) => onUpdate({ headline: v }) : undefined} />
        </div>
        <InlineText as="div" className="id-frame-where" value={frame.where ?? ""} onUpdate={onUpdate ? (v) => onUpdate({ where: v }) : undefined} />
      </div>
    </div>
  );
}

export function BlockIdParallaxShowcase({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const frames = props.frames ?? [];
  const isEditor = !!onFieldChange;
  const f = (k: keyof IdParallaxShowcaseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;
  const updateFrame = (i: number, patch: Partial<IdShowcaseFrame>) => {
    if (!onFieldChange) return;
    const next = frames.map((fr, idx) => (idx === i ? { ...fr, ...patch } : fr));
    onFieldChange({ ...props, frames: next });
  };

  // Map 0..1 strength to a starting zoom factor of 1.00 → 1.16.
  const strength = Math.max(0, Math.min(1, props.parallaxStrength ?? 0.5));
  const startScale = 1 + 0.16 * strength;

  return (
    <section
      className="id-block id-showcase"
      style={{ ["--id-parallax-start" as never]: String(startScale) }}
    >
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
          <Frame
            key={i}
            frame={fr}
            index={i}
            isEditor={isEditor}
            onUpdate={onFieldChange ? (patch) => updateFrame(i, patch) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
