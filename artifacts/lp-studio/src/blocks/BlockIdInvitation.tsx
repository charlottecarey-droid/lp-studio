import type { IdInvitationBlockProps, IdInvitationMeta, IdCtaAction } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";
import { CtaButton, type CtaActionMode } from "@/components/CtaButton";

interface Props {
  props: IdInvitationBlockProps;
  onFieldChange?: (next: IdInvitationBlockProps) => void;
  onCtaClick?: (url: string) => void;
  pageId?: number;
  variantId?: number;
}

const ALLOWED: readonly IdCtaAction[] = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"];
function normalizeAction(a: string | undefined): CtaActionMode {
  return (ALLOWED as readonly string[]).includes(a ?? "") ? (a as CtaActionMode) : "url";
}

export function BlockIdInvitation({ props, onFieldChange, onCtaClick, pageId, variantId }: Props) {
  useInsideDandyStyles();
  const f = (k: keyof IdInvitationBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;
  const meta = props.meta ?? [];
  const updateMeta = (i: number, patch: Partial<IdInvitationMeta>) => {
    if (!onFieldChange) return;
    const next = meta.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
    onFieldChange({ ...props, meta: next });
  };

  const cta1Action = normalizeAction(props.cta1Action);
  const cta2Action = normalizeAction(props.cta2Action);

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
            <CtaButton
              ctaAction={cta1Action}
              ctaUrl={props.cta1Url}
              chilipiperUrl={props.cta1ChilipiperUrl}
              videoUrl={props.cta1VideoUrl}
              modalChilipiperUrl={props.modalChilipiperUrl}
              modalFormSource={props.modalFormSource}
              modalFormId={props.modalFormId}
              modalMarketoBaseUrl={props.modalMarketoBaseUrl}
              modalMarketoMunchkinId={props.modalMarketoMunchkinId}
              modalMarketoFormId={props.modalMarketoFormId}
              modalHeadline={props.modalHeadline}
              modalSubheadline={props.modalSubheadline}
              modalSubmitText={props.modalSubmitText}
              modalSuccessMessage={props.modalSuccessMessage}
              modalDisclaimer={props.modalDisclaimer}
              modalShowFirstName={props.modalShowFirstName}
              modalShowLastName={props.modalShowLastName}
              modalShowPhone={props.modalShowPhone}
              modalShowCompany={props.modalShowCompany}
              onClick={cta1Action === "url" && props.cta1Url ? () => onCtaClick?.(props.cta1Url!) : undefined}
              className="id-btn id-btn-primary"
              pageId={pageId}
              variantId={variantId}
              source="id-invite-cta1"
            >
              <InlineText as="span" value={props.cta1Text ?? ""} onUpdate={f("cta1Text")} />
              <span aria-hidden>→</span>
            </CtaButton>
          )}
          {(props.cta2Text || onFieldChange) && (
            <CtaButton
              ctaAction={cta2Action}
              ctaUrl={props.cta2Url}
              chilipiperUrl={props.cta2ChilipiperUrl}
              videoUrl={props.cta2VideoUrl}
              modalChilipiperUrl={props.modalChilipiperUrl}
              modalFormSource={props.modalFormSource}
              modalFormId={props.modalFormId}
              modalMarketoBaseUrl={props.modalMarketoBaseUrl}
              modalMarketoMunchkinId={props.modalMarketoMunchkinId}
              modalMarketoFormId={props.modalMarketoFormId}
              modalHeadline={props.modalHeadline}
              modalSubheadline={props.modalSubheadline}
              modalSubmitText={props.modalSubmitText}
              modalSuccessMessage={props.modalSuccessMessage}
              modalDisclaimer={props.modalDisclaimer}
              modalShowFirstName={props.modalShowFirstName}
              modalShowLastName={props.modalShowLastName}
              modalShowPhone={props.modalShowPhone}
              modalShowCompany={props.modalShowCompany}
              onClick={cta2Action === "url" && props.cta2Url ? () => onCtaClick?.(props.cta2Url!) : undefined}
              className="id-btn id-btn-ghost"
              pageId={pageId}
              variantId={variantId}
              source="id-invite-cta2"
            >
              <InlineText as="span" value={props.cta2Text ?? ""} onUpdate={f("cta2Text")} />
            </CtaButton>
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
