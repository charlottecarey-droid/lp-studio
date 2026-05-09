import type { IdStatsBlockProps, IdStatItem } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdStatsBlockProps;
  onFieldChange?: (next: IdStatsBlockProps) => void;
}

export function BlockIdStats({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const stats = props.stats ?? [];
  const updateStat = (i: number, patch: Partial<IdStatItem>) => {
    if (!onFieldChange) return;
    const next = stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onFieldChange({ ...props, stats: next });
  };

  return (
    <section className="id-block id-stats">
      <div className="id-inner">
        {stats.slice(0, 4).map((s, i) => (
          <div key={i} className="id-stat">
            <EditableEm
              as="div"
              className="id-num"
              value={s.value ?? ""}
              onUpdate={onFieldChange ? (v) => updateStat(i, { value: v }) : undefined}
             
            />
            <div>
              <InlineText as="div" className="id-label" value={s.label ?? ""} onUpdate={onFieldChange ? (v) => updateStat(i, { label: v }) : undefined} />
              <EditableEm as="div" multiline className="id-desc" value={s.description ?? ""} onUpdate={onFieldChange ? (v) => updateStat(i, { description: v }) : undefined} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
