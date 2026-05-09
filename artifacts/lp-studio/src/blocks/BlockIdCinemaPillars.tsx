import type { IdCinemaPillarsBlockProps, IdCinemaPillar } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
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

export function BlockIdCinemaPillars({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const pillars = props.pillars ?? [];
  const updatePillar = (i: number, patch: Partial<IdCinemaPillar>) => {
    if (!onFieldChange) return;
    const next = pillars.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onFieldChange({ ...props, pillars: next });
  };

  return (
    <section className="id-block id-cinema">
      {pillars.map((p, i) => {
        const kind = (ARTS as readonly string[]).includes(p.art) ? (p.art as ArtKind) : "scan";
        return (
          <div key={i} className={`id-cinema-pillar id-pillar-${i % 4}`}>
            <div className="id-cinema-bg" />
            <div className="id-pillar-art">
              <PillarArt kind={kind} />
            </div>
            <div className="id-pillar-meta">
              <EditableEm
                as="div"
                className="id-pillar-num"
                value={p.number ?? ""}
                onUpdate={onFieldChange ? (v) => updatePillar(i, { number: v }) : undefined}
               
              />
              <div className="id-pillar-right">
                <InlineText
                  as="div"
                  className="id-pillar-label"
                  value={p.label ?? ""}
                  onUpdate={onFieldChange ? (v) => updatePillar(i, { label: v }) : undefined}
                 
                />
                <EditableEm
                  as="h3"
                  value={p.headline ?? ""}
                  onUpdate={onFieldChange ? (v) => updatePillar(i, { headline: v }) : undefined}
                 
                />
                <EditableEm
                  as="p"
                  multiline
                  value={p.body ?? ""}
                  onUpdate={onFieldChange ? (v) => updatePillar(i, { body: v }) : undefined}
                 
                />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
