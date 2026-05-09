import type { IdInvitationBlockProps, IdInvitationMeta } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdInvitationBlockProps;
  onFieldChange?: (next: IdInvitationBlockProps) => void;
  onCtaClick?: (url: string) => void;
}

export function BlockIdInvitation({ props, onFieldChange, onCtaClick }: Props) {
  useInsideDandyStyles();
  const f = (k: keyof IdInvitationBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;
  const meta = props.meta ?? [];
  const updateMeta = (i: number, patch: Partial<IdInvitationMeta>) => {
    if (!onFieldChange) return;
    const next = meta.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
    onFieldChange({ ...props, meta: next });
  };
  const handleCta = (url?: string) => (e: React.MouseEvent) => {
    if (!url) return;
    if (onCtaClick) { e.preventDefault(); onCtaClick(url); }
  };

  return (
    <section className="id-block id-invite">
      <div className="id-inner">
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="div" className="id-eyebrow" value={props.eyebrow ?? ""} onUpdate={f("eyebrow")} />
        )}
        <EditableEm as="h2" value={props.headline ?? ""} onUpdate={f("headline")} />
        {(props.blurb || onFieldChange) && (
          <EditableEm as="p" multiline className="id-blurb" value={props.blurb ?? ""} onUpdate={f("blurb")} />
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
        {meta.length > 0 && (
          <div className="id-meta-row">
            {meta.map((m, i) => (
              <div key={i} className="id-item">
                <InlineText as="b" value={m.heading ?? ""} onUpdate={onFieldChange ? (v) => updateMeta(i, { heading: v }) : undefined} />
                <InlineText as="span" value={m.text ?? ""} onUpdate={onFieldChange ? (v) => updateMeta(i, { text: v }) : undefined} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
