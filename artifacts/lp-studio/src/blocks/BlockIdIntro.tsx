import type { IdIntroBlockProps } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdIntroBlockProps;
  onFieldChange?: (next: IdIntroBlockProps) => void;
}

export function BlockIdIntro({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const f = (k: keyof IdIntroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;

  return (
    <section className="id-block id-intro">
      <div className="id-inner">
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="div" className="id-eyebrow" value={props.eyebrow ?? ""} onUpdate={f("eyebrow")} />
        )}
        <EditableEm
          as="h2"
          multiline
          value={props.statement ?? ""}
          onUpdate={f("statement")}
         
        />
      </div>
    </section>
  );
}
