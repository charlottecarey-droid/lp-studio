import { useEffect, useState } from "react";
import type { IdHeroBlockProps, IdCtaAction } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";
import { CtaButton, type CtaActionMode } from "@/components/CtaButton";

interface Props {
  props: IdHeroBlockProps;
  onFieldChange?: (next: IdHeroBlockProps) => void;
  onCtaClick?: (url: string) => void;
  pageId?: number;
  variantId?: number;
}

const ALLOWED: readonly IdCtaAction[] = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"];
function normalizeAction(a: string | undefined): CtaActionMode {
  return (ALLOWED as readonly string[]).includes(a ?? "") ? (a as CtaActionMode) : "url";
}

export function BlockIdHero({ props, onFieldChange, onCtaClick, pageId, variantId }: Props) {
  useInsideDandyStyles();
  const isEditor = !!onFieldChange;
  const [ready, setReady] = useState(isEditor);

  useEffect(() => {
    if (isEditor) return;
    const t = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(t);
  }, [isEditor]);

  const f = (k: keyof IdHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;

  const cta1Action = normalizeAction(props.cta1Action);
  const cta2Action = normalizeAction(props.cta2Action);

  return (
    <section className={`id-block id-hero${ready ? " id-ready" : ""}`}>
      {props.bgImage && (
        <div className="id-hero-bg" style={{ backgroundImage: `url(${props.bgImage})` }} />
      )}
      <div className="id-hero-overlay" />
      <div className="id-hero-grid" />
      <div className="id-signal-orb" aria-hidden />
      <div className="id-hero-content">
        {(props.eyebrow || isEditor) && (
          <InlineText
            as="div"
            className="id-hero-eyebrow"
            value={props.eyebrow ?? ""}
            onUpdate={f("eyebrow")}
          />
        )}
        <h1>
          <span className="id-line">
            <EditableEm as="span" className="id-line-inner" value={props.line1 ?? ""} onUpdate={f("line1")} />
          </span>
          <span className="id-line">
            <EditableEm as="span" className="id-line-inner" value={props.line2 ?? ""} onUpdate={f("line2")} />
          </span>
          <span className="id-line">
            <EditableEm as="span" className="id-line-inner" value={props.line3 ?? ""} onUpdate={f("line3")} />
          </span>
        </h1>
        {(props.lead || isEditor) && (
          <EditableEm as="p" className="id-lead" multiline value={props.lead ?? ""} onUpdate={f("lead")} />
        )}
        <div className="id-ctas">
          {(props.cta1Text || isEditor) && (
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
              source="id-hero-cta1"
            >
              <InlineText as="span" value={props.cta1Text ?? ""} onUpdate={f("cta1Text")} />
              <span aria-hidden>→</span>
            </CtaButton>
          )}
          {(props.cta2Text || isEditor) && (
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
              source="id-hero-cta2"
            >
              <InlineText as="span" value={props.cta2Text ?? ""} onUpdate={f("cta2Text")} />
            </CtaButton>
          )}
        </div>
      </div>
      <div className="id-scroll-hint" aria-hidden>
        <span>Scroll</span>
        <div className="id-scroll-line" />
      </div>
    </section>
  );
}
