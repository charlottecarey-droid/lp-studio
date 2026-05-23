import { useEffect, useRef, useState } from "react";
import type { IdHeroBlockProps, IdCtaAction } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";
import { CtaButton, type CtaActionMode } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

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
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isEditor) return;
    const t = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(t);
  }, [isEditor]);

  // Hero scroll choreography. Drives three things off the same rAF loop:
  //   1. --id-hero-scroll (0..1, local) — fades & shrinks the giant headline
  //      as the user scrolls past, so the next section feels like the payoff.
  //   2. --scroll-progress (0..1, global on <html>) — feeds the page-wide
  //      progress bar at the top of the viewport (Apple/Linear-style).
  //   3. --id-orb-x / --id-orb-y (px offsets, local) — soft cursor parallax
  //      for the .id-signal-orb so the hero feels alive at rest.
  // Disabled in editor mode and for prefers-reduced-motion.
  useEffect(() => {
    if (isEditor) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = sectionRef.current;
    if (!el) return;
    let raf = 0;
    // Mouse target (where the orb wants to drift toward) and current
    // position (eased per-frame for a heavy, premium feel — not snappy).
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let running = true;
    const tick = () => {
      raf = 0;
      const h = el.offsetHeight || 1;
      const top = el.getBoundingClientRect().top;
      const t = Math.max(0, Math.min(1, -top / h));
      el.style.setProperty("--id-hero-scroll", t.toFixed(3));
      // Page-wide scroll progress (full document, 0..1).
      const de = document.documentElement;
      const max = (de.scrollHeight - window.innerHeight) || 1;
      const sp = Math.max(0, Math.min(1, window.scrollY / max));
      de.style.setProperty("--scroll-progress", sp.toFixed(4));
      // Ease orb toward target.
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty("--id-orb-x", `${cx.toFixed(1)}px`);
      el.style.setProperty("--id-orb-y", `${cy.toFixed(1)}px`);
      if (running && (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1)) {
        raf = requestAnimationFrame(tick);
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      // Only react while the cursor is roughly over the hero (avoid drifting
      // the orb based on mouse-move events happening 5 sections down).
      if (e.clientY < r.top - 200 || e.clientY > r.bottom + 200) return;
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      // Cap travel so the orb stays inside the visor halo region.
      tx = Math.max(-1, Math.min(1, nx)) * 64;
      ty = Math.max(-1, Math.min(1, ny)) * 40;
      schedule();
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.style.removeProperty("--scroll-progress");
    };
  }, [isEditor]);

  const f = (k: keyof IdHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;

  const cta1Action = normalizeAction(props.cta1Action);
  const cta2Action = normalizeAction(props.cta2Action);

  const headlineScale = Math.max(0.5, Math.min(1.5, props.headlineScale ?? 1));

  return (
    <section
      ref={sectionRef}
      className={`id-block id-hero${ready ? " id-ready" : ""}${
        props.align === "left" ? " id-hero-align-left" : ""
      }`}
      style={{ ["--id-hero-h1-scale" as never]: String(headlineScale) }}
    >
      {props.bgImage && (
        <div
          className="id-hero-bg"
          style={{
            backgroundImage: `url(${props.bgImage})`,
            // Override the stylesheet's `filter` so the user can tune the
            // photo brightness from the panel. Clamp to a safe range and
            // keep the saturate/contrast values from insideDandyStyles in
            // sync so only the brightness changes here.
            filter: `saturate(0.42) contrast(1.04) brightness(${Math.max(
              0.3,
              Math.min(1.5, props.bgBrightness ?? 0.88),
            ).toFixed(2)})`,
          }}
        />
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
        <h1 style={{ fontFamily: DISPLAY }}>
          <span className="id-line" style={{ fontFamily: DISPLAY }}>
            <EditableEm as="span" className="id-line-inner" value={props.line1 ?? ""} onUpdate={f("line1")} />
          </span>
          <span className="id-line" style={{ fontFamily: DISPLAY }}>
            <EditableEm as="span" className="id-line-inner" value={props.line2 ?? ""} onUpdate={f("line2")} />
          </span>
          <span className="id-line" style={{ fontFamily: DISPLAY }}>
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
              modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
              modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
              modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
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
              <InlineText as="span" value={props.cta1Text ?? ""} onUpdate={f("cta1Text")} style={{ fontFamily: BODY }}/>
              <span aria-hidden style={{ fontFamily: BODY }}>→</span>
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
              modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
              modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
              modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
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
              <InlineText as="span" value={props.cta2Text ?? ""} onUpdate={f("cta2Text")} style={{ fontFamily: BODY }}/>
            </CtaButton>
          )}
        </div>
      </div>
      <div className="id-scroll-hint" aria-hidden>
        <span style={{ fontFamily: BODY }}>Scroll</span>
        <div className="id-scroll-line" />
      </div>
    </section>
  );
}
