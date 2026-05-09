import { useRef } from "react";
import type { IdCinemaPillarsBlockProps, IdCinemaPillar } from "@/lib/block-types";
import { useInsideDandyStyles, useIdInView } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdCinemaPillarsBlockProps;
  onFieldChange?: (next: IdCinemaPillarsBlockProps) => void;
}

const ARTS = ["scan", "design", "rail", "bars"] as const;
type ArtKind = (typeof ARTS)[number];

function PillarArt({ kind }: { kind: ArtKind }) {
  if (kind === "scan") {
    return (
      <div className="id-art-scan">
        <div className="id-ring" />
        <div className="id-ring id-r2" />
        <div className="id-ring id-r3" />
        <div className="id-core" />
      </div>
    );
  }
  if (kind === "design") {
    return (
      <div className="id-art-grid">
        <div className="id-grid-floor" />
      </div>
    );
  }
  if (kind === "rail") {
    return (
      <div className="id-art-rail">
        <div className="id-node" />
        <div className="id-node" />
        <div className="id-node" />
        <div className="id-node" />
        <div className="id-node" />
      </div>
    );
  }
  return (
    <div className="id-art-bars">
      {[30, 48, 38, 62, 55, 74, 68, 82, 78, 92, 88, 100].map((h, i) => (
        <div key={i} className="id-bar" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

interface PillarProps {
  pillar: IdCinemaPillar;
  index: number;
  onUpdate?: (patch: Partial<IdCinemaPillar>) => void;
  isEditor: boolean;
}

function Pillar({ pillar, index, onUpdate, isEditor }: PillarProps) {
  const ref = useRef<HTMLDivElement>(null);
  // In the builder we want the entrance animation to be visible immediately so
  // editors aren't staring at faded-out content. Outside the builder we wait
  // for the section to actually scroll into view.
  useIdInView(ref, { threshold: isEditor ? 0 : 0.25, rootMargin: isEditor ? "0px" : "-10% 0px" });
  const kind = (ARTS as readonly string[]).includes(pillar.art) ? (pillar.art as ArtKind) : "scan";
  return (
    <div ref={ref} className={`id-cinema-pillar id-pillar-${index % 4}${isEditor ? " id-in-view" : ""}`}>
      <div className="id-cinema-bg" />
      <div className="id-pillar-art">
        <PillarArt kind={kind} />
      </div>
      <div className="id-pillar-meta">
        <EditableEm
          as="div"
          className="id-pillar-num"
          value={pillar.number ?? ""}
          onUpdate={onUpdate ? (v) => onUpdate({ number: v }) : undefined}
        />
        <div className="id-pillar-right">
          <InlineText
            as="div"
            className="id-pillar-label"
            value={pillar.label ?? ""}
            onUpdate={onUpdate ? (v) => onUpdate({ label: v }) : undefined}
          />
          <EditableEm
            as="h3"
            value={pillar.headline ?? ""}
            onUpdate={onUpdate ? (v) => onUpdate({ headline: v }) : undefined}
          />
          <EditableEm
            as="p"
            multiline
            value={pillar.body ?? ""}
            onUpdate={onUpdate ? (v) => onUpdate({ body: v }) : undefined}
          />
        </div>
      </div>
    </div>
  );
}

export function BlockIdCinemaPillars({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const pillars = props.pillars ?? [];
  const isEditor = !!onFieldChange;
  const updatePillar = (i: number, patch: Partial<IdCinemaPillar>) => {
    if (!onFieldChange) return;
    const next = pillars.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onFieldChange({ ...props, pillars: next });
  };

  return (
    <section className="id-block id-cinema">
      {pillars.map((p, i) => (
        <Pillar
          key={i}
          pillar={p}
          index={i}
          isEditor={isEditor}
          onUpdate={onFieldChange ? (patch) => updatePillar(i, patch) : undefined}
        />
      ))}
    </section>
  );
}
